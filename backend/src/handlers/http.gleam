import auth/jwt.{type Jwt, type Verified}
import auth/service
import db/queries
import gleam/bytes_tree
import gleam/dynamic/decode
import gleam/float
import gleam/http/response.{type Response}
import gleam/int
import gleam/json
import gleam/list
import gleam/option.{type Option}
import gleam/result
import gleam/string
import gleam/time/timestamp
import logging
import mist.{type ResponseData}
import sqlight

pub type AppState {
  AppState(db: sqlight.Connection, jwt_secret: String, mopidy_url: String)
}

pub type LoginRequest {
  LoginRequest(username: String, password: String)
}

pub type LoginResponse {
  LoginResponse(token: String, user: queries.User)
}

pub type ActionRequest {
  ActionRequest(
    action_type: String,
    track_uri: Option(String),
    track_name: Option(String),
    metadata: Option(String),
  )
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
      let _ =
        logging.log(logging.Debug, "Parsed register request" <> req.username)
      case service.create_user(state.db, req.username, req.password) {
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
              // For now, return user_id - in production, query database
              json.object([
                #("id", json.int(user_id)),
                #("authenticated", json.bool(True)),
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

/// Log user action
pub fn log_action(
  state: AppState,
  auth_header: String,
  body: String,
) -> Response(ResponseData) {
  case extract_token(auth_header) {
    Ok(token) -> {
      case verify_jwt_token(token, state.jwt_secret) {
        Ok(jwt_data) -> {
          case get_user_id_from_jwt(jwt_data) {
            Ok(user_id) -> {
              case parse_action_request(body) {
                Ok(action) -> {
                  let timestamp =
                    timestamp.system_time()
                    |> timestamp.to_unix_seconds()
                    |> float.round

                  case
                    queries.log_user_action(
                      state.db,
                      user_id,
                      action.action_type,
                      action.track_uri,
                      action.track_name,
                      action.metadata,
                      timestamp,
                    )
                  {
                    Ok(_) -> {
                      json.object([#("success", json.bool(True))])
                      |> json.to_string
                      |> respond_json(200)
                    }
                    Error(_) -> error_response("Failed to log action", 500)
                  }
                }
                Error(e) -> error_response("Invalid request: " <> e, 400)
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

/// Get user action history
pub fn get_actions(
  state: AppState,
  auth_header: String,
) -> Response(ResponseData) {
  case extract_token(auth_header) {
    Ok(token) -> {
      case verify_jwt_token(token, state.jwt_secret) {
        Ok(jwt_data) -> {
          case get_user_id_from_jwt(jwt_data) {
            Ok(user_id) -> {
              case queries.get_user_actions(state.db, user_id, 100) {
                Ok(actions) -> {
                  let actions_json =
                    json.array(actions, fn(action) {
                      json.object([
                        #("id", json.int(action.id)),
                        #("action_type", json.string(action.action_type)),
                        #(
                          "track_uri",
                          json.nullable(action.track_uri, json.string),
                        ),
                        #(
                          "track_name",
                          json.nullable(action.track_name, json.string),
                        ),
                        #(
                          "metadata",
                          json.nullable(action.metadata, json.string),
                        ),
                        #("timestamp", json.int(action.timestamp)),
                      ])
                    })

                  actions_json
                  |> json.to_string
                  |> respond_json(200)
                }
                Error(_) -> error_response("Failed to get actions", 500)
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

fn parse_action_request(body: String) -> Result(ActionRequest, String) {
  let decoder = {
    use action_type <- decode.field("action_type", decode.string)
    use track_uri <- decode.field("track_uri", decode.optional(decode.string))
    use track_name <- decode.field("track_name", decode.optional(decode.string))
    use metadata <- decode.field("metadata", decode.optional(decode.string))
    decode.success(ActionRequest(
      action_type:,
      track_uri:,
      track_name:,
      metadata:,
    ))
  }

  json.parse(body, decoder)
  |> result.map_error(fn(e) { "Invalid JSON format" <> string.inspect(e) })
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
