/**
 * Native Workspace Service
 * Manages desktop workspace and filesystem operations through local Tauri commands.
 * Validates path containment and prevents unauthorized operations.
 */

import { isDesktopApp } from './platform.js';

export const workspaceService = {
  isSupported() {
    return isDesktopApp();
  },

  async openFolder() {
    if (!isDesktopApp()) return null;
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('ws_open_folder');
  },

  async openWorkspaceFile() {
    if (!isDesktopApp()) return null;
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('ws_open_workspace_file');
  },

  async saveWorkspaceDialog(defaultName = 'project.codex-workspace') {
    if (!isDesktopApp()) return null;
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('ws_save_workspace_dialog', { defaultName });
  },

  async setActiveRoots(roots) {
    if (!isDesktopApp()) return;
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('ws_set_active_roots', { roots });
  },

  async addRoot(root) {
    if (!isDesktopApp()) return;
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('ws_add_root', { root });
  },

  async removeRoot(root) {
    if (!isDesktopApp()) return;
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('ws_remove_root', { root });
  },

  async getRoots() {
    if (!isDesktopApp()) return [];
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('ws_get_roots');
  },

  async listDirectory(path, shallow = false, maxDepth = 6) {
    if (!isDesktopApp() || !path) return [];
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('ws_list_directory', { path, shallow, maxDepth });
  },

  async getFileMetadata(path) {
    if (!isDesktopApp() || !path) return null;
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('ws_get_file_metadata', { path });
  },

  async createFile(path) {
    if (!isDesktopApp()) throw new Error('Local filesystem operations are only available on desktop');
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('ws_create_file', { path });
  },

  async createFolder(path) {
    if (!isDesktopApp()) throw new Error('Local filesystem operations are only available on desktop');
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('ws_create_folder', { path });
  },

  async rename(oldPath, newPath) {
    if (!isDesktopApp()) throw new Error('Local filesystem operations are only available on desktop');
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('ws_rename', { oldPath, newPath });
  },

  async move(sourcePath, targetDir) {
    if (!isDesktopApp()) throw new Error('Local filesystem operations are only available on desktop');
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('ws_move', { sourcePath, targetDir });
  },

  async delete(path) {
    if (!isDesktopApp()) throw new Error('Local filesystem operations are only available on desktop');
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('ws_delete', { path });
  },

  async readFile(path) {
    if (!isDesktopApp()) throw new Error('Local filesystem operations are only available on desktop');
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('ws_read_file', { path });
  },

  async writeFile(path, content) {
    if (!isDesktopApp()) throw new Error('Local filesystem operations are only available on desktop');
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('ws_write_file', { path, content });
  },

  async revealInFileManager(path) {
    if (!isDesktopApp()) return;
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('ws_reveal', { path });
  },

  async detectProject(path) {
    if (!isDesktopApp() || !path) return null;
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('ws_detect_project', { path });
  },

  async watchRoots(roots) {
    if (!isDesktopApp()) return;
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('ws_watch', { roots });
  },

  async unwatch() {
    if (!isDesktopApp()) return;
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('ws_unwatch');
  },
};
