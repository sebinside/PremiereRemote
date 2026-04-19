import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { UxpBridgeManager } from "./ws/uxpBridgeManager";
import openApiSpec from "./generated/swagger.json";

type OpenApiPath = {
  [method: string]: {
    operationId?: string;
    summary?: string;
    description?: string;
    parameters?: Array<{
      name: string;
      in: string;
      required?: boolean;
      schema?: { type?: string };
      description?: string;
    }>;
    requestBody?: {
      content?: {
        "application/json"?: {
          schema?: { properties?: Record<string, { type?: string; description?: string }> };
        };
      };
    };
    responses?: Record<string, unknown>;
  };
};

export function createMcpServer(
  uxpBridge: UxpBridgeManager,
  serverBaseUrl = "http://localhost:3000"
): McpServer {
  const server = new McpServer({
    name: "premiere-remote",
    version: "1.0.0",
  });

  const paths = (openApiSpec as { paths?: Record<string, OpenApiPath> }).paths ?? {};

  for (const [path, pathItem] of Object.entries(paths)) {
    for (const [httpMethod, operation] of Object.entries(pathItem as OpenApiPath)) {
      if (!operation || typeof operation !== "object" || !operation.operationId) continue;

      const { operationId, summary, description, parameters, requestBody } = operation;

      const paramSchema: Record<string, z.ZodTypeAny> = {};

      for (const param of parameters ?? []) {
        if (param.in === "path" || param.in === "query") {
          const base =
            param.schema?.type === "number"
              ? z.number()
              : param.schema?.type === "boolean"
              ? z.boolean()
              : z.string();
          paramSchema[param.name] = param.required ? base : base.optional();
        }
      }

      const bodyProps =
        requestBody?.content?.["application/json"]?.schema?.properties ?? {};
      for (const [propName, propSchema] of Object.entries(bodyProps)) {
        paramSchema[propName] =
          propSchema.type === "number"
            ? z.number().optional()
            : propSchema.type === "boolean"
            ? z.boolean().optional()
            : z.string().optional();
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (server.tool as any)(
        operationId,
        summary ?? description ?? operationId,
        paramSchema,
        async (args: Record<string, unknown>) => {
          try {
            let url = `${serverBaseUrl}${path}`;
            for (const param of parameters ?? []) {
              if (param.in === "path" && args[param.name] !== undefined) {
                url = url.replace(`{${param.name}}`, String(args[param.name]));
              }
            }

            const queryParams = (parameters ?? [])
              .filter((p) => p.in === "query" && args[p.name] !== undefined)
              .map((p) => `${p.name}=${encodeURIComponent(String(args[p.name]))}`)
              .join("&");
            if (queryParams) url += `?${queryParams}`;

            const hasBody = httpMethod === "post" || httpMethod === "put" || httpMethod === "patch";
            const response = await fetch(url, {
              method: httpMethod.toUpperCase(),
              headers: { "Content-Type": "application/json" },
              body: hasBody ? JSON.stringify(args) : undefined,
            });

            const data = await response.json();
            return {
              content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
            };
          } catch (err) {
            return {
              content: [
                {
                  type: "text",
                  text: `Error: ${err instanceof Error ? err.message : String(err)}`,
                },
              ],
              isError: true,
            };
          }
        }
      );
    }
  }

  return server;
}

if (require.main === module) {
  (async () => {
    const { uxpBridge } = await import("./server");
    const mcpServer = createMcpServer(uxpBridge);
    const transport = new StdioServerTransport();
    await mcpServer.connect(transport);
    console.error("Premiere Remote MCP server running on stdio");
  })();
}
