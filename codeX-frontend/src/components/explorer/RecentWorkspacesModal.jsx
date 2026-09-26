import React, { useState, useEffect } from 'react';
import {
  FolderGit2,
  Folder,
  Clock,
  Trash2,
  X,
  Search,
} from 'lucide-react';
import { workspaceManager } from '../../workspace/workspaceManager';

export default function RecentWorkspacesModal({
  isOpen,
  onClose,
  onOpenWorkspace,
  showToast,
}) {
  const [recents, setRecents] = useState([]);
  const [search, setSearch] = useState('');

  const loadRecents = () => {
    setRecents(workspaceManager.getRecentWorkspaces());
  };

  useEffect(() => {
    if (isOpen) {
      loadRecents();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filtered = recents.filter(
    (w) =>
      w.name.toLowerCase().includes(search.toLowerCase()) ||
      w.root.toLowerCase().includes(search.toLowerCase())
  );

  const handleRemove = (e, rootPath) => {
    e.stopPropagation();
    workspaceManager.removeRecentWorkspace(rootPath);
    loadRecents();
    showToast('Removed from recent workspaces');
  };

  const handleClearAll = () => {
    const confirmed = window.confirm('Clear all recent workspaces?');
    if (!confirmed) return;
    workspaceManager.clearRecentWorkspaces();
    loadRecents();
    showToast('Cleared recent workspaces');
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '600px',
          maxHeight: '70vh',
          backgroundColor: '#1e1e1e',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '6px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            backgroundColor: '#252526',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FolderGit2 size={16} color="#60a5fa" />
            <span style={{ fontWeight: 600, fontSize: '13px', color: '#ffffff' }}>
              Recent Workspaces & Folders
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {recents.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: '#f87171',
                  cursor: 'pointer',
                  fontSize: '11px',
                }}
              >
                Clear All
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: '#858585',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div
          style={{
            padding: '8px 16px',
            backgroundColor: '#202020',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Search size={14} color="#858585" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search recent workspaces..."
            style={{
              flex: 1,
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#ffffff',
              fontSize: '12px',
            }}
            autoFocus
          />
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#858585', fontSize: '12px' }}>
              No recent workspaces found.
            </div>
          ) : (
            filtered.map((w) => (
              <div
                key={w.root}
                onClick={() => {
                  onClose();
                  onOpenWorkspace(w.root);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 16px',
                  cursor: 'pointer',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
                  transition: 'background 0.1s ease',
                }}
                className="tree-node"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                  {w.isMultiRoot ? <FolderGit2 size={16} color="#60a5fa" /> : <Folder size={16} color="#dcb67a" />}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 500, color: '#ffffff' }}>
                      {w.name}
                    </span>
                    <span style={{ fontSize: '11px', color: '#858585', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {w.root}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10.5px', color: '#666666' }}>
                    <Clock size={11} /> {new Date(w.lastOpened).toLocaleDateString()}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => handleRemove(e, w.root)}
                    title="Remove from recents"
                    style={{
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: '#858585',
                      cursor: 'pointer',
                      padding: '4px',
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
