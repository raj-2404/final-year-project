/**
 * Native LSP Process Bridge Service
 * Connects CodeX desktop app to local Language Server processes via Tauri.
 * Ensures language servers run strictly locally without exposing network ports or using remote backends.
 */

import { isDesktopApp } from './platform.js';

class NativeLspService {
  constructor() {
    this.listeners = new Map();
  }

  isSupported() {
    return isDesktopApp();
  }

  async checkBinary(name) {
    if (!isDesktopApp() || !name) return false;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke('lsp_check_binary', { name });
    } catch {
      return false;
    }
  }

  async startServer({ id, executable, args = [], cwd = '', onStdout, onStderr, onExit }) {
    if (!isDesktopApp()) {
      throw new Error('Local language servers are only supported in desktop mode');
    }

    const { invoke } = await import('@tauri-apps/api/core');
    const { listen } = await import('@tauri-apps/api/event');

    await invoke('lsp_start', {
      id,
      executable,
      args,
      cwd,
    });

    const unlistenStdout = await listen(`lsp-stdout-${id}`, (event) => {
      if (onStdout && typeof event.payload === 'string') {
        onStdout(event.payload);
      }
    });

    const unlistenStderr = await listen(`lsp-stderr-${id}`, (event) => {
      if (onStderr && typeof event.payload === 'string') {
        onStderr(event.payload);
      }
    });

    const unlistenExit = await listen(`lsp-exit-${id}`, (event) => {
      if (onExit && event.payload) {
        onExit(event.payload);
      }
      this.cleanup(id);
    });

    this.listeners.set(id, [unlistenStdout, unlistenStderr, unlistenExit]);
  }

  async writeServer(id, data) {
    if (!isDesktopApp()) return;
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('lsp_write', { id, data });
  }

  async stopServer(id) {
    this.cleanup(id);
    if (!isDesktopApp()) return;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('lsp_stop', { id });
    } catch {}
  }

  cleanup(id) {
    if (this.listeners.has(id)) {
      const fns = this.listeners.get(id);
      fns.forEach((fn) => {
        try {
          fn();
        } catch {}
      });
      this.listeners.delete(id);
    }
  }
}

export const nativeLspService = new NativeLspService();
