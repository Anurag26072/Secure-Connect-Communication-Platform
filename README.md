
# 🔐 Secure Connect & Communication Platform

> **Web Dev III · Unit 4 · Lab Practical Evaluation**  
> A secure backend communication platform with JWT authentication, role-based access control, personal notes CRUD, administrative APIs, persistent JSON storage, and real-time room-based chat.

---

## Executive Summary

**Secure Connect** is a Node.js and Express-based communication platform that combines a REST API with real-time chat. Users can register and log in, manage their own notes, and communicate in Socket.IO rooms. Administrators have access to user management, a global notes view, and an activity feed.

Authentication is implemented using JWT and password hashing with `bcrypt`. Access to protected resources is controlled through authentication middleware and role-based authorization. The application uses a lightweight JSON-file document store for persistent users, notes, and messages, so it can run locally without installing a separate database server.

The included browser client provides a practical interface for signup, login, note management, and room chat, while the API can also be tested with Postman.

---

## System Architecture

```text
┌────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                            │
│             Browser UI  ·  Postman  ·  Socket.IO Client           │
└──────────────────────────────┬─────────────────────────────────────┘
                               │ HTTP / WebSocket
                               ▼
┌────────────────────────────────────────────────────────────────────┐
│                       EXPRESS APPLICATION                          │
│  Static Client · REST Routes · JSON Parsing · Error Handling       │
└──────────────────────────────┬─────────────────────────────────────┘
                               │
             ┌─────────────────┼───────────────────┐
             ▼                 ▼                   ▼
     ┌──────────────┐  ┌────────────────┐  ┌───────────────────┐
     │ AUTH ROUTES  │  │ NOTES ROUTES   │  │ ADMIN ROUTES      │
     │ Signup/Login │  │ CRUD & Ownership│  │ Users/Notes/Feed  │
     └──────┬───────┘  └────────┬───────┘  └─────────┬─────────┘
            └───────────────────┼────────────────────┘
                                ▼
                  ┌─────────────────────────┐
                  │ AUTHENTICATION & RBAC   │
                  │ JWT · bcrypt · Roles    │
                  └────────────┬────────────┘
                               │
             ┌─────────────────┴─────────────────┐
             ▼                                    ▼
┌────────────────────────────┐      ┌────────────────────────────┐
│ SOCKET.IO REAL-TIME ENGINE │      │ NODE.JS EVENTEMITTER       │
│ JWT Handshake · Rooms       │      │ Activity/Audit Feed        │
│ Chat · Typing · History     │      │ Domain Event Listeners      │
└──────────────┬─────────────┘      └──────────────┬─────────────┘
               └──────────────────┬─────────────────┘
                                  ▼
                    ┌─────────────────────────┐
                    │ PERSISTENT JSON STORE   │
                    │ data/db.json            │
                    │ Users · Notes · Messages│
                    └─────────────────────────┘
```

---

## Architectural Highlights

### Authentication without third-party auth kits

Signup, login, token generation, and token verification are implemented using Express middleware and `jsonwebtoken`. Passwords are hashed with `bcrypt`; plaintext passwords are not returned in API responses or stored in the users collection.

### Stateless JWT verification

Protected REST requests can provide a JWT using an `Authorization: Bearer <token>` header or the `token` cookie. The middleware verifies the token and loads the current user from the store. Socket.IO connections use the same JWT verification logic during the handshake.

### Role-Based Access Control (RBAC)

Users receive a `user` role by default. The configured `ADMIN_EMAIL` is assigned the `admin` role at signup. Admin-only endpoints are guarded by authorization middleware, and note operations enforce ownership checks (with admin access permitted).

### Room-partitioned communication

Socket.IO clients join the `general` room by default and can join other valid room names. Messages are broadcast to the selected room, and room history is returned when a client joins. Room names are validated, and messages must contain 1–1000 characters.

### Event-driven activity logging

The internal Node.js `EventEmitter` publishes events such as user registration, login, note creation/update/deletion, chat messages, and socket connection activity. Listeners maintain an in-memory activity feed (up to 100 entries), exposed to administrators.

### Lightweight persistent storage

The project uses a custom JSON-file document store at `data/db.json`. It generates 24-character hexadecimal IDs and timestamps, and persists data without requiring MongoDB or another database server.

---

## Technology Stack

| Technology | Role in the Project |
|---|---|
| Node.js | Runtime environment |
| Express.js | REST API and static client server |
| Socket.IO | Real-time chat and room communication |
| `jsonwebtoken` | JWT signing and verification |
| `bcrypt` | Password hashing |
| `dotenv` | Environment configuration |
| Node.js `EventEmitter` | Internal event bus and activity logging |
| JSON file store | Persistent user, note, and message data |
| Postman | API verification |
| `socket.io-client` | Socket.IO integration tests |

---

## Getting Started

### Requirements

Install Node.js and npm on your system before running the application.

### Installation

Clone the repository and enter the project directory:

```bash
git clone https://github.com/YOUR-USERNAME/secure-connect.git
cd secure-connect
npm install
```

### Environment Configuration

Create a `.env` file in the root directory using `.env.example` as a template:

```env
PORT=5000
JWT_SECRET=replace_with_a_long_random_secret
JWT_EXPIRES_IN=1h
BCRYPT_SALT_ROUNDS=10
ADMIN_EMAIL=admin@example.com
DB_FILE=./data/db.json
```

Use your own secret value for `JWT_SECRET`. Do not commit `.env` or credentials to GitHub. A user who registers using the email configured in `ADMIN_EMAIL` is assigned the `admin` role.

### Start the Server

```bash
npm start
```

The server starts at:

**http://localhost:5000**

Open this URL in a browser to use the included client.

### Development Mode (Optional)

```bash
npm run dev
```

This uses Node's watch mode to restart the server when files change.

### Run Tests

```bash
npm test
```

The integration test runner starts the application against a temporary database and checks authentication, notes, authorization, administrative operations, and Socket.IO behavior.

---

## API Specification

### Health Check

| Method | Endpoint | Access | Description | Status |
|---|---|---|---|---|
| GET | `/api/health` | Public | Check server status and uptime | `200 OK` |

### Authentication API — `/api/auth`

| Method | Endpoint | Access | Description | Status Codes |
|---|---|---|---|---|
| POST | `/api/auth/signup` | Public | Register a new account | `201`, `400`, `409` |
| POST | `/api/auth/login` | Public | Authenticate and receive JWT | `200`, `400`, `401` |
| POST | `/api/auth/logout` | Public | Clear the token cookie | `200` |
| GET | `/api/auth/me` | Authenticated | Get the current user profile | `200`, `401`, `403` |

### Notes API — `/api/notes`

All notes endpoints require authentication. Users can access their own notes; administrators may access any note.

| Method | Endpoint | Access | Description | Status Codes |
|---|---|---|---|---|
| POST | `/api/notes` | Authenticated | Create a note | `201`, `400`, `401`, `403` |
| GET | `/api/notes` | Authenticated | List notes owned by the current user | `200`, `401`, `403` |
| GET | `/api/notes/:id` | Authenticated / Owner / Admin | Retrieve a note | `200`, `400`, `403`, `404` |
| PUT | `/api/notes/:id` | Authenticated / Owner / Admin | Update title and/or content | `200`, `400`, `403`, `404` |
| DELETE | `/api/notes/:id` | Authenticated / Owner / Admin | Delete a note | `200`, `400`, `403`, `404` |

### Admin API — `/api/admin`

Every endpoint in this section requires authentication and the `admin` role.

| Method | Endpoint | Access | Description | Status Codes |
|---|---|---|---|---|
| GET | `/api/admin/users` | Admin | List users without password hashes | `200`, `401`, `403` |
| PATCH | `/api/admin/users/:id/role` | Admin | Change a user's role (`user` or `admin`) | `200`, `400`, `401`, `403`, `404` |
| DELETE | `/api/admin/users/:id` | Admin | Delete a user and their notes (cannot delete self) | `200`, `400`, `401`, `403`, `404` |
| GET | `/api/admin/notes` | Admin | List notes across all users | `200`, `401`, `403` |
| GET | `/api/admin/activity` | Admin | Retrieve the in-memory activity feed | `200`, `401`, `403` |

---

## Postman Verification Reference

Use `http://localhost:5000` as the base URL for local API requests.

### 1. Register a User

**Request**

```http
POST /api/auth/signup HTTP/1.1
Host: localhost:5000
Content-Type: application/json

{
  "username": "victor",
  "email": "victor@example.com",
  "password": "123456"
}
```

**Response — `201 Created`**

```json
{
  "message": "User registered",
  "id": "<generated-user-id>",
  "username": "victor",
  "email": "victor@example.com"
}
```

### 2. Login

**Request**

```http
POST /api/auth/login HTTP/1.1
Host: localhost:5000
Content-Type: application/json

{
  "email": "victor@example.com",
  "password": "123456"
}
```

**Response — `200 OK`**

```json
{
  "message": "Login successful",
  "token": "<JWT>"
}
```

The login response also sets a `token` cookie.

### 3. Access a Protected Route Without a Token

**Request**

```http
GET /api/notes HTTP/1.1
Host: localhost:5000
```

**Response — `403 Forbidden`**

```json
{
  "message": "No token provided"
}
```

### 4. Create a Note Using a JWT

Replace `<JWT>` with the token obtained from login.

**Request**

```http
POST /api/notes HTTP/1.1
Host: localhost:5000
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "title": "My First Note",
  "content": "This is my first note of Web Dev III."
}
```

**Response — `201 Created`**

```json
{
  "_id": "<generated-note-id>",
  "title": "My First Note",
  "content": "This is my first note of Web Dev III.",
  "owner": "<generated-user-id>",
  "createdAt": "<ISO-timestamp>",
  "updatedAt": "<ISO-timestamp>"
}
```

### 5. Verify Role-Based Access

A regular user attempting to access an admin endpoint receives a forbidden response.

**Request**

```http
GET /api/admin/users HTTP/1.1
Host: localhost:5000
Authorization: Bearer <USER-JWT>
```

**Response — `403 Forbidden`**

```json
{
  "message": "Access denied: insufficient permissions"
}
```

> Response IDs and timestamps are generated dynamically. The examples use placeholders for these values.

---

## Real-Time Engine — Socket.IO

Socket.IO is attached to the HTTP server and authenticates each connection using a JWT. A token can be provided through the Socket.IO `auth` payload, an Authorization header, or a token cookie. Authenticated clients automatically join `general`.

### Supported Client Events

| Event | Direction | Description |
|---|---|---|
| `joinRoom` | Client → Server | Join a named room |
| `leaveRoom` | Client → Server | Leave a room |
| `chatMessage` | Client → Server | Send a message to the current/joined room |
| `typing` | Client → Server | Notify room members that the user is typing |
| `joined` | Server → Client | Provides room name and recent history |
| `chatMessage` | Server → Client | Broadcasts a chat message within a room |
| `system` | Server → Client | Room join/leave and user status information |
| `typing` | Server → Client | Typing notification |
| `error_message` | Server → Client | Communicates chat validation errors |

### Example Terminal Output

```text
User connected: <socket-id>
<socket-id> joined room general
[general] victor: Hey team, backend is ready
User disconnected: <socket-id> (victor)
```

The server logs connection, room membership, chat messages, and disconnect activity. Socket connections and chat events are also emitted to the internal event bus where applicable.

---

## Browser Client

The project includes a browser-based client served from the `public/` directory. It supports:

- User signup and login
- Authenticated session access
- Personal notes creation
- Notes listing, editing, and deletion
- Real-time room chat
- Room switching
- Chat history on room join
- Typing notifications

Open **http://localhost:5000** after starting the server.

---

## Repository Structure

```text
secure-connect/
├── public/
│   └── index.html             # Browser client: auth, notes, chat
├── src/
│   ├── config/
│   │   └── index.js           # Environment configuration
│   ├── db/
│   │   └── store.js            # JSON file document store
│   ├── events/
│   │   └── appEvents.js        # EventEmitter and activity feed
│   ├── middleware/
│   │   └── auth.js             # JWT authentication and RBAC
│   ├── routes/
│   │   ├── auth.js             # Signup, login, logout, profile
│   │   ├── notes.js            # Notes CRUD and ownership checks
│   │   └── admin.js             # Admin-only endpoints
│   └── sockets/
│       └── chat.js              # Socket.IO auth, rooms, messaging
├── tests/
│   └── run-tests.js             # Integration test runner
├── data/
│   └── db.json                  # Persistent store (generated at runtime)
├── .env.example                 # Environment variable template
├── .gitignore
├── package.json
├── package-lock.json
├── server.js                    # Server entry point
└── README.md
```

---

## Testing

The test script (`npm test`) exercises the application using a temporary data file and test port. The test cases cover:

- Signup validation and duplicate registration
- Password hashing
- Login success and failure
- JWT and cookie-based authentication
- Protected route behavior
- Notes CRUD and validation
- Note ownership enforcement
- Admin authorization and user management
- EventEmitter activity tracking
- Socket authentication
- Room messaging and room isolation
- Chat message validation
- Chat history delivery

---

## Project Scope

Secure Connect demonstrates backend web-development concepts including RESTful API design, middleware, JWT authentication, password hashing, role-based permissions, persistent data handling, event-driven design, and real-time communication.

---

## Author

**Anurag Mishra**  
B.Tech — Computer Science & Engineering (Core)

---

*Academic project for Web Dev III.*
