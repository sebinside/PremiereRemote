import { handleBridgeMessage } from "./generated/wsReceiver";

declare const premierepro: import("../../types").premierepro;

const BRIDGE_URL = "ws://localhost:3000/uxp-bridge";
const RECONNECT_INTERVAL_MS = 5000;

let ws: WebSocket | null = null;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

function connect(): void {
  if (ws !== null) {
    ws.close();
  }

  ws = new WebSocket(BRIDGE_URL);

  ws.addEventListener("open", () => {
    console.log("[Premiere Remote] Connected to bridge server");
    if (reconnectTimeout !== null) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
  });

  ws.addEventListener("message", (event: MessageEvent) => {
    let msg: { requestId: string; action: string; args?: Record<string, unknown> };
    try {
      msg = JSON.parse(event.data as string);
    } catch {
      console.error("[Premiere Remote] Failed to parse bridge message");
      return;
    }

    if (!msg.requestId || !msg.action) {
      console.warn("[Premiere Remote] Received malformed message", msg);
      return;
    }

    handleBridgeMessage(ws!, msg).catch((err: unknown) => {
      console.error("[Premiere Remote] Error handling bridge message:", err);
    });
  });

  ws.addEventListener("close", () => {
    console.warn("[Premiere Remote] Bridge connection closed. Reconnecting...");
    scheduleReconnect();
  });

  ws.addEventListener("error", (event: Event) => {
    console.error("[Premiere Remote] Bridge WebSocket error", event);
  });
}

function scheduleReconnect(): void {
  if (reconnectTimeout !== null) return;
  reconnectTimeout = setTimeout(() => {
    reconnectTimeout = null;
    connect();
  }, RECONNECT_INTERVAL_MS);
}

// Start connection on plugin load
connect();
