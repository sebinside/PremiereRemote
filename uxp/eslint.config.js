import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import prettier from "eslint-config-prettier";

export default [
    {
        ignores: ["src/internal/types.d.ts", "scripts/"],
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
];
