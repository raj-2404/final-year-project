/**
 * CodeX LSP Manager
 * Level 3A — Language Server Protocol Coordinator & Monaco Provider Bridge
 *
 * Orchestrates:
 * - On-demand discovery and startup of local language servers (Python, Rust, Go, C/C++, Java)
 * - Monaco Language Provider wiring (Completion, Hover, Definition, References, Rename, Formatting)
 * - In-memory document synchronization
 * - LSP Diagnostics mapping into Monaco's native marker system and Problems panel
 */

import { languageServerRegistry, ServerStatus } from './languageServerRegistry.js';
import { LspClient } from './lspClient.js';
import { documentSync } from './documentSync.js';
import { modelManager } from '../modelManager.js';

class LspManager {
  constructor() {
    this.activeClients = new Map(); // serverId -> LspClient
    this.registeredProviders = new Set(); // languageId
    this.monaco = null;
    this.currentWorkspaceRoot = '';
    this.currentFileTree = [];
    this.navigationHandler = null;
  }

  /**
   * Initializes the LSP subsystem context.
   * @param {object} monaco - Monaco instance
   * @param {object} context - { workspaceRoot, fileTree, onNavigate }
   */
  initialize(monaco, context = {}) {
    this.monaco = monaco;
    this.currentWorkspaceRoot = context.workspaceRoot || '';
    this.currentFileTree = context.fileTree || [];
    this.navigationHandler = context.onNavigate || null;
  }

  /**
   * Updates workspace context when files or folders change.
   */
  updateContext(fileTree, workspaceRoot) {
    if (Array.isArray(fileTree)) {
      this.currentFileTree = fileTree;
    }
    if (workspaceRoot !== undefined) {
      this.currentWorkspaceRoot = workspaceRoot;
    }
  }

  /**
   * Determines if a language should be handled by a Language Server.
   * JavaScript / TypeScript / JSON use Monaco's native built-in service.
   * @param {string} languageId - Monaco language ID
   * @returns {boolean}
   */
  isLspLanguage(languageId) {
    if (!languageId) return false;
    const lower = languageId.toLowerCase();
    // Do NOT use external LSP for JS/TS/JSON/markdown/plaintext (handled by Monaco native language services)
    if (['javascript', 'typescript', 'json', 'markdown', 'plaintext'].includes(lower)) {
      return false;
    }
    return Boolean(languageServerRegistry.getServerForLanguage(lower));
  }

  /**
   * Gets or lazily starts the Language Server client for a given language.
   * Starts server only on demand when a matching file is opened.
   * @param {string} languageId - Language ID (e.g. 'python', 'rust', 'go')
   * @returns {Promise<LspClient|null>}
   */
  async getOrStartClient(languageId) {
    const serverDef = languageServerRegistry.getServerForLanguage(languageId);
    if (!serverDef) return null;

    // Check if client is already active
    if (this.activeClients.has(serverDef.id)) {
      const existing = this.activeClients.get(serverDef.id);
      if (existing.isInitialized) {
        return existing;
      }
    }

    // Discover server on user machine
    const isAvailable = await languageServerRegistry.discoverServer(serverDef.id);
    if (!isAvailable) {
      return null;
    }

    // Launch server process
    const client = new LspClient(serverDef.id);
    try {
      const workspaceUri = modelManager.getCanonicalUriString(this.currentWorkspaceRoot, '');
      await client.start(this.currentWorkspaceRoot, workspaceUri);
      this.activeClients.set(serverDef.id, client);

      // Listen for LSP Diagnostics and forward to Monaco Markers
      client.onNotification('textDocument/publishDiagnostics', (params) => {
        this.handlePublishDiagnostics(params);
      });

      // Register Monaco Language Providers for this language (once)
      this.registerMonacoProviders(languageId, client);

      return client;
    } catch (err) {
      console.warn(`[LspManager] Failed to start LSP client for '${serverDef.id}':`, err);
      languageServerRegistry.setStatus(serverDef.id, ServerStatus.FAILED);
      return null;
    }
  }

  /**
   * Handles file open in editor: starts client if needed and synchronizes document.
   */
  async handleFileOpen(monaco, file, workspaceRoot) {
    if (!this.monaco && monaco) this.monaco = monaco;
    if (workspaceRoot) this.currentWorkspaceRoot = workspaceRoot;

    const lang = file?.language;
    if (!this.isLspLanguage(lang)) return;

    try {
      const client = await this.getOrStartClient(lang);
      if (!client) return;

      const uriStr = modelManager.getCanonicalUriString(file.path || file.name, this.currentWorkspaceRoot);
      await documentSync.openDocument(client, uriStr, lang, file.content || '');
    } catch (err) {
      console.warn('[LspManager] handleFileOpen error:', err);
    }
  }

  /**
   * Handles document change: synchronizes in-memory content to LSP server.
   */
  async handleFileChange(monaco, file, newCode) {
    const lang = file?.language;
    if (!this.isLspLanguage(lang)) return;

    const serverDef = languageServerRegistry.getServerForLanguage(lang);
    if (!serverDef || !this.activeClients.has(serverDef.id)) return;

    const client = this.activeClients.get(serverDef.id);
    const uriStr = modelManager.getCanonicalUriString(file.path || file.name, this.currentWorkspaceRoot);

    try {
      await documentSync.changeDocument(client, uriStr, newCode);
    } catch {}
  }

  /**
   * Handles document save event.
   */
  async handleFileSave(monaco, file) {
    const lang = file?.language;
    if (!this.isLspLanguage(lang)) return;

    const serverDef = languageServerRegistry.getServerForLanguage(lang);
    if (!serverDef || !this.activeClients.has(serverDef.id)) return;

    const client = this.activeClients.get(serverDef.id);
    const uriStr = modelManager.getCanonicalUriString(file.path || file.name, this.currentWorkspaceRoot);

    try {
      await documentSync.saveDocument(client, uriStr);
    } catch {}
  }

  /**
   * Handles document close event.
   */
  async handleFileClose(monaco, file) {
    const lang = file?.language;
    if (!this.isLspLanguage(lang)) return;

    const serverDef = languageServerRegistry.getServerForLanguage(lang);
    if (!serverDef || !this.activeClients.has(serverDef.id)) return;

    const client = this.activeClients.get(serverDef.id);
    const uriStr = modelManager.getCanonicalUriString(file.path || file.name, this.currentWorkspaceRoot);

    try {
      await documentSync.closeDocument(client, uriStr);
    } catch {}
  }

  /**
   * Registers Monaco providers (Completion, Hover, Definition, References, Rename, Formatting)
   * routing requests to the LSP client.
   * @private
   */
  registerMonacoProviders(languageId, client) {
    if (this.registeredProviders.has(languageId) || !this.monaco?.languages) return;
    this.registeredProviders.add(languageId);

    const monaco = this.monaco;

    // 1. Completion Provider
    monaco.languages.registerCompletionItemProvider(languageId, {
      triggerCharacters: ['.', ':', '(', '<', '"', '/', '@', '#', '$'],
      provideCompletionItems: async (model, position) => {
        try {
          const uriStr = model.uri.toString();
          const response = await client.sendRequest('textDocument/completion', {
            textDocument: { uri: uriStr },
            position: { line: position.lineNumber - 1, character: position.column - 1 },
          });

          const items = Array.isArray(response) ? response : response?.items || [];
          return {
            suggestions: items.map((item) => ({
              label: item.label,
              kind: this.mapCompletionKind(item.kind),
              detail: item.detail,
              documentation: typeof item.documentation === 'object' ? item.documentation.value : item.documentation,
              insertText: item.insertText || item.label,
              insertTextRules: item.insertTextFormat === 2 ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet : 0,
              range: undefined,
            })),
          };
        } catch {
          return { suggestions: [] };
        }
      },
    });

    // 2. Hover Provider
    monaco.languages.registerHoverProvider(languageId, {
      provideHover: async (model, position) => {
        try {
          const uriStr = model.uri.toString();
          const response = await client.sendRequest('textDocument/hover', {
            textDocument: { uri: uriStr },
            position: { line: position.lineNumber - 1, character: position.column - 1 },
          });

          if (!response || !response.contents) return null;

          const contents = [];
          if (Array.isArray(response.contents)) {
            response.contents.forEach((c) => {
              contents.push({ value: typeof c === 'object' ? c.value : String(c) });
            });
          } else if (typeof response.contents === 'object') {
            contents.push({ value: response.contents.value || '' });
          } else {
            contents.push({ value: String(response.contents) });
          }

          let range = undefined;
          if (response.range) {
            range = new monaco.Range(
              response.range.start.line + 1,
              response.range.start.character + 1,
              response.range.end.line + 1,
              response.range.end.character + 1
            );
          }

          return { contents, range };
        } catch {
          return null;
        }
      },
    });

    // 3. Go to Definition Provider (Cross-file aware)
    monaco.languages.registerDefinitionProvider(languageId, {
      provideDefinition: async (model, position) => {
        try {
          const uriStr = model.uri.toString();
          const response = await client.sendRequest('textDocument/definition', {
            textDocument: { uri: uriStr },
            position: { line: position.lineNumber - 1, character: position.column - 1 },
          });

          if (!response) return null;
          const locations = Array.isArray(response) ? response : [response];

          return locations.map((loc) => {
            const targetUri = monaco.Uri.parse(loc.uri || loc.targetUri);
            const targetRange = loc.range || loc.targetSelectionRange || loc.targetRange;
            return {
              uri: targetUri,
              range: new monaco.Range(
                targetRange.start.line + 1,
                targetRange.start.character + 1,
                targetRange.end.line + 1,
                targetRange.end.character + 1
              ),
            };
          });
        } catch {
          return null;
        }
      },
    });

    // 4. Find References Provider
    monaco.languages.registerReferenceProvider(languageId, {
      provideReferences: async (model, position) => {
        try {
          const uriStr = model.uri.toString();
          const response = await client.sendRequest('textDocument/references', {
            textDocument: { uri: uriStr },
            position: { line: position.lineNumber - 1, character: position.column - 1 },
            context: { includeDeclaration: true },
          });

          if (!Array.isArray(response)) return [];

          return response.map((loc) => ({
            uri: monaco.Uri.parse(loc.uri),
            range: new monaco.Range(
              loc.range.start.line + 1,
              loc.range.start.character + 1,
              loc.range.end.line + 1,
              loc.range.end.character + 1
            ),
          }));
        } catch {
          return [];
        }
      },
    });

    // 5. Rename Symbol Provider
    monaco.languages.registerRenameProvider(languageId, {
      provideRenameEdits: async (model, position, newName) => {
        try {
          const uriStr = model.uri.toString();
          const response = await client.sendRequest('textDocument/rename', {
            textDocument: { uri: uriStr },
            position: { line: position.lineNumber - 1, character: position.column - 1 },
            newName,
          });

          if (!response || !response.changes) return { edits: [] };

          const edits = [];
          for (const [targetUriStr, textEdits] of Object.entries(response.changes)) {
            const targetResource = monaco.Uri.parse(targetUriStr);
            for (const edit of textEdits) {
              edits.push({
                resource: targetResource,
                textEdit: {
                  range: new monaco.Range(
                    edit.range.start.line + 1,
                    edit.range.start.character + 1,
                    edit.range.end.line + 1,
                    edit.range.end.character + 1
                  ),
                  text: edit.newText,
                },
              });
            }
          }

          return { edits };
        } catch (err) {
          return { edits: [], rejectReason: err.message };
        }
      },
    });

    // 6. Document Formatting Provider
    monaco.languages.registerDocumentFormattingEditProvider(languageId, {
      provideDocumentFormattingEdits: async (model, options) => {
        try {
          const uriStr = model.uri.toString();
          const response = await client.sendRequest('textDocument/formatting', {
            textDocument: { uri: uriStr },
            options: {
              tabSize: options.tabSize || 2,
              insertSpaces: options.insertSpaces !== false,
            },
          });

          if (!Array.isArray(response)) return [];

          return response.map((edit) => ({
            range: new monaco.Range(
              edit.range.start.line + 1,
              edit.range.start.character + 1,
              edit.range.end.line + 1,
              edit.range.end.character + 1
            ),
            text: edit.newText,
          }));
        } catch {
          return [];
        }
      },
    });

    // 7. Document Symbol Provider (Breadcrumbs & Outline)
    if (monaco.languages.registerDocumentSymbolProvider) {
      monaco.languages.registerDocumentSymbolProvider(languageId, {
        provideDocumentSymbols: async (model) => {
          try {
            const uriStr = model.uri.toString();
            const response = await client.sendRequest('textDocument/documentSymbol', {
              textDocument: { uri: uriStr },
            });

            if (!Array.isArray(response)) return [];

            const mapSymbol = (sym) => {
              const range = sym.range || sym.location?.range;
              const selectionRange = sym.selectionRange || range;
              if (!range) return null;

              return {
                name: sym.name,
                detail: sym.detail || '',
                kind: this.mapSymbolKind(sym.kind),
                range: new monaco.Range(
                  range.start.line + 1,
                  range.start.character + 1,
                  range.end.line + 1,
                  range.end.character + 1
                ),
                selectionRange: new monaco.Range(
                  selectionRange.start.line + 1,
                  selectionRange.start.character + 1,
                  selectionRange.end.line + 1,
                  selectionRange.end.character + 1
                ),
                children: Array.isArray(sym.children)
                  ? sym.children.map(mapSymbol).filter(Boolean)
                  : [],
              };
            };

            return response.map(mapSymbol).filter(Boolean);
          } catch {
            return [];
          }
        },
      });
    }
  }

  /**
   * Converts LSP publishDiagnostics notifications to Monaco Markers.
   * Reuses the existing Monaco marker system and Problems panel.
   * @private
   */
  handlePublishDiagnostics({ uri, diagnostics = [] }) {
    if (!this.monaco?.editor) return;

    try {
      const targetUri = this.monaco.Uri.parse(uri);
      const model = this.monaco.editor.getModel(targetUri);
      if (!model || model.isDisposed()) return;

      const markers = diagnostics.map((diag) => {
        let severity = this.monaco.MarkerSeverity.Info;
        if (diag.severity === 1) severity = this.monaco.MarkerSeverity.Error;
        else if (diag.severity === 2) severity = this.monaco.MarkerSeverity.Warning;
        else if (diag.severity === 3) severity = this.monaco.MarkerSeverity.Info;
        else if (diag.severity === 4) severity = this.monaco.MarkerSeverity.Hint;

        return {
          severity,
          message: diag.message,
          startLineNumber: (diag.range?.start?.line ?? 0) + 1,
          startColumn: (diag.range?.start?.character ?? 0) + 1,
          endLineNumber: (diag.range?.end?.line ?? 0) + 1,
          endColumn: (diag.range?.end?.character ?? 0) + 1,
          source: diag.source || 'LSP',
        };
      });

      this.monaco.editor.setModelMarkers(model, 'lsp', markers);
    } catch (err) {
      console.warn('[LspManager] Error setting diagnostics markers:', err);
    }
  }

  /**
   * Maps LSP CompletionItemKind numbers to Monaco CompletionItemKind.
   * @private
   */
  mapCompletionKind(kind) {
    if (!this.monaco?.languages?.CompletionItemKind) return 0;
    const MonacoKind = this.monaco.languages.CompletionItemKind;
    // LSP to Monaco enum mapping
    const map = {
      1: MonacoKind.Text,
      2: MonacoKind.Method,
      3: MonacoKind.Function,
      4: MonacoKind.Constructor,
      5: MonacoKind.Field,
      6: MonacoKind.Variable,
      7: MonacoKind.Class,
      8: MonacoKind.Interface,
      9: MonacoKind.Module,
      10: MonacoKind.Property,
      11: MonacoKind.Unit,
      12: MonacoKind.Value,
      13: MonacoKind.Enum,
      14: MonacoKind.Keyword,
      15: MonacoKind.Snippet,
      16: MonacoKind.Color,
      17: MonacoKind.File,
      18: MonacoKind.Reference,
      19: MonacoKind.Folder,
      20: MonacoKind.EnumMember,
      21: MonacoKind.Constant,
      22: MonacoKind.Struct,
      23: MonacoKind.Event,
      24: MonacoKind.Operator,
      25: MonacoKind.TypeParameter,
    };
    return map[kind] || MonacoKind.Property;
  }

  /**
   * Maps LSP SymbolKind numbers (1..26) to Monaco SymbolKind.
   * @private
   */
  mapSymbolKind(kind) {
    if (!this.monaco?.languages?.SymbolKind) return 0;
    const MonacoSymbolKind = this.monaco.languages.SymbolKind;
    const map = {
      1: MonacoSymbolKind.File,
      2: MonacoSymbolKind.Module,
      3: MonacoSymbolKind.Namespace,
      4: MonacoSymbolKind.Package,
      5: MonacoSymbolKind.Class,
      6: MonacoSymbolKind.Method,
      7: MonacoSymbolKind.Property,
      8: MonacoSymbolKind.Field,
      9: MonacoSymbolKind.Constructor,
      10: MonacoSymbolKind.Enum,
      11: MonacoSymbolKind.Interface,
      12: MonacoSymbolKind.Function,
      13: MonacoSymbolKind.Variable,
      14: MonacoSymbolKind.Constant,
      15: MonacoSymbolKind.String,
      16: MonacoSymbolKind.Number,
      17: MonacoSymbolKind.Boolean,
      18: MonacoSymbolKind.Array,
      19: MonacoSymbolKind.Object,
      20: MonacoSymbolKind.Key,
      21: MonacoSymbolKind.Null,
      22: MonacoSymbolKind.EnumMember,
      23: MonacoSymbolKind.Struct,
      24: MonacoSymbolKind.Event,
      25: MonacoSymbolKind.Operator,
      26: MonacoSymbolKind.TypeParameter,
    };
    return map[kind] ?? MonacoSymbolKind.Variable;
  }

  /**
   * Shuts down all active LSP servers.
   */
  async shutdownAll() {
    for (const [, client] of this.activeClients.entries()) {
      try {
        await client.stop();
      } catch {}
    }
    this.activeClients.clear();
  }
}

export const lspManager = new LspManager();
