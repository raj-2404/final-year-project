/**
 * CodeX Debug Adapter Protocol (DAP) Transport Layer
 * Level 3B — Debugging Architecture
 *
 * Implements:
 * - Content-Length JSON-RPC framing parser for DAP
 * - Bidirectional request / response matching with promises and timeout handling
 * - DAP event routing (stopped, continued, initialized, output, terminated, exited)
 */

import { nativeDebugService } from '../services/native/debugger.js';

export class DebugTransport {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.seq = 1;
    this.pendingRequests = new Map(); // seq -> { resolve, reject, command, timer }
    this.eventListeners = new Map(); // eventName -> Set<callback>
    this.rawBuffer = '';
    this.isConnected = false;
  }

  /**
   * Initializes transport listeners with native debug process bridge.
   */
  async start({ executable, args = [], cwd = '', env = null }) {
    this.rawBuffer = '';
    this.seq = 1;
    this.pendingRequests.clear();

    await nativeDebugService.startAdapter({
      id: this.sessionId,
      executable,
      args,
      cwd,
      env,
      onStdout: (chunk) => this.handleData(chunk),
      onStderr: (chunk) => this.emitEvent('output', { category: 'stderr', output: chunk }),
      onExit: (payload) => this.handleExit(payload),
    });

    this.isConnected = true;
  }

  /**
   * Sends a DAP request and returns a promise for the response body.
   * @param {string} command - DAP command (e.g. 'initialize', 'launch', 'setBreakpoints')
   * @param {object} [args={}] - DAP request arguments
   * @param {number} [timeout=10000] - Timeout in milliseconds
   * @returns {Promise<any>} Response body
   */
  sendRequest(command, args = {}, timeout = 10000) {
    if (!this.isConnected) {
      return Promise.reject(new Error(`Cannot send '${command}': debug transport not connected`));
    }

    const currentSeq = this.seq++;
    const message = {
      seq: currentSeq,
      type: 'request',
      command,
      arguments: args,
    };

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pendingRequests.has(currentSeq)) {
          this.pendingRequests.delete(currentSeq);
          reject(new Error(`DAP request '${command}' timed out after ${timeout}ms`));
        }
      }, timeout);

      this.pendingRequests.set(currentSeq, { resolve, reject, command, timer });

      const jsonStr = JSON.stringify(message);
      const payload = `Content-Length: ${new TextEncoder().encode(jsonStr).length}\r\n\r\n${jsonStr}`;

      nativeDebugService.writeAdapter(this.sessionId, payload).catch((err) => {
        clearTimeout(timer);
        this.pendingRequests.delete(currentSeq);
        reject(err);
      });
    });
  }

  /**
   * Parses incoming stdout chunks for Content-Length DAP framing.
   */
  handleData(chunk) {
    this.rawBuffer += chunk;

    while (true) {
      const headerEndIndex = this.rawBuffer.indexOf('\r\n\r\n');
      if (headerEndIndex === -1) break;

      const headerText = this.rawBuffer.slice(0, headerEndIndex);
      const match = headerText.match(/Content-Length:\s*(\d+)/i);
      if (!match) {
        this.rawBuffer = this.rawBuffer.slice(headerEndIndex + 4);
        continue;
      }

      const contentLength = parseInt(match[1], 10);
      const bodyStartIndex = headerEndIndex + 4;
      const totalLength = bodyStartIndex + contentLength;

      if (this.rawBuffer.length < totalLength) {
        break; // Incomplete packet, wait for next chunk
      }

      const jsonText = this.rawBuffer.slice(bodyStartIndex, totalLength);
      this.rawBuffer = this.rawBuffer.slice(totalLength);

      try {
        const msg = JSON.parse(jsonText);
        this.dispatchMessage(msg);
      } catch (err) {
        console.warn('[DebugTransport] Failed to parse DAP message:', err, jsonText);
      }
    }
  }

  /**
   * Dispatches parsed DAP messages to pending requests or event listeners.
   */
  dispatchMessage(msg) {
    if (msg.type === 'response') {
      const reqSeq = msg.request_seq;
      if (this.pendingRequests.has(reqSeq)) {
        const { resolve, reject, timer } = this.pendingRequests.get(reqSeq);
        clearTimeout(timer);
        this.pendingRequests.delete(reqSeq);

        if (msg.success) {
          resolve(msg.body || {});
        } else {
          reject(new Error(msg.message || `DAP request '${msg.command}' failed`));
        }
      }
    } else if (msg.type === 'event') {
      this.emitEvent(msg.event, msg.body || {});
    }
  }

  /**
   * Registers an event callback for a specific DAP event.
   */
  onEvent(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event).add(callback);

    return () => {
      this.eventListeners.get(event)?.delete(callback);
    };
  }

  emitEvent(event, body) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((cb) => {
        try {
          cb(body);
        } catch (err) {
          console.error(`[DebugTransport] Error in event listener '${event}':`, err);
        }
      });
    }

    // Catch-all event listener ('*')
    const allListeners = this.eventListeners.get('*');
    if (allListeners) {
      allListeners.forEach((cb) => {
        try {
          cb(event, body);
        } catch {}
      });
    }
  }

  handleExit(payload) {
    this.isConnected = false;
    this.emitEvent('terminated', payload);
    this.emitEvent('exited', payload);

    for (const [, { reject, timer }] of this.pendingRequests.entries()) {
      clearTimeout(timer);
      reject(new Error('Debug adapter process exited'));
    }
    this.pendingRequests.clear();
  }

  async close() {
    this.isConnected = false;
    for (const [, { reject, timer }] of this.pendingRequests.entries()) {
      clearTimeout(timer);
      reject(new Error('Debug transport closed'));
    }
    this.pendingRequests.clear();
    await nativeDebugService.stopAdapter(this.sessionId);
  }
}
