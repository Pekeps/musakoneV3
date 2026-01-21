/// Mopidy WebSocket client actor
/// Connects to Mopidy once and relays messages to/from multiple browser clients
import gleam/erlang/process.{type Subject}
import gleam/int
import gleam/list
import gleam/option.{type Option, None, Some}
import gleam/otp/actor
import gleam/string
import logging
import websocket/gun_ffi.{type Connection, type Frame}

/// Messages that can be sent to/from the Mopidy client actor
pub type MopidyMessage {
  /// Send a message to Mopidy (from browser client)
  SendToMopidy(data: String)
  /// Response received from Mopidy (to be forwarded to browser)
  MopidyResponse(data: String)
  /// Error occurred
  MopidyError(error: String)
  /// Connected to Mopidy
  MopidyConnected
  /// Disconnected from Mopidy
  MopidyDisconnected
  /// Register a new browser client to receive Mopidy messages
  RegisterClient(client: Subject(MopidyMessage))
  /// Unregister a browser client
  UnregisterClient(client: Subject(MopidyMessage))
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
    connection: Option(Connection),
    clients: List(Subject(MopidyMessage)),
    is_connected: Bool,
    retry_count: Int,
    max_retries: Int,
    self: Option(Subject(MopidyMessage)),
  )
}

/// Start the Mopidy WebSocket client actor and connect to Mopidy
/// This should be called once at application startup
pub fn start(
  mopidy_url: String,
) -> Result(Subject(MopidyMessage), actor.StartError) {
  let initial_state =
    State(
      mopidy_url: mopidy_url,
      connection: None,
      clients: [],
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
      do_connect(mopidy_url, subject)
      Ok(subject)
    }
    Error(err) -> Error(err)
  }
}

/// Perform the actual connection to Mopidy
fn do_connect(url: String, self: Subject(MopidyMessage)) -> Nil {
  // Spawn a process that will own the gun connection and receive its messages
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
  // Parse URL
  case parse_ws_url(url) {
    Error(e) -> Error(e)
    Ok(#(host, port, path)) -> {
      logging.log(
        logging.Info,
        "Connecting to Mopidy at " <> host <> ":" <> int.to_string(port) <> path,
      )

      // Connect using gun FFI - THIS process will own the connection
      case gun_ffi.connect(host, port, path) {
        Ok(conn) -> {
          logging.log(logging.Debug, "Gun connection established")
          // Notify actor that connection is ready
          process.send(actor_subject, SetConnection(conn))
          // Now start receiving in THIS process (which owns the connection)
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

/// Broadcast a message to all registered clients
fn broadcast(
  clients: List(Subject(MopidyMessage)),
  message: MopidyMessage,
) -> Nil {
  list.each(clients, fn(client) { process.send(client, message) })
}

/// Handle incoming messages (state first, then message)
fn handle_message(
  state: State,
  message: MopidyMessage,
) -> actor.Next(State, MopidyMessage) {
  case message {
    // Register a new browser client
    RegisterClient(client) -> {
      logging.log(logging.Debug, "Registering new client")
      let new_clients = [client, ..state.clients]
      // If already connected, notify the new client immediately
      case state.is_connected {
        True -> process.send(client, MopidyConnected)
        False -> Nil
      }
      actor.continue(State(..state, clients: new_clients))
    }

    // Unregister a browser client
    UnregisterClient(client) -> {
      logging.log(logging.Debug, "Unregistering client")
      let new_clients = list.filter(state.clients, fn(c) { c != client })
      actor.continue(State(..state, clients: new_clients))
    }

    // Forward message to Mopidy (from any browser client)
    SendToMopidy(data) -> {
      case state.connection {
        Some(conn) -> {
          case gun_ffi.send_text(conn, data) {
            Ok(_) -> {
              logging.log(logging.Debug, "Backend -> Mopidy: " <> data)
            }
            Error(err) -> {
              logging.log(logging.Error, "Failed to send to Mopidy: " <> err)
              // Broadcast error to all clients
              broadcast(state.clients, MopidyError(err))
            }
          }
        }
        None -> {
          logging.log(logging.Warning, "Cannot send - not connected to Mopidy")
          broadcast(state.clients, MopidyError("Not connected to Mopidy"))
        }
      }
      actor.continue(state)
    }

    // Frame received from Mopidy - broadcast to all clients
    ReceivedFrame(frame) -> {
      case frame {
        gun_ffi.TextFrame(text) -> {
          logging.log(logging.Debug, "Mopidy -> Backend: " <> text)
          broadcast(state.clients, MopidyResponse(text))
          actor.continue(state)
        }
        gun_ffi.CloseFrame(_code, reason) -> {
          logging.log(logging.Warning, "Mopidy WebSocket closed: " <> reason)
          broadcast(state.clients, MopidyDisconnected)

          // Trigger reconnection
          case state.self {
            Some(self) -> schedule_reconnect(self, state.retry_count)
            None -> Nil
          }

          actor.continue(State(..state, connection: None, is_connected: False))
        }
        gun_ffi.PingFrame(_) | gun_ffi.PongFrame(_) -> {
          // Ping/pong - gun handles these automatically
          actor.continue(state)
        }
        gun_ffi.BinaryFrame(_) -> {
          logging.log(logging.Debug, "Received binary frame from Mopidy")
          actor.continue(state)
        }
      }
    }

    // Connection error - broadcast to all clients and schedule reconnect
    ConnectionError(err) -> {
      logging.log(logging.Error, "Connection error: " <> err)
      broadcast(state.clients, MopidyError(err))
      broadcast(state.clients, MopidyDisconnected)

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
      broadcast(state.clients, MopidyConnected)
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

    // These are outbound messages, shouldn't receive them here
    MopidyConnected | MopidyResponse(_) | MopidyError(_) | MopidyDisconnected -> {
      actor.continue(state)
    }
  }
}

/// Parse WebSocket URL into host, port, and path
fn parse_ws_url(url: String) -> Result(#(String, Int, String), String) {
  // Remove ws:// or wss:// prefix
  let without_scheme = case url {
    "ws://" <> rest -> Ok(#(rest, 80))
    "wss://" <> rest -> Ok(#(rest, 443))
    _ -> Error("Invalid WebSocket URL: must start with ws:// or wss://")
  }

  case without_scheme {
    Error(e) -> Error(e)
    Ok(#(rest, default_port)) -> {
      // Split by first /
      let #(host_port, path) = case string.split_once(rest, "/") {
        Ok(#(hp, p)) -> #(hp, "/" <> p)
        Error(_) -> #(rest, "/")
      }

      // Split host and port
      case string.split_once(host_port, ":") {
        Ok(#(host, port_str)) -> {
          case int.parse(port_str) {
            Ok(port) -> Ok(#(host, port, path))
            Error(_) -> Error("Invalid port number")
          }
        }
        Error(_) -> {
          // No port specified, use default
          Ok(#(host_port, default_port, path))
        }
      }
    }
  }
}

/// Connect to Mopidy WebSocket server
fn connect_to_mopidy(
  url: String,
  actor_subject: Subject(MopidyMessage),
) -> Result(Connection, String) {
  // Parse URL
  case parse_ws_url(url) {
    Error(e) -> Error(e)
    Ok(#(host, port, path)) -> {
      logging.log(
        logging.Info,
        "Connecting to Mopidy at " <> host <> ":" <> int.to_string(port) <> path,
      )

      // Connect using gun FFI
      case gun_ffi.connect(host, port, path) {
        Ok(conn) -> {
          // Start a process that receives gun messages and forwards them to actor
          start_gun_receiver(conn, actor_subject)
          Ok(conn)
        }
        Error(err) -> {
          Error("Failed to connect to Mopidy: " <> err)
        }
      }
    }
  }
}

/// Start a process that receives gun WebSocket messages via erlang receive
/// This process owns the connection and receives gun messages
fn start_gun_receiver(
  conn: Connection,
  actor_subject: Subject(MopidyMessage),
) -> Nil {
  let _ =
    process.spawn(fn() {
      logging.log(logging.Debug, "Gun receiver started")
      gun_receiver_loop(conn, actor_subject)
    })
  Nil
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
