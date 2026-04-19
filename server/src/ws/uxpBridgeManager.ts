import { WebSocket } from "ws";
import { randomUUID } from "crypto";

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  timeoutHandle: NodeJS.Timeout;
}

export interface BridgeMessage {
  requestId: string;
  action: string;
  args?: Record<string, unknown>;
}

export interface BridgeResponse {
  requestId: string;
  result?: unknown;
  error?: string;
}

const REQUEST_TIMEOUT_MS = 30_000;

export class UxpBridgeManager {
  private connection: WebSocket | null = null;
  private pending = new Map<string, PendingRequest>();

  get isConnected(): boolean {
    return this.connection !== null && this.connection.readyState === WebSocket.OPEN;
  }

  handleConnection(ws: WebSocket): void {
    if (this.connection !== null) {
      console.warn("UXP plugin reconnected — closing previous connection");
      this.connection.close();
    }

    this.connection = ws;
    console.log("UXP plugin connected");

    ws.on("message", (raw) => {
      try {
        const response: BridgeResponse = JSON.parse(raw.toString());
        this.handleResponse(response);
      } catch (err) {
        console.error("Failed to parse UXP bridge message:", err);
      }
    });

    ws.on("close", () => {
      console.log("UXP plugin disconnected");
      this.connection = null;
      this.rejectAllPending("UXP plugin disconnected");
    });

    ws.on("error", (err) => {
      console.error("UXP bridge WebSocket error:", err);
    });
  }

  async invoke(action: string, args?: Record<string, unknown>): Promise<unknown> {
    if (!this.isConnected) {
      throw new Error("UXP plugin is not connected");
    }

    const requestId = randomUUID();
    const message: BridgeMessage = { requestId, action, args };

    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error(`Request timed out: ${action}`));
      }, REQUEST_TIMEOUT_MS);

      this.pending.set(requestId, { resolve, reject, timeoutHandle });
      this.connection!.send(JSON.stringify(message));
    });
  }

  private handleResponse(response: BridgeResponse): void {
    const pending = this.pending.get(response.requestId);
    if (!pending) return;

    clearTimeout(pending.timeoutHandle);
    this.pending.delete(response.requestId);

    if (response.error !== undefined) {
      pending.reject(new Error(response.error));
    } else {
      pending.resolve(response.result);
    }
  }

  private rejectAllPending(reason: string): void {
    for (const [id, pending] of this.pending.entries()) {
      clearTimeout(pending.timeoutHandle);
      pending.reject(new Error(reason));
      this.pending.delete(id);
    }
  }
}
