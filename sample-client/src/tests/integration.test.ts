/**
 * Integration Tests — Premiere Remote
 *
 * These tests run against:
 *  - A live (or Dockerized) Premiere Remote server at PREMIERE_REMOTE_URL
 *  - A running instance of Adobe Premiere Pro loaded with the UXP plugin
 *    and pre-configured .prproj test files
 *
 * They use the Kubb-generated typed client (once generate:client has been run).
 * Until the client is generated, raw fetch calls are used as a fallback.
 *
 * Run with: node --test dist/tests/integration.test.js
 */

import { strict as assert } from "assert";
import { describe, it, before } from "node:test";

const BASE_URL = process.env["PREMIERE_REMOTE_URL"] ?? "http://localhost:3000";

async function get(path: string): Promise<unknown> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return res.json();
}

async function post(path: string, body: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("Premiere Remote Integration Tests", () => {
  describe("REST: Health", () => {
    it("GET /health returns ok status", async () => {
      const result = (await get("/health")) as {
        status: string;
        server: string;
        uxpConnected: boolean;
        timestamp: string;
      };
      assert.equal(result.status, "ok");
      assert.equal(result.server, "running");
      assert.equal(typeof result.uxpConnected, "boolean");
      assert.equal(typeof result.timestamp, "string");
    });

    it("GET /health reports UXP plugin connection state", async () => {
      const result = (await get("/health")) as { uxpConnected: boolean };
      // We just assert it's a boolean; actual connection depends on runtime state
      assert.equal(typeof result.uxpConnected, "boolean");
    });
  });

  describe("REST: Project (requires active Premiere + UXP plugin)", () => {
    let projectGuid: string;

    it("GET /project-static/getActiveProject returns a project", async () => {
      const result = (await get("/project-static/getActiveProject")) as {
        guid?: string;
        name?: string;
      };
      assert.ok(result.guid, "Expected project guid");
      assert.ok(result.name, "Expected project name");
      projectGuid = result.guid!;
    });

    it("GET /project/getSequences returns an array", async () => {
      if (!projectGuid) return;
      const result = (await get(
        `/project/getSequences?projectGuid=${encodeURIComponent(projectGuid)}`
      )) as unknown[];
      assert.ok(Array.isArray(result), "Expected array of sequences");
    });

    it("GET /project/getActiveSequence returns a sequence", async () => {
      if (!projectGuid) return;
      const result = (await get(
        `/project/getActiveSequence?projectGuid=${encodeURIComponent(projectGuid)}`
      )) as { guid?: string };
      assert.ok(result.guid, "Expected sequence guid");
    });
  });

  describe("REST: Sequence operations (requires active Premiere + UXP plugin)", () => {
    let sequenceGuid: string;
    let projectGuid: string;

    before(async () => {
      const project = (await get("/project-static/getActiveProject")) as {
        guid?: string;
      };
      if (!project.guid) return;
      projectGuid = project.guid;

      const sequence = (await get(
        `/project/getActiveSequence?projectGuid=${encodeURIComponent(projectGuid)}`
      )) as { guid?: string };
      if (sequence.guid) sequenceGuid = sequence.guid;
    });

    it("GET /sequence/getVideoTrackCount returns a number", async () => {
      if (!sequenceGuid) return;
      const result = (await get(
        `/sequence/getVideoTrackCount?sequenceGuid=${encodeURIComponent(sequenceGuid)}`
      )) as number;
      assert.equal(typeof result, "number");
    });

    it("GET /sequence/getPlayerPosition returns a TickTime", async () => {
      if (!sequenceGuid) return;
      const result = (await get(
        `/sequence/getPlayerPosition?sequenceGuid=${encodeURIComponent(sequenceGuid)}`
      )) as { seconds: number };
      assert.equal(typeof result.seconds, "number");
    });

    it("POST /sequence/setPlayerPosition moves playhead", async () => {
      if (!sequenceGuid) return;
      const result = (await post("/sequence/setPlayerPosition", {
        sequenceGuid,
        positionTime: { seconds: 0 },
      })) as boolean;
      assert.equal(result, true, "Expected setPlayerPosition to succeed");
    });

    it("POST /sequence/clearSelection succeeds", async () => {
      if (!sequenceGuid) return;
      const result = (await post("/sequence/clearSelection", { sequenceGuid })) as boolean;
      assert.equal(result, true);
    });
  });

  describe("WebSocket: External API", () => {
    it("WS health message returns status", async () => {
      const wsUrl = BASE_URL.replace(/^http/, "ws") + "/api/ws";

      const result = await new Promise<{ result: { server: string; uxpConnected: boolean } }>(
        (resolve, reject) => {
          const socket = new WebSocket(wsUrl);

          socket.addEventListener("open", () => {
            socket.send(JSON.stringify({ requestId: "test-1", action: "health" }));
          });

          socket.addEventListener("message", (event) => {
            resolve(JSON.parse(event.data as string));
            socket.close();
          });

          socket.addEventListener("error", reject);
          setTimeout(() => reject(new Error("WS health timeout")), 5000);
        }
      );

      assert.equal(result.result.server, "ok");
      assert.equal(typeof result.result.uxpConnected, "boolean");
    });

    it("WS unknown action returns error", async () => {
      const wsUrl = BASE_URL.replace(/^http/, "ws") + "/api/ws";

      const result = await new Promise<{ error: string }>((resolve, reject) => {
        const socket = new WebSocket(wsUrl);

        socket.addEventListener("open", () => {
          socket.send(JSON.stringify({ requestId: "test-2", action: "nonExistentAction" }));
        });

        socket.addEventListener("message", (event) => {
          resolve(JSON.parse(event.data as string));
          socket.close();
        });

        socket.addEventListener("error", reject);
        setTimeout(() => reject(new Error("WS timeout")), 5000);
      });

      assert.ok(result.error, "Expected error for unknown action");
    });
  });
});
