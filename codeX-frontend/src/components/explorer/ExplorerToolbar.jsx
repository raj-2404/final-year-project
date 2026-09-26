import React from 'react';
import {
  FilePlus,
  FolderPlus,
  RotateCw,
  FolderTree,
  PlusSquare,
} from 'lucide-react';

export default function ExplorerToolbar({
  onNewFile,
  onNewFolder,
  onRefresh,
  onCollapseAll,
  onAddFolder,
}) {
  return (
    <div className="sidebar-actions" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <button
        className="sidebar-action-btn"
        title="New File"
        onClick={onNewFile}
      >
        <FilePlus size={13} />
      </button>

      <button
        className="sidebar-action-btn"
        title="New Folder"
        onClick={onNewFolder}
      >
        <FolderPlus size={13} />
      </button>

      <button
        className="sidebar-action-btn"
        title="Refresh Explorer"
        onClick={onRefresh}
      >
        <RotateCw size={13} />
      </button>

      <button
        className="sidebar-action-btn"
        title="Collapse All Folders"
        onClick={onCollapseAll}
      >
        <FolderTree size={13} />
      </button>

      {onAddFolder && (
        <button
          className="sidebar-action-btn"
          title="Add Folder to Workspace..."
          onClick={onAddFolder}
        >
          <PlusSquare size={13} color="#60a5fa" />
        </button>
      )}
    </div>
  );
}
