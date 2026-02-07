-- Global playback state log: server-side ground truth of every Mopidy
-- state transition. Unlike playback_events (user commands only), this
-- captures ALL changes including those from external sources (MPD clients,
-- other UIs). Attribution via user_id (NULL = external/unattributed).

CREATE TABLE IF NOT EXISTS playback_state_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp_ms    INTEGER NOT NULL,

    -- What happened
    -- track_started, track_ended, paused, resumed, seeked,
    -- volume, tracklist_changed
    event_type      TEXT NOT NULL,

    -- Track context (NULL when not applicable)
    track_uri       TEXT,
    track_name      TEXT,
    artist_name     TEXT,
    album_name      TEXT,
    track_duration_ms INTEGER,

    -- State values at time of event
    position_ms     INTEGER,
    volume_level    INTEGER,
    queue_length    INTEGER,

    -- Attribution: who caused this state change?
    -- NULL = external source (MPD client, another UI, auto-advance)
    user_id         INTEGER,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Query patterns: "what was playing at time X?", timeline views
CREATE INDEX IF NOT EXISTS idx_psl_timestamp
    ON playback_state_log(timestamp_ms);

-- Filter by event type (e.g. only track changes)
CREATE INDEX IF NOT EXISTS idx_psl_event_type
    ON playback_state_log(event_type);

-- Track history for a specific track
CREATE INDEX IF NOT EXISTS idx_psl_track_uri
    ON playback_state_log(track_uri);

-- Attribution queries: "what did user X cause?"
CREATE INDEX IF NOT EXISTS idx_psl_user_id
    ON playback_state_log(user_id);
