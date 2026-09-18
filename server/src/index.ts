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
import { MCPServer } from "./servers/mcpServer.js";
import { log, logError } from "./log.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const openApiSpecPath = resolve(__dirname, "../openapi.json");

const uxpBridge = new UxpBridge(WS_PORT);
const httpServer = new HttpServer(HTTP_PORT, openApiSpecPath, uxpBridge);
const wsServer = new WsServer(EXTERNAL_WS_PORT, openApiSpecPath, uxpBridge);
const mcpServer = new MCPServer(MCP_PORT, openApiSpecPath, uxpBridge);

const servers = [
    { name: "UXP", server: uxpBridge },
    { name: "HTTP", server: httpServer },
    { name: "WS", server: wsServer },
    { name: "MCP", server: mcpServer },
];
for (const { name, server } of servers) {
    server.start().catch((err: unknown) => {
        logError(name, "failed to start:", err);
        process.exit(1);
    });
}

async function shutdown(): Promise<void> {
    log("CORE", "shutting down...");
    await Promise.all(servers.map(({ server }) => server.close()));
    log("CORE", "shutdown complete.");
    process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
