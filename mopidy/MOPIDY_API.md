# Mopidy WebSocket API Reference

All messages are JSON. Events have `"event"` field, JSON-RPC responses have `"jsonrpc"` field.

---

## WebSocket Events (TypeScript)

```typescript
// Event base type
type MopidyEvent = 
  | TrackPlaybackStarted
  | TrackPlaybackPaused
  | TrackPlaybackResumed
  | TrackPlaybackEnded
  | PlaybackStateChanged
  | Seeked
  | StreamTitleChanged
  | VolumeChanged
  | MuteChanged
  | TracklistChanged
  | OptionsChanged
  | PlaylistsLoaded
  | PlaylistChanged
  | PlaylistDeleted;

// Playback Events
interface TrackPlaybackStarted {
  event: "track_playback_started";
  tl_track: TlTrack;
}

interface TrackPlaybackPaused {
  event: "track_playback_paused";
  tl_track: TlTrack;
  time_position: number; // milliseconds
}

interface TrackPlaybackResumed {
  event: "track_playback_resumed";
  tl_track: TlTrack;
  time_position: number; // milliseconds
}

interface TrackPlaybackEnded {
  event: "track_playback_ended";
  tl_track: TlTrack;
  time_position: number; // milliseconds
}

interface PlaybackStateChanged {
  event: "playback_state_changed";
  old_state: PlaybackState;
  new_state: PlaybackState;
}

interface Seeked {
  event: "seeked";
  time_position: number; // milliseconds
}

interface StreamTitleChanged {
  event: "stream_title_changed";
  title: string;
}

// Volume Events
interface VolumeChanged {
  event: "volume_changed";
  volume: number; // 0-100
}

interface MuteChanged {
  event: "mute_changed";
  mute: boolean;
}

// Tracklist Events
interface TracklistChanged {
  event: "tracklist_changed";
}

interface OptionsChanged {
  event: "options_changed";
}

// Playlist Events
interface PlaylistsLoaded {
  event: "playlists_loaded";
}

interface PlaylistChanged {
  event: "playlist_changed";
  playlist: Playlist;
}

interface PlaylistDeleted {
  event: "playlist_deleted";
  uri: string;
}

// Data Types
type PlaybackState = "stopped" | "playing" | "paused";

interface TlTrack {
  tlid: number;
  track: Track;
}

interface Track {
  uri: string;
  name: string;
  artists?: Artist[];
  album?: Album;
  length?: number; // milliseconds
  track_no?: number;
  disc_no?: number;
  date?: string;
  genre?: string;
  bitrate?: number;
  comment?: string;
  musicbrainz_id?: string;
  last_modified?: number;
  composers?: Artist[];
  performers?: Artist[];
}

interface Artist {
  uri: string;
  name: string;
  sortname?: string;
  musicbrainz_id?: string;
}

interface Album {
  uri: string;
  name: string;
  artists?: Artist[];
  num_tracks?: number;
  num_discs?: number;
  date?: string;
  musicbrainz_id?: string;
}

interface Playlist {
  uri: string;
  name: string;
  tracks?: Track[];
  last_modified?: number;
  length?: number;
}

interface Ref {
  uri: string;
  name: string;
  type: "album" | "artist" | "directory" | "playlist" | "track";
}

interface SearchResult {
  uri?: string;
  tracks?: Track[];
  artists?: Artist[];
  albums?: Album[];
}

interface Image {
  uri: string;
  width?: number;
  height?: number;
}
```

---

## JSON-RPC Methods

**Request format:**
```json
{"jsonrpc": "2.0", "id": 1, "method": "core.method.name", "params": {...}}
```

**Response format:**
```json
{"jsonrpc": "2.0", "id": 1, "result": ...}
```

### Core

- `core.get_uri_schemes()` → `string[]`
- `core.get_version()` → `string`

### Playback Controller

- `core.playback.play(tlid?: number)` → `null`
- `core.playback.next()` → `null`
- `core.playback.previous()` → `null`
- `core.playback.stop()` → `null`
- `core.playback.pause()` → `null`
- `core.playback.resume()` → `null`
- `core.playback.seek(time_position: number)` → `boolean`
- `core.playback.get_current_tl_track()` → `TlTrack | null`
- `core.playback.get_current_track()` → `Track | null`
- `core.playback.get_current_tlid()` → `number | null`
- `core.playback.get_stream_title()` → `string | null`
- `core.playback.get_time_position()` → `number`
- `core.playback.get_state()` → `PlaybackState`
- `core.playback.set_state(new_state: PlaybackState)` → `null`

### Tracklist Controller

**Manipulating:**
- `core.tracklist.add(uris?: string[], at_position?: number)` → `TlTrack[]`
- `core.tracklist.remove(criteria: {[key: string]: any[]})` → `TlTrack[]`
- `core.tracklist.clear()` → `null`
- `core.tracklist.move(start: number, end: number, to_position: number)` → `null`
- `core.tracklist.shuffle(start?: number, end?: number)` → `null`

**Current state:**
- `core.tracklist.get_tl_tracks()` → `TlTrack[]`
- `core.tracklist.index(tlid?: number)` → `number | null`
- `core.tracklist.get_version()` → `number`
- `core.tracklist.get_length()` → `number`
- `core.tracklist.get_tracks()` → `Track[]`
- `core.tracklist.slice(start: number, end: number)` → `TlTrack[]`
- `core.tracklist.filter(criteria: {[key: string]: any[]})` → `TlTrack[]`

**Future state:**
- `core.tracklist.get_eot_tlid()` → `number | null`
- `core.tracklist.get_next_tlid()` → `number | null`
- `core.tracklist.get_previous_tlid()` → `number | null`

**Options:**
- `core.tracklist.get_consume()` → `boolean`
- `core.tracklist.set_consume(value: boolean)` → `null`
- `core.tracklist.get_random()` → `boolean`
- `core.tracklist.set_random(value: boolean)` → `null`
- `core.tracklist.get_repeat()` → `boolean`
- `core.tracklist.set_repeat(value: boolean)` → `null`
- `core.tracklist.get_single()` → `boolean`
- `core.tracklist.set_single(value: boolean)` → `null`

### Library Controller

- `core.library.browse(uri: string | null)` → `Ref[]`
- `core.library.search(query: {[field: string]: string[]}, uris?: string[], exact?: boolean)` → `SearchResult[]`
- `core.library.lookup(uris: string[])` → `{[uri: string]: Track[]}`
- `core.library.refresh(uri?: string)` → `null`
- `core.library.get_images(uris: string[])` → `{[uri: string]: Image[]}`
- `core.library.get_distinct(field: string, query?: {[key: string]: string[]})` → `Set<any>`

### Playlists Controller

- `core.playlists.as_list()` → `Ref[]`
- `core.playlists.get_items(uri: string)` → `Ref[] | null`
- `core.playlists.lookup(uri: string)` → `Playlist | null`
- `core.playlists.refresh(uri_scheme?: string)` → `null`
- `core.playlists.create(name: string, uri_scheme?: string)` → `Playlist | null`
- `core.playlists.save(playlist: Playlist)` → `Playlist | null`
- `core.playlists.delete(uri: string)` → `boolean`
- `core.playlists.get_uri_schemes()` → `string[]`

### Mixer Controller

- `core.mixer.get_volume()` → `number | null` (0-100)
- `core.mixer.set_volume(volume: number)` → `boolean`
- `core.mixer.get_mute()` → `boolean | null`
- `core.mixer.set_mute(mute: boolean)` → `boolean`

### History Controller

- `core.history.get_history()` → `[number, Ref][]` (timestamp, track pairs)
- `core.history.get_length()` → `number`
