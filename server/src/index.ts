import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import {
    HTTP_PORT,
    WS_PORT,
    EXTERNAL_WS_PORT,
    MCP_PORT,
} from "premiereremote-shared/config";
import { HttpServer } from "./servers/httpServer.js";
import { UxpBridge } from "./servers/uxpBridge.js";
import { WsServer } from "./servers/wsServer.js";
import { MCPServer } from "./servers/mcp-server.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const openApiSpecPath = resolve(__dirname, "../openapi.json");

const uxpBridge = new UxpBridge(WS_PORT);
const httpServer = new HttpServer(HTTP_PORT, openApiSpecPath, uxpBridge);
const wsServer = new WsServer(EXTERNAL_WS_PORT, openApiSpecPath, uxpBridge);
const mcpServer = new MCPServer(MCP_PORT, openApiSpecPath, uxpBridge);

const servers = [
    { name: "UXP bridge", server: uxpBridge },
    { name: "HTTP server", server: httpServer },
    { name: "WebSocket server", server: wsServer },
    { name: "MCP server", server: mcpServer },
];
for (const { name, server } of servers) {
    server.start().catch((err: unknown) => {
        console.error(`Failed to start ${name}:`, err);
        process.exit(1);
    });
}

async function shutdown(): Promise<void> {
    console.log("Shutting down...");
    await Promise.all(servers.map(({ server }) => server.close()));
    console.log("Shutdown complete.");
    process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
