/**
 * CodeX Code Action Subsystem Manager
 * Level 3F — Refactoring & Code Actions
 *
 * Central coordinator for:
 * - CodeActionProvider registration across all supported languages
 * - Refactoring actions (Organize Imports, Extract, Rename)
 * - Safe WorkspaceEdit transactions
 * - Edit Preview Modal state management
 */

import { CodeActionProvider } from './codeActionProvider.js';
import { refactoringManager } from './refactoringManager.js';
import { codeActionRegistry } from './codeActionRegistry.js';

const SUPPORTED_LANGUAGES = [
  'javascript',
  'typescript',
  'javascriptreact',
  'typescriptreact',
  'python',
  'rust',
  'go',
  'c',
  'cpp',
  'java',
  'html',
  'css',
  'scss',
  'less',
  'sql',
];

class CodeActionManager {
  constructor() {
    this.monaco = null;
    this.workspaceRoot = '';
    this.fileTree = [];
    this.provider = null;
    this.disposables = [];
    this.registeredLanguages = new Set();

    this.refactoring = refactoringManager;
    this.activePreview = null; // { title, preview, onApply, onCancel }
    this.previewListeners = new Set();

    // Connect refactoring manager's preview handler to this manager
    this.refactoring.setPreviewHandler((previewData) => {
      this.openPreview(previewData);
    });
  }

  /**
   * Initializes the Code Action subsystem.
   * Safe to call multiple times or on workspace change.
   */
  initialize(monaco, context = {}) {
    if (!monaco) return;
    this.monaco = monaco;
    this.workspaceRoot = context.workspaceRoot || this.workspaceRoot;
    this.fileTree = context.fileTree || this.fileTree;

    this.refactoring.setContext({
      monaco: this.monaco,
      workspaceRoot: this.workspaceRoot,
      fileTree: this.fileTree,
    });

    if (!this.provider) {
      this.provider = new CodeActionProvider({
        monaco: this.monaco,
        workspaceRoot: this.workspaceRoot,
      });
    } else {
      this.provider.monaco = this.monaco;
      this.provider.workspaceRoot = this.workspaceRoot;
    }

    this.registerAllLanguageProviders();
  }

  updateContext({ fileTree, workspaceRoot }) {
    if (fileTree !== undefined) this.fileTree = fileTree;
    if (workspaceRoot !== undefined) this.workspaceRoot = workspaceRoot;

    if (this.provider) {
      this.provider.workspaceRoot = this.workspaceRoot;
    }

    this.refactoring.setContext({
      workspaceRoot: this.workspaceRoot,
      fileTree: this.fileTree,
    });
  }

  /**
   * Registers Monaco CodeActionProvider for each supported language.
   */
  registerAllLanguageProviders() {
    if (!this.monaco?.languages?.registerCodeActionProvider || !this.provider) return;

    for (const lang of SUPPORTED_LANGUAGES) {
      if (this.registeredLanguages.has(lang)) continue;

      try {
        const disposable = this.monaco.languages.registerCodeActionProvider(lang, {
          providedCodeActionKinds: [
            '',
            'quickfix',
            'refactor',
            'refactor.extract',
            'refactor.inline',
            'refactor.rewrite',
            'source',
            'source.organizeImports',
            'source.fixAll',
          ],
          provideCodeActions: async (model, range, context, token) => {
            return this.provider.provideCodeActions(model, range, context, token);
          },
        });

        this.disposables.push(disposable);
        this.registeredLanguages.add(lang);
      } catch (err) {
        console.warn(`[CodeActionManager] Failed to register code action provider for ${lang}:`, err);
      }
    }
  }

  // --- Edit Preview State Management ---

  openPreview(previewData) {
    this.activePreview = previewData;
    this.notifyPreviewChange();
  }

  closePreview() {
    this.activePreview = null;
    this.notifyPreviewChange();
  }

  async applyPreview() {
    if (this.activePreview?.onApply) {
      const fn = this.activePreview.onApply;
      this.closePreview();
      await fn();
    }
  }

  cancelPreview() {
    if (this.activePreview?.onCancel) {
      const fn = this.activePreview.onCancel;
      this.closePreview();
      fn();
    } else {
      this.closePreview();
    }
  }

  getActivePreview() {
    return this.activePreview;
  }

  onPreviewChange(listener) {
    if (typeof listener === 'function') {
      this.previewListeners.add(listener);
      return () => this.previewListeners.delete(listener);
    }
    return () => {};
  }

  notifyPreviewChange() {
    for (const listener of this.previewListeners) {
      try {
        listener(this.activePreview);
      } catch (err) {
        console.error('[CodeActionManager] Preview listener error:', err);
      }
    }
  }

  // --- High-level Actions & Command Triggers ---

  async triggerCodeAction(editor) {
    return this.refactoring.triggerCodeAction(editor);
  }

  async triggerQuickFix(editor) {
    return this.refactoring.triggerQuickFix(editor);
  }

  async triggerRefactor(editor) {
    return this.refactoring.triggerRefactor(editor);
  }

  async triggerOrganizeImports(editor) {
    return this.refactoring.organizeImports(editor);
  }

  async renameSymbol(editor) {
    return this.refactoring.renameSymbol(editor);
  }

  dispose() {
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
    this.registeredLanguages.clear();
    this.activePreview = null;
  }
}

export const codeActionManager = new CodeActionManager();
