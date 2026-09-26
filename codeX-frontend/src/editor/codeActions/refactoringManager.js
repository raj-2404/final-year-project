/**
 * CodeX Refactoring Manager
 * Level 3F — Refactoring & Code Actions
 *
 * Coordinates refactoring commands, preview generation, and safe transaction execution.
 * Guarantees that refactoring is strictly a local operation.
 */

import { EditTransaction } from './editTransaction.js';
import { CodeActionKind } from './codeActionTypes.js';

export class RefactoringManager {
  constructor({ monaco = null, workspaceRoot = '', fileTree = [] } = {}) {
    this.monaco = monaco;
    this.workspaceRoot = workspaceRoot;
    this.fileTree = fileTree;

    this.previewHandler = null; // (previewData, onApply, onCancel) => void
    this.lastTransaction = null;
  }

  setContext({ monaco, workspaceRoot, fileTree }) {
    if (monaco) this.monaco = monaco;
    if (workspaceRoot !== undefined) this.workspaceRoot = workspaceRoot;
    if (fileTree !== undefined) this.fileTree = fileTree;
  }

  setPreviewHandler(handler) {
    this.previewHandler = handler;
  }

  /**
   * Applies a CodeAction or WorkspaceEdit with safety validation.
   * If the edit touches multiple files or is destructive, routes to preview modal.
   * Otherwise applies immediately with transactional undo.
   * @param {object} action - CodeAction { title, edit, command }
   * @param {object} editor - Monaco editor instance
   * @param {boolean} [forcePreview=false] - Force display of preview modal
   * @returns {Promise<{ applied: boolean, cancelled: boolean, affectedFiles: string[] }>}
   */
  async applyCodeAction(action, editor, forcePreview = false) {
    if (!action) return { applied: false, cancelled: true, affectedFiles: [] };

    const edit = action.edit || action;
    const transaction = new EditTransaction({
      workspaceRoot: this.workspaceRoot,
      monaco: this.monaco,
      editor,
      fileTree: this.fileTree,
    });

    const preview = await transaction.generatePreview(edit);

    if (preview.operations.length === 0) {
      return { applied: false, cancelled: true, affectedFiles: [] };
    }

    // Determine if user confirmation / preview diff is required
    const needsPreview = forcePreview || preview.requiresPreviewModal;

    if (needsPreview && this.previewHandler) {
      return new Promise((resolve) => {
        this.previewHandler({
          title: action.title || 'Refactoring Preview',
          preview,
          onApply: async () => {
            try {
              const res = await transaction.apply(edit);
              this.lastTransaction = transaction;
              resolve({ applied: true, cancelled: false, affectedFiles: res.affectedFiles });
            } catch (err) {
              console.error('[RefactoringManager] Error applying refactor:', err);
              resolve({ applied: false, cancelled: false, error: err.message, affectedFiles: [] });
            }
          },
          onCancel: () => {
            resolve({ applied: false, cancelled: true, affectedFiles: [] });
          },
        });
      });
    }

    // Direct single-file apply
    const res = await transaction.apply(edit);
    this.lastTransaction = transaction;
    return { applied: true, cancelled: false, affectedFiles: res.affectedFiles };
  }

  /**
   * Reverts the most recent multi-file refactoring transaction.
   */
  async undoLastTransaction() {
    if (this.lastTransaction) {
      await this.lastTransaction.rollback();
      this.lastTransaction = null;
      return true;
    }
    return false;
  }

  /**
   * Triggers Organize Imports on the active editor.
   */
  async organizeImports(editor) {
    if (!editor) return false;
    const model = editor.getModel();
    if (!model) return false;

    // Trigger Monaco's native organize imports action if available
    const action = editor.getAction('editor.action.organizeImports');
    if (action && action.isSupported()) {
      await action.run();
      return true;
    }

    return false;
  }

  /**
   * Triggers Rename Symbol at current cursor position.
   */
  async renameSymbol(editor) {
    if (!editor) return false;
    const action = editor.getAction('editor.action.rename');
    if (action && action.isSupported()) {
      await action.run();
      return true;
    }
    return false;
  }

  /**
   * Triggers Refactor context menu on active editor.
   */
  async triggerRefactor(editor) {
    if (!editor) return false;
    const action = editor.getAction('editor.action.refactor');
    if (action && action.isSupported()) {
      await action.run();
      return true;
    }
    return false;
  }

  /**
   * Triggers Quick Fix lightbulb menu on active editor.
   */
  async triggerQuickFix(editor) {
    if (!editor) return false;
    const action = editor.getAction('editor.action.quickFix');
    if (action && action.isSupported()) {
      await action.run();
      return true;
    }
    return false;
  }

  /**
   * Triggers generic Code Action menu on active editor.
   */
  async triggerCodeAction(editor) {
    if (!editor) return false;
    const action = editor.getAction('editor.action.codeAction');
    if (action && action.isSupported()) {
      await action.run();
      return true;
    }
    // Fallback to quickFix
    return this.triggerQuickFix(editor);
  }
}

export const refactoringManager = new RefactoringManager();
