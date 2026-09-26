/**
 * Workspace Folders Manager
 */

import { workspaceDiscovery } from './workspaceDiscovery.js';
import { workspaceService } from '../services/native/workspace.js';

export const workspaceFolders = {
  /**
   * Initializes or updates project info for folders
   */
  async resolveFolderProjects(folders) {
    if (!folders || !Array.isArray(folders)) return [];

    const resolved = [];
    for (const folder of folders) {
      const projectInfo = await workspaceDiscovery.detectProject(folder.path);
      resolved.push({
        ...folder,
        projectInfo,
      });
    }
    return resolved;
  },

  /**
   * Checks if a file path is contained within any of the workspace folders
   */
  isContainedInWorkspace(filePath, folders) {
    if (!filePath || !folders || folders.length === 0) return false;
    const clean = filePath.replace(/\\/g, '/');
    return folders.some((f) => clean === f.path || clean.startsWith(`${f.path}/`));
  },

  /**
   * Syncs roots with native backend for security containment
   */
  async syncNativeRoots(folders) {
    if (!workspaceService.isSupported()) return;
    const roots = (folders || []).map((f) => f.path);
    await workspaceService.setActiveRoots(roots).catch(console.error);
    await workspaceService.watchRoots(roots).catch(console.error);
  },
};
