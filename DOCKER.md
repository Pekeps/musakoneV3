# Docker Setup for MusakoneV3

## Quick Start

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Services

### Frontend (Port 3000)
- **Image**: Custom Bun-based build
- **Access**: http://localhost:3000
- **Build**: Multi-stage Docker build for optimized size

### Mopidy (Ports 6680, 6600)
- **Image**: wernight/mopidy:latest
- **HTTP/WebSocket**: http://localhost:6680
- **MPD Protocol**: Port 6600

## Development

### Rebuild Frontend Only
```bash
docker-compose up -d --build frontend
```

### View Frontend Logs
```bash
docker-compose logs -f frontend
```

### Shell Access
```bash
# Frontend container
docker-compose exec frontend sh

# Mopidy container
docker-compose exec mopidy bash
```

## Configuration

### Mopidy Config
Place Mopidy configuration in `./mopidy/config/mopidy.conf`

### Music Library
Mount your music directory to `./music/`

### Frontend Environment
Environment variables are set in docker-compose.yml:
- `VITE_MOPIDY_WS_URL`: WebSocket URL for Mopidy
- `VITE_MOPIDY_HTTP_URL`: HTTP URL for Mopidy JSON-RPC

## Production Deployment

For production, consider:
1. Add nginx reverse proxy
2. Enable HTTPS
3. Configure proper volume mounts
4. Adjust resource limits
5. Set up proper logging

## Troubleshooting

### Frontend not connecting to Mopidy
Check that services are on the same network:
```bash
docker network inspect musakone_musakone
```

### Rebuild from scratch
```bash
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```
