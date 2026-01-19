FROM debian:bookworm-slim

RUN apt-get update
RUN apt-get install -y --no-install-recommends \
    mopidy \
    curl

# Create directories with proper permissions
RUN mkdir -p /var/lib/mopidy/local /var/lib/mopidy/media /var/lib/mopidy/playlists && \
    mkdir -p /var/cache/mopidy && \
    mkdir -p /config && \
    chown -R mopidy:audio /var/lib/mopidy /var/cache/mopidy /config

# Switch to mopidy user (created by mopidy package)
USER mopidy
WORKDIR /var/lib/mopidy

# Copy configuration
COPY --chown=mopidy:audio mopidy.conf /config/mopidy.conf

# Expose ports
# 6600: MPD server
# 6680: HTTP server (JSON-RPC API)
EXPOSE 6600 6680

# Run Mopidy
CMD ["mopidy", "--config", "/config/mopidy.conf"]
