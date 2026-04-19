import http from "http";
import { WebSocketServer } from "ws";
import { createApp } from "./app";
import { UxpBridgeManager } from "./ws/uxpBridgeManager";
import { createExternalWsHandler } from "./ws/externalWsHandler";

const PORT = parseInt(process.env["PORT"] ?? "3000", 10);

const app = createApp();
const httpServer = http.createServer(app);

export const uxpBridge = new UxpBridgeManager();

const externalWss = new WebSocketServer({ noServer: true });
const uxpWss = new WebSocketServer({ noServer: true });

externalWss.on("connection", createExternalWsHandler(uxpBridge));
uxpWss.on("connection", (ws) => uxpBridge.handleConnection(ws));

httpServer.on("upgrade", (request, socket, head) => {
  const { pathname } = new URL(request.url ?? "/", `http://localhost`);

  if (pathname === "/api/ws") {
    externalWss.handleUpgrade(request, socket, head, (ws) => {
      externalWss.emit("connection", ws, request);
    });
  } else if (pathname === "/uxp-bridge") {
    uxpWss.handleUpgrade(request, socket, head, (ws) => {
      uxpWss.emit("connection", ws, request);
    });
  } else {
    socket.destroy();
  }
});

httpServer.listen(PORT, () => {
  console.log(`Premiere Remote server listening on port ${PORT}`);
  console.log(`  REST API:          http://localhost:${PORT}/`);
  console.log(`  External WS:       ws://localhost:${PORT}/api/ws`);
  console.log(`  UXP Bridge:        ws://localhost:${PORT}/uxp-bridge`);
});

export { httpServer };
