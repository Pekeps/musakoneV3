import db/connection
import envoy
import gleam/bytes_tree
import gleam/erlang/process
import gleam/http/request.{type Request}
import gleam/http/response.{type Response}
import gleam/int
import gleam/result
import gleam/string
import logging
import mist
import sqlight

type AppState {
  AppState(db: sqlight.Connection, jwt_secret: String, mopidy_url: String)
}

pub fn main() {
  logging.configure()
  logging.set_level(logging.Debug)

  let not_found =
    response.new(404)
    |> response.set_body(mist.Bytes(bytes_tree.new()))

  let port = 3001
  let db_path = "/app/data/musakone.db"

  // External configuration (from environment)
  let jwt_secret =
    envoy.get("JWT_SECRET")
    |> result.unwrap("change-this-secret-in-production")

  let mopidy_url =
    envoy.get("MOPIDY_URL")
    |> result.unwrap("http://localhost:6680")

  logging.log(logging.Info, "Starting MusakoneV3 Backend...")
  logging.log(logging.Info, "Port: " <> int.to_string(port))
  logging.log(logging.Info, "Database: " <> db_path)
  logging.log(logging.Info, "Mopidy URL: " <> mopidy_url)

  // Open database connection
  case connection.initialize(db_path) {
    Ok(db) -> {
      logging.log(logging.Info, "✓ Database connected and initialized")

      // Create app state
      let _state =
        AppState(db: db, jwt_secret: jwt_secret, mopidy_url: mopidy_url)

      // Start Mist server
      let assert Ok(_) =
        fn(req: Request(mist.Connection)) -> Response(mist.ResponseData) {
          logging.log(
            logging.Info,
            "Got a request from: "
              <> string.inspect(mist.get_client_info(req.body)),
          )
          case request.path_segments(req) {
            [] ->
              response.new(200)
              |> response.prepend_header("my-value", "abc")
              |> response.prepend_header("my-value", "123")
              |> response.set_body(mist.Bytes(bytes_tree.from_string("index")))
            _ -> not_found
          }
        }
        |> mist.new
        |> mist.bind("localhost")
        |> mist.port(port)
        |> mist.start

      process.sleep_forever()
    }
    Error(e) -> {
      logging.log(logging.Error, "✗ Failed to connect to database: " <> e)
      Nil
    }
  }
}
