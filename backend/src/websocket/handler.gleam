/// WebSocket handler for browser client connections
/// Subscribes to event bus for Mopidy events, sends commands through event bus
/// No direct knowledge of the Mopidy client
import event_bus.{type BusMessage, type MopidyEvent}
import gleam/erlang/process.{type Subject}
import gleam/http/request.{type Request}
import gleam/http/response
import gleam/option.{Some}
import gleam/string
import logging
import mist.{type ResponseData, type WebsocketConnection, type WebsocketMessage}

/// State for each WebSocket connection
pub type WsState {
  WsState(
    event_bus: Subject(BusMessage),
    event_subject: Subject(MopidyEvent),
  )
}

/// WebSocket handler for client connections
pub fn handle_websocket(
  req: Request(mist.Connection),
  event_bus: Subject(BusMessage),
) -> response.Response(ResponseData) {
  mist.websocket(
    request: req,
    on_init: fn(_conn) { init_websocket(event_bus) },
    on_close: fn(state) {
      logging.log(
        logging.Info,
        "WebSocket connection closed, unsubscribing from event bus",
      )
      // Unsubscribe from the event bus
      event_bus.unsubscribe(state.event_bus, state.event_subject)
      Nil
    },
    handler: handle_message,
  )
}

/// Initialize WebSocket connection and subscribe to event bus
fn init_websocket(
  bus: Subject(BusMessage),
) -> #(WsState, option.Option(process.Selector(MopidyEvent))) {
  logging.log(logging.Info, "New WebSocket connection established")

  // Create a subject to receive events from the bus
  let event_subject = process.new_subject()

  // Subscribe to Mopidy events
  event_bus.subscribe(bus, event_subject)

  let state = WsState(event_bus: bus, event_subject: event_subject)

  // Set up selector to receive events
  let selector =
    process.new_selector()
    |> process.select(event_subject)

  #(state, Some(selector))
}

/// Handle incoming WebSocket messages
fn handle_message(
  state: WsState,
  message: WebsocketMessage(MopidyEvent),
  conn: WebsocketConnection,
) -> mist.Next(WsState, MopidyEvent) {
  case message {
    // Text message from browser - send command to Mopidy via event bus
    mist.Text(text) -> {
      logging.log(logging.Debug, "Browser -> Backend: " <> text)
      event_bus.send_command(state.event_bus, event_bus.SendMessage(text))
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

    // Event from event bus - forward to browser
    mist.Custom(event) -> {
      case event {
        event_bus.MessageReceived(data) -> {
          logging.log(logging.Debug, "Mopidy -> Browser: " <> data)
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

        event_bus.Error(error) -> {
          logging.log(logging.Error, "Mopidy error: " <> error)
          let error_json =
            "{\"error\": \"" <> escape_json_string(error) <> "\"}"
          let _ = mist.send_text_frame(conn, error_json)
          Nil
        }

        event_bus.Connected -> {
          logging.log(logging.Info, "Mopidy connection established")
          let _ =
            mist.send_text_frame(conn, "{\"event\": \"mopidy_connected\"}")
          Nil
        }

        event_bus.Disconnected -> {
          logging.log(logging.Warning, "Mopidy connection lost")
          let _ =
            mist.send_text_frame(conn, "{\"event\": \"mopidy_disconnected\"}")
          Nil
        }
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
