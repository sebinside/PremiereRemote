import { WebSocketServer, WebSocket, type RawData } from "ws";
import type { AddressInfo } from "net";
import { randomUUID } from "crypto";
import type { ResponseStatus } from "premiereremote-shared";
import { Ajv, type ValidateFunction } from "ajv";
import type { Bridge } from "./uxpBridge.js";
import type { ManagedServer } from "./server.js";
import {
    type OpenAPIOperation,
    loadAndIndexAllOperations,
    buildOperationParameterSchema,
    compileOperationValidator,
    formatValidationErrors,
} from "../openapi.js";
import {
    log,
    logError,
    logIncomingCall,
    logOutgoingResult,
    logAndExit,
} from "../log.js";

/** Reserved action name for operation discovery — never a real operationId (those all contain "/"). */
const LIST_ACTION = "$list";

/** A valid message received from a WebSocket client. */
interface WsMessage {
    action: string;
    args?: Record<string, unknown>;
}

/** A response to be sent back to a WebSocket client. */
interface WsResponse {
    id: string;
    status: "ok" | "error";
    result?: unknown;
    error?: string;
    /** Present on error: mirrors the bridge's ResponseStatus so clients can branch without string-matching `error`. */
    code?: ResponseStatus;
}

export class WsServer implements ManagedServer {
    private wss: WebSocketServer | null = null;
    private readonly ajv = new Ajv();
    private readonly validators = new Map<string, ValidateFunction>();
    private readonly operations: Map<string, OpenAPIOperation>;

    constructor(
        readonly port: number,
        openApiSpecPath: string,
        private readonly bridge: Bridge,
    ) {
        this.operations = loadAndIndexAllOperations(openApiSpecPath);
        for (const [operationId, operation] of this.operations) {
            const validator = compileOperationValidator(this.ajv, operation);
            if (validator) this.validators.set(operationId, validator);
        }
    }

    start(): Promise<void> {
        const wss = new WebSocketServer({ port: this.port });
        this.wss = wss;

        const listening = new Promise<void>((resolve, reject) => {
            wss.once("listening", resolve);
            wss.once("error", reject);
        });

        wss.on("connection", (ws) => {
            log("WS", "client connected");
            ws.on("message", (data) => {
                this.handleMessage(ws, data).catch((err: unknown) => {
                    logError("WS", "unhandled error in message handler:", err);
                });
            });
            ws.on("close", () => log("WS", "client disconnected"));
            ws.on("error", (err) => logError("WS", "socket error:", err));
        });

        wss.on("listening", () => {
            log("WS", `Listening on ws://localhost:${this.port}`);
        });

        wss.on("error", logAndExit("WS"));

        return listening;
    }

    close(): Promise<void> {
        return new Promise((resolve) => {
            if (this.wss) this.wss.close(() => resolve());
            else resolve();
        });
    }

    get boundPort(): number {
        if (!this.wss) {
            throw new Error(
                "boundPort accessed before WsServer.start() completed",
            );
        }
        return (this.wss.address() as AddressInfo).port;
    }

    /** Handles a message from a WebSocket client. */
    private async handleMessage(ws: WebSocket, raw: RawData): Promise<void> {
        const id = randomUUID();

        let message: WsMessage;
        try {
            const text = Buffer.isBuffer(raw)
                ? raw.toString()
                : raw instanceof ArrayBuffer
                  ? Buffer.from(raw).toString()
                  : Buffer.concat(raw).toString();
            message = JSON.parse(text) as WsMessage;
        } catch {
            this.sendResponse(ws, {
                id,
                status: "error",
                error: "Invalid JSON payload",
            });
            return;
        }

        if (!message.action || typeof message.action !== "string") {
            this.sendResponse(ws, {
                id,
                status: "error",
                error: "Missing or invalid 'action' field",
            });
            return;
        }

        if (message.action === LIST_ACTION) {
            this.sendResponse(ws, {
                id,
                status: "ok",
                result: this.listOperations(),
            });
            return;
        }

        const args = message.args ?? {};
        const validationError = this.validateAction(id, message.action, args);
        if (validationError) {
            this.sendResponse(ws, validationError);
            return;
        }

        this.sendResponse(ws, await this.callAction(id, message.action, args));
    }

    /** Checks the action is known, valid, and deliverable; returns an error response if not. */
    private validateAction(
        id: string,
        action: string,
        args: Record<string, unknown>,
    ): WsResponse | null {
        if (!this.operations.has(action)) {
            return {
                id,
                status: "error",
                error: `Unknown operation: ${action}`,
                code: "NOT_FOUND",
            };
        }

        const validate = this.validators.get(action);
        if (validate && !validate(args)) {
            return {
                id,
                status: "error",
                error: `Validation error: ${formatValidationErrors(validate.errors)}`,
                code: "INVALID_PARAMS",
            };
        }

        if (!this.bridge.isConnected()) {
            return {
                id,
                status: "error",
                error: "Premiere Pro is not connected",
                code: "INTERNAL_ERROR",
            };
        }

        return null;
    }

    /** Forwards an already-validated action to the UXP bridge and builds the response. */
    private async callAction(
        id: string,
        action: string,
        args: Record<string, unknown>,
    ): Promise<WsResponse> {
        logIncomingCall("WS", action, args);
        const result = await this.bridge.sendToUxp(action, args, "ws");
        logOutgoingResult("WS", action, result);

        return result.status === "OK"
            ? { id, status: "ok", result: result.result ?? null }
            : {
                  id,
                  status: "error",
                  error: result.message,
                  code: result.status,
              };
    }

    /** Sends a response back to the client. */
    private sendResponse(ws: WebSocket, response: WsResponse): void {
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
            ...buildOperationParameterSchema(operation),
        }));
    }
}
