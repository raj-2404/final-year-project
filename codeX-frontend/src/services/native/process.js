/**
 * Native Process Service
 * Manages background run / dev server tasks started by CodeX on desktop.
 * Detects local listening ports automatically and isolates execution to the local machine.
 */

import { isDesktopApp } from './platform.js';

class NativeProcessService {
  constructor() {
    this.listeners = new Map();
  }

  isSupported() {
    return isDesktopApp();
  }

  async startProcess({ id, name, command, cwd, onLog, onPort, onExit }) {
    if (!isDesktopApp()) {
      throw new Error('Process management is only available on desktop');
    }

    const { invoke } = await import('@tauri-apps/api/core');
    const { listen } = await import('@tauri-apps/api/event');

    const info = await invoke('proc_start', { id, name, command, cwd });

    const unlistenLog = await listen(`process-log-${id}`, (event) => {
      if (onLog && typeof event.payload === 'string') {
        onLog(event.payload);
      }
    });

    const unlistenPort = await listen(`process-port-${id}`, (event) => {
      if (onPort && event.payload) {
        onPort(event.payload);
      }
    });

    const unlistenExit = await listen(`process-exit-${id}`, (event) => {
      if (onExit && event.payload) {
        onExit(event.payload);
      }
      this.cleanup(id);
    });

    this.listeners.set(id, [unlistenLog, unlistenPort, unlistenExit]);
    return info;
  }

  async stopProcess(id) {
    this.cleanup(id);
    if (!isDesktopApp()) return;
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('proc_stop', { id });
  }

  async restartProcess({ id, name, command, cwd, onLog, onPort, onExit }) {
    await this.stopProcess(id);
    return await this.startProcess({ id, name, command, cwd, onLog, onPort, onExit });
  }

  async listProcesses() {
    if (!isDesktopApp()) return [];
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('proc_list');
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

export const processService = new NativeProcessService();
