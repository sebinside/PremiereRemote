import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { Ajv } from "ajv";
import {
    loadAndIndexAllOperations,
    buildOperationParameterSchema,
    compileOperationValidator,
    formatValidationErrors,
    logAPICall,
    logAndExit,
    type OpenAPIOperation,
} from "../src/openapiOperations.js";

describe("loadOperations", () => {
    let tmpDir: string;
    let specPath: string;

    beforeAll(() => {
        tmpDir = fs.mkdtempSync(
            path.join(os.tmpdir(), "premiere-remote-server-test-"),
        );
        specPath = path.join(tmpDir, "openapi.json");
        fs.writeFileSync(
            specPath,
            JSON.stringify({
                paths: {
                    "/a": {
                        get: { operationId: "a/get" },
                        post: { operationId: "a/post" },
                    },
                    "/b": {
                        get: {},
                    },
                },
            }),
        );
    });

    afterAll(() => {
        fs.rmSync(tmpDir, { recursive: true });
    });

    it("indexes every operation by operationId, across paths and methods", () => {
        const operations = loadAndIndexAllOperations(specPath);
        expect([...operations.keys()]).toEqual(["a/get", "a/post"]);
    });

    it("skips operations with no operationId", () => {
        const operations = loadAndIndexAllOperations(specPath);
        expect(operations.size).toBe(2);
    });
});

describe("buildArgsSchema", () => {
    it("flattens query/path parameters into properties/required", () => {
        const operation: OpenAPIOperation = {
            operationId: "op",
            parameters: [
                {
                    name: "required",
                    in: "query",
                    required: true,
                    schema: { type: "string" },
                },
                {
                    name: "optional",
                    in: "query",
                    required: false,
                    schema: { type: "number" },
                },
            ],
        };

        const { properties, required } =
            buildOperationParameterSchema(operation);
        expect(properties).toEqual({
            required: { type: "string" },
            optional: { type: "number" },
        });
        expect(required).toEqual(["required"]);
    });

    it("carries parameter description through when present", () => {
        const { properties } = buildOperationParameterSchema({
            operationId: "op",
            parameters: [
                {
                    name: "p",
                    in: "query",
                    required: false,
                    description: "a param",
                    schema: { type: "string" },
                },
            ],
        });
        expect(properties.p).toEqual({
            type: "string",
            description: "a param",
        });
    });

    it("returns empty properties/required for an operation with no params", () => {
        const { properties, required } = buildOperationParameterSchema({
            operationId: "op",
        });
        expect(properties).toEqual({});
        expect(required).toEqual([]);
    });
});

describe("buildValidator", () => {
    const ajv = new Ajv();

    it("returns null when the operation takes no args", () => {
        expect(
            compileOperationValidator(ajv, { operationId: "op" }),
        ).toBeNull();
    });

    it("returns a validator that accepts valid args and rejects invalid ones", () => {
        const validator = compileOperationValidator(ajv, {
            operationId: "op",
            parameters: [
                {
                    name: "value",
                    in: "query",
                    required: true,
                    schema: { type: "string" },
                },
            ],
        });
        expect(validator).not.toBeNull();
        expect(validator!({ value: "hello" })).toBe(true);
        expect(validator!({})).toBe(false);
        expect(validator!({ value: 42 })).toBe(false);
    });
});

describe("formatValidationErrors", () => {
    it("returns an empty string for null/undefined/empty errors", () => {
        expect(formatValidationErrors(null)).toBe("");
        expect(formatValidationErrors(undefined)).toBe("");
        expect(formatValidationErrors([])).toBe("");
    });

    it("falls back to 'args' when instancePath is empty", () => {
        expect(
            formatValidationErrors([
                {
                    instancePath: "",
                    message: "must have required property 'value'",
                } as never,
            ]),
        ).toBe("args must have required property 'value'");
    });

    it("joins multiple errors with '; '", () => {
        expect(
            formatValidationErrors([
                { instancePath: "/a", message: "bad a" } as never,
                { instancePath: "/b", message: "bad b" } as never,
            ]),
        ).toBe("/a bad a; /b bad b");
    });
});

describe("logDispatch", () => {
    it("logs the actionId with its params", () => {
        const spy = vi.spyOn(console, "log").mockImplementation(() => {});
        logAPICall("some/action", { foo: "bar" });
        expect(spy).toHaveBeenCalledWith("→ some/action", { foo: "bar" });
        spy.mockRestore();
    });

    it("logs '(no params)' when params is empty", () => {
        const spy = vi.spyOn(console, "log").mockImplementation(() => {});
        logAPICall("some/action", {});
        expect(spy).toHaveBeenCalledWith("→ some/action", "(no params)");
        spy.mockRestore();
    });
});

describe("logAndExit", () => {
    it("logs the label and error message, then exits with code 1", () => {
        const errorSpy = vi
            .spyOn(console, "error")
            .mockImplementation(() => {});
        const exitSpy = vi
            .spyOn(process, "exit")
            .mockImplementation(() => undefined as never);

        logAndExit("Some server")(new Error("boom"));

        expect(errorSpy).toHaveBeenCalledWith(
            "Some server failed to start:",
            "boom",
        );
        expect(exitSpy).toHaveBeenCalledWith(1);

        errorSpy.mockRestore();
        exitSpy.mockRestore();
    });
});
