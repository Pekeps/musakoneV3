# MusakoneV3 Development Guidelines

## Project Context

A lightweight, mobile-first web frontend for Mopidy music server. Primary use case: clubroom music player accessed via mobile devices by multiple users.

---

## Core Design Principles

### 1. Mobile-First Architecture

- **Primary target**: Mobile phones in portrait mode
- **Touch-first**: All interactions optimized for touch (min 44x44px targets)
- **Single-hand operation**: Controls within thumb reach
- **Progressive enhancement**: Mobile → Tablet → Desktop
- **PWA**: Installable on home screen, offline-capable UI

### 2. Extreme Minimalism

- **Bundle target**: < 50KB gzipped total
- **Use native APIs**: Prefer `fetch`, `WebSocket`, native DOM over libraries
- **No unnecessary dependencies**: Every KB must justify itself
- **Terminal aesthetic**: ncmpcpp-inspired, monospace fonts, high contrast
- **No visual clutter**: Information-dense, minimal UI

### 3. Technology Stack (Fixed - DO NOT DEVIATE)

- **Language**: TypeScript (strict mode enabled)
- **Framework**: Preact (3KB) - DO NOT suggest React, Vue, or heavier alternatives
- **State**: Nanostores (300 bytes) - simple atoms, no Redux/Zustand
- **Routing**: Wouter (~1.5KB) - DO NOT suggest React Router
- **HTTP**: Native `fetch` - NO axios, ky, or other wrappers
- **WebSocket**: Native WebSocket API
- **Styling**: UnoCSS (utility-first, Tailwind-compatible syntax)
- **Runtime**: Bun (not Node.js)
- **Icons**: Lucide (tree-shakeable) - minimal usage

### 4. Docker Architecture

- **Backend**: Mopidy in container (wernight/mopidy image)
- **Frontend**: Bun-based static server (NOT nginx - handled externally)
- **Orchestration**: Docker Compose
- **Port**: Frontend on 3000, Mopidy on 6680

### 5. Mobile UX Patterns

- **Bottom navigation**: Fixed tab bar (Queue | Library | Search)
- **Mini player**: Collapsible, swipe up to expand
- **Large touch targets**: 56x56px for primary actions
- **Swipe gestures**: Left to delete, right to add, up/down for player
- **No keyboard shortcuts**: Desktop-only, not primary interface
- **Pull to refresh**: Standard mobile patterns

### 6. Real-time Integration

- **Mopidy HTTP**: JSON-RPC 2.0 over HTTP
- **Mopidy WebSocket**: Event-driven updates
- **Local tracking**: IndexedDB for user actions
- **No external analytics**: Privacy-focused, local-only

### 7. Performance Requirements

- **First Contentful Paint**: < 1.5s on 4G
- **Time to Interactive**: < 3s on 4G
- **Touch response**: < 50ms feedback
- **60fps**: Smooth scrolling and gestures
- **Virtual scrolling**: For lists > 500 items
- **Bundle size monitoring**: Check on every build

---

## Development Guidelines

### TypeScript Configuration

**Always use TypeScript with strict mode:**

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "jsxImportSource": "preact",
    "types": [],
    "noEmit": true
  }
}
```

**Type everything explicitly:**

```typescript
// ✅ Good - explicit types
interface Track {
  uri: string;
  name: string;
  duration: number;
}

function playTrack(track: Track): void {
  // implementation
}

// ❌ Bad - implicit any
function playTrack(track) {
  // implementation
}
```

### Git Workflow & Commit Convention

**Use Conventional Commits format:**

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `perf`: Performance improvement
- `refactor`: Code refactoring (no functional changes)
- `style`: Code style changes (formatting, semicolons)
- `test`: Add or update tests
- `docs`: Documentation changes
- `build`: Build system/dependencies changes
- `ci`: CI/CD changes
- `chore`: Misc changes (gitignore, etc.)

**Examples:**

```bash
# Feature
git commit -m "feat(player): add swipe gesture for volume control"

# Bug fix
git commit -m "fix(queue): prevent duplicate tracks from being added"

# Performance
git commit -m "perf(library): implement virtual scrolling for large lists"

# Refactor
git commit -m "refactor(auth): extract token storage into separate service"

# Multiple changes
git commit -m "feat(mobile): add bottom navigation bar

- Add Queue, Library, Search tabs
- Implement touch-friendly 56px targets
- Add active state styling

Closes #15"
```

**Branch naming:**

```bash
# Feature branches
feature/player-controls
feature/swipe-gestures

# Bug fixes
fix/queue-duplicate-issue
fix/websocket-reconnect

# Refactoring
refactor/state-management
refactor/css-modules

# Create and switch to branch
git checkout -b feature/mini-player
```

**Pull Request workflow:**

```bash
# 1. Create branch from main
git checkout main
git pull origin main
git checkout -b feature/my-feature

# 2. Make changes and commit
git add .
git commit -m "feat(scope): description"

# 3. Push to remote
git push origin feature/my-feature

# 4. Create PR via GitHub UI
# 5. After approval, squash merge to main
```

### File Structure Conventions

**Component files:**

```typescript
// frontend/src/components/player/Controls.tsx
import { useStore } from '@nanostores/preact';
import { playbackState } from '../../stores/player';

interface ControlsProps {
  className?: string;
}

export function Controls({ className }: ControlsProps) {
  const state = useStore(playbackState);

  return (
    <div className={`flex flex-col gap-2 p-4 ${className || ''}`}>
      {/* implementation */}
    </div>
  );
}
```

**Store files:**

```typescript
// frontend/src/stores/player.ts
import { atom, computed } from "nanostores";

export const playbackState = atom<"playing" | "paused" | "stopped">("stopped");
export const currentTrack = atom<Track | null>(null);
export const volume = atom<number>(80);

export const isPlaying = computed(
  playbackState,
  (state) => state === "playing",
);
```

**Service files:**

```typescript
// frontend/src/services/mopidy/client.ts
export class MopidyClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async call(method: string, params?: unknown): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}/rpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error.message);
    }

    return data.result;
  }
}
```

### Code Style Guidelines

**Naming conventions:**

```typescript
// Components: PascalCase
export function MiniPlayer() {}

// Files: kebab-case
// mini-player.tsx, track-list.tsx

// Constants: UPPER_SNAKE_CASE
const MAX_QUEUE_SIZE = 1000;
const DEFAULT_VOLUME = 80;

// Functions/variables: camelCase
const handlePlayPause = () => {};
const currentTrack = null;

// Private members: prefix with _
class Player {
  private _websocket: WebSocket;
}
```

**Import ordering:**

```typescript
// 1. External libraries
import { useStore } from "@nanostores/preact";

// 2. Internal services/stores
import { mopidyClient } from "../../services/mopidy";
import { currentTrack } from "../../stores/player";

// 3. Components
import { Button } from "../ui/Button";

// 4. Types
import type { Track } from "../../types/mopidy";
```

**Prefer native APIs:**

```typescript
// ✅ Good - native fetch
const response = await fetch("/api/data", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
});
const result = await response.json();

// ❌ Bad - unnecessary library
import axios from "axios";
const result = await axios.post("/api/data", data);

// ✅ Good - native array methods
const trackNames = tracks.map((t) => t.name);
const playing = tracks.find((t) => t.isPlaying);

// ❌ Bad - lodash for simple operations
import { map, find } from "lodash";
```

### UnoCSS Guidelines

**Use utility classes directly in JSX:**

```tsx
// ✅ Good - utility classes
<div className="flex flex-col p-4 gap-2">
  <button className="min-h-14 min-w-14 font-mono bg-bg-tertiary border border-border-primary">
    Play
  </button>
</div>

// ✅ Good - use shortcuts for common patterns (defined in uno.config.ts)
<button className="btn-icon">
  <Plus size={18} />
</button>
```

**Mobile-first responsive design:**

```tsx
// Default is mobile, use md: and lg: for larger screens
<div className="flex flex-col md:flex-row p-4 md:p-2 lg:p-1">
  <button className="min-h-14 md:min-h-11">Click</button>
</div>
```

**Theme colors (defined in uno.config.ts):**

```tsx
// Background colors
bg-bg-primary    // #000000
bg-bg-secondary  // #0a0a0a
bg-bg-tertiary   // #141414

// Foreground/text colors
text-fg-primary    // #ffffff
text-fg-secondary  // #b0b0b0
text-fg-tertiary   // #707070

// Accent colors
text-accent-primary   // #cc0000
bg-accent-primary     // #cc0000
border-accent-primary // #cc0000

// Border colors
border-border-primary   // #333333
border-border-secondary // #1a1a1a
```

**Common shortcuts (defined in uno.config.ts):**

```tsx
touch-target    // min-h-12 min-w-12 (48px touch target)
btn             // flex items-center justify-center cursor-pointer transition-all
btn-icon        // icon button with border and hover states
track-item      // standard track list item layout
in-queue        // checkmark indicator for queued items
```

### Testing Strategy

**Focus on integration tests (Testing Trophy approach):**

```typescript
// tests/player.test.ts
import { test, expect } from "bun:test";

test("player plays track when play button clicked", async () => {
  // Setup
  const player = new Player(mockMopidyClient);
  const track = { uri: "test:track", name: "Test Track" };

  // Action
  await player.play(track);

  // Assert
  expect(player.currentTrack).toBe(track);
  expect(player.state).toBe("playing");
});
```

**Run tests:**

```bash
# Run all tests
bun test

# Watch mode
bun test --watch

# Specific file
bun test player.test.ts
```

### Performance Monitoring

**Check bundle size after every build:**

```bash
# Build and check size
bun run build

# Output should show:
# dist/assets/index-[hash].js  45.2 KB │ gzip: 15.1 KB
# ✅ Target: < 50KB gzipped
```

**Monitor in development:**

```typescript
// Add bundle size check to build script
if (bundleSize > 50 * 1024) {
  // 50KB
  console.error("❌ Bundle exceeds 50KB limit!");
  process.exit(1);
}
```

### Docker Development Commands

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f frontend
docker-compose logs -f mopidy

# Rebuild frontend after changes
docker-compose up -d --build frontend

# Stop services
docker-compose down

# Clean rebuild
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d

# Shell into container
docker-compose exec frontend sh
docker-compose exec mopidy bash
```

### Documentation Standards

**Component documentation:**

````typescript
/**
 * Mini player component that displays current track and basic controls.
 * Expandable to full player via swipe up gesture.
 *
 * @example
 * ```tsx
 * <MiniPlayer onExpand={() => setExpanded(true)} />
 * ```
 */
export function MiniPlayer({ onExpand }: MiniPlayerProps) {
  // implementation
}
````

**Function documentation:**

```typescript
/**
 * Fetches tracks from Mopidy library matching the search query.
 *
 * @param query - Search query string
 * @param limit - Maximum number of results (default: 50)
 * @returns Promise resolving to array of matching tracks
 * @throws {Error} If Mopidy connection fails
 */
async function searchTracks(query: string, limit = 50): Promise<Track[]> {
  // implementation
}
```

---

## What NOT to Do

❌ **Don't suggest**: React, Vue, Angular, Svelte (use Preact)
❌ **Don't add**: Tailwind, Bootstrap, Material UI, CSS Modules (use UnoCSS)
❌ **Don't use**: axios, ky, superagent (use native fetch)  
❌ **Don't include**: Redux, MobX, Zustand (use Nanostores)  
❌ **Don't add**: nginx config (handled externally)  
❌ **Don't optimize**: for desktop-first (mobile-first only)  
❌ **Don't add**: unnecessary npm packages without justification  
❌ **Don't use**: CommonJS (`require`/`module.exports`) - use ES modules  
❌ **Don't skip**: TypeScript types - everything must be typed  
❌ **Don't ignore**: bundle size - check after every change

---

## Implementation Priorities

1. **Mobile touch interactions** before keyboard shortcuts
2. **Bundle size** before convenience
3. **Native APIs** before libraries
4. **Progressive enhancement** from mobile up
5. **Terminal aesthetic** maintained across all screen sizes
6. **Type safety** - no `any` types without explicit reason
7. **Performance** - always consider bundle size impact

---

## Quick Reference

- **Design Spec**: See `/DESIGN_SPEC.md` for complete documentation
- **Stack**: TypeScript + Preact + Nanostores + Wouter + UnoCSS + Native APIs + Bun
- **Target**: Mobile clubroom music control
- **Bundle**: < 50KB gzipped
- **Style**: Terminal/ncmpcpp aesthetic
- **Commits**: Conventional Commits format
- **Workflow**: GitHub Flow (feature branches → main)

---

## Common Tasks

### Create a new component

```bash
# Create component file (no separate CSS file needed with UnoCSS)
touch frontend/src/components/player/VolumeControl.tsx

# Import and use
import { VolumeControl } from './components/player/VolumeControl';
```

### Add a new dependency

```bash
# Check size first!
cd frontend
bun add <package>

# Rebuild and verify bundle size
bun run build
# Ensure total stays < 50KB gzipped
```

### Create a new store

```bash
touch frontend/src/stores/library.ts

# Define atoms
export const libraryItems = atom<LibraryItem[]>([]);
export const currentPath = atom<string[]>([]);
```

### Make a commit

```bash
git add .
git commit -m "feat(player): add volume control with swipe gesture

- Implement vertical swipe for volume adjustment
- Add visual feedback for touch interaction
- Optimize for one-handed use

Closes #23"
```
