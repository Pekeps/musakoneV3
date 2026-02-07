-- ML-ready tracking tables: track features, user affinities, sessions,
-- and search conversion tracking for future recommendation engine.

-- Extended track metadata beyond what playback_events stores.
-- Upserted on every play/skip to keep play_count/skip_count current.
CREATE TABLE IF NOT EXISTS track_features (
    uri             TEXT PRIMARY KEY,
    name            TEXT,
    artist_name     TEXT,
    album_name      TEXT,
    duration_ms     INTEGER,
    genre           TEXT,
    release_date    TEXT,
    musicbrainz_id  TEXT,
    track_no        INTEGER,
    disc_no         INTEGER,
    first_seen_ms   INTEGER NOT NULL,
    play_count      INTEGER NOT NULL DEFAULT 0,
    skip_count      INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_tf_artist ON track_features(artist_name);
CREATE INDEX IF NOT EXISTS idx_tf_genre ON track_features(genre);
CREATE INDEX IF NOT EXISTS idx_tf_play_count ON track_features(play_count DESC);

-- Per-user, per-track aggregated preference signal.
-- Upserted atomically via ON CONFLICT DO UPDATE with affinity_score
-- recomputed in SQL to avoid read-modify-write races.
CREATE TABLE IF NOT EXISTS user_track_affinity (
    user_id             INTEGER NOT NULL,
    track_uri           TEXT NOT NULL,
    play_count          INTEGER NOT NULL DEFAULT 0,
    total_listen_ms     INTEGER NOT NULL DEFAULT 0,
    avg_listen_pct      REAL NOT NULL DEFAULT 0.0,
    queue_add_count     INTEGER NOT NULL DEFAULT 0,
    queue_move_closer   INTEGER NOT NULL DEFAULT 0,
    skip_count          INTEGER NOT NULL DEFAULT 0,
    early_skip_count    INTEGER NOT NULL DEFAULT 0,
    queue_remove_count  INTEGER NOT NULL DEFAULT 0,
    affinity_score      REAL NOT NULL DEFAULT 0.0,
    last_interaction_ms INTEGER NOT NULL,
    PRIMARY KEY (user_id, track_uri),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_uta_affinity
    ON user_track_affinity(user_id, affinity_score DESC);

-- Per-user, per-artist aggregated signal (denser than track-level).
CREATE TABLE IF NOT EXISTS user_artist_affinity (
    user_id         INTEGER NOT NULL,
    artist_name     TEXT NOT NULL,
    play_count      INTEGER NOT NULL DEFAULT 0,
    skip_count      INTEGER NOT NULL DEFAULT 0,
    total_listen_ms INTEGER NOT NULL DEFAULT 0,
    affinity_score  REAL NOT NULL DEFAULT 0.0,
    PRIMARY KEY (user_id, artist_name),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_uaa_affinity
    ON user_artist_affinity(user_id, affinity_score DESC);

-- Temporal grouping of user activity. Session boundary = 5 min inactivity.
CREATE TABLE IF NOT EXISTS listening_sessions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL,
    started_ms      INTEGER NOT NULL,
    ended_ms        INTEGER,
    track_count     INTEGER NOT NULL DEFAULT 0,
    hour_of_day     INTEGER,
    day_of_week     INTEGER,
    dominant_genre  TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ls_user_started
    ON listening_sessions(user_id, started_ms DESC);

-- Links search queries to resulting queue additions.
-- Logged when a user adds a track within 30s of searching.
CREATE TABLE IF NOT EXISTS search_conversions (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id             INTEGER NOT NULL,
    timestamp_ms        INTEGER NOT NULL,
    query_text          TEXT,
    result_uri          TEXT,
    result_position     INTEGER,
    action              TEXT NOT NULL,
    time_to_action_ms   INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sc_query ON search_conversions(query_text);
CREATE INDEX IF NOT EXISTS idx_sc_uri ON search_conversions(result_uri);
