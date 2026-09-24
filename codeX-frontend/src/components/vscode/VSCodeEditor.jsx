import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import {
  Files,
  Search,
  GitBranch,
  Play,
  Blocks,
  Settings,
  User,
  Users,
  Terminal as TerminalIcon,
  Sun,
  Moon,
  ChevronRight,
  ChevronDown,
  FilePlus,
  FolderPlus,
  Edit2,
  Trash2,
  RotateCw,
  X,
  Copy,
  Check,
  Globe,
  Lock,
  HardDrive,
  FolderTree,
  MoreHorizontal,
} from 'lucide-react';

import { roomsApi } from '../../services/api';
import { stompService } from '../../services/stompService';
import { localFileSystem } from '../../services/localFileSystem';
import FileIcon from './FileIcon';
import QuickOpenModal from './QuickOpenModal';
import CollabPopover from './CollabPopover';
import BottomPanel from './BottomPanel';
import TeamModal from '../team/TeamModal';
import './VSCode.css';

// Helper to determine Monaco language from file extension
const getLanguageForFilename = (filename) => {
  const ext = filename?.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'py': return 'python';
    case 'js': case 'jsx': return 'javascript';
    case 'ts': case 'tsx': return 'typescript';
    case 'html': return 'html';
    case 'css': case 'scss': return 'css';
    case 'json': return 'json';
    case 'java': return 'java';
    case 'cpp': case 'cc': case 'cxx': return 'cpp';
    case 'c': case 'h': return 'c';
    case 'go': return 'go';
    case 'md': return 'markdown';
    case 'sql': return 'sql';
    case 'sh': return 'shell';
    default: return 'plaintext';
  }
};

export default function VSCodeEditor({ room, user, onCloseWorkspace }) {
  // Activity Bar active tab
  const [activeActivity, setActiveActivity] = useState('explorer'); // 'explorer' | 'search' | 'git' | 'debug' | 'extensions'

  // Tree state
  const [fileTree, setFileTree] = useState([]);
  const [activeFileId, setActiveFileId] = useState(null);
  const [openTabIds, setOpenTabIds] = useState([]);
  const [expandedFolders, setExpandedFolders] = useState(new Set(['folder-root', 'folder-src']));

  // Inline creation & rename states
  const [creatingType, setCreatingType] = useState(null); // 'file' | 'folder' | null
  const [creatingTargetFolderId, setCreatingTargetFolderId] = useState(null);
  const [newEntryName, setNewEntryName] = useState('');
  const [renamingId, setRenamingId] = useState(null);
  const [renamingName, setRenamingName] = useState('');

  // Editor cursor & language state
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [editorTheme, setEditorTheme] = useState('vs-dark');

  // Collaboration & Live Sync
  const [participantsCount, setParticipantsCount] = useState(1);
  const [isSynced, setIsSynced] = useState(false);
  const [copyCodeSuccess, setCopyCodeSuccess] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Modals & Panels
  const [showQuickOpen, setShowQuickOpen] = useState(false);
  const [showCollabPopover, setShowCollabPopover] = useState(false);
  const [showBottomPanel, setShowBottomPanel] = useState(false);
  const [bottomPanelTab, setBottomPanelTab] = useState('terminal');
  const [showTeamModal, setShowTeamModal] = useState(false);

  // Disk Sync Status
  const [diskSyncStatus, setDiskSyncStatus] = useState(room.localDirHandle ? 'synced' : 'none');

  // References
  const fileTreeRef = useRef(fileTree);
  fileTreeRef.current = fileTree;

  const activeFileIdRef = useRef(activeFileId);
  activeFileIdRef.current = activeFileId;

  const localFileHandlesRef = useRef(room.localFileHandles || new Map());
  const localDirHandlesRef = useRef(room.localDirHandles || new Map());
  if (room.localDirHandle && !localDirHandlesRef.current.has('folder-root')) {
    localDirHandlesRef.current.set('folder-root', room.localDirHandle);
  }

  const saveTimerRef = useRef(null);
  const editorRef = useRef(null);

  // 1. Initial Load & Late-Joiner Full Synchronization
  useEffect(() => {
    let isMounted = true;

    async function initializeWorkspace() {
      try {
        const roomData = await roomsApi.getRoom(room.roomCode);

        let initialTree = [];
        try {
          if (roomData.codeContent && roomData.codeContent.trim().startsWith('[')) {
            initialTree = JSON.parse(roomData.codeContent);
          }
        } catch {
          initialTree = [];
        }

        // If empty, initialize with clean root folder (no pre-baked languages)
        if (!initialTree || initialTree.length === 0) {
          initialTree = [
            {
              id: 'folder-root',
              name: room.title || 'Workspace',
              type: 'folder',
              parentId: null,
            },
          ];
        }

        if (!isMounted) return;

        setFileTree(initialTree);

        const firstFile = initialTree.find((item) => item.type === 'file');
        if (firstFile) {
          setActiveFileId(firstFile.id);
          setOpenTabIds([firstFile.id]);
        }

        setIsSynced(true);

        // 2. Connect to STOMP Broker for Live Real-Time Multi-User Collaboration
        await stompService.connect(room.roomCode, {
          userName: user?.name || user?.username || 'Developer',

          onPresence: (data) => {
            if (data?.usersCount !== undefined) {
              setParticipantsCount(data.usersCount);
            }
            if (data?.type === 'JOIN' && data?.senderName && data.senderName !== (user?.name || user?.username)) {
              showToast(`${data.senderName} joined workspace`);
            } else if (data?.type === 'LEAVE') {
              showToast('A teammate left workspace');
            }
          },

          onTreeChange: (data) => {
            if (data.senderId === stompService.getClientId()) return;

            try {
              const remoteTree = JSON.parse(data.fileTreeJson);
              if (Array.isArray(remoteTree)) {
                setFileTree(remoteTree);
                setIsSynced(true);
                showToast(`Folders updated (${data.type})`);

                if (data.type === 'FILE_DELETE' && !remoteTree.some((f) => f.id === activeFileIdRef.current)) {
                  const nextFile = remoteTree.find((f) => f.type === 'file');
                  if (nextFile) {
                    setActiveFileId(nextFile.id);
                    setOpenTabIds((prev) => prev.filter((id) => id !== activeFileIdRef.current).concat(nextFile.id));
                  } else {
                    setActiveFileId(null);
                  }
                }
              }
            } catch (err) {
              console.error('Failed to parse remote file tree', err);
            }
          },

          onCodeChange: (data) => {
            if (data.senderId === stompService.getClientId()) return;

            setFileTree((prevTree) =>
              prevTree.map((item) =>
                item.id === data.fileId ? { ...item, content: data.code } : item
              )
            );

            // Real-time disk sync: write teammate's edits to local PC file if folder is linked
            if (room.localDirHandle && localFileHandlesRef.current.has(data.fileId)) {
              const fileHandleObj = localFileHandlesRef.current.get(data.fileId);
              localFileSystem.writeFileToDisk(fileHandleObj.handle, data.code).then((ok) => {
                if (ok) setDiskSyncStatus('synced');
              });
            }
          },
        });
      } catch (err) {
        console.error('Workspace initialization error', err);
      }
    }

    initializeWorkspace();

    // Keyboard shortcut for Quick Open (Cmd+P / Ctrl+P)
    const handleGlobalKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setShowQuickOpen(true);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);

    return () => {
      isMounted = false;
      window.removeEventListener('keydown', handleGlobalKeyDown);
      stompService.disconnect();
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [room.roomCode]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const persistTree = (updatedTree) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      roomsApi.updateTree(room.roomCode, JSON.stringify(updatedTree)).catch(console.error);
    }, 1500);
  };

  const activeFile = fileTree.find((item) => item.id === activeFileId && item.type === 'file');

  // Monaco Editor Mounting & Cursor Tracking
  const handleEditorDidMount = (editor) => {
    editorRef.current = editor;
    editor.onDidChangeCursorPosition((e) => {
      setCursorPos({
        line: e.position.lineNumber,
        col: e.position.column,
      });
    });
  };

  // Local Code Editing
  const handleEditorChange = (newCode) => {
    if (!activeFile) return;

    const updatedTree = fileTree.map((item) =>
      item.id === activeFile.id ? { ...item, content: newCode } : item
    );
    setFileTree(updatedTree);

    // 1. Write directly to PC local disk file if linked
    if (room.localDirHandle && localFileHandlesRef.current.has(activeFile.id)) {
      setDiskSyncStatus('saving');
      const fileHandleObj = localFileHandlesRef.current.get(activeFile.id);
      localFileSystem.writeFileToDisk(fileHandleObj.handle, newCode).then((ok) => {
        if (ok) setDiskSyncStatus('synced');
      });
    }

    // 2. Broadcast live
    stompService.sendCodeChange(room.roomCode, activeFile.id, newCode);

    // 3. Persist tree debounced
    persistTree(updatedTree);
  };

  // File / Folder Creation
  const handleCreateEntry = async (e) => {
    e.preventDefault();
    const name = newEntryName.trim();
    if (!name) {
      setCreatingType(null);
      return;
    }

    const newId = (creatingType === 'folder' ? 'folder-' : 'file-') + Math.random().toString(36).substring(2, 9);
    const targetParentId = creatingTargetFolderId || (fileTree.some((f) => f.id === 'folder-root') ? 'folder-root' : null);

    const newEntry = {
      id: newId,
      name,
      type: creatingType,
      parentId: targetParentId,
      ...(creatingType === 'file'
        ? {
            language: getLanguageForFilename(name),
            content: ``,
          }
        : {}),
    };

    if (room.localDirHandle) {
      const parentDir =
        localDirHandlesRef.current.get(targetParentId || 'folder-root') ||
        room.localDirHandle;

      if (creatingType === 'file') {
        const fileHandle = await localFileSystem.createFileOnDisk(parentDir, name, '');
        if (fileHandle) {
          localFileHandlesRef.current.set(newId, {
            handle: fileHandle,
            name,
            parentDirHandle: parentDir,
          });
        }
      } else {
        const dirHandle = await localFileSystem.createFolderOnDisk(parentDir, name);
        if (dirHandle) {
          localDirHandlesRef.current.set(newId, dirHandle);
        }
      }
    }

    const updatedTree = [...fileTree, newEntry];
    setFileTree(updatedTree);

    if (creatingType === 'file') {
      setActiveFileId(newId);
      if (!openTabIds.includes(newId)) {
        setOpenTabIds([...openTabIds, newId]);
      }
    } else {
      setExpandedFolders((prev) => new Set([...prev, newId]));
    }

    stompService.sendTreeChange(room.roomCode, 'FILE_CREATE', updatedTree, newId, user?.name || user?.username);
    persistTree(updatedTree);

    setCreatingType(null);
    setNewEntryName('');
  };

  // Delete Entry
  const handleDeleteEntry = async (e, item) => {
    e.stopPropagation();
    if (!window.confirm(`Delete ${item.type} "${item.name}"?`)) return;

    if (room.localDirHandle) {
      const parentDir =
        localDirHandlesRef.current.get(item.parentId || 'folder-root') ||
        room.localDirHandle;
      await localFileSystem.deleteEntryFromDisk(parentDir, item.name);
      localFileHandlesRef.current.delete(item.id);
      localDirHandlesRef.current.delete(item.id);
    }

    const idsToRemove = new Set([item.id]);
    if (item.type === 'folder') {
      fileTree.forEach((child) => {
        if (child.parentId === item.id) idsToRemove.add(child.id);
      });
    }

    const updatedTree = fileTree.filter((f) => !idsToRemove.has(f.id));
    setFileTree(updatedTree);

    if (idsToRemove.has(activeFileId)) {
      const remainingFile = updatedTree.find((f) => f.type === 'file');
      setActiveFileId(remainingFile ? remainingFile.id : null);
    }
    setOpenTabIds((prev) => prev.filter((id) => !idsToRemove.has(id)));

    stompService.sendTreeChange(room.roomCode, 'FILE_DELETE', updatedTree, item.id, user?.name || user?.username);
    persistTree(updatedTree);
  };

  // Rename Entry
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

    stompService.sendTreeChange(room.roomCode, 'FILE_RENAME', updatedTree, item.id, user?.name || user?.username);
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
    const newTabs = openTabIds.filter((id) => id !== tabId);
    setOpenTabIds(newTabs);

    if (activeFileId === tabId) {
      if (newTabs.length > 0) {
        setActiveFileId(newTabs[newTabs.length - 1]);
      } else {
        setActiveFileId(null);
      }
    }
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(room.roomCode);
    setCopyCodeSuccess(true);
    showToast(`Room code ${room.roomCode} copied`);
    setTimeout(() => setCopyCodeSuccess(false), 2000);
  };

  // Render Explorer File/Folder Tree
  const renderTreeItems = (parentId = null, depth = 0) => {
    const items = fileTree.filter((item) => {
      if (parentId === null) {
        return item.parentId === null || item.parentId === undefined;
      }
      return item.parentId === parentId;
    });

    items.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return items.map((item) => {
      const isFolder = item.type === 'folder';
      const isExpanded = expandedFolders.has(item.id);
      const isActive = activeFileId === item.id;
      const isBeingRenamed = renamingId === item.id;

      if (isFolder) {
        return (
          <div key={item.id} className="tree-folder-group">
            <div
              className="tree-node folder-node"
              style={{ paddingLeft: `${depth * 14 + 10}px` }}
              onClick={() => toggleFolder(item.id)}
            >
              <span className="folder-chevron">
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
              <FileIcon isFolder={true} isOpen={isExpanded} size={15} />

              {isBeingRenamed ? (
                <form onSubmit={(e) => handleRenameSubmit(e, item)} onClick={(e) => e.stopPropagation()}>
                  <input
                    type="text"
                    className="inline-rename-input"
                    value={renamingName}
                    onChange={(e) => setRenamingName(e.target.value)}
                    onBlur={() => setRenamingId(null)}
                    autoFocus
                  />
                </form>
              ) : (
                <span className="folder-name">{item.name}</span>
              )}

              {/* Hover-only contextual CRUD actions */}
              <div className="node-hover-actions">
                <button
                  className="node-btn"
                  title="New File inside"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCreatingType('file');
                    setCreatingTargetFolderId(item.id);
                    setNewEntryName('');
                    setExpandedFolders((prev) => new Set([...prev, item.id]));
                  }}
                >
                  <FilePlus size={13} />
                </button>
                <button
                  className="node-btn"
                  title="New Subfolder"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCreatingType('folder');
                    setCreatingTargetFolderId(item.id);
                    setNewEntryName('');
                    setExpandedFolders((prev) => new Set([...prev, item.id]));
                  }}
                >
                  <FolderPlus size={13} />
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
                  <Edit2 size={12} />
                </button>
                <button
                  className="node-btn delete-btn"
                  title="Delete Folder"
                  onClick={(e) => handleDeleteEntry(e, item)}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>

            {/* Folder Children with clean indentation guides */}
            {isExpanded && (
              <div className="folder-children" style={{ borderLeft: depth > 0 ? '1px solid rgba(255, 255, 255, 0.06)' : 'none', marginLeft: `${depth * 14 + 16}px` }}>
                {creatingType && creatingTargetFolderId === item.id && (
                  <form
                    onSubmit={handleCreateEntry}
                    className="inline-create-form"
                    style={{ paddingLeft: '8px' }}
                  >
                    <FileIcon isFolder={creatingType === 'folder'} isOpen={false} size={14} />
                    <input
                      type="text"
                      className="inline-create-input"
                      placeholder={`New ${creatingType} name...`}
                      value={newEntryName}
                      onChange={(e) => setNewEntryName(e.target.value)}
                      onBlur={() => setCreatingType(null)}
                      autoFocus
                    />
                  </form>
                )}
                {renderTreeItems(item.id, depth + 1)}
              </div>
            )}
          </div>
        );
      }

      // File Node
      return (
        <div
          key={item.id}
          className={`tree-node file-node ${isActive ? 'active' : ''}`}
          style={{ paddingLeft: `${depth * 14 + 14}px` }}
          onClick={() => handleSelectFile(item)}
        >
          <FileIcon filename={item.name} size={15} />

          {isBeingRenamed ? (
            <form onSubmit={(e) => handleRenameSubmit(e, item)} onClick={(e) => e.stopPropagation()}>
              <input
                type="text"
                className="inline-rename-input"
                value={renamingName}
                onChange={(e) => setRenamingName(e.target.value)}
                onBlur={() => setRenamingId(null)}
                autoFocus
              />
            </form>
          ) : (
            <span className="file-name">{item.name}</span>
          )}

          {/* Hover-only contextual CRUD actions */}
          <div className="node-hover-actions">
            <button
              className="node-btn"
              title="Rename"
              onClick={(e) => {
                e.stopPropagation();
                setRenamingId(item.id);
                setRenamingName(item.name);
              }}
            >
              <Edit2 size={12} />
            </button>
            <button
              className="node-btn delete-btn"
              title="Delete File"
              onClick={(e) => handleDeleteEntry(e, item)}
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      );
    });
  };

  return (
    <div className="vscode-editor-layout">
      {/* 1. TOP APPLICATION BAR (Modern Minimalist 40px) */}
      <div className="vscode-top-bar">
        <div className="top-bar-left">
          <div className="project-brand">
            <span className="brand-symbol">&lt;/&gt;</span>
            <span className="brand-name">{room.title || 'Workspace'}</span>
          </div>

          <div className="room-badge-compact" onClick={copyRoomCode} title="Click to copy room code">
            <span className="room-label">Room</span>
            <code>{room.roomCode}</code>
            {copyCodeSuccess ? <Check size={12} color="#4ade80" /> : <Copy size={12} color="#858585" />}
          </div>

          {room.visibility === 'PUBLIC' && (
            <span className="visibility-tag public" title="Public: visible to all team members">
              <Globe size={11} /> Team
            </span>
          )}

          {room.localDirHandle && (
            <span className="visibility-tag disk" title={`Synced directly with PC folder: ${room.localDirHandle.name}`}>
              <HardDrive size={11} /> PC Synced
            </span>
          )}
        </div>

        {/* Center: Command Palette / Search Quick Open Trigger */}
        <div className="top-bar-center" onClick={() => setShowQuickOpen(true)} title="Quick Open (⌘P / Ctrl+P)">
          <Search size={13} className="quick-search-icon" />
          <span className="quick-search-text">{room.title} &gt; Search files...</span>
          <kbd className="quick-search-kbd">⌘P</kbd>
        </div>

        {/* Right: Live Collaboration and Actions */}
        <div className="top-bar-right">
          <div className="live-status-indicator" title="STOMP Live Collaboration Active">
            <span className="live-pulse-dot" />
            <span className="live-text">Live</span>
          </div>

          <button
            className="collab-users-trigger"
            onClick={() => setShowCollabPopover(!showCollabPopover)}
            title="Active Participants (Click for details)"
          >
            <Users size={13} />
            <span>{participantsCount}</span>
          </button>

          <button
            className="close-workspace-btn"
            onClick={onCloseWorkspace}
            title="Return to Welcome Screen"
          >
            Close Folder
          </button>
        </div>
      </div>

      {/* 2. MAIN WORKSPACE MIDDLE (Activity Bar + Sidebar + Editor) */}
      <div className="vscode-main-area">
        {/* Left Activity Bar (48px VS Code style) */}
        <div className="vscode-activity-bar">
          <div className="activity-bar-top">
            <button
              className={`activity-btn ${activeActivity === 'explorer' ? 'active' : ''}`}
              title="Explorer (Files)"
              onClick={() => setActiveActivity('explorer')}
            >
              <Files size={19} />
            </button>
            <button
              className={`activity-btn ${activeActivity === 'search' ? 'active' : ''}`}
              title="Search (Quick Open)"
              onClick={() => {
                setActiveActivity('search');
                setShowQuickOpen(true);
              }}
            >
              <Search size={19} />
            </button>
            <button
              className={`activity-btn ${activeActivity === 'git' ? 'active' : ''}`}
              title="Source Control"
              onClick={() => setActiveActivity('git')}
            >
              <GitBranch size={19} />
            </button>
            <button
              className={`activity-btn ${activeActivity === 'debug' ? 'active' : ''}`}
              title="Run & Debug"
              onClick={() => setActiveActivity('debug')}
            >
              <Play size={19} />
            </button>
            <button
              className={`activity-btn ${activeActivity === 'extensions' ? 'active' : ''}`}
              title="Extensions"
              onClick={() => setActiveActivity('extensions')}
            >
              <Blocks size={19} />
            </button>
          </div>

          <div className="activity-bar-bottom">
            <button
              className={`activity-btn ${showBottomPanel ? 'active' : ''}`}
              title="Toggle Terminal Panel"
              onClick={() => setShowBottomPanel(!showBottomPanel)}
            >
              <TerminalIcon size={19} />
            </button>
            <button
              className="activity-btn"
              title={editorTheme === 'vs-dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
              onClick={() => setEditorTheme(editorTheme === 'vs-dark' ? 'light' : 'vs-dark')}
            >
              {editorTheme === 'vs-dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              className="activity-btn"
              title={`Logged in as @${user?.username || user?.name || 'Developer'}`}
              onClick={() => setShowTeamModal(true)}
            >
              <User size={18} />
            </button>
          </div>
        </div>

        {/* Primary Sidebar: File Explorer */}
        {activeActivity === 'explorer' && (
          <div className="vscode-sidebar">
            <div className="sidebar-header">
              <span className="sidebar-header-title">EXPLORER</span>
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
                  <FilePlus size={14} />
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
                  <FolderPlus size={14} />
                </button>
                <button
                  className="sidebar-action-btn"
                  title="Collapse All Folders"
                  onClick={() => setExpandedFolders(new Set())}
                >
                  <FolderTree size={14} />
                </button>
              </div>
            </div>

            {/* Folder Root Title */}
            <div className="sidebar-root-row">
              <ChevronDown size={14} />
              <span className="sidebar-root-title">{(room.title || 'WORKSPACE').toUpperCase()}</span>
            </div>

            <div className="file-tree-container">
              {creatingType && creatingTargetFolderId === null && (
                <form onSubmit={handleCreateEntry} className="inline-create-form" style={{ paddingLeft: '14px' }}>
                  <FileIcon isFolder={creatingType === 'folder'} isOpen={false} size={14} />
                  <input
                    type="text"
                    className="inline-create-input"
                    placeholder={`New ${creatingType} name...`}
                    value={newEntryName}
                    onChange={(e) => setNewEntryName(e.target.value)}
                    onBlur={() => setCreatingType(null)}
                    autoFocus
                  />
                </form>
              )}

              {renderTreeItems(null, 0)}

              {fileTree.length <= 1 && !creatingType && (
                <div className="tree-empty-prompt">
                  <p>Folder is empty.</p>
                  <p>Click <FilePlus size={13} style={{ display: 'inline', verticalAlign: 'middle' }} /> above to create a file.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Editor Main Content Pane */}
        <div className="vscode-editor-main">
          {/* Editor Tabs Bar (Modern Compact 36px) */}
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
                  <FileIcon filename={file.name} size={14} />
                  <span className="tab-name">{file.name}</span>
                  <button
                    className="tab-close-btn"
                    title="Close"
                    onClick={(e) => handleCloseTab(e, tabId)}
                  >
                    <X size={12} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Breadcrumbs Row (Clean 24px) */}
          <div className="editor-breadcrumbs">
            <span className="breadcrumb-root">{room.title || 'Workspace'}</span>
            {activeFile && (
              <>
                <ChevronRight size={12} className="breadcrumb-chevron" />
                <FileIcon filename={activeFile.name} size={13} />
                <span className="breadcrumb-file">{activeFile.name}</span>
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
                onMount={handleEditorDidMount}
                onChange={handleEditorChange}
                options={{
                  fontFamily: "JetBrains Mono, Menlo, Monaco, Consolas, 'Courier New', monospace",
                  fontSize: 13.5,
                  lineHeight: 22,
                  minimap: {
                    enabled: true,
                    maxColumn: 80,
                    renderCharacters: false,
                    scale: 1,
                  },
                  scrollBeyondLastLine: false,
                  smoothScrolling: true,
                  automaticLayout: true,
                  tabSize: 2,
                  wordWrap: 'on',
                  bracketPairColorization: { enabled: true },
                  cursorBlinking: 'smooth',
                  renderLineHighlight: 'all',
                  padding: { top: 8, bottom: 8 },
                }}
              />
            ) : (
              <div className="editor-empty-state">
                <div className="empty-state-symbol">&lt;/&gt;</div>
                <div className="empty-state-title">No File Open</div>
                <div className="empty-state-sub">Select a file from the explorer or create a new one to begin coding</div>
                <button
                  className="empty-create-btn"
                  onClick={() => {
                    setCreatingType('file');
                    setCreatingTargetFolderId(null);
                    setNewEntryName('');
                  }}
                >
                  <FilePlus size={14} /> Create File
                </button>
              </div>
            )}
          </div>

          {/* Collapsible Bottom Developer Panel (Terminal / Problems / Output) */}
          <BottomPanel
            isOpen={showBottomPanel}
            onClose={() => setShowBottomPanel(false)}
            activeTab={bottomPanelTab}
            onTabChange={(tab) => setBottomPanelTab(tab)}
            room={room}
            user={user}
          />
        </div>
      </div>

      {/* 3. STATUS BAR (VS Code Style 22px) */}
      <div className="vscode-status-bar">
        <div className="status-left">
          <div className="status-item" title="Git Branch: main">
            <GitBranch size={12} />
            <span>main</span>
          </div>

          <div className="status-item" title="0 Errors, 0 Warnings">
            <span>0</span>
            <span style={{ opacity: 0.6 }}>0</span>
          </div>

          <div className="status-item" title="STOMP Live Collaboration Active">
            <span className="status-dot-green" />
            <span>{isSynced ? 'Live Sync' : 'Connecting...'}</span>
          </div>

          {room.localDirHandle && (
            <div className="status-item disk-synced" title={`PC Disk Synced: ${room.localDirHandle.name}`}>
              <HardDrive size={11} />
              <span>PC: {room.localDirHandle.name}</span>
            </div>
          )}
        </div>

        <div className="status-right">
          {activeFile && (
            <div className="status-item" title="Cursor Line and Column">
              <span>Ln {cursorPos.line}, Col {cursorPos.col}</span>
            </div>
          )}

          <div className="status-item" title="Tab Spacing">
            <span>Spaces: 2</span>
          </div>

          <div className="status-item" title="Character Encoding">
            <span>UTF-8</span>
          </div>

          <div className="status-item" title="Line Sequence">
            <span>LF</span>
          </div>

          {activeFile && (
            <div className="status-item language-tag" title="File Language Mode">
              <span>{activeFile.language || 'plaintext'}</span>
            </div>
          )}

          <div
            className="status-item"
            title="Toggle Bottom Terminal Panel"
            onClick={() => setShowBottomPanel(!showBottomPanel)}
          >
            <TerminalIcon size={12} />
          </div>
        </div>
      </div>

      {/* Quick Open Modal (⌘P / Ctrl+P) */}
      <QuickOpenModal
        isOpen={showQuickOpen}
        onClose={() => setShowQuickOpen(false)}
        files={fileTree}
        onSelectFile={handleSelectFile}
      />

      {/* Collaboration Popover */}
      <CollabPopover
        isOpen={showCollabPopover}
        onClose={() => setShowCollabPopover(false)}
        room={room}
        user={user}
        participantsCount={participantsCount}
        activeFileName={activeFile?.name}
        onOpenTeamModal={() => setShowTeamModal(true)}
      />

      {/* Team Modal */}
      {showTeamModal && (
        <TeamModal
          user={user}
          onClose={() => setShowTeamModal(false)}
        />
      )}

      {/* Floating Status Toast */}
      {toastMessage && (
        <div className="vscode-toast">
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
