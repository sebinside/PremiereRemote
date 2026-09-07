import { WebSocketServer, WebSocket, type RawData } from "ws";
import { randomUUID } from "crypto";
import { readFileSync } from "fs";
import { Ajv, type ValidateFunction } from "ajv";
import type { Bridge } from "./uxpBridge.js";

interface WsMessage {
    action: string;
    args?: Record<string, unknown>;
}

interface WsResponse {
    id: string;
    status: "ok" | "error";
    result?: unknown;
    error?: string;
}

interface OpenAPIOperation {
    operationId: string;
    parameters?: Array<{
        name: string;
        in: string;
        required: boolean;
        schema: Record<string, unknown>;
    }>;
    requestBody?: {
        content: {
            "application/json": {
                schema: Record<string, unknown>;
            };
        };
    };
}

interface OpenAPISpec {
    paths: Record<string, Record<string, OpenAPIOperation>>;
}

export class WsServer {
    private readonly wss: WebSocketServer;
    private readonly ajv = new Ajv();
    private readonly validators = new Map<string, ValidateFunction>();
    private readonly operations = new Map<string, OpenAPIOperation>();

    constructor(
        readonly port: number,
        private readonly bridge: Bridge,
        openApiSpecPath: string,
    ) {
        const spec = JSON.parse(readFileSync(openApiSpecPath, "utf8")) as OpenAPISpec;
        for (const methods of Object.values(spec.paths)) {
            for (const operation of Object.values(methods)) {
                if (operation.operationId) {
                    this.operations.set(operation.operationId, operation);
                    const schema = this.buildSchema(operation);
                    if (schema) {
                        this.validators.set(operation.operationId, this.ajv.compile(schema));
                    }
                }
            }
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

    private buildSchema(
        operation: OpenAPIOperation,
    ): { type: "object"; properties: Record<string, unknown>; required: string[] } | null {
        const properties: Record<string, unknown> = {};
        const required: string[] = [];

        for (const param of operation.parameters ?? []) {
            properties[param.name] = param.schema;
            if (param.required) required.push(param.name);
        }

        const bodySchema = operation.requestBody?.content["application/json"]?.schema;
        if (bodySchema) {
            const props = bodySchema["properties"];
            if (props && typeof props === "object" && !Array.isArray(props)) {
                Object.assign(properties, props);
            }
            const req = bodySchema["required"];
            if (Array.isArray(req)) required.push(...(req as string[]));
        }

        return Object.keys(properties).length > 0
            ? { type: "object", properties, required }
            : null;
    }

    private rawDataToString(data: RawData): string {
        if (Buffer.isBuffer(data)) return data.toString();
        if (data instanceof ArrayBuffer) return Buffer.from(data).toString();
        return Buffer.concat(data).toString();
    }

    private send(ws: WebSocket, response: WsResponse): void {
        ws.send(JSON.stringify(response));
    }

    private async handleMessage(ws: WebSocket, raw: RawData): Promise<void> {
        const id = randomUUID();

        let message: WsMessage;
        try {
            message = JSON.parse(this.rawDataToString(raw)) as WsMessage;
        } catch {
            this.send(ws, { id, status: "error", error: "Invalid JSON" });
            return;
        }

        if (!message.action || typeof message.action !== "string") {
            this.send(ws, { id, status: "error", error: "Missing or invalid 'action' field" });
            return;
        }

        if (!this.operations.has(message.action)) {
            this.send(ws, { id, status: "error", error: `Unknown action: ${message.action}` });
            return;
        }

        const validate = this.validators.get(message.action);
        if (validate) {
            const args = message.args ?? {};
            if (!validate(args)) {
                const errors = (validate.errors ?? [])
                    .map((e) => `${e.instancePath || "args"} ${e.message ?? ""}`)
                    .join("; ");
                this.send(ws, { id, status: "error", error: `Validation failed: ${errors}` });
                return;
            }
        }

        if (!this.bridge.isConnected()) {
            this.send(ws, { id, status: "error", error: "Premiere Pro is not connected" });
            return;
        }

        const result = await this.bridge.sendToUxp(message.action, message.args ?? {}, "ws");

        if (result.status === "OK") {
            this.send(ws, { id, status: "ok", result: result.result ?? null });
        } else {
            this.send(ws, { id, status: "error", error: result.message });
        }
    }

    close(): void {
        this.wss.close();
    }
}
