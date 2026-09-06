import { readFileSync } from "fs";
import { randomUUID } from "node:crypto";
import express, { type Request, type Response } from "express";
import cors from "cors";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
    ListToolsRequestSchema,
    CallToolRequestSchema,
    isInitializeRequest,
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
    private readonly operations = new Map<string, OpenAPIOperation>();
    private readonly app: express.Express;
    private httpServer: ReturnType<typeof this.app.listen> | null = null;
    /** One transport (and its MCP Server) per client session, keyed by session id. */
    private readonly transports = new Map<string, StreamableHTTPServerTransport>();

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

        // Initialize Express app with CORS and middleware
        this.app = express();
        this.app.use(cors());
        this.app.use(express.json());
        this.setupRoutes();
    }

    /** Builds a fresh MCP Server with the tool handlers registered. One per session. */
    private createServer(): Server {
        const server = new Server(
            { name: "PremiereRemote", version: "1.0.0" },
            { capabilities: { tools: {} } },
        );

        server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: Array.from(this.operations.values()).map((op) => this.toTool(op)),
        }));

        server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            return this.callTool(name, args ?? {});
        });

        return server;
    }

    private setupRoutes(): void {
        // POST: JSON-RPC messages. A request without a session id must be `initialize`,
        // which spins up a new transport + Server pair; everything else reuses one by id.
        const handlePost = async (req: Request, res: Response): Promise<void> => {
            try {
                const sessionId = req.headers["mcp-session-id"] as string | undefined;
                let transport = sessionId ? this.transports.get(sessionId) : undefined;

                if (!transport) {
                    if (sessionId || !isInitializeRequest(req.body)) {
                        res.status(400).json({
                            jsonrpc: "2.0",
                            error: { code: -32000, message: "Bad Request: no valid session" },
                            id: null,
                        });
                        return;
                    }

                    transport = new StreamableHTTPServerTransport({
                        sessionIdGenerator: () => randomUUID(),
                        onsessioninitialized: (id) => {
                            this.transports.set(id, transport!);
                            console.log(`MCP session initialized: ${id}`);
                        },
                        onsessionclosed: (id) => {
                            this.transports.delete(id);
                            console.log(`MCP session closed: ${id}`);
                        },
                    });
                    transport.onclose = () => {
                        if (transport!.sessionId) this.transports.delete(transport!.sessionId);
                    };

                    await this.createServer().connect(transport);
                }

                await transport.handleRequest(req, res, req.body);
            } catch (err) {
                console.error("Error handling MCP request:", err);
                if (!res.headersSent) {
                    res.status(500).json({ error: "Failed to process request" });
                }
            }
        };

        // GET: server-initiated SSE stream. DELETE: explicit session teardown. Both need a session.
        const handleSessionRequest = async (req: Request, res: Response): Promise<void> => {
            const sessionId = req.headers["mcp-session-id"] as string | undefined;
            const transport = sessionId ? this.transports.get(sessionId) : undefined;
            if (!transport) {
                res.status(400).send("Invalid or missing session id");
                return;
            }
            try {
                await transport.handleRequest(req, res, req.body);
            } catch (err) {
                console.error("Error handling MCP session request:", err);
                if (!res.headersSent) {
                    res.status(500).json({ error: "Failed to handle request" });
                }
            }
        };

        for (const path of ["/mcp", "/sse"]) {
            this.app.post(path, handlePost);
            this.app.get(path, handleSessionRequest);
            this.app.delete(path, handleSessionRequest);
        }

        // Health check endpoint
        this.app.get("/health", (_req: Request, res: Response) => {
            res.json({
                status: "ok",
                tools: this.operations.size,
                sessions: this.transports.size,
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
        // Transports are created lazily per session in setupRoutes(); nothing to connect here.
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
        for (const transport of this.transports.values()) {
            transport.close().catch((err) => {
                console.error("Error closing MCP transport:", err);
            });
        }
        this.transports.clear();
    }
}
