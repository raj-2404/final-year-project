import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { roomsApi } from '../../services/api';
import { stompService } from '../../services/stompService';
import './VSCode.css';

// Helper to determine Monaco language from file extension
const getLanguageForFilename = (filename) => {
  const ext = filename.split('.').pop().toLowerCase();
  switch (ext) {
    case 'py': return 'python';
    case 'js': case 'jsx': return 'javascript';
    case 'ts': case 'tsx': return 'typescript';
    case 'html': return 'html';
    case 'css': return 'css';
    case 'json': return 'json';
    case 'java': return 'java';
    case 'cpp': case 'cc': case 'cxx': return 'cpp';
    case 'c': case 'h': return 'c';
    case 'go': return 'go';
    case 'md': return 'markdown';
    case 'sql': return 'sql';
    default: return 'plaintext';
  }
};

// File icon emoji helper
const getFileIcon = (filename) => {
  const ext = filename.split('.').pop().toLowerCase();
  switch (ext) {
    case 'py': return '🐍';
    case 'js': case 'jsx': return '🟨';
    case 'ts': case 'tsx': return '🔷';
    case 'html': return '🌐';
    case 'css': return '🎨';
    case 'json': return '⚙️';
    case 'java': return '☕';
    case 'cpp': case 'c': return '⚙️';
    case 'go': return '🐹';
    case 'md': return '📝';
    default: return '📄';
  }
};

export default function VSCodeEditor({ room, user, onCloseWorkspace }) {
  // Tree state
  const [fileTree, setFileTree] = useState([]);
  const [activeFileId, setActiveFileId] = useState(null);
  const [openTabIds, setOpenTabIds] = useState([]);
  const [expandedFolders, setExpandedFolders] = useState(new Set(['folder-src']));

  // Inline creation state
  const [creatingType, setCreatingType] = useState(null); // 'file' | 'folder' | null
  const [creatingTargetFolderId, setCreatingTargetFolderId] = useState(null);
  const [newEntryName, setNewEntryName] = useState('');

  // Inline rename state
  const [renamingId, setRenamingId] = useState(null);
  const [renamingName, setRenamingName] = useState('');

  // Presence and sync status
  const [participantsCount, setParticipantsCount] = useState(1);
  const [isSynced, setIsSynced] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [copyCodeSuccess, setCopyCodeSuccess] = useState(false);
  const [editorTheme, setEditorTheme] = useState('vs-dark');

  // References to keep STOMP callbacks referencing latest state without re-subscribing
  const fileTreeRef = useRef(fileTree);
  fileTreeRef.current = fileTree;

  const activeFileIdRef = useRef(activeFileId);
  activeFileIdRef.current = activeFileId;

  const saveTimerRef = useRef(null);

  // 1. Initial Load & Late-Joiner Full Synchronization
  useEffect(() => {
    let isMounted = true;

    async function initializeWorkspace() {
      try {
        // Fetch the full room state from PostgreSQL
        const roomData = await roomsApi.getRoom(room.roomCode);

        let initialTree = [];
        try {
          if (roomData.codeContent && roomData.codeContent.trim().startsWith('[')) {
            initialTree = JSON.parse(roomData.codeContent);
          }
        } catch {
          initialTree = [];
        }

        // Fallback default file tree if empty
        if (!initialTree || initialTree.length === 0) {
          initialTree = [
            { id: 'folder-src', name: 'src', type: 'folder', parentId: null },
            {
              id: 'file-main-py',
              name: 'main.py',
              type: 'file',
              parentId: 'folder-src',
              language: 'python',
              content: "# Welcome to CodeLive Collaborative Workspace\ndef main():\n    print('Hello, Collaborative World!')\n\nif __name__ == '__main__':\n    main()\n",
            },
            {
              id: 'file-index-js',
              name: 'index.js',
              type: 'file',
              parentId: 'folder-src',
              language: 'javascript',
              content: "// Real-time collaborative JavaScript\nconsole.log('Connected to shared workspace');\n",
            },
            {
              id: 'file-readme',
              name: 'README.md',
              type: 'file',
              parentId: null,
              language: 'markdown',
              content: "# Collaborative Project Workspace\n\nAll folders, files, and edits are synchronized in real time across all connected participants.\n",
            },
          ];
        }

        if (!isMounted) return;

        setFileTree(initialTree);

        // Find first file to activate
        const firstFile = initialTree.find((item) => item.type === 'file');
        if (firstFile) {
          setActiveFileId(firstFile.id);
          setOpenTabIds([firstFile.id]);
        }

        setIsSynced(true);

        // 2. Connect to STOMP Broker for Live Real-Time Multi-User Collaboration
        await stompService.connect(room.roomCode, {
          userName: user?.name || 'Developer',

          // Live Participants Presence
          onPresence: (data) => {
            if (data?.usersCount !== undefined) {
              setParticipantsCount(data.usersCount);
            }
            if (data?.type === 'JOIN' && data?.senderName && data.senderName !== user?.name) {
              showToast(`${data.senderName} joined the workspace`);
            } else if (data?.type === 'LEAVE') {
              showToast('A participant left the workspace');
            }
          },

          // Live Folder & File Tree Synchronization
          onTreeChange: (data) => {
            if (data.senderId === stompService.getClientId()) return;

            try {
              const remoteTree = JSON.parse(data.fileTreeJson);
              if (Array.isArray(remoteTree)) {
                setFileTree(remoteTree);
                setIsSynced(true);
                showToast(`Folders synchronized (${data.type})`);

                // If active file was deleted, switch to another
                if (data.type === 'FILE_DELETE' && !remoteTree.some((f) => f.id === activeFileIdRef.current)) {
                  const nextFile = remoteTree.find((f) => f.type === 'file');
                  if (nextFile) {
                    setActiveFileId(nextFile.id);
                    setOpenTabIds((prev) => prev.filter((id) => id !== activeFileIdRef.current).concat(nextFile.id));
                  }
                }
              }
            } catch (err) {
              console.error('Failed to parse remote file tree', err);
            }
          },

          // Live Code Editing Synchronization
          onCodeChange: (data) => {
            if (data.senderId === stompService.getClientId()) return;

            setFileTree((prevTree) =>
              prevTree.map((item) =>
                item.id === data.fileId ? { ...item, content: data.code } : item
              )
            );
          },
        });
      } catch (err) {
        console.error('Workspace initialization error', err);
      }
    }

    initializeWorkspace();

    return () => {
      isMounted = false;
      stompService.disconnect();
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [room.roomCode]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  // Helper to persist tree to backend debounced
  const persistTree = (updatedTree) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      roomsApi.updateTree(room.roomCode, JSON.stringify(updatedTree)).catch(console.error);
    }, 1500);
  };

  // Active file object
  const activeFile = fileTree.find((item) => item.id === activeFileId && item.type === 'file');

  // Handle local code editing in Monaco
  const handleEditorChange = (newCode) => {
    if (!activeFile) return;

    const updatedTree = fileTree.map((item) =>
      item.id === activeFile.id ? { ...item, content: newCode } : item
    );
    setFileTree(updatedTree);

    // 1. Broadcast code change live to all connected peers
    stompService.sendCodeChange(room.roomCode, activeFile.id, newCode);

    // 2. Persist updated tree to PostgreSQL
    persistTree(updatedTree);
  };

  // Handle File Creation
  const handleCreateEntry = (e) => {
    e.preventDefault();
    const name = newEntryName.trim();
    if (!name) {
      setCreatingType(null);
      return;
    }

    const newId = (creatingType === 'folder' ? 'folder-' : 'file-') + Math.random().toString(36).substring(2, 9);
    const newEntry = {
      id: newId,
      name,
      type: creatingType,
      parentId: creatingTargetFolderId,
      ...(creatingType === 'file'
        ? {
            language: getLanguageForFilename(name),
            content: `// ${name}\n`,
          }
        : {}),
    };

    const updatedTree = [...fileTree, newEntry];
    setFileTree(updatedTree);

    // If file, open tab and set active
    if (creatingType === 'file') {
      setActiveFileId(newId);
      if (!openTabIds.includes(newId)) {
        setOpenTabIds([...openTabIds, newId]);
      }
    } else {
      // Expand the folder
      setExpandedFolders((prev) => new Set([...prev, newId]));
    }

    // Broadcast tree creation to all connected users
    stompService.sendTreeChange(room.roomCode, 'FILE_CREATE', updatedTree, newId, user?.name);
    persistTree(updatedTree);

    setCreatingType(null);
    setNewEntryName('');
    showToast(`Created ${creatingType}: ${name}`);
  };

  // Handle Delete Entry
  const handleDeleteEntry = (e, item) => {
    e.stopPropagation();
    if (!window.confirm(`Delete ${item.type} "${item.name}"?`)) return;

    // Remove item and any child items if folder
    const idsToRemove = new Set([item.id]);
    if (item.type === 'folder') {
      fileTree.forEach((child) => {
        if (child.parentId === item.id) idsToRemove.add(child.id);
      });
    }

    const updatedTree = fileTree.filter((f) => !idsToRemove.has(f.id));
    setFileTree(updatedTree);

    // If active file deleted, pick another
    if (idsToRemove.has(activeFileId)) {
      const remainingFile = updatedTree.find((f) => f.type === 'file');
      setActiveFileId(remainingFile ? remainingFile.id : null);
    }
    setOpenTabIds((prev) => prev.filter((id) => !idsToRemove.has(id)));

    // Broadcast deletion to all connected users
    stompService.sendTreeChange(room.roomCode, 'FILE_DELETE', updatedTree, item.id, user?.name);
    persistTree(updatedTree);

    showToast(`Deleted ${item.name}`);
  };

  // Handle Rename Entry
  const handleRenameSubmit = (e, item) => {
    e.preventDefault();
    const newName = renamingName.trim();
    if (!newName || newName === item.name) {
      setRenamingId(null);
      return;
    }

    const updatedTree = fileTree.map((f) => {
      if (f.id === item.id) {
        return {
          ...f,
          name: newName,
          ...(f.type === 'file' ? { language: getLanguageForFilename(newName) } : {}),
        };
      }
      return f;
    });

    setFileTree(updatedTree);
    setRenamingId(null);

    // Broadcast rename to all peers
    stompService.sendTreeChange(room.roomCode, 'FILE_RENAME', updatedTree, item.id, user?.name);
    persistTree(updatedTree);
  };

  const toggleFolder = (folderId) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const handleSelectFile = (file) => {
    setActiveFileId(file.id);
    if (!openTabIds.includes(file.id)) {
      setOpenTabIds([...openTabIds, file.id]);
    }
  };

  const handleCloseTab = (e, tabId) => {
    e.stopPropagation();
    const nextTabs = openTabIds.filter((id) => id !== tabId);
    setOpenTabIds(nextTabs);
    if (activeFileId === tabId) {
      setActiveFileId(nextTabs.length > 0 ? nextTabs[nextTabs.length - 1] : null);
    }
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(room.roomCode);
    setCopyCodeSuccess(true);
    setTimeout(() => setCopyCodeSuccess(false), 2000);
  };

  // Render tree node recursively or flat grouped
  const renderTreeItems = (parentId = null, depth = 0) => {
    const items = fileTree.filter((item) => item.parentId === parentId);

    // Sort folders first, then files alphabetically
    items.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return items.map((item) => {
      if (item.type === 'folder') {
        const isExpanded = expandedFolders.has(item.id);
        return (
          <div key={item.id}>
            <div
              className="tree-node-item"
              style={{ paddingLeft: `${depth * 14 + 10}px` }}
              onClick={() => toggleFolder(item.id)}
            >
              <span className="tree-node-icon">{isExpanded ? '📂' : '📁'}</span>

              {renamingId === item.id ? (
                <form onSubmit={(e) => handleRenameSubmit(e, item)} style={{ display: 'inline' }}>
                  <input
                    type="text"
                    value={renamingName}
                    onChange={(e) => setRenamingName(e.target.value)}
                    onBlur={() => setRenamingId(null)}
                    autoFocus
                    style={{ background: '#3c3c3c', border: '1px solid #007acc', color: 'white', fontSize: '12px' }}
                  />
                </form>
              ) : (
                <span className="tree-node-name">{item.name}</span>
              )}

              <div className="tree-node-actions">
                <button
                  className="node-btn"
                  title="New File Inside"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCreatingType('file');
                    setCreatingTargetFolderId(item.id);
                    setExpandedFolders((p) => new Set([...p, item.id]));
                  }}
                >
                  📄
                </button>
                <button
                  className="node-btn"
                  title="Rename"
                  onClick={(e) => {
                    e.stopPropagation();
                    setRenamingId(item.id);
                    setRenamingName(item.name);
                  }}
                >
                  ✏️
                </button>
                <button
                  className="node-btn"
                  title="Delete"
                  onClick={(e) => handleDeleteEntry(e, item)}
                >
                  🗑️
                </button>
              </div>
            </div>

            {/* Inline creation inside this folder */}
            {creatingType && creatingTargetFolderId === item.id && (
              <form onSubmit={handleCreateEntry} className="tree-inline-input" style={{ paddingLeft: `${(depth + 1) * 14 + 10}px` }}>
                <input
                  type="text"
                  placeholder={creatingType === 'file' ? 'filename.py' : 'folder-name'}
                  value={newEntryName}
                  onChange={(e) => setNewEntryName(e.target.value)}
                  onBlur={() => setCreatingType(null)}
                  autoFocus
                />
              </form>
            )}

            {isExpanded && renderTreeItems(item.id, depth + 1)}
          </div>
        );
      }

      // File node
      const isActive = activeFileId === item.id;
      return (
        <div
          key={item.id}
          className={`tree-node-item ${isActive ? 'active' : ''}`}
          style={{ paddingLeft: `${depth * 14 + 10}px` }}
          onClick={() => handleSelectFile(item)}
        >
          <span className="tree-node-icon">{getFileIcon(item.name)}</span>

          {renamingId === item.id ? (
            <form onSubmit={(e) => handleRenameSubmit(e, item)} style={{ display: 'inline' }}>
              <input
                type="text"
                value={renamingName}
                onChange={(e) => setRenamingName(e.target.value)}
                onBlur={() => setRenamingId(null)}
                autoFocus
                style={{ background: '#3c3c3c', border: '1px solid #007acc', color: 'white', fontSize: '12px' }}
              />
            </form>
          ) : (
            <span className="tree-node-name">{item.name}</span>
          )}

          <div className="tree-node-actions">
            <button
              className="node-btn"
              title="Rename"
              onClick={(e) => {
                e.stopPropagation();
                setRenamingId(item.id);
                setRenamingName(item.name);
              }}
            >
              ✏️
            </button>
            <button
              className="node-btn"
              title="Delete"
              onClick={(e) => handleDeleteEntry(e, item)}
            >
              🗑️
            </button>
          </div>
        </div>
      );
    });
  };

  return (
    <div className="vscode-editor-layout">
      {/* Top Application Bar */}
      <div className="vscode-top-bar">
        <div className="top-bar-left">
          <div className="project-brand">
            <span>&lt;/&gt;</span>
            <span>{room.title || 'CodeLive Workspace'}</span>
          </div>

          <div className="room-badge" onClick={copyRoomCode} title="Click to copy invite code">
            <span>Room: {room.roomCode}</span>
            <span>{copyCodeSuccess ? '✓ Copied' : '📋'}</span>
          </div>
        </div>

        <div className="top-bar-center">
          {activeFile ? (
            <span>
              {room.title} &gt; {activeFile.name}
            </span>
          ) : (
            <span>No file selected</span>
          )}
        </div>

        <div className="top-bar-right">
          <div className="sync-status-badge">
            <div className="sync-dot"></div>
            <span>{isSynced ? 'Live Sync Active' : 'Connecting...'}</span>
          </div>

          <div className="participants-badge">
            <span>👥 {participantsCount} Online</span>
          </div>

          <button
            className="close-workspace-btn"
            onClick={onCloseWorkspace}
            title="Return to Welcome Screen"
          >
            Close Folder
          </button>
        </div>
      </div>

      {/* Main Workspace Middle */}
      <div className="vscode-main-area">
        {/* Left Activity Bar */}
        <div className="vscode-activity-bar">
          <button className="activity-btn active" title="Explorer">
            📁
          </button>
          <button className="activity-btn" title="Search">
            🔍
          </button>
          <button className="activity-btn" title="Terminal">
            💻
          </button>

          <div className="activity-bar-bottom">
            <button
              className="activity-btn"
              title={editorTheme === 'vs-dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
              onClick={() => setEditorTheme(editorTheme === 'vs-dark' ? 'light' : 'vs-dark')}
            >
              {editorTheme === 'vs-dark' ? '☀️' : '🌙'}
            </button>
            <span style={{ fontSize: '11px', color: '#858585' }} title={user?.email}>
              👤
            </span>
          </div>
        </div>

        {/* Primary Sidebar: File Explorer */}
        <div className="vscode-sidebar">
          <div className="sidebar-header">
            <span>EXPLORER: {room.title || 'WORKSPACE'}</span>
            <div className="sidebar-actions">
              <button
                className="sidebar-action-btn"
                title="New File"
                onClick={() => {
                  setCreatingType('file');
                  setCreatingTargetFolderId(null);
                  setNewEntryName('');
                }}
              >
                📄+
              </button>
              <button
                className="sidebar-action-btn"
                title="New Folder"
                onClick={() => {
                  setCreatingType('folder');
                  setCreatingTargetFolderId(null);
                  setNewEntryName('');
                }}
              >
                📁+
              </button>
              <button
                className="sidebar-action-btn"
                title="Refresh Workspace"
                onClick={() => {
                  showToast('Re-syncing folder state...');
                  roomsApi.getRoom(room.roomCode).then((r) => {
                    if (r.codeContent?.startsWith('[')) {
                      setFileTree(JSON.parse(r.codeContent));
                    }
                  });
                }}
              >
                🔄
              </button>
            </div>
          </div>

          {/* File Tree */}
          <div className="file-tree-container">
            {/* Inline creation at root level */}
            {creatingType && creatingTargetFolderId === null && (
              <form onSubmit={handleCreateEntry} className="tree-inline-input">
                <input
                  type="text"
                  placeholder={creatingType === 'file' ? 'filename.py' : 'folder-name'}
                  value={newEntryName}
                  onChange={(e) => setNewEntryName(e.target.value)}
                  onBlur={() => setCreatingType(null)}
                  autoFocus
                />
              </form>
            )}

            {renderTreeItems(null, 0)}
          </div>
        </div>

        {/* Editor Main Content Pane */}
        <div className="vscode-editor-main">
          {/* Open Tabs */}
          <div className="editor-tabs-bar">
            {openTabIds.map((tabId) => {
              const file = fileTree.find((f) => f.id === tabId);
              if (!file) return null;
              const isActive = activeFileId === tabId;
              return (
                <div
                  key={tabId}
                  className={`editor-tab ${isActive ? 'active' : ''}`}
                  onClick={() => setActiveFileId(tabId)}
                >
                  <span>{getFileIcon(file.name)}</span>
                  <span>{file.name}</span>
                  <button
                    className="tab-close-btn"
                    onClick={(e) => handleCloseTab(e, tabId)}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>

          {/* Breadcrumbs */}
          <div className="editor-breadcrumbs">
            <span className="breadcrumb-item">{room.title || 'Workspace'}</span>
            {activeFile && (
              <>
                <span className="breadcrumb-separator">&gt;</span>
                <span className="breadcrumb-item">{activeFile.name}</span>
              </>
            )}
          </div>

          {/* Monaco Editor Pane */}
          <div className="monaco-wrapper">
            {activeFile ? (
              <Editor
                height="100%"
                theme={editorTheme}
                language={activeFile.language || 'plaintext'}
                value={activeFile.content || ''}
                onChange={handleEditorChange}
                options={{
                  fontSize: 14,
                  minimap: { enabled: true },
                  scrollBeyondLastLine: false,
                  smoothScrolling: true,
                  automaticLayout: true,
                  tabSize: 2,
                  wordWrap: 'on',
                }}
              />
            ) : (
              <div
                style={{
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#858585',
                  fontSize: '14px',
                }}
              >
                Select a file from the explorer to begin editing
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Status Bar */}
      <div className="vscode-status-bar">
        <div className="status-left">
          <div className="status-item" onClick={copyRoomCode}>
            <span>🔗</span>
            <span>Room: {room.roomCode}</span>
          </div>
          <div className="status-item">
            <span>👥 {participantsCount} connected</span>
          </div>
          {toastMessage && (
            <div style={{ background: '#3c3c3c', padding: '0 6px', borderRadius: '3px' }}>
              📢 {toastMessage}
            </div>
          )}
        </div>

        <div className="status-right">
          <div className="status-item">
            <span>{activeFile ? activeFile.language.toUpperCase() : 'PLAIN TEXT'}</span>
          </div>
          <div className="status-item">
            <span>UTF-8</span>
          </div>
          <div className="status-item">
            <span>Spaces: 2</span>
          </div>
        </div>
      </div>
    </div>
  );
}
