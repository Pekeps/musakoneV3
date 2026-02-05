import gleam/dynamic/decode
import gleam/option.{type Option}
import gleam/result
import sqlight

pub type User {
  User(id: Int, username: String, created_at: Int, last_login: Option(Int))
}

/// Get user by username and password hash
pub fn get_user_by_username_and_password(
  db: sqlight.Connection,
  username: String,
  password_hash: String,
) -> Result(List(User), sqlight.Error) {
  let sql =
    "SELECT id, username, created_at, last_login
FROM users
WHERE username = ? AND password_hash = ?"

  sqlight.query(
    sql,
    db,
    [sqlight.text(username), sqlight.text(password_hash)],
    user_decoder(),
  )
}

/// Get user by username only
pub fn get_user_by_username(
  db: sqlight.Connection,
  username: String,
) -> Result(List(User), sqlight.Error) {
  let sql =
    "SELECT id, username, created_at, last_login
FROM users
WHERE username = ?"

  sqlight.query(sql, db, [sqlight.text(username)], user_decoder())
}

/// Get user by ID
pub fn get_user_by_id(
  db: sqlight.Connection,
  user_id: Int,
) -> Result(List(User), sqlight.Error) {
  let sql =
    "SELECT id, username, created_at, last_login
FROM users
WHERE id = ?"

  sqlight.query(sql, db, [sqlight.int(user_id)], user_decoder())
}

/// Create a new user
pub fn create_user(
  db: sqlight.Connection,
  username: String,
  password_hash: String,
  created_at: Int,
) -> Result(List(User), sqlight.Error) {
  let sql =
    "INSERT INTO users (username, password_hash, created_at)
VALUES (?, ?, ?)
RETURNING id, username, created_at, last_login"

  sqlight.query(
    sql,
    db,
    [
      sqlight.text(username),
      sqlight.text(password_hash),
      sqlight.int(created_at),
    ],
    user_decoder(),
  )
}

/// Update user's last login timestamp
pub fn update_last_login(
  db: sqlight.Connection,
  user_id: Int,
  last_login: Option(Int),
) -> Result(Nil, sqlight.Error) {
  let sql =
    "UPDATE users
SET last_login = ?
WHERE id = ?"

  sqlight.query(
    sql,
    db,
    [sqlight.nullable(sqlight.int, last_login), sqlight.int(user_id)],
    decode.dynamic,
  )
  |> result.map(fn(_) { Nil })
}

fn user_decoder() -> decode.Decoder(User) {
  use id <- decode.field(0, decode.int)
  use username <- decode.field(1, decode.string)
  use created_at <- decode.field(2, decode.int)
  use last_login <- decode.field(3, decode.optional(decode.int))
  decode.success(User(id:, username:, created_at:, last_login:))
}

// ============================================================================
// PLAYBACK EVENT TRACKING
// ============================================================================

pub type PlaybackEvent {
  PlaybackEvent(
    id: Int,
    user_id: Int,
    timestamp_ms: Int,
    event_type: String,
    track_uri: Option(String),
    track_name: Option(String),
    artist_name: Option(String),
    album_name: Option(String),
    track_duration_ms: Option(Int),
    position_ms: Option(Int),
    seek_to_ms: Option(Int),
    volume_level: Option(Int),
    playback_flags: Option(String),
  )
}

/// Insert a playback event
pub fn log_playback_event(
  db: sqlight.Connection,
  user_id: Int,
  timestamp_ms: Int,
  event_type: String,
  track_uri: Option(String),
  track_name: Option(String),
  artist_name: Option(String),
  album_name: Option(String),
  track_duration_ms: Option(Int),
  position_ms: Option(Int),
  seek_to_ms: Option(Int),
  volume_level: Option(Int),
  playback_flags: Option(String),
) -> Result(Nil, sqlight.Error) {
  let sql =
    "INSERT INTO playback_events
     (user_id, timestamp_ms, event_type, track_uri, track_name,
      artist_name, album_name, track_duration_ms, position_ms,
      seek_to_ms, volume_level, playback_flags)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"

  sqlight.query(
    sql,
    db,
    [
      sqlight.int(user_id),
      sqlight.int(timestamp_ms),
      sqlight.text(event_type),
      sqlight.nullable(sqlight.text, track_uri),
      sqlight.nullable(sqlight.text, track_name),
      sqlight.nullable(sqlight.text, artist_name),
      sqlight.nullable(sqlight.text, album_name),
      sqlight.nullable(sqlight.int, track_duration_ms),
      sqlight.nullable(sqlight.int, position_ms),
      sqlight.nullable(sqlight.int, seek_to_ms),
      sqlight.nullable(sqlight.int, volume_level),
      sqlight.nullable(sqlight.text, playback_flags),
    ],
    decode.dynamic,
  )
  |> result.map(fn(_) { Nil })
}

/// Get playback events for a user (newest first)
pub fn get_playback_events(
  db: sqlight.Connection,
  user_id: Int,
  limit: Int,
) -> Result(List(PlaybackEvent), sqlight.Error) {
  let sql =
    "SELECT id, user_id, timestamp_ms, event_type,
       track_uri, track_name, artist_name, album_name, track_duration_ms,
       position_ms, seek_to_ms, volume_level, playback_flags
     FROM playback_events
     WHERE user_id = ?
     ORDER BY timestamp_ms DESC
     LIMIT ?"

  sqlight.query(
    sql,
    db,
    [sqlight.int(user_id), sqlight.int(limit)],
    playback_event_decoder(),
  )
}

/// Export all playback events for ML training (chronological, paginated)
pub fn export_playback_events(
  db: sqlight.Connection,
  offset: Int,
  limit: Int,
) -> Result(List(PlaybackEvent), sqlight.Error) {
  let sql =
    "SELECT id, user_id, timestamp_ms, event_type,
       track_uri, track_name, artist_name, album_name, track_duration_ms,
       position_ms, seek_to_ms, volume_level, playback_flags
     FROM playback_events
     ORDER BY timestamp_ms ASC
     LIMIT ? OFFSET ?"

  sqlight.query(
    sql,
    db,
    [sqlight.int(limit), sqlight.int(offset)],
    playback_event_decoder(),
  )
}

fn playback_event_decoder() -> decode.Decoder(PlaybackEvent) {
  use id <- decode.field(0, decode.int)
  use user_id <- decode.field(1, decode.int)
  use timestamp_ms <- decode.field(2, decode.int)
  use event_type <- decode.field(3, decode.string)
  use track_uri <- decode.field(4, decode.optional(decode.string))
  use track_name <- decode.field(5, decode.optional(decode.string))
  use artist_name <- decode.field(6, decode.optional(decode.string))
  use album_name <- decode.field(7, decode.optional(decode.string))
  use track_duration_ms <- decode.field(8, decode.optional(decode.int))
  use position_ms <- decode.field(9, decode.optional(decode.int))
  use seek_to_ms <- decode.field(10, decode.optional(decode.int))
  use volume_level <- decode.field(11, decode.optional(decode.int))
  use playback_flags <- decode.field(12, decode.optional(decode.string))
  decode.success(PlaybackEvent(
    id:,
    user_id:,
    timestamp_ms:,
    event_type:,
    track_uri:,
    track_name:,
    artist_name:,
    album_name:,
    track_duration_ms:,
    position_ms:,
    seek_to_ms:,
    volume_level:,
    playback_flags:,
  ))
}

// ============================================================================
// QUEUE EVENT TRACKING
// ============================================================================

pub type QueueEvent {
  QueueEvent(
    id: Int,
    user_id: Int,
    timestamp_ms: Int,
    event_type: String,
    track_uris: Option(String),
    track_names: Option(String),
    at_position: Option(Int),
    from_position: Option(Int),
    to_position: Option(Int),
    queue_length: Option(Int),
  )
}

/// Insert a queue event
pub fn log_queue_event(
  db: sqlight.Connection,
  user_id: Int,
  timestamp_ms: Int,
  event_type: String,
  track_uris: Option(String),
  track_names: Option(String),
  at_position: Option(Int),
  from_position: Option(Int),
  to_position: Option(Int),
  queue_length: Option(Int),
) -> Result(Nil, sqlight.Error) {
  let sql =
    "INSERT INTO queue_events
     (user_id, timestamp_ms, event_type, track_uris, track_names,
      at_position, from_position, to_position, queue_length)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"

  sqlight.query(
    sql,
    db,
    [
      sqlight.int(user_id),
      sqlight.int(timestamp_ms),
      sqlight.text(event_type),
      sqlight.nullable(sqlight.text, track_uris),
      sqlight.nullable(sqlight.text, track_names),
      sqlight.nullable(sqlight.int, at_position),
      sqlight.nullable(sqlight.int, from_position),
      sqlight.nullable(sqlight.int, to_position),
      sqlight.nullable(sqlight.int, queue_length),
    ],
    decode.dynamic,
  )
  |> result.map(fn(_) { Nil })
}

/// Get queue events for a user
pub fn get_queue_events(
  db: sqlight.Connection,
  user_id: Int,
  limit: Int,
) -> Result(List(QueueEvent), sqlight.Error) {
  let sql =
    "SELECT id, user_id, timestamp_ms, event_type,
       track_uris, track_names, at_position,
       from_position, to_position, queue_length
     FROM queue_events
     WHERE user_id = ?
     ORDER BY timestamp_ms DESC
     LIMIT ?"

  sqlight.query(
    sql,
    db,
    [sqlight.int(user_id), sqlight.int(limit)],
    queue_event_decoder(),
  )
}

/// Export all queue events for ML training
pub fn export_queue_events(
  db: sqlight.Connection,
  offset: Int,
  limit: Int,
) -> Result(List(QueueEvent), sqlight.Error) {
  let sql =
    "SELECT id, user_id, timestamp_ms, event_type,
       track_uris, track_names, at_position,
       from_position, to_position, queue_length
     FROM queue_events
     ORDER BY timestamp_ms ASC
     LIMIT ? OFFSET ?"

  sqlight.query(
    sql,
    db,
    [sqlight.int(limit), sqlight.int(offset)],
    queue_event_decoder(),
  )
}

fn queue_event_decoder() -> decode.Decoder(QueueEvent) {
  use id <- decode.field(0, decode.int)
  use user_id <- decode.field(1, decode.int)
  use timestamp_ms <- decode.field(2, decode.int)
  use event_type <- decode.field(3, decode.string)
  use track_uris <- decode.field(4, decode.optional(decode.string))
  use track_names <- decode.field(5, decode.optional(decode.string))
  use at_position <- decode.field(6, decode.optional(decode.int))
  use from_position <- decode.field(7, decode.optional(decode.int))
  use to_position <- decode.field(8, decode.optional(decode.int))
  use queue_length <- decode.field(9, decode.optional(decode.int))
  decode.success(QueueEvent(
    id:,
    user_id:,
    timestamp_ms:,
    event_type:,
    track_uris:,
    track_names:,
    at_position:,
    from_position:,
    to_position:,
    queue_length:,
  ))
}

// ============================================================================
// SEARCH EVENT TRACKING
// ============================================================================

pub type SearchEvent {
  SearchEvent(
    id: Int,
    user_id: Int,
    timestamp_ms: Int,
    event_type: String,
    query_text: Option(String),
    browse_uri: Option(String),
    result_count: Option(Int),
  )
}

/// Insert a search/browse event
pub fn log_search_event(
  db: sqlight.Connection,
  user_id: Int,
  timestamp_ms: Int,
  event_type: String,
  query_text: Option(String),
  browse_uri: Option(String),
  result_count: Option(Int),
) -> Result(Nil, sqlight.Error) {
  let sql =
    "INSERT INTO search_events
     (user_id, timestamp_ms, event_type, query_text, browse_uri, result_count)
     VALUES (?, ?, ?, ?, ?, ?)"

  sqlight.query(
    sql,
    db,
    [
      sqlight.int(user_id),
      sqlight.int(timestamp_ms),
      sqlight.text(event_type),
      sqlight.nullable(sqlight.text, query_text),
      sqlight.nullable(sqlight.text, browse_uri),
      sqlight.nullable(sqlight.int, result_count),
    ],
    decode.dynamic,
  )
  |> result.map(fn(_) { Nil })
}

/// Get search events for a user
pub fn get_search_events(
  db: sqlight.Connection,
  user_id: Int,
  limit: Int,
) -> Result(List(SearchEvent), sqlight.Error) {
  let sql =
    "SELECT id, user_id, timestamp_ms, event_type,
       query_text, browse_uri, result_count
     FROM search_events
     WHERE user_id = ?
     ORDER BY timestamp_ms DESC
     LIMIT ?"

  sqlight.query(
    sql,
    db,
    [sqlight.int(user_id), sqlight.int(limit)],
    search_event_decoder(),
  )
}

/// Export all search events for ML training
pub fn export_search_events(
  db: sqlight.Connection,
  offset: Int,
  limit: Int,
) -> Result(List(SearchEvent), sqlight.Error) {
  let sql =
    "SELECT id, user_id, timestamp_ms, event_type,
       query_text, browse_uri, result_count
     FROM search_events
     ORDER BY timestamp_ms ASC
     LIMIT ? OFFSET ?"

  sqlight.query(
    sql,
    db,
    [sqlight.int(limit), sqlight.int(offset)],
    search_event_decoder(),
  )
}

fn search_event_decoder() -> decode.Decoder(SearchEvent) {
  use id <- decode.field(0, decode.int)
  use user_id <- decode.field(1, decode.int)
  use timestamp_ms <- decode.field(2, decode.int)
  use event_type <- decode.field(3, decode.string)
  use query_text <- decode.field(4, decode.optional(decode.string))
  use browse_uri <- decode.field(5, decode.optional(decode.string))
  use result_count <- decode.field(6, decode.optional(decode.int))
  decode.success(SearchEvent(
    id:,
    user_id:,
    timestamp_ms:,
    event_type:,
    query_text:,
    browse_uri:,
    result_count:,
  ))
}

// ============================================================================
// AGGREGATE STATS
// ============================================================================

/// Get per-table event counts for a user
pub fn get_user_stats(
  db: sqlight.Connection,
  user_id: Int,
) -> Result(List(#(String, Int)), sqlight.Error) {
  let sql =
    "SELECT 'playback' as category, COUNT(*) as count
       FROM playback_events WHERE user_id = ?
     UNION ALL
     SELECT 'queue', COUNT(*) FROM queue_events WHERE user_id = ?
     UNION ALL
     SELECT 'search', COUNT(*) FROM search_events WHERE user_id = ?"

  let decoder = {
    use category <- decode.field(0, decode.string)
    use count <- decode.field(1, decode.int)
    decode.success(#(category, count))
  }

  sqlight.query(
    sql,
    db,
    [sqlight.int(user_id), sqlight.int(user_id), sqlight.int(user_id)],
    decoder,
  )
}

/// Get total row counts across all tables (for ML export pagination)
pub fn get_event_counts(
  db: sqlight.Connection,
) -> Result(List(#(String, Int)), sqlight.Error) {
  let sql =
    "SELECT 'playback' as tbl, COUNT(*) as cnt FROM playback_events
     UNION ALL
     SELECT 'queue', COUNT(*) FROM queue_events
     UNION ALL
     SELECT 'search', COUNT(*) FROM search_events"

  let decoder = {
    use tbl <- decode.field(0, decode.string)
    use cnt <- decode.field(1, decode.int)
    decode.success(#(tbl, cnt))
  }

  sqlight.query(sql, db, [], decoder)
}
