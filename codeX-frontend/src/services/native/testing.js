/**
 * Native Test Process Bridge Service
 * Level 3D — Test Runner Architecture
 *
 * Connects CodeX desktop app to local test runner processes via Tauri IPC.
 * Guarantees that test processes execute strictly locally on the user's machine.
 */

import { isDesktopApp } from './platform.js';

class NativeTestService {
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
      return await invoke('test_check_binary', { name });
    } catch {
      return false;
    }
  }

  async startProcess({ id, executable, args = [], cwd = '', env = null, onStdout, onStderr, onExit }) {
    if (!isDesktopApp()) {
      throw new Error('Local test execution is only supported in CodeX Desktop mode.');
    }

    const { invoke } = await import('@tauri-apps/api/core');
    const { listen } = await import('@tauri-apps/api/event');

    await invoke('test_start', {
      id,
      executable,
      args,
      cwd,
      env,
    });

    const unlistenStdout = await listen(`test-stdout-${id}`, (event) => {
      if (onStdout && typeof event.payload === 'string') {
        onStdout(event.payload);
      }
    });

    const unlistenStderr = await listen(`test-stderr-${id}`, (event) => {
      if (onStderr && typeof event.payload === 'string') {
        onStderr(event.payload);
      }
    });

    const unlistenExit = await listen(`test-exit-${id}`, (event) => {
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
    return await invoke('test_write', { id, data });
  }

  async stopProcess(id) {
    this.cleanup(id);
    if (!isDesktopApp()) return;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('test_stop', { id });
    } catch {}
  }

  async killProcess(id) {
    this.cleanup(id);
    if (!isDesktopApp()) return;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('test_kill', { id });
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

export const nativeTestService = new NativeTestService();
