import gleam/erlang/process.{type Subject}
import gleam/http/request.{type Request}
import gleam/http/response
import gleam/option.{None}
import gleam/string
import logging
import mist.{type ResponseData, type WebsocketConnection, type WebsocketMessage}
import websocket/mopidy_client

pub type ClientMessage {
  ClientMessage(user_id: String, message: String)
}

pub type ServerMessage {
  MopidyResponse(data: String)
  Error(message: String)
}

/// WebSocket handler for client connections
pub fn handle_websocket(
  req: Request(mist.Connection),
  mopidy_url: String,
) -> response.Response(ResponseData) {
  mist.websocket(
    request: req,
    on_init: fn(_conn) { init_websocket(mopidy_url) },
    on_close: fn(_state) {
      logging.log(logging.Info, "WebSocket connection closed")
      Nil
    },
    handler: handle_message,
  )
}

fn init_websocket(
  mopidy_url: String,
) -> #(
  Subject(mopidy_client.MopidyMessage),
  option.Option(process.Selector(mopidy_client.MopidyMessage)),
) {
  logging.log(logging.Info, "New WebSocket connection established")

  // Start Mopidy client actor
  let assert Ok(mopidy_subject) = mopidy_client.start(mopidy_url)

  #(mopidy_subject, None)
}

fn handle_message(
  state: Subject(mopidy_client.MopidyMessage),
  message: WebsocketMessage(mopidy_client.MopidyMessage),
  _conn: WebsocketConnection,
) -> mist.Next(
  Subject(mopidy_client.MopidyMessage),
  mopidy_client.MopidyMessage,
) {
  case message {
    mist.Text(text) -> {
      logging.log(logging.Debug, "Received WebSocket message: " <> text)

      // Forward to Mopidy
      process.send(state, mopidy_client.SendToMopidy(text))

      mist.continue(state)
    }

    mist.Binary(data) -> {
      logging.log(
        logging.Debug,
        "Received binary message: " <> string.inspect(data),
      )
      mist.continue(state)
    }

    mist.Custom(msg) -> {
      // Handle custom messages from Mopidy client
      case msg {
        mopidy_client.MopidyResponse(_data) -> {
          logging.log(logging.Debug, "Forwarding Mopidy response to client")
          // Note: In a full implementation, we'd send this back to the WebSocket client
          Nil
        }
        mopidy_client.MopidyError(error) -> {
          logging.log(logging.Error, "Mopidy error: " <> error)
          Nil
        }
        _ -> Nil
      }

      mist.continue(state)
    }

    mist.Closed | mist.Shutdown -> {
      logging.log(logging.Info, "WebSocket closed")
      mist.stop()
    }
  }
}
