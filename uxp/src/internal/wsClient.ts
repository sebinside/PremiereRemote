import { registry, ParamMeta } from "../generated/registry.js";
import { ResponseStatus, SourceType, WEBSOCKET_URL } from "./config.js";
import { setLastCommand, setStatus, Statuses } from "./ui.js";

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

let ws: WebSocket | null = null;
const RECONNECT_INTERVAL = 3000;
let stopped = false;

export function startWsClient(): void {
    stopped = false;
    connect();
}

function connect(): void {
    ws = new WebSocket(WEBSOCKET_URL);

    ws.addEventListener("open", () => {
        console.log(`WebSocket client connected to ${WEBSOCKET_URL}`);
        setStatus(Statuses.CONNECTED);
    });

    ws.addEventListener("message", (event: MessageEvent) => {
        handleMessage(event.data as string).catch((err) => {
            console.error("WebSocket client unhandled error:", err);
        });
    });

    ws.addEventListener("close", () => {
        if (stopped) return;
        console.warn(`No WebSocket connection. Reconnecting...`);
        setStatus(Statuses.DISCONNECTED);
        scheduleReconnect();
    });

    ws.addEventListener("error", (event: Event) => {
        console.error("WebSocket client error:", event);
        setStatus(Statuses.ERROR);
    });
}

function scheduleReconnect(): void {
    setTimeout(() => {
        connect();
    }, RECONNECT_INTERVAL);
}

function send(message: OutgoingMessage): void {
    if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
    }
}

async function handleMessage(raw: string): Promise<void> {
    const rawMessage = parseRawMessage(raw);
    if (!rawMessage) return;

    const incomingMessage = parseIncomingMessage(rawMessage);
    if (!incomingMessage) return;

    const { id, actionId, sourceType } = incomingMessage;
    const rawParams = rawMessage.params;

    if (
        rawParams !== undefined &&
        (typeof rawParams !== "object" ||
            rawParams === null ||
            Array.isArray(rawParams))
    ) {
        send({
            id,
            status: "INVALID_PARAMS",
            message: "'params' must be an object",
        });
        return;
    }
    const params = (rawParams ?? {}) as Record<string, unknown>;

    const actionEntry = registry[actionId];
    if (actionEntry === undefined) {
        send({
            id,
            status: "NOT_FOUND",
            message: `Action "${actionId}" not found`,
        });
        return;
    }

    const actionArgsOrError = buildArgs(params, actionEntry.params);
    if (typeof actionArgsOrError === "string") {
        send({ id, status: "INVALID_PARAMS", message: actionArgsOrError });
        return;
    }

    if (sourceType !== "ws" && sourceType !== "http" && sourceType !== "mcp") {
        send({
            id,
            status: "INVALID_PARAMS",
            message: `Invalid sourceType: "${sourceType}". Must be one of "ws", "http", or "mcp".`,
        });
        return;
    }

    try {
        setLastCommand(actionEntry.fn.name, sourceType);
        const result = await (
            actionEntry.fn as (...a: unknown[]) => Promise<unknown>
        )(...actionArgsOrError);
        send({ id, status: "OK", result: result ?? null });
    } catch (err) {
        console.error(
            `Internal error while executing action "${actionId}":`,
            err,
        );
        send({
            id,
            status: "INTERNAL_ERROR",
            message:
                "An internal error occurred while executing the action: " + err,
        });
    }
}

function parseRawMessage(raw: string): Record<string, unknown> | null {
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        console.error("WebSocket client failed to parse message as JSON:", raw);
        return null;
    }

    if (
        typeof parsed !== "object" ||
        parsed === null ||
        Array.isArray(parsed)
    ) {
        console.error("WebSocket client message is not a JSON object:", parsed);
        return null;
    }

    return parsed as Record<string, unknown>;
}

function parseIncomingMessage(
    msg: Record<string, unknown>,
): IncomingMessage | null {
    if (
        typeof msg.id !== "string" ||
        typeof msg.actionId !== "string" ||
        typeof msg.sourceType !== "string"
    ) {
        console.error(
            "WebSocket client message missing required string fields 'id', 'actionId', and 'sourceType':",
            msg,
        );
        return null;
    }
    return msg as unknown as IncomingMessage;
}

function buildArgs(
    params: Record<string, unknown>,
    paramMetas: ParamMeta[],
): unknown[] | string {
    const knownParamNames = new Set(paramMetas.map((m) => m.name));
    const extraKeys = Object.keys(params).filter(
        (k) => !knownParamNames.has(k),
    );
    if (extraKeys.length > 0) {
        return `Unexpected parameter(s): ${extraKeys.join(", ")}`;
    }

    const args: unknown[] = [];
    for (const meta of paramMetas) {
        const value = params[meta.name];

        if (value === undefined || value === null) {
            if (meta.required) {
                return `Missing required parameter: "${meta.name}"`;
            }
            args.push(undefined);
            continue;
        }

        // Coerce strings to the target type (HTTP query params always arrive as strings)
        if (typeof value === "string" && meta.type !== "string") {
            if (meta.type === "number") {
                const num = Number(value);
                if (isNaN(num)) {
                    return `Parameter "${meta.name}" must be of type number, got non-numeric string "${value}"`;
                }
                args.push(num);
                continue;
            }
            if (meta.type === "boolean") {
                if (value === "true") { args.push(true); continue; }
                if (value === "false") { args.push(false); continue; }
                return `Parameter "${meta.name}" must be of type boolean, expected "true" or "false", got "${value}"`;
            }
        }

        if (typeof value !== meta.type) {
            return `Parameter "${meta.name}" must be of type ${meta.type}, got ${typeof value}`;
        }

        args.push(value);
    }

    return args;
}
