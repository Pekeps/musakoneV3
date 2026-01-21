import auth/service
import db/connection
import gleeunit/should
import logging

pub fn create_user_and_authenticate_test() {
  let assert Ok(db) = connection.initialize(":memory:")

  // Step 1: Create user
  let assert Ok(user) = service.create_user(db, "testuser", "testpass123")
  user.username |> should.equal("testuser")

  // Step 2: Authenticate with correct credentials
  let assert Ok(authenticated_user) =
    service.authenticate(db, "testuser", "testpass123")
  authenticated_user.username |> should.equal("testuser")
  authenticated_user.id |> should.equal(user.id)

  logging.log(logging.Info, "User creation and authentication test passed.")
}

pub fn authenticate_wrong_password_fails_test() {
  let assert Ok(db) = connection.initialize(":memory:")
  // Create user
  let assert Ok(_) = service.create_user(db, "testuser", "correctpass")

  // Try to authenticate with wrong password
  let result = service.authenticate(db, "testuser", "wrongpass")
  result |> should.be_error()

  logging.log(logging.Info, "Authentication with wrong password test passed.")
}
