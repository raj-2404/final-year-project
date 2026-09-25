/**
 * Native Debugger Process Bridge Service
 * Connects CodeX desktop app to local Debug Adapter processes via Tauri.
 * Ensures debug adapters run strictly locally on the user's machine without network routing.
 */

import { isDesktopApp } from './platform.js';

class NativeDebugService {
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
      return await invoke('debug_check_binary', { name });
    } catch {
      return false;
    }
  }

  async startAdapter({ id, executable, args = [], cwd = '', env = null, onStdout, onStderr, onExit }) {
    if (!isDesktopApp()) {
      throw new Error('Local debug adapters are only supported in desktop mode');
    }

    const { invoke } = await import('@tauri-apps/api/core');
    const { listen } = await import('@tauri-apps/api/event');

    await invoke('debug_start', {
      id,
      executable,
      args,
      cwd,
      env,
    });

    const unlistenStdout = await listen(`debug-stdout-${id}`, (event) => {
      if (onStdout && typeof event.payload === 'string') {
        onStdout(event.payload);
      }
    });

    const unlistenStderr = await listen(`debug-stderr-${id}`, (event) => {
      if (onStderr && typeof event.payload === 'string') {
        onStderr(event.payload);
      }
    });

    const unlistenExit = await listen(`debug-exit-${id}`, (event) => {
      if (onExit && event.payload) {
        onExit(event.payload);
      }
      this.cleanup(id);
    });

    this.listeners.set(id, [unlistenStdout, unlistenStderr, unlistenExit]);
  }

  async writeAdapter(id, data) {
    if (!isDesktopApp()) return;
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('debug_write', { id, data });
  }

  async stopAdapter(id) {
    this.cleanup(id);
    if (!isDesktopApp()) return;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('debug_stop', { id });
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

export const nativeDebugService = new NativeDebugService();
