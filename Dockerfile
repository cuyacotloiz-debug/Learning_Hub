# Multi-stage Dockerfile for observability server

# Builder stage: install dependencies and prepare app
FROM node:20 AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=optional
COPY . .

# Runner stage: copy app from builder (uses the installed node_modules)
FROM node:20-slim AS runner
WORKDIR /app
# Copy everything from builder (including node_modules)
COPY --from=builder /app /app

ENV NODE_ENV=development
EXPOSE 9700
# Run the server with ts-node (dev-friendly). For production, consider compiling to JS and using a smaller runtime image.
CMD ["npx", "ts-node", "scripts/observability-server.ts"]
