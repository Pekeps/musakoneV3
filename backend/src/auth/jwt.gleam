import birl
import gleam/bit_array
import gleam/crypto
import gleam/int
import gleam/json
import gleam/result
import gleam/string
import gwt.{type JWT}

pub type User {
  User(id: Int, username: String)
}

pub fn generate_jwt(user: User, secret: String) -> JWT {
  let expires_at = birl.now() |> birl.add(birl.hours(24)) |> birl.to_unix()

  let payload = int.to_string(user_id) <> "." <> int.to_string(expires_at)

  let signature =
    crypto.sign_message(
      bit_array.from_string(payload),
      crypto.Sha256,
      bit_array.from_string(secret),
    )
    |> bit_array.base64_encode(True)

  let token = payload <> "." <> signature

  Token(value: token, expires_at: expires_at)
}

/// Verify token and extract user_id
pub fn verify_token(token: String, secret: String) -> Result(Int, String) {
  case string.split(token, ".") {
    [user_id_str, expires_str, signature] -> {
      let payload = user_id_str <> "." <> expires_str

      let expected_signature =
        crypto.sign_message(
          bit_array.from_string(payload),
          crypto.Sha256,
          bit_array.from_string(secret),
        )
        |> bit_array.base64_encode(True)

      case signature == expected_signature {
        True -> {
          case int.parse(expires_str) {
            Ok(expires_at) -> {
              let now = birl.now() |> birl.to_unix()
              case expires_at > now {
                True ->
                  case int.parse(user_id_str) {
                    Ok(user_id) -> Ok(user_id)
                    Error(_) -> Error("Invalid user_id in token")
                  }
                False -> Error("Token expired")
              }
            }
            Error(_) -> Error("Invalid expires_at in token")
          }
        }
        False -> Error("Invalid signature")
      }
    }
    _ -> Error("Invalid token format")
  }
}

/// Hash password using SHA256 (in production, use bcrypt or argon2)
pub fn hash_password(password: String) -> String {
  crypto.hash(crypto.Sha256, bit_array.from_string(password))
  |> bit_array.base16_encode
}

/// Verify password against hash
pub fn verify_password(password: String, hash: String) -> Bool {
  hash_password(password) == hash
}
