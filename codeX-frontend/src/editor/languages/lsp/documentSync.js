/**
 * CodeX LSP Document Synchronizer
 * Level 3A — Document Synchronization (Open, Change, Save, Close)
 *
 * Keeps local Language Servers synchronized with current in-memory editor states
 * without requiring constant disk writes.
 */

class LspDocumentSync {
  constructor() {
    this.openDocuments = new Map(); // uri -> { version, languageId, text }
  }

  /**
   * Synchronizes document open event with the language server.
   * @param {object} client - LspClient instance
   * @param {string} uri - Canonical document URI
   * @param {string} languageId - Monaco language ID
   * @param {string} text - Current editor text content
   */
  async openDocument(client, uri, languageId, text) {
    if (!client?.isInitialized || !uri) return;

    const version = 1;
    this.openDocuments.set(uri, { version, languageId, text });

    await client.sendNotification('textDocument/didOpen', {
      textDocument: {
        uri,
        languageId,
        version,
        text: text || '',
      },
    });
  }

  /**
   * Synchronizes in-memory editor changes with the language server.
   * Uses incremental versioning so the server always reflects current unsaved keystrokes.
   * @param {object} client - LspClient instance
   * @param {string} uri - Canonical document URI
   * @param {string} newText - Updated editor text content
   */
  async changeDocument(client, uri, newText) {
    if (!client?.isInitialized || !uri) return;

    let doc = this.openDocuments.get(uri);
    const version = doc ? doc.version + 1 : 1;
    this.openDocuments.set(uri, { version, languageId: doc?.languageId || 'plaintext', text: newText });

    await client.sendNotification('textDocument/didChange', {
      textDocument: {
        uri,
        version,
      },
      contentChanges: [
        {
          text: newText,
        },
      ],
    });
  }

  /**
   * Synchronizes document save event with the language server.
   * @param {object} client - LspClient instance
   * @param {string} uri - Canonical document URI
   */
  async saveDocument(client, uri) {
    if (!client?.isInitialized || !uri) return;

    await client.sendNotification('textDocument/didSave', {
      textDocument: {
        uri,
      },
    });
  }

  /**
   * Synchronizes document close event with the language server.
   * @param {object} client - LspClient instance
   * @param {string} uri - Canonical document URI
   */
  async closeDocument(client, uri) {
    if (!client?.isInitialized || !uri) return;

    this.openDocuments.delete(uri);
    await client.sendNotification('textDocument/didClose', {
      textDocument: {
        uri,
      },
    });
  }

  /**
   * Checks if a document is currently registered as open.
   */
  isDocumentOpen(uri) {
    return this.openDocuments.has(uri);
  }
}

export const documentSync = new LspDocumentSync();
