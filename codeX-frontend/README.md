# CodeX Frontend & Desktop Application

> A collaborative code editor inspired by VS Code, available both as a browser-based web application and as a native cross-platform desktop application powered by **Tauri 2**.

---

## 1. Application Modes

| Mode | Platform | Shell / Engine | URL / Protocol |
|---|---|---|---|
| **Web Application** | Modern Web Browsers | Vite + React 19 | `http://localhost:3000` |
| **Desktop Application** | macOS (Apple Silicon / Intel), Windows, Linux | Tauri 2 + Native WebView | `tauri://localhost` / Native Window (1400x900) |

The React frontend codebase is **100% shared** between the web and desktop environments. No separate UI or branching is required.

---

## 2. Desktop Development

### Prerequisites

1. **Node.js**: v18+ (tested on Node 26)
2. **Rust & Cargo**: v1.77+ (install via `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`)
3. **Platform-specific dependencies**:
   - **macOS**: Xcode Command Line Tools (`xcode-select --install`). Supports Apple Silicon (`aarch64-apple-darwin`) and Intel (`x86_64-apple-darwin`).
   - **Windows**: Microsoft C++ Build Tools & WebView2.
   - **Linux**: `libwebkit2gtk-4.1-dev`, `build-essential`, `curl`, `libssl-dev`.

---

## 3. Quick Start & Scripts

### Run Web Application (Browser)
```bash
# Start Vite development server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Run Desktop Application (Tauri 2 Development)
```bash
# Launches the native desktop application window with live HMR
npm run tauri:dev
```

### Build Web Production Bundle
```bash
npm run build
```
Generates production assets in `dist/`.

### Build Desktop Production Application
```bash
# Builds native desktop executable
npm run tauri:build
```
On macOS, this produces:
- Binary: `src-tauri/target/release/codex`
- App Bundle: `src-tauri/target/release/bundle/macos/CodeX.app`
- DMG Installer: `src-tauri/target/release/bundle/dmg/CodeX_1.0.0_aarch64.dmg`

---

## 4. Architecture & Security Boundary

```
                 CodeX Desktop
                      │
              ┌───────┴───────┐
              │               │
           React            Tauri
              │               │
              ▼               ▼
       Remote Backend     Local OS
              │               │
       ┌──────┴──────┐    Native Features:
       │             │    - Environment detection
     REST          WS     - Window management
       │             │    - Future: PTY Terminal
       ▼             ▼    - Future: Native Filesystem
    CodeX API     Rooms
```

- **Remote Backend**: The desktop application continues to communicate directly with the CodeX backend service via REST (`http://localhost:5010/api` or `VITE_API_BASE_URL`) and WebSocket (`http://localhost:5010/ws` or `VITE_WS_URL`).
- **Least Privilege**: The Tauri configuration uses least-privilege permissions (`core:default`), with no unnecessary filesystem or shell execution capabilities exposed until explicitly needed.

---

## 5. Project Structure

```
codeX-frontend/
├── src/
│   ├── components/       # VS Code editor, sidebar, auth, terminal, tabs
│   ├── services/         # api.js (REST), stompService.js (WebSocket LiveSync)
│   ├── native/           # Centralized platform & native abstractions
│   │   ├── environment.js# isDesktopApp(), getAppType()
│   │   ├── platform.js   # isMacOS(), isWindows(), getPlatform()
│   │   ├── filesystem.js # Native FS hooks (Phase 2)
│   │   ├── terminal.js   # Native PTY hooks (Phase 3)
│   │   └── dialogs.js    # Native dialog hooks (Phase 2)
│   ├── App.jsx           # Root view controller
│   └── main.jsx          # React entrypoint
│
├── src-tauri/            # Tauri 2 Desktop Shell
│   ├── src/
│   │   ├── platform/     # Rust platform abstractions (macos, windows, linux)
│   │   ├── lib.rs        # Tauri builder & commands
│   │   └── main.rs       # Application entrypoint
│   ├── capabilities/     # Tauri 2 security permissions (least privilege)
│   ├── icons/            # App icons (32x32, 128x128, .icns, .ico)
│   ├── Cargo.toml        # Rust package configuration
│   └── tauri.conf.json   # Desktop window (1400x900) & bundle config
│
├── package.json
└── vite.config.js        # Configured for both web and desktop with relative base
```

---

## 6. Future Desktop Roadmap

- **Phase 1 (Completed)**: Tauri 2 native window foundation, environment detection, and dual-mode web/desktop build.
- **Phase 2**: Native filesystem integration (`openFolder`, file watching, save dialogs).
- **Phase 3**: Embedded interactive terminal powered by native PTY / `codex-agent`.
- **Phase 4**: Local Git status integration and process runner.
- **Phase 5**: Auto-updater, code signing, and platform distribution installers.
