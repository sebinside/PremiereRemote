import { WebSocketServer, WebSocket } from "ws";
import type { AddressInfo } from "net";
import { randomUUID } from "crypto";
import type {
    IncomingMessage,
    OutgoingMessage,
    SourceType,
} from "premiereremote-shared";
import { log, logError, logAndExit } from "../log.js";

export interface Bridge {
    isConnected(): boolean;
    sendToUxp(
        actionId: string,
        params: Record<string, unknown>,
        sourceType: SourceType,
    ): Promise<OutgoingMessage>;
}

const REQUEST_TIMEOUT_MS = 60_000;

type PendingRequest = {
    resolve: (msg: OutgoingMessage) => void;
    timer: ReturnType<typeof setTimeout>;
};

export class UxpBridge implements Bridge {
    private wss: WebSocketServer | null = null;
    private uxpSocket: WebSocket | null = null;
    private readonly pending = new Map<string, PendingRequest>();

    constructor(
        readonly port: number,
        private readonly requestTimeoutMs: number = REQUEST_TIMEOUT_MS,
    ) {}

    /** Binds the port and starts accepting UXP connections. Resolves once listening. */
    start(): Promise<void> {
        const wss = new WebSocketServer({ port: this.port });
        this.wss = wss;

        const listening = new Promise<void>((resolve, reject) => {
            wss.once("listening", resolve);
            wss.once("error", reject);
        });

        wss.on("connection", (ws) => {
            log("UXP", "plugin connected");
            this.uxpSocket = ws;

            ws.on("message", (data) => {
                let msg: OutgoingMessage;
                try {
                    msg = JSON.parse(data.toString()) as OutgoingMessage;
                } catch {
                    logError(
                        "UXP",
                        "failed to parse message:",
                        data.toString(),
                    );
                    return;
                }

                const req = this.pending.get(msg.id);
                if (req) {
                    clearTimeout(req.timer);
                    this.pending.delete(msg.id);
                    req.resolve(msg);
                }
            });

            ws.on("close", () => {
                log("UXP", "plugin disconnected");
                this.uxpSocket = null;
                this.rejectAllPending("UXP connection closed");
            });

            ws.on("error", (err) => logError("UXP", "socket error:", err));
        });

        wss.on("listening", () => {
            log("UXP", `Listening on ws://localhost:${this.port}`);
        });

        wss.on("error", logAndExit("UXP"));

        return listening;
    }

    /** The actual bound port — differs from the constructor's `port` when that was `0`. */
    get boundPort(): number {
        return (this.wss!.address() as AddressInfo).port;
    }

    isConnected(): boolean {
        return (
            this.uxpSocket !== null &&
            this.uxpSocket.readyState === WebSocket.OPEN
        );
    }

    sendToUxp(
        actionId: string,
        params: Record<string, unknown>,
        sourceType: SourceType,
    ): Promise<OutgoingMessage> {
        if (!this.isConnected()) {
            return Promise.resolve({
                id: randomUUID(),
                status: "INTERNAL_ERROR",
                message: "Premiere Pro is not connected",
            });
        }

        return new Promise<OutgoingMessage>((resolve) => {
            const id = randomUUID();

            const timer = setTimeout(() => {
                this.pending.delete(id);
                resolve({
                    id,
                    status: "INTERNAL_ERROR",
                    message: "Request timed out",
                });
            }, this.requestTimeoutMs);

            this.pending.set(id, { resolve, timer });

            const msg: IncomingMessage = {
                id,
                actionId,
                sourceType,
                ...(Object.keys(params).length > 0 ? { params } : {}),
            };

            this.uxpSocket!.send(JSON.stringify(msg));
        });
    }

    private rejectAllPending(reason: string): void {
        for (const [id, req] of this.pending) {
            clearTimeout(req.timer);
            req.resolve({ id, status: "INTERNAL_ERROR", message: reason });
        }
        this.pending.clear();
    }

    close(): Promise<void> {
        this.rejectAllPending("Server is shutting down");
        return new Promise((resolve) => {
            if (this.wss) this.wss.close(() => resolve());
            else resolve();
        });
    }
}
