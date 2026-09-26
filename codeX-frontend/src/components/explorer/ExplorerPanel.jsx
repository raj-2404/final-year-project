import React, { useState } from 'react';
import { FolderOpen, FilePlus } from 'lucide-react';
import WorkspaceFolder from './WorkspaceFolder';
import ExplorerToolbar from './ExplorerToolbar';
import ExplorerTree from './ExplorerTree';
import ExplorerContextMenu from './ExplorerContextMenu';
import { workspaceManager } from '../../workspace/workspaceManager';
import { workspaceFiles } from '../../workspace/workspaceFiles';
import { workspaceState } from '../../workspace/workspaceState';

export default function ExplorerPanel({
  workspace,
  fileTree,
  activeFile,
  gitStatus,
  onSelectFile,
  onDoubleClickFile,
  onRefresh,
  onOpenFolder,
  onOpenWorkspace,
  onAddFolder,
  showToast,
}) {
  // Folder expansion state
  const [expandedFolders, setExpandedFolders] = useState(() => {
    const set = new Set(workspaceState.expandedFolders || []);
    set.add('folder-root');
    return set;
  });
  const [collapsedRoots, setCollapsedRoots] = useState(new Set());

  // Creation state
  const [creatingType, setCreatingType] = useState(null); // 'file' | 'folder' | null
  const [creatingTargetFolderId, setCreatingTargetFolderId] = useState(null);
  const [creatingTargetFolderPath, setCreatingTargetFolderPath] = useState(null);
  const [newEntryName, setNewEntryName] = useState('');

  // Renaming state
  const [renamingItemId, setRenamingItemId] = useState(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState(null); // { x, y, item, isFolder, isRoot }

  const folders = workspace?.folders || (workspace?.root ? [{ id: 'root', name: workspace.name || 'Workspace', path: workspace.root }] : []);
  const isMultiRoot = folders.length > 1;

  const handleToggleExpand = (item) => {
    const next = new Set(expandedFolders);
    if (next.has(item.id)) {
      next.delete(item.id);
    } else {
      next.add(item.id);
    }
    setExpandedFolders(next);
    workspaceState.setExpandedFolders(next);
  };

  const handleToggleRoot = (folderPath) => {
    const next = new Set(collapsedRoots);
    if (next.has(folderPath)) {
      next.delete(folderPath);
    } else {
      next.add(folderPath);
    }
    setCollapsedRoots(next);
  };

  const handleCollapseAll = () => {
    setExpandedFolders(new Set());
    workspaceState.collapseAllFolders();
  };

  // Creation
  const handleStartCreate = (type, targetFolder = null) => {
    setCreatingType(type);
    setNewEntryName('');
    if (targetFolder) {
      setCreatingTargetFolderId(targetFolder.id || targetFolder.path);
      setCreatingTargetFolderPath(targetFolder.path);
      // Ensure target folder is expanded
      if (!expandedFolders.has(targetFolder.id)) {
        handleToggleExpand(targetFolder);
      }
    } else {
      setCreatingTargetFolderId(null);
      setCreatingTargetFolderPath(folders[0]?.path || workspace?.root || '');
    }
  };

  const handleConfirmCreate = async () => {
    if (!newEntryName.trim()) {
      setCreatingType(null);
      return;
    }

    const parentPath = creatingTargetFolderPath || folders[0]?.path || workspace?.root || '';
    const cleanParent = parentPath.replace(/\\/g, '/').replace(/\/+$/, '');
    const targetPath = `${cleanParent}/${newEntryName.trim()}`;

    try {
      if (creatingType === 'file') {
        workspaceManager.recordInternalWrite(targetPath);
        await workspaceFiles.createFile(targetPath);
        showToast(`Created file: ${newEntryName.trim()}`);
      } else {
        await workspaceFiles.createFolder(targetPath);
        showToast(`Created folder: ${newEntryName.trim()}`);
      }
      if (onRefresh) onRefresh();
    } catch (err) {
      showToast(`Create error: ${err.message || err}`);
    } finally {
      setCreatingType(null);
      setCreatingTargetFolderId(null);
      setCreatingTargetFolderPath(null);
      setNewEntryName('');
    }
  };

  // Rename
  const handleStartRename = (item) => {
    setRenamingItemId(item.id);
  };

  const handleConfirmRename = async (item, newName) => {
    setRenamingItemId(null);
    if (!newName || newName === item.name) return;

    const oldPath = item.path.replace(/\\/g, '/');
    const parentPath = oldPath.substring(0, oldPath.lastIndexOf('/'));
    const newPath = `${parentPath}/${newName}`;

    try {
      workspaceManager.recordInternalWrite(newPath);
      await workspaceFiles.rename(oldPath, newPath);
      showToast(`Renamed to ${newName}`);
      if (onRefresh) onRefresh();
    } catch (err) {
      showToast(`Rename error: ${err.message || err}`);
    }
  };

  // Delete
  const handleDeleteItem = async (item) => {
    const isFolder = item.type === 'folder' || item.is_dir;
    const confirmed = window.confirm(
      `Are you sure you want to delete ${isFolder ? 'folder' : 'file'} "${item.name}"?\n\nThis cannot be undone.`
    );
    if (!confirmed) return;

    try {
      await workspaceFiles.delete(item.path);
      showToast(`Deleted ${item.name}`);
      if (onRefresh) onRefresh();
    } catch (err) {
      showToast(`Delete error: ${err.message || err}`);
    }
  };

  // Context Menu
  const handleContextMenu = (e, item) => {
    const isFolder = item.type === 'folder' || item.is_dir;
    const isRoot = folders.some((f) => f.path === item.path);
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      item,
      isFolder,
      isRoot,
    });
  };

  return (
    <div className="vscode-sidebar" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Explorer Header */}
      <div className="sidebar-header">
        <span className="sidebar-header-title">EXPLORER</span>
        <ExplorerToolbar
          onNewFile={() => handleStartCreate('file')}
          onNewFolder={() => handleStartCreate('folder')}
          onRefresh={onRefresh}
          onCollapseAll={handleCollapseAll}
          onAddFolder={onAddFolder}
        />
      </div>

      {/* Tree Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {folders.length === 0 ? (
          fileTree && fileTree.length > 0 ? (
            /* Virtual / Online Workspace Tree (Web Mode or Live Collaboration) */
            <div className="file-tree-container">
              <ExplorerTree
                items={fileTree}
                parentId={null}
                depth={0}
                activeFileId={activeFile?.id || activeFile?.path}
                expandedFolders={expandedFolders}
                onToggleExpand={handleToggleExpand}
                onSelectFile={onSelectFile}
                onDoubleClickFile={onDoubleClickFile}
                onContextMenu={handleContextMenu}
                creatingType={creatingType}
                creatingTargetFolderId={creatingTargetFolderId}
                newEntryName={newEntryName}
                setNewEntryName={setNewEntryName}
                onConfirmCreate={handleConfirmCreate}
                onCancelCreate={() => setCreatingType(null)}
                renamingItemId={renamingItemId}
                onConfirmRename={handleConfirmRename}
                onCancelRename={() => setRenamingItemId(null)}
                gitStatus={gitStatus}
              />
            </div>
          ) : (
            /* Empty Workspace State */
            <div style={{ padding: '24px 16px', textAlign: 'center', color: '#858585', fontSize: '12px' }}>
              <p style={{ marginBottom: '12px' }}>No folder or workspace open.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {onOpenFolder && (
                  <button
                    type="button"
                    className="empty-create-btn"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={onOpenFolder}
                  >
                    <FolderOpen size={13} /> Open Folder...
                  </button>
                )}
                {onOpenWorkspace && (
                  <button
                    type="button"
                    className="empty-create-btn"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={onOpenWorkspace}
                  >
                    <FolderOpen size={13} /> Open Workspace File...
                  </button>
                )}
              </div>
            </div>
          )
        ) : (
          folders.map((folder) => {
            const isRootCollapsed = collapsedRoots.has(folder.path);
            const cleanFolderPath = (folder.path || '').replace(/\\/g, '/').replace(/\/+$/, '').replace(/^\/private/, '');

            let folderItems = fileTree.filter((item) => {
              if (!item.path) return true;
              const cleanItemPath = item.path.replace(/\\/g, '/').replace(/\/+$/, '').replace(/^\/private/, '');
              return cleanItemPath === cleanFolderPath || cleanItemPath.startsWith(`${cleanFolderPath}/`);
            });

            // Fallback for single-root, virtual, or relative items without exact local path prefix
            const hasChildren = folderItems.some((item) => item.id !== 'folder-root' && item.path !== folder.path);
            if (!hasChildren && fileTree.length > 0) {
              folderItems = fileTree;
            }

            return (
              <div key={folder.path} style={{ borderBottom: isMultiRoot ? '1px solid rgba(255, 255, 255, 0.06)' : 'none' }}>
                {/* Folder Header */}
                <WorkspaceFolder
                  folder={folder}
                  isExpanded={!isRootCollapsed}
                  isMultiRoot={isMultiRoot}
                  onToggle={() => handleToggleRoot(folder.path)}
                  onNewFile={() => handleStartCreate('file', folder)}
                  onNewFolder={() => handleStartCreate('folder', folder)}
                  onRemoveFolder={() => workspaceManager.removeWorkspaceFolder(folder.path)}
                />

                {/* Folder Tree Items */}
                {!isRootCollapsed && (
                  <div className="file-tree-container">
                    <ExplorerTree
                      items={folderItems}
                      parentId={null}
                      depth={0}
                      activeFileId={activeFile?.id || activeFile?.path}
                      expandedFolders={expandedFolders}
                      onToggleExpand={handleToggleExpand}
                      onSelectFile={onSelectFile}
                      onDoubleClickFile={onDoubleClickFile}
                      onContextMenu={handleContextMenu}
                      creatingType={creatingType}
                      creatingTargetFolderId={creatingTargetFolderId}
                      newEntryName={newEntryName}
                      setNewEntryName={setNewEntryName}
                      onConfirmCreate={handleConfirmCreate}
                      onCancelCreate={() => setCreatingType(null)}
                      renamingItemId={renamingItemId}
                      onConfirmRename={handleConfirmRename}
                      onCancelRename={() => setRenamingItemId(null)}
                      gitStatus={gitStatus}
                    />

                    {folderItems.length === 0 && !creatingType && (
                      <div className="tree-empty-prompt" style={{ padding: '12px 16px' }}>
                        <p>Folder is empty.</p>
                        <p>
                          Click <FilePlus size={13} style={{ display: 'inline', verticalAlign: 'middle' }} /> above to create a file.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ExplorerContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          item={contextMenu.item}
          isFolder={contextMenu.isFolder}
          isRoot={contextMenu.isRoot}
          onClose={() => setContextMenu(null)}
          onNewFile={(item) => handleStartCreate('file', item)}
          onNewFolder={(item) => handleStartCreate('folder', item)}
          onRename={handleStartRename}
          onDelete={handleDeleteItem}
          onCopyPath={(item) => workspaceFiles.copyPath(item.path)}
          onCopyRelativePath={(item) => workspaceFiles.copyRelativePath(item.path, workspace?.root)}
          onReveal={(item) => workspaceFiles.revealInFileManager(item.path)}
          onOpenInNewEditor={(item) => onSelectFile && onSelectFile(item)}
          onAddFolder={onAddFolder}
          onRemoveFolder={(item) => workspaceManager.removeWorkspaceFolder(item.path)}
        />
      )}
    </div>
  );
}
