# Build stage
FROM oven/bun:1.3.6-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lock* ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN bun run build

# Production stage - Use Bun native server
FROM oven/bun:1.3.6-alpine

WORKDIR /app

# Copy all source files (including TS, CSS, assets)
COPY . .

# Install dependencies (lockfile respected)
RUN bun install --frozen-lockfile

# Build frontend (outputs to /dist)
RUN bun run build

# Expose port for Bun static server
EXPOSE 3000

# Start Bun static server (TypeScript entrypoint)
CMD ["bun", "run", "server.ts"]
