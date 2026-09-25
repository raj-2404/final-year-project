/**
 * Native Build & Run Process Bridge Service
 * Connects CodeX desktop app to local build and run processes via Tauri.
 * Ensures build/run processes execute strictly locally on the user's machine.
 */

import { isDesktopApp } from './platform.js';

class NativeBuildService {
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
      return await invoke('build_check_binary', { name });
    } catch {
      return false;
    }
  }

  async startProcess({ id, executable, args = [], cwd = '', env = null, onStdout, onStderr, onExit }) {
    if (!isDesktopApp()) {
      throw new Error('Local build and run operations are only supported in desktop mode');
    }

    const { invoke } = await import('@tauri-apps/api/core');
    const { listen } = await import('@tauri-apps/api/event');

    await invoke('build_start', {
      id,
      executable,
      args,
      cwd,
      env,
    });

    const unlistenStdout = await listen(`build-stdout-${id}`, (event) => {
      if (onStdout && typeof event.payload === 'string') {
        onStdout(event.payload);
      }
    });

    const unlistenStderr = await listen(`build-stderr-${id}`, (event) => {
      if (onStderr && typeof event.payload === 'string') {
        onStderr(event.payload);
      }
    });

    const unlistenExit = await listen(`build-exit-${id}`, (event) => {
      if (onExit && event.payload) {
        onExit(event.payload);
      }
      this.cleanup(id);
    });

    this.listeners.set(id, [unlistenStdout, unlistenStderr, unlistenExit]);
  }

  async writeProcess(id, data) {
    if (!isDesktopApp()) return;
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('build_write', { id, data });
  }

  async stopProcess(id) {
    this.cleanup(id);
    if (!isDesktopApp()) return;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('build_stop', { id });
    } catch {}
  }

  async killProcess(id) {
    this.cleanup(id);
    if (!isDesktopApp()) return;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('build_kill', { id });
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

export const nativeBuildService = new NativeBuildService();
