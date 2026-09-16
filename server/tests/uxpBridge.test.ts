import { describe, it, expect, vi, afterEach } from "vitest";
import { WebSocket } from "ws";
import type { OutgoingMessage } from "premiereremote-shared";
import { UxpBridge } from "../src/uxpBridge.js";

function waitForOpen(ws: WebSocket): Promise<void> {
    return new Promise((resolve, reject) => {
        ws.once("open", resolve);
        ws.once("error", reject);
    });
}

function waitForMessage(ws: WebSocket): Promise<Record<string, unknown>> {
    return new Promise((resolve) => {
        ws.once("message", (data) => {
            resolve(JSON.parse(data.toString()) as Record<string, unknown>);
        });
    });
}

describe("UxpBridge", () => {
    let bridge: UxpBridge;
    let panel: WebSocket | undefined;

    afterEach(async () => {
        panel?.close();
        bridge.close();
    });

    async function connectFakePanel(): Promise<WebSocket> {
        panel = new WebSocket(`ws://localhost:${bridge.boundPort}`);
        await waitForOpen(panel);
        return panel;
    }

    describe("isConnected", () => {
        it("is false before any panel connects", async () => {
            bridge = new UxpBridge(0);
            await bridge.ready();
            expect(bridge.isConnected()).toBe(false);
        });

        it("becomes true once the fake panel connects", async () => {
            bridge = new UxpBridge(0);
            await bridge.ready();
            await connectFakePanel();
            expect(bridge.isConnected()).toBe(true);
        });

        it("becomes false again once the panel disconnects", async () => {
            bridge = new UxpBridge(0);
            await bridge.ready();
            const client = await connectFakePanel();
            client.close();
            await vi.waitFor(() => expect(bridge.isConnected()).toBe(false));
        });
    });

    describe("sendToUxp", () => {
        it("resolves immediately with INTERNAL_ERROR when not connected", async () => {
            bridge = new UxpBridge(0);
            await bridge.ready();

            const result = await bridge.sendToUxp("some/action", {}, "ws");

            expect(result.status).toBe("INTERNAL_ERROR");
            expect(result.message).toBe("Premiere Pro is not connected");
        });

        it("resolves with the panel's reply when the id matches", async () => {
            bridge = new UxpBridge(0);
            await bridge.ready();
            const client = await connectFakePanel();

            const incomingPromise = waitForMessage(client);
            const sendPromise = bridge.sendToUxp(
                "some/action",
                { foo: "bar" },
                "ws",
            );

            const incoming = await incomingPromise;
            expect(incoming.actionId).toBe("some/action");
            expect(incoming.params).toEqual({ foo: "bar" });

            const reply: OutgoingMessage = {
                id: incoming.id as string,
                status: "OK",
                result: "done",
            };
            client.send(JSON.stringify(reply));

            expect(await sendPromise).toEqual(reply);
        });

        it("times out when the panel never replies", async () => {
            bridge = new UxpBridge(0, 50);
            await bridge.ready();
            await connectFakePanel();

            const result = await bridge.sendToUxp("some/action", {}, "ws");

            expect(result.status).toBe("INTERNAL_ERROR");
            expect(result.message).toBe("Request timed out");
        });
    });
});
