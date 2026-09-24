/**
 * High-performance Browser Native File System Access Service.
 * Direct OS kernel disk I/O with 0 external processes or dependencies.
 */

const IGNORED_NAMES = new Set([
  '.git',
  'node_modules',
  '.vscode',
  '.idea',
  'dist',
  'build',
  'target',
  '.DS_Store',
  'Thumbs.db',
  '.next',
  '.nuxt',
]);

const MAX_FILE_SIZE_BYTES = 500 * 1024; // 500 KB limit per file for instant collaborative sync

export const localFileSystem = {
  isSupported() {
    return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
  },

  /**
   * Prompts user to pick a folder on their PC and recursively scans it.
   */
  async openDirectory() {
    if (!this.isSupported()) {
      throw new Error('File System Access API is not supported in this browser. Please use Chrome, Edge, or Opera.');
    }

    const dirHandle = await window.showDirectoryPicker({
      mode: 'readwrite',
    });

    const fileHandles = new Map();
    const dirHandles = new Map();
    const rootFolderId = 'folder-root';
    dirHandles.set(rootFolderId, dirHandle);

    const tree = [];
    // Add root entry
    tree.push({
      id: rootFolderId,
      name: dirHandle.name,
      type: 'folder',
      parentId: null,
    });

    await this._readDirectory(dirHandle, rootFolderId, tree, fileHandles, dirHandles, '');

    return {
      folderName: dirHandle.name,
      dirHandle,
      tree,
      fileHandles,
      dirHandles,
    };
  },

  async _readDirectory(dirHandle, parentId, tree, fileHandles, dirHandles, currentPath) {
    for await (const [name, handle] of dirHandle.entries()) {
      if (IGNORED_NAMES.has(name) || name.startsWith('.')) {
        continue;
      }

      const entryPath = currentPath ? `${currentPath}/${name}` : name;

      if (handle.kind === 'directory') {
        const folderId = `folder-${name}-${Math.random().toString(36).slice(2, 7)}`;
        dirHandles.set(folderId, handle);

        tree.push({
          id: folderId,
          name: name,
          type: 'folder',
          parentId: parentId,
        });

        await this._readDirectory(handle, folderId, tree, fileHandles, dirHandles, entryPath);
      } else if (handle.kind === 'file') {
        const file = await handle.getFile();
        if (file.size > MAX_FILE_SIZE_BYTES) {
          // Skip huge binary or vendor files
          continue;
        }

        let content = '';
        try {
          content = await file.text();
        } catch {
          content = ''; // Binary or unreadable file
        }

        const fileId = `file-${name}-${Math.random().toString(36).slice(2, 7)}`;
        fileHandles.set(fileId, {
          handle,
          name,
          parentDirHandle: dirHandle,
        });

        tree.push({
          id: fileId,
          name: name,
          type: 'file',
          parentId: parentId,
          content: content,
        });
      }
    }
  },

  /**
   * Writes content directly to the physical disk file on the user's PC.
   */
  async writeFileToDisk(fileHandle, content) {
    if (!fileHandle) return false;
    try {
      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();
      return true;
    } catch (err) {
      console.warn('Failed to write file to disk:', err);
      return false;
    }
  },

  /**
   * Creates a new physical file on the user's PC disk.
   */
  async createFileOnDisk(parentDirHandle, fileName, initialContent = '') {
    if (!parentDirHandle) return null;
    try {
      const fileHandle = await parentDirHandle.getFileHandle(fileName, { create: true });
      if (initialContent) {
        const writable = await fileHandle.createWritable();
        await writable.write(initialContent);
        await writable.close();
      }
      return fileHandle;
    } catch (err) {
      console.warn('Failed to create file on disk:', err);
      return null;
    }
  },

  /**
   * Creates a new physical subfolder on the user's PC disk.
   */
  async createFolderOnDisk(parentDirHandle, folderName) {
    if (!parentDirHandle) return null;
    try {
      return await parentDirHandle.getDirectoryHandle(folderName, { create: true });
    } catch (err) {
      console.warn('Failed to create folder on disk:', err);
      return null;
    }
  },

  /**
   * Removes a file or folder from the user's PC disk.
   */
  async deleteEntryFromDisk(parentDirHandle, entryName) {
    if (!parentDirHandle) return false;
    try {
      await parentDirHandle.removeEntry(entryName, { recursive: true });
      return true;
    } catch (err) {
      console.warn('Failed to delete entry from disk:', err);
      return false;
    }
  },
};
