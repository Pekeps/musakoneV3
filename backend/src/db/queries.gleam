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
