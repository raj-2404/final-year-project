# CodeX Collaborative Code Editor & Desktop Development Environment

> A modern, collaborative code editor inspired by VS Code, available both as a browser-based web application and as a native desktop development environment powered by **Tauri 2**.

---

## 1. Target Architecture & Security Boundary

CodeX Desktop cleanly separates local machine capabilities from the remote collaboration backend:

```
                    CODEX DESKTOP
                         │
              ┌──────────┴──────────┐
              │                     │
           React UI              Tauri 2
              │                     │
      ┌───────┼────────┐     ┌──────┼────────────┐
      │       │        │     │      │            │
    Monaco  xterm   Explorer Files Terminal     Git
              │              │      │            │
              └──────────────┴──────┴────────────┘
                             │
                        LOCAL MACHINE
                             │
                  ┌──────────┼──────────┐
                  │          │          │
                Files      Shell       Git
                            │          │
                  ▼          ▼          ▼
               macOS / Windows / Linux


                         +
                         │
                  HTTPS / WebSocket
                         │
                         ▼
                  EXISTING BACKEND
                         │
                  Collaboration
                  Authentication
                  Rooms
                  Presence
                  Shared state
```

### The Fundamental Rule
- **REMOTE** = collaboration, rooms, presence, shared code synchronization via STOMP/WebSocket.
- **LOCAL** = terminal PTY sessions, local filesystem, Git repositories, background processes, environment variables, credentials.

**Security Guarantee**: Remote room participants can never execute commands, delete files, start processes, or access Git credentials on another participant's machine.

---

## 2. Integrated Local Capabilities

### Integrated Terminal (Real PTY)
- Powered by `portable-pty` on Rust and `xterm.js` + `@xterm/addon-fit` on React.
- Runs the user's real host shell:
  - **macOS**: `/bin/zsh`, `/bin/bash`, Homebrew shells, `fish`.
  - **Windows**: PowerShell, Windows PowerShell (`powershell.exe`), `pwsh.exe`, `cmd.exe`, Git Bash.
  - **Linux**: `/bin/bash`, `/bin/zsh`, `fish`.
- Full host environment inheritance: `PATH`, `HOME`, `USER`, `NVM`, `JAVA_HOME`, Python venvs, Docker, Git config.
- Multiple independent sessions: Create (`+`), shell selector dropdown, Close (`X`), Restart, Rename, Split side-by-side.
- Direct raw byte streaming: ANSI colors, cursor positioning, Unicode, interactive programs (`vim`, `htop`, `git diff`, etc.).
- Responsive dynamic resize: Automatically sends terminal dimensions (`pty.resize(cols, rows)`) upon window or panel resize.

### Local Filesystem & Monaco Editor
- **Native Folder Picker**: Native OS dialog (`rfd`) to open real local repositories and folders.
- **Local File Explorer**: Directly renders project directory trees, lazily loading file contents.
- **Ignored Directories**: Fast traversing skips `.git`, `node_modules`, `target`, `dist`, `build`, `.next`.
- **Editor Persistence**: Monaco reads and writes directly to local disk paths.
- **Dirty State**: Displays `●` on tab headers when unsaved changes exist; prompts confirmation dialog before closing unsaved tabs or projects.
- **Native File Watcher**: `notify` crate watches the project directory for external changes, updating explorer and prompting reload on conflicts.
- **Context Actions**: Create File, Create Folder, Rename, Delete (with confirmation), and Reveal in System File Manager (Finder / File Explorer).

### Git Integration & Diff Editor
- **Local Git Binary**: Executes operations directly on the user's machine using host credentials and SSH keys (no credentials stored in CodeX).
- **Status Indicators**: Visual status indicators in Explorer (`M` for modified, `U` for untracked, `S` for staged, `D` for deleted).
- **Source Control Panel**: Full panel in Activity Bar displaying staged changes, unstaged changes, commit message input, Commit button, Branch switcher, Pull, and Push.
- **Monaco Diff Editor**: Click any modified file to view side-by-side or inline diff against Git HEAD.

### Process Management & Port Detection
- **Run & Debug Panel**: Auto-detects project configurations from `.codex/project.json` or `package.json` (`dev`, `build`, `start`, `test`).
- **Background Execution**: Spawns isolated local child processes, tracking PID, status, exit codes, and output logs in the `DEBUG CONSOLE`.
- **Port Detection**: Regex scans process output for local URLs (e.g. `http://localhost:5173`, `http://localhost:8080`), showing an instant **"Open in Browser"** link.
- **Process Cleanup**: When CodeX exits, all spawned PTY terminals and managed background processes are cleanly terminated.

### Command Palette & Keyboard Shortcuts
- `Cmd/Ctrl + Shift + P`: Searchable Command Palette with native commands.
- `Cmd/Ctrl + P`: Quick Open file search.
- `Cmd/Ctrl + S`: Save active file to disk.
- `Cmd/Ctrl + Shift + S`: Save As (native file dialog).
- `Cmd/Ctrl + W`: Close active editor tab (with dirty check).
- `Cmd/Ctrl + \``: Toggle bottom developer panel (Terminal / Debug).
- `Cmd/Ctrl + B`: Toggle primary sidebar (Explorer / Git / Debug).

---

## 3. Getting Started & Development

### Prerequisites
1. **Node.js**: v18+
2. **Rust & Cargo**: v1.77+ (`rustup`)
3. **Platform Build Tools**:
   - **macOS**: Xcode Command Line Tools (`xcode-select --install`).
   - **Windows**: Microsoft C++ Build Tools & WebView2.
   - **Linux**: `libwebkit2gtk-4.1-dev`, `build-essential`, `curl`, `libssl-dev`.

### Running the Application

```bash
# 1. Run Web Application in browser
npm run dev

# 2. Run Desktop Application with live HMR
npm run tauri:dev
```

### Running Tests

```bash
# Frontend build verification
npm run build

# Rust native backend unit tests
cd src-tauri && cargo test
```

### Building Desktop Production Installers

```bash
npm run tauri:build
```
Produces:
- **macOS**: `.app` bundle and `.dmg` installer in `src-tauri/target/release/bundle/dmg/`
- **Windows**: `.msi` and `.exe` installer in `src-tauri/target/release/bundle/msi/`
- **Linux**: `.deb` and `.AppImage` in `src-tauri/target/release/bundle/appimage/`

---

## 4. Web Version Compatibility

CodeX retains 100% browser compatibility:
- In a web browser (`!isDesktopApp()`), the filesystem service falls back to the browser's File System Access API.
- Desktop-only capabilities (PTY shell execution, direct Git CLI, host process manager) gracefully inform web users while keeping the collaborative shared STOMP terminal active.
