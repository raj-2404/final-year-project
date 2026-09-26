/**
 * Workspace State Manager
 * Tracks open editors, active file, expanded folders, and view states.
 */

import { workspaceStorage } from './workspaceStorage.js';

export class WorkspaceState {
  constructor() {
    this.workspaceId = null;
    this.expandedFolders = new Set();
    this.openTabs = []; // [{ id, path, name, pinned, isPreview }]
    this.activeFile = null;
    this.editorViewState = new Map(); // path -> { cursor, scroll }
    this.externalDirtyFiles = new Set(); // Files modified externally while dirty
  }

  init(workspaceId) {
    this.workspaceId = workspaceId;
    this.loadState();
  }

  loadState() {
    if (!this.workspaceId) return;
    const saved = workspaceStorage.getWorkspaceState(this.workspaceId);
    if (saved) {
      this.expandedFolders = new Set(saved.expandedFolders || []);
      this.openTabs = saved.openTabs || [];
      this.activeFile = saved.activeFile || null;
    }
  }

  saveState() {
    if (!this.workspaceId) return;
    const state = {
      expandedFolders: Array.from(this.expandedFolders),
      openTabs: this.openTabs,
      activeFile: this.activeFile,
    };
    workspaceStorage.saveWorkspaceState(this.workspaceId, state);
  }

  toggleFolderExpanded(folderId) {
    if (this.expandedFolders.has(folderId)) {
      this.expandedFolders.delete(folderId);
    } else {
      this.expandedFolders.add(folderId);
    }
    this.saveState();
  }

  isFolderExpanded(folderId) {
    return this.expandedFolders.has(folderId);
  }

  setExpandedFolders(folders) {
    this.expandedFolders = new Set(folders);
    this.saveState();
  }

  collapseAllFolders() {
    this.expandedFolders.clear();
    this.saveState();
  }

  setOpenTabs(tabs) {
    this.openTabs = tabs || [];
    this.saveState();
  }

  setActiveFile(file) {
    this.activeFile = file;
    this.saveState();
  }

  setEditorPosition(filePath, position) {
    if (!filePath || !position) return;
    this.editorViewState.set(filePath, position);
  }

  getEditorPosition(filePath) {
    return this.editorViewState.get(filePath) || null;
  }

  markExternalDirty(filePath) {
    this.externalDirtyFiles.add(filePath.replace(/\\/g, '/'));
  }

  clearExternalDirty(filePath) {
    this.externalDirtyFiles.delete(filePath.replace(/\\/g, '/'));
  }

  isExternalDirty(filePath) {
    return this.externalDirtyFiles.has(filePath.replace(/\\/g, '/'));
  }
}

export const workspaceState = new WorkspaceState();
