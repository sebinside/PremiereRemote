/**
 * Integration Tests — Premiere Remote
 *
 * These tests run against:
 *  - A live (or Dockerized) Premiere Remote server at PREMIERE_REMOTE_URL
 *  - A running instance of Adobe Premiere Pro loaded with the UXP plugin
 *    and pre-configured .prproj test files
 *
 * Run with: node --test dist/tests/integration.test.js
 */

import { strict as assert } from "assert";
import { describe, it, before } from "node:test";
import { setConfig } from "@kubb/plugin-client/clients/axios";
import { healthobjectObjectGetHealth } from "../generated/clients/healthobjectObjectGetHealth.js";
import { projectStaticobjectObjectGetActiveProject } from "../generated/clients/projectStaticobjectObjectGetActiveProject.js";
import { projectobjectObjectGetSequences } from "../generated/clients/projectobjectObjectGetSequences.js";
import { projectobjectObjectGetActiveSequence } from "../generated/clients/projectobjectObjectGetActiveSequence.js";
import { sequenceobjectObjectGetVideoTrackCount } from "../generated/clients/sequenceobjectObjectGetVideoTrackCount.js";
import { sequenceobjectObjectGetPlayerPosition } from "../generated/clients/sequenceobjectObjectGetPlayerPosition.js";
import { sequenceobjectObjectSetPlayerPosition } from "../generated/clients/sequenceobjectObjectSetPlayerPosition.js";
import { sequenceobjectObjectClearSelection } from "../generated/clients/sequenceobjectObjectClearSelection.js";
import type { HealthResponse } from "../generated/types/HealthResponse.js";

const BASE_URL = process.env["PREMIERE_REMOTE_URL"] ?? "http://localhost:3000";

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("Premiere Remote Integration Tests", () => {
  before(() => {
    setConfig({ baseURL: BASE_URL });
  });

  describe("REST: Health", () => {
    it("GET /health returns ok status", async () => {
      const result = await healthobjectObjectGetHealth() as HealthResponse;
      assert.equal(result.status, "ok");
      assert.equal(result.server, "running");
      assert.equal(typeof result.uxpConnected, "boolean");
      assert.equal(typeof result.timestamp, "string");
    });

    it("GET /health reports UXP plugin connection state", async () => {
      const result = await healthobjectObjectGetHealth() as HealthResponse;
      // We just assert it's a boolean; actual connection depends on runtime state
      assert.equal(typeof result.uxpConnected, "boolean");
    });
  });

  describe("REST: Project (requires active Premiere + UXP plugin)", () => {
    let projectGuid: string;

    it("GET /project-static/getActiveProject returns a project", async () => {
      const result = await projectStaticobjectObjectGetActiveProject() as { guid?: string; name?: string };
      assert.ok(result.guid, "Expected project guid");
      assert.ok(result.name, "Expected project name");
      projectGuid = result.guid!;
    });

    it("GET /project/getSequences returns an array", async () => {
      if (!projectGuid) return;
      const result = await projectobjectObjectGetSequences({ projectGuid });
      assert.ok(Array.isArray(result), "Expected array of sequences");
    });

    it("GET /project/getActiveSequence returns a sequence", async () => {
      if (!projectGuid) return;
      const result = await projectobjectObjectGetActiveSequence({ projectGuid }) as { guid?: string };
      assert.ok(result.guid, "Expected sequence guid");
    });
  });

  describe("REST: Sequence operations (requires active Premiere + UXP plugin)", () => {
    let sequenceGuid: string;
    let projectGuid: string;

    before(async () => {
      const project = await projectStaticobjectObjectGetActiveProject() as { guid?: string };
      if (!project.guid) return;
      projectGuid = project.guid;

      const sequence = await projectobjectObjectGetActiveSequence({ projectGuid }) as { guid?: string };
      if (sequence.guid) sequenceGuid = sequence.guid;
    });

    it("GET /sequence/getVideoTrackCount returns a number", async () => {
      if (!sequenceGuid) return;
      const result = await sequenceobjectObjectGetVideoTrackCount({ sequenceGuid });
      assert.equal(typeof result, "number");
    });

    it("GET /sequence/getPlayerPosition returns a TickTime", async () => {
      if (!sequenceGuid) return;
      const result = await sequenceobjectObjectGetPlayerPosition({ sequenceGuid }) as { seconds: number };
      assert.equal(typeof result.seconds, "number");
    });

    it("POST /sequence/setPlayerPosition moves playhead", async () => {
      if (!sequenceGuid) return;
      const result = await sequenceobjectObjectSetPlayerPosition({ sequenceGuid, positionTime: "0" });
      assert.equal(result, true, "Expected setPlayerPosition to succeed");
    });

    it("POST /sequence/clearSelection succeeds", async () => {
      if (!sequenceGuid) return;
      const result = await sequenceobjectObjectClearSelection({ sequenceGuid });
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
