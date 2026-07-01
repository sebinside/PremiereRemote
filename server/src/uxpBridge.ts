import { WebSocketServer, WebSocket } from "ws";
import { randomUUID } from "crypto";
import type { IncomingMessage, OutgoingMessage, SourceType } from "premiereremote-shared";

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
    private readonly wss: WebSocketServer;
    private uxpSocket: WebSocket | null = null;
    private readonly pending = new Map<string, PendingRequest>();

    constructor(readonly port: number) {
        this.wss = new WebSocketServer({ port });

        this.wss.on("connection", (ws) => {
            console.log("UXP plugin connected");
            this.uxpSocket = ws;

            ws.on("message", (data) => {
                let msg: OutgoingMessage;
                try {
                    msg = JSON.parse(data.toString()) as OutgoingMessage;
                } catch {
                    console.error("Failed to parse message from UXP:", data.toString());
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
                console.log("UXP plugin disconnected");
                this.uxpSocket = null;
                this.rejectAllPending("UXP connection closed");
            });
        });

        this.wss.on("listening", () => {
            console.log(`UXP bridge listening on ws://localhost:${port}`);
        });
    }

    isConnected(): boolean {
        return this.uxpSocket !== null && this.uxpSocket.readyState === WebSocket.OPEN;
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
                message: "UXP is not connected",
            });
        }

        return new Promise<OutgoingMessage>((resolve) => {
            const id = randomUUID();

            const timer = setTimeout(() => {
                this.pending.delete(id);
                resolve({ id, status: "INTERNAL_ERROR", message: "Request timed out" });
            }, REQUEST_TIMEOUT_MS);

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

    close(): void {
        this.rejectAllPending("Server is shutting down");
        this.wss.close();
    }
}
