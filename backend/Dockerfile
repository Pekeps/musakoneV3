# Multi-stage build for Gleam backend

# Stage 1: Build
FROM ghcr.io/gleam-lang/gleam:v1.6.2-erlang-alpine AS builder

WORKDIR /build

# Install build dependencies
RUN apk add --no-cache \
    gcc \
    git \
    libc-dev \
    sqlite-dev

# Copy project files
COPY gleam.toml manifest.toml ./
COPY src ./src

# Download dependencies
RUN gleam deps download

# Build the application
RUN gleam build

# Stage 2: Runtime
FROM ghcr.io/gleam-lang/gleam:v1.6.2-erlang-alpine

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache \
    sqlite-libs \
    sqlite

# Copy built application from builder
COPY --from=builder /build/build /app/build
COPY --from=builder /build/gleam.toml /app/
COPY --from=builder /build/manifest.toml /app/

# Create data directory for SQLite database
RUN mkdir -p /app/data && \
    chmod 777 /app/data

# Expose port
EXPOSE 3001

# Environment variables (can be overridden in docker-compose)
ENV PORT=3001
ENV DATABASE_PATH=/app/data/musakone.db
ENV JWT_SECRET=change-this-secret-in-production
ENV MOPIDY_URL=ws://mopidy:6680/mopidy/ws

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Run the application
CMD ["gleam", "run"]
