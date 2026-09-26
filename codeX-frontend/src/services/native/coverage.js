/**
 * Native Coverage Process Bridge Service
 * Level 3E — Code Coverage & Test Intelligence
 *
 * Connects CodeX desktop app to local coverage runner processes via Tauri IPC.
 * Guarantees that coverage processes execute strictly locally on the user's machine.
 */

import { isDesktopApp } from './platform.js';

class NativeCoverageService {
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
      return await invoke('coverage_check_binary', { name });
    } catch {
      return false;
    }
  }

  async startProcess({ id, executable, args = [], cwd = '', env = null, onStdout, onStderr, onExit }) {
    if (!isDesktopApp()) {
      throw new Error('Local coverage execution is only supported in CodeX Desktop mode.');
    }

    const { invoke } = await import('@tauri-apps/api/core');
    const { listen } = await import('@tauri-apps/api/event');

    await invoke('coverage_start', {
      id,
      executable,
      args,
      cwd,
      env,
    });

    const unlistenStdout = await listen(`coverage-stdout-${id}`, (event) => {
      if (onStdout && typeof event.payload === 'string') {
        onStdout(event.payload);
      }
    });

    const unlistenStderr = await listen(`coverage-stderr-${id}`, (event) => {
      if (onStderr && typeof event.payload === 'string') {
        onStderr(event.payload);
      }
    });

    const unlistenExit = await listen(`coverage-exit-${id}`, (event) => {
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
    return await invoke('coverage_write', { id, data });
  }

  async stopProcess(id) {
    this.cleanup(id);
    if (!isDesktopApp()) return;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('coverage_stop', { id });
    } catch {}
  }

  async killProcess(id) {
    this.cleanup(id);
    if (!isDesktopApp()) return;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('coverage_kill', { id });
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

export const nativeCoverageService = new NativeCoverageService();
