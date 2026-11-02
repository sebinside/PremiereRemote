import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import type { Bridge } from "../../src/servers/uxpBridge.js";
import { HttpServer } from "../../src/servers/httpServer.js";
import { mockBridge } from "./mockBridge.js";

const specPath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../fixtures/openapi.fixture.json",
);

describe("HttpServer", () => {
    let server: HttpServer;
    let bridge: Bridge;
    let baseUrl: string;

    beforeAll(async () => {
        bridge = mockBridge();
        server = new HttpServer(0, specPath, bridge);
        await server.start();
        baseUrl = `http://localhost:${server.boundPort}`;
    });

    afterAll(() => {
        server.close();
    });

    it("returns 200 with the bridge's result for a successful dispatch", async () => {
        (bridge.sendToUxp as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
            id: "irrelevant",
            status: "OK",
            result: "hello",
        });

        const res = await fetch(`${baseUrl}/test/noArgs`);

        expect(res.status).toBe(200);
        expect(await res.json()).toBe("hello");
    });

    it("returns 404 for a route not in the spec", async () => {
        const res = await fetch(`${baseUrl}/nonexistent`);

        expect(res.status).toBe(404);
        const body = (await res.json()) as { error: string };
        expect(body.error).toContain("Unknown operation");
    });

    it("returns 400 when a required query param is missing", async () => {
        const res = await fetch(`${baseUrl}/test/requiredArgs?param1=hi`);

        expect(res.status).toBe(400);
        const body = (await res.json()) as { error: string };
        expect(body.error).toContain("param2");
    });

    it("returns 503 when the bridge is not connected", async () => {
        (bridge.isConnected as ReturnType<typeof vi.fn>).mockReturnValueOnce(
            false,
        );

        const res = await fetch(`${baseUrl}/test/noArgs`);

        expect(res.status).toBe(503);
        const body = (await res.json()) as { error: string };
        expect(body.error).toBe("Premiere Pro is not connected");
    });

    it.each([
        ["OK", 200],
        ["NOT_FOUND", 404],
        ["INVALID_PARAMS", 400],
        ["INTERNAL_ERROR", 500],
    ] as const)(
        "maps bridge result status %s to HTTP %d",
        async (status, expectedHttpStatus) => {
            (
                bridge.sendToUxp as ReturnType<typeof vi.fn>
            ).mockResolvedValueOnce({
                id: "irrelevant",
                status,
                message: "some message",
                result: status === "OK" ? "ok" : undefined,
            });

            const res = await fetch(`${baseUrl}/test/noArgs`);

            expect(res.status).toBe(expectedHttpStatus);
        },
    );

    it("returns 400 for a malformed JSON body", async () => {
        const res = await fetch(`${baseUrl}/test/noArgs`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "not json {{{",
        });

        expect(res.status).toBe(400);
        const body = (await res.json()) as { error: string };
        expect(body.error).toBe("Invalid JSON payload");
    });
});
