/**
 * CodeX Language Intelligence Service
 * Level 2 — Language Service Coordinator & Level 3A LSP Integration
 *
 * Central abstraction coordinating:
 * - TypeScript & JavaScript language intelligence (via Monaco native service)
 * - Language Server Protocol intelligence (Python, Rust, Go, C/C++, Java via local LSP)
 * - Cross-file Go to Definition navigation
 * - Diagnostics & Marker monitoring
 * - Document & Selection Formatting
 * - Symbol Rename & Reference Search
 */

import { typescriptService } from './typescriptService.js';
import { modelManager } from './modelManager.js';
import { lspManager } from './lsp/lspManager.js';
import { languageProviderRegistry } from './providers.js';

class LanguageService {
  constructor() {
    this.monaco = null;
    this.editor = null;
    this.openerRegistered = false;
    this.markerListener = null;
    this.navigationHandler = null;
    this.diagnosticsHandler = null;
    this.currentFileTree = [];
    this.currentWorkspaceRoot = '';
  }

  /**
   * Initializes language services on Monaco instance.
   * Safe to call multiple times or in beforeMount.
   * @param {object} monaco - Monaco instance
   * @param {object} [context={}] - Context containing workspaceRoot
   */
  initialize(monaco, context = {}) {
    if (!monaco) return;
    this.monaco = monaco;
    this.currentWorkspaceRoot = context.workspaceRoot || '';

    // 1. Initialize TypeScript/JavaScript language service
    typescriptService.setup(monaco);

    // 2. Initialize Fallback & Native Language Providers (HTML, CSS/SCSS/LESS, SQL, JSON)
    languageProviderRegistry.registerAll(monaco);

    // 3. Initialize LSP Subsystem
    lspManager.initialize(monaco, context);

    // 3. Register Cross-File Code Editor Opener (Go to Definition across files)
    if (!this.openerRegistered && monaco.editor?.registerEditorOpener) {
      try {
        monaco.editor.registerEditorOpener({
          openCodeEditor: (source, resource, selectionOrPosition) => {
            return this.handleOpenCodeEditor(source, resource, selectionOrPosition);
          },
        });
        this.openerRegistered = true;
      } catch (err) {
        console.warn('[LanguageService] Could not register editor opener:', err);
      }
    }
  }

  /**
   * Sets up editor instance listeners (Diagnostics, Navigation, Context).
   * @param {object} editor - Monaco IStandaloneCodeEditor instance
   * @param {object} monaco - Monaco instance
   * @param {object} options - { onNavigate, onDiagnosticsChange, fileTree, workspaceRoot }
   */
  setupEditor(editor, monaco, options = {}) {
    this.editor = editor;
    this.monaco = monaco || this.monaco;
    this.navigationHandler = options.onNavigate || null;
    this.diagnosticsHandler = options.onDiagnosticsChange || null;
    this.currentFileTree = options.fileTree || this.currentFileTree;
    this.currentWorkspaceRoot = options.workspaceRoot || this.currentWorkspaceRoot;

    // Load project tsconfig/jsconfig if present
    if (this.currentFileTree.length > 0) {
      typescriptService.loadProjectConfig(this.monaco, this.currentFileTree);
    }

    // Update LSP subsystem context
    lspManager.initialize(this.monaco, {
      workspaceRoot: this.currentWorkspaceRoot,
      fileTree: this.currentFileTree,
      onNavigate: this.navigationHandler,
    });

    // Diagnostics listener for status bar / problems (combines TS and LSP markers)
    if (this.monaco?.editor?.onDidChangeMarkers && this.diagnosticsHandler) {
      if (this.markerListener) {
        this.markerListener.dispose();
      }
      this.markerListener = this.monaco.editor.onDidChangeMarkers(() => {
        this.computeAndReportDiagnostics();
      });
      // Initial diagnostic report
      this.computeAndReportDiagnostics();
    }
  }

  /**
   * Updates workspace context (fileTree, workspaceRoot).
   */
  updateContext(fileTree, workspaceRoot) {
    if (Array.isArray(fileTree)) {
      this.currentFileTree = fileTree;
    }
    if (workspaceRoot !== undefined) {
      this.currentWorkspaceRoot = workspaceRoot;
    }
    lspManager.updateContext(this.currentFileTree, this.currentWorkspaceRoot);
  }

  /**
   * Notifies language subsystem of file open.
   */
  async handleFileOpen(file) {
    if (file && this.monaco) {
      await lspManager.handleFileOpen(this.monaco, file, this.currentWorkspaceRoot);
    }
  }

  /**
   * Notifies language subsystem of file change.
   */
  async handleFileChange(file, newCode) {
    if (file && this.monaco) {
      await lspManager.handleFileChange(this.monaco, file, newCode);
    }
  }

  /**
   * Notifies language subsystem of file save.
   */
  async handleFileSave(file) {
    if (file && this.monaco) {
      await lspManager.handleFileSave(this.monaco, file);
    }
  }

  /**
   * Notifies language subsystem of file close.
   */
  async handleFileClose(file) {
    if (file && this.monaco) {
      await lspManager.handleFileClose(this.monaco, file);
    }
  }

  /**
   * Handles cross-file navigation from Monaco (e.g. Go to Definition).
   * @private
   */
  handleOpenCodeEditor(source, resource, selectionOrPosition) {
    if (!resource || !this.navigationHandler) return false;

    // Check if the target is another file in workspace
    const targetFile = modelManager.findFileByUri(
      this.currentFileTree,
      resource,
      this.currentWorkspaceRoot
    );

    if (targetFile) {
      this.navigationHandler(targetFile, selectionOrPosition);
      return true;
    }

    return false;
  }

  /**
   * Calculates active diagnostics (errors & warnings) and notifies listener.
   * @private
   */
  computeAndReportDiagnostics() {
    if (!this.monaco?.editor?.getModelMarkers || !this.diagnosticsHandler) return;

    try {
      const markers = this.monaco.editor.getModelMarkers({});
      const errors = markers.filter(
        (m) => m.severity === this.monaco.MarkerSeverity.Error
      ).length;
      const warnings = markers.filter(
        (m) => m.severity === this.monaco.MarkerSeverity.Warning
      ).length;

      this.diagnosticsHandler({ errors, warnings, markers });
    } catch {}
  }

  /**
   * Triggers Document Formatting on active editor.
   * @param {object} [editor] - Editor instance (defaults to current)
   */
  formatDocument(editor = this.editor) {
    if (!editor) return;
    const action = editor.getAction('editor.action.formatDocument');
    if (action?.isSupported()) {
      action.run();
    }
  }

  /**
   * Triggers Selection Formatting on active editor.
   * @param {object} [editor] - Editor instance (defaults to current)
   */
  formatSelection(editor = this.editor) {
    if (!editor) return;
    const action = editor.getAction('editor.action.formatSelection');
    if (action?.isSupported()) {
      action.run();
    }
  }

  /**
   * Triggers Symbol Rename dialog.
   * @param {object} [editor] - Editor instance
   */
  triggerRename(editor = this.editor) {
    if (!editor) return;
    const action = editor.getAction('editor.action.rename');
    if (action?.isSupported()) {
      action.run();
    }
  }

  /**
   * Triggers Find All References peek widget.
   * @param {object} [editor] - Editor instance
   */
  triggerFindReferences(editor = this.editor) {
    if (!editor) return;
    const action = editor.getAction('editor.action.referenceSearch.trigger');
    if (action?.isSupported()) {
      action.run();
    }
  }

  /**
   * Triggers Go To Definition.
   * @param {object} [editor] - Editor instance
   */
  triggerGoToDefinition(editor = this.editor) {
    if (!editor) return;
    const action = editor.getAction('editor.action.revealDefinition');
    if (action?.isSupported()) {
      action.run();
    }
  }

  /**
   * Cleanup listeners and language servers on unmount.
   */
  dispose() {
    if (this.markerListener) {
      this.markerListener.dispose();
      this.markerListener = null;
    }
    lspManager.shutdownAll();
    languageProviderRegistry.dispose();
    this.editor = null;
    this.navigationHandler = null;
    this.diagnosticsHandler = null;
  }
}

export const languageService = new LanguageService();
