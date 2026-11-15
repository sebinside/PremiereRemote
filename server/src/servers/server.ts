/** Common structure shared by every server (HttpServer, WsServer, MCPServer, UxpBridge). */
export interface ManagedServer {
    /** Binds the port and starts accepting connections. Resolves once listening. */
    start(): Promise<void>;

    /** Stops accepting connections and releases the port. */
    close(): Promise<void>;

    /** The actual bound port — differs from the constructor's `port` when that was `0`. */
    readonly boundPort: number;
}
