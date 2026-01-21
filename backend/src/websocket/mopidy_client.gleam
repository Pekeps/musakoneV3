/// Mopidy WebSocket client actor
/// Connects to Mopidy and publishes events to the event bus
/// No direct knowledge of browser clients
import event_bus.{type BusMessage, type MopidyCommand}
import gleam/erlang/process.{type Subject}
import gleam/int
import gleam/option.{type Option, None, Some}
import gleam/otp/actor
import gleam/string
import logging
import websocket/gun_ffi.{type Connection, type Frame}

/// Internal messages for the Mopidy client actor
pub type MopidyMessage {
  /// Command received (from event bus)
  Command(cmd: MopidyCommand)
  /// Internal: frame received from Mopidy
  ReceivedFrame(frame: Frame)
  /// Internal: connection error
  ConnectionError(error: String)
  /// Internal: store the connection after successful connect
  SetConnection(conn: Connection)
  /// Internal: attempt reconnection
  AttemptReconnect
  /// Internal: store self reference for reconnection
  StoreSelfReference(self: Subject(MopidyMessage))
}

/// State for the Mopidy client actor
pub opaque type State {
  State(
    mopidy_url: String,
    event_bus: Subject(BusMessage),
    connection: Option(Connection),
    is_connected: Bool,
    retry_count: Int,
    max_retries: Int,
    self: Option(Subject(MopidyMessage)),
  )
}

/// Start the Mopidy WebSocket client actor and connect to Mopidy
/// Takes an event bus reference to publish events to
pub fn start(
  mopidy_url: String,
  event_bus: Subject(BusMessage),
) -> Result(Subject(MopidyMessage), actor.StartError) {
  let initial_state =
    State(
      mopidy_url: mopidy_url,
      event_bus: event_bus,
      connection: None,
      is_connected: False,
      retry_count: 0,
      max_retries: 10,
      self: None,
    )

  // Start the actor
  let actor_result =
    actor.new(initial_state)
    |> actor.on_message(handle_message)
    |> actor.start

  case actor_result {
    Ok(started) -> {
      let subject = started.data

      // Store self reference for reconnection
      process.send(subject, StoreSelfReference(subject))

      // Create a command subject that wraps commands for this actor
      let command_subject = create_command_bridge(subject)

      // Register as command handler with the event bus
      event_bus.register_command_handler(event_bus, command_subject)

      // Start the connection
      do_connect(mopidy_url, subject)

      Ok(subject)
    }
    Error(err) -> Error(err)
  }
}

/// Create a bridge that receives MopidyCommand and forwards to the actor
/// Returns a subject that can be used to send commands
fn create_command_bridge(
  actor_subject: Subject(MopidyMessage),
) -> Subject(MopidyCommand) {
  // Create a subject for the parent to send the command_subject back
  let parent_subject: Subject(Subject(MopidyCommand)) = process.new_subject()

  // Spawn a process that creates its own subject and runs the receive loop
  let _ =
    process.spawn(fn() {
      // Create the subject IN THIS PROCESS so we can receive on it
      let command_subject = process.new_subject()
      // Send it back to the parent
      process.send(parent_subject, command_subject)
      // Now run the receive loop
      command_bridge_loop(command_subject, actor_subject)
    })

  // Wait for the child to send us its subject
  let assert Ok(command_subject) = process.receive(parent_subject, 5000)
  command_subject
}

/// Loop that receives commands and forwards them to the actor
fn command_bridge_loop(
  command_subject: Subject(MopidyCommand),
  actor_subject: Subject(MopidyMessage),
) -> Nil {
  // Use blocking receive - this process just bridges commands to the actor
  let cmd = process.receive(command_subject, 60_000)
  case cmd {
    Ok(c) -> {
      process.send(actor_subject, Command(c))
      command_bridge_loop(command_subject, actor_subject)
    }
    Error(_) -> {
      // Timeout, continue waiting
      command_bridge_loop(command_subject, actor_subject)
    }
  }
}

/// Perform the actual connection to Mopidy
fn do_connect(url: String, self: Subject(MopidyMessage)) -> Nil {
  let _ =
    process.spawn(fn() {
      case connect_and_receive(url, self) {
        Ok(_) -> Nil
        Error(err) -> {
          logging.log(logging.Error, "Connection process failed: " <> err)
          process.send(self, ConnectionError(err))
        }
      }
    })
  Nil
}

/// Connect to Mopidy in this process and start receiving messages
fn connect_and_receive(
  url: String,
  actor_subject: Subject(MopidyMessage),
) -> Result(Nil, String) {
  case parse_ws_url(url) {
    Error(e) -> Error(e)
    Ok(#(host, port, path)) -> {
      logging.log(
        logging.Info,
        "Connecting to Mopidy at " <> host <> ":" <> int.to_string(port) <> path,
      )

      case gun_ffi.connect(host, port, path) {
        Ok(conn) -> {
          logging.log(logging.Debug, "Gun connection established")
          process.send(actor_subject, SetConnection(conn))
          gun_receiver_loop(conn, actor_subject)
          Ok(Nil)
        }
        Error(err) -> {
          Error("Failed to connect to Mopidy: " <> err)
        }
      }
    }
  }
}

/// Calculate backoff delay in milliseconds using exponential backoff
fn calculate_backoff(retry_count: Int) -> Int {
  let base_delay = 1000
  let max_delay = 30_000
  let delay = base_delay * int.bitwise_shift_left(1, retry_count)
  case delay > max_delay {
    True -> max_delay
    False -> delay
  }
}

/// Schedule a reconnection attempt after a delay
fn schedule_reconnect(self: Subject(MopidyMessage), retry_count: Int) -> Nil {
  let delay = calculate_backoff(retry_count)
  logging.log(
    logging.Info,
    "Scheduling reconnection attempt in "
      <> int.to_string(delay)
      <> "ms (attempt "
      <> int.to_string(retry_count + 1)
      <> ")",
  )

  let _ =
    process.spawn(fn() {
      process.sleep(delay)
      process.send(self, AttemptReconnect)
    })
  Nil
}

/// Handle incoming messages
fn handle_message(
  state: State,
  message: MopidyMessage,
) -> actor.Next(State, MopidyMessage) {
  case message {
    // Command received from event bus - forward to Mopidy
    Command(cmd) -> {
      case cmd {
        event_bus.SendMessage(data) -> {
          case state.connection {
            Some(conn) -> {
              case gun_ffi.send_text(conn, data) {
                Ok(_) -> {
                  logging.log(logging.Debug, "Backend -> Mopidy: " <> data)
                }
                Error(err) -> {
                  logging.log(
                    logging.Error,
                    "Failed to send to Mopidy: " <> err,
                  )
                  event_bus.publish(state.event_bus, event_bus.Error(err))
                }
              }
            }
            None -> {
              logging.log(
                logging.Warning,
                "Cannot send - not connected to Mopidy",
              )
              event_bus.publish(
                state.event_bus,
                event_bus.Error("Not connected to Mopidy"),
              )
            }
          }
        }
      }
      actor.continue(state)
    }

    // Frame received from Mopidy - publish to event bus
    ReceivedFrame(frame) -> {
      case frame {
        gun_ffi.TextFrame(text) -> {
          logging.log(logging.Debug, "Mopidy -> Backend: " <> text)
          event_bus.publish(state.event_bus, event_bus.MessageReceived(text))
          actor.continue(state)
        }
        gun_ffi.CloseFrame(_code, reason) -> {
          logging.log(logging.Warning, "Mopidy WebSocket closed: " <> reason)
          event_bus.publish(state.event_bus, event_bus.Disconnected)

          // Trigger reconnection
          case state.self {
            Some(self) -> schedule_reconnect(self, state.retry_count)
            None -> Nil
          }

          actor.continue(State(..state, connection: None, is_connected: False))
        }
        gun_ffi.PingFrame(_) | gun_ffi.PongFrame(_) -> {
          actor.continue(state)
        }
        gun_ffi.BinaryFrame(_) -> {
          logging.log(logging.Debug, "Received binary frame from Mopidy")
          actor.continue(state)
        }
      }
    }

    // Connection error - publish to event bus and schedule reconnect
    ConnectionError(err) -> {
      logging.log(logging.Error, "Connection error: " <> err)
      event_bus.publish(state.event_bus, event_bus.Error(err))
      event_bus.publish(state.event_bus, event_bus.Disconnected)

      // Schedule reconnection if under max retries
      let new_retry_count = state.retry_count + 1
      case new_retry_count <= state.max_retries, state.self {
        True, Some(self) -> {
          schedule_reconnect(self, state.retry_count)
          actor.continue(
            State(
              ..state,
              connection: None,
              is_connected: False,
              retry_count: new_retry_count,
            ),
          )
        }
        True, None -> {
          logging.log(logging.Error, "Cannot reconnect: self reference not set")
          actor.continue(State(..state, connection: None, is_connected: False))
        }
        False, _ -> {
          logging.log(
            logging.Error,
            "Max reconnection attempts ("
              <> int.to_string(state.max_retries)
              <> ") reached. Giving up.",
          )
          actor.continue(State(..state, connection: None, is_connected: False))
        }
      }
    }

    // Internal message to store the connection
    SetConnection(conn) -> {
      logging.log(logging.Info, "✓ Mopidy client started")
      // Reset retry count on successful connection
      event_bus.publish(state.event_bus, event_bus.Connected)
      actor.continue(
        State(
          ..state,
          connection: Some(conn),
          is_connected: True,
          retry_count: 0,
        ),
      )
    }

    // Attempt reconnection
    AttemptReconnect -> {
      logging.log(
        logging.Info,
        "Attempting to reconnect to Mopidy (attempt "
          <> int.to_string(state.retry_count + 1)
          <> ")",
      )
      case state.self {
        Some(self) -> {
          do_connect(state.mopidy_url, self)
          actor.continue(state)
        }
        None -> {
          logging.log(logging.Error, "Cannot reconnect: self reference not set")
          actor.continue(state)
        }
      }
    }

    // Store self reference for reconnection
    StoreSelfReference(self) -> {
      actor.continue(State(..state, self: Some(self)))
    }
  }
}

/// Parse WebSocket URL into host, port, and path
fn parse_ws_url(url: String) -> Result(#(String, Int, String), String) {
  let without_scheme = case url {
    "ws://" <> rest -> Ok(#(rest, 80))
    "wss://" <> rest -> Ok(#(rest, 443))
    _ -> Error("Invalid WebSocket URL: must start with ws:// or wss://")
  }

  case without_scheme {
    Error(e) -> Error(e)
    Ok(#(rest, default_port)) -> {
      let #(host_port, path) = case string.split_once(rest, "/") {
        Ok(#(hp, p)) -> #(hp, "/" <> p)
        Error(_) -> #(rest, "/")
      }

      case string.split_once(host_port, ":") {
        Ok(#(host, port_str)) -> {
          case int.parse(port_str) {
            Ok(port) -> Ok(#(host, port, path))
            Error(_) -> Error("Invalid port number")
          }
        }
        Error(_) -> {
          Ok(#(host_port, default_port, path))
        }
      }
    }
  }
}

/// Loop that receives gun messages and forwards as frames
fn gun_receiver_loop(
  conn: Connection,
  actor_subject: Subject(MopidyMessage),
) -> Nil {
  logging.log(logging.Debug, "Gun receiver: waiting for frame...")
  case gun_ffi.receive_frame(conn, 60_000) {
    Ok(frame) -> {
      logging.log(logging.Debug, "Gun receiver: got frame!")
      process.send(actor_subject, ReceivedFrame(frame))
      case frame {
        gun_ffi.CloseFrame(_, _) -> {
          logging.log(logging.Debug, "Gun receiver: close frame, stopping")
          Nil
        }
        _ -> gun_receiver_loop(conn, actor_subject)
      }
    }
    Error(err) -> {
      case err {
        "timeout" -> {
          logging.log(logging.Debug, "Gun receiver: timeout, continuing...")
          gun_receiver_loop(conn, actor_subject)
        }
        _ -> {
          logging.log(logging.Error, "Gun receiver error: " <> err)
          process.send(actor_subject, ConnectionError(err))
        }
      }
    }
  }
}
