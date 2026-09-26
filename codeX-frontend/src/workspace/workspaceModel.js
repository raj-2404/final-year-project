/**
 * Workspace Model
 * Encapsulates single-folder and multi-root workspace representation.
 */

export class WorkspaceModel {
  constructor(options = {}) {
    this.id = options.id || `ws-${Date.now()}`;
    this.name = options.name || 'Workspace';
    this.root = options.root ? options.root.replace(/\\/g, '/') : '';
    this.filePath = options.filePath ? options.filePath.replace(/\\/g, '/') : null;
    this.folders = [];
    this.activeFolder = null;
    this.settings = options.settings || {};
    this.openedFiles = options.openedFiles || [];
    this.activeFile = options.activeFile || null;
    this.recentFiles = options.recentFiles || [];
    this.isMultiRoot = Boolean(options.isMultiRoot);

    if (options.folders && Array.isArray(options.folders)) {
      for (const f of options.folders) {
        this.addFolder(f);
      }
    } else if (this.root) {
      this.addFolder({ path: this.root, name: this.name });
    }
  }

  addFolder(folder) {
    if (!folder || !folder.path) return;
    const cleanPath = folder.path.replace(/\\/g, '/');
    if (this.folders.some((f) => f.path === cleanPath)) return;

    const name = folder.name || cleanPath.split('/').filter(Boolean).pop() || 'Folder';
    const folderObj = {
      id: folder.id || `folder-${cleanPath}`,
      name,
      path: cleanPath,
      projectInfo: folder.projectInfo || null,
    };

    this.folders.push(folderObj);
    if (!this.activeFolder) {
      this.activeFolder = cleanPath;
    }
    if (this.folders.length > 1) {
      this.isMultiRoot = true;
    }
  }

  removeFolder(folderPath) {
    const cleanPath = folderPath.replace(/\\/g, '/');
    this.folders = this.folders.filter((f) => f.path !== cleanPath);
    if (this.activeFolder === cleanPath) {
      this.activeFolder = this.folders[0]?.path || null;
    }
    this.isMultiRoot = this.folders.length > 1;
  }

  getFolderByPath(filePath) {
    if (!filePath || this.folders.length === 0) return null;
    const clean = filePath.replace(/\\/g, '/');
    // Find longest matching folder path (most specific in nested cases)
    let bestMatch = null;
    for (const folder of this.folders) {
      if (clean === folder.path || clean.startsWith(`${folder.path}/`)) {
        if (!bestMatch || folder.path.length > bestMatch.path.length) {
          bestMatch = folder;
        }
      }
    }
    return bestMatch || this.folders[0] || null;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      root: this.root,
      filePath: this.filePath,
      folders: this.folders.map((f) => ({
        path: f.path,
        name: f.name,
      })),
      settings: this.settings,
    };
  }

  /**
   * Export as standard VS Code / CodeX .code-workspace JSON string
   */
  toWorkspaceFileContent() {
    return JSON.stringify(
      {
        folders: this.folders.map((f) => ({
          path: f.path,
          name: f.name,
        })),
        settings: this.settings,
      },
      null,
      2
    );
  }

  /**
   * Parse a .codex-workspace or .code-workspace JSON string
   */
  static fromWorkspaceFileContent(content, filePath = null) {
    const data = JSON.parse(content);
    const folders = (data.folders || []).map((f) => ({
      path: f.path,
      name: f.name,
    }));
    const name = filePath
      ? filePath.split('/').filter(Boolean).pop().replace(/\.(codex|code)-workspace$/, '')
      : folders[0]?.name || 'Workspace';

    return new WorkspaceModel({
      name,
      filePath,
      root: folders[0]?.path || '',
      folders,
      settings: data.settings || {},
      isMultiRoot: folders.length > 1,
    });
  }
}
