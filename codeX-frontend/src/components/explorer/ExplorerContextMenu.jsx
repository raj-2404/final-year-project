import React, { useEffect, useRef } from 'react';
import {
  FilePlus,
  FolderPlus,
  Edit2,
  Trash2,
  Copy,
  FolderOpen,
  FolderPlus as AddFolderIcon,
  MinusCircle,
  ExternalLink,
} from 'lucide-react';

export default function ExplorerContextMenu({
  x,
  y,
  item,
  isFolder,
  isRoot,
  onClose,
  onNewFile,
  onNewFolder,
  onRename,
  onDelete,
  onCopyPath,
  onCopyRelativePath,
  onReveal,
  onOpenInNewEditor,
  onAddFolder,
  onRemoveFolder,
}) {
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    }
    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') onClose();
    });
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Adjust menu position if near viewport boundary
  const adjustedX = Math.min(x, window.innerWidth - 220);
  const adjustedY = Math.min(y, window.innerHeight - 320);

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: `${adjustedX}px`,
        top: `${adjustedY}px`,
        backgroundColor: '#252526',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '4px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5)',
        zIndex: 10000,
        width: '210px',
        padding: '4px 0',
        fontSize: '11.5px',
        color: '#cccccc',
      }}
    >
      {/* File/Folder Creation */}
      <div
        className="context-menu-item"
        onClick={() => {
          onClose();
          onNewFile(item);
        }}
      >
        <FilePlus size={13} />
        <span>New File</span>
      </div>

      <div
        className="context-menu-item"
        onClick={() => {
          onClose();
          onNewFolder(item);
        }}
      >
        <FolderPlus size={13} />
        <span>New Folder</span>
      </div>

      <div style={{ height: '1px', backgroundColor: 'rgba(255, 255, 255, 0.08)', margin: '4px 0' }} />

      {/* Editor open */}
      {!isFolder && onOpenInNewEditor && (
        <div
          className="context-menu-item"
          onClick={() => {
            onClose();
            onOpenInNewEditor(item);
          }}
        >
          <ExternalLink size={13} />
          <span>Open in New Editor</span>
        </div>
      )}

      {/* Rename & Delete */}
      {!isRoot && (
        <>
          <div
            className="context-menu-item"
            onClick={() => {
              onClose();
              onRename(item);
            }}
          >
            <Edit2 size={13} />
            <span>Rename...</span>
          </div>

          <div
            className="context-menu-item"
            style={{ color: '#f87171' }}
            onClick={() => {
              onClose();
              onDelete(item);
            }}
          >
            <Trash2 size={13} />
            <span>Delete</span>
          </div>

          <div style={{ height: '1px', backgroundColor: 'rgba(255, 255, 255, 0.08)', margin: '4px 0' }} />
        </>
      )}

      {/* Path Copying */}
      <div
        className="context-menu-item"
        onClick={() => {
          onClose();
          onCopyPath(item);
        }}
      >
        <Copy size={13} />
        <span>Copy Path</span>
      </div>

      <div
        className="context-menu-item"
        onClick={() => {
          onClose();
          onCopyRelativePath(item);
        }}
      >
        <Copy size={13} />
        <span>Copy Relative Path</span>
      </div>

      {onReveal && (
        <div
          className="context-menu-item"
          onClick={() => {
            onClose();
            onReveal(item);
          }}
        >
          <FolderOpen size={13} />
          <span>Reveal in File Manager</span>
        </div>
      )}

      {/* Workspace Folder Actions */}
      <div style={{ height: '1px', backgroundColor: 'rgba(255, 255, 255, 0.08)', margin: '4px 0' }} />

      {onAddFolder && (
        <div
          className="context-menu-item"
          onClick={() => {
            onClose();
            onAddFolder();
          }}
        >
          <AddFolderIcon size={13} color="#60a5fa" />
          <span>Add Folder to Workspace...</span>
        </div>
      )}

      {isRoot && onRemoveFolder && (
        <div
          className="context-menu-item"
          style={{ color: '#f87171' }}
          onClick={() => {
            onClose();
            onRemoveFolder(item);
          }}
        >
          <MinusCircle size={13} />
          <span>Remove Folder from Workspace</span>
        </div>
      )}
    </div>
  );
}
