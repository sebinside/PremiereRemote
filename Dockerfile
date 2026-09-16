# 1. Generate openapi.json from UXP plugin
FROM node:lts-alpine AS api-gen
RUN corepack enable
WORKDIR /app

COPY client/package.json client/pnpm-lock.yaml client/pnpm-workspace.yaml ./client/
COPY shared/ ./shared/
RUN cd client && pnpm install --frozen-lockfile


COPY client/scripts/generate-api.js ./client/scripts/
COPY client/src/actions/ ./client/src/actions/
RUN cd client && node scripts/generate-api.js

# 2. Copy openapi.json to build the server image
FROM node:lts-alpine AS builder
RUN corepack enable
WORKDIR /app

COPY server/package.json server/pnpm-lock.yaml server/pnpm-workspace.yaml ./
COPY shared/ /shared/
RUN pnpm install --frozen-lockfile

COPY server/tsconfig.json ./
COPY server/src/ ./src/
COPY --from=api-gen /app/server/openapi.json ./openapi.json
RUN pnpm run build

# Create a minimal runtime image
FROM node:lts-alpine

# Use tini to fixe Ctrl+Cl handling in container
RUN apk add --no-cache tini

RUN corepack enable
WORKDIR /app

COPY server/package.json server/pnpm-lock.yaml server/pnpm-workspace.yaml ./
COPY shared/ /shared/
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/dist ./dist/
COPY --from=api-gen /app/server/openapi.json ./openapi.json

# HTTP API
EXPOSE 42400
# WebSocket (UXP plugin)
EXPOSE 42401

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
