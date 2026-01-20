# MusakoneV3 Frontend

Mobile-first web frontend for Mopidy music server.

## Features

- 🎵 **Mobile-First**: Optimized for touch interactions on phones
- 🎨 **Terminal Aesthetic**: ncmpcpp-inspired dark theme
- ⚡ **Lightweight**: < 50KB gzipped bundle
- 📱 **PWA**: Installable on mobile home screen
- 🔄 **Real-time**: WebSocket connection to backend
- 🎮 **Touch Controls**: Large, accessible touch targets (56px)

## Tech Stack

- **Preact** (3KB) - Ultra-light React alternative
- **Nanostores** (300B) - Minimal state management
- **Wouter** (~1.5KB) - Tiny router
- **Bun** - Fast runtime and bundler
- **TypeScript** - Strict typing
- **CSS Modules** - Scoped styles

## Development

```bash
# Install dependencies
bun install

# Start dev server (http://localhost:3000)
bun dev

# Build for production
bun run build

# Type check
bun run type-check

# Lint & format
bun run lint
bun run format
```

## Docker

```bash
# Build image
docker build -t musakone-frontend .

# Run container
docker run -p 3000:3000 musakone-frontend

# Or use docker-compose from project root
cd ..
docker-compose up frontend
```

## Architecture

```
frontend/
├── src/
│   ├── components/       # Reusable UI components
│   │   ├── BottomNav     # Mobile bottom navigation
│   │   └── MiniPlayer    # Persistent mini player
│   ├── routes/           # Page views
│   │   ├── QueueView     # Current queue
│   │   ├── LibraryView   # Music library browser
│   │   └── SearchView    # Search interface
│   ├── stores/           # Nanostores state
│   │   ├── player.ts     # Playback state
│   │   ├── queue.ts      # Queue management
│   │   └── connection.ts # WebSocket status
│   ├── services/         # Business logic
│   │   └── websocket.ts  # Backend WS client
│   ├── types/            # TypeScript definitions
│   ├── styles/           # Global CSS
│   ├── App.tsx           # Main app component
│   └── main.tsx          # Entry point
├── public/
│   ├── manifest.json     # PWA manifest
│   └── sw.js             # Service worker
└── index.html            # HTML template
```

## WebSocket Protocol

The frontend connects to the backend WebSocket server:

```typescript
// Send commands
ws.send(JSON.stringify({ type: 'play' }));
ws.send(JSON.stringify({ type: 'pause' }));
ws.send(JSON.stringify({ type: 'next' }));
ws.send(JSON.stringify({ type: 'set_volume', volume: 80 }));

// Receive events (forwarded from Mopidy)
{
  "event": "track_playback_started",
  "data": { "tl_track": { "track": {...} } }
}
```

## Mobile Optimization

- **Touch targets**: Minimum 56px (iOS/Android guidelines)
- **Bottom navigation**: Fixed bar for one-handed use
- **Swipe gestures**: Ready for implementation
- **Large controls**: Easy to tap while moving
- **Responsive**: Adapts to portrait/landscape
- **PWA**: Add to home screen for app-like experience

## Bundle Size Target

- **Current**: Check with `bun run build`
- **Target**: < 50KB gzipped
- **Strategy**:
  - Tree-shaking via Vite/Rollup
  - No heavy dependencies
  - CSS Modules (no framework)
  - Code splitting by route
  - Minimal icons (Lucide)

## Browser Support

- iOS Safari 15+
- Chrome Android (latest 2 versions)
- Desktop browsers (bonus, not primary target)

## Environment Variables

```env
VITE_BACKEND_HOST=localhost  # Backend WebSocket host
VITE_BACKEND_PORT=3001       # Backend WebSocket port
```

## Contributing

Follow the Conventional Commits format:

```bash
git commit -m "feat(player): add volume control"
git commit -m "fix(queue): prevent duplicate tracks"
```

See project root `.github/copilot-instructions.md` for detailed guidelines.
