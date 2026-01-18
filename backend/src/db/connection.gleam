import db/migrations
import gleam/result
import gleam/string
import logging
import sqlight

pub fn initialize(db_path: String) -> Result(sqlight.Connection, String) {
  use db <- result.try(
    sqlight.open(db_path)
    |> result.map_error(fn(e) {
      logging.log(logging.Error, string.inspect(e))
      "Failed to open database: " <> e.message
    }),
  )

  // Run migrations
  use _ <- result.try(migrations.migrate(db, "src/db/migrations"))

  Ok(db)
}
