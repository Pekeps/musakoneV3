import birl
import gleam/int
import gleam/json
import gleam/result
import sqlight

pub type UserAction {
  UserAction(
    user_id: Int,
    action_type: String,
    track_uri: String,
    track_name: String,
    artist: String,
    position_ms: Int,
    metadata: String,
  )
}

/// Log a user action to the database
pub fn log_action(
  db: sqlight.Connection,
  action: UserAction,
) -> Result(Nil, String) {
  let timestamp = birl.now() |> birl.to_unix()

  let sql =
    "
    INSERT INTO user_actions (
      user_id, action_type, track_uri, track_name, artist,
      position_ms, metadata, timestamp
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    "

  sqlight.exec(sql, db)
  |> result.map_error(fn(_) { "Failed to log action" })
}

/// Get user action history
pub fn get_user_history(
  db: sqlight.Connection,
  user_id: Int,
  limit: Int,
) -> Result(List(UserAction), String) {
  let sql =
    "
    SELECT user_id, action_type, track_uri, track_name, artist,
           position_ms, metadata
    FROM user_actions
    WHERE user_id = ?
    ORDER BY timestamp DESC
    LIMIT ?
    "

  sqlight.query(sql, db, [sqlight.int(user_id), sqlight.int(limit)], fn(row) {
    case row {
      [
        sqlight.Integer(uid),
        sqlight.Text(action_type),
        sqlight.Text(track_uri),
        sqlight.Text(track_name),
        sqlight.Text(artist),
        sqlight.Integer(position_ms),
        sqlight.Text(metadata),
      ] ->
        Ok(UserAction(
          user_id: uid,
          action_type: action_type,
          track_uri: track_uri,
          track_name: track_name,
          artist: artist,
          position_ms: position_ms,
          metadata: metadata,
        ))
      _ -> Error(sqlight.UnexpectedResultType)
    }
  })
  |> result.map_error(fn(_) { "Failed to get history" })
}

/// Get user statistics
pub fn get_user_stats(
  db: sqlight.Connection,
  user_id: Int,
) -> Result(json.Json, String) {
  let sql =
    "
    SELECT
      COUNT(*) as total_actions,
      COUNT(CASE WHEN action_type = 'play' THEN 1 END) as plays,
      COUNT(CASE WHEN action_type = 'pause' THEN 1 END) as pauses,
      COUNT(CASE WHEN action_type = 'skip' THEN 1 END) as skips
    FROM user_actions
    WHERE user_id = ?
    "

  sqlight.query(sql, db, [sqlight.int(user_id)], fn(row) {
    case row {
      [
        sqlight.Integer(total),
        sqlight.Integer(plays),
        sqlight.Integer(pauses),
        sqlight.Integer(skips),
      ] ->
        Ok(
          json.object([
            #("total_actions", json.int(total)),
            #("plays", json.int(plays)),
            #("pauses", json.int(pauses)),
            #("skips", json.int(skips)),
          ]),
        )
      _ -> Error(sqlight.UnexpectedResultType)
    }
  })
  |> result.then(fn(stats) {
    case stats {
      [stat] -> Ok(stat)
      _ -> Error("No stats found")
    }
  })
  |> result.map_error(fn(_) { "Failed to get stats" })
}
