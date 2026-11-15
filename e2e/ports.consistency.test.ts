import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
    INTERNAL_WS_PORT,
    HTTP_PORT,
    WS_PORT,
    MCP_PORT,
} from "../shared/src/config.js";

/**
 * Checks that every file declaring the published ports agrees with
 * shared/src/config.js, the source of truth used by the server and UXP plugin.
 * Docker and dev container files cannot import that config, so they can drift.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

const EXPECTED_PORTS = [INTERNAL_WS_PORT, HTTP_PORT, WS_PORT, MCP_PORT].sort();

function read(path: string): string {
    return readFileSync(resolve(REPO_ROOT, path), "utf8");
}

function sortedNumbers(values: string[]): number[] {
    return values.map(Number).sort();
}

describe("port consistency", () => {
    it("config.js defines four distinct ports", () => {
        expect(new Set(EXPECTED_PORTS).size).toBe(4);
    });

    it("Dockerfile exposes the configured ports", () => {
        const matches = read("Dockerfile").matchAll(/^EXPOSE\s+(\d+)\s*$/gm);
        const ports = [...matches].map((match) => match[1]);

        expect(sortedNumbers(ports)).toEqual(EXPECTED_PORTS);
    });

    it("compose.yaml publishes the configured ports", () => {
        const matches = [
            ...read("compose.yaml").matchAll(/^\s*-\s*"?(\d+):(\d+)"?\s*$/gm),
        ];

        expect(sortedNumbers(matches.map((match) => match[1]))).toEqual(EXPECTED_PORTS);
        expect(sortedNumbers(matches.map((match) => match[2]))).toEqual(EXPECTED_PORTS);
    });

    it("devcontainer.json forwards the configured ports", () => {
        const match = read(".devcontainer/devcontainer.json").match(
            /"forwardPorts"\s*:\s*\[([^\]]*)\]/,
        );

        expect(match).not.toBeNull();
        expect(sortedNumbers(match![1].split(","))).toEqual(EXPECTED_PORTS);
    });
});
