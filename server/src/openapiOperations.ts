import { readFileSync } from "fs";
import { Ajv, type ValidateFunction } from "ajv";

/**
 * Everything WS, MCP, and HTTP need to know about a single OpenAPI operation.
 * This is the one place that models the shape of `openapi.json` operations —
 * WS and MCP both used to parse this independently; they now share it.
 */
export interface OpenAPIOperation {
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

/** Loads `openapi.json` and indexes every operation by its `operationId`. */
export function loadOperations(
    specPath: string,
): Map<string, OpenAPIOperation> {
    const spec = JSON.parse(readFileSync(specPath, "utf8")) as OpenAPISpec;
    const operations = new Map<string, OpenAPIOperation>();
    for (const methods of Object.values(spec.paths)) {
        for (const operation of Object.values(methods)) {
            if (operation.operationId) {
                operations.set(operation.operationId, operation);
            }
        }
    }
    return operations;
}

/**
 * Flattens an operation's query/path parameters and JSON request body into a single
 * JSON Schema `properties`/`required` pair describing the combined `args` object.
 * Used both to compile an AJV validator (WS, MCP) and to build an MCP tool's
 * `inputSchema` — one definition of "what does this operation take" for both.
 */
export function buildArgsSchema(operation: OpenAPIOperation): {
    properties: Record<string, Record<string, unknown>>;
    required: string[];
} {
    const properties: Record<string, Record<string, unknown>> = {};
    const required: string[] = [];

    for (const param of operation.parameters ?? []) {
        properties[param.name] = {
            ...param.schema,
            ...(param.description ? { description: param.description } : {}),
        };
        if (param.required) required.push(param.name);
    }

    const bodySchema =
        operation.requestBody?.content["application/json"]?.schema;
    if (bodySchema) {
        const props = bodySchema["properties"];
        if (props && typeof props === "object" && !Array.isArray(props)) {
            Object.assign(properties, props);
        }
        const req = bodySchema["required"];
        if (Array.isArray(req)) required.push(...(req as string[]));
    }

    return { properties, required };
}

/** Compiles an AJV validator for an operation's combined args schema, or `null` if it takes none. */
export function buildValidator(
    ajv: Ajv,
    operation: OpenAPIOperation,
): ValidateFunction | null {
    const { properties, required } = buildArgsSchema(operation);
    return Object.keys(properties).length > 0
        ? ajv.compile({ type: "object", properties, required })
        : null;
}

/** Formats AJV errors the same way everywhere a validator is used, e.g. ".param2 must have required property 'param2'". */
export function formatValidationErrors(validate: ValidateFunction): string {
    return (validate.errors ?? [])
        .map((e) => `${e.instancePath || "args"} ${e.message ?? ""}`.trim())
        .join("; ");
}

/** Logs a dispatched call the same way across every protocol front-end (HTTP, WS, MCP). */
export function logDispatch(
    actionId: string,
    params: Record<string, unknown>,
): void {
    console.log(
        `→ ${actionId}`,
        Object.keys(params).length ? params : "(no params)",
    );
}

export { Ajv, type ValidateFunction };
