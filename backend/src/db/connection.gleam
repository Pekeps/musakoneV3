import db/schema
import gleam/result
import sqlight

/// Open database connection and initialize schema
pub fn open(path: String) -> Result(sqlight.Connection, sqlight.Error) {
  sqlight.open(path)
  |> result.try(fn(db) {
    schema.init(db)
    |> result.map(fn(_) { db })
  })
}

/// Execute a query with parameters
pub fn query(
  db: sqlight.Connection,
  sql: String,
  params: List(sqlight.Value),
  decoder: fn(sqlight.Row) -> Result(a, sqlight.Error),
) -> Result(List(a), sqlight.Error) {
  sqlight.query(sql, db, params, decoder)
}

/// Execute a statement without returning results
pub fn exec(db: sqlight.Connection, sql: String) -> Result(Nil, sqlight.Error) {
  sqlight.exec(sql, db)
}
