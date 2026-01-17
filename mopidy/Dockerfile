FROM wernight/mopidy:latest

# Copy Mopidy configuration
COPY mopidy.conf /config/mopidy.conf

# Expose ports
# 6600: MPD server
# 6680: HTTP server (JSON-RPC API)
EXPOSE 6600 6680
