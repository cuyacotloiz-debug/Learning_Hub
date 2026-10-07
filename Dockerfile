FROM node:20-slim

# Set working directory
WORKDIR /app

# Install dependencies (including dev deps for ts-node)
# Copy package manifests first to leverage Docker cache
COPY package.json package-lock.json* ./
RUN npm ci --omit=optional

# Copy application source
COPY . .

EXPOSE 9700
ENV NODE_ENV=development

# Use ts-node to run the observability server
CMD ["npx", "ts-node", "scripts/observability-server.ts"]
