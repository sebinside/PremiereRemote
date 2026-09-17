import { readFileSync } from "fs";
import type { Ajv, ValidateFunction, ErrorObject } from "ajv";

/** Abstract representation of an OpenAPI operation, as parsed from `openapi.json`. Not the full specification, limited to what's needed by the servers. */
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
}

/** Abstract representation of an OpenAPI specification, as parsed from `openapi.json`. */
interface OpenAPISpec {
    paths: Record<string, Record<string, OpenAPIOperation>>;
}

/** Loads a `openapi.json` from the given path and indexes every operation by its `operationId`. */
export function loadAndIndexAllOperations(
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
 * Flattens an operation's query/path parameters into a single JSON Schema
 * `properties`/`required` pair describing the combined `args` object.
 *
 * Example:
 * ```
 *   {
 *     "properties": {
 *       "name": { "type": "string" },
 *       "age": { "type": "number" }
 *     },
 *     "required": ["name"]
 *   }
 * ```
 */
export function buildOperationParameterSchema(operation: OpenAPIOperation): {
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

    return { properties, required };
}

/** Compiles an AJV validator for an operation's combined args schema, or `null` if it takes none. */
export function compileOperationValidator(
    ajv: Ajv,
    operation: OpenAPIOperation,
): ValidateFunction | null {
    const { properties, required } = buildOperationParameterSchema(operation);
    return Object.keys(properties).length > 0
        ? ajv.compile({ type: "object", properties, required })
        : null;
}

/** Formats AJV errors the same way everywhere validation runs (HTTP, WS, MCP). */
export function formatValidationErrors(
    errors: ErrorObject[] | null | undefined,
): string {
    return (errors ?? [])
        .map((e) => `${e.instancePath || "args"} ${e.message ?? ""}`.trim())
        .join("; ");
}

/**
 * Uniformly logs API calls across all servers (HTTP, WS, MCP).
 *
 * Example:
 * ```
 *   → renameClip { "name": "Intro" }
 *   → common/getActiveSequenceName (no params)
 * ```
 */
export function logAPICall(
    actionId: string,
    params: Record<string, unknown>,
): void {
    console.log(
        `→ ${actionId}`,
        Object.keys(params).length ? params : "(no params)",
    );
}

/**
 * Returns a listener for a server's `'error'` event (e.g. EADDRINUSE), logging a clear
 * message and exiting instead of letting Node crash with an unhandled-exception stack trace.
 */
export function logAndExit(label: string): (err: Error) => void {
    return (err: Error): void => {
        console.error(`${label} failed to start:`, err.message);
        process.exit(1);
    };
}
