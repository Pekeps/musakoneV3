/// WebSocket handler for browser client connections
/// Relays messages between browser clients and the shared Mopidy connection
import gleam/erlang/process.{type Subject}
import gleam/http/request.{type Request}
import gleam/http/response
import gleam/option.{Some}
import gleam/string
import logging
import mist.{type ResponseData, type WebsocketConnection, type WebsocketMessage}
import websocket/mopidy_client.{type MopidyMessage}

/// State for each WebSocket connection
pub type WsState {
  WsState(
    mopidy_subject: Subject(MopidyMessage),
    client_subject: Subject(MopidyMessage),
  )
}

/// WebSocket handler for client connections
pub fn handle_websocket(
  req: Request(mist.Connection),
  mopidy_subject: Subject(MopidyMessage),
) -> response.Response(ResponseData) {
  mist.websocket(
    request: req,
    on_init: fn(_conn) { init_websocket(mopidy_subject) },
    on_close: fn(state) {
      logging.log(
        logging.Info,
        "WebSocket connection closed, unregistering client",
      )
      // Unregister this client from the shared Mopidy connection
      process.send(
        state.mopidy_subject,
        mopidy_client.UnregisterClient(state.client_subject),
      )
      Nil
    },
    handler: handle_message,
  )
}

/// Initialize WebSocket connection and register with shared Mopidy client
fn init_websocket(
  mopidy_subject: Subject(MopidyMessage),
) -> #(WsState, option.Option(process.Selector(MopidyMessage))) {
  logging.log(logging.Info, "New WebSocket connection established")

  // Create a subject to receive messages from Mopidy client
  let client_subject = process.new_subject()

  // Register this client with the shared Mopidy actor
  process.send(mopidy_subject, mopidy_client.RegisterClient(client_subject))

  let state =
    WsState(mopidy_subject: mopidy_subject, client_subject: client_subject)

  // Set up selector to receive messages from Mopidy client
  let selector =
    process.new_selector()
    |> process.select(client_subject)

  #(state, Some(selector))
}

/// Handle incoming WebSocket messages
fn handle_message(
  state: WsState,
  message: WebsocketMessage(MopidyMessage),
  conn: WebsocketConnection,
) -> mist.Next(WsState, MopidyMessage) {
  case message {
    // Text message from browser - forward to Mopidy
    mist.Text(text) -> {
      logging.log(logging.Debug, "Browser -> Backend: " <> text)
      process.send(state.mopidy_subject, mopidy_client.SendToMopidy(text))
      mist.continue(state)
    }

    // Binary message from browser - log and ignore
    mist.Binary(data) -> {
      logging.log(
        logging.Debug,
        "Received binary message from browser: " <> string.inspect(data),
      )
      mist.continue(state)
    }

    // Custom message from Mopidy client - forward to browser
    mist.Custom(msg) -> {
      case msg {
        mopidy_client.MopidyResponse(data) -> {
          logging.log(logging.Debug, "Mopidy -> Browser: " <> data)
          // Send response back to browser
          case mist.send_text_frame(conn, data) {
            Ok(_) -> Nil
            Error(err) -> {
              logging.log(
                logging.Error,
                "Failed to send to browser: " <> string.inspect(err),
              )
            }
          }
        }

        mopidy_client.MopidyError(error) -> {
          logging.log(logging.Error, "Mopidy error: " <> error)
          // Send error to browser as JSON
          let error_json =
            "{\"error\": \"" <> escape_json_string(error) <> "\"}"
          let _ = mist.send_text_frame(conn, error_json)
          Nil
        }

        mopidy_client.MopidyConnected -> {
          logging.log(logging.Info, "Mopidy connection established")
          // Notify browser of connection
          let _ =
            mist.send_text_frame(conn, "{\"event\": \"mopidy_connected\"}")
          Nil
        }

        mopidy_client.MopidyDisconnected -> {
          logging.log(logging.Warning, "Mopidy connection lost")
          // Notify browser of disconnection
          let _ =
            mist.send_text_frame(conn, "{\"event\": \"mopidy_disconnected\"}")
          Nil
        }

        // Internal messages - shouldn't reach here
        mopidy_client.SendToMopidy(_)
        | mopidy_client.RegisterClient(_)
        | mopidy_client.UnregisterClient(_)
        | mopidy_client.ReceivedFrame(_)
        | mopidy_client.ConnectionError(_)
        | mopidy_client.SetConnection(_)
        | mopidy_client.AttemptReconnect
        | mopidy_client.StoreSelfReference(_) -> Nil
      }

      mist.continue(state)
    }

    // Connection closed
    mist.Closed | mist.Shutdown -> {
      logging.log(logging.Info, "WebSocket closed")
      mist.stop()
    }
  }
}

/// Escape special characters for JSON string
fn escape_json_string(s: String) -> String {
  s
  |> string.replace("\\", "\\\\")
  |> string.replace("\"", "\\\"")
  |> string.replace("\n", "\\n")
  |> string.replace("\r", "\\r")
  |> string.replace("\t", "\\t")
}
