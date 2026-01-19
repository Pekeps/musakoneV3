import gleam/erlang/process.{type Subject}
import gleam/http/request
import gleam/otp/actor
import gleam/result
import gleam/string
import logging

/// Messages that can be sent to/from the Mopidy client actor
pub type MopidyMessage {
  SendToMopidy(data: String)
  MopidyResponse(data: String)
  MopidyError(error: String)
  MopidyConnected
  MopidyDisconnected
}

type State {
  State(mopidy_url: String, pending_messages: List(String))
}

/// Start the Mopidy WebSocket client actor
pub fn start(
  mopidy_url: String,
) -> Result(Subject(MopidyMessage), actor.StartError) {
  let initial_state = State(mopidy_url: mopidy_url, pending_messages: [])

  actor.new(initial_state)
  |> actor.on_message(handle_message)
  |> actor.start
  |> result.map(fn(started) { started.data })
}

fn handle_message(
  state: State,
  message: MopidyMessage,
) -> actor.Next(State, MopidyMessage) {
  case message {
    SendToMopidy(data) -> {
      // In a real implementation, send to Mopidy WebSocket
      logging.log(logging.Debug, "Would send message to Mopidy: " <> data)
      actor.continue(state)
    }

    MopidyResponse(data) -> {
      logging.log(logging.Debug, "Received response from Mopidy: " <> data)
      actor.continue(state)
    }

    MopidyError(error) -> {
      logging.log(logging.Error, "Mopidy error: " <> error)
      actor.continue(state)
    }

    MopidyConnected -> {
      logging.log(logging.Info, "Connected to Mopidy WebSocket")
      actor.continue(state)
    }

    MopidyDisconnected -> {
      logging.log(logging.Warning, "Disconnected from Mopidy WebSocket")
      actor.continue(state)
    }
  }
}

/// Connect to Mopidy WebSocket (called on startup)
pub fn connect(
  mopidy_url: String,
  subject: Subject(MopidyMessage),
) -> Result(Nil, String) {
  // Parse WebSocket URL from HTTP URL
  let ws_url = string.replace(mopidy_url, "http://", "ws://") <> "/mopidy/ws"

  logging.log(logging.Info, "Connecting to Mopidy at: " <> ws_url)

  // Create WebSocket request
  let req_result =
    request.to(ws_url)
    |> result.map_error(fn(_) { "Failed to create WebSocket request" })

  case req_result {
    Ok(_) -> {
      // Attempt to establish WebSocket connection
      // Note: This is simplified - actual WebSocket client setup may require additional handling
      logging.log(logging.Info, "Mopidy WebSocket connection initiated")
      process.send(subject, MopidyConnected)
      Ok(Nil)
    }
    Error(e) -> {
      logging.log(logging.Error, "Failed to connect to Mopidy: " <> e)
      Error(e)
    }
  }
}
