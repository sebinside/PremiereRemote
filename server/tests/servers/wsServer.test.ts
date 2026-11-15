import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { WebSocket } from "ws";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import type { Bridge } from "../../src/servers/uxpBridge.js";
import { WsServer } from "../../src/servers/wsServer.js";
import { mockBridge } from "./mockBridge.js";

const specPath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../fixtures/openapi.fixture.json",
);

function sendAndReceive(
    ws: WebSocket,
    message: unknown,
): Promise<Record<string, unknown>> {
    return new Promise((resolve) => {
        ws.once("message", (data) => {
            resolve(JSON.parse(data.toString()) as Record<string, unknown>);
        });
        ws.send(
            typeof message === "string" ? message : JSON.stringify(message),
        );
    });
}

describe("WsServer", () => {
    let server: WsServer;
    let bridge: Bridge;
    let client: WebSocket;

    beforeAll(async () => {
        bridge = mockBridge();
        server = new WsServer(0, specPath, bridge);
        await server.start();
        client = new WebSocket(`ws://localhost:${server.boundPort}`);
        await new Promise<void>((resolve, reject) => {
            client.once("open", resolve);
            client.once("error", reject);
        });
    });

    afterAll(() => {
        client.close();
        server.close();
    });

    it("$list returns the catalog of every fixture operation", async () => {
        const response = await sendAndReceive(client, { action: "$list" });
        expect(response.status).toBe("ok");
        const actions = (response.result as Array<{ action: string }>).map(
            (op) => op.action,
        );
        expect(actions).toEqual([
            "test/noArgs",
            "test/optionalArg",
            "test/requiredArgs",
        ]);
    });

    it("dispatches a valid action and returns the bridge's result", async () => {
        (bridge.sendToUxp as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
            id: "irrelevant",
            status: "OK",
            result: "hello",
        });

        const response = await sendAndReceive(client, {
            action: "test/noArgs",
            args: {},
        });

        expect(response).toEqual({
            id: response.id,
            status: "ok",
            result: "hello",
        });
    });

    it("returns NOT_FOUND for an unknown action", async () => {
        const response = await sendAndReceive(client, {
            action: "unknown/action",
        });
        expect(response.status).toBe("error");
        expect(response.code).toBe("NOT_FOUND");
        expect(response.error).toContain("unknown/action");
    });

    it("returns INVALID_PARAMS when a required arg is missing", async () => {
        const response = await sendAndReceive(client, {
            action: "test/requiredArgs",
            args: { param1: "hi" },
        });
        expect(response.status).toBe("error");
        expect(response.code).toBe("INVALID_PARAMS");
        expect(response.error).toContain("param2");
    });

    it("returns INTERNAL_ERROR when the bridge is not connected", async () => {
        (bridge.isConnected as ReturnType<typeof vi.fn>).mockReturnValueOnce(
            false,
        );

        const response = await sendAndReceive(client, {
            action: "test/noArgs",
            args: {},
        });

        expect(response.status).toBe("error");
        expect(response.code).toBe("INTERNAL_ERROR");
        expect(response.error).toBe("Premiere Pro is not connected");
    });

    it("returns an error for malformed JSON", async () => {
        const response = await sendAndReceive(client, "not json {{{");
        expect(response.status).toBe("error");
        expect(response.error).toBe("Invalid JSON payload");
    });

    it("returns an error when the action field is missing", async () => {
        const response = await sendAndReceive(client, {});
        expect(response.status).toBe("error");
        expect(response.error).toBe("Missing or invalid 'action' field");
    });
});
