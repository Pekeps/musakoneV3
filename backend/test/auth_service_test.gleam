import auth/service
import db/migrations
import gleeunit/should
import sqlight

pub fn create_user_and_authenticate_test() {
  // Setup: create in-memory database and run real migrations
  let assert Ok(db) = sqlight.open(":memory:")
  let assert Ok(_) = migrations.migrate(db, "src/db/migrations")

  // Step 1: Create user
  let assert Ok(user) = service.create_user(db, "testuser", "testpass123")
  user.username |> should.equal("testuser")

  // Step 2: Authenticate with correct credentials
  let assert Ok(authenticated_user) =
    service.authenticate(db, "testuser", "testpass123")
  authenticated_user.username |> should.equal("testuser")
  authenticated_user.id |> should.equal(user.id)
}

pub fn authenticate_wrong_password_fails_test() {
  let assert Ok(db) = sqlight.open(":memory:")
  let assert Ok(_) = migrations.migrate(db, "src/db/migrations")

  // Create user
  let assert Ok(_) = service.create_user(db, "testuser", "correctpass")

  // Try to authenticate with wrong password
  let result = service.authenticate(db, "testuser", "wrongpass")
  result |> should.be_error()
}
