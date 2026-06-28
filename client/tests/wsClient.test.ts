import { describe, it, expect, vi, beforeEach } from "vitest";
import { WsClient } from "../src/core/wsClient.js";
import type { Registry, UIInterface } from "../src/core/types.js";

function mockUI(): UIInterface {
    return { setLastCommand: vi.fn(), setStatus: vi.fn(), reset: vi.fn()};
}

const registry: Registry = {
    "test/echo": {
        fn: async (...args) => args[0],
        params: [{ name: "value", type: "string", required: true }],
    },
    "test/noparams": {
        fn: async () => "result",
        params: [],
    },
    "test/throws": {
        fn: async () => {
            throw new Error("boom");
        },
        params: [],
    },
    "test/optional": {
        fn: async (...args) => args[0] ?? "default",
        params: [{ name: "value", type: "string", required: false }],
    },
    "test/double": {
        fn: async (...args) => (args[0] as number) * 2,
        params: [{ name: "n", type: "number", required: true }],
    },
};

function msg(overrides: Record<string, unknown> = {}): string {
    return JSON.stringify({
        id: "1",
        actionId: "test/echo",
        sourceType: "ws",
        params: { value: "hello" },
        ...overrides,
    });
}

function client(ui = mockUI()): WsClient {
    return new WsClient(registry, ui);
}

describe("WsClient.handleMessage", () => {
    describe("success cases", () => {
        it("returns OK with result for a valid message", async () => {
            const response = await client().handleMessage(msg());
            expect(response).toEqual({ id: "1", status: "OK", result: "hello" });
        });

        it("returns OK for action with no parameters", async () => {
            const response = await client().handleMessage(
                msg({ actionId: "test/noparams", params: {} }),
            );
            expect(response).toEqual({ id: "1", status: "OK", result: "result" });
        });

        it("returns OK when optional parameter is omitted", async () => {
            const response = await client().handleMessage(
                msg({ actionId: "test/optional", params: {} }),
            );
            expect(response?.status).toBe("OK");
            expect(response?.result).toBe("default");
        });

        it("coerces string to number for HTTP query params", async () => {
            const response = await client().handleMessage(
                msg({ actionId: "test/double", sourceType: "http", params: { n: "21" } }),
            );
            expect(response?.status).toBe("OK");
            expect(response?.result).toBe(42);
        });

        it("calls ui.setLastCommand on successful dispatch", async () => {
            const ui = mockUI();
            await new WsClient(registry, ui).handleMessage(
                msg({ actionId: "test/noparams", params: {} }),
            );
            expect(ui.setLastCommand).toHaveBeenCalledWith("fn", "ws");
        });
    });

    describe("NOT_FOUND", () => {
        it("returns NOT_FOUND for an unknown action", async () => {
            const response = await client().handleMessage(
                msg({ actionId: "unknown/action" }),
            );
            expect(response?.status).toBe("NOT_FOUND");
            expect(response?.message).toContain("unknown/action");
        });
    });

    describe("INVALID_PARAMS", () => {
        it("returns INVALID_PARAMS for a missing required parameter", async () => {
            const response = await client().handleMessage(
                msg({ params: {} }),
            );
            expect(response?.status).toBe("INVALID_PARAMS");
            expect(response?.message).toContain("value");
        });

        it("returns INVALID_PARAMS for unexpected extra parameters", async () => {
            const response = await client().handleMessage(
                msg({ params: { value: "hello", extra: "oops" } }),
            );
            expect(response?.status).toBe("INVALID_PARAMS");
            expect(response?.message).toContain("extra");
        });

        it("returns INVALID_PARAMS for an invalid sourceType", async () => {
            const response = await client().handleMessage(
                msg({ sourceType: "invalid" }),
            );
            expect(response?.status).toBe("INVALID_PARAMS");
        });

        it("returns INVALID_PARAMS when params is an array", async () => {
            const response = await client().handleMessage(
                msg({ params: ["not", "an", "object"] }),
            );
            expect(response?.status).toBe("INVALID_PARAMS");
        });

        it("returns INVALID_PARAMS when a string cannot be coerced to number", async () => {
            const response = await client().handleMessage(
                msg({ actionId: "test/double", params: { n: "notanumber" } }),
            );
            expect(response?.status).toBe("INVALID_PARAMS");
        });

        it("returns INVALID_PARAMS when a boolean coercion fails", async () => {
            const boolRegistry: Registry = {
                "test/bool": {
                    fn: async (...args) => args[0],
                    params: [{ name: "flag", type: "boolean", required: true }],
                },
            };
            const response = await new WsClient(boolRegistry, mockUI()).handleMessage(
                msg({ actionId: "test/bool", params: { flag: "maybe" } }),
            );
            expect(response?.status).toBe("INVALID_PARAMS");
        });
    });

    describe("INTERNAL_ERROR", () => {
        it("returns INTERNAL_ERROR when the action throws", async () => {
            const response = await client().handleMessage(
                msg({ actionId: "test/throws", params: {} }),
            );
            expect(response?.status).toBe("INTERNAL_ERROR");
            expect(response?.message).toContain("boom");
        });
    });

    describe("null (silent drop)", () => {
        it("returns null for malformed JSON", async () => {
            expect(await client().handleMessage("not json {{{")).toBeNull();
        });

        it("returns null for a JSON string (not an object)", async () => {
            expect(await client().handleMessage('"just a string"')).toBeNull();
        });

        it("returns null for a JSON array", async () => {
            expect(await client().handleMessage("[1, 2, 3]")).toBeNull();
        });

        it("returns null when required fields are missing", async () => {
            expect(
                await client().handleMessage(JSON.stringify({ id: "1" })),
            ).toBeNull();
        });
    });
});
