import express from "express";
import { OpenAPIBackend } from "openapi-backend";
import type { Context } from "openapi-backend";
import swaggerUi from "swagger-ui-express";
import { readFileSync } from "fs";
import type { Bridge } from "./uxpBridge.js";

export class HttpServer {
    private readonly app: express.Express;
    private server: ReturnType<typeof this.app.listen> | null = null;

    constructor(
        readonly port: number,
        readonly openApiSpecPath: string,
        private readonly bridge: Bridge,
    ) {
        this.app = express();
        this.app.use(express.json());
    }

    async init(): Promise<void> {
        const apiDoc = JSON.parse(
            readFileSync(this.openApiSpecPath, "utf8"),
        ) as object;

        // Swagger UI (must be registered before the OpenAPI catch-all)
        this.app.use("/docs", swaggerUi.serve, swaggerUi.setup(apiDoc));

        const api = new OpenAPIBackend({ definition: this.openApiSpecPath });

        api.register({
            notFound: (
                _c: Context,
                _req: express.Request,
                res: express.Response,
            ) => {
                res.status(404).json({ error: "Not found" });
            },

            validationFail: (
                c: Context,
                _req: express.Request,
                res: express.Response,
            ) => {
                res.status(400).json({ error: c.validation.errors });
            },

            notImplemented: async (
                c: Context,
                _req: express.Request,
                res: express.Response,
            ) => {
                if (!this.bridge.isConnected()) {
                    return res
                        .status(503)
                        .json({ error: "Premiere Pro is not connected" });
                }

                const actionId = c.operation.operationId!;

                // Merge path params, query params, and body into a flat params object
                const params: Record<string, unknown> = {
                    ...(c.request.params as Record<string, unknown>),
                    ...(c.request.query as Record<string, unknown>),
                    ...(c.request.body && typeof c.request.body === "object"
                        ? (c.request.body as Record<string, unknown>)
                        : {}),
                };

                console.log(
                    `→ ${actionId}`,
                    Object.keys(params).length ? params : "(no params)",
                );

                const result = await this.bridge.sendToUxp(actionId, params, "http");

                switch (result.status) {
                    case "OK":
                        return res.status(200).json(result.result ?? null);
                    case "NOT_FOUND":
                        return res.status(404).json({ error: result.message });
                    case "INVALID_PARAMS":
                        return res.status(400).json({ error: result.message });
                    case "INTERNAL_ERROR":
                        return res.status(500).json({ error: result.message });
                }
            },
        });

        await api.init();

        this.app.use((req, res, next) => {
            api.handleRequest(req as Parameters<typeof api.handleRequest>[0], req, res).catch(next);
        });

        return new Promise((resolve) => {
            this.server = this.app.listen(this.port, () => {
                console.log(
                    `HTTP server listening on  http://localhost:${this.port}`,
                );
                console.log(
                    `Swagger UI available at   http://localhost:${this.port}/docs`,
                );
                resolve();
            });
        });
    }

    close(callback?: () => void): void {
        this.server?.close(callback);
    }
}
