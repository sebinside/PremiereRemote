import { WebSocket } from "ws";
import { randomUUID } from "crypto";
import { UxpBridgeManager } from "./uxpBridgeManager";
import { dispatchExternalWsMessage } from "../generated/wsExternalDispatcher";

export interface WsMessage {
  requestId?: string;
  action: string;
  args?: Record<string, unknown>;
}

export interface WsResponse {
  requestId?: string;
  result?: unknown;
  error?: string;
}

export function createExternalWsHandler(uxpBridge: UxpBridgeManager) {
  return (ws: WebSocket): void => {
    ws.on("message", async (raw) => {
      let message: WsMessage;
      try {
        message = JSON.parse(raw.toString()) as WsMessage;
      } catch {
        ws.send(JSON.stringify({ error: "Invalid JSON" }));
        return;
      }

      if (!message.action) {
        ws.send(JSON.stringify({ error: "Missing 'action' field" }));
        return;
      }

      if (message.action === "health") {
        const response: WsResponse = {
          requestId: message.requestId,
          result: {
            server: "ok",
            uxpConnected: uxpBridge.isConnected,
          },
        };
        ws.send(JSON.stringify(response));
        return;
      }

      const requestId = message.requestId ?? randomUUID();
      try {
        const result = await dispatchExternalWsMessage(
          message.action,
          message.args ?? {},
          uxpBridge
        );
        ws.send(JSON.stringify({ requestId, result }));
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        ws.send(JSON.stringify({ requestId, error }));
      }
    });

    ws.on("error", (err) => {
      console.error("External WS client error:", err);
    });
  };
}
