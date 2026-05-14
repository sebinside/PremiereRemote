export const WEBSOCKET_PORT = 8083;
export const WEBSOCKET_URL = `ws://localhost:${WEBSOCKET_PORT}`;

export type ResponseStatus =
    | "OK"
    | "NOT_FOUND"
    | "INVALID_PARAMS"
    | "INTERNAL_ERROR";
export type SourceType = "ws" | "http" | "mcp";
