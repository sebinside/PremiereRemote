import { readFileSync } from "fs";
import { Ajv, type ValidateFunction, type ErrorObject } from "ajv";
import type { ResponseStatus } from "premiereremote-shared";

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

/** Loads an openapi.json's operations and compiles an AJV validator for each one that takes params. */
export function loadOperationsAndValidators(specPath: string): {
    operations: Map<string, OpenAPIOperation>;
    validators: Map<string, ValidateFunction>;
} {
    const operations = loadAndIndexAllOperations(specPath);
    const ajv = new Ajv();
    const validators = new Map<string, ValidateFunction>();
    for (const [operationId, operation] of operations) {
        const validator = compileOperationValidator(ajv, operation);
        if (validator) validators.set(operationId, validator);
    }
    return { operations, validators };
}

/** A call that failed validation, with the status/message a server should report to its client. */
export interface CallValidationFailure {
    status: ResponseStatus;
    message: string;
}

/**
 * Checks that an action is known, its args pass validation, and the UXP bridge is connected —
 * the same three checks every transport (WS, MCP) must make before forwarding a call.
 * Returns the failure to report, or `null` if the call may proceed.
 */
export function validateCall(
    operations: Map<string, OpenAPIOperation>,
    validators: Map<string, ValidateFunction>,
    action: string,
    args: Record<string, unknown>,
    isBridgeConnected: boolean,
): CallValidationFailure | null {
    if (!operations.has(action)) {
        return { status: "NOT_FOUND", message: `Unknown operation: ${action}` };
    }

    const validate = validators.get(action);
    if (validate && !validate(args)) {
        return {
            status: "INVALID_PARAMS",
            message: `Validation error: ${formatValidationErrors(validate.errors)}`,
        };
    }

    if (!isBridgeConnected) {
        return {
            status: "INTERNAL_ERROR",
            message: "Premiere Pro is not connected",
        };
    }

    return null;
}

/** Formats AJV errors the same way everywhere validation runs (HTTP, WS, MCP). */
export function formatValidationErrors(
    errors: ErrorObject[] | null | undefined,
): string {
    return (errors ?? [])
        .map((e) => `${e.instancePath || "args"} ${e.message ?? ""}`.trim())
        .join("; ");
}
