import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { HTTP_PORT, WS_PORT } from "./user.config.js";
import { HttpServer } from "./httpServer.js";
import { WsServer } from "./wsServer.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const openApiSpecPath = resolve(__dirname, "../openapi.json");

const wsServer = new WsServer(WS_PORT);
const httpServer = new HttpServer(HTTP_PORT, openApiSpecPath, wsServer);

httpServer.init().catch((err: unknown) => {
    console.error("Failed to initialize HTTP server:", err);
    process.exit(1);
});

function shutdown(): void {
    console.log("Shutting down...");
    wsServer.close();
    httpServer.close(() => process.exit(0));
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
