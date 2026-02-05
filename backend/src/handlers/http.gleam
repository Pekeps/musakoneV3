import auth/jwt.{type Jwt, type Verified}
import auth/service
import db/queries
import event_bus.{type BusMessage}
import gleam/bytes_tree
import gleam/dynamic/decode
import gleam/erlang/process.{type Subject}
import gleam/float
import gleam/http/response.{type Response}
import gleam/int
import gleam/json
import gleam/list
import gleam/result
import gleam/string
import gleam/time/timestamp
import logging
import mist.{type ResponseData}
import sqlight

pub type AppState {
  AppState(
    db: sqlight.Connection,
    jwt_secret: String,
    event_bus: Subject(BusMessage),
  )
}

pub type LoginRequest {
  LoginRequest(username: String, password: String)
}

/// Health check endpoint
pub fn health_check() -> Response(ResponseData) {
  json.object([
    #("status", json.string("ok")),
    #("service", json.string("musakone-backend")),
    #(
      "timestamp",
      json.int(
        timestamp.system_time()
        |> timestamp.to_unix_seconds()
        |> float.round,
      ),
    ),
  ])
  |> json.to_string
  |> respond_json(200)
}

/// Login endpoint
pub fn login(state: AppState, body: String) -> Response(ResponseData) {
  case parse_login_request(body) {
    Ok(req) -> {
      case service.authenticate(state.db, req.username, req.password) {
        Ok(user) -> {
          // Generate JWT token
          case create_jwt_token(user, state.jwt_secret) {
            Ok(token) -> {
              json.object([
                #("token", json.string(token)),
                #(
                  "user",
                  json.object([
                    #("id", json.int(user.id)),
                    #("username", json.string(user.username)),
                    #("created_at", json.int(user.created_at)),
                  ]),
                ),
              ])
              |> json.to_string
              |> respond_json(200)
            }
            Error(e) -> {
              logging.log(logging.Error, "Failed to create JWT: " <> e)
              error_response("Failed to create authentication token", 500)
            }
          }
        }
        Error(_) -> error_response("Invalid username or password", 401)
      }
    }
    Error(e) -> error_response("Invalid request: " <> e, 400)
  }
}

/// Register endpoint
pub fn register(state: AppState, body: String) -> Response(ResponseData) {
  let _ = logging.log(logging.Debug, "Register request received: " <> body)
  case parse_login_request(body) {
    Ok(req) -> {
      let _ = case service.create_user(state.db, req.username, req.password) {
        Ok(user) -> {
          let response_json =
            json.object([
              #("id", json.int(user.id)),
              #("username", json.string(user.username)),
              #("created_at", json.int(user.created_at)),
            ])
            |> json.to_string
          let _ =
            logging.log(
              logging.Info,
              "Registering successful: " <> response_json,
            )
          respond_json(response_json, 201)
        }
        Error(e) -> {
          let _ = logging.log(logging.Error, "Error creating user: " <> e)
          error_response("Username already exists", 409)
        }
      }
    }
    Error(e) -> {
      let _ = logging.log(logging.Error, "Error parsing payload: " <> e)
      error_response("Invalid request: " <> e, 400)
    }
  }
}

/// Get current user from token
pub fn me(state: AppState, auth_header: String) -> Response(ResponseData) {
  case extract_token(auth_header) {
    Ok(token) -> {
      case verify_jwt_token(token, state.jwt_secret) {
        Ok(jwt_data) -> {
          case get_user_id_from_jwt(jwt_data) {
            Ok(user_id) -> {
              // Query database to get full user data
              case queries.get_user_by_id(state.db, user_id) {
                Ok([user, ..]) -> {
                  json.object([
                    #("id", json.int(user.id)),
                    #("username", json.string(user.username)),
                    #("created_at", json.int(user.created_at)),
                  ])
                  |> json.to_string
                  |> respond_json(200)
                }
                Ok([]) -> error_response("User not found", 404)
                Error(_) -> error_response("Database error", 500)
              }
            }
            Error(e) -> error_response("Invalid token: " <> e, 401)
          }
        }
        Error(e) -> {
          error_response("Invalid or expired token: " <> string.inspect(e), 401)
        }
      }
    }
    Error(e) -> error_response(e, 401)
  }
}

/// Get recent events from all tables for a user
pub fn get_events(
  state: AppState,
  auth_header: String,
) -> Response(ResponseData) {
  case extract_token(auth_header) {
    Ok(token) -> {
      case verify_jwt_token(token, state.jwt_secret) {
        Ok(jwt_data) -> {
          case get_user_id_from_jwt(jwt_data) {
            Ok(user_id) -> {
              let playback =
                queries.get_playback_events(state.db, user_id, 50)
                |> result.unwrap([])
              let queue =
                queries.get_queue_events(state.db, user_id, 50)
                |> result.unwrap([])
              let search =
                queries.get_search_events(state.db, user_id, 50)
                |> result.unwrap([])

              json.object([
                #("playback", json.array(playback, encode_playback_event)),
                #("queue", json.array(queue, encode_queue_event)),
                #("search", json.array(search, encode_search_event)),
              ])
              |> json.to_string
              |> respond_json(200)
            }
            Error(e) -> error_response("Invalid token: " <> e, 401)
          }
        }
        Error(e) -> {
          error_response("Invalid or expired token: " <> string.inspect(e), 401)
        }
      }
    }
    Error(e) -> error_response(e, 401)
  }
}

/// Get user statistics
pub fn get_stats(state: AppState, auth_header: String) -> Response(ResponseData) {
  case extract_token(auth_header) {
    Ok(token) -> {
      case verify_jwt_token(token, state.jwt_secret) {
        Ok(jwt_data) -> {
          case get_user_id_from_jwt(jwt_data) {
            Ok(user_id) -> {
              case queries.get_user_stats(state.db, user_id) {
                Ok(stats) -> {
                  let stats_json =
                    stats
                    |> list.map(fn(stat) {
                      let #(action_type, count) = stat
                      #(action_type, json.int(count))
                    })
                    |> json.object

                  stats_json
                  |> json.to_string
                  |> respond_json(200)
                }
                Error(_) -> error_response("Failed to get statistics", 500)
              }
            }
            Error(e) -> error_response("Invalid token: " <> e, 401)
          }
        }
        Error(e) -> {
          error_response("Invalid or expired token: " <> string.inspect(e), 401)
        }
      }
    }
    Error(e) -> error_response(e, 401)
  }
}

// Helper functions

fn parse_login_request(body: String) -> Result(LoginRequest, String) {
  let decoder = {
    use username <- decode.field("username", decode.string)
    use password <- decode.field("password", decode.string)
    decode.success(LoginRequest(username:, password:))
  }

  json.parse(body, decoder)
  |> result.map_error(fn(e) { "Invalid JSON format" <> string.inspect(e) })
}

// ============================================================================
// JSON ENCODERS FOR EVENT TYPES
// ============================================================================

fn encode_playback_event(event: queries.PlaybackEvent) -> json.Json {
  json.object([
    #("id", json.int(event.id)),
    #("user_id", json.int(event.user_id)),
    #("timestamp_ms", json.int(event.timestamp_ms)),
    #("event_type", json.string(event.event_type)),
    #("track_uri", json.nullable(event.track_uri, json.string)),
    #("track_name", json.nullable(event.track_name, json.string)),
    #("artist_name", json.nullable(event.artist_name, json.string)),
    #("album_name", json.nullable(event.album_name, json.string)),
    #("track_duration_ms", json.nullable(event.track_duration_ms, json.int)),
    #("position_ms", json.nullable(event.position_ms, json.int)),
    #("seek_to_ms", json.nullable(event.seek_to_ms, json.int)),
    #("volume_level", json.nullable(event.volume_level, json.int)),
    #("playback_flags", json.nullable(event.playback_flags, json.string)),
  ])
}

fn encode_queue_event(event: queries.QueueEvent) -> json.Json {
  json.object([
    #("id", json.int(event.id)),
    #("user_id", json.int(event.user_id)),
    #("timestamp_ms", json.int(event.timestamp_ms)),
    #("event_type", json.string(event.event_type)),
    #("track_uris", json.nullable(event.track_uris, json.string)),
    #("track_names", json.nullable(event.track_names, json.string)),
    #("at_position", json.nullable(event.at_position, json.int)),
    #("from_position", json.nullable(event.from_position, json.int)),
    #("to_position", json.nullable(event.to_position, json.int)),
    #("queue_length", json.nullable(event.queue_length, json.int)),
  ])
}

fn encode_search_event(event: queries.SearchEvent) -> json.Json {
  json.object([
    #("id", json.int(event.id)),
    #("user_id", json.int(event.user_id)),
    #("timestamp_ms", json.int(event.timestamp_ms)),
    #("event_type", json.string(event.event_type)),
    #("query_text", json.nullable(event.query_text, json.string)),
    #("browse_uri", json.nullable(event.browse_uri, json.string)),
    #("result_count", json.nullable(event.result_count, json.int)),
  ])
}

/// Export all events for ML training (paginated, all users)
pub fn export_ml_data(
  state: AppState,
  auth_header: String,
  offset: Int,
  limit: Int,
) -> Response(ResponseData) {
  case extract_token(auth_header) {
    Ok(token) -> {
      case verify_jwt_token(token, state.jwt_secret) {
        Ok(_jwt_data) -> {
          let counts =
            queries.get_event_counts(state.db)
            |> result.unwrap([])

          let playback =
            queries.export_playback_events(state.db, offset, limit)
            |> result.unwrap([])
          let queue =
            queries.export_queue_events(state.db, offset, limit)
            |> result.unwrap([])
          let search =
            queries.export_search_events(state.db, offset, limit)
            |> result.unwrap([])

          json.object([
            #(
              "counts",
              json.object(
                list.map(counts, fn(c) {
                  let #(tbl, cnt) = c
                  #(tbl, json.int(cnt))
                }),
              ),
            ),
            #("offset", json.int(offset)),
            #("limit", json.int(limit)),
            #("playback", json.array(playback, encode_playback_event)),
            #("queue", json.array(queue, encode_queue_event)),
            #("search", json.array(search, encode_search_event)),
          ])
          |> json.to_string
          |> respond_json(200)
        }
        Error(e) -> {
          error_response("Invalid or expired token: " <> string.inspect(e), 401)
        }
      }
    }
    Error(e) -> error_response(e, 401)
  }
}

fn create_jwt_token(
  user: queries.User,
  secret: String,
) -> Result(String, String) {
  let exp =
    timestamp.system_time()
    |> timestamp.to_unix_seconds()
    |> float.add(86_400.0)
    |> float.round

  let token =
    jwt.new()
    |> jwt.set_subject(string.inspect(user.id))
    |> jwt.set_expiration(exp)
    |> jwt.set_issued_at(user.created_at)
    |> jwt.to_signed_string(jwt.HS256, secret)

  Ok(token)
}

fn extract_token(auth_header: String) -> Result(String, String) {
  case string.starts_with(auth_header, "Bearer ") {
    True -> {
      string.drop_start(auth_header, 7)
      |> Ok
    }
    False -> Error("Invalid authorization header format")
  }
}

fn verify_jwt_token(
  token: String,
  secret: String,
) -> Result(Jwt(Verified), jwt.JwtDecodeError) {
  jwt.from_signed_string(token, secret)
}

fn get_user_id_from_jwt(jwt_data: Jwt(Verified)) -> Result(Int, String) {
  use subject <- result.try(
    jwt.get_subject(jwt_data)
    |> result.replace_error("No subject in JWT"),
  )

  case int.parse(subject) {
    Ok(user_id) -> Ok(user_id)
    Error(_) -> Error("Invalid user ID in JWT subject")
  }
}

fn respond_json(body: String, status: Int) -> Response(ResponseData) {
  response.new(status)
  |> response.prepend_header("content-type", "application/json")
  |> response.set_body(mist.Bytes(bytes_tree.from_string(body)))
}

fn error_response(message: String, status: Int) -> Response(ResponseData) {
  json.object([#("error", json.string(message))])
  |> json.to_string
  |> respond_json(status)
}
