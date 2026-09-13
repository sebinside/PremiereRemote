export type ResponseStatus =
    | "OK"
    | "NOT_FOUND"
    | "INVALID_PARAMS"
    | "INTERNAL_ERROR";

export interface IncomingMessage {
    id: string;
    actionId: string;
    sourceType: SourceType;
    params?: Record<string, unknown>;
}

export interface OutgoingMessage {
    id: string;
    status: ResponseStatus;
    result?: unknown;
    message?: string;
}

export type SourceType = "ws" | "http" | "mcp";
