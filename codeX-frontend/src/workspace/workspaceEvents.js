/**
 * Workspace Event Emitter
 */

export class WorkspaceEvents {
  constructor() {
    this.listeners = new Map();
  }

  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(handler);
    return () => this.off(event, handler);
  }

  off(event, handler) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(handler);
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      for (const handler of this.listeners.get(event)) {
        try {
          handler(data);
        } catch (err) {
          console.error(`Error in workspace event listener (${event}):`, err);
        }
      }
    }
  }

  clear() {
    this.listeners.clear();
  }
}

export const workspaceEvents = new WorkspaceEvents();
