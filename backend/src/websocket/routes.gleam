import auth/jwt
import auth/service
import auth/tracker
import gleam/bit_array
import gleam/bytes_builder
import gleam/erlang/process
import gleam/http/request.{type Request}
import gleam/http/response.{type Response}
import gleam/json
import gleam/result
import gleam/string
import mist.{type Connection, type ResponseData}
import sqlight
import websocket/handler.{type AppState}

/// Handle HTTP requests (for authentication and health checks)
pub fn handle_request(
  req: Request(Connection),
  state: AppState,
) -> Response(ResponseData) {
  case req.method, request.path_segments(req) {
    // Health check endpoint
    http.Get, ["health"] -> {
      response.new(200)
      |> response.set_body(
        mist.Bytes(bytes_builder.from_string("{\"status\":\"ok\"}")),
      )
    }

    // Login endpoint
    http.Post, ["api", "auth", "login"] -> {
      handle_login(req, state)
    }

    // Get current user
    http.Get, ["api", "auth", "me"] -> {
      handle_get_current_user(req, state)
    }

    // Get user stats
    http.Get, ["api", "analytics", "stats"] -> {
      handle_get_stats(req, state)
    }

    // Get user history
    http.Get, ["api", "analytics", "history"] -> {
      handle_get_history(req, state)
    }

    // Upgrade to WebSocket
    http.Get, ["ws"] -> {
      mist.websocket(
        request: req,
        on_init: fn(_conn) { #(Nil, None) },
        on_close: fn(_state) { Nil },
        handler: handler.handle_websocket(state),
      )
    }

    // Not found
    _, _ -> {
      response.new(404)
      |> response.set_body(
        mist.Bytes(bytes_builder.from_string("{\"error\":\"Not found\"}")),
      )
    }
  }
}

fn handle_login(
  req: Request(Connection),
  state: AppState,
) -> Response(ResponseData) {
  // Parse request body (simplified - in production use proper JSON decoder)
  case mist.read_body(req, 1024 * 1024) {
    Ok(body) -> {
      // Extract username and password from JSON
      // This is a placeholder - use proper JSON parsing
      let username = "admin"
      let password = "admin"

      case service.authenticate(state.db, username, password) {
        Ok(user) -> {
          let token = jwt.generate_token(user.id, state.jwt_secret)

          let response_json =
            json.object([
              #(
                "user",
                json.object([
                  #("id", json.int(user.id)),
                  #("username", json.string(user.username)),
                ]),
              ),
              #("token", json.string(token.value)),
              #("expires_at", json.int(token.expires_at)),
            ])
            |> json.to_string

          response.new(200)
          |> response.set_body(
            mist.Bytes(bytes_builder.from_string(response_json)),
          )
          |> response.set_header("content-type", "application/json")
        }
        Error(err) -> {
          let error_json =
            json.object([#("error", json.string(err))]) |> json.to_string

          response.new(401)
          |> response.set_body(
            mist.Bytes(bytes_builder.from_string(error_json)),
          )
          |> response.set_header("content-type", "application/json")
        }
      }
    }
    Error(_) -> {
      response.new(400)
      |> response.set_body(
        mist.Bytes(bytes_builder.from_string("{\"error\":\"Invalid body\"}")),
      )
    }
  }
}

fn handle_get_current_user(
  req: Request(Connection),
  state: AppState,
) -> Response(ResponseData) {
  // Extract token from Authorization header
  case get_auth_token(req) {
    Ok(token) -> {
      case jwt.verify_token(token, state.jwt_secret) {
        Ok(user_id) -> {
          case service.get_user_by_id(state.db, user_id) {
            Ok(user) -> {
              let response_json =
                json.object([
                  #("id", json.int(user.id)),
                  #("username", json.string(user.username)),
                ])
                |> json.to_string

              response.new(200)
              |> response.set_body(
                mist.Bytes(bytes_builder.from_string(response_json)),
              )
              |> response.set_header("content-type", "application/json")
            }
            Error(err) -> {
              let error_json =
                json.object([#("error", json.string(err))]) |> json.to_string

              response.new(404)
              |> response.set_body(
                mist.Bytes(bytes_builder.from_string(error_json)),
              )
            }
          }
        }
        Error(err) -> {
          let error_json =
            json.object([#("error", json.string(err))]) |> json.to_string

          response.new(401)
          |> response.set_body(
            mist.Bytes(bytes_builder.from_string(error_json)),
          )
        }
      }
    }
    Error(_) -> {
      response.new(401)
      |> response.set_body(
        mist.Bytes(bytes_builder.from_string(
          "{\"error\":\"No authorization token\"}",
        )),
      )
    }
  }
}

fn handle_get_stats(
  req: Request(Connection),
  state: AppState,
) -> Response(ResponseData) {
  case get_auth_token(req) {
    Ok(token) -> {
      case jwt.verify_token(token, state.jwt_secret) {
        Ok(user_id) -> {
          case tracker.get_user_stats(state.db, user_id) {
            Ok(stats) -> {
              response.new(200)
              |> response.set_body(
                mist.Bytes(bytes_builder.from_string(json.to_string(stats))),
              )
              |> response.set_header("content-type", "application/json")
            }
            Error(err) -> {
              let error_json =
                json.object([#("error", json.string(err))]) |> json.to_string

              response.new(500)
              |> response.set_body(
                mist.Bytes(bytes_builder.from_string(error_json)),
              )
            }
          }
        }
        Error(err) -> {
          let error_json =
            json.object([#("error", json.string(err))]) |> json.to_string

          response.new(401)
          |> response.set_body(
            mist.Bytes(bytes_builder.from_string(error_json)),
          )
        }
      }
    }
    Error(_) -> {
      response.new(401)
      |> response.set_body(
        mist.Bytes(bytes_builder.from_string(
          "{\"error\":\"No authorization token\"}",
        )),
      )
    }
  }
}

fn handle_get_history(
  req: Request(Connection),
  state: AppState,
) -> Response(ResponseData) {
  case get_auth_token(req) {
    Ok(token) -> {
      case jwt.verify_token(token, state.jwt_secret) {
        Ok(user_id) -> {
          case tracker.get_user_history(state.db, user_id, 100) {
            Ok(history) -> {
              // Convert history to JSON
              let history_json =
                json.array(history, fn(action) {
                  json.object([
                    #("action_type", json.string(action.action_type)),
                    #("track_uri", json.string(action.track_uri)),
                    #("track_name", json.string(action.track_name)),
                    #("artist", json.string(action.artist)),
                  ])
                })

              response.new(200)
              |> response.set_body(
                mist.Bytes(
                  bytes_builder.from_string(json.to_string(history_json)),
                ),
              )
              |> response.set_header("content-type", "application/json")
            }
            Error(err) -> {
              let error_json =
                json.object([#("error", json.string(err))]) |> json.to_string

              response.new(500)
              |> response.set_body(
                mist.Bytes(bytes_builder.from_string(error_json)),
              )
            }
          }
        }
        Error(err) -> {
          let error_json =
            json.object([#("error", json.string(err))]) |> json.to_string

          response.new(401)
          |> response.set_body(
            mist.Bytes(bytes_builder.from_string(error_json)),
          )
        }
      }
    }
    Error(_) -> {
      response.new(401)
      |> response.set_body(
        mist.Bytes(bytes_builder.from_string(
          "{\"error\":\"No authorization token\"}",
        )),
      )
    }
  }
}

fn get_auth_token(req: Request(Connection)) -> Result(String, Nil) {
  case request.get_header(req, "authorization") {
    Ok(header) -> {
      case string.split(header, " ") {
        ["Bearer", token] -> Ok(token)
        _ -> Error(Nil)
      }
    }
    Error(_) -> Error(Nil)
  }
}
