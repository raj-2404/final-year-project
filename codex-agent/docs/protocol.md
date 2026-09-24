# CodeX Terminal Agent WebSocket Protocol

This document defines the WebSocket wire protocol used between the **CodeX Frontend** (browser or desktop application) and the **CodeX CLI Agent** (`codex-agent`).

---

## 1. Connection & Security Overview

- **Default Endpoint**: `ws://127.0.0.1:7777`
- **Interface Binding**: `127.0.0.1` (loopback only by default).
- **Transport**: Standard WebSockets (`ws://`).
- **Data Format**: UTF-8 encoded JSON text frames.
- **Authentication**: Cryptographic bearer token generated automatically on agent startup and stored in `~/.codex-agent/token` (file permissions `0600`).
- **Handshake Grace Period**: 5,000 ms. If an unauthenticated client connects and does not successfully authenticate within 5 seconds, the connection is closed with status code `4401`.

---

## 2. Authentication Handshake

The frontend must authenticate either:
1. **Via Query Parameter or Header** during HTTP upgrade:
   - Query: `ws://127.0.0.1:7777?token=<token>`
   - Header: `Authorization: Bearer <token>`
2. **Via Initial WebSocket Message** immediately upon connecting:

### Client -> Agent: `auth`

```json
{
  "type": "auth",
  "token": "84a8821907d27583c00723e1b9b85657e2a9089eeb64a5c954527f4a6ab522af"
}
```

### Agent -> Client: `auth.success`

Sent immediately when the token matches:

```json
{
  "type": "auth.success"
}
```

### Agent -> Client: `auth.error`

Sent if token is invalid or missing, followed by socket closure (code `4401`):

```json
{
  "type": "auth.error",
  "message": "Invalid authentication token"
}
```

---

## 3. Terminal Session Management

### 3.1 Create Terminal (`terminal.create`)

Spawns a real native interactive pseudo-terminal (PTY) session in the specified working directory using the user's OS shell.

#### Client -> Agent:
```json
{
  "type": "terminal.create",
  "cwd": "/Users/rajshaikh/Desktop/final-year-project",
  "shell": "default",
  "cols": 120,
  "rows": 30
}
```

| Field | Type | Description |
|---|---|---|
| `cwd` | `string` (optional) | Working directory for the shell. Must be an existing directory. Defaults to user's home directory (`$HOME`). |
| `shell` | `string` (optional) | Shell name (`"default"`, `"zsh"`, `"bash"`, `"powershell"`, `"pwsh"`, `"cmd"`). Arbitrary paths are rejected for security. |
| `cols` | `number` (optional) | Number of terminal columns (default `120`). |
| `rows` | `number` (optional) | Number of terminal rows (default `30`). |

#### Agent -> Client: `terminal.created`
```json
{
  "type": "terminal.created",
  "terminalId": "term-a1b2c3d4e5f6",
  "cwd": "/Users/rajshaikh/Desktop/final-year-project",
  "shell": "/bin/zsh"
}
```

---

### 3.2 Terminal Input (`terminal.input`)

Transmits raw keyboard input and control sequences (such as keystrokes, Ctrl+C, arrows, Tab, backspace, carriage returns) into the PTY process.

#### Client -> Agent:
```json
{
  "type": "terminal.input",
  "terminalId": "term-a1b2c3d4e5f6",
  "data": "npm install\r"
}
```

| Field | Type | Description |
|---|---|---|
| `terminalId` | `string` | Unique identifier received from `terminal.created`. |
| `data` | `string` | Keystroke or control sequence data. |

---

### 3.3 Terminal Output (`terminal.output`)

Live stream of raw bytes, ANSI escape sequences, color codes, and characters emitted by the PTY.

#### Agent -> Client:
```json
{
  "type": "terminal.output",
  "terminalId": "term-a1b2c3d4e5f6",
  "data": "\u001b[1m\u001b[7m%\u001b[27m\u001b[1m\u001b[0m   \r\nadded 45 packages in 2s\r\n"
}
```

---

### 3.4 Terminal Resize (`terminal.resize`)

Notifies the PTY of changes in the frontend terminal viewport dimensions (cols / rows) so full-screen applications (`vim`, `nano`, `htop`, `git diff`) reflow correctly.

#### Client -> Agent:
```json
{
  "type": "terminal.resize",
  "terminalId": "term-a1b2c3d4e5f6",
  "cols": 150,
  "rows": 42
}
```

---

### 3.5 Terminal Kill / Close (`terminal.kill` / `terminal.close`)

Terminates the PTY process immediately and releases system resources.

#### Client -> Agent:
```json
{
  "type": "terminal.kill",
  "terminalId": "term-a1b2c3d4e5f6"
}
```

---

### 3.6 Terminal Exit (`terminal.exit`)

Notifies the frontend when the shell process exits (e.g. user typed `exit` or Ctrl+D).

#### Agent -> Client:
```json
{
  "type": "terminal.exit",
  "terminalId": "term-a1b2c3d4e5f6",
  "exitCode": 0,
  "signal": null
}
```

---

### 3.7 Terminal Error (`terminal.error`)

Emitted if an operation fails (e.g., maximum sessions exceeded, invalid working directory, terminal not found).

#### Agent -> Client:
```json
{
  "type": "terminal.error",
  "terminalId": "term-a1b2c3d4e5f6",
  "message": "Maximum terminal sessions reached (10)"
}
```

---

### 3.8 Heartbeat / Ping (`ping` / `pong`)

Keep-alive ping to ensure connection liveness.

#### Client -> Agent:
```json
{
  "type": "ping"
}
```

#### Agent -> Client:
```json
{
  "type": "pong"
}
```

---

## 4. Reconnection & Lifecycle Policy

- **Disconnect Grace Period**: Default 60,000 ms (60 seconds).
- When a WebSocket connection disconnects (e.g., frontend browser page refreshed or route navigated), running PTY sessions are **not** immediately killed.
- If the frontend reconnects within 60 seconds, sessions remain active.
- If abandoned beyond the grace period, orphaned sessions are cleanly terminated to free resources.
- Idle sessions without any activity for 30 minutes (`idleTimeout: 1800000`) are automatically reaped.
