import React from 'react';
import {
  ChevronRight,
  ChevronDown,
  FolderGit2,
  Folder,
  Plus,
  FolderPlus,
  Trash2,
} from 'lucide-react';

export default function WorkspaceFolder({
  folder,
  isExpanded,
  isMultiRoot,
  onToggle,
  onNewFile,
  onNewFolder,
  onRemoveFolder,
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '5px 8px',
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        cursor: 'pointer',
        userSelect: 'none',
        fontSize: '11px',
        fontWeight: 600,
        color: '#cccccc',
      }}
      onClick={onToggle}
      title={folder.path}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', overflow: 'hidden' }}>
        {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        {folder.projectInfo?.ecosystem && folder.projectInfo.ecosystem !== 'generic' ? (
          <FolderGit2 size={13} color="#60a5fa" />
        ) : (
          <Folder size={13} color="#dcb67a" />
        )}
        <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', textTransform: 'uppercase' }}>
          {folder.name}
        </span>
        {folder.projectInfo?.ecosystem && folder.projectInfo.ecosystem !== 'generic' && (
          <span
            style={{
              fontSize: '9.5px',
              backgroundColor: 'rgba(96, 165, 250, 0.15)',
              color: '#93c5fd',
              padding: '1px 4px',
              borderRadius: '2px',
              textTransform: 'lowercase',
            }}
          >
            {folder.projectInfo.ecosystem}
          </span>
        )}
      </div>

      <div
        className="sidebar-actions"
        style={{ display: 'flex', alignItems: 'center', gap: '3px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="sidebar-action-btn"
          title="New File in Folder"
          onClick={() => onNewFile && onNewFile(folder)}
        >
          <Plus size={12} />
        </button>
        <button
          className="sidebar-action-btn"
          title="New Folder in Folder"
          onClick={() => onNewFolder && onNewFolder(folder)}
        >
          <FolderPlus size={12} />
        </button>
        {isMultiRoot && onRemoveFolder && (
          <button
            className="sidebar-action-btn"
            title="Remove Folder from Workspace"
            onClick={() => onRemoveFolder(folder)}
          >
            <Trash2 size={12} color="#f87171" />
          </button>
        )}
      </div>
    </div>
  );
}
