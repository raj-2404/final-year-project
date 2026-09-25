import React, { useState, useEffect, useRef, useCallback } from 'react';
import Editor, { DiffEditor } from '@monaco-editor/react';
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
  ChevronLeft,
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
  Eye,
  Save,
  Command,
} from 'lucide-react';

import { roomsApi } from '../../services/api';
import { stompService } from '../../services/stompService';
import { localFileSystem } from '../../services/localFileSystem';
import { filesystemService, gitService, platformService, isDesktopApp } from '../../services/native';
import FileIcon from './FileIcon';
import QuickOpenModal from './QuickOpenModal';
import CollabPopover from './CollabPopover';
import BottomPanel from './BottomPanel';
import SourceControlPanel from './SourceControlPanel';
import RunDebugPanel from './RunDebugPanel';
import CommandPaletteModal from './CommandPaletteModal';
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
    case 'rs': return 'rust';
    case 'xml': return 'xml';
    case 'yaml': case 'yml': return 'yaml';
    case 'toml': return 'toml';
    default: return 'plaintext';
  }
};

export default function VSCodeEditor({ room, user, onCloseWorkspace }) {
  const isDesktop = isDesktopApp();

  // Activity Bar active tab
  const [activeActivity, setActiveActivity] = useState('explorer'); // 'explorer' | 'search' | 'git' | 'debug' | 'extensions'

  // Tree state
  const [fileTree, setFileTree] = useState([]);
  const [activeFileId, setActiveFileId] = useState(null);
  const [openTabIds, setOpenTabIds] = useState([]);
  const [dirtyFileIds, setDirtyFileIds] = useState(new Set());
  const [expandedFolders, setExpandedFolders] = useState(new Set(['folder-root', 'folder-src']));
  const [isRootFolderCollapsed, setIsRootFolderCollapsed] = useState(false);

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
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showCollabPopover, setShowCollabPopover] = useState(false);
  const [showBottomPanel, setShowBottomPanel] = useState(false);
  const [bottomPanelTab, setBottomPanelTab] = useState('terminal');
  const [showTeamModal, setShowTeamModal] = useState(false);

  // Git State
  const [gitStatus, setGitStatus] = useState({
    is_repo: false,
    branch: '',
    ahead: 0,
    behind: 0,
    staged: [],
    unstaged: [],
    untracked: [],
  });
  const [diffFile, setDiffFile] = useState(null); // { path, original, modified, language, isStaged }

  // Disk Sync Status
  const [diskSyncStatus, setDiskSyncStatus] = useState(
    room.diskPath ? 'synced' : room.localDirHandle ? 'synced' : 'none'
  );

  // References
  const fileTreeRef = useRef(fileTree);
  fileTreeRef.current = fileTree;

  const activeFileIdRef = useRef(activeFileId);
  activeFileIdRef.current = activeFileId;

  const dirtyFileIdsRef = useRef(dirtyFileIds);
  dirtyFileIdsRef.current = dirtyFileIds;

  const localFileHandlesRef = useRef(room.localFileHandles || new Map());
  const localDirHandlesRef = useRef(room.localDirHandles || new Map());
  if (room.localDirHandle && !localDirHandlesRef.current.has('folder-root')) {
    localDirHandlesRef.current.set('folder-root', room.localDirHandle);
  }

  const saveTimerRef = useRef(null);
  const editorRef = useRef(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const persistTree = (updatedTree) => {
    if (!room.roomCode || room.roomCode.startsWith('local-')) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      roomsApi.updateTree(room.roomCode, JSON.stringify(updatedTree)).catch(console.error);
    }, 1500);
  };

  // Git Status refresher
  const refreshGitStatus = useCallback(async () => {
    if (!isDesktop || !room.diskPath) return;
    try {
      const st = await gitService.getStatus(room.diskPath);
      setGitStatus(st);
    } catch {}
  }, [isDesktop, room.diskPath]);

  // 1. Initial Load & Workspace Initialization
  useEffect(() => {
    let isMounted = true;

    async function initializeWorkspace() {
      try {
        let initialTree = [];

        // If local desktop folder opened with preloaded initialTree
        if (room.initialTree && Array.isArray(room.initialTree) && room.initialTree.length > 0) {
          initialTree = room.initialTree;
        } else if (room.diskPath && isDesktop) {
          try {
            initialTree = await filesystemService.listDirectory(room.diskPath);
          } catch {}
        }

        // Check remote backend if roomCode exists
        if ((!initialTree || initialTree.length === 0) && room.roomCode && !room.roomCode.startsWith('local-')) {
          try {
            const roomData = await roomsApi.getRoom(room.roomCode);
            if (roomData.codeContent && roomData.codeContent.trim().startsWith('[')) {
              initialTree = JSON.parse(roomData.codeContent);
            }
          } catch {}
        }

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

          // Load content if on desktop
          if (isDesktop && firstFile.path && firstFile.content === undefined) {
            filesystemService.readFile(firstFile.path).then((text) => {
              if (isMounted) {
                setFileTree((prev) =>
                  prev.map((item) => (item.id === firstFile.id ? { ...item, content: text } : item))
                );
              }
            }).catch(console.error);
          }
        }

        setIsSynced(true);
        refreshGitStatus();

        // 2. Connect to STOMP Broker for Live Real-Time Multi-User Collaboration (if not purely local)
        if (room.roomCode && !room.roomCode.startsWith('local-')) {
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

              // Real-time disk sync for browser folder links
              if (room.localDirHandle && localFileHandlesRef.current.has(data.fileId)) {
                const fileHandleObj = localFileHandlesRef.current.get(data.fileId);
                localFileSystem.writeFileToDisk(fileHandleObj.handle, data.code).then((ok) => {
                  if (ok) setDiskSyncStatus('synced');
                });
              }
            },
          });
        }
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
  }, [room.roomCode, room.diskPath]);

  // 2. Native File Watcher for Desktop
  useEffect(() => {
    if (!isDesktop || !room.diskPath) return;

    let unwatchFn = null;

    filesystemService
      .watchDirectory(room.diskPath, async (change) => {
        refreshGitStatus();

        if (activeFileIdRef.current) {
          const active = fileTreeRef.current.find((f) => f.id === activeFileIdRef.current);
          if (active && active.path && change.paths) {
            const normActive = active.path.replace(/\\/g, '/');
            const changedMatch = change.paths.some(
              (p) => p.replace(/\\/g, '/') === normActive
            );
            if (changedMatch) {
              if (!dirtyFileIdsRef.current.has(active.id)) {
                try {
                  const refreshed = await filesystemService.readFile(active.path);
                  setFileTree((prev) =>
                    prev.map((item) =>
                      item.id === active.id ? { ...item, content: refreshed } : item
                    )
                  );
                } catch {}
              } else {
                showToast(`External modification detected on "${active.name}"`);
              }
            }
          }
        }

        if (change.kind === 'create' || change.kind === 'remove') {
          try {
            const updated = await filesystemService.listDirectory(room.diskPath);
            setFileTree(updated);
          } catch {}
        }
      })
      .then((fn) => {
        unwatchFn = fn;
      })
      .catch(console.error);

    return () => {
      if (unwatchFn) unwatchFn();
    };
  }, [room.diskPath, isDesktop, refreshGitStatus]);

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

  // Local Code Editing in Monaco
  const handleEditorChange = (newCode) => {
    if (!activeFile) return;

    // Mark file as dirty
    setDirtyFileIds((prev) => new Set([...prev, activeFile.id]));

    const updatedTree = fileTree.map((item) =>
      item.id === activeFile.id ? { ...item, content: newCode } : item
    );
    setFileTree(updatedTree);

    // Write to disk if linked via Web File System Access API
    if (room.localDirHandle && localFileHandlesRef.current.has(activeFile.id)) {
      setDiskSyncStatus('saving');
      const fileHandleObj = localFileHandlesRef.current.get(activeFile.id);
      localFileSystem.writeFileToDisk(fileHandleObj.handle, newCode).then((ok) => {
        if (ok) setDiskSyncStatus('synced');
      });
    }

    // Broadcast live over STOMP
    if (room.roomCode && !room.roomCode.startsWith('local-')) {
      stompService.sendCodeChange(room.roomCode, activeFile.id, newCode);
    }

    // Persist tree debounced
    persistTree(updatedTree);
  };

  // Save active file to local disk (Cmd/Ctrl + S)
  const handleSaveActiveFile = async () => {
    if (!activeFile) return;

    if (isDesktop && activeFile.path) {
      try {
        await filesystemService.writeFile(activeFile.path, activeFile.content || '');
        setDirtyFileIds((prev) => {
          const next = new Set(prev);
          next.delete(activeFile.id);
          return next;
        });
        showToast(`Saved ${activeFile.name}`);
        refreshGitStatus();
      } catch (err) {
        showToast(`Failed to save: ${err.message || err}`);
      }
    } else if (room.localDirHandle && localFileHandlesRef.current.has(activeFile.id)) {
      const fileHandleObj = localFileHandlesRef.current.get(activeFile.id);
      await localFileSystem.writeFileToDisk(fileHandleObj.handle, activeFile.content || '');
      setDirtyFileIds((prev) => {
        const next = new Set(prev);
        next.delete(activeFile.id);
        return next;
      });
      showToast(`Saved ${activeFile.name}`);
    } else {
      setDirtyFileIds((prev) => {
        const next = new Set(prev);
        next.delete(activeFile.id);
        return next;
      });
      showToast(`Saved ${activeFile.name}`);
    }
  };

  // Save As (Cmd/Ctrl + Shift + S)
  const handleSaveAs = async () => {
    if (!activeFile || !isDesktop) return;
    try {
      const targetPath = await filesystemService.saveFileDialog(activeFile.name);
      if (!targetPath) return;
      await filesystemService.writeFile(targetPath, activeFile.content || '');
      showToast(`Saved as ${targetPath.split('/').pop()}`);
      if (room.diskPath) {
        const newTree = await filesystemService.listDirectory(room.diskPath);
        setFileTree(newTree);
        refreshGitStatus();
      }
    } catch (err) {
      showToast(`Save As error: ${err.message || err}`);
    }
  };

  // File / Folder Creation
  const handleCreateEntry = async (e) => {
    e.preventDefault();
    const name = newEntryName.trim();
    if (!name) {
      setCreatingType(null);
      return;
    }

    const targetParent = fileTree.find((f) => f.id === creatingTargetFolderId);
    const targetParentId = creatingTargetFolderId || (fileTree.some((f) => f.id === 'folder-root') ? 'folder-root' : null);

    let newPath = null;
    if (isDesktop && room.diskPath) {
      const parentDirPath = targetParent && targetParent.path ? targetParent.path : room.diskPath;
      newPath = `${parentDirPath.replace(/\\/g, '/')}/${name}`;
      try {
        if (creatingType === 'file') {
          await filesystemService.createFile(newPath);
        } else {
          await filesystemService.createFolder(newPath);
        }
        refreshGitStatus();
      } catch (err) {
        showToast(`Failed to create: ${err.message || err}`);
        setCreatingType(null);
        return;
      }
    }

    const newId = (creatingType === 'folder' ? 'folder-' : 'file-') + (newPath || Math.random().toString(36).substring(2, 9));

    const newEntry = {
      id: newId,
      name,
      type: creatingType,
      parentId: targetParentId,
      path: newPath,
      ...(creatingType === 'file'
        ? {
            language: getLanguageForFilename(name),
            content: '',
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

    if (room.roomCode && !room.roomCode.startsWith('local-')) {
      stompService.sendTreeChange(room.roomCode, 'FILE_CREATE', updatedTree, newId, user?.name || user?.username);
    }
    persistTree(updatedTree);

    setCreatingType(null);
    setNewEntryName('');
  };

  // Delete Entry
  const handleDeleteEntry = async (e, item) => {
    e.stopPropagation();
    if (!window.confirm(`Delete ${item.type} "${item.name}"? This action cannot be undone.`)) return;

    if (isDesktop && item.path) {
      try {
        await filesystemService.delete(item.path);
        refreshGitStatus();
      } catch (err) {
        showToast(`Failed to delete: ${err.message || err}`);
        return;
      }
    }

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
    setDirtyFileIds((prev) => {
      const next = new Set(prev);
      idsToRemove.forEach((id) => next.delete(id));
      return next;
    });

    if (room.roomCode && !room.roomCode.startsWith('local-')) {
      stompService.sendTreeChange(room.roomCode, 'FILE_DELETE', updatedTree, item.id, user?.name || user?.username);
    }
    persistTree(updatedTree);
  };

  // Rename Entry
  const handleRenameSubmit = async (e, item) => {
    e.preventDefault();
    const newName = renamingName.trim();
    if (!newName || newName === item.name) {
      setRenamingId(null);
      return;
    }

    let newPath = item.path;
    if (isDesktop && item.path) {
      const parts = item.path.replace(/\\/g, '/').split('/');
      parts[parts.length - 1] = newName;
      newPath = parts.join('/');
      try {
        await filesystemService.rename(item.path, newPath);
        refreshGitStatus();
      } catch (err) {
        showToast(`Failed to rename: ${err.message || err}`);
        setRenamingId(null);
        return;
      }
    }

    const updatedTree = fileTree.map((f) => {
      if (f.id === item.id) {
        return {
          ...f,
          name: newName,
          path: newPath,
          ...(f.type === 'file' ? { language: getLanguageForFilename(newName) } : {}),
        };
      }
      return f;
    });

    setFileTree(updatedTree);
    setRenamingId(null);

    if (room.roomCode && !room.roomCode.startsWith('local-')) {
      stompService.sendTreeChange(room.roomCode, 'FILE_RENAME', updatedTree, item.id, user?.name || user?.username);
    }
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

  // Selecting a file: load content on demand from disk if needed
  const handleSelectFile = async (file) => {
    setActiveFileId(file.id);
    setDiffFile(null); // Close diff if switching back to normal editor
    if (!openTabIds.includes(file.id)) {
      setOpenTabIds([...openTabIds, file.id]);
    }

    if (isDesktop && file.path && (file.content === undefined || file.content === null)) {
      try {
        const text = await filesystemService.readFile(file.path);
        setFileTree((prev) =>
          prev.map((item) => (item.id === file.id ? { ...item, content: text } : item))
        );
      } catch (err) {
        console.error('Failed to read file from disk:', err);
      }
    }
  };

  // Closing a Tab with dirty state check
  const handleCloseTab = async (e, tabId) => {
    e.stopPropagation();

    if (dirtyFileIds.has(tabId)) {
      const file = fileTree.find((f) => f.id === tabId);
      const fileName = file ? file.name : 'file';
      const shouldSave = window.confirm(
        `"${fileName}" has unsaved changes. Do you want to save before closing?\n\nClick OK to Save, or Cancel to discard and close.`
      );
      if (shouldSave) {
        if (file && file.path && isDesktop) {
          try {
            await filesystemService.writeFile(file.path, file.content || '');
            refreshGitStatus();
          } catch {}
        }
      }
      setDirtyFileIds((prev) => {
        const next = new Set(prev);
        next.delete(tabId);
        return next;
      });
    }

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

  // Close Folder with dirty state check
  const handleCloseWorkspace = () => {
    if (dirtyFileIds.size > 0) {
      const confirmClose = window.confirm(
        `You have unsaved changes in ${dirtyFileIds.size} file(s). Are you sure you want to close this folder?`
      );
      if (!confirmClose) return;
    }
    if (onCloseWorkspace) onCloseWorkspace();
  };

  // Open Git Diff
  const handleOpenDiff = async (filePath, staged = false) => {
    if (!isDesktop || !room.diskPath) return;
    try {
      const fullPath = filePath.startsWith('/') || filePath.includes(':')
        ? filePath
        : `${room.diskPath.replace(/\\/g, '/')}/${filePath}`;

      const modifiedContent = await filesystemService.readFile(fullPath).catch(() => '');
      const diffOutput = await gitService.diff(room.diskPath, filePath, staged).catch(() => '');

      setDiffFile({
        path: filePath,
        original: diffOutput ? `# Git Diff Output\n${diffOutput}` : modifiedContent,
        modified: modifiedContent,
        language: getLanguageForFilename(filePath),
        isStaged: staged,
      });
    } catch (err) {
      showToast(`Diff error: ${err.message || err}`);
    }
  };

  // Keyboard Shortcuts (Cmd/Ctrl + S, P, Shift+P, B, `, W)
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      const isCtrlOrMeta = e.metaKey || e.ctrlKey;

      // Cmd+Shift+P: Command Palette
      if (isCtrlOrMeta && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setShowCommandPalette(true);
        return;
      }

      // Cmd+P: Quick Open
      if (isCtrlOrMeta && !e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setShowQuickOpen(true);
        return;
      }

      // Cmd+Shift+S: Save As
      if (isCtrlOrMeta && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveAs();
        return;
      }

      // Cmd+S: Save
      if (isCtrlOrMeta && !e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveActiveFile();
        return;
      }

      // Cmd+B: Toggle Sidebar
      if (isCtrlOrMeta && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setActiveActivity((prev) => (prev ? null : 'explorer'));
        return;
      }

      // Cmd+`: Toggle Terminal Bottom Panel
      if (isCtrlOrMeta && (e.key === '`' || e.code === 'Backquote')) {
        e.preventDefault();
        setShowBottomPanel((prev) => !prev);
        return;
      }

      // Cmd+W: Close Editor Tab
      if (isCtrlOrMeta && e.key.toLowerCase() === 'w') {
        if (activeFileIdRef.current) {
          e.preventDefault();
          handleCloseTab(e, activeFileIdRef.current);
        }
        return;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [activeFile, handleSaveActiveFile, handleSaveAs, handleCloseTab]);

  const copyRoomCode = () => {
    navigator.clipboard.writeText(room.roomCode);
    setCopyCodeSuccess(true);
    showToast(`Room code ${room.roomCode} copied`);
    setTimeout(() => setCopyCodeSuccess(false), 2000);
  };

  // Commands for Command Palette
  const commandPaletteCommands = [
    {
      id: 'file.openFolder',
      label: 'File: Open Folder...',
      shortcut: '⌘O',
      icon: <HardDrive size={13} color="#60a5fa" />,
      action: async () => {
        if (isDesktop) {
          const folder = await filesystemService.pickFolder();
          if (folder) {
            window.location.reload();
          }
        }
      },
    },
    {
      id: 'file.save',
      label: 'File: Save',
      shortcut: '⌘S',
      icon: <Save size={13} color="#4ade80" />,
      action: handleSaveActiveFile,
    },
    {
      id: 'file.saveAs',
      label: 'File: Save As...',
      shortcut: '⇧⌘S',
      icon: <Save size={13} color="#60a5fa" />,
      action: handleSaveAs,
    },
    {
      id: 'view.toggleTerminal',
      label: 'View: Toggle Terminal Panel',
      shortcut: '⌘`',
      icon: <TerminalIcon size={13} color="#f59e0b" />,
      action: () => setShowBottomPanel((prev) => !prev),
    },
    {
      id: 'view.toggleSidebar',
      label: 'View: Toggle Primary Sidebar',
      shortcut: '⌘B',
      icon: <Files size={13} color="#a855f7" />,
      action: () => setActiveActivity((prev) => (prev ? null : 'explorer')),
    },
    {
      id: 'git.status',
      label: 'Git: Refresh Status',
      icon: <RotateCw size={13} color="#60a5fa" />,
      action: refreshGitStatus,
    },
    {
      id: 'git.stageAll',
      label: 'Git: Stage All Changes',
      icon: <GitBranch size={13} color="#4ade80" />,
      action: async () => {
        if (!room.diskPath) return;
        const unstaged = [...(gitStatus.unstaged || []), ...(gitStatus.untracked || [])];
        await gitService.stage(room.diskPath, unstaged.map((f) => f.path));
        refreshGitStatus();
        showToast('Staged all changes');
      },
    },
    {
      id: 'git.pull',
      label: 'Git: Pull Latest Changes',
      icon: <GitBranch size={13} color="#60a5fa" />,
      action: async () => {
        if (!room.diskPath) return;
        await gitService.pull(room.diskPath);
        refreshGitStatus();
        showToast('Pulled latest changes');
      },
    },
    {
      id: 'git.push',
      label: 'Git: Push Commits to Remote',
      icon: <GitBranch size={13} color="#4ade80" />,
      action: async () => {
        if (!room.diskPath) return;
        await gitService.push(room.diskPath);
        refreshGitStatus();
        showToast('Pushed commits to remote');
      },
    },
    {
      id: 'file.revealInFinder',
      label: 'File: Reveal in System File Manager',
      icon: <Eye size={13} color="#94a3b8" />,
      action: () => {
        if (activeFile?.path) {
          platformService.revealInFileManager(activeFile.path);
        }
      },
    },
    {
      id: 'workbench.switchTheme',
      label: 'Preferences: Toggle Dark / Light Theme',
      icon: editorTheme === 'vs-dark' ? <Sun size={13} color="#f59e0b" /> : <Moon size={13} color="#60a5fa" />,
      action: () => setEditorTheme((prev) => (prev === 'vs-dark' ? 'light' : 'vs-dark')),
    },
  ];

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

      // Match Git status for badge
      let gitStatusBadge = null;
      if (gitStatus && gitStatus.is_repo && item.path) {
        const normPath = item.path.replace(/\\/g, '/');
        if (gitStatus.staged?.some((s) => normPath.endsWith(s.path.replace(/\\/g, '/')))) {
          gitStatusBadge = 'S';
        } else if (gitStatus.unstaged?.some((u) => normPath.endsWith(u.path.replace(/\\/g, '/')))) {
          gitStatusBadge = 'M';
        } else if (gitStatus.untracked?.some((u) => normPath.endsWith(u.path.replace(/\\/g, '/')))) {
          gitStatusBadge = 'U';
        }
      }

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
                {isDesktop && item.path && (
                  <button
                    className="node-btn"
                    title="Reveal in System File Manager"
                    onClick={(e) => {
                      e.stopPropagation();
                      platformService.revealInFileManager(item.path);
                    }}
                  >
                    <Eye size={12} />
                  </button>
                )}
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

          {/* Git Status subtle indicator */}
          {gitStatusBadge && (
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                marginLeft: 'auto',
                marginRight: '6px',
                color:
                  gitStatusBadge === 'U'
                    ? '#22c55e'
                    : gitStatusBadge === 'M'
                    ? '#eab308'
                    : gitStatusBadge === 'S'
                    ? '#4ade80'
                    : '#ef4444',
              }}
            >
              {gitStatusBadge}
            </span>
          )}

          {/* Hover-only contextual CRUD actions */}
          <div className="node-hover-actions">
            {isDesktop && item.path && (
              <button
                className="node-btn"
                title="Reveal in System File Manager"
                onClick={(e) => {
                  e.stopPropagation();
                  platformService.revealInFileManager(item.path);
                }}
              >
                <Eye size={12} />
              </button>
            )}
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
      {/* 1. TOP APPLICATION BAR */}
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

          {(room.diskPath || room.localDirHandle) && (
            <span
              className="visibility-tag disk"
              title={`Local Machine Filesystem Active: ${room.diskPath || room.localDirHandle?.name}`}
            >
              <HardDrive size={11} /> {room.diskPath ? room.diskPath.replace(/\\/g, '/').split('/').pop() : room.localDirHandle?.name}
            </span>
          )}
        </div>

        {/* Center: Command Palette / Search Quick Open Trigger */}
        <div
          className="top-bar-center"
          onClick={() => setShowCommandPalette(true)}
          title="Command Palette (⇧⌘P / Ctrl+Shift+P) • Search files (⌘P)"
        >
          <Search size={13} className="quick-search-icon" />
          <span className="quick-search-text">{room.title} &gt; Search commands or files...</span>
          <kbd className="quick-search-kbd">⇧⌘P</kbd>
        </div>

        {/* Right: Live Collaboration and Actions */}
        <div className="top-bar-right">
          {room.roomCode && !room.roomCode.startsWith('local-') ? (
            <div className="live-status-indicator" title="STOMP Live Collaboration Active">
              <span className="live-pulse-dot" />
              <span className="live-text">Live</span>
            </div>
          ) : (
            <div className="live-status-indicator" title="Local Offline / Isolated Desktop Session">
              <span className="live-pulse-dot" style={{ backgroundColor: '#60a5fa' }} />
              <span className="live-text" style={{ color: '#60a5fa' }}>Local</span>
            </div>
          )}

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
            onClick={handleCloseWorkspace}
            title="Return to Welcome Screen"
          >
            Close Folder
          </button>
        </div>
      </div>

      {/* 2. MAIN WORKSPACE MIDDLE (Activity Bar + Sidebar + Editor) */}
      <div className="vscode-main-area">
        {/* Left Activity Bar */}
        <div className="vscode-activity-bar">
          <div className="activity-bar-top">
            <button
              className={`activity-btn ${activeActivity === 'explorer' ? 'active' : ''}`}
              title={activeActivity === 'explorer' ? 'Close Explorer (⌘B)' : 'Explorer (Files)'}
              onClick={() => setActiveActivity((prev) => (prev === 'explorer' ? null : 'explorer'))}
            >
              <Files size={19} />
            </button>
            <button
              className={`activity-btn ${activeActivity === 'search' ? 'active' : ''}`}
              title="Search Files (⌘P)"
              onClick={() => {
                setShowQuickOpen(true);
              }}
            >
              <Search size={19} />
            </button>
            <button
              className={`activity-btn ${activeActivity === 'git' ? 'active' : ''}`}
              title={activeActivity === 'git' ? 'Close Source Control' : 'Source Control'}
              onClick={() => setActiveActivity((prev) => (prev === 'git' ? null : 'git'))}
              style={{ position: 'relative' }}
            >
              <GitBranch size={19} />
              {gitStatus && (gitStatus.staged?.length > 0 || gitStatus.unstaged?.length > 0 || gitStatus.untracked?.length > 0) ? (
                <span
                  style={{
                    position: 'absolute',
                    top: '4px',
                    right: '6px',
                    backgroundColor: '#007acc',
                    color: '#ffffff',
                    fontSize: '9px',
                    fontWeight: 700,
                    borderRadius: '8px',
                    padding: '0 4px',
                    minWidth: '12px',
                    textAlign: 'center',
                  }}
                >
                  {(gitStatus.staged?.length || 0) + (gitStatus.unstaged?.length || 0) + (gitStatus.untracked?.length || 0)}
                </span>
              ) : null}
            </button>
            <button
              className={`activity-btn ${activeActivity === 'debug' ? 'active' : ''}`}
              title={activeActivity === 'debug' ? 'Close Run & Debug' : 'Run & Debug'}
              onClick={() => setActiveActivity((prev) => (prev === 'debug' ? null : 'debug'))}
            >
              <Play size={19} />
            </button>
            <button
              className={`activity-btn ${activeActivity === 'extensions' ? 'active' : ''}`}
              title={activeActivity === 'extensions' ? 'Close Extensions' : 'Extensions'}
              onClick={() => setActiveActivity((prev) => (prev === 'extensions' ? null : 'extensions'))}
            >
              <Blocks size={19} />
            </button>
          </div>

          <div className="activity-bar-bottom">
            <button
              className={`activity-btn ${showBottomPanel ? 'active' : ''}`}
              title="Toggle Terminal Panel (⌘`)"
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

        {/* Primary Sidebar Panels */}
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
                <button
                  className="sidebar-action-btn"
                  title="Close Sidebar (Hide Explorer)"
                  onClick={() => setActiveActivity(null)}
                >
                  <ChevronLeft size={14} />
                </button>
              </div>
            </div>

            {/* Folder Root Title */}
            <div
              className="sidebar-root-row"
              onClick={() => setIsRootFolderCollapsed((prev) => !prev)}
              style={{ cursor: 'pointer', userSelect: 'none' }}
              title={isRootFolderCollapsed ? 'Expand workspace folder' : 'Collapse workspace folder'}
            >
              {isRootFolderCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              <span className="sidebar-root-title">{(room.title || 'WORKSPACE').toUpperCase()}</span>
            </div>

            {!isRootFolderCollapsed && (
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
            )}
          </div>
        )}

        {activeActivity === 'git' && (
          <SourceControlPanel
            projectRoot={room.diskPath || null}
            gitStatus={gitStatus}
            onRefresh={refreshGitStatus}
            onOpenDiff={handleOpenDiff}
            onOpenFile={(path) => {
              const item = fileTree.find((f) => f.path === path || f.name === path);
              if (item) handleSelectFile(item);
            }}
            showToast={showToast}
          />
        )}

        {activeActivity === 'debug' && (
          <RunDebugPanel
            projectRoot={room.diskPath || null}
            onOpenBottomTab={(tab) => {
              setShowBottomPanel(true);
              setBottomPanelTab(tab);
            }}
            showToast={showToast}
          />
        )}

        {/* Editor Main Content Pane */}
        <div className="vscode-editor-main">
          {/* Editor Tabs Bar */}
          <div className="editor-tabs-bar">
            {openTabIds.map((tabId) => {
              const file = fileTree.find((f) => f.id === tabId);
              if (!file) return null;
              const isActive = activeFileId === tabId;
              const isDirty = dirtyFileIds.has(tabId);

              return (
                <div
                  key={tabId}
                  className={`editor-tab ${isActive ? 'active' : ''}`}
                  onClick={() => handleSelectFile(file)}
                >
                  <FileIcon filename={file.name} size={14} />
                  <span className="tab-name">
                    {file.name}
                    {isDirty && (
                      <span
                        style={{
                          marginLeft: '5px',
                          color: '#60a5fa',
                          fontWeight: 'bold',
                          fontSize: '11px',
                        }}
                      >
                        ●
                      </span>
                    )}
                  </span>
                  <button
                    className="tab-close-btn"
                    title={isDirty ? 'Unsaved changes' : 'Close Tab'}
                    onClick={(e) => handleCloseTab(e, tabId)}
                  >
                    <X size={12} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Breadcrumbs Row */}
          <div className="editor-breadcrumbs">
            <span className="breadcrumb-root">{room.title || 'Workspace'}</span>
            {activeFile && (
              <>
                <ChevronRight size={12} className="breadcrumb-chevron" />
                <FileIcon filename={activeFile.name} size={13} />
                <span className="breadcrumb-file">{activeFile.name}</span>
                {dirtyFileIds.has(activeFile.id) && (
                  <span style={{ color: '#60a5fa', fontSize: '11px', marginLeft: '6px' }}>
                    (Unsaved)
                  </span>
                )}
              </>
            )}
          </div>

          {/* Monaco Editor Pane or Diff Editor */}
          <div className="monaco-wrapper">
            {diffFile ? (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '4px 12px',
                    backgroundColor: '#1f1f1f',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    fontSize: '11.5px',
                    color: '#cccccc',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <GitBranch size={13} color="#60a5fa" />
                    <span>DIFF: <strong>{diffFile.path}</strong> ({diffFile.isStaged ? 'Staged vs HEAD' : 'Working Tree vs HEAD'})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDiffFile(null)}
                    style={{
                      backgroundColor: 'transparent',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: '#ffffff',
                      borderRadius: '3px',
                      padding: '2px 8px',
                      fontSize: '11px',
                      cursor: 'pointer',
                    }}
                  >
                    Close Diff
                  </button>
                </div>
                <div style={{ flex: 1, minHeight: 0 }}>
                  <DiffEditor
                    height="100%"
                    theme={editorTheme}
                    language={diffFile.language || 'plaintext'}
                    original={diffFile.original}
                    modified={diffFile.modified}
                    options={{
                      readOnly: true,
                      automaticLayout: true,
                      minimap: { enabled: false },
                      renderSideBySide: true,
                    }}
                  />
                </div>
              </div>
            ) : activeFile ? (
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

          {/* Collapsible Bottom Developer Panel (Terminal / Problems / Output / Debug) */}
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

      {/* 3. STATUS BAR */}
      <div className="vscode-status-bar">
        <div className="status-left">
          <div
            className="status-item"
            title={`Git Branch: ${gitStatus?.branch || 'main'}`}
            onClick={() => setActiveActivity('git')}
            style={{ cursor: 'pointer' }}
          >
            <GitBranch size={12} />
            <span>{gitStatus?.branch || 'main'}</span>
            {gitStatus?.ahead > 0 && <span style={{ marginLeft: '3px', color: '#4ade80' }}>↑{gitStatus.ahead}</span>}
            {gitStatus?.behind > 0 && <span style={{ marginLeft: '3px', color: '#f87171' }}>↓{gitStatus.behind}</span>}
          </div>

          <div className="status-item" title="0 Errors, 0 Warnings">
            <span>0</span>
            <span style={{ opacity: 0.6 }}>0</span>
          </div>

          <div className="status-item" title="Collaboration / Session Status">
            <span className="status-dot-green" />
            <span>{isSynced ? 'Live Sync' : 'Connecting...'}</span>
          </div>

          {(room.diskPath || room.localDirHandle) && (
            <div
              className="status-item disk-synced"
              title={`Physical Disk Workspace: ${room.diskPath || room.localDirHandle?.name}`}
            >
              <HardDrive size={11} />
              <span>{room.diskPath ? room.diskPath.replace(/\\/g, '/').split('/').pop() : room.localDirHandle?.name}</span>
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
            title="Toggle Bottom Terminal Panel (⌘`)"
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

      {/* Command Palette Modal (⇧⌘P / Ctrl+Shift+P) */}
      <CommandPaletteModal
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        commands={commandPaletteCommands}
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
