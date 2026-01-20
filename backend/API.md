# MusakoneV3 Backend API

Backend server for MusakoneV3 - runs on port **3001**

## Health Check

### `GET /api/health`
Check server status.

**Response:**
```json
{
  "status": "ok",
  "service": "musakone-backend",
  "timestamp": 1705708800
}
```

---

## Authentication

### `POST /api/auth/register`
Create a new user account.

**Body:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response (201):**
```json
{
  "id": 1,
  "username": "string",
  "created_at": 1705708800
}
```

### `POST /api/auth/login`
Authenticate and receive JWT token.

**Body:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response (200):**
```json
{
  "token": "eyJhbGc...",
  "user": {
    "id": 1,
    "username": "string",
    "created_at": 1705708800
  }
}
```

### `GET /api/auth/me`
Get current authenticated user info.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "id": 1,
  "authenticated": true
}
```

---

## Analytics

All analytics endpoints require authentication.

### `POST /api/analytics/actions`
Log a user action (play, pause, skip, etc).

**Headers:**
```
Authorization: Bearer <token>
```

**Body:**
```json
{
  "action_type": "play",
  "track_uri": "spotify:track:abc123",
  "track_name": "Song Title",
  "metadata": "{\"album\": \"Album Name\"}"
}
```

**Response (200):**
```json
{
  "success": true
}
```

### `GET /api/analytics/actions`
Get user's action history (last 100 actions).

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
[
  {
    "id": 1,
    "action_type": "play",
    "track_uri": "spotify:track:abc123",
    "track_name": "Song Title",
    "metadata": null,
    "timestamp": 1705708800
  }
]
```

### `GET /api/analytics/stats`
Get aggregated statistics for user.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "play": 150,
  "pause": 45,
  "skip": 23,
  "search": 12
}
```

---

## WebSocket

### `WS /ws`
Real-time connection for Mopidy communication.

**Protocol:** WebSocket  
**Messages:** JSON-RPC 2.0 (Mopidy format)

Connect to forward commands to Mopidy server and receive real-time updates.

**Example (send):**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "core.playback.play"
}
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "error": "Error message description"
}
```

**Common status codes:**
- `400` - Bad Request (invalid JSON or missing fields)
- `401` - Unauthorized (missing or invalid token)
- `404` - Not Found
- `409` - Conflict (e.g., username already exists)
- `500` - Internal Server Error

---

## Environment Variables

```bash
JWT_SECRET=your-secret-key-change-in-production
MOPIDY_URL=http://mopidy:6680
```

## CORS

All endpoints support CORS with:
- Origin: `*`
- Methods: `GET, POST, PUT, DELETE, OPTIONS`
- Headers: `content-type, authorization`
