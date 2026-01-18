import auth/jwt
import auth/service
import auth/tracker
import gleam/bytes_builder
import gleam/dict.{type Dict}
import gleam/erlang/process
import gleam/http/request
import gleam/http/response
import gleam/json
import gleam/option.{None, Some}
import gleam/result
import gleam/string
import mist.{
  type Connection, type ResponseData, type WebsocketConnection,
  type WebsocketMessage,
}
import sqlight

pub type AppState {
  AppState(db: sqlight.Connection, jwt_secret: String, mopidy_url: String)
}

pub type ClientConnection {
  ClientConnection(user_id: Int, connection: WebsocketConnection)
}

/// Handle WebSocket connections from clients
pub fn handle_websocket(
  state: AppState,
) -> fn(WebsocketConnection, WebsocketMessage(a)) ->
  actor.Next(WebsocketMessage(a), WebsocketConnection) {
  fn(conn: WebsocketConnection, msg: WebsocketMessage(a)) {
    case msg {
      mist.Text(text) -> {
        // Parse incoming message
        case parse_client_message(text) {
          Ok(client_msg) -> {
            // Authenticate and route message
            handle_client_message(state, conn, client_msg)
          }
          Error(_) -> {
            // Send error response
            let error_msg =
              json.object([
                #("error", json.string("Invalid message format")),
              ])
              |> json.to_string

            mist.send_text_frame(conn, error_msg)
          }
        }
        actor.continue(conn)
      }
      mist.Binary(_) -> {
        // We don't handle binary messages
        actor.continue(conn)
      }
      mist.Closed | mist.Shutdown -> {
        actor.Stop(process.Normal)
      }
    }
  }
}

pub type ClientMessage {
  AuthMessage(token: String)
  MopidyRequest(token: String, method: String, params: json.Json)
}

fn parse_client_message(text: String) -> Result(ClientMessage, String) {
  // Parse JSON message from client
  // Expected format: { "type": "auth", "token": "..." }
  // or { "type": "mopidy", "token": "...", "method": "...", "params": {...} }

  // Simplified parsing - in production, use proper JSON decoder
  case string.contains(text, "\"type\":\"auth\"") {
    True -> {
      // Extract token
      Ok(AuthMessage(token: "dummy_token"))
    }
    False -> {
      Ok(MopidyRequest(
        token: "dummy_token",
        method: "core.get_version",
        params: json.null(),
      ))
    }
  }
}

fn handle_client_message(
  state: AppState,
  conn: WebsocketConnection,
  msg: ClientMessage,
) -> Nil {
  case msg {
    AuthMessage(token) -> {
      // Verify token
      case jwt.verify_token(token, state.jwt_secret) {
        Ok(user_id) -> {
          // Send success response
          let response =
            json.object([
              #("type", json.string("auth_success")),
              #("user_id", json.int(user_id)),
            ])
            |> json.to_string

          mist.send_text_frame(conn, response)
        }
        Error(err) -> {
          // Send error response
          let response =
            json.object([
              #("type", json.string("auth_error")),
              #("error", json.string(err)),
            ])
            |> json.to_string

          mist.send_text_frame(conn, response)
        }
      }
    }
    MopidyRequest(token, method, params) -> {
      // Verify token
      case jwt.verify_token(token, state.jwt_secret) {
        Ok(user_id) -> {
          // Forward request to Mopidy
          // Log action if it's a playback command
          case is_playback_action(method) {
            True -> {
              let action =
                tracker.UserAction(
                  user_id: user_id,
                  action_type: extract_action_type(method),
                  track_uri: "",
                  track_name: "",
                  artist: "",
                  position_ms: 0,
                  metadata: json.to_string(params),
                )

              let _ = tracker.log_action(state.db, action)
              Nil
            }
            False -> Nil
          }

          // Send request to Mopidy and forward response
          // This is a placeholder - actual implementation would use the Mopidy client
          let response =
            json.object([
              #("type", json.string("mopidy_response")),
              #("method", json.string(method)),
              #("result", json.null()),
            ])
            |> json.to_string

          mist.send_text_frame(conn, response)
        }
        Error(_) -> {
          // Send auth error
          let response =
            json.object([
              #("type", json.string("auth_error")),
              #("error", json.string("Invalid token")),
            ])
            |> json.to_string

          mist.send_text_frame(conn, response)
        }
      }
    }
  }
}

fn is_playback_action(method: String) -> Bool {
  method == "core.playback.play"
  || method == "core.playback.pause"
  || method == "core.playback.stop"
  || method == "core.playback.next"
  || method == "core.playback.previous"
}

fn extract_action_type(method: String) -> String {
  case method {
    "core.playback.play" -> "play"
    "core.playback.pause" -> "pause"
    "core.playback.stop" -> "stop"
    "core.playback.next" -> "skip"
    "core.playback.previous" -> "previous"
    _ -> "other"
  }
}
