import express from "express";
import { OpenAPIBackend } from "openapi-backend";
import type { Context, Request as ApiRequest } from "openapi-backend";
import swaggerUi from "swagger-ui-express";
import { readFileSync } from "fs";
import type { AddressInfo } from "net";
import type { Server } from "http";
import type { Bridge } from "./uxpBridge.js";
import type { ManagedServer } from "./server.js";
import { formatValidationErrors } from "../openapi.js";
import { log, logIncomingCall, logOutgoingResult, logAndExit } from "../log.js";

const HTTP_OK = 200;
const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;
const HTTP_INTERNAL_SERVER_ERROR = 500;
const HTTP_SERVICE_UNAVAILABLE = 503;

export class HttpServer implements ManagedServer {
    private readonly app: express.Express;
    private server: Server | null = null;

    constructor(
        readonly port: number,
        readonly openApiSpecPath: string,
        private readonly bridge: Bridge,
    ) {
        this.app = express();
        this.app.use(express.json());
        // Keep malformed-body errors JSON like every other error response (WS/MCP also
        // report this as "Invalid JSON payload"), instead of falling through to Express's
        // default HTML error page.
        this.app.use(
            (
                err: unknown,
                _: express.Request,
                res: express.Response,
                next: express.NextFunction,
            ) => {
                if (err instanceof SyntaxError && "body" in err) {
                    res.status(HTTP_BAD_REQUEST).json({
                        error: "Invalid JSON payload",
                    });
                    return;
                }
                next(err);
            },
        );
    }

    async start(): Promise<void> {
        const apiDoc = JSON.parse(
            readFileSync(this.openApiSpecPath, "utf8"),
        ) as object;

        // Swagger UI (must be registered before the OpenAPI catch-all)
        this.app.use("/docs", swaggerUi.serve, swaggerUi.setup(apiDoc));

        const api = new OpenAPIBackend({ definition: this.openApiSpecPath });
        api.register({
            notFound: this.handleNotFound,
            validationFail: this.handleValidationFail,
            notImplemented: this.handleNotImplemented,
        });
        await api.init();

        this.app.use((req, res, next) => {
            api.handleRequest(req as ApiRequest, req, res).catch(next);
        });

        return new Promise((resolve) => {
            this.server = this.app
                .listen(this.port, () => {
                    log("HTTP", `Listening on http://localhost:${this.port}`);
                    log(
                        "HTTP",
                        `Swagger UI available at http://localhost:${this.port}/docs`,
                    );
                    resolve();
                })
                .on("error", logAndExit("HTTP"));
        });
    }

    close(): Promise<void> {
        return new Promise((resolve) => {
            if (this.server) this.server.close(() => resolve());
            else resolve();
        });
    }

    get boundPort(): number {
        if (!this.server) {
            throw new Error(
                "boundPort accessed before HttpServer.start() completed",
            );
        }
        return (this.server.address() as AddressInfo).port;
    }

    private handleNotFound = (
        _: Context,
        req: express.Request,
        res: express.Response,
    ): void => {
        res.status(HTTP_NOT_FOUND).json({
            error: `Unknown operation: ${req.method} ${req.path}`,
        });
    };

    private handleValidationFail = (
        c: Context,
        _: express.Request,
        res: express.Response,
    ): void => {
        res.status(HTTP_BAD_REQUEST).json({
            error: `Validation error: ${formatValidationErrors(c.validation.errors)}`,
        });
    };

    // Repurposed as the generic catch-all that proxies each request to Premiere Pro.
    // The set of operationIds lives in openapi.json and isn't known here,
    // so we can't hardcode a handler per operationId
    private handleNotImplemented = async (
        c: Context,
        _: express.Request,
        res: express.Response,
    ): Promise<express.Response | void> => {
        if (!this.bridge.isConnected()) {
            return res
                .status(HTTP_SERVICE_UNAVAILABLE)
                .json({ error: "Premiere Pro is not connected" });
        }

        const actionId = c.operation.operationId;
        if (!actionId) {
            return res
                .status(HTTP_INTERNAL_SERVER_ERROR)
                .json({ error: "Matched operation has no operationId" });
        }

        // Merge path params, query params, and body into a flat params object
        const params: Record<string, unknown> = {
            ...(c.request.params as Record<string, unknown>),
            ...(c.request.query as Record<string, unknown>),
            ...(c.request.body && typeof c.request.body === "object"
                ? (c.request.body as Record<string, unknown>)
                : {}),
        };

        logIncomingCall("HTTP", actionId, params);
        const result = await this.bridge.sendToUxp(actionId, params, "http");
        logOutgoingResult("HTTP", actionId, result);

        switch (result.status) {
            case "OK":
                return res.status(HTTP_OK).json(result.result ?? null);
            case "NOT_FOUND":
                return res
                    .status(HTTP_NOT_FOUND)
                    .json({ error: result.message });
            case "INVALID_PARAMS":
                return res
                    .status(HTTP_BAD_REQUEST)
                    .json({ error: result.message });
            case "INTERNAL_ERROR":
                return res
                    .status(HTTP_INTERNAL_SERVER_ERROR)
                    .json({ error: result.message });
        }
    };
}
