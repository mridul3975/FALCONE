# Product Requirements Document (PRD)

## 1. Objectives

- Implement a fully functional WebSocket chat backend using Bun.
- Use Better Auth for robust, modern, and low-boilerplate authentication.
- Focus on core message delivery, connection management, and data consistency.
- Maintain an extremely lightweight dependency tree (Bun, SQLite, Better Auth).

## 2. System Architecture

| Layer | Technology |
|---|---|
| Backend Runtime | Bun |
| Database | Bun native SQLite (bun:sqlite) |
| Authentication | Better Auth (sessions, cookies, password hashing) |
| WebSocket Engine | Bun native WebSocketServer |
| Linter/Formatter | Biome |

## 3. API Endpoints (REST)

### Better Auth Endpoints (Managed)

| Method | Endpoint | Description |
|---|---|---|
| POST | /api/auth/sign-up/email | Register a user (creates user and account) |
| POST | /api/auth/sign-in/email | Authenticate and return session cookie/token |
| POST | /api/auth/sign-out | Destroy session |

### Custom App Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | /messages/:withUserId | Fetch historical 1-to-1 chat |
| GET | /rooms | List all rooms |
| POST | /rooms/create | Create a new room |

## 4. Data Model (SQLite)

### Auth Tables (Better Auth Managed)

- user (id, name, email, emailVerified, image, ...)
- session (id, token, expiresAt, userId, ...)
- account (credentials and OAuth links)
- verification (email/password reset tokens)

### Chat Tables (Custom)

- rooms (id, name, createdAt)
- room_members (roomId, userId)
- messages (id, senderId, receiverId, roomId, text, status, timestamp)

## 5. Directory Structure

```text
src/
	auth/
		auth.ts          # Better Auth initialization
	chat/
		chat.server.ts   # WebSocket handlers (upcoming)
		messages.repo.ts # Message DB queries (upcoming)
		rooms.repo.ts    # Room DB queries (upcoming)
	db/
		connection.ts    # SQLite instance
		models.ts        # SQL table creation and migrations
	utils/
		logger.ts
		helpers.ts
	server.ts          # Entry point and HTTP routing
```

## 6. Development Phases

- Phase 1 (Completed): Setup Bun, DB connection, and Better Auth REST routes.
- Phase 2 (In Progress): Implement WebSocket session auth during upgrade handshake.
- Phase 3 (Planned): Basic private chat (live send/receive).
- Phase 4 (Planned): Message persistence in SQLite.
- Phase 5 (Planned): Group rooms (join, leave, broadcast workflows).