import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { Server as HttpServer } from "node:http";
import express, { type Request, type Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
    ListToolsRequestSchema,
    CallToolRequestSchema,
    isInitializeRequest,
    type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { Ajv, type ValidateFunction } from "ajv";
import type { Bridge } from "./uxpBridge.js";
import type { ManagedServer } from "./server.js";
import {
    type OpenAPIOperation,
    loadAndIndexAllOperations,
    buildOperationParameterSchema,
    compileOperationValidator,
    formatValidationErrors,
} from "../openapi.js";
import {
    log,
    logError,
    logIncomingCall,
    logOutgoingResult,
    logAndExit,
} from "../log.js";

/** Represents the result of a tool call as a JSON-RPC response. */
type ToolCallResult = { content: Array<{ type: "text"; text: string }> };

export class MCPServer implements ManagedServer {
    private readonly operations: Map<string, OpenAPIOperation>;
    private readonly ajv = new Ajv();
    private readonly validators = new Map<string, ValidateFunction>();
    private readonly app: express.Express;
    private httpServer: HttpServer | null = null;
    private readonly transports = new Map<
        string,
        StreamableHTTPServerTransport
    >();

    constructor(
        private readonly port: number,
        openApiSpecPath: string,
        private readonly bridge: Bridge,
    ) {
        this.operations = loadAndIndexAllOperations(openApiSpecPath);
        for (const [operationId, operation] of this.operations) {
            const validator = compileOperationValidator(this.ajv, operation);
            if (validator) this.validators.set(operationId, validator);
        }

        log("MCP", `Loaded ${this.operations.size} tools`);

        this.app = express();
        this.app.use(express.json());
        this.setupRoutes();
    }

    async start(): Promise<void> {
        return new Promise((resolve) => {
            this.httpServer = this.app
                .listen(this.port, () => {
                    log(
                        "MCP",
                        `Listening on http://localhost:${this.port} [/mcp, /sse, /health]`,
                    );
                    resolve();
                })
                .on("error", logAndExit("MCP"));
        });
    }

    async close(): Promise<void> {
        await Promise.all(
            [...this.transports.values()].map((transport) =>
                transport.close().catch((err) => {
                    logError("MCP", "error closing transport:", err);
                }),
            ),
        );
        this.transports.clear();

        await new Promise<void>((resolve) => {
            if (this.httpServer) this.httpServer.close(() => resolve());
            else resolve();
        });
    }

    get boundPort(): number {
        if (!this.httpServer) {
            throw new Error(
                "boundPort accessed before MCPServer.start() completed",
            );
        }
        return (this.httpServer.address() as AddressInfo).port;
    }

    /** Sets up the Express routes for MCP and SSE endpoints, as well as health check. */
    private setupRoutes(): void {
        for (const path of ["/mcp", "/sse"]) {
            this.app.post(path, this.handlePost);
            this.app.get(path, this.handleSessionRequest);
            this.app.delete(path, this.handleSessionRequest);
        }

        this.app.get("/health", (_req: Request, res: Response) => {
            res.json({
                status: "ok",
                tools: this.operations.size,
                sessions: this.transports.size,
                premiereConnected: this.bridge.isConnected(),
            });
        });
    }

    // POST: JSON-RPC messages. A request without a session id must be `initialize`,
    // which spins up a new transport + Server pair; everything else reuses one by id.
    private handlePost = async (req: Request, res: Response): Promise<void> => {
        try {
            const sessionId = req.headers["mcp-session-id"] as
                | string
                | undefined;
            let transport = sessionId
                ? this.transports.get(sessionId)
                : undefined;

            if (!transport) {
                if (sessionId || !isInitializeRequest(req.body)) {
                    res.status(400).json({
                        jsonrpc: "2.0",
                        error: {
                            code: -32000,
                            message: "Bad Request: no valid session",
                        },
                        id: null,
                    });
                    return;
                }

                transport = new StreamableHTTPServerTransport({
                    sessionIdGenerator: () => randomUUID(),
                    onsessioninitialized: (id) => {
                        this.transports.set(id, transport!);
                        log("MCP", `session initialized: ${id}`);
                    },
                    onsessionclosed: (id) => {
                        this.transports.delete(id);
                        log("MCP", `session closed: ${id}`);
                    },
                });
                transport.onclose = () => {
                    if (transport!.sessionId)
                        this.transports.delete(transport!.sessionId);
                };

                await this.createServer().connect(transport);
            }

            await transport.handleRequest(req, res, req.body);
        } catch (err) {
            logError("MCP", "error handling request:", err);
            if (!res.headersSent) {
                res.status(500).json({
                    error: "Failed to process request",
                });
            }
        }
    };

    // GET: server-initiated SSE stream. DELETE: explicit session teardown. Both need a session.
    private handleSessionRequest = async (
        req: Request,
        res: Response,
    ): Promise<void> => {
        const sessionId = req.headers["mcp-session-id"] as string | undefined;
        const transport = sessionId
            ? this.transports.get(sessionId)
            : undefined;
        if (!transport) {
            res.status(400).send("Invalid or missing session id");
            return;
        }
        try {
            await transport.handleRequest(req, res, req.body);
        } catch (err) {
            logError("MCP", "error handling session request:", err);
            if (!res.headersSent) {
                res.status(500).json({ error: "Failed to handle request" });
            }
        }
    };

    /** Builds a fresh MCP Server with the tool handlers registered. One per session. */
    private createServer() {
        const { server } = new McpServer(
            { name: "PremiereRemote", version: "1.0.0" },
            { capabilities: { tools: {} } },
        );

        server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: Array.from(this.operations.values()).map((op) =>
                this.toTool(op),
            ),
        }));

        server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            return this.callTool(name, args ?? {});
        });

        return server;
    }

    /** Converts an OpenAPI operation to an MCP tool. */
    private toTool(operation: OpenAPIOperation): Tool {
        const { properties, required } =
            buildOperationParameterSchema(operation);

        return {
            name: operation.operationId,
            description:
                operation.summary ??
                operation.description ??
                `Call ${operation.operationId}`,
            inputSchema: {
                type: "object" as const,
                ...(Object.keys(properties).length > 0
                    ? {
                          properties,
                          ...(required.length > 0 ? { required } : {}),
                      }
                    : {}),
            },
        };
    }

    /** Calls a tool by name with the given arguments. This includes validation, bridge communcation, and error handling. */
    private async callTool(
        name: string,
        args: Record<string, unknown>,
    ): Promise<ToolCallResult> {
        const validationError = this.validateToolCall(name, args);
        if (validationError) return validationError;

        try {
            logIncomingCall("MCP", name, args);
            const result = await this.bridge.sendToUxp(name, args, "mcp");
            logOutgoingResult("MCP", name, result);

            return result.status === "OK"
                ? this.toolResult(result.result ?? null)
                : this.toolResult({
                      error: result.message,
                      status: result.status,
                  });
        } catch (err) {
            const message =
                err instanceof Error ? err.message : "Unknown error";
            return this.toolResult({ error: `Execution failed: ${message}` });
        }
    }

    /** Checks the call is known, valid, and deliverable; returns an error result if not. */
    private validateToolCall(
        name: string,
        args: Record<string, unknown>,
    ): ToolCallResult | null {
        if (!this.operations.has(name)) {
            return this.toolResult({
                error: `Unknown operation: ${name}`,
                status: "NOT_FOUND",
            });
        }

        const validate = this.validators.get(name);
        if (validate && !validate(args)) {
            return this.toolResult({
                error: `Validation error: ${formatValidationErrors(validate.errors)}`,
                status: "INVALID_PARAMS",
            });
        }

        if (!this.bridge.isConnected()) {
            return this.toolResult({
                error: "Premiere Pro is not connected",
                status: "INTERNAL_ERROR",
            });
        }

        return null;
    }

    /** Creates a tool call result from a payload into a JSON-RPC response. */
    private toolResult(payload: unknown): ToolCallResult {
        return { content: [{ type: "text", text: JSON.stringify(payload) }] };
    }
}
