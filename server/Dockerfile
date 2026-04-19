FROM node:20-slim AS builder

WORKDIR /app

COPY server/package*.json ./
RUN npm ci --ignore-scripts

COPY server/ ./
RUN npm run build

FROM node:20-slim AS production

WORKDIR /app

COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/generated ./src/generated

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "dist/server.js"]
