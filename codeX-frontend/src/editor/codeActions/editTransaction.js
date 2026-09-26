/**
 * CodeX WorkspaceEdit Transaction Layer
 * Level 3F — Refactoring & Code Actions
 *
 * Provides safe, validated, atomic application of single-file and multi-file WorkspaceEdits.
 * Guarantees:
 * - Paths stay strictly within the active workspace (prevents directory traversal)
 * - Monaco undo stack integration for open models
 * - Preserves unsaved editor content
 * - Atomic rollback capability if multi-file transaction encounters errors
 * - Diff summary generation for preview
 */

import { EditOperationType, TransactionState } from './codeActionTypes.js';
import { modelManager } from '../languages/modelManager.js';
import { filesystemService } from '../../services/native/index.js';
import { isDesktopApp } from '../../services/native/platform.js';

export class EditTransaction {
  constructor({ workspaceRoot = '', monaco = null, editor = null, fileTree = [] } = {}) {
    this.workspaceRoot = workspaceRoot ? workspaceRoot.replace(/\\/g, '/').replace(/\/+$/, '') : '';
    this.monaco = monaco;
    this.editor = editor;
    this.fileTree = fileTree;

    this.state = TransactionState.IDLE;
    this.rollbackLog = []; // { type, path, uri, previousContent, isNew, oldPath }
  }

  /**
   * Validates that a file path or URI resides strictly inside the workspace.
   * Throws Error if path escapes workspace root.
   */
  validatePathSafety(pathOrUri) {
    if (!pathOrUri) {
      throw new Error('Invalid empty path in WorkspaceEdit.');
    }

    const clean = pathOrUri
      .replace(/^file:\/\//, '')
      .replace(/\\/g, '/');

    // Reject explicit directory traversal attempts
    if (clean.includes('../') || clean.includes('/..')) {
      throw new Error(`Security violation: Path traversal detected in WorkspaceEdit: ${pathOrUri}`);
    }

    if (this.workspaceRoot) {
      const cleanRoot = this.workspaceRoot;
      // If absolute path, must start with workspaceRoot
      if (clean.startsWith('/') && !clean.startsWith(cleanRoot)) {
        throw new Error(`Security violation: WorkspaceEdit path escapes workspace: ${clean}`);
      }
    }

    return true;
  }

  /**
   * Normalizes any URI or relative/absolute path to an absolute path and canonical URI.
   */
  resolvePathAndUri(pathOrUri) {
    this.validatePathSafety(pathOrUri);

    let clean = pathOrUri.replace(/\\/g, '/');
    if (clean.startsWith('file://')) {
      clean = decodeURIComponent(clean.replace(/^file:\/\//, ''));
    }

    let absolutePath = clean;
    if (!clean.startsWith('/') && !/^[a-zA-Z]:\//.test(clean)) {
      absolutePath = `${this.workspaceRoot}/${clean}`.replace(/\/+/g, '/');
    }

    const uriStr = modelManager.getCanonicalUriString(absolutePath, this.workspaceRoot);
    return { absolutePath, uriStr };
  }

  /**
   * Normalizes incoming edit payload from LSP, Monaco, or TypeScript Worker.
   * @param {object} rawEdit - LSP WorkspaceEdit, Monaco WorkspaceEdit, or TS FileTextChanges
   * @returns {Array<object>} Normalized operations list
   */
  normalizeOperations(rawEdit) {
    const operations = [];

    if (!rawEdit) return operations;

    // 1. TypeScript Worker FileTextChanges array: [{ fileName, textChanges, isNewFile }]
    if (Array.isArray(rawEdit)) {
      for (const item of rawEdit) {
        if (!item || !item.fileName) continue;
        const { absolutePath, uriStr } = this.resolvePathAndUri(item.fileName);

        if (item.isNewFile) {
          operations.push({
            type: EditOperationType.CREATE_FILE,
            path: absolutePath,
            uri: uriStr,
          });
        }

        if (Array.isArray(item.textChanges)) {
          operations.push({
            type: EditOperationType.TEXT_EDIT,
            path: absolutePath,
            uri: uriStr,
            changes: item.textChanges.map((tc) => ({
              span: tc.span, // { start, length }
              newText: tc.newText || '',
            })),
          });
        }
      }
      return operations;
    }

    // 2. LSP WorkspaceEdit: documentChanges
    if (Array.isArray(rawEdit.documentChanges)) {
      for (const dc of rawEdit.documentChanges) {
        if (!dc) continue;

        // TextDocumentEdit
        if (dc.textDocument && Array.isArray(dc.edits)) {
          const { absolutePath, uriStr } = this.resolvePathAndUri(dc.textDocument.uri);
          operations.push({
            type: EditOperationType.TEXT_EDIT,
            path: absolutePath,
            uri: uriStr,
            version: dc.textDocument.version,
            changes: dc.edits.map((e) => ({
              range: e.range, // LSP 0-based range
              newText: e.newText || '',
            })),
          });
        } else if (dc.kind === 'create') {
          const { absolutePath, uriStr } = this.resolvePathAndUri(dc.uri);
          operations.push({
            type: EditOperationType.CREATE_FILE,
            path: absolutePath,
            uri: uriStr,
            overwrite: Boolean(dc.options?.overwrite),
          });
        } else if (dc.kind === 'rename') {
          const oldResolved = this.resolvePathAndUri(dc.oldUri);
          const newResolved = this.resolvePathAndUri(dc.newUri);
          operations.push({
            type: EditOperationType.RENAME_FILE,
            oldPath: oldResolved.absolutePath,
            oldUri: oldResolved.uriStr,
            newPath: newResolved.absolutePath,
            newUri: newResolved.uriStr,
          });
        } else if (dc.kind === 'delete') {
          const { absolutePath, uriStr } = this.resolvePathAndUri(dc.uri);
          operations.push({
            type: EditOperationType.DELETE_FILE,
            path: absolutePath,
            uri: uriStr,
          });
        }
      }
      return operations;
    }

    // 3. LSP WorkspaceEdit: changes map { [uri]: TextEdit[] }
    if (rawEdit.changes && typeof rawEdit.changes === 'object') {
      for (const [uriKey, edits] of Object.entries(rawEdit.changes)) {
        if (!Array.isArray(edits) || edits.length === 0) continue;
        const { absolutePath, uriStr } = this.resolvePathAndUri(uriKey);
        operations.push({
          type: EditOperationType.TEXT_EDIT,
          path: absolutePath,
          uri: uriStr,
          changes: edits.map((e) => ({
            range: e.range,
            newText: e.newText || '',
          })),
        });
      }
      return operations;
    }

    // 4. Monaco WorkspaceEdit: edits array (IWorkspaceTextEdit | IWorkspaceFileEdit)
    if (Array.isArray(rawEdit.edits)) {
      const textEditsByUri = new Map();

      for (const edit of rawEdit.edits) {
        if (!edit) continue;

        if (edit.resource && edit.textEdit) {
          const uriStr = edit.resource.toString();
          if (!textEditsByUri.has(uriStr)) {
            textEditsByUri.set(uriStr, []);
          }
          textEditsByUri.get(uriStr).push(edit.textEdit);
        } else if (edit.newResource || edit.oldResource) {
          // File edit in Monaco
          if (edit.oldResource && edit.newResource) {
            const oldRes = this.resolvePathAndUri(edit.oldResource.toString());
            const newRes = this.resolvePathAndUri(edit.newResource.toString());
            operations.push({
              type: EditOperationType.RENAME_FILE,
              oldPath: oldRes.absolutePath,
              oldUri: oldRes.uriStr,
              newPath: newRes.absolutePath,
              newUri: newRes.uriStr,
            });
          } else if (edit.newResource && !edit.oldResource) {
            const { absolutePath, uriStr } = this.resolvePathAndUri(edit.newResource.toString());
            operations.push({
              type: EditOperationType.CREATE_FILE,
              path: absolutePath,
              uri: uriStr,
            });
          } else if (edit.oldResource && !edit.newResource) {
            const { absolutePath, uriStr } = this.resolvePathAndUri(edit.oldResource.toString());
            operations.push({
              type: EditOperationType.DELETE_FILE,
              path: absolutePath,
              uri: uriStr,
            });
          }
        }
      }

      for (const [uriStr, edits] of textEditsByUri.entries()) {
        const { absolutePath } = this.resolvePathAndUri(uriStr);
        operations.push({
          type: EditOperationType.TEXT_EDIT,
          path: absolutePath,
          uri: uriStr,
          changes: edits,
        });
      }

      return operations;
    }

    return operations;
  }

  /**
   * Generates a preview diff of changes without applying them to disk.
   */
  async generatePreview(rawEdit) {
    const operations = this.normalizeOperations(rawEdit);
    const filePreviews = [];

    for (const op of operations) {
      if (op.type === EditOperationType.TEXT_EDIT) {
        const currentContent = await this.readCurrentContent(op.path, op.uri);
        const newContent = this.simulateTextEdits(currentContent, op.changes);

        filePreviews.push({
          type: EditOperationType.TEXT_EDIT,
          path: op.path,
          uri: op.uri,
          relativeName: op.path.replace(`${this.workspaceRoot}/`, ''),
          oldContent: currentContent,
          newContent,
          isModified: currentContent !== newContent,
        });
      } else if (op.type === EditOperationType.CREATE_FILE) {
        filePreviews.push({
          type: EditOperationType.CREATE_FILE,
          path: op.path,
          uri: op.uri,
          relativeName: op.path.replace(`${this.workspaceRoot}/`, ''),
          oldContent: '',
          newContent: '',
          isNew: true,
        });
      } else if (op.type === EditOperationType.DELETE_FILE) {
        const currentContent = await this.readCurrentContent(op.path, op.uri);
        filePreviews.push({
          type: EditOperationType.DELETE_FILE,
          path: op.path,
          uri: op.uri,
          relativeName: op.path.replace(`${this.workspaceRoot}/`, ''),
          oldContent: currentContent,
          newContent: '',
          isDelete: true,
        });
      } else if (op.type === EditOperationType.RENAME_FILE) {
        filePreviews.push({
          type: EditOperationType.RENAME_FILE,
          oldPath: op.oldPath,
          newPath: op.newPath,
          relativeName: `${op.oldPath.replace(`${this.workspaceRoot}/`, '')} → ${op.newPath.replace(`${this.workspaceRoot}/`, '')}`,
          isRename: true,
        });
      }
    }

    const isMultiFile = filePreviews.length > 1;
    const hasDestructive = filePreviews.some((p) => p.isDelete || p.isRename || p.isNew);

    return {
      operations,
      filePreviews,
      isMultiFile,
      hasDestructive,
      requiresPreviewModal: isMultiFile || hasDestructive,
    };
  }

  /**
   * Applies the transaction with atomic rollback on failure.
   */
  async apply(rawEdit) {
    this.state = TransactionState.APPLYING;
    this.rollbackLog = [];
    const operations = this.normalizeOperations(rawEdit);
    const affectedPaths = new Set();

    try {
      for (const op of operations) {
        if (op.type === EditOperationType.TEXT_EDIT) {
          await this.applyTextEdits(op);
          affectedPaths.add(op.path);
        } else if (op.type === EditOperationType.CREATE_FILE) {
          await this.applyCreateFile(op);
          affectedPaths.add(op.path);
        } else if (op.type === EditOperationType.RENAME_FILE) {
          await this.applyRenameFile(op);
          affectedPaths.add(op.oldPath);
          affectedPaths.add(op.newPath);
        } else if (op.type === EditOperationType.DELETE_FILE) {
          await this.applyDeleteFile(op);
          affectedPaths.add(op.path);
        }
      }

      this.state = TransactionState.APPLIED;
      return {
        success: true,
        affectedFiles: Array.from(affectedPaths),
        rollback: () => this.rollback(),
      };
    } catch (err) {
      this.state = TransactionState.FAILED;
      console.error('[EditTransaction] Transaction failed, rolling back:', err);
      await this.rollback();
      throw err;
    }
  }

  /**
   * Reverts all operations performed in this transaction.
   */
  async rollback() {
    this.state = TransactionState.ROLLED_BACK;

    // Rollback in reverse order
    for (let i = this.rollbackLog.length - 1; i >= 0; i--) {
      const entry = this.rollbackLog[i];
      try {
        if (entry.type === EditOperationType.TEXT_EDIT) {
          await this.writeContent(entry.path, entry.uri, entry.previousContent);
        } else if (entry.type === EditOperationType.CREATE_FILE) {
          if (isDesktopApp()) {
            await filesystemService.delete(entry.path);
          }
        } else if (entry.type === EditOperationType.DELETE_FILE) {
          await this.writeContent(entry.path, entry.uri, entry.previousContent);
        } else if (entry.type === EditOperationType.RENAME_FILE) {
          if (isDesktopApp()) {
            await filesystemService.rename(entry.newPath, entry.oldPath);
          }
        }
      } catch (rollbackErr) {
        console.warn('[EditTransaction] Error during rollback step:', rollbackErr);
      }
    }
  }

  // --- Internal File & Model Handlers ---

  async readCurrentContent(filePath, uriStr) {
    if (this.monaco?.editor) {
      const uri = this.monaco.Uri.parse(uriStr);
      const model = this.monaco.editor.getModel(uri);
      if (model && !model.isDisposed()) {
        return model.getValue();
      }
    }

    if (isDesktopApp()) {
      try {
        const exists = await filesystemService.exists(filePath);
        if (exists) {
          return await filesystemService.readFile(filePath);
        }
      } catch {}
    }

    const matched = this.fileTree.find((f) => f.path === filePath || f.name === filePath);
    return matched?.content ?? '';
  }

  async writeContent(filePath, uriStr, content) {
    if (this.monaco?.editor) {
      const uri = this.monaco.Uri.parse(uriStr);
      const model = this.monaco.editor.getModel(uri);
      if (model && !model.isDisposed()) {
        model.setValue(content);
      }
    }

    if (isDesktopApp()) {
      await filesystemService.writeFile(filePath, content);
    }
  }

  async applyTextEdits(op) {
    const currentContent = await this.readCurrentContent(op.path, op.uri);
    this.rollbackLog.push({
      type: EditOperationType.TEXT_EDIT,
      path: op.path,
      uri: op.uri,
      previousContent: currentContent,
    });

    let model = null;
    if (this.monaco?.editor) {
      const uri = this.monaco.Uri.parse(op.uri);
      model = this.monaco.editor.getModel(uri);
    }

    if (model && !model.isDisposed()) {
      // Convert edits to Monaco SingleEditOperations
      const monacoEdits = op.changes.map((c) => {
        let range;
        if (c.range) {
          // Check if range is LSP 0-based or Monaco 1-based
          const isLsp = typeof c.range.start?.character === 'number';
          if (isLsp) {
            range = new this.monaco.Range(
              c.range.start.line + 1,
              c.range.start.character + 1,
              c.range.end.line + 1,
              c.range.end.character + 1
            );
          } else {
            range = c.range;
          }
        } else if (c.span) {
          const startPos = model.getPositionAt(c.span.start);
          const endPos = model.getPositionAt(c.span.start + c.span.length);
          range = new this.monaco.Range(
            startPos.lineNumber,
            startPos.column,
            endPos.lineNumber,
            endPos.column
          );
        } else {
          range = model.getFullModelRange();
        }

        return {
          range,
          text: c.newText,
          forceMoveMarkers: true,
        };
      });

      // Use editor.executeEdits if this model is active in the current editor
      if (this.editor && this.editor.getModel() === model) {
        this.editor.executeEdits('codex-refactor', monacoEdits);
      } else {
        model.pushEditOperations([], monacoEdits, () => null);
      }

      // If in desktop mode, also persist updated content
      if (isDesktopApp()) {
        await filesystemService.writeFile(op.path, model.getValue());
      }
    } else {
      // Model not open in Monaco: apply edits in string buffer and write to disk
      const newContent = this.simulateTextEdits(currentContent, op.changes);
      await this.writeContent(op.path, op.uri, newContent);
    }
  }

  async applyCreateFile(op) {
    this.rollbackLog.push({
      type: EditOperationType.CREATE_FILE,
      path: op.path,
      uri: op.uri,
    });

    if (isDesktopApp()) {
      await filesystemService.createFile(op.path, '');
    }
  }

  async applyRenameFile(op) {
    this.rollbackLog.push({
      type: EditOperationType.RENAME_FILE,
      oldPath: op.oldPath,
      newPath: op.newPath,
    });

    if (isDesktopApp()) {
      await filesystemService.rename(op.oldPath, op.newPath);
    }
  }

  async applyDeleteFile(op) {
    const currentContent = await this.readCurrentContent(op.path, op.uri);
    this.rollbackLog.push({
      type: EditOperationType.DELETE_FILE,
      path: op.path,
      uri: op.uri,
      previousContent: currentContent,
    });

    if (isDesktopApp()) {
      await filesystemService.delete(op.path);
    }
  }

  simulateTextEdits(content, changes = []) {
    if (!content && changes.length === 0) return '';
    const lines = (content || '').split('\n');

    // Sort edits descending by position so edits don't invalidate subsequent offsets
    const sorted = [...changes].sort((a, b) => {
      const aLine = a.range?.start?.line ?? 0;
      const bLine = b.range?.start?.line ?? 0;
      if (aLine !== bLine) return bLine - aLine;
      const aCol = a.range?.start?.character ?? a.span?.start ?? 0;
      const bCol = b.range?.start?.character ?? b.span?.start ?? 0;
      return bCol - aCol;
    });

    let current = content;

    for (const c of sorted) {
      if (c.span) {
        const prefix = current.slice(0, c.span.start);
        const suffix = current.slice(c.span.start + c.span.length);
        current = prefix + (c.newText || '') + suffix;
      } else if (c.range) {
        // Line-based replacement
        const startLine = c.range.start.line;
        const startCol = c.range.start.character;
        const endLine = c.range.end.line;
        const endCol = c.range.end.character;

        let charStart = 0;
        for (let l = 0; l < startLine && l < lines.length; l++) {
          charStart += lines[l].length + 1;
        }
        charStart += startCol;

        let charEnd = 0;
        for (let l = 0; l < endLine && l < lines.length; l++) {
          charEnd += lines[l].length + 1;
        }
        charEnd += endCol;

        const prefix = current.slice(0, charStart);
        const suffix = current.slice(charEnd);
        current = prefix + (c.newText || '') + suffix;
      }
    }

    return current;
  }
}
