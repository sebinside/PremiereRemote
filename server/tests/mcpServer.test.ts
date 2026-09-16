import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Bridge } from "../src/uxpBridge.js";
import { MCPServer } from "../src/mcp-server.js";

const specPath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "fixtures/openapi.fixture.json",
);

function mockBridge(): Bridge {
    return {
        isConnected: vi.fn().mockReturnValue(true),
        sendToUxp: vi.fn(),
    };
}

function parseToolResult(result: {
    content: Array<{ type: string; text: string }>;
}): unknown {
    return JSON.parse(result.content[0].text);
}

describe("MCPServer", () => {
    let server: MCPServer;
    let bridge: Bridge;
    let client: Client;

    beforeAll(async () => {
        bridge = mockBridge();
        server = new MCPServer(bridge, specPath, 0);
        await server.start();

        client = new Client({ name: "test-client", version: "0.0.0" });
        const transport = new StreamableHTTPClientTransport(
            new URL(`http://localhost:${server.boundPort}/mcp`),
        );
        await client.connect(transport);
    });

    afterAll(async () => {
        await client.close();
        server.close();
    });

    it("tools/list returns the fixture operations", async () => {
        const { tools } = await client.listTools();

        expect(tools.map((t) => t.name)).toEqual([
            "test/noArgs",
            "test/optionalArg",
            "test/requiredArgs",
        ]);

        const requiredArgsTool = tools.find(
            (t) => t.name === "test/requiredArgs",
        )!;
        expect(requiredArgsTool.inputSchema.required).toEqual([
            "param1",
            "param2",
        ]);
    });

    it("tools/call returns the bridge's result on success", async () => {
        (bridge.sendToUxp as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
            id: "irrelevant",
            status: "OK",
            result: "hello",
        });

        const result = await client.callTool({
            name: "test/noArgs",
            arguments: {},
        });

        expect(parseToolResult(result as never)).toBe("hello");
    });

    it("tools/call returns NOT_FOUND for an unknown tool", async () => {
        const result = await client.callTool({
            name: "unknown/tool",
            arguments: {},
        });

        const parsed = parseToolResult(result as never) as {
            status: string;
        };
        expect(parsed.status).toBe("NOT_FOUND");
    });

    it("tools/call returns INVALID_PARAMS when a required arg is missing", async () => {
        const result = await client.callTool({
            name: "test/requiredArgs",
            arguments: { param1: "hi" },
        });

        const parsed = parseToolResult(result as never) as {
            status: string;
        };
        expect(parsed.status).toBe("INVALID_PARAMS");
    });

    it("tools/call returns INTERNAL_ERROR when the bridge is not connected", async () => {
        (bridge.isConnected as ReturnType<typeof vi.fn>).mockReturnValueOnce(
            false,
        );

        const result = await client.callTool({
            name: "test/noArgs",
            arguments: {},
        });

        const parsed = parseToolResult(result as never) as {
            status: string;
        };
        expect(parsed.status).toBe("INTERNAL_ERROR");
    });

    it("/health reports the tool count and bridge connection state", async () => {
        (bridge.isConnected as ReturnType<typeof vi.fn>).mockReturnValueOnce(
            true,
        );

        const res = await fetch(`http://localhost:${server.boundPort}/health`);
        const body = (await res.json()) as {
            status: string;
            tools: number;
            premiereConnected: boolean;
        };

        expect(body.status).toBe("ok");
        expect(body.tools).toBe(3);
        expect(body.premiereConnected).toBe(true);
    });
});
