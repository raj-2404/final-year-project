/**
 * CodeX Monaco Multi-File Model Manager
 * Level 2 — Multi-File Model Management & Project-Aware File Resolution
 *
 * Responsibilities:
 * - Generate canonical, stable file URIs for workspace files
 * - Create and reuse Monaco models across tabs and sessions
 * - Synchronize workspace files into Monaco so language services resolve cross-file imports
 * - Dispose models when appropriate without leaking memory
 * - Map Monaco URIs back to workspace files for cross-file navigation
 */

import { getLanguageForFilename } from './languageDetector.js';

class ModelManager {
  constructor() {
    this.managedUris = new Set();
  }

  /**
   * Generates a stable canonical URI string for a file in the workspace.
   * @param {string} filePath - File path or filename
   * @param {string} [workspaceRoot=''] - Workspace root path
   * @returns {string} Standard file:// URI string
   */
  getCanonicalUriString(filePath, workspaceRoot = '') {
    if (!filePath) return 'file:///workspace/untitled.txt';
    if (filePath.startsWith('file://')) return filePath;

    const cleanPath = filePath.replace(/\\/g, '/');

    // If absolute path
    if (cleanPath.startsWith('/') || /^[a-zA-Z]:\//.test(cleanPath)) {
      const formatted = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;
      return `file://${formatted.replace(/\/+/g, '/')}`;
    }

    // Relative path - prefix with workspaceRoot
    const cleanRoot = (workspaceRoot || '/workspace').replace(/\\/g, '/').replace(/\/+$/, '');
    const rootPrefix = cleanRoot.startsWith('/') ? cleanRoot : `/${cleanRoot}`;
    const relativePart = cleanPath.replace(/^\.?\/+/, '');
    return `file://${`${rootPrefix}/${relativePart}`.replace(/\/+/g, '/')}`;
  }

  /**
   * Generates a Monaco Uri object for a file.
   * @param {object} monaco - Monaco instance
   * @param {string} filePath - File path
   * @param {string} [workspaceRoot=''] - Workspace root
   * @returns {object} monaco.Uri
   */
  getCanonicalUri(monaco, filePath, workspaceRoot = '') {
    if (!monaco?.Uri) return null;
    const uriStr = this.getCanonicalUriString(filePath, workspaceRoot);
    return monaco.Uri.parse(uriStr);
  }

  /**
   * Retrieves an existing Monaco model or creates a new one with correct language and stable URI.
   * Reuses the model if already created.
   * @param {object} monaco - Monaco editor instance
   * @param {object} file - Workspace file object { id, name, path, content, language }
   * @param {string} [workspaceRoot=''] - Workspace root
   * @returns {object} monaco.editor.ITextModel
   */
  getOrCreateModel(monaco, file, workspaceRoot = '') {
    if (!monaco?.editor || !file) return null;

    const uri = this.getCanonicalUri(monaco, file.path || file.name, workspaceRoot);
    if (!uri) return null;

    let model = monaco.editor.getModel(uri);
    const expectedLanguage = file.language || getLanguageForFilename(file.name || file.path);

    if (model && !model.isDisposed()) {
      // Ensure language matches
      if (model.getLanguageId() !== expectedLanguage && expectedLanguage !== 'plaintext') {
        monaco.editor.setModelLanguage(model, expectedLanguage);
      }
      return model;
    }

    // Create new model
    try {
      model = monaco.editor.createModel(file.content ?? '', expectedLanguage, uri);
      this.managedUris.add(uri.toString());
      return model;
    } catch (err) {
      console.warn(`[ModelManager] Error creating model for ${file.name}:`, err);
      return monaco.editor.getModel(uri) || null;
    }
  }

  /**
   * Synchronizes project files into Monaco models so cross-file imports can be resolved
   * by the TypeScript language service worker.
   * @param {object} monaco - Monaco editor instance
   * @param {Array} fileTree - Workspace file tree
   * @param {string} [workspaceRoot=''] - Workspace root
   */
  syncWorkspaceFiles(monaco, fileTree, workspaceRoot = '') {
    if (!monaco?.editor || !Array.isArray(fileTree)) return;

    for (const item of fileTree) {
      if (item.type !== 'file') continue;

      const uri = this.getCanonicalUri(monaco, item.path || item.name, workspaceRoot);
      if (!uri) continue;

      let model = monaco.editor.getModel(uri);
      const language = item.language || getLanguageForFilename(item.name || item.path);

      if (!model || model.isDisposed()) {
        try {
          model = monaco.editor.createModel(item.content ?? '', language, uri);
          this.managedUris.add(uri.toString());
        } catch {
          // Model might have been created concurrently
        }
      } else if (item.content !== undefined && item.content !== null) {
        // If content was loaded or updated externally and differs, update it
        if (model.getValue() !== item.content) {
          model.setValue(item.content);
        }
      }
    }
  }

  /**
   * Finds a file in the workspace file tree by matching a Monaco Uri.
   * Used for cross-file "Go to Definition" navigation.
   * @param {Array} fileTree - Workspace file tree
   * @param {object|string} targetUri - Target Monaco Uri or URI string
   * @param {string} [workspaceRoot=''] - Workspace root
   * @returns {object|null} Matched file object or null
   */
  findFileByUri(fileTree, targetUri, workspaceRoot = '') {
    if (!Array.isArray(fileTree) || !targetUri) return null;

    const targetUriStr = typeof targetUri === 'string' ? targetUri : targetUri.toString();
    const cleanTarget = decodeURI(targetUriStr.replace(/^file:\/\//, '').replace(/\\/g, '/')).toLowerCase();

    for (const item of fileTree) {
      if (item.type !== 'file') continue;

      // 1. Direct canonical URI match
      const itemUriStr = this.getCanonicalUriString(item.path || item.name, workspaceRoot);
      if (itemUriStr.toLowerCase() === targetUriStr.toLowerCase()) {
        return item;
      }

      // 2. Normalized path suffix match
      const cleanItemPath = (item.path || item.name).replace(/\\/g, '/').toLowerCase();
      if (cleanTarget.endsWith(cleanItemPath) || cleanItemPath.endsWith(cleanTarget)) {
        return item;
      }
    }

    return null;
  }

  /**
   * Safely disposes a model when its tab/file is closed, preserving unsaved changes if needed.
   * @param {object} monaco - Monaco instance
   * @param {object} file - File object
   * @param {string} [workspaceRoot=''] - Workspace root
   */
  disposeModel(monaco, file, workspaceRoot = '') {
    if (!monaco?.editor || !file) return;

    const uri = this.getCanonicalUri(monaco, file.path || file.name, workspaceRoot);
    if (!uri) return;

    const model = monaco.editor.getModel(uri);
    if (model && !model.isDisposed()) {
      model.dispose();
      this.managedUris.delete(uri.toString());
    }
  }

  /**
   * Disposes all managed models on workspace unmount.
   * @param {object} monaco - Monaco instance
   */
  disposeAll(monaco) {
    if (!monaco?.editor) return;

    for (const uriStr of this.managedUris) {
      try {
        const uri = monaco.Uri.parse(uriStr);
        const model = monaco.editor.getModel(uri);
        if (model && !model.isDisposed()) {
          model.dispose();
        }
      } catch {}
    }
    this.managedUris.clear();
  }
}

export const modelManager = new ModelManager();
