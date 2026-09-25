/**
 * CodeX LSP Client
 * Level 3A — Language Server Protocol Client
 *
 * Implements JSON-RPC 2.0 request/response/notification protocol,
 * initialization handshake, capability negotiation, and error handling.
 */

import { LspServerProcess } from './serverProcess.js';

export class LspClient {
  constructor(serverId) {
    this.serverId = serverId;
    this.process = new LspServerProcess(serverId);
    this.nextId = 1;
    this.pendingRequests = new Map(); // id -> { resolve, reject, timeoutId }
    this.notificationHandlers = new Map(); // method -> Set<callback>
    this.serverCapabilities = {};
    this.isInitialized = false;
  }

  /**
   * Starts the server process and performs the LSP initialize handshake.
   * @param {string} workspaceRoot - Workspace directory path
   * @param {string} workspaceUri - Canonical workspace URI (e.g. file:///...)
   */
  async start(workspaceRoot, workspaceUri) {
    await this.process.start(workspaceRoot, {
      onMessage: (msg) => this.handleMessage(msg),
      onError: (err) => console.warn(`[LspClient:${this.serverId}] Stderr:`, err),
      onExit: (exitInfo) => this.handleExit(exitInfo),
    });

    // Perform LSP Initialize Handshake
    const initParams = {
      processId: null,
      rootUri: workspaceUri || `file://${workspaceRoot.replace(/\\/g, '/')}`,
      capabilities: {
        textDocument: {
          synchronization: {
            dynamicRegistration: false,
            willSave: false,
            willSaveWaitUntil: false,
            didSave: true,
          },
          completion: {
            dynamicRegistration: false,
            completionItem: {
              snippetSupport: true,
              commitCharactersSupport: true,
              documentationFormat: ['markdown', 'plaintext'],
            },
          },
          hover: {
            dynamicRegistration: false,
            contentFormat: ['markdown', 'plaintext'],
          },
          definition: { dynamicRegistration: false },
          references: { dynamicRegistration: false },
          rename: { dynamicRegistration: false, prepareSupport: true },
          formatting: { dynamicRegistration: false },
          rangeFormatting: { dynamicRegistration: false },
          publishDiagnostics: { relatedInformation: true },
        },
        workspace: {
          workspaceFolders: true,
        },
      },
      workspaceFolders: [
        {
          uri: workspaceUri || `file://${workspaceRoot.replace(/\\/g, '/')}`,
          name: workspaceRoot.split('/').pop() || 'Workspace',
        },
      ],
    };

    const initResult = await this.sendRequest('initialize', initParams);
    this.serverCapabilities = initResult?.capabilities || {};
    this.isInitialized = true;

    // Send initialized notification
    await this.sendNotification('initialized', {});
    return this.serverCapabilities;
  }

  /**
   * Sends a JSON-RPC 2.0 Request and waits for a matching Response.
   * @param {string} method - LSP method name
   * @param {object} [params] - Request parameters
   * @param {number} [timeoutMs=6000] - Request timeout in milliseconds
   * @returns {Promise<any>}
   */
  sendRequest(method, params = {}, timeoutMs = 6000) {
    const id = this.nextId++;
    const message = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`[LspClient] Request '${method}' (id ${id}) timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timeoutId });

      this.process.send(message).catch((err) => {
        clearTimeout(timeoutId);
        this.pendingRequests.delete(id);
        reject(err);
      });
    });
  }

  /**
   * Sends a one-way JSON-RPC 2.0 Notification.
   * @param {string} method - Notification method
   * @param {object} [params] - Parameters
   */
  sendNotification(method, params = {}) {
    const message = {
      jsonrpc: '2.0',
      method,
      params,
    };
    return this.process.send(message);
  }

  /**
   * Registers a callback for server notifications (e.g. 'textDocument/publishDiagnostics').
   * @param {string} method - Notification method
   * @param {function} handler - Callback function
   */
  onNotification(method, handler) {
    if (!this.notificationHandlers.has(method)) {
      this.notificationHandlers.set(method, new Set());
    }
    this.notificationHandlers.get(method).add(handler);
    return () => {
      this.notificationHandlers.get(method)?.delete(handler);
    };
  }

  /**
   * Dispatches incoming JSON-RPC messages.
   * @private
   */
  handleMessage(message) {
    if (!message || typeof message !== 'object') return;

    // 1. Response handling (has id, no method)
    if (message.id !== undefined && !message.method) {
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        clearTimeout(pending.timeoutId);
        this.pendingRequests.delete(message.id);

        if (message.error) {
          pending.reject(new Error(message.error.message || 'LSP error'));
        } else {
          pending.resolve(message.result);
        }
      }
      return;
    }

    // 2. Notification handling (has method, no id)
    if (message.method && message.id === undefined) {
      const handlers = this.notificationHandlers.get(message.method);
      if (handlers) {
        handlers.forEach((fn) => {
          try {
            fn(message.params);
          } catch (e) {
            console.warn(`[LspClient] Error in notification handler '${message.method}':`, e);
          }
        });
      }
    }
  }

  handleExit(exitInfo) {
    this.isInitialized = false;
    for (const [, pending] of this.pendingRequests.entries()) {
      clearTimeout(pending.timeoutId);
      pending.reject(new Error(`Server exited unexpectedly with code ${exitInfo?.exitCode}`));
    }
    this.pendingRequests.clear();
  }

  /**
   * Checks whether the server reported support for a specific LSP capability.
   */
  hasCapability(capabilityPath) {
    if (!this.serverCapabilities) return false;
    const parts = capabilityPath.split('.');
    let curr = this.serverCapabilities;
    for (const p of parts) {
      if (!curr || typeof curr !== 'object') return false;
      curr = curr[p];
    }
    return Boolean(curr);
  }

  /**
   * Shuts down the LSP server session cleanly.
   */
  async stop() {
    if (this.isInitialized) {
      try {
        await this.sendRequest('shutdown', {}, 2000);
        await this.sendNotification('exit', {});
      } catch {}
    }
    await this.process.stop();
    this.isInitialized = false;
  }
}
