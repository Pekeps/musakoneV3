import gleam/dynamic
import gleam/erlang/process.{type Subject}
import gleam/json
import gleam/option.{type Option, None, Some}
import gleam/otp/actor
import gleam/result
import mist

pub type MopidyMessage {
  JsonRpcRequest(id: Int, method: String, params: Option(json.Json))
  JsonRpcResponse(id: Int, result: json.Json)
  JsonRpcError(id: Int, error: String)
  Event(event: String, data: json.Json)
}

pub type MopidyClient {
  MopidyClient(
    url: String,
    websocket: Option(Subject(MopidyMessage)),
    connected: Bool,
  )
}

/// Create a new Mopidy client
pub fn new(url: String) -> MopidyClient {
  MopidyClient(url: url, websocket: None, connected: False)
}

/// Connect to Mopidy WebSocket
pub fn connect(client: MopidyClient) -> Result(MopidyClient, String) {
  // In a real implementation, this would establish a WebSocket connection
  // to the Mopidy server. For now, we'll return a placeholder.
  // This requires using the glisten library for WebSocket client functionality

  Ok(MopidyClient(..client, connected: True))
}

/// Send a JSON-RPC request to Mopidy
pub fn send_request(
  client: MopidyClient,
  id: Int,
  method: String,
  params: Option(json.Json),
) -> Result(Nil, String) {
  case client.websocket {
    Some(ws) -> {
      // Send message to WebSocket
      // process.send(ws, JsonRpcRequest(id: id, method: method, params: params))
      Ok(Nil)
    }
    None -> Error("Not connected to Mopidy")
  }
}

/// Parse incoming message from Mopidy
pub fn parse_message(raw: String) -> Result(MopidyMessage, String) {
  // Parse JSON-RPC message
  // This is a simplified implementation
  Ok(Event(event: "unknown", data: json.null()))
}
