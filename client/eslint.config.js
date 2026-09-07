import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import prettier from "eslint-config-prettier";

export default [
    {
        ignores: ["src/generated/**"],
    },
    {
        files: ["scripts/**/*.js"],
        languageOptions: {
            globals: {
                console: "readonly",
                process: "readonly",
            },
        },
        rules: {
            ...js.configs.recommended.rules,
            ...prettier.rules,
        },
    },
    {
        files: ["src/**/*.ts"],
        languageOptions: {
            parser: tsparser,
            globals: {
                window: "readonly",
                document: "readonly",
            },
        },
        plugins: {
            "@typescript-eslint": tseslint,
        },
        rules: {
            ...tseslint.configs.recommended.rules,
            ...prettier.rules,
        },
    },
    {
        files: ["tests/**/*.ts"],
        languageOptions: {
            parser: tsparser,
        },
        plugins: {
            "@typescript-eslint": tseslint,
        },
        rules: {
            ...tseslint.configs.recommended.rules,
            ...prettier.rules,
        },
    },
];
