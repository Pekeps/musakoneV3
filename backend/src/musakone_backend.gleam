import db/connection
import envoy
import gleam/bit_array
import gleam/bytes_tree
import gleam/erlang/process
import gleam/http
import gleam/http/request.{type Request}
import gleam/http/response.{type Response}
import gleam/int
import gleam/result
import gleam/string
import handlers/http as http_handlers
import logging
import mist
import websocket/handler as ws_handler

pub fn main() {
  logging.configure()
  logging.set_level(logging.Debug)

  let port = 3001

  // External configuration (from environment)
  // For local development, use: DB_PATH=./data/musakone.db
  let db_path =
    envoy.get("DB_PATH")
    |> result.unwrap("/app/data/musakone.db")

  let jwt_secret =
    envoy.get("JWT_SECRET")
    |> result.unwrap("change-this-secret-in-production")

  // For local development, use: MOPIDY_URL=ws://localhost:6680/mopidy/ws
  let mopidy_url =
    envoy.get("MOPIDY_URL")
    |> result.unwrap("ws://mopidy:6680/mopidy/ws")

  logging.log(logging.Info, "")
  logging.log(logging.Info, "╔══════════════════════════════════════╗")
  logging.log(logging.Info, "║   MusakoneV3 Backend Starting...     ║")
  logging.log(logging.Info, "╚══════════════════════════════════════╝")
  logging.log(logging.Info, "")
  logging.log(logging.Info, "Configuration:")
  logging.log(logging.Info, "  • Port: " <> int.to_string(port))
  logging.log(logging.Info, "  • Database: " <> db_path)
  logging.log(logging.Info, "  • Mopidy URL: " <> mopidy_url)
  logging.log(logging.Info, "")

  // Open database connection
  case connection.initialize(db_path) {
    Ok(db) -> {
      logging.log(logging.Info, "✓ Database connected and initialized")
      logging.log(logging.Info, "")

      // Create app state
      let state =
        http_handlers.AppState(
          db: db,
          jwt_secret: jwt_secret,
          mopidy_url: mopidy_url,
        )

      // Start Mist server
      let assert Ok(_) =
        fn(req: Request(mist.Connection)) -> Response(mist.ResponseData) {
          handle_request(req, state)
        }
        |> mist.new
        |> mist.bind("0.0.0.0")
        |> mist.port(port)
        |> mist.start

      logging.log(logging.Info, "✓ Server started successfully!")
      logging.log(logging.Info, "")
      logging.log(logging.Info, "Available endpoints:")
      logging.log(logging.Info, "  • GET  /api/health")
      logging.log(logging.Info, "  • POST /api/auth/login")
      logging.log(logging.Info, "  • POST /api/auth/register")
      logging.log(logging.Info, "  • GET  /api/auth/me")
      logging.log(logging.Info, "  • POST /api/analytics/actions")
      logging.log(logging.Info, "  • GET  /api/analytics/actions")
      logging.log(logging.Info, "  • GET  /api/analytics/stats")
      logging.log(logging.Info, "  • WS   /ws")
      logging.log(logging.Info, "")
      logging.log(logging.Info, "Ready to accept connections!")
      logging.log(logging.Info, "")

      process.sleep_forever()
    }
    Error(e) -> {
      logging.log(logging.Error, "")
      logging.log(logging.Error, "✗ Failed to connect to database:")
      logging.log(logging.Error, "  " <> e)
      logging.log(logging.Error, "")
      Nil
    }
  }
}

fn handle_request(
  req: Request(mist.Connection),
  state: http_handlers.AppState,
) -> Response(mist.ResponseData) {
  let path = request.path_segments(req)
  let method = req.method

  logging.log(
    logging.Debug,
    string.inspect(method) <> " " <> string.join(path, "/"),
  )

  // Add CORS headers
  let with_cors = fn(resp: Response(mist.ResponseData)) {
    resp
    |> response.prepend_header("access-control-allow-origin", "*")
    |> response.prepend_header(
      "access-control-allow-methods",
      "GET, POST, PUT, DELETE, OPTIONS",
    )
    |> response.prepend_header(
      "access-control-allow-headers",
      "content-type, authorization",
    )
  }

  case method, path {
    // OPTIONS requests (CORS preflight)
    http.Options, _ -> {
      response.new(204)
      |> response.set_body(mist.Bytes(bytes_tree.new()))
      |> with_cors
    }

    // Health check
    http.Get, ["api", "health"] -> http_handlers.health_check() |> with_cors

    // Auth endpoints
    http.Post, ["api", "auth", "login"] -> {
      case mist.read_body(req, max_body_limit: 1024 * 1024) {
        Ok(body_req) -> {
          case bit_array.to_string(body_req.body) {
            Ok(body) -> http_handlers.login(state, body) |> with_cors
            Error(_) ->
              error_response("Invalid UTF-8 in request body", 400) |> with_cors
          }
        }
        Error(_) ->
          error_response("Failed to read request body", 400) |> with_cors
      }
    }

    http.Post, ["api", "auth", "register"] -> {
      case mist.read_body(req, max_body_limit: 1024 * 1024) {
        Ok(body_req) -> {
          case bit_array.to_string(body_req.body) {
            Ok(body) -> http_handlers.register(state, body) |> with_cors
            Error(_) ->
              error_response("Invalid UTF-8 in request body", 400) |> with_cors
          }
        }
        Error(_) ->
          error_response("Failed to read request body", 400) |> with_cors
      }
    }

    http.Get, ["api", "auth", "me"] -> {
      case get_auth_header(req) {
        Ok(auth_header) -> http_handlers.me(state, auth_header) |> with_cors
        Error(e) -> error_response(e, 401) |> with_cors
      }
    }

    // Analytics endpoints
    http.Post, ["api", "analytics", "actions"] -> {
      case get_auth_header(req) {
        Ok(auth_header) -> {
          case mist.read_body(req, max_body_limit: 1024 * 1024) {
            Ok(body_req) -> {
              case bit_array.to_string(body_req.body) {
                Ok(body) ->
                  http_handlers.log_action(state, auth_header, body)
                  |> with_cors
                Error(_) ->
                  error_response("Invalid UTF-8 in request body", 400)
                  |> with_cors
              }
            }
            Error(_) ->
              error_response("Failed to read request body", 400) |> with_cors
          }
        }
        Error(e) -> error_response(e, 401) |> with_cors
      }
    }

    http.Get, ["api", "analytics", "actions"] -> {
      case get_auth_header(req) {
        Ok(auth_header) ->
          http_handlers.get_actions(state, auth_header) |> with_cors
        Error(e) -> error_response(e, 401) |> with_cors
      }
    }

    http.Get, ["api", "analytics", "stats"] -> {
      case get_auth_header(req) {
        Ok(auth_header) ->
          http_handlers.get_stats(state, auth_header) |> with_cors
        Error(e) -> error_response(e, 401) |> with_cors
      }
    }

    // WebSocket endpoint
    http.Get, ["ws"] -> {
      ws_handler.handle_websocket(req, state.mopidy_url)
      |> with_cors
    }

    // 404 Not Found
    _, _ -> {
      response.new(404)
      |> response.set_body(
        mist.Bytes(bytes_tree.from_string("{\"error\":\"Not found\"}")),
      )
      |> response.prepend_header("content-type", "application/json")
      |> with_cors
    }
  }
}

fn get_auth_header(req: Request(mist.Connection)) -> Result(String, String) {
  request.get_header(req, "authorization")
  |> result.replace_error("Missing authorization header")
}

fn error_response(message: String, status: Int) -> Response(mist.ResponseData) {
  response.new(status)
  |> response.prepend_header("content-type", "application/json")
  |> response.set_body(
    mist.Bytes(bytes_tree.from_string("{\"error\":\"" <> message <> "\"}")),
  )
}
