import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import FileIcon from '../vscode/FileIcon';

export default function ExplorerItem({
  item,
  depth = 0,
  isActive = false,
  isExpanded = false,
  gitBadge = null,
  gitColor = null,
  onSelect,
  onDoubleClick,
  onToggleExpand,
  onContextMenu,
  isRenaming = false,
  onConfirmRename,
  onCancelRename,
}) {
  const isFolder = item.type === 'folder' || item.is_dir;
  const [renameValue, setRenameValue] = useState(item.name);
  const renameInputRef = useRef(null);

  useEffect(() => {
    if (isRenaming) {
      setRenameValue(item.name);
      setTimeout(() => {
        if (renameInputRef.current) {
          renameInputRef.current.focus();
          const dotIdx = item.name.lastIndexOf('.');
          if (dotIdx > 0 && !isFolder) {
            renameInputRef.current.setSelectionRange(0, dotIdx);
          } else {
            renameInputRef.current.select();
          }
        }
      }, 50);
    }
  }, [isRenaming, item.name, isFolder]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (renameValue.trim() && renameValue !== item.name) {
        onConfirmRename(item, renameValue.trim());
      } else {
        onCancelRename();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancelRename();
    }
  };

  const handleBlur = () => {
    if (renameValue.trim() && renameValue !== item.name) {
      onConfirmRename(item, renameValue.trim());
    } else {
      onCancelRename();
    }
  };

  return (
    <div
      className={`tree-node ${isActive ? 'active' : ''}`}
      style={{
        paddingLeft: `${depth * 14 + 10}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        cursor: 'pointer',
        userSelect: 'none',
        height: '22px',
        fontSize: '12px',
        color: isActive ? '#ffffff' : '#cccccc',
      }}
      onClick={() => {
        if (isFolder) {
          onToggleExpand(item);
        } else {
          onSelect(item);
        }
      }}
      onDoubleClick={() => {
        if (!isFolder && onDoubleClick) {
          onDoubleClick(item);
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu(e, item);
      }}
      title={item.path}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', overflow: 'hidden', flex: 1 }}>
        {/* Chevron for folder */}
        {isFolder ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', width: '13px' }}>
            {isExpanded ? <ChevronDown size={13} color="#858585" /> : <ChevronRight size={13} color="#858585" />}
          </span>
        ) : (
          <span style={{ width: '13px' }} />
        )}

        {/* Icon */}
        <FileIcon
          name={item.name}
          isFolder={isFolder}
          isOpen={isExpanded}
          size={14}
        />

        {/* Name / Rename Input */}
        {isRenaming ? (
          <input
            ref={renameInputRef}
            type="text"
            className="inline-create-input"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            onClick={(e) => e.stopPropagation()}
            style={{ height: '18px', fontSize: '11.5px', padding: '1px 4px' }}
          />
        ) : (
          <span
            style={{
              textOverflow: 'ellipsis',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              color: gitBadge ? gitColor || '#cccccc' : undefined,
            }}
          >
            {item.name}
          </span>
        )}
      </div>

      {/* Git Status Badge */}
      {gitBadge && (
        <span
          style={{
            fontSize: '10px',
            fontWeight: 700,
            color: gitColor || '#858585',
            paddingRight: '8px',
          }}
        >
          {gitBadge}
        </span>
      )}
    </div>
  );
}
