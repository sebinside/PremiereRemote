import { describe, it, beforeAll, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

/**
 * Smoke-tests the assembled Docker image: does `docker compose up --build`
 * actually produce a container that serves traffic. Everything below the
 * container boundary (HTTP routes, WS protocol, MCP behavior) already has
 * unit/integration coverage in client/ and server/ — this only checks that
 * the image builds and the published ports are reachable.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const COMPOSE_FILE = resolve(REPO_ROOT, "compose.yaml");
const COMPOSE_ARGS = ["compose", "-f", COMPOSE_FILE, "-p", "premiereremote-e2e"];

const HTTP_PORT = 42400;
const WS_PORT = 42401;
const READY_TIMEOUT_MS = 60_000;
const BUILD_TIMEOUT_MS = 5 * 60_000;

function run(cmd: string, args: string[]): void {
    const result = spawnSync(cmd, args, { stdio: "inherit" });
    if (result.status !== 0) {
        throw new Error(`${cmd} ${args.join(" ")} exited with ${result.status}`);
    }
}

async function waitForHttp(url: string, timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    let lastError: unknown;
    while (Date.now() < deadline) {
        try {
            const res = await fetch(url);
            if (res.ok) return;
            lastError = new Error(`unexpected status ${res.status}`);
        } catch (err) {
            lastError = err;
        }
        await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error(`Timed out waiting for ${url}: ${String(lastError)}`);
}

function waitForWsOpen(url: string, timeoutMs: number): Promise<void> {
    return new Promise((resolvePromise, reject) => {
        const ws = new WebSocket(url);
        const timer = setTimeout(() => {
            ws.close();
            reject(new Error(`WebSocket did not open within ${timeoutMs}ms`));
        }, timeoutMs);
        ws.onopen = () => {
            clearTimeout(timer);
            ws.close();
            resolvePromise();
        };
        ws.onerror = () => {
            clearTimeout(timer);
            reject(new Error(`WebSocket connection to ${url} failed`));
        };
    });
}

describe("docker image smoke test", () => {
    beforeAll(() => {
        run("docker", [...COMPOSE_ARGS, "up", "--build", "-d"]);
    }, BUILD_TIMEOUT_MS);

    afterAll(() => {
        spawnSync("docker", [...COMPOSE_ARGS, "down", "-v"]);
    });

    it(
        "serves the HTTP API",
        async () => {
            await waitForHttp(`http://localhost:${HTTP_PORT}/docs`, READY_TIMEOUT_MS);
        },
        READY_TIMEOUT_MS + 5_000,
    );

    it(
        "accepts WebSocket connections on the UXP bridge port",
        async () => {
            await waitForWsOpen(`ws://localhost:${WS_PORT}`, READY_TIMEOUT_MS);
        },
        READY_TIMEOUT_MS + 5_000,
    );
});
