/**
 * Native Filesystem Service
 * Bridges React UI to local filesystem via Tauri IPC on desktop,
 * while maintaining fallback to File System Access API on web.
 */

import { isDesktopApp } from './platform';
import { localFileSystem } from '../localFileSystem';

export const filesystemService = {
  isSupported() {
    return isDesktopApp() || localFileSystem.isSupported();
  },

  async pickFolder() {
    if (isDesktopApp()) {
      const { invoke } = await import('@tauri-apps/api/core');
      const folderPath = await invoke('fs_pick_folder');
      if (!folderPath) return null;

      const entries = await invoke('fs_list_directory', { path: folderPath, maxDepth: 6 });
      return {
        path: folderPath,
        name: folderPath.replace(/\\/g, '/').split('/').pop() || 'Project',
        entries,
      };
    }

    // Web Fallback: File System Access API
    const result = await localFileSystem.openDirectory();
    return {
      path: null,
      name: result.folderName,
      entries: result.tree,
      handle: result.dirHandle,
      fileHandles: result.fileHandles,
      dirHandles: result.dirHandles,
    };
  },

  async pickFile() {
    if (isDesktopApp()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke('fs_pick_file');
    }
    return null;
  },

  async saveFileDialog(defaultName) {
    if (isDesktopApp()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke('fs_save_file_dialog', { defaultName });
    }
    return null;
  },

  async listDirectory(path, maxDepth = 6) {
    if (isDesktopApp()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke('fs_list_directory', { path, maxDepth });
    }
    return [];
  },

  async readFile(path) {
    if (isDesktopApp()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke('fs_read_file', { path });
    }
    throw new Error('Direct path reading is only available on desktop');
  },

  async writeFile(path, content) {
    if (isDesktopApp()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke('fs_write_file', { path, content });
    }
    throw new Error('Direct path writing is only available on desktop');
  },

  async createFile(path) {
    if (isDesktopApp()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke('fs_create_file', { path });
    }
    throw new Error('Direct file creation is only available on desktop');
  },

  async createFolder(path) {
    if (isDesktopApp()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke('fs_create_folder', { path });
    }
    throw new Error('Direct folder creation is only available on desktop');
  },

  async rename(oldPath, newPath) {
    if (isDesktopApp()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke('fs_rename', { oldPath, newPath });
    }
    throw new Error('Direct rename is only available on desktop');
  },

  async delete(path) {
    if (isDesktopApp()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke('fs_delete', { path });
    }
    throw new Error('Direct deletion is only available on desktop');
  },

  async exists(path) {
    if (isDesktopApp()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke('fs_exists', { path });
    }
    return false;
  },

  async watchDirectory(path, onChange) {
    if (!isDesktopApp()) return () => {};

    const { invoke } = await import('@tauri-apps/api/core');
    const { listen } = await import('@tauri-apps/api/event');

    await invoke('fs_watch', { path });
    const unlisten = await listen('fs-change', (event) => {
      if (onChange) {
        onChange(event.payload);
      }
    });

    return async () => {
      unlisten();
      try {
        await invoke('fs_unwatch');
      } catch {}
    };
  },
};
