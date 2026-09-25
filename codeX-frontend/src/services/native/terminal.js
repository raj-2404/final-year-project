/**
 * Native Terminal Service
 * Communicates with the real local PTY engine on desktop.
 * Provides clean multi-session management, streaming I/O, and resizing.
 */

import { isDesktopApp } from './platform.js';

class NativeTerminalService {
  constructor() {
    this.activeListeners = new Map();
  }

  isSupported() {
    return isDesktopApp();
  }

  async getShells() {
    if (!isDesktopApp()) {
      return [{ id: 'web-term', name: 'Web Terminal', path: 'web', is_default: true }];
    }
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('term_get_shells');
  }

  async getDefaultShell() {
    if (!isDesktopApp()) return 'web';
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('term_get_default_shell');
  }

  async createSession({ id, title, shell, cwd, cols = 80, rows = 24, onData, onExit }) {
    if (!isDesktopApp()) {
      throw new Error('Local PTY terminal is only supported in CodeX desktop application');
    }

    const { invoke } = await import('@tauri-apps/api/core');
    const { listen } = await import('@tauri-apps/api/event');

    const sessionInfo = await invoke('term_create', {
      id,
      title: title || null,
      shell: shell || null,
      cwd: cwd || null,
      cols,
      rows,
    });

    // Listen for PTY stdout/stderr stream
    const unlistenData = await listen(`terminal-output-${id}`, (event) => {
      if (onData && typeof event.payload === 'string') {
        onData(event.payload);
      }
    });

    // Listen for terminal process exit
    const unlistenExit = await listen(`terminal-exit-${id}`, (event) => {
      if (onExit) {
        onExit(event.payload);
      }
      this.cleanupListeners(id);
    });

    this.activeListeners.set(id, [unlistenData, unlistenExit]);

    return {
      id,
      title: sessionInfo.title,
      shell: sessionInfo.shell,
      cwd: sessionInfo.cwd,
      write: (data) => this.write(id, data),
      resize: (newCols, newRows) => this.resize(id, newCols, newRows),
      close: () => this.close(id),
    };
  }

  async write(id, data) {
    if (!isDesktopApp()) return;
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('term_write', { id, data });
  }

  async resize(id, cols, rows) {
    if (!isDesktopApp()) return;
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('term_resize', { id, cols, rows });
  }

  async close(id) {
    this.cleanupListeners(id);
    if (!isDesktopApp()) return;
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('term_close', { id });
  }

  async listSessions() {
    if (!isDesktopApp()) return [];
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('term_list');
  }

  cleanupListeners(id) {
    if (this.activeListeners.has(id)) {
      const unlisteners = this.activeListeners.get(id);
      unlisteners.forEach((fn) => {
        try {
          fn();
        } catch {}
      });
      this.activeListeners.delete(id);
    }
  }
}

export const terminalService = new NativeTerminalService();
