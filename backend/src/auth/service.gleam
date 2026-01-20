import db/queries
import gleam/bit_array
import gleam/crypto
import gleam/float
import gleam/option
import gleam/result
import gleam/string
import gleam/time/timestamp
import sqlight

// Authenticate user by username and password
pub fn authenticate(
  db_connection: sqlight.Connection,
  username: String,
  password: String,
) -> Result(queries.User, String) {
  let pw_hash = hash_password(password)
  use user <- result.try(get_user_by_credentials(
    db_connection,
    username,
    pw_hash,
  ))
  let _ = update_last_login(db_connection, user.id)
  Ok(user)
}

/// Create a new user
pub fn create_user(
  db: sqlight.Connection,
  username: String,
  password: String,
) -> Result(queries.User, String) {
  let pw_hash = hash_password(password)
  queries.create_user(db, username, pw_hash, epoch_now())
  |> result.map_error(fn(_) { "Failed to create user" })
  |> result.try(parse_first_row)
}

fn hash_password(password: String) -> String {
  crypto.hash(crypto.Sha256, <<password:utf8>>)
  |> bit_array.base16_encode()
  |> string.lowercase()
}

fn get_user_by_credentials(
  db: sqlight.Connection,
  username: String,
  hash: String,
) -> Result(queries.User, String) {
  queries.get_user_by_username_and_password(db, username, hash)
  |> result.map_error(fn(_) { "Database query failed" })
  |> result.try(parse_first_row)
}

fn update_last_login(db: sqlight.Connection, user_id: Int) {
  let now =
    timestamp.system_time()
    |> timestamp.to_unix_seconds()
    |> float.round()

  queries.update_last_login(db, user_id, option.Some(now))
  |> result.map_error(fn(_) { "Failed to update last login" })
}

fn parse_first_row(rows: List(a)) -> Result(a, String) {
  case rows {
    [first_row, ..] -> Ok(first_row)
    [] -> Error("No results returned")
  }
}

fn epoch_now() -> Int {
  timestamp.system_time()
  |> timestamp.to_unix_seconds()
  |> float.round()
}
