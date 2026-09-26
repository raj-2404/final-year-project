/**
 * Workspace Filesystem Operations
 * Strictly verifies local execution and routes through workspaceService.
 */

import { workspaceService } from '../services/native/workspace.js';
import { isDesktopApp } from '../services/native/platform.js';

export const workspaceFiles = {
  assertLocalExecution() {
    if (!isDesktopApp()) {
      throw new Error('Security check: Workspace filesystem operations are only permitted on the local desktop.');
    }
  },

  async createFile(filePath) {
    this.assertLocalExecution();
    return await workspaceService.createFile(filePath);
  },

  async createFolder(folderPath) {
    this.assertLocalExecution();
    return await workspaceService.createFolder(folderPath);
  },

  async rename(oldPath, newPath) {
    this.assertLocalExecution();
    return await workspaceService.rename(oldPath, newPath);
  },

  async move(sourcePath, targetDir) {
    this.assertLocalExecution();
    return await workspaceService.move(sourcePath, targetDir);
  },

  async delete(path) {
    this.assertLocalExecution();
    return await workspaceService.delete(path);
  },

  async readFile(filePath) {
    this.assertLocalExecution();
    return await workspaceService.readFile(filePath);
  },

  async writeFile(filePath, content) {
    this.assertLocalExecution();
    return await workspaceService.writeFile(filePath, content);
  },

  async listDirectory(path, shallow = false, maxDepth = 6) {
    if (!isDesktopApp() || !path) return [];
    return await workspaceService.listDirectory(path, shallow, maxDepth);
  },

  async getFileMetadata(filePath) {
    if (!isDesktopApp() || !filePath) return null;
    return await workspaceService.getFileMetadata(filePath);
  },

  async revealInFileManager(filePath) {
    if (!isDesktopApp() || !filePath) return;
    return await workspaceService.revealInFileManager(filePath);
  },

  copyPath(filePath) {
    if (!filePath) return;
    navigator.clipboard?.writeText(filePath).catch(console.error);
  },

  copyRelativePath(filePath, rootPath) {
    if (!filePath) return;
    let rel = filePath.replace(/\\/g, '/');
    if (rootPath) {
      const cleanRoot = rootPath.replace(/\\/g, '/');
      if (rel.startsWith(cleanRoot)) {
        rel = rel.substring(cleanRoot.length).replace(/^\//, '');
      }
    }
    navigator.clipboard?.writeText(rel).catch(console.error);
  },
};
