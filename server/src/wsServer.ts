import { WebSocketServer, WebSocket, type RawData } from "ws";
import { randomUUID } from "crypto";
import type { ResponseStatus } from "premiereremote-shared";
import type { Bridge } from "./uxpBridge.js";
import {
    Ajv,
    type ValidateFunction,
    type OpenAPIOperation,
    loadOperations,
    buildArgsSchema,
    buildValidator,
    formatValidationErrors,
    logDispatch,
} from "./openapiOperations.js";

/** Reserved action name for operation discovery — never a real operationId (those all contain "/"). */
const LIST_ACTION = "$list";

interface WsMessage {
    action: string;
    args?: Record<string, unknown>;
}

interface WsResponse {
    id: string;
    status: "ok" | "error";
    result?: unknown;
    error?: string;
    /** Present on error: mirrors the bridge's ResponseStatus so clients can branch without string-matching `error`. */
    code?: ResponseStatus;
}

export class WsServer {
    private readonly wss: WebSocketServer;
    private readonly ajv = new Ajv();
    private readonly validators = new Map<string, ValidateFunction>();
    private readonly operations: Map<string, OpenAPIOperation>;

    constructor(
        readonly port: number,
        private readonly bridge: Bridge,
        openApiSpecPath: string,
    ) {
        this.operations = loadOperations(openApiSpecPath);
        for (const [operationId, operation] of this.operations) {
            const validator = buildValidator(this.ajv, operation);
            if (validator) this.validators.set(operationId, validator);
        }

        this.wss = new WebSocketServer({ port });

        this.wss.on("connection", (ws) => {
            console.log("WebSocket client connected");
            ws.on("message", (data) => {
                this.handleMessage(ws, data).catch((err: unknown) => {
                    console.error("Unhandled error in message handler:", err);
                });
            });
            ws.on("close", () => console.log("WebSocket client disconnected"));
            ws.on("error", (err) => console.error("WebSocket error:", err));
        });

        this.wss.on("listening", () => {
            console.log(`WebSocket server listening on ws://localhost:${port}`);
        });
    }

    private rawDataToString(data: RawData): string {
        if (Buffer.isBuffer(data)) return data.toString();
        if (data instanceof ArrayBuffer) return Buffer.from(data).toString();
        return Buffer.concat(data).toString();
    }

    private send(ws: WebSocket, response: WsResponse): void {
        ws.send(JSON.stringify(response));
    }

    /** Lists every available operation, mirroring what MCP's `tools/list` and HTTP's `/docs` expose. */
    private listOperations(): Array<{
        action: string;
        summary?: string;
        description?: string;
        properties: Record<string, Record<string, unknown>>;
        required: string[];
    }> {
        return Array.from(this.operations.values()).map((operation) => ({
            action: operation.operationId,
            summary: operation.summary,
            description: operation.description,
            ...buildArgsSchema(operation),
        }));
    }

    private async handleMessage(ws: WebSocket, raw: RawData): Promise<void> {
        const id = randomUUID();

        let message: WsMessage;
        try {
            message = JSON.parse(this.rawDataToString(raw)) as WsMessage;
        } catch {
            this.send(ws, {
                id,
                status: "error",
                error: "Invalid JSON payload",
            });
            return;
        }

        if (!message.action || typeof message.action !== "string") {
            this.send(ws, {
                id,
                status: "error",
                error: "Missing or invalid 'action' field",
            });
            return;
        }

        if (message.action === LIST_ACTION) {
            this.send(ws, { id, status: "ok", result: this.listOperations() });
            return;
        }

        if (!this.operations.has(message.action)) {
            this.send(ws, {
                id,
                status: "error",
                error: `Unknown operation: ${message.action}`,
                code: "NOT_FOUND",
            });
            return;
        }

        const args = message.args ?? {};

        const validate = this.validators.get(message.action);
        if (validate && !validate(args)) {
            this.send(ws, {
                id,
                status: "error",
                error: `Validation error: ${formatValidationErrors(validate)}`,
                code: "INVALID_PARAMS",
            });
            return;
        }

        if (!this.bridge.isConnected()) {
            this.send(ws, {
                id,
                status: "error",
                error: "Premiere Pro is not connected",
                code: "INTERNAL_ERROR",
            });
            return;
        }

        logDispatch(message.action, args);
        const result = await this.bridge.sendToUxp(message.action, args, "ws");

        if (result.status === "OK") {
            this.send(ws, { id, status: "ok", result: result.result ?? null });
        } else {
            this.send(ws, {
                id,
                status: "error",
                error: result.message,
                code: result.status,
            });
        }
    }

    close(): void {
        this.wss.close();
    }
}
