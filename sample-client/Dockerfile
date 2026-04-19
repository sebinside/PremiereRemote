FROM node:20-slim AS builder

WORKDIR /app

COPY sample-client/package*.json ./
RUN npm ci --ignore-scripts

COPY sample-client/ ./
RUN npm run build

FROM node:20-slim AS production

WORKDIR /app

COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production

ENTRYPOINT ["node", "dist/cli.js"]
