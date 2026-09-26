/**
 * Central Workspace Manager Subsystem (Level 3H)
 * Authoritative coordinator for workspace model, multi-root folders,
 * filesystem operations, project context, and watcher events.
 */

import { WorkspaceModel } from './workspaceModel.js';
import { workspaceEvents } from './workspaceEvents.js';
import { workspaceStorage } from './workspaceStorage.js';
import { workspaceSettings } from './workspaceSettings.js';
import { workspaceDiscovery } from './workspaceDiscovery.js';
import { workspaceFolders } from './workspaceFolders.js';
import { workspaceFiles } from './workspaceFiles.js';
import { workspaceState } from './workspaceState.js';
import { WorkspaceEventType } from './workspaceTypes.js';
import { workspaceService } from '../services/native/workspace.js';
import { gitManager } from '../git/gitManager.js';

class WorkspaceManager {
  constructor() {
    this.currentWorkspace = null;
    this.watcherCleanup = null;
    this.internalWrites = new Map(); // path -> timestamp
    this.externalChangePrompt = null; // { path, diskContent, inMemoryContent }
    this.debounceTimer = null;
  }

  getWorkspace() {
    return this.currentWorkspace;
  }

  getWorkspaceFolders() {
    return this.currentWorkspace ? this.currentWorkspace.folders : [];
  }

  getActiveWorkspaceFolder() {
    if (!this.currentWorkspace) return null;
    if (this.currentWorkspace.activeFolder) {
      return this.currentWorkspace.folders.find((f) => f.path === this.currentWorkspace.activeFolder) || this.currentWorkspace.folders[0] || null;
    }
    return this.currentWorkspace.folders[0] || null;
  }

  /**
   * Opens a single folder as a workspace
   */
  async openFolder(folderPath) {
    if (!folderPath) return null;
    const cleanPath = folderPath.replace(/\\/g, '/');
    const folderName = cleanPath.split('/').filter(Boolean).pop() || 'Project';

    const projectInfo = await workspaceDiscovery.detectProject(cleanPath);

    const model = new WorkspaceModel({
      id: `ws-${cleanPath.replace(/[^a-zA-Z0-9]/g, '_')}`,
      name: folderName,
      root: cleanPath,
      folders: [
        {
          id: `folder-${cleanPath}`,
          name: folderName,
          path: cleanPath,
          projectInfo,
        },
      ],
      isMultiRoot: false,
    });

    return await this._setWorkspace(model);
  }

  /**
   * Opens a workspace file (.codex-workspace or .code-workspace)
   */
  async openWorkspace(filePath) {
    if (!filePath) return null;
    const cleanPath = filePath.replace(/\\/g, '/');

    try {
      const content = await workspaceFiles.readFile(cleanPath);
      const model = WorkspaceModel.fromWorkspaceFileContent(content, cleanPath);

      // Resolve projects for all folders
      model.folders = await workspaceFolders.resolveFolderProjects(model.folders);

      return await this._setWorkspace(model);
    } catch (err) {
      console.error(`Failed to open workspace file ${cleanPath}:`, err);
      throw err;
    }
  }

  /**
   * Saves workspace configuration to file
   */
  async saveWorkspace(targetFilePath) {
    if (!this.currentWorkspace) return;
    const path = targetFilePath || this.currentWorkspace.filePath;
    if (!path) throw new Error('Target workspace file path is required');

    const cleanPath = path.replace(/\\/g, '/');
    const content = this.currentWorkspace.toWorkspaceFileContent();
    await workspaceFiles.writeFile(cleanPath, content);
    this.currentWorkspace.filePath = cleanPath;

    workspaceEvents.emit(WorkspaceEventType.WORKSPACE_SAVED, this.currentWorkspace);
    return cleanPath;
  }

  /**
   * Internal setter and initializer
   */
  async _setWorkspace(model) {
    this.currentWorkspace = model;
    workspaceSettings.setWorkspaceSettings(model.settings);
    workspaceState.init(model.id);

    // Sync roots with native layer
    await workspaceFolders.syncNativeRoots(model.folders);

    // Save to storage
    workspaceStorage.addRecentWorkspace(model);
    workspaceStorage.setLastWorkspace(model.toJSON());

    // Discover git repositories across workspace folders
    for (const folder of model.folders) {
      await gitManager.discoverWorkspaceRepositories(folder.path).catch(console.error);
    }

    workspaceEvents.emit(WorkspaceEventType.WORKSPACE_OPENED, this.currentWorkspace);
    return this.currentWorkspace;
  }

  /**
   * Adds a folder to active workspace (promotes to multi-root if needed)
   */
  async addWorkspaceFolder(folderPath) {
    if (!this.currentWorkspace || !folderPath) return;
    const cleanPath = folderPath.replace(/\\/g, '/');

    const projectInfo = await workspaceDiscovery.detectProject(cleanPath);
    const folderName = cleanPath.split('/').filter(Boolean).pop() || 'Folder';

    this.currentWorkspace.addFolder({
      id: `folder-${cleanPath}`,
      name: folderName,
      path: cleanPath,
      projectInfo,
    });

    await workspaceFolders.syncNativeRoots(this.currentWorkspace.folders);
    await gitManager.discoverWorkspaceRepositories(cleanPath).catch(console.error);

    workspaceStorage.addRecentWorkspace(this.currentWorkspace);
    workspaceEvents.emit(WorkspaceEventType.FOLDERS_CHANGED, this.currentWorkspace.folders);
  }

  /**
   * Removes a folder from active workspace
   */
  async removeWorkspaceFolder(folderPath) {
    if (!this.currentWorkspace || !folderPath) return;
    const cleanPath = folderPath.replace(/\\/g, '/');

    this.currentWorkspace.removeFolder(cleanPath);
    await workspaceFolders.syncNativeRoots(this.currentWorkspace.folders);

    workspaceEvents.emit(WorkspaceEventType.FOLDERS_CHANGED, this.currentWorkspace.folders);
  }

  /**
   * Renames the workspace
   */
  renameWorkspace(newName) {
    if (!this.currentWorkspace || !newName || !newName.trim()) return;
    this.currentWorkspace.name = newName.trim();
    workspaceStorage.addRecentWorkspace(this.currentWorkspace);
    workspaceEvents.emit(WorkspaceEventType.WORKSPACE_SAVED, this.currentWorkspace);
  }

  /**
   * Closes active workspace
   */
  async closeWorkspace() {
    if (this.currentWorkspace) {
      workspaceStorage.setLastWorkspace(null);
      this.currentWorkspace = null;
      if (workspaceService.isSupported()) {
        await workspaceService.unwatch().catch(console.error);
        await workspaceService.setActiveRoots([]).catch(console.error);
      }
      workspaceEvents.emit(WorkspaceEventType.WORKSPACE_CLOSED, null);
    }
  }

  /**
   * Reloads active workspace
   */
  async reloadWorkspace() {
    if (!this.currentWorkspace) return;
    if (this.currentWorkspace.filePath) {
      await this.openWorkspace(this.currentWorkspace.filePath);
    } else if (this.currentWorkspace.root) {
      await this.openFolder(this.currentWorkspace.root);
    }
    workspaceEvents.emit(WorkspaceEventType.WORKSPACE_RELOADED, this.currentWorkspace);
  }

  /**
   * Gets project context for a folder
   */
  getProjectContext(folderPath) {
    if (!this.currentWorkspace || !folderPath) return null;
    const clean = folderPath.replace(/\\/g, '/');
    const folder = this.currentWorkspace.folders.find((f) => f.path === clean);
    return folder?.projectInfo || null;
  }

  /**
   * Authoritative project context resolution for a file path
   * Determines which workspace folder and project contains the file.
   */
  getFileProjectContext(filePath) {
    if (!this.currentWorkspace || !filePath) return null;
    const clean = filePath.replace(/\\/g, '/');
    const folder = this.currentWorkspace.getFolderByPath(clean);

    if (!folder) return null;

    // Get active git repository for this folder
    const allRepos = gitManager.getAllRepositories();
    const gitRepo = allRepos.find((r) => clean.startsWith(r.root)) || null;

    return {
      workspace: this.currentWorkspace,
      folder,
      projectInfo: folder.projectInfo,
      gitRepo,
    };
  }

  /**
   * Marks a file as written by CodeX internally to avoid watcher loops
   */
  recordInternalWrite(filePath) {
    if (!filePath) return;
    const clean = filePath.replace(/\\/g, '/');
    this.internalWrites.set(clean, Date.now());
  }

  isInternalWrite(filePath) {
    if (!filePath) return false;
    const clean = filePath.replace(/\\/g, '/');
    const time = this.internalWrites.get(clean);
    if (!time) return false;
    if (Date.now() - time < 2000) {
      return true;
    }
    this.internalWrites.delete(clean);
    return false;
  }

  /**
   * Handles native filesystem changes from watcher
   */
  handleFilesystemChange(event) {
    if (!event || !event.paths) return;

    // Filter out internal writes
    const externalPaths = event.paths.filter((p) => !this.isInternalWrite(p));
    if (externalPaths.length === 0) return;

    // Debounce refresh
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;

      // Trigger Git debounced refresh
      gitManager.scheduleRefresh(300);

      // Emit file changed event
      workspaceEvents.emit(WorkspaceEventType.FILE_CHANGED, {
        kind: event.kind,
        paths: externalPaths,
      });
    }, 300);
  }

  /**
   * Resolves an external change conflict (COMPARE, RELOAD, KEEP)
   */
  resolveExternalChange(filePath, action) {
    workspaceState.clearExternalDirty(filePath);
    workspaceEvents.emit('external-change-resolved', { filePath, action });
  }

  // Recent Workspaces delegations
  getRecentWorkspaces() {
    return workspaceStorage.getRecentWorkspaces();
  }

  removeRecentWorkspace(rootPath) {
    workspaceStorage.removeRecentWorkspace(rootPath);
    workspaceEvents.emit(WorkspaceEventType.RECENT_WORKSPACES_CHANGED);
  }

  clearRecentWorkspaces() {
    workspaceStorage.clearRecentWorkspaces();
    workspaceEvents.emit(WorkspaceEventType.RECENT_WORKSPACES_CHANGED);
  }
}

export const workspaceManager = new WorkspaceManager();
