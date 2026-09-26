import React from 'react';
import ExplorerItem from './ExplorerItem';
import FileIcon from '../vscode/FileIcon';

export default function ExplorerTree({
  items,
  parentId = null,
  depth = 0,
  activeFileId,
  expandedFolders,
  onToggleExpand,
  onSelectFile,
  onDoubleClickFile,
  onContextMenu,
  creatingType,
  creatingTargetFolderId,
  newEntryName,
  setNewEntryName,
  onConfirmCreate,
  onCancelCreate,
  renamingItemId,
  onConfirmRename,
  onCancelRename,
  gitStatus,
}) {
  // Filter items matching parentId
  const children = items.filter((item) => {
    if (item.id === 'folder-root') return false; // folder-root is the root container, never a child of itself
    if (parentId === null || parentId === 'folder-root') {
      return item.parentId === null || item.parentId === 'folder-root' || !item.parentId;
    }
    return item.parentId === parentId;
  });

  // Sort: folders first, then alphabetically
  children.sort((a, b) => {
    const aFolder = a.type === 'folder' || a.is_dir;
    const bFolder = b.type === 'folder' || b.is_dir;
    if (aFolder !== bFolder) {
      return aFolder ? -1 : 1;
    }
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  });

  // Helper to determine git badge and color for an item
  const getGitStatusForPath = (filePath) => {
    if (!gitStatus || !filePath) return { badge: null, color: null };
    const norm = filePath.replace(/\\/g, '/');

    // Conflicts
    if (gitStatus.conflicts?.some((c) => norm.endsWith(c.path.replace(/\\/g, '/')))) {
      return { badge: '!', color: '#f97316' };
    }
    // Staged
    if (gitStatus.staged?.some((s) => norm.endsWith(s.path.replace(/\\/g, '/')))) {
      return { badge: 'S', color: '#4ade80' };
    }
    // Modified (unstaged)
    if (gitStatus.unstaged?.some((u) => norm.endsWith(u.path.replace(/\\/g, '/')))) {
      return { badge: 'M', color: '#eab308' };
    }
    // Untracked
    if (gitStatus.untracked?.some((u) => norm.endsWith(u.path.replace(/\\/g, '/')))) {
      return { badge: 'U', color: '#22c55e' };
    }

    return { badge: null, color: null };
  };

  return (
    <>
      {/* Inline Creation Input if creating in this folder */}
      {creatingType && creatingTargetFolderId === parentId && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (newEntryName.trim()) {
              onConfirmCreate();
            } else {
              onCancelCreate();
            }
          }}
          className="inline-create-form"
          style={{ paddingLeft: `${depth * 14 + 18}px` }}
        >
          <FileIcon isFolder={creatingType === 'folder'} isOpen={false} size={13} />
          <input
            type="text"
            className="inline-create-input"
            placeholder={`New ${creatingType} name...`}
            value={newEntryName}
            onChange={(e) => setNewEntryName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (newEntryName.trim()) onConfirmCreate();
                else onCancelCreate();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                onCancelCreate();
              }
            }}
            onBlur={() => {
              if (newEntryName.trim()) onConfirmCreate();
              else onCancelCreate();
            }}
            autoFocus
          />
        </form>
      )}

      {children.map((item) => {
        const isFolder = item.type === 'folder' || item.is_dir;
        const isExpanded = expandedFolders.has(item.id);
        const isActive = activeFileId === item.id || activeFileId === item.path;
        const gitInfo = getGitStatusForPath(item.path);

        return (
          <React.Fragment key={item.id}>
            <ExplorerItem
              item={item}
              depth={depth}
              isActive={isActive}
              isExpanded={isExpanded}
              gitBadge={gitInfo.badge}
              gitColor={gitInfo.color}
              onSelect={onSelectFile}
              onDoubleClick={onDoubleClickFile}
              onToggleExpand={onToggleExpand}
              onContextMenu={onContextMenu}
              isRenaming={renamingItemId === item.id}
              onConfirmRename={onConfirmRename}
              onCancelRename={onCancelRename}
            />

            {isFolder && isExpanded && (
              <ExplorerTree
                items={items}
                parentId={item.id}
                depth={depth + 1}
                activeFileId={activeFileId}
                expandedFolders={expandedFolders}
                onToggleExpand={onToggleExpand}
                onSelectFile={onSelectFile}
                onDoubleClickFile={onDoubleClickFile}
                onContextMenu={onContextMenu}
                creatingType={creatingType}
                creatingTargetFolderId={creatingTargetFolderId}
                newEntryName={newEntryName}
                setNewEntryName={setNewEntryName}
                onConfirmCreate={onConfirmCreate}
                onCancelCreate={onCancelCreate}
                renamingItemId={renamingItemId}
                onConfirmRename={onConfirmRename}
                onCancelRename={onCancelRename}
                gitStatus={gitStatus}
              />
            )}
          </React.Fragment>
        );
      })}
    </>
  );
}
