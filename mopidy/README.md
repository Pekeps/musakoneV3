# MusakoneV3 Backend

Mopidy music server backend for MusakoneV3.

## Services

- **Mopidy**: Music server with HTTP API and WebSocket support
  - Port 6600: MPD protocol
  - Port 6680: HTTP/WebSocket JSON-RPC API

## Quick Start

```bash
# Build and start services
docker-compose up -d

# View logs
docker-compose logs -f mopidy

# Stop services
docker-compose down

# Rebuild after config changes
docker-compose up -d --build
```

## Configuration

Edit `mopidy/mopidy.conf` to customize Mopidy settings.

## API Access

- HTTP JSON-RPC: `http://localhost:6680/mopidy/rpc`
- WebSocket: `ws://localhost:6680/mopidy/ws`
- Web client: `http://localhost:6680/`

## Adding Music

Place music files in the `mopidy-media` volume or configure additional volumes in `docker-compose.yml`.

```yaml
volumes:
  - /path/to/your/music:/var/lib/mopidy/media
```

Then scan the library:

```bash
docker-compose exec mopidy mopidy local scan
```
