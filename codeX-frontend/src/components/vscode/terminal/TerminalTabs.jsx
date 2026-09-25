import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  ChevronDown,
  X,
  RotateCw,
  Columns2,
  Trash2,
  Terminal as TerminalIcon,
  Check,
} from 'lucide-react';

export default function TerminalTabs({
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onCloseSession,
  onRestartSession,
  onRenameSession,
  onSplitSession,
  onClearSession,
  availableShells,
}) {
  const [showShellDropdown, setShowShellDropdown] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowShellDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleStartRename = (e, session) => {
    e.stopPropagation();
    setEditingSessionId(session.id);
    setEditTitle(session.title);
  };

  const handleFinishRename = (id) => {
    if (editTitle.trim()) {
      onRenameSession(id, editTitle.trim());
    }
    setEditingSessionId(null);
  };

  return (
    <div className="terminal-sub-header">
      {/* Session Tabs */}
      <div className="terminal-tabs-list">
        {sessions.map((session) => {
          const isActive = session.id === activeSessionId;
          const isEditing = editingSessionId === session.id;

          return (
            <div
              key={session.id}
              className={`terminal-tab-item ${isActive ? 'active' : ''}`}
              onClick={() => onSelectSession(session.id)}
              onDoubleClick={(e) => handleStartRename(e, session)}
              title={`${session.title} (${session.shell}) • Double click to rename`}
            >
              <TerminalIcon size={12} className="terminal-tab-icon" />

              {isEditing ? (
                <input
                  type="text"
                  className="terminal-rename-input"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={() => handleFinishRename(session.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleFinishRename(session.id);
                    if (e.key === 'Escape') setEditingSessionId(null);
                  }}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="terminal-tab-title">{session.title}</span>
              )}

              {/* Close Tab Button */}
              {sessions.length > 1 && (
                <button
                  type="button"
                  className="terminal-tab-close-btn"
                  title="Close Terminal"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseSession(session.id);
                  }}
                >
                  <X size={11} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Terminal Controls Bar */}
      <div className="terminal-actions-bar">
        {/* New Terminal Button + Shell Dropdown */}
        <div className="terminal-new-group" ref={dropdownRef}>
          <button
            type="button"
            className="terminal-action-icon-btn"
            title="New Terminal"
            onClick={() => onCreateSession()}
          >
            <Plus size={13} />
          </button>

          {availableShells && availableShells.length > 0 && (
            <button
              type="button"
              className="terminal-action-icon-btn dropdown-caret"
              title="Select Shell Profile"
              onClick={() => setShowShellDropdown(!showShellDropdown)}
            >
              <ChevronDown size={11} />
            </button>
          )}

          {showShellDropdown && (
            <div className="terminal-shell-menu">
              <div className="terminal-shell-menu-header">Select Default Shell</div>
              {availableShells.map((sh) => (
                <div
                  key={sh.id || sh.name}
                  className="terminal-shell-menu-item"
                  onClick={() => {
                    onCreateSession(sh.path, sh.name);
                    setShowShellDropdown(false);
                  }}
                >
                  <div className="shell-menu-name">
                    <span>{sh.name}</span>
                    {sh.is_default && <span className="default-pill">Default</span>}
                  </div>
                  <div className="shell-menu-path">{sh.path}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Split Terminal */}
        <button
          type="button"
          className="terminal-action-icon-btn"
          title="Split Terminal Side-by-Side"
          onClick={() => onSplitSession && onSplitSession(activeSessionId)}
        >
          <Columns2 size={13} />
        </button>

        {/* Restart Terminal */}
        <button
          type="button"
          className="terminal-action-icon-btn"
          title="Restart Active Terminal"
          onClick={() => onRestartSession(activeSessionId)}
        >
          <RotateCw size={12} />
        </button>

        {/* Clear Buffer */}
        <button
          type="button"
          className="terminal-action-icon-btn"
          title="Clear Buffer"
          onClick={() => onClearSession && onClearSession(activeSessionId)}
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}
