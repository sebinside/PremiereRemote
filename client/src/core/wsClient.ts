import {
    Registry,
    ParameterMetadata,
    ResponseStatus,
    SourceType,
    UIInterface,
} from "./types.js";
import { WEBSOCKET_PORT } from "../user.config.js";
import { Statuses } from "./ui.js";

const WEBSOCKET_URL = `ws://localhost:${WEBSOCKET_PORT}`;
const RECONNECT_INTERVAL = 3000;

interface IncomingMessage {
    id: string;
    actionId: string;
    sourceType: SourceType;
    params?: Record<string, unknown>;
}

interface OutgoingMessage {
    id: string;
    status: ResponseStatus;
    result?: unknown;
    message?: string;
}

export class WsClient {
    private ws: WebSocket | null = null;
    private stopped = false;

    constructor(
        private readonly registry: Registry,
        private readonly ui: UIInterface,
    ) {
    }

    start(): void {
        this.ui.reset();
        this.stopped = false;
        this.connect();
    }

    async handleMessage(raw: string): Promise<OutgoingMessage | null> {
        const rawMessage = this.parseRawMessage(raw);
        if (!rawMessage) return null;

        const incomingMessage = this.parseIncomingMessage(rawMessage);
        if (!incomingMessage) return null;

        const { id, actionId, sourceType } = incomingMessage;
        const rawParams = rawMessage.params;

        if (
            rawParams !== undefined &&
            (typeof rawParams !== "object" ||
                rawParams === null ||
                Array.isArray(rawParams))
        ) {
            return {
                id,
                status: "INVALID_PARAMS",
                message: "'params' must be an object",
            };
        }
        const params = (rawParams ?? {}) as Record<string, unknown>;

        const actionEntry = this.registry[actionId];
        if (actionEntry === undefined) {
            return {
                id,
                status: "NOT_FOUND",
                message: `Action "${actionId}" not found`,
            };
        }

        const [actionArgs, actionError] = this.buildArgs(
            params,
            actionEntry.params,
        );
        if (actionError) {
            return { id, status: "INVALID_PARAMS", message: actionError };
        }

        if (
            sourceType !== "ws" &&
            sourceType !== "http" &&
            sourceType !== "mcp"
        ) {
            return {
                id,
                status: "INVALID_PARAMS",
                message: `Invalid sourceType: "${sourceType}". Must be one of "ws", "http", or "mcp".`,
            };
        }

        try {
            this.ui.setLastCommand(actionEntry.fn.name, sourceType);
            const result = await actionEntry.fn(...actionArgs);
            return { id, status: "OK", result: result ?? null };
        } catch (err) {
            console.error(
                `[core] Internal error while executing action "${actionId}":`,
                err,
            );
            return {
                id,
                status: "INTERNAL_ERROR",
                message:
                    "An internal error occurred while executing the action: " +
                    err,
            };
        }
    }

    private connect(): void {
        this.ws = new WebSocket(WEBSOCKET_URL);

        this.ws.addEventListener("open", () => {
            console.log(`[core] WebSocket client connected to ${WEBSOCKET_URL}`);
            this.ui.setStatus(Statuses.CONNECTED);
        });

        this.ws.addEventListener("message", (event: MessageEvent) => {
            this.handleMessage(event.data as string)
                .then((response) => {
                    if (response) this.send(response);
                })
                .catch((err) => {
                    console.error(`[core] WebSocket client unhandled error:`, err);
                });
        });

        this.ws.addEventListener("close", () => {
            if (this.stopped) return;
            console.warn(`[core] No WebSocket connection. Reconnecting...`);
            this.ui.setStatus(Statuses.DISCONNECTED);
            this.scheduleReconnect();
        });

        this.ws.addEventListener("error", (event: Event) => {
            console.error(`[core] WebSocket client error:`, event);
            this.ui.setStatus(Statuses.ERROR);
        });
    }

    private scheduleReconnect(): void {
        setTimeout(() => {
            this.connect();
        }, RECONNECT_INTERVAL);
    }

    private send(message: OutgoingMessage): void {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }

    private parseRawMessage(raw: string): Record<string, unknown> | null {
        let parsed: unknown;
        try {
            parsed = JSON.parse(raw);
        } catch {
            console.error(
                `[core] WebSocket client failed to parse message as JSON:`,
                raw,
            );
            return null;
        }

        if (
            typeof parsed !== "object" ||
            parsed === null ||
            Array.isArray(parsed)
        ) {
            console.error(
                `[core] WebSocket client message is not a JSON object:`,
                parsed,
            );
            return null;
        }

        return parsed as Record<string, unknown>;
    }

    private parseIncomingMessage(
        msg: Record<string, unknown>,
    ): IncomingMessage | null {
        if (
            typeof msg.id !== "string" ||
            typeof msg.actionId !== "string" ||
            typeof msg.sourceType !== "string"
        ) {
            console.error(
                `[core] WebSocket client message missing required string fields 'id', 'actionId', and 'sourceType':`,
                msg,
            );
            return null;
        }
        return msg as unknown as IncomingMessage;
    }

    private buildArgs(
        params: Record<string, unknown>,
        paramMetas: ParameterMetadata[],
    ): [unknown[], string | null] {
        const knownParamNames = new Set(paramMetas.map((m) => m.name));
        const extraKeys = Object.keys(params).filter(
            (k) => !knownParamNames.has(k),
        );
        if (extraKeys.length > 0) {
            return [[], `Unexpected parameter(s): ${extraKeys.join(", ")}`];
        }

        const args: unknown[] = [];
        for (const meta of paramMetas) {
            const value = params[meta.name];

            if (value === undefined || value === null) {
                if (meta.required) {
                    return [[], `Missing required parameter: "${meta.name}"`];
                }
                args.push(undefined);
                continue;
            }

            // Coerce strings to the target type (HTTP query params always arrive as strings)
            if (typeof value === "string" && meta.type !== "string") {
                if (meta.type === "number") {
                    const num = Number(value);
                    if (isNaN(num)) {
                        return [
                            [],
                            `Parameter "${meta.name}" must be of type number, got non-numeric string "${value}"`,
                        ];
                    }
                    args.push(num);
                    continue;
                }
                if (meta.type === "boolean") {
                    if (value === "true") {
                        args.push(true);
                        continue;
                    }
                    if (value === "false") {
                        args.push(false);
                        continue;
                    }
                    return [
                        [],
                        `Parameter "${meta.name}" must be of type boolean, expected "true" or "false", got "${value}"`,
                    ];
                }
            }

            if (typeof value !== meta.type) {
                return [
                    [],
                    `Parameter "${meta.name}" must be of type ${meta.type}, got ${typeof value}`,
                ];
            }

            args.push(value);
        }

        return [args, null];
    }
}
