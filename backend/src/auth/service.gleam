import auth/jwt.{type User, User}
import birl
import gleam/option.{type Option, None, Some}
import gleam/result
import sqlight

/// Authenticate user by username and password
pub fn authenticate(
  db: sqlight.Connection,
  username: String,
  password: String,
) -> Result(User, String) {
  let password_hash = jwt.hash_password(password)

  let sql =
    "
    SELECT id, username FROM users
    WHERE username = ? AND password_hash = ?
    LIMIT 1
    "

  sqlight.query(
    sql,
    db,
    [sqlight.text(username), sqlight.text(password_hash)],
    fn(row) {
      case row {
        [sqlight.Integer(id), sqlight.Text(username)] ->
          Ok(User(id: id, username: username))
        _ -> Error(sqlight.UnexpectedResultType)
      }
    },
  )
  |> result.then(fn(users) {
    case users {
      [user] -> {
        // Update last login
        let _ =
          sqlight.exec(
            "UPDATE users SET last_login = strftime('%s', 'now') WHERE id = "
              <> int.to_string(user.id),
            db,
          )
        Ok(user)
      }
      _ -> Error("Invalid credentials")
    }
  })
  |> result.map_error(fn(_) { "Invalid credentials" })
}

/// Create a new user
pub fn create_user(
  db: sqlight.Connection,
  username: String,
  password: String,
) -> Result(User, String) {
  let password_hash = jwt.hash_password(password)
  let now = birl.now() |> birl.to_unix() |> int.to_string()

  let sql =
    "
    INSERT INTO users (username, password_hash, created_at)
    VALUES (?, ?, ?)
    "

  sqlight.exec(sql, db)
  |> result.then(fn(_) {
    sqlight.query(
      "SELECT id, username FROM users WHERE username = ? LIMIT 1",
      db,
      [sqlight.text(username)],
      fn(row) {
        case row {
          [sqlight.Integer(id), sqlight.Text(username)] ->
            Ok(User(id: id, username: username))
          _ -> Error(sqlight.UnexpectedResultType)
        }
      },
    )
  })
  |> result.then(fn(users) {
    case users {
      [user] -> Ok(user)
      _ -> Error("Failed to create user")
    }
  })
  |> result.map_error(fn(_) { "Failed to create user" })
}

/// Get user by ID
pub fn get_user_by_id(
  db: sqlight.Connection,
  user_id: Int,
) -> Result(User, String) {
  let sql = "SELECT id, username FROM users WHERE id = ? LIMIT 1"

  sqlight.query(sql, db, [sqlight.int(user_id)], fn(row) {
    case row {
      [sqlight.Integer(id), sqlight.Text(username)] ->
        Ok(User(id: id, username: username))
      _ -> Error(sqlight.UnexpectedResultType)
    }
  })
  |> result.then(fn(users) {
    case users {
      [user] -> Ok(user)
      _ -> Error("User not found")
    }
  })
  |> result.map_error(fn(_) { "User not found" })
}
