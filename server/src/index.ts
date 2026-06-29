import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { OpenAPIBackend } from 'openapi-backend';
import type { Context } from 'openapi-backend';
import swaggerUi from 'swagger-ui-express';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));

const HTTP_PORT = 42400;
const WS_PORT = 42401;
const REQUEST_TIMEOUT_MS = 15_000;

// ── Protocol types (mirror of wsClient.ts) ──────────────────────────────────
// TODO: Either move to own file or to shared package

interface IncomingMessage {
    id: string;
    actionId: string;
    sourceType: 'http';
    params?: Record<string, unknown>;
}

interface OutgoingMessage {
    id: string;
    status: 'OK' | 'NOT_FOUND' | 'INVALID_PARAMS' | 'INTERNAL_ERROR';
    result?: unknown;
    message?: string;
}

// ── Pending request registry ─────────────────────────────────────────────────

// Move together with ws server to the uxp communication module

type PendingRequest = {
    resolve: (msg: OutgoingMessage) => void;
    timer: ReturnType<typeof setTimeout>;
};

const pending = new Map<string, PendingRequest>();

function rejectAllPending(reason: string): void {
    for (const [id, req] of pending) {
        clearTimeout(req.timer);
        req.resolve({ id, status: 'INTERNAL_ERROR', message: reason });
    }
    pending.clear();
}

// ── HTTP server ───────────────────────────────────────────────────────────────

// extract as HTTP server (later one of three servers: HTTP, WebSocket, or MCP) to communicate with UXP plugin

const app = express();
app.use(express.json());

const apiSpecPath = resolve(__dirname, '../openapi.json');
const apiDoc = JSON.parse(readFileSync(apiSpecPath, 'utf8')) as object;

// Swagger UI (must be registered before the OpenAPI catch-all)
app.use('/docs', swaggerUi.serve, swaggerUi.setup(apiDoc));

// ── OpenAPI backend ───────────────────────────────────────────────────────────

function sendToUxp(actionId: string, params: Record<string, unknown>): Promise<OutgoingMessage> {
    return new Promise<OutgoingMessage>((resolve) => {
        const id = randomUUID();

        const timer = setTimeout(() => {
            pending.delete(id);
            resolve({ id, status: 'INTERNAL_ERROR', message: 'Request timed out' });
        }, REQUEST_TIMEOUT_MS);

        pending.set(id, { resolve, timer });

        const msg: IncomingMessage = {
            id,
            actionId,
            sourceType: 'http',
            ...(Object.keys(params).length > 0 ? { params } : {}),
        };

        uxpSocket!.send(JSON.stringify(msg));
    });
}

const api = new OpenAPIBackend({ definition: apiSpecPath });

api.register({
    notFound: (_c: Context, _req: express.Request, res: express.Response) => {
        res.status(404).json({ error: 'Not found' });
    },

    validationFail: (c: Context, _req: express.Request, res: express.Response) => {
        res.status(400).json({ error: c.validation.errors });
    },

    notImplemented: async (c: Context, _req: express.Request, res: express.Response) => {
        if (!uxpSocket || uxpSocket.readyState !== WebSocket.OPEN) {
            return res.status(503).json({ error: 'Premiere Pro is not connected' });
        }

        const actionId = c.operation.operationId!;

        // Merge path params, query params, and body into a flat params object
        const params: Record<string, unknown> = {
            ...(c.request.params as Record<string, unknown>),
            ...(c.request.query as Record<string, unknown>),
            ...(c.request.body && typeof c.request.body === 'object' ? c.request.body as Record<string, unknown> : {}),
        };

        console.log(`→ ${actionId}`, Object.keys(params).length ? params : '(no params)');

        const result = await sendToUxp(actionId, params);

        switch (result.status) {
            case 'OK':
                return res.status(200).json(result.result ?? null);
            case 'NOT_FOUND':
                return res.status(404).json({ error: result.message });
            case 'INVALID_PARAMS':
                return res.status(400).json({ error: result.message });
            case 'INTERNAL_ERROR':
                return res.status(500).json({ error: result.message });
        }
    },
});

let httpServer: ReturnType<typeof app.listen> | null = null;

api.init().then(() => {
    app.use((req, res, next) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        api.handleRequest(req as any, req, res).catch(next);
    });

    httpServer = app.listen(HTTP_PORT, () => {
        console.log(`HTTP server listening on  http://localhost:${HTTP_PORT}`);
        console.log(`Swagger UI available at   http://localhost:${HTTP_PORT}/docs`);
    });
}).catch((err: unknown) => {
    console.error('Failed to initialize OpenAPI backend:', err);
    process.exit(1);
});

// ── WebSocket server (UXP plugin connects here) ───────────────────────────────

let uxpSocket: WebSocket | null = null;

const wss = new WebSocketServer({ port: WS_PORT });

wss.on('connection', (ws) => {
    console.log('UXP plugin connected');
    uxpSocket = ws;

    ws.on('message', (data) => {
        let msg: OutgoingMessage;
        try {
            msg = JSON.parse(data.toString()) as OutgoingMessage;
        } catch {
            console.error('Failed to parse message from UXP:', data.toString());
            return;
        }

        const req = pending.get(msg.id);
        if (req) {
            clearTimeout(req.timer);
            pending.delete(msg.id);
            req.resolve(msg);
        }
    });

    ws.on('close', () => {
        console.log('UXP plugin disconnected');
        uxpSocket = null;
        rejectAllPending('UXP connection closed');
    });
});

wss.on('listening', () => {
    console.log(`WebSocket server listening on ws://localhost:${WS_PORT}`);
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────

function shutdown(): void {
    console.log('Shutting down...');
    rejectAllPending('Server is shutting down');
    wss.close();
    httpServer?.close(() => process.exit(0));
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);