# Multi-stage build for Gleam backend

# Stage 1: Build
FROM ghcr.io/gleam-lang/gleam:v1.14.0-erlang-alpine AS builder

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
FROM ghcr.io/gleam-lang/gleam:v1.14.0-erlang-alpine

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache \
    sqlite-libs \
    sqlite

# Copy built application from builder
COPY --from=builder /build/build /app/build
COPY --from=builder /build/gleam.toml /app/
COPY --from=builder /build/manifest.toml /app/
COPY --from=builder /build/src /app/src

# Create data directory for SQLite database
RUN mkdir -p /app/data && \
    chmod 777 /app/data

# Expose port (container-internal, hardcoded)
EXPOSE 3001

# Run the application
CMD ["gleam", "run"]
