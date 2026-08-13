import { readFileSync } from "fs";
import express, { type Request, type Response } from "express";
import cors from "cors";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
    ListToolsRequestSchema,
    CallToolRequestSchema,
    type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import type { Bridge } from "./uxpBridge.js";

interface OpenAPIOperation {
    operationId: string;
    summary?: string;
    description?: string;
    parameters?: Array<{
        name: string;
        in: string;
        required: boolean;
        description?: string;
        schema: Record<string, unknown>;
    }>;
    requestBody?: {
        content: {
            "application/json": {
                schema: Record<string, unknown>;
            };
        };
    };
}

interface OpenAPISpec {
    paths: Record<string, Record<string, OpenAPIOperation>>;
}

export class MCPServer {
    private readonly server = new Server(
        { name: "PremiereRemote", version: "1.0.0" },
        { capabilities: { tools: {} } }
    );
    private readonly operations = new Map<string, OpenAPIOperation>();
    private readonly app: express.Express;
    private httpServer: ReturnType<typeof this.app.listen> | null = null;
    private httpTransport: StreamableHTTPServerTransport | null = null;

    constructor(
        private readonly bridge: Bridge,
        openApiSpecPath: string,
        private readonly port: number,
    ) {
        const spec = JSON.parse(readFileSync(openApiSpecPath, "utf8")) as OpenAPISpec;
        for (const methods of Object.values(spec.paths)) {
            for (const operation of Object.values(methods)) {
                if (operation.operationId) {
                    this.operations.set(operation.operationId, operation);
                }
            }
        }

        console.log(`MCP server: loaded ${this.operations.size} tools`);
        this.registerHandlers();

        // Initialize Express app with CORS and middleware
        this.app = express();
        this.app.use(cors());
        this.app.use(express.json());
        this.setupRoutes();
    }

    private registerHandlers(): void {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: Array.from(this.operations.values()).map((op) => this.toTool(op)),
        }));

        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            return this.callTool(name, args ?? {});
        });
    }

    private setupRoutes(): void {
        // Initialize the StreamableHTTPServerTransport
        this.httpTransport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => Math.random().toString(36).substring(7),
        });

        // GET /sse or /stream: SSE stream endpoint
        this.app.get("/sse", async (req: Request, res: Response) => {
            console.log("MCP client connected via SSE");
            try {
                await this.httpTransport!.handleRequest(req, res, req.body);
            } catch (err) {
                console.error("Error handling SSE request:", err);
                if (!res.headersSent) {
                    res.status(500).json({ error: "Failed to handle SSE stream" });
                }
            }
        });

        // POST /sse: Message endpoint (can also be used for both)
        this.app.post("/sse", async (req: Request, res: Response) => {
            try {
                await this.httpTransport!.handleRequest(req, res, req.body);
            } catch (err) {
                console.error("Error handling MCP message:", err);
                if (!res.headersSent) {
                    res.status(500).json({ error: "Failed to process message" });
                }
            }
        });

        // Alternative unified endpoint: /mcp
        this.app.all("/mcp", async (req: Request, res: Response) => {
            try {
                await this.httpTransport!.handleRequest(req, res, req.body);
            } catch (err) {
                console.error("Error handling MCP request:", err);
                if (!res.headersSent) {
                    res.status(500).json({ error: "Failed to process request" });
                }
            }
        });

        // Health check endpoint
        this.app.get("/health", (_req: Request, res: Response) => {
            res.json({
                status: "ok",
                tools: this.operations.size,
                premiereConnected: this.bridge.isConnected(),
            });
        });
    }

    private toTool(operation: OpenAPIOperation): Tool {
        const properties: Record<string, Record<string, unknown>> = {};
        const required: string[] = [];

        for (const param of operation.parameters ?? []) {
            properties[param.name] = {
                ...param.schema,
                ...(param.description ? { description: param.description } : {}),
            };
            if (param.required) required.push(param.name);
        }

        const bodySchema = operation.requestBody?.content["application/json"]?.schema;
        if (bodySchema) {
            const props = bodySchema["properties"];
            if (props && typeof props === "object" && !Array.isArray(props)) {
                for (const [key, value] of Object.entries(props)) {
                    properties[key] = value as Record<string, unknown>;
                }
            }
            const req = bodySchema["required"];
            if (Array.isArray(req)) required.push(...(req as string[]));
        }

        return {
            name: operation.operationId,
            description: operation.summary ?? operation.description ?? `Call ${operation.operationId}`,
            inputSchema: {
                type: "object" as const,
                ...(Object.keys(properties).length > 0
                    ? { properties, ...(required.length > 0 ? { required } : {}) }
                    : {}),
            },
        };
    }

    private async callTool(
        name: string,
        args: Record<string, unknown>,
    ): Promise<{ content: Array<{ type: "text"; text: string }> }> {
        if (!this.operations.has(name)) {
            return { content: [{ type: "text", text: JSON.stringify({ error: `Unknown tool: ${name}` }) }] };
        }

        if (!this.bridge.isConnected()) {
            return { content: [{ type: "text", text: JSON.stringify({ error: "Premiere Pro is not connected" }) }] };
        }

        try {
            const result = await this.bridge.sendToUxp(name, args, "mcp");
            if (result.status === "OK") {
                return { content: [{ type: "text", text: JSON.stringify(result.result ?? null) }] };
            }
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify({ error: result.message, status: result.status }),
                }],
            };
        } catch (err) {
            const message = err instanceof Error ? err.message : "Unknown error";
            return { content: [{ type: "text", text: JSON.stringify({ error: `Execution failed: ${message}` }) }] };
        }
    }

    async start(): Promise<void> {
        // Connect the MCP server to the HTTP transport
        await this.server.connect(this.httpTransport!);

        return new Promise((resolve) => {
            this.httpServer = this.app.listen(this.port, () => {
                console.log(`MCP server listening on http://localhost:${this.port}`);
                console.log(`  SSE endpoint:     http://localhost:${this.port}/sse`);
                console.log(`  Unified endpoint: http://localhost:${this.port}/mcp`);
                console.log(`  Health check:     http://localhost:${this.port}/health`);
                resolve();
            });
        });
    }

    close(): void {
        if (this.httpServer) {
            this.httpServer.close();
        }
        if (this.httpTransport) {
            this.httpTransport.close().catch((err) => {
                console.error("Error closing HTTP transport:", err);
            });
        }
    }
}
