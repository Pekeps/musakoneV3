#!/bin/bash
# MusakoneV3 Quick Start Script

set -e

echo "🎵 MusakoneV3 Setup"
echo "==================="
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    echo "   Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is available
if ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not available. Please install Docker Compose."
    exit 1
fi

echo "✓ Docker and Docker Compose are installed"
echo ""

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "✓ Created .env file"
    echo ""
    echo "⚠️  Please edit .env and configure your settings:"
    echo "   - Set MUSIC_LIBRARY_PATH to your music directory"
    echo "   - Configure streaming services (optional)"
    echo ""
    read -p "Press Enter to continue after editing .env, or Ctrl+C to exit..."
else
    echo "✓ .env file already exists"
fi

echo ""

# Create data directories
echo "📁 Creating data directories..."
mkdir -p data/music data/mopidy/local data/mopidy/media data/mopidy/cache
echo "✓ Data directories created"
echo ""

# Build and start services
echo "🐳 Building and starting Docker services..."
echo "   This may take a few minutes on first run..."
echo ""
docker compose up -d --build

echo ""
echo "⏳ Waiting for services to be healthy..."
sleep 5

# Check service status
echo ""
echo "📊 Service Status:"
docker compose ps

echo ""
echo "✅ Setup complete!"
echo ""
echo "📍 Access Points:"
echo "   Frontend:  http://localhost:3000"
echo "   Mopidy:    http://localhost:6680"
echo ""
echo "📚 Next Steps:"
echo "   1. Add music files to your MUSIC_LIBRARY_PATH directory"
echo "   2. Scan library: docker compose exec mopidy mopidy local scan"
echo "   3. Open http://localhost:3000 in your browser"
echo ""
echo "📖 View logs:       docker compose logs -f"
echo "🛑 Stop services:   docker compose down"
echo "🔄 Restart:         docker compose restart"
echo ""
