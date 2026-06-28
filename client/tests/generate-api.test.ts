import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { fileURLToPath } from "url";
import { generateApi } from "../scripts/generate-api.js";

const fixturesDir = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "fixtures",
);

describe("generateApi", () => {
    let tmpDir: string;
    let registryOutPath: string;
    let openApiOutPath: string;

    beforeAll(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "premiere-remote-test-"));
        registryOutPath = path.join(tmpDir, "registry.ts");
        openApiOutPath = path.join(tmpDir, "openapi.json");
        generateApi({ actionsDir: fixturesDir, openApiOutPath, registryOutPath });
    });

    afterAll(() => {
        fs.rmSync(tmpDir, { recursive: true });
    });

    describe("registry.ts", () => {
        let registry: string;

        beforeAll(() => {
            registry = fs.readFileSync(registryOutPath, "utf-8");
        });

        it("includes actions with a JSDoc description", () => {
            expect(registry).toContain('"fixture/greet"');
            expect(registry).toContain('"fixture/repeatGreeting"');
        });

        it("excludes functions without a JSDoc description", () => {
            expect(registry).not.toContain("notAnAction");
        });

        it("generates correct parameter metadata", () => {
            expect(registry).toContain('name: "name", type: "string", required: true');
            expect(registry).toContain('name: "times", type: "number", required: true');
            expect(registry).toContain('name: "loud", type: "boolean", required: true');
        });

        it("generates empty params for actions with no parameters", () => {
            expect(registry).toContain('"fixture/greet": {\n        fn: fixture__greet,\n        params: [],\n    }');
        });

        it("adds the auto-generated header comment", () => {
            expect(registry).toContain("This file is auto-generated");
            expect(registry).toContain("eslint-disable");
        });

        it("excludes non-exported functions even with a JSDoc description", () => {
            expect(registry).not.toContain("nonExportedAction");
        });

        it("maps optional parameters to required: false", () => {
            expect(registry).toContain('name: "label", type: "string", required: false');
        });

        it('falls back to "string" for unsupported parameter types', () => {
            expect(registry).toContain('name: "opts", type: "string"');
        });

        it('falls back to "string" for array parameter types', () => {
            expect(registry).toContain('name: "items", type: "string"');
        });
    });

    describe("openapi.json", () => {
        let openApi: any;

        beforeAll(() => {
            openApi = JSON.parse(fs.readFileSync(openApiOutPath, "utf-8"));
        });

        it("includes paths for all actions", () => {
            expect(openApi.paths["/fixture/greet"]).toBeDefined();
            expect(openApi.paths["/fixture/repeatGreeting"]).toBeDefined();
        });

        it("excludes functions without a JSDoc description", () => {
            expect(openApi.paths["/fixture/notAnAction"]).toBeUndefined();
        });

        it("includes query parameters for actions with parameters", () => {
            const params = openApi.paths["/fixture/repeatGreeting"].get.parameters;
            expect(params).toHaveLength(3);
            expect(params[0].name).toBe("name");
            expect(params[0].schema.type).toBe("string");
            expect(params[1].name).toBe("times");
            expect(params[1].schema.type).toBe("number");
            expect(params[2].name).toBe("loud");
            expect(params[2].schema.type).toBe("boolean");
        });

        it("has no parameters for zero-parameter actions", () => {
            const params = openApi.paths["/fixture/greet"].get.parameters;
            expect(params).toHaveLength(0);
        });

        it("excludes non-exported functions even with a JSDoc description", () => {
            expect(openApi.paths["/fixture/nonExportedAction"]).toBeUndefined();
        });

        it("marks optional parameters as not required", () => {
            const params = openApi.paths["/fixture/optionalParam"].get.parameters;
            expect(params).toHaveLength(1);
            expect(params[0].name).toBe("label");
            expect(params[0].required).toBe(false);
        });

        it('falls back to "string" schema type for unsupported parameter types', () => {
            const params = openApi.paths["/fixture/unsupportedParamType"].get.parameters;
            expect(params[0].schema.type).toBe("string");
        });

        it('falls back to "string" schema type for array parameter types', () => {
            const params = openApi.paths["/fixture/arrayParam"].get.parameters;
            expect(params[0].schema.type).toBe("string");
        });

        it("generates correct response schemas for non-void return types", () => {
            expect(openApi.paths["/fixture/returnsNumber"].get.responses["200"].content["application/json"].schema.type).toBe("number");
            expect(openApi.paths["/fixture/returnsBoolean"].get.responses["200"].content["application/json"].schema.type).toBe("boolean");
            expect(openApi.paths["/fixture/returnsArray"].get.responses["200"].content["application/json"].schema.type).toBe("array");
            expect(openApi.paths["/fixture/returnsObject"].get.responses["200"].content["application/json"].schema.type).toBe("object");
        });

        it("omits response content for void-return actions", () => {
            const response200 = openApi.paths["/fixture/repeatGreeting"].get.responses["200"];
            expect(response200.content).toBeUndefined();
        });

        it("includes @param description in OpenAPI parameter", () => {
            const params = openApi.paths["/fixture/repeatGreeting"].get.parameters;
            const nameParam = params.find((p: { name: string }) => p.name === "name");
            expect(nameParam.description).toBe("The person's name.");
        });

        it("omits description field when @param description is missing", () => {
            const params = openApi.paths["/fixture/undocumentedParam"].get.parameters;
            expect(params[0].description).toBeUndefined();
        });

        it("uses @returns description as the 200 response description", () => {
            const response200 = openApi.paths["/fixture/greet"].get.responses["200"];
            expect(response200.description).toBe("A greeting string.");
        });
    });
});
