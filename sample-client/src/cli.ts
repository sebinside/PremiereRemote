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
 *   premiere-remote project active
 *   premiere-remote sequence active --project-guid <guid>
 *   premiere-remote sequence player-position --guid <guid>
 *   premiere-remote sequence set-player-position --guid <guid> --seconds 10.5
 */

import { Command } from "commander";
import { setConfig } from "@kubb/plugin-client/clients/axios";
import { healthobjectObjectGetHealth } from "./generated/clients/healthobjectObjectGetHealth.js";
import { projectStaticobjectObjectGetActiveProject } from "./generated/clients/projectStaticobjectObjectGetActiveProject.js";
import { projectStaticobjectObjectOpen } from "./generated/clients/projectStaticobjectObjectOpen.js";
import { projectobjectObjectSave } from "./generated/clients/projectobjectObjectSave.js";
import { projectobjectObjectGetSequences } from "./generated/clients/projectobjectObjectGetSequences.js";
import { projectobjectObjectGetActiveSequence } from "./generated/clients/projectobjectObjectGetActiveSequence.js";
import { sequenceobjectObjectGetPlayerPosition } from "./generated/clients/sequenceobjectObjectGetPlayerPosition.js";
import { sequenceobjectObjectSetPlayerPosition } from "./generated/clients/sequenceobjectObjectSetPlayerPosition.js";
import { sequenceobjectObjectGetVideoTrackCount } from "./generated/clients/sequenceobjectObjectGetVideoTrackCount.js";
import { sequenceobjectObjectClearSelection } from "./generated/clients/sequenceobjectObjectClearSelection.js";

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

// Configure the Kubb axios client base URL before every action runs
program.hook("preAction", () => {
  const { server } = program.opts() as { server: string };
  setConfig({ baseURL: server });
});

// ---- helpers ---------------------------------------------------------------

function printResult(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

// ---- health ---------------------------------------------------------------

program
  .command("health")
  .description("Check server and UXP plugin connection status")
  .action(async () => {
    const result = await healthobjectObjectGetHealth();
    printResult(result);
  });

// ---- project commands -----------------------------------------------------

const project = program.command("project").description("Project operations");

project
  .command("active")
  .description("Get the currently active project")
  .action(async () => {
    const result = await projectStaticobjectObjectGetActiveProject();
    printResult(result);
  });

project
  .command("open <path>")
  .description("Open a Premiere project")
  .action(async (projectPath: string) => {
    const result = await projectStaticobjectObjectOpen({ path: projectPath });
    printResult(result);
  });

project
  .command("save")
  .description("Save the active project")
  .requiredOption("--guid <guid>", "Project GUID")
  .action(async (opts: { guid: string }) => {
    const result = await projectobjectObjectSave({ projectGuid: opts.guid });
    printResult(result);
  });

project
  .command("sequences")
  .description("List all sequences in a project")
  .requiredOption("--guid <guid>", "Project GUID")
  .action(async (opts: { guid: string }) => {
    const result = await projectobjectObjectGetSequences({ projectGuid: opts.guid });
    printResult(result);
  });

// ---- sequence commands ----------------------------------------------------

const sequence = program.command("sequence").description("Sequence operations");

sequence
  .command("active")
  .description("Get the active sequence for a project")
  .requiredOption("--project-guid <guid>", "Project GUID")
  .action(async (opts: { projectGuid: string }) => {
    const result = await projectobjectObjectGetActiveSequence({ projectGuid: opts.projectGuid });
    printResult(result);
  });

sequence
  .command("player-position")
  .description("Get the current playhead position")
  .requiredOption("--guid <guid>", "Sequence GUID")
  .action(async (opts: { guid: string }) => {
    const result = await sequenceobjectObjectGetPlayerPosition({ sequenceGuid: opts.guid });
    printResult(result);
  });

sequence
  .command("set-player-position")
  .description("Set the playhead position (seconds as a string, e.g. '10.5')")
  .requiredOption("--guid <guid>", "Sequence GUID")
  .requiredOption("--seconds <n>", "Position in seconds")
  .action(async (opts: { guid: string; seconds: string }) => {
    const result = await sequenceobjectObjectSetPlayerPosition({
      sequenceGuid: opts.guid,
      positionTime: opts.seconds,
    });
    printResult(result);
  });

sequence
  .command("video-track-count")
  .description("Get the number of video tracks")
  .requiredOption("--guid <guid>", "Sequence GUID")
  .action(async (opts: { guid: string }) => {
    const result = await sequenceobjectObjectGetVideoTrackCount({ sequenceGuid: opts.guid });
    printResult(result);
  });

sequence
  .command("clear-selection")
  .description("Clear track item selection in a sequence")
  .requiredOption("--guid <guid>", "Sequence GUID")
  .action(async (opts: { guid: string }) => {
    const result = await sequenceobjectObjectClearSelection({ sequenceGuid: opts.guid });
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
