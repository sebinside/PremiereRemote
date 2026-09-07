import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { HTTP_PORT, WS_PORT, EXTERNAL_WS_PORT, MCP_PORT } from "./user.config.js";
import { HttpServer } from "./httpServer.js";
import { UxpBridge } from "./uxpBridge.js";
import { WsServer } from "./wsServer.js";
import { MCPServer } from "./mcp-server.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const openApiSpecPath = resolve(__dirname, "../openapi.json");

const uxpBridge = new UxpBridge(WS_PORT);
const httpServer = new HttpServer(HTTP_PORT, openApiSpecPath, uxpBridge);
const wsServer = new WsServer(EXTERNAL_WS_PORT, uxpBridge, openApiSpecPath);
const mcpServer = new MCPServer(uxpBridge, openApiSpecPath, MCP_PORT);

httpServer.init().catch((err: unknown) => {
    console.error("Failed to initialize HTTP server:", err);
    process.exit(1);
});

mcpServer.start().catch((err: unknown) => {
    console.error("Failed to start MCP server:", err);
    process.exit(1);
});

function shutdown(): void {
    console.log("Shutting down...");
    uxpBridge.close();
    wsServer.close();
    httpServer.close(() => {
        mcpServer.close();
        process.exit(0);
    });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
