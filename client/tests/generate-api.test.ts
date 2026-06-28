import { describe, it, expect, beforeEach, afterEach } from "vitest";
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

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "premiere-remote-test-"));
        registryOutPath = path.join(tmpDir, "registry.ts");
        openApiOutPath = path.join(tmpDir, "openapi.json");
        generateApi({ actionsDir: fixturesDir, openApiOutPath, registryOutPath });
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true });
    });

    describe("registry.ts", () => {
        it("includes actions with a JSDoc description", () => {
            const registry = fs.readFileSync(registryOutPath, "utf-8");
            expect(registry).toContain('"fixture/greet"');
            expect(registry).toContain('"fixture/repeatGreeting"');
        });

        it("excludes functions without a JSDoc description", () => {
            const registry = fs.readFileSync(registryOutPath, "utf-8");
            expect(registry).not.toContain("notAnAction");
        });

        it("generates correct parameter metadata", () => {
            const registry = fs.readFileSync(registryOutPath, "utf-8");
            expect(registry).toContain('name: "name"');
            expect(registry).toContain('type: "string"');
            expect(registry).toContain('required: true');
            expect(registry).toContain('name: "times"');
            expect(registry).toContain('type: "number"');
        });

        it("generates empty params for actions with no parameters", () => {
            const registry = fs.readFileSync(registryOutPath, "utf-8");
            expect(registry).toContain('"fixture/greet": {\n        fn: fixture__greet,\n        params: [],\n    }');
        });

        it("adds the auto-generated header comment", () => {
            const registry = fs.readFileSync(registryOutPath, "utf-8");
            expect(registry).toContain("This file is auto-generated");
            expect(registry).toContain("eslint-disable");
        });
    });

    describe("openapi.json", () => {
        it("includes paths for all actions", () => {
            const openApi = JSON.parse(fs.readFileSync(openApiOutPath, "utf-8"));
            expect(openApi.paths["/fixture/greet"]).toBeDefined();
            expect(openApi.paths["/fixture/repeatGreeting"]).toBeDefined();
        });

        it("excludes functions without a JSDoc description", () => {
            const openApi = JSON.parse(fs.readFileSync(openApiOutPath, "utf-8"));
            expect(openApi.paths["/fixture/notAnAction"]).toBeUndefined();
        });

        it("includes query parameters for actions with parameters", () => {
            const openApi = JSON.parse(fs.readFileSync(openApiOutPath, "utf-8"));
            const params = openApi.paths["/fixture/repeatGreeting"].get.parameters;
            expect(params).toHaveLength(2);
            expect(params[0].name).toBe("name");
            expect(params[0].schema.type).toBe("string");
            expect(params[1].name).toBe("times");
            expect(params[1].schema.type).toBe("number");
        });

        it("has no parameters for zero-parameter actions", () => {
            const openApi = JSON.parse(fs.readFileSync(openApiOutPath, "utf-8"));
            const params = openApi.paths["/fixture/greet"].get.parameters;
            expect(params).toHaveLength(0);
        });
    });
});
