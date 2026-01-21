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
// USER ACTIONS TRACKING
// ============================================================================

pub type UserAction {
  UserAction(
    id: Int,
    user_id: Int,
    action_type: String,
    track_uri: Option(String),
    track_name: Option(String),
    metadata: Option(String),
    timestamp: Int,
  )
}

/// Log a user action
pub fn log_user_action(
  db: sqlight.Connection,
  user_id: Int,
  action_type: String,
  track_uri: Option(String),
  track_name: Option(String),
  metadata: Option(String),
  timestamp: Int,
) -> Result(Nil, sqlight.Error) {
  let sql =
    "INSERT INTO user_actions (user_id, action_type, track_uri, track_name, metadata, timestamp)
VALUES (?, ?, ?, ?, ?, ?)"

  sqlight.query(
    sql,
    db,
    [
      sqlight.int(user_id),
      sqlight.text(action_type),
      sqlight.nullable(sqlight.text, track_uri),
      sqlight.nullable(sqlight.text, track_name),
      sqlight.nullable(sqlight.text, metadata),
      sqlight.int(timestamp),
    ],
    decode.dynamic,
  )
  |> result.map(fn(_) { Nil })
}

/// Get user actions for a specific user
pub fn get_user_actions(
  db: sqlight.Connection,
  user_id: Int,
  limit: Int,
) -> Result(List(UserAction), sqlight.Error) {
  let sql =
    "SELECT id, user_id, action_type, track_uri, track_name, metadata, timestamp
FROM user_actions
WHERE user_id = ?
ORDER BY timestamp DESC
LIMIT ?"

  sqlight.query(
    sql,
    db,
    [sqlight.int(user_id), sqlight.int(limit)],
    user_action_decoder(),
  )
}

/// Get statistics for a user
pub fn get_user_stats(
  db: sqlight.Connection,
  user_id: Int,
) -> Result(List(#(String, Int)), sqlight.Error) {
  let sql =
    "SELECT action_type, COUNT(*) as count
FROM user_actions
WHERE user_id = ?
GROUP BY action_type"

  let decoder = {
    use action_type <- decode.field(0, decode.string)
    use count <- decode.field(1, decode.int)
    decode.success(#(action_type, count))
  }

  sqlight.query(sql, db, [sqlight.int(user_id)], decoder)
}

fn user_action_decoder() -> decode.Decoder(UserAction) {
  use id <- decode.field(0, decode.int)
  use user_id <- decode.field(1, decode.int)
  use action_type <- decode.field(2, decode.string)
  use track_uri <- decode.field(3, decode.optional(decode.string))
  use track_name <- decode.field(4, decode.optional(decode.string))
  use metadata <- decode.field(5, decode.optional(decode.string))
  use timestamp <- decode.field(6, decode.int)
  decode.success(UserAction(
    id:,
    user_id:,
    action_type:,
    track_uri:,
    track_name:,
    metadata:,
    timestamp:,
  ))
}
