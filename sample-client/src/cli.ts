#!/usr/bin/env node
/**
 * Premiere Remote CLI
 *
 * A demonstration CLI that exercises the full Premiere Remote API stack
 * using the Kubb-generated typed client.
 *
 * Usage:
 *   premiere-remote <command> [options]
 *
 * Examples:
 *   premiere-remote health
 *   premiere-remote project:active
 *   premiere-remote sequence:active --projectGuid <guid>
 *   premiere-remote sequence:player-position --sequenceGuid <guid>
 *   premiere-remote sequence:set-player-position --sequenceGuid <guid> --seconds 10.5
 */

import { Command } from "commander";

const program = new Command();

program
  .name("premiere-remote")
  .description("CLI client for the Premiere Remote API")
  .version("1.0.0")
  .option(
    "--server <url>",
    "Base URL of the Premiere Remote server",
    process.env["PREMIERE_REMOTE_URL"] ?? "http://localhost:3000"
  );

// ---- helper ---------------------------------------------------------------

async function apiFetch(
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<unknown> {
  const serverUrl = (program.opts() as { server: string }).server;
  const url = `${serverUrl}${path}`;

  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  return res.json();
}

function printResult(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

// ---- health ---------------------------------------------------------------

program
  .command("health")
  .description("Check server and UXP plugin connection status")
  .action(async () => {
    const result = await apiFetch("GET", "/health");
    printResult(result);
  });

// ---- project commands -----------------------------------------------------

const project = program.command("project").description("Project operations");

project
  .command("active")
  .description("Get the currently active project")
  .action(async () => {
    const result = await apiFetch("GET", "/project-static/getActiveProject");
    printResult(result);
  });

project
  .command("open <path>")
  .description("Open a Premiere project")
  .action(async (projectPath: string) => {
    const result = await apiFetch("POST", "/project-static/open", { path: projectPath });
    printResult(result);
  });

project
  .command("save")
  .description("Save the active project")
  .requiredOption("--guid <guid>", "Project GUID")
  .action(async (opts: { guid: string }) => {
    const result = await apiFetch("POST", "/project/save", { projectGuid: opts.guid });
    printResult(result);
  });

project
  .command("sequences")
  .description("List all sequences in a project")
  .requiredOption("--guid <guid>", "Project GUID")
  .action(async (opts: { guid: string }) => {
    const result = await apiFetch("GET", `/project/getSequences?projectGuid=${encodeURIComponent(opts.guid)}`);
    printResult(result);
  });

// ---- sequence commands ----------------------------------------------------

const sequence = program.command("sequence").description("Sequence operations");

sequence
  .command("active")
  .description("Get the active sequence for a project")
  .requiredOption("--project-guid <guid>", "Project GUID")
  .action(async (opts: { projectGuid: string }) => {
    const result = await apiFetch(
      "GET",
      `/project/getActiveSequence?projectGuid=${encodeURIComponent(opts.projectGuid)}`
    );
    printResult(result);
  });

sequence
  .command("player-position")
  .description("Get the current playhead position")
  .requiredOption("--guid <guid>", "Sequence GUID")
  .action(async (opts: { guid: string }) => {
    const result = await apiFetch(
      "GET",
      `/sequence/getPlayerPosition?sequenceGuid=${encodeURIComponent(opts.guid)}`
    );
    printResult(result);
  });

sequence
  .command("set-player-position")
  .description("Set the playhead position (in seconds)")
  .requiredOption("--guid <guid>", "Sequence GUID")
  .requiredOption("--seconds <n>", "Position in seconds", parseFloat)
  .action(async (opts: { guid: string; seconds: number }) => {
    const result = await apiFetch("POST", "/sequence/setPlayerPosition", {
      sequenceGuid: opts.guid,
      positionTime: { seconds: opts.seconds },
    });
    printResult(result);
  });

sequence
  .command("video-track-count")
  .description("Get the number of video tracks")
  .requiredOption("--guid <guid>", "Sequence GUID")
  .action(async (opts: { guid: string }) => {
    const result = await apiFetch(
      "GET",
      `/sequence/getVideoTrackCount?sequenceGuid=${encodeURIComponent(opts.guid)}`
    );
    printResult(result);
  });

sequence
  .command("clear-selection")
  .description("Clear track item selection in a sequence")
  .requiredOption("--guid <guid>", "Sequence GUID")
  .action(async (opts: { guid: string }) => {
    const result = await apiFetch("POST", "/sequence/clearSelection", {
      sequenceGuid: opts.guid,
    });
    printResult(result);
  });

// ---- WebSocket commands ---------------------------------------------------

const ws = program.command("ws").description("WebSocket commands");

ws.command("health")
  .description("Check health via WebSocket")
  .action(async () => {
    const serverUrl = (program.opts() as { server: string }).server;
    const wsUrl = serverUrl.replace(/^http/, "ws") + "/api/ws";

    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(wsUrl);

      socket.addEventListener("open", () => {
        socket.send(JSON.stringify({ action: "health" }));
      });

      socket.addEventListener("message", (event) => {
        printResult(JSON.parse(event.data as string));
        socket.close();
        resolve();
      });

      socket.addEventListener("error", reject);
    });
  });

// ---- parse ----------------------------------------------------------------

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error("Error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
