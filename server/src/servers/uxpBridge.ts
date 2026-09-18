import { WebSocketServer, WebSocket, type RawData } from "ws";
import type { AddressInfo } from "net";
import { randomUUID } from "crypto";
import type {
    IncomingMessage,
    OutgoingMessage,
    SourceType,
} from "premiereremote-shared";
import { UXP_REQUEST_TIMEOUT_MS } from "premiereremote-shared/config";
import type { ManagedServer } from "./server.js";
import { log, logError, logAndExit } from "../log.js";

/** WebSocket close code for "Policy Violation" */
const CLOSE_POLICY_VIOLATION = 1008;

/** A bridge between the server and the UXP plugin. */
export interface Bridge {
    isConnected(): boolean;
    sendToUxp(
        actionId: string,
        params: Record<string, unknown>,
        sourceType: SourceType,
    ): Promise<OutgoingMessage>;
}

/** A request that is pending a response from the UXP plugin. */
type PendingRequest = {
    resolve: (msg: OutgoingMessage) => void;
    timer: NodeJS.Timeout;
};

export class UxpBridge implements Bridge, ManagedServer {
    private wss: WebSocketServer | null = null;
    private uxpSocket: WebSocket | null = null;
    private readonly pending = new Map<string, PendingRequest>();

    constructor(
        readonly port: number,
        private readonly requestTimeoutMs: number = UXP_REQUEST_TIMEOUT_MS,
    ) {}

    start(): Promise<void> {
        const wss = new WebSocketServer({ port: this.port });
        this.wss = wss;

        const listening = new Promise<void>((resolve, reject) => {
            wss.once("listening", resolve);
            wss.once("error", reject);
        });

        wss.on("connection", (ws) => {
            if (this.uxpSocket?.readyState === WebSocket.OPEN) {
                logError(
                    "UXP",
                    "rejected a new Premiere connection; only one is supported at a time",
                );
                ws.close(
                    CLOSE_POLICY_VIOLATION,
                    "Only one Premiere connection is allowed",
                );
                return;
            }

            log("UXP", "plugin connected");
            this.uxpSocket = ws;

            ws.on("message", this.handleUxpMessage);
            ws.on("close", this.handleUxpClose);
            ws.on("error", (err) => logError("UXP", "socket error:", err));
        });

        wss.on("listening", () => {
            log("UXP", `Listening on ws://localhost:${this.port}`);
        });

        wss.on("error", logAndExit("UXP"));

        return listening;
    }

    close(): Promise<void> {
        this.rejectAllPending("Server is shutting down");
        return new Promise((resolve) => {
            if (this.wss) this.wss.close(() => resolve());
            else resolve();
        });
    }

    get boundPort(): number {
        if (!this.wss) {
            throw new Error(
                "boundPort accessed before UxpBridge.start() completed",
            );
        }
        return (this.wss.address() as AddressInfo).port;
    }

    /** Returns true if the UXP plugin is currently connected. */
    isConnected(): boolean {
        return (
            this.uxpSocket !== null &&
            this.uxpSocket.readyState === WebSocket.OPEN
        );
    }

    /** Sends a message to the UXP plugin and returns a promise that resolves with the response. */
    sendToUxp(
        actionId: string,
        params: Record<string, unknown>,
        sourceType: SourceType,
    ): Promise<OutgoingMessage> {
        const socket = this.uxpSocket;
        if (!socket || socket.readyState !== WebSocket.OPEN) {
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

            socket.send(JSON.stringify(msg));
        });
    }

    /** Handles a message received from the UXP plugin. */
    private handleUxpMessage = (data: RawData): void => {
        let msg: OutgoingMessage;
        try {
            msg = JSON.parse(data.toString()) as OutgoingMessage;
        } catch {
            logError("UXP", "failed to parse message:", data.toString());
            return;
        }

        const req = this.pending.get(msg.id);
        if (req) {
            clearTimeout(req.timer);
            this.pending.delete(msg.id);
            req.resolve(msg);
        }
    };

    /** Handles the UXP plugin disconnecting. Rejects all pending requests. */
    private handleUxpClose = (): void => {
        log("UXP", "plugin disconnected");
        this.uxpSocket = null;
        this.rejectAllPending("UXP connection closed");
    };

    /** Iterates over all pending requests and rejects them with the given reason. */
    private rejectAllPending(reason: string): void {
        for (const [id, req] of this.pending) {
            clearTimeout(req.timer);
            req.resolve({ id, status: "INTERNAL_ERROR", message: reason });
        }
        this.pending.clear();
    }
}
