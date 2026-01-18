import gleam/result
import sqlight

/// Initialize database schema for user tracking and authentication
pub fn init(db: sqlight.Connection) -> Result(Nil, sqlight.Error) {
  // Users table for authentication
  sqlight.exec(
    "
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      last_login INTEGER
    )
    ",
    db,
  )
  |> result.try(fn(_) {
    // User actions table for tracking
    sqlight.exec(
      "
      CREATE TABLE IF NOT EXISTS user_actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        action_type TEXT NOT NULL,
        track_uri TEXT,
        track_name TEXT,
        artist TEXT,
        position_ms INTEGER,
        metadata TEXT,
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
      CREATE INDEX IF NOT EXISTS idx_user_actions_user_id ON user_actions(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_actions_timestamp ON user_actions(timestamp);
      CREATE INDEX IF NOT EXISTS idx_user_actions_type ON user_actions(action_type);
      ",
      db,
    )
  })
  |> result.try(fn(_) {
    // Sessions table for JWT token management
    sqlight.exec(
      "
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
      CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
      CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
      ",
      db,
    )
  })
  |> result.try(fn(_) {
    // Create default admin user if not exists (password: admin)
    // In production, this should be changed immediately
    sqlight.exec(
      "
      INSERT OR IGNORE INTO users (username, password_hash, created_at)
      VALUES ('admin', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5UpTrJN3QrPyW', strftime('%s', 'now'))
      ",
      db,
    )
  })
}

/// Clean up expired sessions
pub fn cleanup_expired_sessions(
  db: sqlight.Connection,
) -> Result(Nil, sqlight.Error) {
  sqlight.exec(
    "
    DELETE FROM sessions
    WHERE expires_at < strftime('%s', 'now')
    ",
    db,
  )
}
