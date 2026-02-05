-- Replace single-table user_actions with normalized tables
-- optimized for ML training on different action types.
--
-- Three tables, each capturing the fields that actually
-- matter for that category of user behavior:
--
--   playback_events  – play, pause, resume, stop, skip, seek, volume
--   queue_events     – add, remove, clear, shuffle, move
--   search_events    – search queries and result interactions

-- ── Keep old table as backup during migration ──────────────────────
ALTER TABLE user_actions RENAME TO user_actions_v2_backup;


-- ── 1. Playback events ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS playback_events (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL,
    timestamp_ms INTEGER NOT NULL, -- unix ms, sub-second precision

    -- What happened
    -- Commands:  play, pause, resume, stop, next, previous, seek, volume,
    --            set_repeat, set_random, set_single, set_consume
    event_type   TEXT NOT NULL,

    -- Track context (NULL when no track is involved)
    track_uri    TEXT,
    track_name   TEXT,
    artist_name  TEXT,
    album_name   TEXT,
    track_duration_ms INTEGER,

    -- Playback position at time of event (ms into track)
    position_ms  INTEGER,

    -- For seek events: where they seeked to
    seek_to_ms   INTEGER,

    -- For volume events: new volume level 0-100
    volume_level INTEGER,

    -- Repeat/random/single/consume state at time of event
    -- Stored as a compact string like "rz__" (repeat+random on, single+consume off)
    playback_flags TEXT,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ML query patterns: user behavior sequences, listening duration calc
CREATE INDEX IF NOT EXISTS idx_pb_user_time
    ON playback_events(user_id, timestamp_ms);
CREATE INDEX IF NOT EXISTS idx_pb_event_type
    ON playback_events(event_type);
CREATE INDEX IF NOT EXISTS idx_pb_track
    ON playback_events(track_uri);
CREATE INDEX IF NOT EXISTS idx_pb_timestamp
    ON playback_events(timestamp_ms);


-- ── 2. Queue events ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS queue_events (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL,
    timestamp_ms INTEGER NOT NULL,

    -- add, add_at_position, remove, clear, shuffle, move
    event_type   TEXT NOT NULL,

    -- For add/remove: which tracks
    track_uris   TEXT,      -- JSON array of URIs, e.g. ["local:track:foo.mp3"]
    track_names  TEXT,      -- JSON array of names for readability

    -- Position context
    at_position  INTEGER,   -- insertion position (for add_at_position)
    from_position INTEGER,  -- move: source index
    to_position  INTEGER,   -- move: destination index

    -- Queue state at time of event
    queue_length INTEGER,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_qe_user_time
    ON queue_events(user_id, timestamp_ms);
CREATE INDEX IF NOT EXISTS idx_qe_event_type
    ON queue_events(event_type);


-- ── 3. Search events ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS search_events (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL,
    timestamp_ms INTEGER NOT NULL,

    -- query, browse
    event_type   TEXT NOT NULL,

    -- Search context
    query_text   TEXT,          -- the search string
    browse_uri   TEXT,          -- library URI being browsed

    -- Results summary (for learning-to-rank)
    result_count INTEGER,       -- total results returned

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_se_user_time
    ON search_events(user_id, timestamp_ms);
CREATE INDEX IF NOT EXISTS idx_se_query
    ON search_events(query_text);


-- ── Migrate old data ───────────────────────────────────────────────
-- Best-effort migration of the flat table into the new schema.
-- action_type values from old table map roughly:
--   play/pause/resume/stop/next/previous/seek/volume → playback_events
--   add/remove/clear/shuffle                          → queue_events
--   search/browse                                     → search_events

INSERT INTO playback_events (user_id, timestamp_ms, event_type, track_uri, track_name)
SELECT user_id, timestamp * 1000, action_type, track_uri, track_name
FROM user_actions_v2_backup
WHERE action_type IN ('play', 'pause', 'resume', 'stop', 'next', 'previous', 'seek', 'volume');

INSERT INTO queue_events (user_id, timestamp_ms, event_type, track_uris, track_names)
SELECT user_id, timestamp * 1000, action_type,
    CASE WHEN track_uri IS NOT NULL THEN '["' || track_uri || '"]' ELSE NULL END,
    CASE WHEN track_name IS NOT NULL THEN '["' || track_name || '"]' ELSE NULL END
FROM user_actions_v2_backup
WHERE action_type IN ('add', 'remove', 'clear', 'shuffle');

INSERT INTO search_events (user_id, timestamp_ms, event_type, query_text)
SELECT user_id, timestamp * 1000, action_type, metadata
FROM user_actions_v2_backup
WHERE action_type IN ('search', 'browse');

DROP TABLE user_actions_v2_backup;
