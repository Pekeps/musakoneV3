import db/connection
import envoy
import gleam/erlang/process
import gleam/io
import gleam/result
import mist
import websocket/handler.{AppState}
import websocket/routes

pub fn main() {
  // Load environment variables
  let port =
    envoy.get("PORT")
    |> result.unwrap("3001")

  let jwt_secret =
    envoy.get("JWT_SECRET")
    |> result.unwrap("change-this-secret-in-production")

  let mopidy_url =
    envoy.get("MOPIDY_URL")
    |> result.unwrap("ws://mopidy:6680/mopidy/ws")

  let db_path =
    envoy.get("DATABASE_PATH")
    |> result.unwrap("/app/data/musakone.db")

  io.println("Starting MusakoneV3 Backend...")
  io.println("Port: " <> port)
  io.println("Database: " <> db_path)
  io.println("Mopidy URL: " <> mopidy_url)

  // Open database connection
  case connection.open(db_path) {
    Ok(db) -> {
      io.println("✓ Database connected and initialized")

      // Create app state
      let state =
        AppState(db: db, jwt_secret: jwt_secret, mopidy_url: mopidy_url)

      // Start Mist server
      let assert Ok(_) =
        mist.new(fn(req) { routes.handle_request(req, state) })
        |> mist.port(
          port
          |> int.parse
          |> result.unwrap(3001),
        )
        |> mist.start_http

      io.println("✓ Server started on port " <> port)
      io.println("✓ Health check: http://localhost:" <> port <> "/health")
      io.println("✓ WebSocket: ws://localhost:" <> port <> "/ws")

      // Keep the process alive
      process.sleep_forever()
    }
    Error(err) -> {
      io.println("✗ Failed to connect to database")
      io.debug(err)
      process.sleep(1000)
    }
  }
}
