# MusakoneV3 - Mopidy Web Frontend Design Specification

## Project Overview

**Project Name**: MusakoneV3  
**Description**: A lightweight, minimalist terminal-style web frontend for Mopidy music server  
**Design Philosophy**: ncmpcpp-inspired UI with modern web technologies, mobile-first approach  
**Primary Use Case**: Clubroom music player with shared access via mobile devices  
**Target**: Mobile users in a social setting who need quick, intuitive music control

---

## 1. Mobile-First Design Principles

### 1.1 Primary Interaction Method

- **Touch-First**: All controls optimized for touch interaction (minimum 44x44px touch targets)
- **Keyboard Support**: Secondary - available for desktop users
- **Gesture Support**: Swipe gestures for common actions
- **Single-Hand Operation**: Controls within thumb reach on mobile devices

### 1.2 Mobile Optimization

- **Responsive Design**: Mobile (320px+), Tablet (768px+), Desktop (1024px+)
- **Portrait Mode Priority**: Primary layout for mobile portrait orientation
- **Landscape Support**: Optimized horizontal layout for tablets/desktop
- **Progressive Web App (PWA)**: Installable on mobile home screen
- **Offline Capability**: Cache essential UI assets
- **Fast Loading**: < 1s on 4G networks

### 1.3 Social/Shared Usage Patterns

- **Quick Access**: Minimal navigation depth (max 2 levels)
- **Visual Feedback**: Clear confirmation of actions for social context
- **Queue Visibility**: Always show what's playing and next tracks
- **Collaborative Queue**: Easy to see others' additions
- **Non-intrusive**: No confirmation dialogs for common actions

---

## 2. Functional Requirements

### 1.1 Music Player Functionality

#### Core Playback Controls

- **Play/Pause**: Toggle playback state
- **Next/Previous**: Navigate tracks
- **Stop**: Stop playback completely
- **Seek**: Jump to position in current track
- **Volume Control**: Adjust volume (0-100%)
- **Repeat Modes**: off, single track, all
- **Random/Shuffle**: Toggle random playback
- **Consume Mode**: Remove tracks after playing

#### Library Management

- **Browse Library**: Navigate music by:
  - Artists
  - Albums
  - Tracks
  - Playlists
  - Folders/Files
- **Search**: Full-text search across library
- **Queue Management**:
  - View current queue
  - Add tracks/albums/playlists to queue
  - Remove tracks from queue
  - Clear queue
  - Reorder queue (drag or keyboard shortcuts)

#### Playlist Operations

- Create new playlists
- Delete playlists
- Add tracks to playlists
- Remove tracks from playlists
- Load playlists into queue

#### Real-time Updates

- Live playback status updates
- Queue changes synchronization
- Library updates reflection
- Multi-client state synchronization

### 1.2 Authentication

#### Authentication Methods

- **Session-based Auth**: Cookie/session storage
- **Token-based Auth**: JWT tokens for API requests

#### User Management

- Login screen with credentials
- Remember me functionality
- Session persistence
- Logout functionality
- Protected routes (redirect to login if not authenticated)

#### Security Considerations

- Secure token storage (httpOnly cookies preferred)
- CSRF protection
- Rate limiting on auth endpoints
- Encrypted password transmission (HTTPS only)

### 1.3 User Action Tracking

#### Events to Track

- **Playback Events**:
  - Track played (with timestamp)
  - Track skipped
  - Pause/resume actions
  - Volume changes
- **Navigation Events**:
  - Page views
  - Search queries
  - Browse actions
- **Library Interactions**:
  - Tracks added to queue
  - Playlists created/modified
  - Favorite tracks

#### Analytics Storage

- **Local Storage**: Client-side IndexedDB for basic tracking
- **Backend API**: Optional endpoint for aggregated analytics
- **Privacy**: No third-party tracking, user data stays local/self-hosted

#### Data Structure

```typescript
interface UserAction {
  id: string;
  userId: string;
  timestamp: number;
  action:
    | "play"
    | "pause"
    | "skip"
    | "search"
    | "queue_add"
    | "playlist_create";
  metadata: Record<string, any>;
}
```

---

## 2. Technology Stack

### 2.1 Backend

- **Language**: Gleam (functional, type-safe language on the BEAM VM)
- **Runtime**: Erlang/OTP (BEAM VM)
- **Web Framework**: Mist (minimal HTTP/WebSocket server)
- **Database**: SQLite (embedded, for user tracking and analytics)
- **Architecture**: WebSocket proxy between clients and Mopidy
  - Handles authentication (JWT)
  - Tracks all user actions
  - Manages WebSocket connection pool
  - Single WebSocket connection to Mopidy

### 2.2 Frontend Runtime & Build Tools

- **Runtime**: Bun (latest) - fast JavaScript runtime
- **Package Manager**: Bun
- **Build Tool**: Bun's built-in bundler
- **Dev Server**: Bun's built-in server

### 2.3 Frontend Framework

- **Framework**: **Preact** (lightweight React alternative, 3KB)
  - Reasoning: Smallest production-ready framework
  - Full React compatibility via preact/compat
  - Excellent performance

### 2.4 State Management

- **Global State**: Nanostores (~300 bytes)
  - Atomic state management
  - No boilerplate
  - Framework-agnostic
- **Server State**: TanStack Query (formerly React Query)
  - Caching
  - Real-time updates
  - Optimistic updates

### 2.5 Routing

- **Router**: Wouter (~1.5KB)
  - Minimalist routing
  - Hook-based API
  - Perfect for single-page apps

### 2.6 HTTP Client

- **Client**: Native Fetch API (0KB)
  - Built into all modern browsers
  - Wrap in thin utility layer if needed (~100 bytes)
  - Sufficient for Mopidy JSON-RPC calls
  - No external dependencies

### 2.6 WebSocket Client

- **WebSocket**: Native WebSocket API
  - No additional library needed
  - For real-time Mopidy updates
  - Automatic reconnection logic

### 2.8 Progressive Web App (PWA)

- **Manifest**: Web app manifest for installability
- **Service Worker**: Cache static assets for offline UI
- **Icons**: Multiple sizes for different devices (192x192, 512x512)
- **Splash Screens**: Custom loading screen
- **Standalone Mode**: Full-screen app experience
- **Add to Home Screen**: Prompt for installation

### 2.9 Styling

- **Base**: CSS Modules + Modern CSS
- **Variables**: CSS Custom Properties
- **Terminal Theme**: Custom monospace design
- **Icons**: Lucide (tree-shakeable, ~1KB per icon)
- **No CSS Framework**: Keep it minimal

### 2.10 Build Optimizations

- Code splitting (route-based)
- Tree shaking
- Minification
- Asset optimization
- Preact aliases for React

### 2.11 Development Tools

- **TypeScript**: Full type safety
- **Biome**: Alternative faster linter/formatter

---

## 3. Architecture

### 3.1 Application Structure

```
musakoneV3/
├── backend/                 # Gleam backend service
│   ├── src/
│   │   ├── app.gleam            # Main application entry
│   │   ├── router.gleam         # HTTP/WebSocket routing
│   │   ├── auth/
│   │   │   ├── jwt.gleam        # JWT token handling
│   │   │   ├── session.gleam    # Session management
│   │   │   └── middleware.gleam # Auth middleware
│   │   ├── proxy/
│   │   │   ├── mopidy_client.gleam    # Single WS to Mopidy
│   │   │   ├── client_pool.gleam      # Manage client WS connections
│   │   │   └── message_router.gleam   # Route messages between clients and Mopidy
│   │   ├── tracking/
│   │   │   ├── logger.gleam     # Log user actions to database
│   │   │   └── analytics.gleam  # Analytics queries
│   │   ├── db/
│   │   │   ├── sqlite.gleam     # SQLite interface
│   │   │   └── migrations.gleam # Database migrations
│   │   └── types/
│   │       ├── mopidy.gleam     # Mopidy protocol types
│   │       └── user.gleam       # User types
│   ├── test/                # Tests
│   ├── gleam.toml          # Gleam project config
│   ├── Dockerfile          # Backend container
├── frontend/                # Frontend application
│   ├── src/
│   │   ├── main.tsx              # Entry point
│   │   ├── App.tsx               # Root component
│   │   ├── routes/               # Page components
│   │   │   ├── Login.tsx
│   │   │   ├── Player.tsx
│   │   │   ├── Library.tsx
│   │   │   ├── Queue.tsx
│   │   │   ├── Playlists.tsx
│   │   │   └── Search.tsx
│   │   ├── components/           # Reusable components
│   │   │   ├── ui/              # Basic UI components
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Input.tsx
│   │   │   │   ├── List.tsx
│   │   │   │   └── Modal.tsx
│   │   │   ├── player/          # Player-specific
│   │   │   │   ├── Controls.tsx
│   │   │   │   ├── ProgressBar.tsx
│   │   │   │   ├── VolumeControl.tsx
│   │   │   │   └── TrackInfo.tsx
│   │   │   └── library/         # Library components
│   │   │       ├── TrackList.tsx
│   │   │       ├── AlbumGrid.tsx
│   │   │       └── Breadcrumb.tsx
│   │   ├── services/            # Business logic
│   │   │   ├── mopidy/         # Mopidy integration
│   │   │   │   ├── client.ts
│   │   │   │   ├── websocket.ts
│   │   │   │   └── types.ts
│   │   │   ├── auth/           # Authentication
│   │   │   │   ├── auth.ts
│   │   │   │   └── storage.ts
│   │   │   └── analytics/      # User tracking
│   │   │       ├── tracker.ts
│   │   │       └── storage.ts
│   │   ├── stores/             # State management
│   │   │   ├── player.ts      # Playback state
│   │   │   ├── queue.ts       # Queue state
│   │   │   ├── library.ts     # Library state
│   │   │   └── auth.ts        # Auth state
│   │   ├── hooks/             # Custom React hooks
│   │   │   ├── useKeyboard.ts
│   │   │   ├── useMopidy.ts
│   │   │   └── useTracking.ts
│   │   ├── utils/             # Utility functions
│   │   │   ├── format.ts     # Time, size formatting
│   │   │   ├── keyboard.ts   # Keyboard shortcuts
│   │   │   └── constants.ts  # App constants
│   │   ├── styles/           # Global styles
│   │   │   ├── global.css
│   │   │   ├── theme.css     # CSS variables
│   │   │   └── terminal.css  # Terminal theme
│   │   └── types/            # TypeScript types
│   │       ├── mopidy.ts
│   │       └── app.ts
│   ├── public/              # Static assets
│   │   └── favicon.ico
│   ├── tests/              # Test files
│   ├── .env.example       # Environment variables template
│   ├── bunfig.toml        # Bun configuration
│   ├── tsconfig.json      # TypeScript config
│   ├── package.json
│   └── Dockerfile         # Frontend container
├── mopidy/                # Mopidy backend configuration
│   ├── mopidy.conf       # Mopidy configuration
│   ├── Dockerfile        # Mopidy container (optional custom)
│   ├── extensions/       # Custom Mopidy extensions
|   └── MOPIDY_API.md     # Mopidy API docs
├── data/                 # Persistent data (gitignored)
│   ├── backend/         # Backend data
│   │   └── analytics.db # SQLite database
│   ├── mopidy/          # Mopidy data
│   │   ├── playlists/
│   │   ├── cache/
│   │   └── local/
│   └── music/           # Music library mount point
├── docker-compose.yml   # Docker Compose configuration
├── .env.example         # Environment variables
├── .gitignore
├── DESIGN_SPEC.md       # This document
└── README.md            # Setup instructions
```

### 3.2 Component Hierarchy

```
App
├── Router
│   ├── Login (public route)
│   └── Layout (protected)
│       ├── Header
│       │   ├── Navigation
│       │   └── StatusBar
│       ├── Main
│       │   ├── Player
│       │   │   ├── TrackInfo
│       │   │   ├── Controls
│       │   │   ├── ProgressBar
│       │   │   └── VolumeControl
│       │   ├── Library
│       │   │   ├── Breadcrumb
│       │   │   ├── SearchBar
│       │   │   └── TrackList
│       │   ├── Queue
│       │   │   └── QueueList
│       │   └── Playlists
│       │       └── PlaylistManager
│       └── Footer
│           └── KeyboardHints
```

---

## 4. Architecture: WebSocket Proxy Pattern

### 4.1 Communication Flow

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│  Client A   │──WS────▶│             │         │             │
│  (Mobile)   │◀───WS───│             │         │             │
└─────────────┘         │             │         │             │
                        │   Gleam     │──WS────▶│   Mopidy    │
┌─────────────┐         │   Backend   │◀───WS───│   Server    │
│  Client B   │──WS────▶│             │         │             │
│  (Mobile)   │◀───WS───│   - Auth    │         │   - Music   │
└─────────────┘         │   - Track   │         │   - Library │
                        │   - Proxy   │         │   - Playback│
┌─────────────┐         │             │         │             │
│  Client C   │──WS────▶│             │         │             │
│  (Mobile)   │◀───WS───│             │         │             │
└─────────────┘         └─────────────┘         └─────────────┘
                              ↓
                        ┌─────────────┐
                        │   SQLite    │
                        │  (Analytics)│
                        └─────────────┘
```

### 4.2 Backend Responsibilities

1. **Authentication**
   - Validate JWT tokens on WebSocket connection
   - Manage user sessions
   - Reject unauthorized connections

2. **WebSocket Proxy**
   - Maintain pool of client WebSocket connections
   - Single WebSocket connection to Mopidy
   - Route messages between clients and Mopidy
   - Broadcast Mopidy events to all connected clients

3. **User Action Tracking**
   - Log every command from clients
   - Store: user_id, action_type, resource_uri, metadata, timestamp
   - Provide analytics API endpoints

4. **Message Flow**

   ```
   Client → Backend: { method: "core.playback.play", params: {} }
   Backend logs action: {user_id: "alice", action: "play", timestamp: ...}
   Backend → Mopidy: Forward same message
   Mopidy → Backend: { event: "track_playback_started", ... }
   Backend → All Clients: Broadcast event
   ```

### 4.4 Core Mopidy Methods

```typescript
// Playback
core.playback.play();
core.playback.pause();
core.playback.stop();
core.playback.next();
core.playback.previous();
core.playback.seek(position);
core.playback.getState();
core.playback.getTimePosition();
core.playback.getCurrentTrack();

// Tracklist (Queue)
core.tracklist.getTracks();
core.tracklist.add(tracks);
core.tracklist.remove({ tlid });
core.tracklist.clear();
core.tracklist.shuffle();

// Library
core.library.browse(uri);
core.library.search(query);
core.library.lookup(uri);

// Playlists
core.playlists.asList();
core.playlists.lookup(uri);
core.playlists.create(name);
core.playlists.delete(uri);
core.playlists.save(playlist);

// Mixer
core.mixer.getVolume();
core.mixer.setVolume(volume);
```

### 4.5 WebSocket Events (Mopidy → Backend → Clients)

```typescript
// Subscribe to events
{
  "track_playback_started": TrackPlaybackStartedEvent,
  "track_playback_ended": TrackPlaybackEndedEvent,
  "track_playback_paused": TrackPlaybackPausedEvent,
  "track_playback_resumed": TrackPlaybackResumedEvent,
  "playback_state_changed": PlaybackStateChangedEvent,
  "tracklist_changed": TracklistChangedEvent,
  "volume_changed": VolumeChangedEvent,
  "seeked": SeekedEvent
}
```

---

## 5. User Interface Design

### 5.1 Mobile-First Layout Strategy

#### Responsive Breakpoints

```css
/* Mobile First */
:root {
  --mobile: 320px; /* Mobile portrait */
  --tablet: 768px; /* Tablet portrait / large mobile */
  --desktop: 1024px; /* Desktop / tablet landscape */
  --wide: 1440px; /* Wide desktop */
}
```

#### Touch Target Sizes

- **Minimum**: 44x44px (iOS Human Interface Guidelines)
- **Recommended**: 48x48px (Material Design)
- **Comfortable**: 56x56px for primary actions
- **Spacing**: Minimum 8px between touch targets

#### Mobile Navigation

- **Bottom Navigation Bar**: Fixed, always visible (Queue | Library | Search)
- **Top Bar**: Compact status (current track, basic controls)
- **Expandable Player**: Mini player expands to full-screen
- **Modal Sheets**: Bottom sheets for options/filters

### 5.2 Terminal Aesthetic

#### Color Scheme (Inspired by ncmpcpp)

```css
:root {
  /* Background colors */
  --bg-primary: #0a0a0a;
  --bg-secondary: #141414;
  --bg-tertiary: #1a1a1a;
  --bg-hover: #252525;
  --bg-active: #2a2a2a;

  /* Foreground colors */
  --fg-primary: #e0e0e0;
  --fg-secondary: #a0a0a0;
  --fg-tertiary: #606060;
  --fg-dim: #404040;

  /* Accent colors */
  --accent-primary: #00ff88; /* Green - playing/active */
  --accent-secondary: #00aaff; /* Blue - selected */
  --accent-warning: #ffaa00; /* Orange - warnings */
  --accent-error: #ff4444; /* Red - errors */

  /* Border colors */
  --border-primary: #303030;
  --border-secondary: #202020;

  /* Typography */
  --font-mono: "JetBrains Mono", "Fira Code", "Courier New", monospace;
  --font-size-base: 14px;
  --line-height: 1.6;
}
```

#### Typography

- **Primary Font**: Monospace only
- **Font Size**: 14px base, scalable
- **Line Height**: 1.6 for readability
- **Font Weight**: Regular (400) and Bold (700)

#### Layout Principles

- **No Borders**: Use subtle backgrounds for separation
- **Minimal Padding**: Compact, information-dense
- **Fixed-width Characters**: Align content in columns
- **ASCII Decorations**: Use box-drawing characters (│ ─ ┌ ┐ └ ┘)
- **Status Bar**: Fixed bottom bar with system info
- **Title Bar**: Fixed top bar with navigation

### 5.3 Screen Layouts

#### Mobile Layout (Portrait - Primary)

```
┌────────────────────────┐
│  MusakoneV3            │  ← Compact header
├────────────────────────┤
│                        │
│  [Mini Player]         │  ← Collapsible player
│  ▶ Artist - Track      │     (tap to expand)
│  ━━━━━━━━━━━━━━━ 2:34  │
│                        │
├────────────────────────┤
│                        │
│  QUEUE                 │
│                        │
│  ▶ Current Track       │  ← Playing track
│    Artist Name  3:42   │     (highlighted)
│                        │
│  ≡ Next Track          │  ← Touch to play
│    Artist       4:15   │     Swipe for options
│                        │
│  ≡ Track 3             │
│    Artist       3:28   │
│                        │
│  [12 more...]          │
│                        │
│                        │
│         ↓ Pull         │  ← Scroll queue
│                        │
├────────────────────────┤
│ ♪Queue  📁Lib  🔍Search│  ← Bottom nav (fixed)
└────────────────────────┘
```

#### Mobile Player (Expanded - Full Screen)

```
┌────────────────────────┐
│   ↓  [Collapse]        │  ← Swipe down to minimize
├────────────────────────┤
│                        │
│   [Album Art Area]     │  ← Large touch target
│      or ASCII art      │
│                        │
│   Artist Name          │
│   Track Title          │
│   Album (2023)         │
│                        │
│  ━━━━━━●━━━━━━━━━━━━━  │  ← Large scrubber
│  2:34          5:12    │
│                        │
│  ┌──────────────────┐  │
│  │  ⏮   ⏸   ⏭      │  │  ← Large controls
│  └──────────────────┘  │     (56x56px minimum)
│                        │
│  🔀  🔁  ❤️  ⋮        │  ← Secondary actions
│                        │
│  Volume ████████░░ 80% │  ← Volume control
│                        │
│  NEXT IN QUEUE         │  ← Preview
│  Next Track • Artist   │
│                        │
└────────────────────────┘
```

#### Tablet/Desktop Layout (Landscape)

```
┌──────────────────────────────────────────────────────┐
│ MusakoneV3                          [Queue|Lib|Search]│
├──────────────────────────────────────────────────────┤
│                    │                                  │
│  [Player Panel]    │  QUEUE                           │
│                    │                                  │
│  Artist - Track    │  ▶ 1. Current     Artist   3:42  │
│  ━━━━━━━━━━━ 2:34  │    2. Next        Artist   4:15  │
│                    │    3. Track       Artist   3:28  │
│  ⏮  ⏸  ⏭         │                                  │
│                    │  [12 more tracks...]             │
│  Vol: ████░░ 80%   │                                  │
│                    │                                  │
│  [Album Info]      │                                  │
│                    │                                  │
└──────────────────────────────────────────────────────┘
```

#### Desktop Layout (Full)

```
┌─ MusakoneV3 ─────────────────────────────────────────┐
│ [Queue] [Library] [Playlists] [Search]    [User: x] │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ▶ Playing: Artist Name - Track Title               │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 3:24 │
│  Volume: ████████░░ 80%                              │
│                                                      │
├──────────────────────────────────────────────────────┤
│  QUEUE (12 tracks)                                   │
│  ┌────────────────────────────────────────────────┐ │
│  │ ▶ 1. Current Track          Artist      3:42  │ │
│  │   2. Next Track              Artist      4:15  │ │
│  │   3. Another Track           Artist      3:28  │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
└──────────────────────────────────────────────────────┘
│ [space] play/pause  [n]ext  [p]rev  [/] search  [?] help │
```

#### Library Browse

```
┌─ Library > Artists > Pink Floyd ─────────────────────┐
│                                                      │
│  Albums (8)                                          │
│  ┌────────────────────────────────────────────────┐ │
│  │ ▸ The Dark Side of the Moon (1973)    10 tracks│ │
│  │ ▸ Wish You Were Here (1975)            5 tracks│ │
│  │ ▸ Animals (1977)                       5 tracks│ │
│  │ ▸ The Wall (1979)                     26 tracks│ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│  [enter] open  [a] add to queue  [p] play now       │
└──────────────────────────────────────────────────────┘
```

### 5.4 Component Design (Mobile-First)

#### TrackList Component

- **Mobile**: Card-based layout, full width
  - Large touch targets (minimum 56px height)
  - Swipeable rows (left: delete, right: add to playlist)
  - Two-line display: Title / Artist • Duration
  - Drag handle for reordering (long press to activate)
  - Highlight playing track with accent color
- **Desktop**: Monospace table fallback
  - Columns: # | Artist | Title | Album | Duration
  - Keyboard navigation (j/k or arrows)

#### Player Controls

- **Mobile**: Large circular buttons (56x56px)
  - Previous, Play/Pause, Next in center
  - Shuffle, Repeat on sides (44x44px)
  - Large scrubber bar (48px height) for easy touch
  - Volume slider (full width, 48px height)
- **Desktop**: Compact ASCII art buttons
  - Keyboard controllable
  - Hover states

#### Bottom Navigation (Mobile Only)

- Fixed position bottom bar
- Three main sections: Queue | Library | Search
- Icons + labels
- Active state indication
- 64px height for comfortable thumb reach

#### Modal Dialogs

- **Mobile**: Bottom sheets (slide up from bottom)
  - Swipe down to dismiss
  - Backdrop tap to close
  - Full width on mobile
  - Rounded top corners
- **Desktop**: Centered modal
  - Keyboard dismissible (ESC)
  - Click outside to close
  - Dark overlay background

#### Mini Player (Mobile)

- Fixed bottom (above navigation)
- Swipe up to expand to full screen
- Swipe down to collapse
- Compact info: Play/Pause, Track, Artist, Progress
- Quick access without leaving current view

---

## 6. State Management Strategy

### 6.1 Store Structure (Nanostores)

```typescript
// stores/player.ts
import { atom, computed } from "nanostores";

export const playbackState = atom<"playing" | "paused" | "stopped">("stopped");
export const currentTrack = atom<Track | null>(null);
export const timePosition = atom<number>(0);
export const volume = atom<number>(100);
export const repeat = atom<"off" | "track" | "all">("off");
export const random = atom<boolean>(false);

export const isPlaying = computed(
  playbackState,
  (state) => state === "playing",
);

// stores/queue.ts
export const queue = atom<Track[]>([]);
export const queueVersion = atom<number>(0);

// stores/auth.ts
export const currentUser = atom<User | null>(null);
export const isAuthenticated = computed(currentUser, (user) => user !== null);

// stores/library.ts
export const currentPath = atom<string[]>([]);
export const libraryItems = atom<LibraryItem[]>([]);
```

### 6.2 Real-time Synchronization

```typescript
// services/mopidy/websocket.ts
class MopidyWebSocket {
  connect() {
    this.ws = new WebSocket("ws://localhost:6680/mopidy/ws");

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);

      if (message.event === "track_playback_started") {
        currentTrack.set(message.track);
        playbackState.set("playing");
      }

      if (message.event === "tracklist_changed") {
        // Refetch queue
        this.refreshQueue();
      }

      // ... handle other events
    };
  }
}
```

---

## 7. Input Methods

### 7.1 Touch Gestures (Primary - Mobile)

```
Player Controls:
  Tap play button       - Play/Pause
  Double-tap track      - Play now
  Swipe left on track   - Remove from queue
  Swipe right on track  - Add to playlist
  Pinch progress bar    - Fine seek control
  Long press track      - Show options menu

Navigation:
  Tap bottom nav        - Switch views (Queue/Library/Search)
  Swipe down            - Refresh current view
  Swipe up from bottom  - Expand mini player to full player
  Swipe down on player  - Collapse to mini player

Volume:
  Slide volume bar      - Adjust volume
  Tap volume icon       - Mute/Unmute

Queue Management:
  Drag handle           - Reorder tracks (long press + drag)
  Swipe left            - Quick remove
  Tap + icon            - Add to queue

Library:
  Tap item              - Open/Play
  Long press item       - Show context menu
  Pull to refresh       - Reload library
```

### 7.2 Keyboard Shortcuts (Secondary - Desktop)

```
Playback:
  space       - Play/Pause
  n           - Next track
  p           - Previous track
  s           - Stop
  r           - Toggle repeat mode
  z           - Toggle random mode
  +/-         - Volume up/down
  left/right  - Seek backward/forward

Navigation:
  1           - Go to Queue
  2           - Go to Library
  3           - Go to Playlists
  4           - Go to Search
  /           - Focus search
  ?           - Show help
  q           - Quit/Logout

List Navigation:
  j / ↓       - Move down
  k / ↑       - Move up
  g           - Go to top
  G           - Go to bottom
  enter       - Select/Open
  backspace   - Go back

Queue Management:
  a           - Add to queue
  d           - Remove from queue
  c           - Clear queue
  P           - Play now

General:
  esc         - Close modal/Cancel
  ctrl+c      - Copy
  ctrl+f      - Search in page
```

### 7.3 Implementation

```typescript
// hooks/useKeyboard.ts
export function useKeyboard(handlers: KeyboardHandlers) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (e.target instanceof HTMLInputElement) return;

      const key = e.key.toLowerCase();
      const ctrl = e.ctrlKey;
      const shift = e.shiftKey;

      if (key === " ") {
        e.preventDefault();
        handlers.togglePlay?.();
      }
      // ... more handlers
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlers]);
}
```

---

## 8. Authentication Implementation

### 8.1 Auth Flow

```
1. User visits app
2. Check for existing session/token
3. If not authenticated → redirect to /login
4. User enters credentials
5. POST /api/auth/login
6. Server validates credentials
7. Server returns JWT token
8. Store token in httpOnly cookie
9. Redirect to /player
10. All API calls include token
```

### 8.2 Auth Service

```typescript
// services/auth/auth.ts
class AuthService {
  async login(username: string, password: string): Promise<User> {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) throw new Error("Login failed");
    const data = (await response.json()) as AuthResponse;

    currentUser.set(data.user);
    this.storeToken(data.token);

    return data.user;
  }

  async logout(): Promise<void> {
    await fetch("/api/auth/logout", { method: "POST" });
    currentUser.set(null);
    this.clearToken();
  }

  async validateSession(): Promise<boolean> {
    try {
      const response = await fetch("/api/auth/me");
      if (!response.ok) return false;
      const user = (await response.json()) as User;
      currentUser.set(user);
      return true;
    } catch {
      return false;
    }
  }

  private storeToken(token: string): void {
    // Token stored in httpOnly cookie by server
    // Or localStorage for SPA-only mode
  }
}
```

### 8.3 Protected Routes

```typescript
// components/ProtectedRoute.tsx
function ProtectedRoute({ children }: { children: ComponentChildren }) {
  const user = useStore(currentUser);

  if (!user) {
    return <Redirect to="/login" />;
  }

  return <>{children}</>;
}
```

---

## 9. User Action Tracking

### 9.1 Tracking Service

```typescript
// services/analytics/tracker.ts
class UserTracker {
  private db: IDBDatabase;

  async track(action: UserAction): Promise<void> {
    const event = {
      id: crypto.randomUUID(),
      userId: currentUser.get()?.id,
      timestamp: Date.now(),
      action: action.type,
      metadata: action.data,
    };

    // Store locally
    await this.storeLocally(event);

    // Optionally send to server
    if (this.shouldSyncToServer()) {
      await this.syncToServer(event);
    }
  }

  async getHistory(userId: string, limit: number): Promise<UserAction[]> {
    // Query IndexedDB
    return this.queryDB({ userId, limit });
  }

  async getStats(userId: string): Promise<UserStats> {
    const actions = await this.getHistory(userId, 1000);

    return {
      totalPlays: actions.filter((a) => a.action === "play").length,
      totalSearches: actions.filter((a) => a.action === "search").length,
      topTracks: this.calculateTopTracks(actions),
      topArtists: this.calculateTopArtists(actions),
      listeningTime: this.calculateListeningTime(actions),
    };
  }
}
```

### 9.2 Tracked Events

```typescript
// Track on these events:
tracker.track({ type: "play", data: { trackUri, trackName } });
tracker.track({ type: "pause", data: { position, trackUri } });
tracker.track({ type: "skip", data: { fromTrack, toTrack, position } });
tracker.track({ type: "search", data: { query, resultsCount } });
tracker.track({ type: "queue_add", data: { trackUri, source } });
tracker.track({ type: "playlist_create", data: { name, trackCount } });
```

### 9.3 Privacy Considerations

- All data stored locally by default
- Optional server sync with user consent
- No external analytics (Google Analytics, etc.)
- User can clear their history
- Export data feature (JSON)

---

## 10. Performance Targets

### 10.1 Bundle Size Goals

- **Initial Bundle**: < 50KB (gzipped)
- **Total Assets**: < 150KB (gzipped)
- **First Contentful Paint**: < 1.5s (on 4G)
- **Time to Interactive**: < 3s (on 4G)
- **Largest Contentful Paint**: < 2.5s

### 10.2 Runtime Performance (Mobile Priority)

- **60fps** touch interactions and scrolling
- **< 16ms** per frame
- **< 100ms** response to touch input
- **< 300ms** total latency for any action
- Smooth scroll with momentum
- No jank during gestures
- Efficient touch event handling (passive listeners)

### 10.3 Mobile-Specific Metrics

- **Touch Response**: Immediate visual feedback (< 50ms)
- **List Scrolling**: Smooth 60fps with virtual scrolling
- **Network Resilience**: Work on slow 3G connections
- **Battery Efficient**: Minimize background activity
- **Offline Ready**: Core UI works without connection

### 10.3 Optimization Strategies

- Route-based code splitting
- Lazy load non-critical components
- Virtual scrolling for large lists (>500 items)
- Debounced search input
- Memoized computed values
- Web Workers for heavy computations

---

## 11. Development Workflow

### 11.1 Setup Instructions

#### Local Development (with Docker Compose)

```bash
# Start all services
docker-compose up -d

# Frontend will be available at http://localhost:3000
# Mopidy API at http://localhost:6680

# Watch frontend logs
docker-compose logs -f frontend

# Rebuild frontend after changes
docker-compose up -d --build frontend
```

#### Local Development (without Docker - frontend only)

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
bun install

# Start development server
bun dev

# Run tests
bun test

# Build for production
bun run build

# Preview production build
bun preview
```

#### Hot Reload Development

For faster development with hot reload:

```bash
# Start Mopidy only
docker-compose up -d mopidy

# Run frontend locally with hot reload
cd frontend
bun dev
```

### 11.2 Environment Variables

```env
# .env.example (root level for docker-compose)

# Mopidy Configuration
MOPIDY_HTTP_PORT=6680
MOPIDY_HTTP_HOSTNAME=0.0.0.0
MOPIDY_WS_HOSTNAME=0.0.0.0

# Music Library Path (host machine)
MUSIC_LIBRARY_PATH=/path/to/your/music

# Backend Configuration
BACKEND_PORT=3001
JWT_SECRET=your-secret-key-change-in-production
DATABASE_PATH=/app/data/analytics.db

# Frontend Configuration
FRONTEND_PORT=3000
VITE_BACKEND_URL=http://localhost:3001
VITE_BACKEND_WS=ws://localhost:3001/ws

# Optional: Spotify (if using Mopidy-Spotify)
SPOTIFY_USERNAME=
SPOTIFY_PASSWORD=
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=

# Optional: SoundCloud (if using Mopidy-SoundCloud)
SOUNDCLOUD_AUTH_TOKEN=
```

### 11.3 Scripts (package.json)

```json
{
  "scripts": {
    "dev": "bun run vite",
    "build": "bun run vite build",
    "preview": "bun run vite preview",
    "test": "bun test",
    "lint": "eslint src/",
    "format": "prettier --write src/",
    "type-check": "tsc --noEmit"
  }
}
```

---

## 12. Testing Strategy

### 12.1 Unit Tests

- Test utility functions
- Test state management
- Test pure components
- Use Bun's built-in test runner

### 12.2 Integration Tests

- Test Mopidy client integration
- Test authentication flow
- Test WebSocket connection handling
- Mock external dependencies

### 12.3 E2E Tests (Optional)

- Test critical user flows
- Use Playwright for browser automation
- Automated smoke tests

---

## 13. Docker Compose Deployment

### 13.1 Architecture Overview

The application uses Docker Compose to orchestrate two main services:

1. **Mopidy Backend**: Music server with HTTP API and WebSocket support
2. **Frontend**: Web application served via Bun static server

Both services communicate over a shared Docker network.

### 13.2 Docker Compose Configuration

```yaml
# docker-compose.yml
version: "3.8"

services:
  mopidy:
    image: wernight/mopidy:latest
    container_name: musakone-mopidy
    restart: unless-stopped
    ports:
      - "${MOPIDY_HTTP_PORT:-6680}:6680" # HTTP API
      - "6600:6600" # MPD protocol (optional)
    volumes:
      - ./mopidy/mopidy.conf:/config/mopidy.conf:ro
      - ./data/mopidy:/var/lib/mopidy
      - ${MUSIC_LIBRARY_PATH}:/media/music:ro
    environment:
      - PULSE_SERVER=tcp:host.docker.internal:4713
      - SPOTIFY_USERNAME=${SPOTIFY_USERNAME}
      - SPOTIFY_PASSWORD=${SPOTIFY_PASSWORD}
      - SPOTIFY_CLIENT_ID=${SPOTIFY_CLIENT_ID}
      - SPOTIFY_CLIENT_SECRET=${SPOTIFY_CLIENT_SECRET}
    networks:
      - musakone-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:6680/mopidy/rpc"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: musakone-frontend
    restart: unless-stopped
    ports:
      - "${FRONTEND_PORT:-3000}:3000"
    environment:
      - VITE_MOPIDY_HTTP_URL=http://mopidy:6680/mopidy
      - VITE_MOPIDY_WS_URL=ws://mopidy:6680/mopidy/ws
      - VITE_AUTH_ENABLED=${VITE_AUTH_ENABLED:-true}
      - VITE_TRACKING_ENABLED=${VITE_TRACKING_ENABLED:-true}
    depends_on:
      mopidy:
        condition: service_healthy
    networks:
      - musakone-network

networks:
  musakone-network:
    driver: bridge

volumes:
  mopidy-data:
    driver: local
```

### 13.3 Backend Dockerfile

```dockerfile
# backend/Dockerfile
FROM ghcr.io/gleam-lang/gleam:v1.0.0-erlang-alpine

WORKDIR /app

# Install SQLite
RUN apk add --no-cache sqlite-libs sqlite-dev

# Copy Gleam project files
COPY gleam.toml manifest.toml ./
COPY src ./src

# Build the application
RUN gleam build

# Create data directory
RUN mkdir -p /app/data

# Expose WebSocket port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Run the application
CMD ["gleam", "run"]
```

### 13.4 Frontend Dockerfile

```dockerfile
# frontend/Dockerfile
FROM oven/bun:latest as builder

WORKDIR /app

# Copy package files
COPY package.json bun.lockb ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build application
RUN bun run build

# Production stage - serve with Bun
FROM oven/bun:latest

WORKDIR /app

# Copy built assets
COPY --from=builder /app/dist ./dist

# Create simple static server script
RUN echo 'Bun.serve({ \
  port: 3000, \
  fetch(req) { \
    const url = new URL(req.url); \
    const filePath = url.pathname === "/" ? "/index.html" : url.pathname; \
    const file = Bun.file(`./dist${filePath}`); \
    return new Response(file); \
  } \
});' > server.js

# Expose port 3000
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

# Start server
CMD ["bun", "run", "server.js"]
```

### 13.5 Mopidy Configuration

```ini
# mopidy/mopidy.conf
[core]
cache_dir = /var/lib/mopidy/cache
config_dir = /config
data_dir = /var/lib/mopidy/data

[logging]
verbosity = 0
format = %(levelname)-8s %(asctime)s [%(process)d:%(threadName)s] %(name)s\n  %(message)s
color = true

[audio]
mixer = software
mixer_volume = 100
output = autoaudiosink

[http]
enabled = true
hostname = 0.0.0.0
port = 6680
zeroconf = Mopidy HTTP on $hostname
allowed_origins = *
csrf_protection = false

[file]
enabled = true
media_dirs = /media/music

[local]
enabled = true
media_dir = /media/music

[m3u]
enabled = true
base_dir = /media/music
default_encoding = utf-8
default_extension = .m3u8
playlists_dir = /var/lib/mopidy/playlists

# Optional: Spotify Extension
[spotify]
enabled = true
username = ${SPOTIFY_USERNAME}
password = ${SPOTIFY_PASSWORD}
client_id = ${SPOTIFY_CLIENT_ID}
client_secret = ${SPOTIFY_CLIENT_SECRET}

# Optional: SoundCloud Extension
[soundcloud]
enabled = false
auth_token = ${SOUNDCLOUD_AUTH_TOKEN}
```

### 13.6 Setup Instructions

```bash
# 1. Clone repository
git clone https://github.com/yourusername/musakoneV3.git
cd musakoneV3

# 2. Copy environment file and configure
cp .env.example .env
nano .env  # Edit with your settings

# 3. Set your music library path
# Edit .env and set MUSIC_LIBRARY_PATH=/path/to/your/music

# 4. Build and start services
docker-compose up -d

# 5. Check service status
docker-compose ps

# 6. View logs
docker-compose logs -f

# 7. Access the application
# Frontend: http://localhost:3000
# Mopidy HTTP API: http://localhost:6680
```

### 13.7 Common Commands

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# Rebuild frontend after changes
docker-compose up -d --build frontend

# View logs
docker-compose logs -f [service-name]

# Restart a service
docker-compose restart [service-name]

# Update Mopidy library
docker-compose exec mopidy mopidyctl local scan

# Access Mopidy shell
docker-compose exec mopidy bash

# Clean up everything (including volumes)
docker-compose down -v
```

### 13.8 Production Deployment

For production deployment, consider:

1. **Reverse Proxy**: Use external reverse proxy (Traefik, Caddy, nginx, etc.)
2. **SSL/TLS**: Enable HTTPS with Let's Encrypt (handled by reverse proxy)
3. **Domain**: Configure proper domain name
4. **Security**: Enable authentication, restrict CORS
5. **Backups**: Regular backup of data/mopidy volume
6. **Monitoring**: Add health checks and monitoring

```yaml
# docker-compose.prod.yml
version: "3.8"

services:
  mopidy:
    restart: always
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.mopidy.rule=Host(`api.yourdomain.com`)"
      - "traefik.http.routers.mopidy.tls.certresolver=letsencrypt"

  frontend:
    restart: always
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.frontend.rule=Host(`yourdomain.com`)"
      - "traefik.http.routers.frontend.tls.certresolver=letsencrypt"

  traefik:
    image: traefik:v2.10
    command:
      - "--api.insecure=false"
      - "--providers.docker=true"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge=true"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web"
      - "--certificatesresolvers.letsencrypt.acme.email=your@email.com"
      - "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - "/var/run/docker.sock:/var/run/docker.sock:ro"
      - "./letsencrypt:/letsencrypt"
    networks:
      - musakone-network
```

---

## 14. Implementation Phases

### Phase 0: Infrastructure Setup (Day 1-2)

- [x] Docker Compose configuration (3 services: backend, frontend, mopidy)
- [x] Mopidy container setup and configuration
- [x] Network and volume configuration
- [x] Environment variables setup
- [x] Shared protocol documentation (mopidy/MOPIDY_API.md)
- [x] Documentation for setup

### Phase 0.5: Backend Foundation (Day 3-4)

- [x] Gleam project setup
- [x] Backend Dockerfile
- [x] SQLite database schema for user tracking
- [x] JWT authentication implementation
- [x] WebSocket server (Mist)
- [x] Mopidy WebSocket client connection
- [x] Basic message routing (client → backend → mopidy)
- [x] User action logging
- [x] Health check endpoint

### Phase 1: Frontend Foundation (Week 1)

- [x] Frontend project setup with Bun
- [x] Frontend Dockerfile with static server
- [x] Mobile-first responsive layout system
- [x] Bottom navigation component
- [x] Terminal theme CSS (mobile-optimized)
- [x] Touch gesture handlers (framework ready)
- [x] Backend WebSocket client (connects to backend, not Mopidy directly)
- [x] Mobile player controls (large touch targets)
- [x] Verify full stack communication (client → backend → mopidy)
- [x] PWA manifest and service worker setup

### Phase 2: Core Features (Week 2)

- [ ] WebSocket integration
- [ ] Queue management
- [ ] Library browsing
- [ ] Search functionality

### Phase 3: Authentication (Week 3)

- [ ] Login screen
- [ ] Auth service implementation
- [ ] Protected routes
- [ ] Session management

### Phase 4: Advanced Features (Week 4)

- [ ] Playlist management
- [ ] User action tracking
- [ ] Statistics dashboard
- [ ] Settings page
- [ ] Help/shortcuts overlay

### Phase 5: Polish & Optimization (Week 5)

- [ ] Performance optimization
- [ ] Bundle size reduction
- [ ] Accessibility improvements
- [ ] Error handling
- [ ] Loading states

### Phase 6: Testing & Deployment (Week 6)

- [ ] Unit tests
- [ ] Integration tests
- [ ] Documentation
- [ ] Deployment setup
- [ ] CI/CD pipeline

---

## 15. Success Criteria

### Functional

- ✓ All playback controls working
- ✓ Real-time queue updates
- ✓ Library browsing works smoothly
- ✓ Search returns relevant results
- ✓ Authentication protects routes
- ✓ User actions are tracked

### Non-functional

- ✓ Bundle size < 50KB gzipped
- ✓ Page load < 2s on 4G mobile
- ✓ 60fps smooth touch interactions
- ✓ Touch targets minimum 44x44px
- ✓ Works perfectly on mobile browsers (iOS Safari, Chrome Android)
- ✓ PWA installable on home screen
- ✓ Responsive design (mobile-first → tablet → desktop)
- ✓ Keyboard navigation works on desktop

### User Experience (Mobile Priority)

- ✓ Feels like a native mobile app
- ✓ One-handed operation comfortable
- ✓ Fast and responsive on mobile
- ✓ Intuitive touch gestures
- ✓ Clear haptic/visual feedback for all actions
- ✓ Works well in clubroom lighting (high contrast)
- ✓ Quick access to queue controls
- ✓ Terminal aesthetic preserved on mobile

---

## 16. Future Enhancements (Post-MVP)

### Potential Features

- **Visualizations**: ASCII-art audio visualizer
- **Themes**: Multiple terminal color schemes
- **Lyrics**: Display synchronized lyrics
- **Podcasts**: Support for podcast extensions
- **Radio**: Internet radio support
- **Scrobbling**: Last.fm integration
- **Mobile**: Progressive Web App with touch support
- **Extensions**: Plugin system for custom features
- **Collaboration**: Shared queue for multiple users
- **Voice Control**: Basic voice commands

---

## 17. Technical Decisions & Rationale

### Why Preact?

- Smallest React-compatible library (3KB)
- Excellent performance
- Familiar API for React developers
- Active maintenance and community

### Why Nanostores?

- Tiny footprint (300 bytes)
- No boilerplate
- Framework-agnostic (future-proof)
- Simple atom/computed pattern

### Why Bun?

- Fastest JavaScript runtime
- Built-in bundler (no webpack/vite config needed)
- Native TypeScript support
- Package manager + runtime + bundler in one

### Why No CSS Framework?

- Terminal aesthetic requires custom styling
- Frameworks add unnecessary bloat
- Modern CSS is powerful enough
- Full control over appearance

### Why Monospace Only?

- Consistent with terminal theme
- Easier to create aligned layouts
- Distinctive visual identity
- Better for displaying structured data

---

## 18. API Specification

### Backend Endpoints (if separate backend needed)

```
POST   /api/auth/login          # Authenticate user
POST   /api/auth/logout         # End session
GET    /api/auth/me             # Get current user
POST   /api/auth/refresh        # Refresh token

GET    /api/analytics/events    # Get user events
POST   /api/analytics/events    # Log event (batch)
GET    /api/analytics/stats     # Get statistics

GET    /api/settings            # Get user settings
PUT    /api/settings            # Update settings
```

### Mopidy Proxy (Optional)

If Mopidy is not directly accessible, create a simple proxy:

```typescript
// server/mopidy-proxy.ts
import { serve } from "bun";

serve({
  port: 3000,

  async fetch(req) {
    const url = new URL(req.url);

    // Proxy to Mopidy
    if (url.pathname.startsWith("/mopidy")) {
      const mopidyUrl = `http://localhost:6680${url.pathname}`;
      return fetch(mopidyUrl, {
        method: req.method,
        headers: req.headers,
        body: req.body,
      });
    }

    // Handle auth/analytics endpoints
    // ...
  },
});
```

---

## 19. Accessibility Considerations

### Touch Accessibility

- **Touch Targets**: Minimum 44x44px (WCAG 2.5.5)
- **Spacing**: Adequate spacing between touch targets
- **Gestures**: Alternative methods for all gesture-based actions
- **Orientation**: Support both portrait and landscape
- **Motion**: Respect prefers-reduced-motion

### Keyboard Navigation (Desktop)

- All functionality accessible via keyboard
- Visible focus indicators
- Logical tab order
- Skip navigation links

### Screen Readers

- Semantic HTML
- ARIA labels where needed
- Live regions for dynamic content
- Alt text for images (if any)

### Visual

- High contrast text (WCAG AAA)
- Scalable text size
- No information conveyed by color alone
- Clear visual hierarchy

---

## 20. Browser Support

### Target Browsers (Mobile Priority)

- **Mobile Safari**: iOS 15+ (primary)
- **Chrome Android**: Last 2 versions (primary)
- **Samsung Internet**: Last 2 versions
- Chrome/Edge Desktop: Last 2 versions
- Firefox Desktop: Last 2 versions
- Safari Desktop: Last 2 versions

### Mobile-Specific Considerations

- Touch event handling
- Safe area insets (iPhone notch)
- Viewport height quirks (address bar)
- Pull-to-refresh conflicts
- Momentum scrolling
- PWA support

### Required Features

- ES2020+ JavaScript
- CSS Grid & Flexbox
- CSS Custom Properties
- WebSocket API
- Fetch API
- IndexedDB
- LocalStorage

---

## Appendix A: PWA Configuration

### Web App Manifest

```json
// frontend/public/manifest.json
{
  "name": "MusakoneV3",
  "short_name": "Musakone",
  "description": "Terminal-style music player for Mopidy",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0a0a0a",
  "theme_color": "#00ff88",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/icons/icon-72x72.png",
      "sizes": "72x72",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-96x96.png",
      "sizes": "96x96",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-128x128.png",
      "sizes": "128x128",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-144x144.png",
      "sizes": "144x144",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-152x152.png",
      "sizes": "152x152",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-384x384.png",
      "sizes": "384x384",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  "categories": ["music", "entertainment"],
  "screenshots": [
    {
      "src": "/screenshots/mobile-player.png",
      "sizes": "1170x2532",
      "type": "image/png",
      "form_factor": "narrow"
    },
    {
      "src": "/screenshots/tablet-library.png",
      "sizes": "1668x2388",
      "type": "image/png",
      "form_factor": "wide"
    }
  ]
}
```

### Service Worker (Basic)

```typescript
// frontend/public/sw.js
const CACHE_NAME = "musakone-v1";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/assets/index.js",
  "/assets/index.css",
  "/manifest.json",
];

// Install - cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }),
  );
});

// Fetch - network first, fallback to cache
self.addEventListener("fetch", (event) => {
  // Skip Mopidy API calls
  if (event.request.url.includes("/mopidy/")) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      }),
  );
});

// Activate - cleanup old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name)),
      );
    }),
  );
});
```

### iOS Meta Tags

```html
<!-- frontend/index.html -->
<head>
  <!-- PWA -->
  <link rel="manifest" href="/manifest.json" />
  <meta name="theme-color" content="#00ff88" />

  <!-- iOS -->
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta
    name="apple-mobile-web-app-status-bar-style"
    content="black-translucent"
  />
  <meta name="apple-mobile-web-app-title" content="Musakone" />
  <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />

  <!-- Viewport -->
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes, viewport-fit=cover"
  />

  <!-- Prevent zoom on double tap -->
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
  />
</head>
```

---

## Appendix B: Type Definitions

```typescript
// types/mopidy.ts

interface Track {
  uri: string;
  name: string;
  artists: Artist[];
  album: Album;
  length: number; // milliseconds
  track_no?: number;
}

interface Artist {
  uri: string;
  name: string;
}

interface Album {
  uri: string;
  name: string;
  artists: Artist[];
  date?: string;
}

interface TlTrack {
  tlid: number;
  track: Track;
}

interface SearchResult {
  uri: string;
  tracks: Track[];
  artists: Artist[];
  albums: Album[];
}

interface PlaybackState {
  state: "playing" | "paused" | "stopped";
  track: Track | null;
  time_position: number;
  volume: number;
  repeat: boolean;
  random: boolean;
  consume: boolean;
}
```

```typescript
// types/app.ts

interface User {
  id: string;
  username: string;
  email?: string;
  created_at: number;
}

interface UserAction {
  id: string;
  userId: string;
  timestamp: number;
  action: ActionType;
  metadata: Record<string, any>;
}

type ActionType =
  | "play"
  | "pause"
  | "skip"
  | "search"
  | "queue_add"
  | "playlist_create"
  | "playlist_modify"
  | "volume_change";

interface UserStats {
  totalPlays: number;
  totalSearches: number;
  topTracks: { track: Track; plays: number }[];
  topArtists: { artist: Artist; plays: number }[];
  listeningTime: number; // milliseconds
}

interface AppConfig {
  mopidyUrl: string;
  mopidyWsUrl: string;
  apiUrl: string;
  authEnabled: boolean;
  trackingEnabled: boolean;
}
```

---

## Appendix B: Example Component

```typescript
// components/player/Controls.tsx
import { h } from 'preact';
import { useStore } from '@nanostores/preact';
import { playbackState, currentTrack } from '../../stores/player';
import { useMopidy } from '../../hooks/useMopidy';
import styles from './Controls.module.css';

export function Controls() {
  const state = useStore(playbackState);
  const track = useStore(currentTrack);
  const mopidy = useMopidy();

  const handlePlayPause = () => {
    if (state === 'playing') {
      mopidy.pause();
    } else {
      mopidy.play();
    }
  };

  return (
    <div class={styles.controls}>
      <button
        onClick={() => mopidy.previous()}
        aria-label="Previous track"
      >
        ⏮ prev
      </button>

      <button
        onClick={handlePlayPause}
        aria-label={state === 'playing' ? 'Pause' : 'Play'}
      >
        {state === 'playing' ? '⏸ pause' : '▶ play'}
      </button>

      <button
        onClick={() => mopidy.next()}
        aria-label="Next track"
      >
        next ⏭
      </button>

      <button
        onClick={() => mopidy.stop()}
        aria-label="Stop playback"
      >
        ⏹ stop
      </button>
    </div>
  );
}
```

```css
/* components/player/Controls.module.css */
.controls {
  display: flex;
  gap: 0.5rem;
  padding: 0.5rem;
  background: var(--bg-secondary);
}

.controls button {
  padding: 0.5rem 1rem;
  background: var(--bg-tertiary);
  color: var(--fg-primary);
  border: 1px solid var(--border-primary);
  font-family: var(--font-mono);
  font-size: var(--font-size-base);
  cursor: pointer;
  transition: all 0.1s;
}

.controls button:hover {
  background: var(--bg-hover);
  color: var(--accent-primary);
}

.controls button:active {
  background: var(--bg-active);
}

.controls button:focus-visible {
  outline: 2px solid var(--accent-primary);
  outline-offset: 2px;
}
```

---

## Document History

- **Version 1.0** - Initial design specification (2026-01-17)
- **Author**: GitHub Copilot
- **Status**: Ready for implementation

---

_This specification is a living document and should be updated as the project evolves._
