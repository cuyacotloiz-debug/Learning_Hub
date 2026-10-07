# Multi-stage Dockerfile for observability server

# Builder stage: install dependencies and prepare app
FROM node:20 AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=optional
COPY . .

# build compiled JS
RUN npx tsc -p tsconfig.json

# Runner stage: copy app from builder (includes compiled JS)
FROM node:20-slim AS runner
WORKDIR /app
# Copy only compiled artifacts and node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

ENV NODE_ENV=production
EXPOSE 9700
# Run the compiled JS
CMD ["node", "dist/scripts/observability-server.js"]
