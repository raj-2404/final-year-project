/**
 * CodeX LSP Server Process Manager
 * Level 3A — Local Process Lifecycle & IPC
 *
 * Spawns and manages local language server child processes via the native desktop layer.
 * Enforces local execution only (never over network, never on collaboration server).
 */

import { nativeLspService } from '../../../services/native/lsp.js';
import { serializeLspMessage, LspStreamParser } from './transport.js';
import { languageServerRegistry, ServerStatus } from './languageServerRegistry.js';

export class LspServerProcess {
  constructor(serverId, options = {}) {
    this.serverId = serverId;
    this.options = options;
    this.isRunning = false;
    this.parser = new LspStreamParser((message) => this.handleMessage(message));
    this.onMessageCallback = null;
    this.onErrorCallback = null;
    this.onExitCallback = null;
  }

  /**
   * Starts the local language server process.
   * @param {string} cwd - Project workspace root directory
   * @param {object} handlers - { onMessage, onError, onExit }
   */
  async start(cwd, { onMessage, onError, onExit } = {}) {
    this.onMessageCallback = onMessage;
    this.onErrorCallback = onError;
    this.onExitCallback = onExit;

    if (!nativeLspService.isSupported()) {
      languageServerRegistry.setStatus(this.serverId, ServerStatus.UNAVAILABLE);
      throw new Error(`Cannot start language server '${this.serverId}' outside of desktop environment`);
    }

    const launchConfig = languageServerRegistry.getLaunchConfig(this.serverId);
    if (!launchConfig?.executable) {
      languageServerRegistry.setStatus(this.serverId, ServerStatus.UNAVAILABLE);
      throw new Error(`No valid executable found for language server '${this.serverId}'`);
    }

    languageServerRegistry.setStatus(this.serverId, ServerStatus.STARTING);

    try {
      await nativeLspService.startServer({
        id: this.serverId,
        executable: launchConfig.executable,
        args: launchConfig.args,
        cwd: cwd || '',
        onStdout: (chunk) => {
          this.parser.append(chunk);
        },
        onStderr: (errorText) => {
          if (this.onErrorCallback) {
            this.onErrorCallback(errorText);
          }
        },
        onExit: (exitInfo) => {
          this.isRunning = false;
          languageServerRegistry.setStatus(this.serverId, ServerStatus.STOPPED);
          if (this.onExitCallback) {
            this.onExitCallback(exitInfo);
          }
        },
      });

      this.isRunning = true;
      languageServerRegistry.setStatus(this.serverId, ServerStatus.RUNNING);
    } catch (err) {
      this.isRunning = false;
      languageServerRegistry.setStatus(this.serverId, ServerStatus.FAILED);
      throw err;
    }
  }

  /**
   * Sends a JSON-RPC message to the server process's stdin.
   * @param {object} message - JSON-RPC 2.0 object
   */
  async send(message) {
    if (!this.isRunning) {
      throw new Error(`Cannot send message to stopped language server '${this.serverId}'`);
    }

    const framed = serializeLspMessage(message);
    await nativeLspService.writeServer(this.serverId, framed);
  }

  /**
   * Handles parsed JSON-RPC messages from server stdout.
   * @private
   */
  handleMessage(message) {
    if (this.onMessageCallback) {
      this.onMessageCallback(message);
    }
  }

  /**
   * Gracefully shuts down the server.
   */
  async stop() {
    this.isRunning = false;
    this.parser.reset();
    languageServerRegistry.setStatus(this.serverId, ServerStatus.STOPPED);

    try {
      await nativeLspService.stopServer(this.serverId);
    } catch {}
  }
}
