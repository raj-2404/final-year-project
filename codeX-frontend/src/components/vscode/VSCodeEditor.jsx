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
  Bug,
  Pause,
  ArrowRight,
  ArrowDown,
  ArrowUp,
  Square,
  Circle,
  FlaskConical,
  ShieldCheck,
  Lightbulb,
  Wand2,
  FolderOpen,
  PlusSquare,
  MinusCircle,
  FolderGit2,
  GitCommit,
  RotateCcw,
} from 'lucide-react';

import { roomsApi } from '../../services/api';
import { stompService } from '../../services/stompService';
import { localFileSystem } from '../../services/localFileSystem';
import { filesystemService, gitService, platformService, workspaceService, isDesktopApp } from '../../services/native';
import {
  workspaceManager,
  workspaceFiles,
  workspaceEvents,
  WorkspaceEventType,
  WorkspaceModel,
} from '../../workspace';
import ExplorerPanel from '../explorer/ExplorerPanel';
import RecentWorkspacesModal from '../explorer/RecentWorkspacesModal';
import FileIcon from './FileIcon';
import QuickOpenModal from './QuickOpenModal';
import CollabPopover from './CollabPopover';
import BottomPanel from './BottomPanel';
import SourceControlPanel from './SourceControlPanel';
import GitHistoryModal from './GitHistoryModal';
import RunDebugPanel from './RunDebugPanel';
import TestExplorerPanel from './TestExplorerPanel';
import CoveragePanel from './CoveragePanel';
import RefactorPreviewModal from './RefactorPreviewModal';
import CommandPaletteModal from './CommandPaletteModal';
import TeamModal from '../team/TeamModal';
import './VSCode.css';
import { gitManager, gitDiff, gitBranches, gitStash, gitHistory } from '../../git';
import {
  getLanguageForFilename,
  getLanguageLabel,
  themeManager,
  CODEX_DARK_THEME_NAME,
  getEditorOptions,
  languageService,
  modelManager,
  languageProviderRegistry,
  codeActionManager,
} from '../../editor';
import { debuggerManager, breakpointManager } from '../../debugger';
import DebugToolbar from './DebugToolbar';
import { buildManager, runManager } from '../../build';
import { testManager } from '../../testing';
import { coverageManager, coverageDecorations } from '../../coverage';

export default function VSCodeEditor({ room, user, onCloseWorkspace }) {
  const isDesktop = isDesktopApp();
  const isOffline = Boolean(
    room.isOffline ||
    !room.roomCode ||
    room.roomCode.startsWith('local-')
  );

  const isApplyingRemoteRef = useRef(false);

  // Activity Bar active tab (persisted in sessionStorage)
  const [activeActivity, setActiveActivity] = useState(() => {
    try {
      return sessionStorage.getItem('codex_active_activity') || 'explorer';
    } catch {
      return 'explorer';
    }
  });

  // Tree state (persisted in sessionStorage)
  const [fileTree, setFileTree] = useState([]);
  const [activeFileId, setActiveFileId] = useState(() => {
    try {
      return sessionStorage.getItem('codex_active_file') || null;
    } catch {
      return null;
    }
  });
  const [openTabIds, setOpenTabIds] = useState(() => {
    try {
      const saved = sessionStorage.getItem('codex_open_tabs');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [dirtyFileIds, setDirtyFileIds] = useState(new Set());
  const [expandedFolders, setExpandedFolders] = useState(() => {
    try {
      const saved = sessionStorage.getItem('codex_expanded_folders');
      if (saved) return new Set(JSON.parse(saved));
    } catch {}
    return new Set(['folder-root', 'folder-src']);
  });
  const [isRootFolderCollapsed, setIsRootFolderCollapsed] = useState(false);

  // Inline creation & rename states
  const [creatingType, setCreatingType] = useState(null); // 'file' | 'folder' | null
  const [creatingTargetFolderId, setCreatingTargetFolderId] = useState(null);
  const [newEntryName, setNewEntryName] = useState('');
  const [renamingId, setRenamingId] = useState(null);
  const [renamingName, setRenamingName] = useState('');

  // Editor cursor & language state
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [editorTheme, setEditorTheme] = useState(CODEX_DARK_THEME_NAME);
  const [diagnosticsCount, setDiagnosticsCount] = useState({ errors: 0, warnings: 0 });
  const [diagnosticsMarkers, setDiagnosticsMarkers] = useState([]);

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
  const [showGitHistory, setShowGitHistory] = useState(false);
  const [currentWorkspace, setCurrentWorkspace] = useState(workspaceManager.getWorkspace());
  const [showRecentWorkspaces, setShowRecentWorkspaces] = useState(false);

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

  // Persist editor session state to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem('codex_active_activity', activeActivity);
    } catch {}
  }, [activeActivity]);

  useEffect(() => {
    try {
      if (activeFileId) {
        sessionStorage.setItem('codex_active_file', activeFileId);
      } else {
        sessionStorage.removeItem('codex_active_file');
      }
    } catch {}
  }, [activeFileId]);

  useEffect(() => {
    try {
      if (openTabIds && openTabIds.length > 0) {
        sessionStorage.setItem('codex_open_tabs', JSON.stringify(openTabIds));
      } else {
        sessionStorage.removeItem('codex_open_tabs');
      }
    } catch {}
  }, [openTabIds]);

  useEffect(() => {
    try {
      if (expandedFolders && expandedFolders.size > 0) {
        sessionStorage.setItem('codex_expanded_folders', JSON.stringify(Array.from(expandedFolders)));
      }
    } catch {}
  }, [expandedFolders]);

  // Keep sessionStorage updated with the latest in-memory file tree
  useEffect(() => {
    if (!fileTree || fileTree.length === 0) return;
    try {
      const raw = sessionStorage.getItem('codex_current_workspace');
      if (raw) {
        const parsed = JSON.parse(raw);
        parsed.initialTree = fileTree;
        sessionStorage.setItem('codex_current_workspace', JSON.stringify(parsed));
      }
    } catch {}
  }, [fileTree]);

  const saveTimerRef = useRef(null);
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const handleSelectFileRef = useRef(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const persistTree = (updatedTree) => {
    if (isOffline || !room.roomCode || room.roomCode.startsWith('local-')) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      roomsApi.updateTree(room.roomCode, JSON.stringify(updatedTree)).catch(console.error);
    }, 1500);
  };

  // Git Status refresher
  const refreshGitStatus = useCallback(async () => {
    if (!isDesktop || !room.diskPath) return;
    try {
      let activeRepo = gitManager.getActiveRepository();
      if (!activeRepo) {
        await gitManager.discoverWorkspaceRepositories(room.diskPath);
        activeRepo = gitManager.getActiveRepository();
      }
      if (activeRepo) {
        await activeRepo.refresh();
        setGitStatus(activeRepo.status);
      } else {
        const st = await gitService.getStatus(room.diskPath);
        setGitStatus(st);
      }
    } catch {}
  }, [isDesktop, room.diskPath]);

  // Refresh Explorer for all workspace folders (debounced to avoid thrashing)
  const refreshExplorerTimerRef = useRef(null);
  const handleRefreshExplorer = useCallback(() => {
    if (!isDesktop) return;
    if (refreshExplorerTimerRef.current) clearTimeout(refreshExplorerTimerRef.current);
    refreshExplorerTimerRef.current = setTimeout(async () => {
      try {
        const ws = workspaceManager.getWorkspace();
        const folders = ws?.folders?.length ? ws.folders : (room.diskPath ? [{ path: room.diskPath }] : []);
        let allItems = [];
        for (const folder of folders) {
          const items = await workspaceFiles.listDirectory(folder.path, false, 6);
          allItems = [...allItems, ...items];
        }
        if (allItems.length > 0) {
          setFileTree((prevTree) => {
            const contentMap = new Map();
            prevTree.forEach((item) => {
              if (item.content !== undefined) contentMap.set(item.path || item.id, item.content);
            });
            return allItems.map((item) => {
              const existing = contentMap.get(item.path || item.id);
              return existing !== undefined ? { ...item, content: existing } : item;
            });
          });
        }
        refreshGitStatus();
      } catch (err) {
        console.warn('Failed to refresh explorer:', err);
      }
    }, 250);
  }, [isDesktop, room.diskPath, refreshGitStatus]);

  // Workspace Dialog Handlers
  const handleOpenFilePicker = async () => {
    if (!isDesktop) return;
    try {
      const file = await filesystemService.pickFile();
      if (file) {
        const content = await workspaceFiles.readFile(file).catch(() => '');
        const fileName = file.split('/').filter(Boolean).pop() || 'file';
        const fileEntry = {
          id: `file-${file}`,
          name: fileName,
          path: file,
          content,
          type: 'file',
        };
        handleSelectFile(fileEntry);
      }
    } catch (err) {
      showToast(`Open file error: ${err.message || err}`);
    }
  };

  const handleOpenFolderDialog = async () => {
    if (!isDesktop) return;
    try {
      const folder = await workspaceService.openFolder();
      if (folder) {
        const ws = await workspaceManager.openFolder(folder);
        setCurrentWorkspace(ws);
        room.diskPath = folder;
        await handleRefreshExplorer();
        showToast(`Opened folder: ${folder}`);
      }
    } catch (err) {
      showToast(`Open folder error: ${err.message || err}`);
    }
  };

  const handleOpenWorkspaceDialog = async () => {
    if (!isDesktop) return;
    try {
      const wsFile = await workspaceService.openWorkspaceFile();
      if (wsFile) {
        const ws = await workspaceManager.openWorkspace(wsFile);
        setCurrentWorkspace(ws);
        await handleRefreshExplorer();
        showToast(`Opened workspace: ${ws.name}`);
      }
    } catch (err) {
      showToast(`Open workspace error: ${err.message || err}`);
    }
  };

  const handleSaveWorkspaceDialog = async () => {
    if (!isDesktop) return;
    try {
      const target = await workspaceService.saveWorkspaceDialog(`${currentWorkspace?.name || 'project'}.codex-workspace`);
      if (target) {
        await workspaceManager.saveWorkspace(target);
        showToast(`Saved workspace to ${target}`);
      }
    } catch (err) {
      showToast(`Save workspace error: ${err.message || err}`);
    }
  };

  const handleAddFolderDialog = async () => {
    if (!isDesktop) return;
    try {
      const folder = await workspaceService.openFolder();
      if (folder) {
        await workspaceManager.addWorkspaceFolder(folder);
        setCurrentWorkspace(workspaceManager.getWorkspace());
        await handleRefreshExplorer();
        showToast(`Added folder to workspace: ${folder}`);
      }
    } catch (err) {
      showToast(`Add folder error: ${err.message || err}`);
    }
  };

  const handleRemoveFolderDialog = async () => {
    if (!currentWorkspace || currentWorkspace.folders.length <= 1) {
      showToast('Cannot remove root folder of single-folder workspace.');
      return;
    }
    const folderNames = currentWorkspace.folders.map((f) => f.name).join(', ');
    const name = window.prompt(`Enter folder name to remove from workspace (${folderNames}):`);
    if (!name) return;
    const match = currentWorkspace.folders.find((f) => f.name.toLowerCase() === name.trim().toLowerCase());
    if (match) {
      await workspaceManager.removeWorkspaceFolder(match.path);
      setCurrentWorkspace(workspaceManager.getWorkspace());
      await handleRefreshExplorer();
      showToast(`Removed folder: ${match.name}`);
    } else {
      showToast(`Folder "${name}" not found in workspace.`);
    }
  };

  const handleRenameWorkspace = () => {
    const newName = window.prompt('Enter new workspace name:', currentWorkspace?.name || 'Workspace');
    if (newName && newName.trim()) {
      workspaceManager.renameWorkspace(newName.trim());
      setCurrentWorkspace(workspaceManager.getWorkspace());
      showToast(`Renamed workspace to "${newName.trim()}"`);
    }
  };

  const handleReloadWorkspace = async () => {
    try {
      await workspaceManager.reloadWorkspace();
      await handleRefreshExplorer();
      showToast('Workspace reloaded');
    } catch (err) {
      showToast(`Reload error: ${err.message || err}`);
    }
  };

  const handleClearRecentWorkspaces = () => {
    workspaceManager.clearRecentWorkspaces();
    showToast('Cleared recent workspaces');
  };

  const handleOpenWorkspaceFromPath = async (targetPath) => {
    if (!targetPath) return;
    try {
      if (targetPath.endsWith('.codex-workspace')) {
        const ws = await workspaceManager.openWorkspace(targetPath);
        setCurrentWorkspace(ws);
        await handleRefreshExplorer();
        showToast(`Opened workspace: ${ws.name}`);
      } else {
        const ws = await workspaceManager.openFolder(targetPath);
        setCurrentWorkspace(ws);
        room.diskPath = targetPath;
        await handleRefreshExplorer();
        showToast(`Opened folder: ${targetPath}`);
      }
    } catch (err) {
      showToast(`Open error: ${err.message || err}`);
    }
  };

  // Debugger Toolbar & Execution State
  const [debugToolbarState, setDebugToolbarState] = useState({
    isDebugging: false,
    sessionState: 'stopped',
    activeFrame: null,
  });

  useEffect(() => {
    const unsub = debuggerManager.onStateChange((state) => {
      setDebugToolbarState({
        isDebugging: state.isDebugging,
        sessionState: state.sessionState,
        activeFrame: state.activeFrame,
      });
    });
    return () => {
      unsub();
      debuggerManager.dispose();
    };
  }, []);

  // Refactoring Preview Modal State
  const [refactorPreview, setRefactorPreview] = useState(null);

  useEffect(() => {
    return codeActionManager.onPreviewChange((preview) => {
      setRefactorPreview(preview);
    });
  }, []);

  // 1. Initial Load & Workspace Initialization
  useEffect(() => {
    let isMounted = true;

    async function initializeWorkspace() {
      try {
        let initialTree = [];

        // 1. If opening a local folder on Desktop, ALWAYS open and register with workspaceManager
        if (room.diskPath && isDesktop) {
          try {
            const ws = await workspaceManager.openFolder(room.diskPath);
            if (ws) setCurrentWorkspace(ws);
          } catch (e) {
            console.warn('[VSCodeEditor] Could not open folder in workspaceManager:', e);
          }
        }

        // 2. Load initialTree: from preloaded room prop or directly from disk
        if (room.initialTree && Array.isArray(room.initialTree) && room.initialTree.length > 0) {
          initialTree = room.initialTree;
        } else if (room.diskPath && isDesktop) {
          try {
            initialTree = await filesystemService.listDirectory(room.diskPath);
          } catch {}
        }

        // 3. Check remote backend if roomCode exists and online
        let roomData = null;
        if (!isOffline && room.roomCode && !room.roomCode.startsWith('local-')) {
          try {
            roomData = await roomsApi.getRoom(room.roomCode);
            if (roomData?.codeContent && roomData.codeContent.trim().startsWith('[')) {
              const parsed = JSON.parse(roomData.codeContent);
              if (Array.isArray(parsed) && parsed.length > 0) {
                if (!initialTree || initialTree.length === 0) {
                  initialTree = parsed;
                } else {
                  // Merge contents from remote roomData into initialTree
                  const contentMap = new Map();
                  for (const p of parsed) {
                    if (p.id && p.content !== undefined && p.content !== null) {
                      contentMap.set(p.id, p.content);
                    }
                  }
                  initialTree = initialTree.map((item) => {
                    if (item.type === 'file' && (item.content === undefined || item.content === null) && contentMap.has(item.id)) {
                      return { ...item, content: contentMap.get(item.id) };
                    }
                    return item;
                  });
                }
              }
            }
          } catch (e) {
            console.warn('[VSCodeEditor] Could not fetch remote room:', e);
          }
        }

        // 4. For Desktop: If joining a remote workspace without a local disk path, allocate local folder and materialize files
        if (isDesktop && !room.diskPath) {
          try {
            const folderTitle = room.title || roomData?.title || 'CodeX-Project';
            const created = await filesystemService.createProjectFolder(folderTitle);
            if (created) {
              room.diskPath = created;
              try {
                const ws = await workspaceManager.openFolder(created);
                if (ws) setCurrentWorkspace(ws);
              } catch {}

              // Materialize remote files onto local PC disk so local tools (LSP, DAP, terminal) work
              if (initialTree && initialTree.length > 0) {
                for (const item of initialTree) {
                  if (item.type === 'file' && item.name) {
                    const localPath = `${created}/${item.name}`.replace(/\/+/g, '/');
                    item.path = localPath;
                    if (item.content !== undefined && item.content !== null) {
                      await filesystemService.writeFile(localPath, item.content).catch(() => {});
                    }
                  } else if (item.type === 'folder' && item.name && item.id !== 'folder-root') {
                    const localPath = `${created}/${item.name}`.replace(/\/+/g, '/');
                    item.path = localPath;
                    await filesystemService.createFolder(localPath).catch(() => {});
                  }
                }
              } else {
                try {
                  initialTree = await filesystemService.listDirectory(created);
                } catch {}
              }
            }
          } catch (e) {
            console.warn('[VSCodeEditor] Auto-allocate project directory error:', e);
          }
        }

        // 5. For Web / Browser mode or remote rooms: create a virtual WorkspaceModel so workspace state and folders are fully initialized
        if (!isDesktop || !room.diskPath) {
          const virtualName = room.title || roomData?.title || 'Workspace';
          const virtualModel = new WorkspaceModel({
            id: `ws-${room.roomCode || 'virtual'}`,
            name: virtualName,
            root: 'workspace',
            folders: [
              {
                id: 'virtual-root',
                name: virtualName,
                path: 'workspace',
              },
            ],
            isMultiRoot: false,
          });
          setCurrentWorkspace(virtualModel);
        }

        if (!initialTree || initialTree.length === 0) {
          initialTree = [
            {
              id: 'folder-root',
              name: room.title || roomData?.title || 'Workspace',
              type: 'folder',
              parentId: null,
              path: room.diskPath || null,
            },
          ];
        }

        if (!isMounted) return;

        setFileTree(initialTree);

        // Check if there are preserved open tabs & active file in sessionStorage
        let restoredActiveId = null;
        let restoredTabs = [];
        try {
          restoredActiveId = sessionStorage.getItem('codex_active_file');
          const rawTabs = sessionStorage.getItem('codex_open_tabs');
          if (rawTabs) restoredTabs = JSON.parse(rawTabs);
        } catch {}

        const validTabs = Array.isArray(restoredTabs)
          ? restoredTabs.filter((id) => initialTree.some((item) => item.id === id && item.type === 'file'))
          : [];

        let targetActiveFile = null;
        if (validTabs.length > 0) {
          setOpenTabIds(validTabs);
          if (restoredActiveId && validTabs.includes(restoredActiveId)) {
            setActiveFileId(restoredActiveId);
            targetActiveFile = initialTree.find((item) => item.id === restoredActiveId);
          } else {
            setActiveFileId(validTabs[0]);
            targetActiveFile = initialTree.find((item) => item.id === validTabs[0]);
          }
        } else {
          const firstFile = initialTree.find((item) => item.type === 'file');
          if (firstFile) {
            setActiveFileId(firstFile.id);
            setOpenTabIds([firstFile.id]);
            targetActiveFile = firstFile;
          }
        }

        // Load content if on desktop or web if missing
        if (targetActiveFile && (targetActiveFile.content === undefined || targetActiveFile.content === null)) {
          if (isDesktop && targetActiveFile.path) {
            filesystemService.readFile(targetActiveFile.path).then((text) => {
              if (isMounted) {
                setFileTree((prev) =>
                  prev.map((item) => (item.id === targetActiveFile.id ? { ...item, content: text } : item))
                );
              }
            }).catch(console.error);
          } else if (!isDesktop && (targetActiveFile.content === undefined || targetActiveFile.content === null) && room.roomCode && !room.roomCode.startsWith('local-')) {
            // Web / browser: load content for active file if missing
            roomsApi.getFileContent(room.roomCode, targetActiveFile.id, targetActiveFile.path).then((res) => {
              if (res?.content !== undefined && isMounted) {
                setFileTree((prev) =>
                  prev.map((item) => (item.id === targetActiveFile.id ? { ...item, content: res.content } : item))
                );
              }
            }).catch(() => {});
          }
        }

        // On Desktop with local folder: asynchronously preload files < 300KB so web peers get code
        if (isDesktop && room.diskPath) {
          setTimeout(async () => {
            try {
              let updatedAny = false;
              const currentList = fileTreeRef.current && fileTreeRef.current.length > 0 ? fileTreeRef.current : initialTree;
              const loadedTree = await Promise.all(
                currentList.map(async (item) => {
                  if (item.type === 'file' && item.path && (item.content === undefined || item.content === null) && (!item.size || item.size < 300000)) {
                    try {
                      const text = await filesystemService.readFile(item.path);
                      updatedAny = true;
                      return { ...item, content: text };
                    } catch {
                      return item;
                    }
                  }
                  return item;
                })
              );
              if (updatedAny && isMounted) {
                setFileTree(loadedTree);
                if (!isOffline && room.roomCode && !room.roomCode.startsWith('local-')) {
                  stompService.sendTreeChange(room.roomCode, 'SYNC', loadedTree, activeFileIdRef.current, user?.name || user?.username);
                }
              }
            } catch (err) {
              console.warn('[VSCodeEditor] Background preload error:', err);
            }
          }, 400);
        }

        setIsSynced(true);
        refreshGitStatus();

        // 4. Connect to STOMP Broker for Live Real-Time Multi-User Collaboration (if online)
        if (!isOffline && room.roomCode && !room.roomCode.startsWith('local-')) {
          await stompService.connect(room.roomCode, {
            userName: user?.name || user?.username || 'Developer',

            onConnected: () => {
              // If we have files in our tree, broadcast SYNC snapshot so joiners receive them
              if (fileTreeRef.current && fileTreeRef.current.length > 1) {
                stompService.sendTreeChange(room.roomCode, 'SYNC', fileTreeRef.current, activeFileIdRef.current, user?.name || user?.username);
              } else {
                // Otherwise request sync from server/peers
                stompService.requestTreeSync(room.roomCode, user?.name || user?.username);
              }
            },

            onPresence: (data) => {
              if (data?.usersCount !== undefined) {
                setParticipantsCount(data.usersCount);
              }
              if (data?.type === 'JOIN' && data?.senderName && data.senderName !== (user?.name || user?.username)) {
                showToast(`${data.senderName} joined workspace`);
                // Host sends current tree snapshot to the new joiner
                if (fileTreeRef.current && fileTreeRef.current.length > 1) {
                  stompService.sendTreeChange(room.roomCode, 'SYNC', fileTreeRef.current, activeFileIdRef.current, user?.name || user?.username);
                }
              } else if (data?.type === 'LEAVE') {
                showToast('A teammate left workspace');
              }
            },

            onTreeChange: (data) => {
              if (data.senderId === stompService.getClientId()) return;

              try {
                const remoteTree = JSON.parse(data.fileTreeJson);
                if (Array.isArray(remoteTree)) {
                  setFileTree((prevTree) => {
                    const contentMap = new Map();
                    for (const item of prevTree) {
                      if (item.id && item.content !== undefined && item.content !== null) {
                        contentMap.set(item.id, item.content);
                      }
                    }
                    return remoteTree.map((item) => {
                      if (item.type === 'file' && (item.content === undefined || item.content === null) && contentMap.has(item.id)) {
                        return { ...item, content: contentMap.get(item.id) };
                      }
                      return item;
                    });
                  });
                  setIsSynced(true);
                  if (data.type !== 'SYNC') {
                    showToast(`Folders updated (${data.type})`);
                  }

                  // If on desktop and room has local folder, ensure remote files exist on local disk and have proper paths
                  if (isDesktop && room.diskPath) {
                    const cleanDiskPath = room.diskPath.replace(/\\/g, '/').replace(/\/+$/, '');
                    for (const item of remoteTree) {
                      if (!item.path || !item.path.startsWith(cleanDiskPath)) {
                        item.path = `${cleanDiskPath}/${item.name || ''}`.replace(/\/+/g, '/');
                      }
                      if (item.type === 'file' && item.name && item.content !== undefined) {
                        workspaceManager.recordInternalWrite(item.path);
                        filesystemService.writeFile(item.path, item.content).catch(() => {});
                      }
                    }
                  }

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

              // Flexible matcher: checks id, path, normalized path without /private, and filename
              const matchesIncoming = (item) => {
                if (!item) return false;
                if (data.fileId && (item.id === data.fileId || item.path === data.fileId)) return true;
                if (data.filePath && (item.path === data.filePath || item.id === data.filePath)) return true;
                if (item.path && data.filePath) {
                  const normItem = item.path.replace(/\\/g, '/').replace(/^\/private/, '').replace(/\/+$/, '');
                  const normData = data.filePath.replace(/\\/g, '/').replace(/^\/private/, '').replace(/\/+$/, '');
                  if (normItem === normData || normItem.endsWith('/' + normData) || normData.endsWith('/' + normItem)) return true;
                }
                const targetName = data.fileName || (data.filePath ? data.filePath.split('/').filter(Boolean).pop() : null) || (data.fileId ? data.fileId.split('/').filter(Boolean).pop() : null);
                if (targetName && (item.name === targetName || item.id?.endsWith('/' + targetName) || item.path?.endsWith('/' + targetName))) {
                  return true;
                }
                return false;
              };

              // 1. Update in-memory file content
              setFileTree((prevTree) =>
                prevTree.map((item) =>
                  matchesIncoming(item) ? { ...item, content: data.code } : item
                )
              );

              // 2. Direct model update for active file without tearing down editor, jumping cursor, or triggering echo loop
              const currentActiveFile = fileTreeRef.current?.find((f) => f.id === activeFileIdRef.current || f.path === activeFileIdRef.current) || activeFile;
              if (matchesIncoming(currentActiveFile) && editorRef.current) {
                const model = editorRef.current.getModel();
                if (model && model.getValue() !== data.code) {
                  const selection = editorRef.current.getSelection();
                  isApplyingRemoteRef.current = true;
                  try {
                    model.setValue(data.code);
                  } finally {
                    isApplyingRemoteRef.current = false;
                  }
                  if (selection) {
                    try {
                      editorRef.current.setSelection(selection);
                    } catch {}
                  }
                }
              }

              // 3. Real-time disk sync for desktop host (record internal write to avoid watcher thrashing)
              if (isDesktop && room.diskPath) {
                const fileItem = fileTreeRef.current?.find((f) => matchesIncoming(f));
                if (fileItem?.path) {
                  workspaceManager.recordInternalWrite(fileItem.path);
                  filesystemService.writeFile(fileItem.path, data.code).catch(() => {});
                }
              }

              // 4. Real-time disk sync for browser folder links
              if (room.localDirHandle) {
                const fileItem = fileTreeRef.current?.find((f) => matchesIncoming(f));
                if (fileItem && localFileHandlesRef.current.has(fileItem.id)) {
                  const fileHandleObj = localFileHandlesRef.current.get(fileItem.id);
                  localFileSystem.writeFileToDisk(fileHandleObj.handle, data.code).then((ok) => {
                    if (ok) setDiskSyncStatus('synced');
                  });
                }
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
      if (!isOffline) {
        stompService.disconnect();
      }
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [room.roomCode, room.diskPath, isOffline]);

  const activeFile = fileTree.find((item) => item.id === activeFileId && item.type === 'file');
  const activeFileLanguage = activeFile
    ? (activeFile.language && activeFile.language !== 'plaintext'
        ? activeFile.language
        : getLanguageForFilename(activeFile.name || activeFile.path || ''))
    : 'plaintext';

  const workspaceRoot = room.diskPath || room.roomCode || 'workspace';
  const activeFileUri = activeFile
    ? modelManager.getCanonicalUriString(activeFile.path || activeFile.name, workspaceRoot)
    : undefined;

  // Monaco Editor Theme & Language Intelligence Setup
  const handleBeforeMount = (monaco) => {
    monacoRef.current = monaco;
    // Define and register CodeX themes
    themeManager.defineThemes(monaco);

    // Initialize Level 2 Language Intelligence & Level 3B Debugger services
    languageService.initialize(monaco, { workspaceRoot });
    languageProviderRegistry.registerAll(monaco);
    debuggerManager.initialize(monaco, { workspaceRoot, fileTree, onNavigate: handleNavigateToFile });
  };

  // Cross-file navigation handler (Go to Definition across workspace files)
  const handleNavigateToFile = useCallback((targetFile, selectionOrPosition) => {
    if (handleSelectFileRef.current) {
      handleSelectFileRef.current(targetFile);
    }
    if (selectionOrPosition) {
      setTimeout(() => {
        if (editorRef.current) {
          const pos = selectionOrPosition.startLineNumber !== undefined
            ? { lineNumber: selectionOrPosition.startLineNumber, column: selectionOrPosition.startColumn }
            : selectionOrPosition;
          editorRef.current.setPosition(pos);
          editorRef.current.revealPositionInCenter(pos);
        }
      }, 80);
    }
  }, []);

  // Monaco Editor Mounting, Language Service Wiring & Cursor Tracking
  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    if (monaco) {
      themeManager.applyTheme(monaco, editorTheme);
      languageService.setupEditor(editor, monaco, {
        fileTree,
        workspaceRoot,
        onNavigate: handleNavigateToFile,
        onDiagnosticsChange: ({ errors, warnings, markers }) => {
          setDiagnosticsCount({ errors, warnings });
          if (markers) setDiagnosticsMarkers(markers);
        },
      });

      // Attach Debugger Manager for gutter breakpoints and execution highlighting
      debuggerManager.attachEditor(editor, monaco, activeFile, {
        fileTree,
        workspaceRoot,
        onNavigate: handleNavigateToFile,
      });

      // Attach Coverage Decorations Manager for gutter coverage markers
      coverageDecorations.attachEditor(
        editor,
        monaco,
        activeFile?.path || activeFile?.name,
        room.diskPath || null
      );

      // Initialize Level 3F Code Actions & Refactoring Subsystem
      codeActionManager.initialize(monaco, {
        workspaceRoot: room.diskPath || null,
        fileTree,
      });
    }

    editor.onDidChangeCursorPosition((e) => {
      setCursorPos({
        line: e.position.lineNumber,
        col: e.position.column,
      });
    });
  };

  // Memoized structural fingerprint of file tree so typing content does not re-trigger model syncing or debugger re-attaching
  const fileTreeStructureKey = React.useMemo(() => {
    return fileTree.map((f) => `${f.id}:${f.name}:${f.path || ''}:${f.type}`).join('|');
  }, [fileTree]);

  // Update debugger active file & breakpoints when active tab changes or tree structure changes
  useEffect(() => {
    if (editorRef.current && monacoRef.current) {
      debuggerManager.attachEditor(editorRef.current, monacoRef.current, activeFile, {
        fileTree,
        workspaceRoot,
        onNavigate: handleNavigateToFile,
      });
      coverageDecorations.attachEditor(
        editorRef.current,
        monacoRef.current,
        activeFile?.path || activeFile?.name,
        room.diskPath || null
      );
      gitManager.updateGutterDecorations(
        editorRef.current,
        activeFile?.path || activeFile?.name
      );
    }
  }, [activeFile?.id, activeFile?.path, fileTreeStructureKey, workspaceRoot, handleNavigateToFile, room.diskPath]);

  // Synchronize workspace files into Monaco models only when files are added, removed, or renamed
  useEffect(() => {
    if (monacoRef.current && fileTree.length > 0) {
      const root = room.diskPath || room.roomCode || 'workspace';
      languageService.updateContext(fileTree, root);
      modelManager.syncWorkspaceFiles(monacoRef.current, fileTree, root);
      codeActionManager.updateContext({ fileTree, workspaceRoot: room.diskPath || null });
    }
  }, [fileTreeStructureKey, room.diskPath, room.roomCode]);

  // Synchronize build problem markers into Monaco models & Problems panel
  useEffect(() => {
    const unsubProblems = buildManager.onProblemsChange((problems) => {
      if (!monacoRef.current) return;
      const monaco = monacoRef.current;

      const buildMarkers = problems.map((prob) => {
        const fullPath = prob.file.startsWith('/') || prob.file.includes(':\\')
          ? prob.file
          : `${workspaceRoot}/${prob.file}`.replace(/\/+/g, '/');

        const uri = monaco.Uri.file(fullPath);
        return {
          resource: uri,
          startLineNumber: prob.line || 1,
          startColumn: prob.column || 1,
          endLineNumber: prob.line || 1,
          endColumn: (prob.column || 1) + 20,
          message: `[${prob.source}] ${prob.message}`,
          severity: prob.severity === 'warning' ? monaco.MarkerSeverity.Warning : monaco.MarkerSeverity.Error,
          source: prob.source || 'build',
        };
      });

      // Update Monaco markers for each model
      const models = monaco.editor.getModels();
      models.forEach((model) => {
        const modelUri = model.uri.toString();
        const fileBuildMarkers = buildMarkers.filter((m) => m.resource.toString() === modelUri);
        monaco.editor.setModelMarkers(model, 'build', fileBuildMarkers);
      });

      // Merge build markers into diagnosticsMarkers for Problems panel
      setDiagnosticsMarkers((prev) => {
        const nonBuild = prev.filter(
          (m) =>
            m.source !== 'build' &&
            !m.source?.startsWith('tsc') &&
            !m.source?.startsWith('gcc') &&
            !m.source?.startsWith('cargo') &&
            !m.source?.startsWith('go') &&
            !m.source?.startsWith('python')
        );
        return [...nonBuild, ...buildMarkers];
      });

      const errCount = buildMarkers.filter((m) => m.severity === monaco.MarkerSeverity.Error).length;
      const warnCount = buildMarkers.filter((m) => m.severity === monaco.MarkerSeverity.Warning).length;
      setDiagnosticsCount((prev) => ({
        errors: prev.errors + errCount,
        warnings: prev.warnings + warnCount,
      }));
    });

    return () => unsubProblems();
  }, [workspaceRoot]);

  // Synchronize test problem markers into Monaco models & Problems panel
  useEffect(() => {
    const unsubProblems = testManager.onProblemsChange((problems) => {
      if (!monacoRef.current) return;
      const monaco = monacoRef.current;

      const testMarkers = problems.map((prob) => {
        const fullPath = prob.file.startsWith('/') || prob.file.includes(':\\')
          ? prob.file
          : `${workspaceRoot}/${prob.file}`.replace(/\/+/g, '/');

        const uri = monaco.Uri.file(fullPath);
        return {
          resource: uri,
          startLineNumber: prob.line || 1,
          startColumn: prob.column || 1,
          endLineNumber: prob.line || 1,
          endColumn: (prob.column || 1) + 20,
          message: `[test] ${prob.message}`,
          severity: monaco.MarkerSeverity.Error,
          source: 'test',
        };
      });

      // Update Monaco markers for each model
      const models = monaco.editor.getModels();
      models.forEach((model) => {
        const modelUri = model.uri.toString();
        const fileTestMarkers = testMarkers.filter((m) => m.resource.toString() === modelUri);
        monaco.editor.setModelMarkers(model, 'test', fileTestMarkers);
      });

      // Merge test markers into diagnosticsMarkers
      setDiagnosticsMarkers((prev) => {
        const nonTest = prev.filter((m) => m.source !== 'test');
        return [...nonTest, ...testMarkers];
      });

      setDiagnosticsCount((prev) => ({
        errors: prev.errors + testMarkers.length,
        warnings: prev.warnings,
      }));
    });

    return () => unsubProblems();
  }, [workspaceRoot]);

  // Local Code Editing in Monaco
  const handleEditorChange = (newCode) => {
    if (!activeFile || isApplyingRemoteRef.current) return;

    // Mark file as dirty
    setDirtyFileIds((prev) => new Set([...prev, activeFile.id]));

    // Notify Language Service / LSP of in-memory change
    languageService.handleFileChange(activeFile, newCode);

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
    if (!isOffline && room.roomCode && !room.roomCode.startsWith('local-')) {
      stompService.sendCodeChange(room.roomCode, activeFile.id, newCode, {
        filePath: activeFile.path || null,
        fileName: activeFile.name || null,
      });
    }
  };

  // Workspace Lifecycle & File Watcher Subscription (mounted once, leak-free)
  useEffect(() => {
    let disposed = false;
    let unlistenTauri = null;

    const unsubOpen = workspaceEvents.on(WorkspaceEventType.WORKSPACE_OPENED, (ws) => {
      setCurrentWorkspace(ws);
      handleRefreshExplorer();
    });
    const unsubSaved = workspaceEvents.on(WorkspaceEventType.WORKSPACE_SAVED, (ws) => setCurrentWorkspace(ws));
    const unsubFolders = workspaceEvents.on(WorkspaceEventType.FOLDERS_CHANGED, () => {
      setCurrentWorkspace(workspaceManager.getWorkspace());
      handleRefreshExplorer();
    });
    const unsubChange = workspaceEvents.on(WorkspaceEventType.FILE_CHANGED, (evt) => {
      handleRefreshExplorer();
      const currentActiveId = activeFileIdRef.current;
      const currentFile = fileTreeRef.current?.find((f) => f.id === currentActiveId);

      // Automatically update the active file without showing any warning prompt
      if (currentFile?.path && evt.paths?.some((p) => p.replace(/\\/g, '/').replace(/^\/private/, '') === currentFile.path.replace(/\\/g, '/').replace(/^\/private/, ''))) {
        workspaceFiles.readFile(currentFile.path).then((c) => {
          if (editorRef.current) {
            const model = editorRef.current.getModel();
            if (model && model.getValue() !== c) {
              const sel = editorRef.current.getSelection();
              isApplyingRemoteRef.current = true;
              try {
                model.setValue(c);
              } finally {
                isApplyingRemoteRef.current = false;
              }
              if (sel) {
                try {
                  editorRef.current.setSelection(sel);
                } catch {}
              }
            }
          }
          setFileTree((prev) =>
            prev.map((item) => (item.id === currentActiveId ? { ...item, content: c } : item))
          );
          languageService.handleFileChange(currentFile, c);
          setDirtyFileIds((prev) => {
            const n = new Set(prev);
            n.delete(currentActiveId);
            return n;
          });
        }).catch(() => {});
      }

      // Also update any other open files in memory
      if (evt.paths && evt.paths.length > 0) {
        evt.paths.forEach((p) => {
          const normP = p.replace(/\\/g, '/').replace(/^\/private/, '');
          const matchItem = fileTreeRef.current?.find(
            (f) => f.path && f.path.replace(/\\/g, '/').replace(/^\/private/, '') === normP
          );
          if (matchItem && matchItem.id !== currentActiveId) {
            workspaceFiles.readFile(matchItem.path).then((c) => {
              setFileTree((prev) =>
                prev.map((item) => (item.id === matchItem.id ? { ...item, content: c } : item))
              );
            }).catch(() => {});
          }
        });
      }
    });

    if (isDesktop) {
      import('@tauri-apps/api/event').then(({ listen }) => {
        if (disposed) return;
        listen('fs-change', (event) => {
          workspaceManager.handleFilesystemChange(event.payload);
        }).then((fn) => {
          if (disposed) {
            fn();
          } else {
            unlistenTauri = fn;
          }
        });
      }).catch(console.warn);
    }

    return () => {
      disposed = true;
      unsubOpen();
      unsubSaved();
      unsubFolders();
      unsubChange();
      if (unlistenTauri) unlistenTauri();
    };
  }, [isDesktop]);

  // Save active file to local disk (Cmd/Ctrl + S)
  const handleSaveActiveFile = async () => {
    if (!activeFile) return;

    if (isDesktop && (activeFile.path || room.diskPath)) {
      try {
        const filePath = activeFile.path || `${room.diskPath.replace(/\\/g, '/').replace(/\/+$/, '')}/${activeFile.name}`;
        await filesystemService.writeFile(filePath, activeFile.content || '');
        if (!activeFile.path) {
          activeFile.path = filePath;
          setFileTree((prev) => prev.map((f) => (f.id === activeFile.id ? { ...f, path: filePath } : f)));
        }
        setDirtyFileIds((prev) => {
          const next = new Set(prev);
          next.delete(activeFile.id);
          return next;
        });
        showToast(`Saved ${activeFile.name}`);
        gitManager.scheduleRefresh();
        if (editorRef.current && activeFile) {
          gitManager.updateGutterDecorations(editorRef.current, activeFile.path || activeFile.name);
        }
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

    // Notify Language Service / LSP of document save
    languageService.handleFileSave(activeFile);
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
    if (e && e.preventDefault) e.preventDefault();
    const name = newEntryName.trim();
    if (!name) {
      setCreatingType(null);
      setNewEntryName('');
      return;
    }

    const rootFolder = fileTree.find((f) => f.id === 'folder-root');
    const targetParentId = creatingTargetFolderId || (rootFolder ? 'folder-root' : null);
    const targetParent = fileTree.find((f) => f.id === targetParentId);

    let newPath = null;
    if (isDesktop && room.diskPath) {
      const parentDirPath = targetParent && targetParent.path ? targetParent.path : room.diskPath;
      const cleanParent = parentDirPath.replace(/\\/g, '/').replace(/\/+$/, '');
      newPath = `${cleanParent}/${name}`;
      try {
        if (creatingType === 'file') {
          await filesystemService.createFile(newPath);
        } else {
          await filesystemService.createFolder(newPath);
        }
        refreshGitStatus();
      } catch (err) {
        showToast(`Failed to create ${creatingType}: ${err.message || err}`);
        setCreatingType(null);
        setNewEntryName('');
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

    const updatedTree = [...fileTree.filter((f) => f.id !== newId), newEntry];
    setFileTree(updatedTree);

    if (creatingType === 'file') {
      setActiveFileId(newId);
      setOpenTabIds((prev) => (prev.includes(newId) ? prev : [...prev, newId]));
    } else {
      setExpandedFolders((prev) => new Set([...prev, targetParentId, newId]));
    }

    if (!isOffline && room.roomCode && !room.roomCode.startsWith('local-')) {
      stompService.sendTreeChange(room.roomCode, 'FILE_CREATE', updatedTree, newId, user?.name || user?.username);
    }
    persistTree(updatedTree);

    setCreatingType(null);
    setNewEntryName('');
    setCreatingTargetFolderId(null);
  };

  // Delete Entry
  const handleDeleteEntry = async (e, item) => {
    e.stopPropagation();
    if (item.id === 'folder-root') {
      showToast('Cannot delete root workspace folder');
      return;
    }
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

    if (!isOffline && room.roomCode && !room.roomCode.startsWith('local-')) {
      stompService.sendTreeChange(room.roomCode, 'FILE_DELETE', updatedTree, item.id, user?.name || user?.username);
    }
    persistTree(updatedTree);
  };

  // Rename Entry
  const handleRenameSubmit = async (e, item) => {
    if (e && e.preventDefault) e.preventDefault();
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

    if (!isOffline && room.roomCode && !room.roomCode.startsWith('local-')) {
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

    // Notify Language Service / LSP of document open
    languageService.handleFileOpen(file);

    // Load content on demand if missing
    if (file.content === undefined || file.content === null) {
      if (isDesktop && file.path) {
        try {
          const text = await filesystemService.readFile(file.path);
          setFileTree((prev) =>
            prev.map((item) => (item.id === file.id ? { ...item, content: text } : item))
          );
          if (!isOffline && room.roomCode && !room.roomCode.startsWith('local-')) {
            stompService.sendCodeChange(room.roomCode, file.id, text, {
              filePath: file.path || null,
              fileName: file.name || null,
            });
          }
        } catch (err) {
          console.error('Failed to read file from disk:', err);
        }
      } else if (room.localFileHandles && localFileHandlesRef.current?.has(file.id)) {
        try {
          const fileHandleObj = localFileHandlesRef.current.get(file.id);
          const fileObj = await fileHandleObj.handle.getFile();
          const text = await fileObj.text();
          setFileTree((prev) =>
            prev.map((item) => (item.id === file.id ? { ...item, content: text } : item))
          );
          if (!isOffline && room.roomCode && !room.roomCode.startsWith('local-')) {
            stompService.sendCodeChange(room.roomCode, file.id, text, {
              filePath: file.path || null,
              fileName: file.name || null,
            });
          }
        } catch (err) {
          console.error('Failed to read file from browser handle:', err);
        }
      } else if (room.roomCode && !room.roomCode.startsWith('local-')) {
        // Web / remote mode: fetch content from backend REST API!
        try {
          const res = await roomsApi.getFileContent(room.roomCode, file.id, file.path);
          if (res && res.content !== undefined && res.content !== null) {
            setFileTree((prev) =>
              prev.map((item) => (item.id === file.id ? { ...item, content: res.content } : item))
            );
          }
        } catch (err) {
          console.warn('[VSCodeEditor] Could not fetch file content from backend:', err);
        }
      }
    }
  };
  handleSelectFileRef.current = handleSelectFile;

  // Closing a Tab with dirty state check
  const handleCloseTab = async (e, tabId) => {
    e.stopPropagation();

    const closingFile = fileTree.find((f) => f.id === tabId);
    if (closingFile) {
      languageService.handleFileClose(closingFile);
    }

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

  // Close Folder with safe cleanup
  const handleCloseWorkspace = async () => {
    try {
      if (isDesktop) {
        await workspaceManager.closeWorkspace().catch(() => {});
        await filesystemService.unwatch().catch(() => {});
      }
      if (!isOffline && room.roomCode && !room.roomCode.startsWith('local-')) {
        stompService.disconnect();
      }
      sessionStorage.removeItem('codex_current_workspace');
      sessionStorage.removeItem('codex_active_file');
      sessionStorage.removeItem('codex_open_tabs');
      sessionStorage.removeItem('codex_expanded_folders');
      sessionStorage.removeItem('codex_active_activity');
    } catch (err) {
      console.warn('[VSCodeEditor] Close workspace cleanup error:', err);
    }
    if (onCloseWorkspace) onCloseWorkspace();
  };

  // Open Git Diff
  const handleOpenDiff = async (filePath, staged = false) => {
    if (!isDesktop || !room.diskPath) return;
    try {
      const activeRepo = gitManager.getActiveRepository();
      const repoPath = activeRepo?.root || room.diskPath;
      const diffModels = await gitDiff.getDiffModels(repoPath, filePath, staged, filesystemService);

      setDiffFile({
        path: filePath,
        original: diffModels.original,
        modified: diffModels.modified,
        language: getLanguageForFilename(filePath),
        isStaged: staged,
      });
    } catch (err) {
      showToast(`Diff error: ${err.message || err}`);
    }
  };

  const handleStartBuild = async () => {
    if (!isDesktop) {
      showToast('Build operations are only available on the desktop app.');
      return;
    }
    try {
      setShowBottomPanel(true);
      setBottomPanelTab('output');
      showToast('Starting project build task...');
      await buildManager.startBuild({
        workspaceRoot: room?.diskPath || '',
        fileTree,
      });
    } catch (err) {
      showToast(`Build error: ${err.message || err}`);
    }
  };

  const handleStartRun = async () => {
    if (!isDesktop) {
      showToast('Run operations are only available on the desktop app.');
      return;
    }
    try {
      setShowBottomPanel(true);
      setBottomPanelTab('output');
      showToast('Running project without debugging...');
      await runManager.startRun({
        workspaceRoot: room?.diskPath || '',
        fileTree,
      });
    } catch (err) {
      showToast(`Run error: ${err.message || err}`);
    }
  };

  const handleStartRunFile = async () => {
    if (!isDesktop) {
      showToast('Run operations are only available on the desktop app.');
      return;
    }
    if (!activeFile) {
      showToast('Please open a file to run.');
      return;
    }
    try {
      setShowBottomPanel(true);
      setBottomPanelTab('output');
      showToast(`Running ${activeFile.name}...`);
      await runManager.startRunFile({
        workspaceRoot: room?.diskPath || '',
        fileTree,
        activeFile,
      });
    } catch (err) {
      showToast(`Run file error: ${err.message || err}`);
    }
  };

  const handleStopBuildOrRun = async () => {
    if (buildManager.isBuilding()) {
      await buildManager.stopBuild();
      showToast('Stopping build task...');
    }
    if (runManager.isRunning()) {
      await runManager.stopRun();
      showToast('Stopping run task...');
    }
  };

  const handleRunAllTests = async () => {
    if (!isDesktop) {
      showToast('Test execution requires CodeX Desktop.');
      return;
    }
    try {
      setShowBottomPanel(true);
      setBottomPanelTab('output');
      showToast('Running all tests...');
      await testManager.runAllTests();
    } catch (err) {
      showToast(`Test error: ${err.message || err}`);
    }
  };

  const handleStopTests = async () => {
    try {
      showToast('Stopping tests...');
      await testManager.stopTests();
    } catch (err) {
      showToast(`Stop error: ${err.message || err}`);
    }
  };

  const handleRefreshTests = async () => {
    try {
      showToast('Discovering tests...');
      await testManager.discoverTests({ workspaceRoot, fileTree });
    } catch (err) {
      showToast(`Refresh error: ${err.message || err}`);
    }
  };

  // Level 3E — Code Coverage Handlers
  const handleRunCoverage = async () => {
    if (!isDesktop) {
      showToast('Code coverage requires CodeX Desktop mode.');
      return;
    }
    try {
      setShowBottomPanel(true);
      setBottomPanelTab('output');
      showToast('Running tests with code coverage...');
      const res = await coverageManager.runCoverage({
        workspaceRoot: room.diskPath || null,
        fileTree,
      });
      if (res.success) {
        showToast(`Coverage completed: ${res.projectCoverage.lines.pct}% lines covered`);
      } else {
        showToast(`Coverage failed: ${res.error}`);
      }
    } catch (err) {
      showToast(`Coverage error: ${err.message || err}`);
    }
  };

  const handleClearCoverage = () => {
    coverageManager.clearCoverage(room.diskPath || null);
    showToast('Coverage data cleared.');
  };

  const handleNextUncovered = () => {
    if (!editorRef.current || !activeFile) {
      showToast('Open a file to navigate uncovered lines.');
      return;
    }
    const line = coverageManager.navigateNextUncovered(
      editorRef.current,
      activeFile.path || activeFile.name,
      room.diskPath || null
    );
    if (line) {
      showToast(`Jumped to line ${line}`);
    } else {
      showToast('No uncovered lines found in current file.');
    }
  };

  const handlePrevUncovered = () => {
    if (!editorRef.current || !activeFile) {
      showToast('Open a file to navigate uncovered lines.');
      return;
    }
    const line = coverageManager.navigatePreviousUncovered(
      editorRef.current,
      activeFile.path || activeFile.name,
      room.diskPath || null
    );
    if (line) {
      showToast(`Jumped to line ${line}`);
    } else {
      showToast('No uncovered lines found in current file.');
    }
  };

  const handleOpenFileFromCoverage = (filePath) => {
    if (!filePath) return;
    const norm = filePath.replace(/\\/g, '/');
    const matched = fileTree.find((f) => {
      const p = (f.path || f.name || '').replace(/\\/g, '/');
      return p === norm || norm.endsWith(p) || p.endsWith(norm);
    });
    if (matched) {
      handleOpenFile(matched.id);
    }
  };

  // Keyboard Shortcuts (Cmd/Ctrl + S, P, Shift+P, B, `, W, F5, Shift+B, Shift+T)
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

      // Cmd+Shift+B: Run Build Task
      if (isCtrlOrMeta && e.shiftKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        handleStartBuild();
        return;
      }

      // Cmd+Shift+T: Run All Tests
      if (isCtrlOrMeta && e.shiftKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        handleRunAllTests();
        return;
      }

      // Cmd+. / Ctrl+. : Quick Fix
      if (isCtrlOrMeta && !e.shiftKey && e.key === '.') {
        e.preventDefault();
        codeActionManager.triggerQuickFix(editorRef.current);
        return;
      }

      // Ctrl+Shift+R / Cmd+Shift+R: Refactor
      if (isCtrlOrMeta && e.shiftKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        codeActionManager.triggerRefactor(editorRef.current);
        return;
      }

      // Shift+Alt+O: Organize Imports
      if (e.shiftKey && e.altKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        codeActionManager.triggerOrganizeImports(editorRef.current);
        return;
      }

      // Cmd+B: Toggle Sidebar
      if (isCtrlOrMeta && !e.shiftKey && e.key.toLowerCase() === 'b') {
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

      // F5 / Shift+F5 / Ctrl+Shift+F5 / Ctrl+F5: Debugging & Run Without Debugging
      if (e.key === 'F5') {
        e.preventDefault();
        if (isCtrlOrMeta && !e.shiftKey) {
          // Ctrl/Cmd + F5: Run Without Debugging
          handleStartRun();
          return;
        }
        if (e.shiftKey && isCtrlOrMeta) {
          debuggerManager.restart();
        } else if (e.shiftKey) {
          debuggerManager.stop();
        } else {
          const session = debuggerManager.getActiveSession();
          if (session && session.state === 'paused') {
            debuggerManager.continue();
          } else if (!session || session.state === 'stopped') {
            debuggerManager.startDebugging({}, activeFile).catch((err) => {
              showToast(`Debug error: ${err.message || err}`);
            });
          }
        }
        return;
      }

      // F6: Pause Debugging
      if (e.key === 'F6') {
        e.preventDefault();
        debuggerManager.pause();
        return;
      }

      // F9: Toggle Breakpoint on current line
      if (e.key === 'F9') {
        e.preventDefault();
        if (activeFileUri) {
          breakpointManager.toggleBreakpoint(activeFileUri, cursorPos.line);
        }
        return;
      }

      // F10: Step Over
      if (e.key === 'F10') {
        e.preventDefault();
        debuggerManager.stepOver();
        return;
      }

      // F11 / Shift+F11: Step Into / Step Out
      if (e.key === 'F11') {
        e.preventDefault();
        if (e.shiftKey) {
          debuggerManager.stepOut();
        } else {
          debuggerManager.stepInto();
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
      id: 'file.openFile',
      label: 'File: Open File...',
      icon: <Files size={13} color="#60a5fa" />,
      action: handleOpenFilePicker,
    },
    {
      id: 'file.openFolder',
      label: 'File: Open Folder...',
      shortcut: '⌘O',
      icon: <HardDrive size={13} color="#60a5fa" />,
      action: handleOpenFolderDialog,
    },
    {
      id: 'file.openWorkspace',
      label: 'File: Open Workspace...',
      icon: <FolderOpen size={13} color="#60a5fa" />,
      action: handleOpenWorkspaceDialog,
    },
    {
      id: 'file.saveWorkspace',
      label: 'File: Save Workspace',
      icon: <Save size={13} color="#4ade80" />,
      action: handleSaveWorkspaceDialog,
    },
    {
      id: 'file.closeWorkspace',
      label: 'File: Close Workspace',
      icon: <X size={13} color="#f87171" />,
      action: handleCloseWorkspace,
    },
    {
      id: 'workspace.addFolder',
      label: 'Workspace: Add Folder...',
      icon: <PlusSquare size={13} color="#4ade80" />,
      action: handleAddFolderDialog,
    },
    {
      id: 'workspace.removeFolder',
      label: 'Workspace: Remove Folder...',
      icon: <MinusCircle size={13} color="#f87171" />,
      action: handleRemoveFolderDialog,
    },
    {
      id: 'workspace.rename',
      label: 'Workspace: Rename...',
      icon: <Edit2 size={13} color="#eab308" />,
      action: handleRenameWorkspace,
    },
    {
      id: 'workspace.reload',
      label: 'Workspace: Reload',
      icon: <RotateCw size={13} color="#60a5fa" />,
      action: handleReloadWorkspace,
    },
    {
      id: 'workspace.showRecent',
      label: 'Workspace: Show Recent',
      icon: <FolderGit2 size={13} color="#60a5fa" />,
      action: () => setShowRecentWorkspaces(true),
    },
    {
      id: 'workspace.clearRecent',
      label: 'Workspace: Clear Recent Workspaces',
      icon: <Trash2 size={13} color="#f87171" />,
      action: handleClearRecentWorkspaces,
    },
    {
      id: 'explorer.refresh',
      label: 'Explorer: Refresh',
      icon: <RotateCw size={13} color="#60a5fa" />,
      action: handleRefreshExplorer,
    },
    {
      id: 'explorer.collapseFolders',
      label: 'Explorer: Collapse Folders',
      icon: <FolderTree size={13} color="#858585" />,
      action: () => {
        workspaceState.collapseAllFolders();
        handleRefreshExplorer();
        showToast('Collapsed all folders');
      },
    },
    {
      id: 'explorer.newFile',
      label: 'Explorer: New File',
      icon: <FilePlus size={13} color="#4ade80" />,
      action: async () => {
        const root = currentWorkspace?.root || room.diskPath;
        if (!root) return;
        const name = window.prompt('New file name:');
        if (!name || !name.trim()) return;
        try {
          const target = `${root.replace(/\\/g, '/').replace(/\/+$/, '')}/${name.trim()}`;
          workspaceManager.recordInternalWrite(target);
          await workspaceFiles.createFile(target);
          await handleRefreshExplorer();
          showToast(`Created file: ${name.trim()}`);
        } catch (err) {
          showToast(`Create file error: ${err.message || err}`);
        }
      },
    },
    {
      id: 'explorer.newFolder',
      label: 'Explorer: New Folder',
      icon: <FolderPlus size={13} color="#eab308" />,
      action: async () => {
        const root = currentWorkspace?.root || room.diskPath;
        if (!root) return;
        const name = window.prompt('New folder name:');
        if (!name || !name.trim()) return;
        try {
          const target = `${root.replace(/\\/g, '/').replace(/\/+$/, '')}/${name.trim()}`;
          await workspaceFiles.createFolder(target);
          await handleRefreshExplorer();
          showToast(`Created folder: ${name.trim()}`);
        } catch (err) {
          showToast(`Create folder error: ${err.message || err}`);
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
      id: 'git.refresh',
      label: 'Git: Refresh',
      icon: <RotateCw size={13} color="#60a5fa" />,
      action: refreshGitStatus,
    },
    {
      id: 'git.stageFile',
      label: 'Git: Stage File',
      icon: <GitBranch size={13} color="#4ade80" />,
      action: async () => {
        if (!room.diskPath || !activeFile) return;
        const relPath = activeFile.path ? activeFile.path.replace(room.diskPath, '').replace(/^\//, '') : activeFile.name;
        await gitService.stage(room.diskPath, [relPath]);
        refreshGitStatus();
        showToast(`Staged ${activeFile.name}`);
      },
    },
    {
      id: 'git.stageAll',
      label: 'Git: Stage All',
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
      id: 'git.unstageFile',
      label: 'Git: Unstage File',
      icon: <GitBranch size={13} color="#f87171" />,
      action: async () => {
        if (!room.diskPath || !activeFile) return;
        const relPath = activeFile.path ? activeFile.path.replace(room.diskPath, '').replace(/^\//, '') : activeFile.name;
        await gitService.unstage(room.diskPath, [relPath]);
        refreshGitStatus();
        showToast(`Unstaged ${activeFile.name}`);
      },
    },
    {
      id: 'git.unstageAll',
      label: 'Git: Unstage All',
      icon: <GitBranch size={13} color="#f87171" />,
      action: async () => {
        if (!room.diskPath) return;
        const stagedList = gitStatus.staged || [];
        await gitService.unstage(room.diskPath, stagedList.map((f) => f.path));
        refreshGitStatus();
        showToast('Unstaged all changes');
      },
    },
    {
      id: 'git.commit',
      label: 'Git: Commit',
      icon: <GitCommit size={13} color="#60a5fa" />,
      action: async () => {
        if (!room.diskPath) return;
        const msg = window.prompt('Commit message:');
        if (!msg || !msg.trim()) return;
        await gitService.commit(room.diskPath, msg.trim());
        refreshGitStatus();
        showToast('Committed changes successfully');
      },
    },
    {
      id: 'git.push',
      label: 'Git: Push',
      icon: <ArrowUp size={13} color="#4ade80" />,
      action: async () => {
        if (!room.diskPath) return;
        await gitService.push(room.diskPath);
        refreshGitStatus();
        showToast('Pushed commits to remote');
      },
    },
    {
      id: 'git.pull',
      label: 'Git: Pull',
      icon: <ArrowDown size={13} color="#60a5fa" />,
      action: async () => {
        if (!room.diskPath) return;
        await gitService.pull(room.diskPath);
        refreshGitStatus();
        showToast('Pulled latest changes');
      },
    },
    {
      id: 'git.fetch',
      label: 'Git: Fetch',
      icon: <RotateCcw size={13} color="#60a5fa" />,
      action: async () => {
        if (!room.diskPath) return;
        await gitService.fetch(room.diskPath);
        refreshGitStatus();
        showToast('Fetched updates from remote');
      },
    },
    {
      id: 'git.createBranch',
      label: 'Git: Create Branch',
      icon: <GitBranch size={13} color="#4ade80" />,
      action: async () => {
        if (!room.diskPath) return;
        const bName = window.prompt('New branch name:');
        if (!bName || !bName.trim()) return;
        await gitBranches.createBranch(room.diskPath, bName.trim(), true);
        refreshGitStatus();
        showToast(`Created branch "${bName.trim()}"`);
      },
    },
    {
      id: 'git.switchBranch',
      label: 'Git: Switch Branch',
      icon: <GitBranch size={13} color="#60a5fa" />,
      action: async () => {
        if (!room.diskPath) return;
        const bName = window.prompt('Switch to branch:');
        if (!bName || !bName.trim()) return;
        await gitBranches.checkout(room.diskPath, bName.trim());
        refreshGitStatus();
        showToast(`Switched to branch "${bName.trim()}"`);
      },
    },
    {
      id: 'git.stash',
      label: 'Git: Stash',
      icon: <GitBranch size={13} color="#eab308" />,
      action: async () => {
        if (!room.diskPath) return;
        const msg = window.prompt('Stash message (optional):');
        if (msg === null) return;
        await gitStash.save(room.diskPath, msg || undefined, true);
        refreshGitStatus();
        showToast('Stashed changes');
      },
    },
    {
      id: 'git.showHistory',
      label: 'Git: Show History',
      icon: <GitCommit size={13} color="#60a5fa" />,
      action: () => setShowGitHistory(true),
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
      icon: editorTheme === CODEX_DARK_THEME_NAME ? <Sun size={13} color="#f59e0b" /> : <Moon size={13} color="#60a5fa" />,
      action: () => setEditorTheme((prev) => (prev === CODEX_DARK_THEME_NAME ? 'light' : CODEX_DARK_THEME_NAME)),
    },
    {
      id: 'editor.formatDocument',
      label: 'Format Document',
      shortcut: '⇧⌥F',
      action: () => languageService.formatDocument(editorRef.current),
    },
    {
      id: 'editor.formatSelection',
      label: 'Format Selection',
      shortcut: '⌘K ⌘F',
      action: () => languageService.formatSelection(editorRef.current),
    },
    {
      id: 'editor.goToDefinition',
      label: 'Go to Definition',
      shortcut: 'F12',
      action: () => languageService.triggerGoToDefinition(editorRef.current),
    },
    {
      id: 'editor.findReferences',
      label: 'Find All References',
      shortcut: '⇧F12',
      action: () => languageService.triggerFindReferences(editorRef.current),
    },
    {
      id: 'editor.renameSymbol',
      label: 'Rename Symbol',
      shortcut: 'F2',
      action: () => languageService.triggerRename(editorRef.current),
    },
    // Debugger commands
    {
      id: 'debug.start',
      label: 'Debug: Start Debugging / Continue',
      shortcut: 'F5',
      icon: <Bug size={13} color="#4ade80" />,
      action: () => {
        const session = debuggerManager.getActiveSession();
        if (session && session.state === 'paused') {
          debuggerManager.continue();
        } else {
          debuggerManager.startDebugging({}, activeFile).catch((err) => {
            showToast(`Debug error: ${err.message || err}`);
          });
        }
      },
    },
    {
      id: 'debug.pause',
      label: 'Debug: Pause',
      shortcut: 'F6',
      icon: <Pause size={13} color="#facc15" />,
      action: () => debuggerManager.pause(),
    },
    {
      id: 'debug.stepOver',
      label: 'Debug: Step Over',
      shortcut: 'F10',
      icon: <ArrowRight size={13} color="#60a5fa" />,
      action: () => debuggerManager.stepOver(),
    },
    {
      id: 'debug.stepInto',
      label: 'Debug: Step Into',
      shortcut: 'F11',
      icon: <ArrowDown size={13} color="#60a5fa" />,
      action: () => debuggerManager.stepInto(),
    },
    {
      id: 'debug.stepOut',
      label: 'Debug: Step Out',
      shortcut: '⇧F11',
      icon: <ArrowUp size={13} color="#60a5fa" />,
      action: () => debuggerManager.stepOut(),
    },
    {
      id: 'debug.restart',
      label: 'Debug: Restart Debugging',
      shortcut: '⌃⇧F5',
      icon: <RotateCw size={13} color="#38bdf8" />,
      action: () => debuggerManager.restart(),
    },
    {
      id: 'debug.stop',
      label: 'Debug: Stop Debugging',
      shortcut: '⇧F5',
      icon: <Square size={13} color="#ef4444" />,
      action: () => debuggerManager.stop(),
    },
    {
      id: 'debug.toggleBreakpoint',
      label: 'Debug: Toggle Breakpoint',
      shortcut: 'F9',
      icon: <Circle size={13} color="#e51400" />,
      action: () => {
        if (activeFileUri) {
          breakpointManager.toggleBreakpoint(activeFileUri, cursorPos.line);
        }
      },
    },
    {
      id: 'debug.removeAllBreakpoints',
      label: 'Debug: Remove All Breakpoints',
      icon: <Trash2 size={13} color="#f87171" />,
      action: () => breakpointManager.removeAllBreakpoints(),
    },
    // Level 3C — Build & Run Commands
    {
      id: 'workbench.action.tasks.build',
      label: 'Tasks: Run Build Task (Build Project)',
      shortcut: '⇧⌘B',
      icon: <RotateCw size={13} color="#60a5fa" />,
      action: handleStartBuild,
    },
    {
      id: 'workbench.action.debug.run',
      label: 'Debug: Run Without Debugging',
      shortcut: '⌃F5',
      icon: <Play size={13} color="#4ade80" />,
      action: handleStartRun,
    },
    {
      id: 'workbench.action.debug.runFile',
      label: 'Debug: Run Current Active File',
      icon: <Play size={13} color="#38bdf8" />,
      action: handleStartRunFile,
    },
    {
      id: 'workbench.action.tasks.stop',
      label: 'Tasks: Stop Active Build / Run Task',
      icon: <Square size={13} color="#f87171" />,
      action: handleStopBuildOrRun,
    },
    // Level 3D — Test Runner Commands
    {
      id: 'testing.runAll',
      label: 'Test: Run All Tests',
      shortcut: '⇧⌘T',
      icon: <FlaskConical size={13} color="#a855f7" />,
      action: handleRunAllTests,
    },
    {
      id: 'testing.refresh',
      label: 'Test: Refresh / Discover Tests',
      icon: <RotateCw size={13} color="#60a5fa" />,
      action: handleRefreshTests,
    },
    {
      id: 'testing.stop',
      label: 'Test: Stop Tests',
      icon: <Square size={13} color="#f87171" />,
      action: handleStopTests,
    },
    {
      id: 'testing.openExplorer',
      label: 'View: Show Test Explorer',
      icon: <FlaskConical size={13} color="#38bdf8" />,
      action: () => setActiveActivity('test'),
    },
    // Level 3E — Code Coverage Commands
    {
      id: 'coverage.run',
      label: 'Coverage: Run Tests with Coverage',
      icon: <ShieldCheck size={13} color="#38bdf8" />,
      action: handleRunCoverage,
    },
    {
      id: 'coverage.clear',
      label: 'Coverage: Clear Coverage Data',
      icon: <Square size={13} color="#f87171" />,
      action: handleClearCoverage,
    },
    {
      id: 'coverage.nextUncovered',
      label: 'Coverage: Next Uncovered Line',
      icon: <ArrowDown size={13} color="#f59e0b" />,
      action: handleNextUncovered,
    },
    {
      id: 'coverage.prevUncovered',
      label: 'Coverage: Previous Uncovered Line',
      icon: <ArrowUp size={13} color="#f59e0b" />,
      action: handlePrevUncovered,
    },
    {
      id: 'coverage.openPanel',
      label: 'View: Show Code Coverage',
      icon: <ShieldCheck size={13} color="#4ade80" />,
      action: () => setActiveActivity('coverage'),
    },
    // Level 3F — Refactoring & Code Actions Commands
    {
      id: 'editor.action.quickFix',
      label: 'Quick Fix...',
      shortcut: '⌘.',
      icon: <Lightbulb size={13} color="#facc15" />,
      action: () => codeActionManager.triggerQuickFix(editorRef.current),
    },
    {
      id: 'editor.action.refactor',
      label: 'Refactor...',
      shortcut: '⌃⇧R',
      icon: <Wand2 size={13} color="#a855f7" />,
      action: () => codeActionManager.triggerRefactor(editorRef.current),
    },
    {
      id: 'editor.action.codeAction',
      label: 'Code Action...',
      icon: <Lightbulb size={13} color="#60a5fa" />,
      action: () => codeActionManager.triggerCodeAction(editorRef.current),
    },
    {
      id: 'editor.action.organizeImports',
      label: 'Organize Imports',
      shortcut: '⇧⌥O',
      icon: <Wand2 size={13} color="#38bdf8" />,
      action: () => codeActionManager.triggerOrganizeImports(editorRef.current),
    },
  ];

  // Render Explorer File/Folder Tree
  const renderTreeItems = (parentId = null, depth = 0) => {
    const hasRootFolder = fileTree.some((f) => f.id === 'folder-root');
    const effectiveParentId = parentId === null && hasRootFolder ? 'folder-root' : parentId;

    const items = fileTree.filter((item) => {
      // Don't render the root container folder itself as a node in the tree
      if (item.id === 'folder-root') return false;

      if (effectiveParentId === null) {
        return item.parentId === null || item.parentId === undefined;
      }
      return item.parentId === effectiveParentId;
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
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleRenameSubmit(e, item);
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        setRenamingId(null);
                      }
                    }}
                    onBlur={() => {
                      if (renamingName.trim() && renamingName.trim() !== item.name) {
                        handleRenameSubmit(null, item);
                      } else {
                        setRenamingId(null);
                      }
                    }}
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
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleCreateEntry(e);
                        } else if (e.key === 'Escape') {
                          e.preventDefault();
                          setCreatingType(null);
                          setNewEntryName('');
                        }
                      }}
                      onBlur={() => {
                        if (newEntryName.trim()) {
                          handleCreateEntry();
                        } else {
                          setCreatingType(null);
                        }
                      }}
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleRenameSubmit(e, item);
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    setRenamingId(null);
                  }
                }}
                onBlur={() => {
                  if (renamingName.trim() && renamingName.trim() !== item.name) {
                    handleRenameSubmit(null, item);
                  } else {
                    setRenamingId(null);
                  }
                }}
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

          {!isOffline && room.roomCode && (
            <div className="room-badge-compact" onClick={copyRoomCode} title="Click to copy room code">
              <span className="room-label">Room</span>
              <code>{room.roomCode}</code>
              {copyCodeSuccess ? <Check size={12} color="#4ade80" /> : <Copy size={12} color="#858585" />}
            </div>
          )}

          {room.visibility === 'PUBLIC' && !isOffline && (
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

        {/* Right: Live Collaboration or Offline indicator, and Actions */}
        <div className="top-bar-right">
          {isOffline ? (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(255, 170, 0, 0.12)',
                border: '1px solid rgba(255, 170, 0, 0.25)',
                color: '#e5c07b',
                padding: '3px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 600,
              }}
              title="Offline Mode: Collaborative live sync disabled. Local editing, terminal, and git are fully functional."
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#e5c07b' }}></span>
              Offline Mode
            </div>
          ) : (
            <>
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
            </>
          )}

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
              className={`activity-btn ${activeActivity === 'test' ? 'active' : ''}`}
              title={activeActivity === 'test' ? 'Close Testing' : 'Testing (Tests)'}
              onClick={() => setActiveActivity((prev) => (prev === 'test' ? null : 'test'))}
            >
              <FlaskConical size={19} />
            </button>
            <button
              className={`activity-btn ${activeActivity === 'coverage' ? 'active' : ''}`}
              title={activeActivity === 'coverage' ? 'Close Code Coverage' : 'Code Coverage'}
              onClick={() => setActiveActivity((prev) => (prev === 'coverage' ? null : 'coverage'))}
            >
              <ShieldCheck size={19} />
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
              title={editorTheme === CODEX_DARK_THEME_NAME ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
              onClick={() => setEditorTheme(editorTheme === CODEX_DARK_THEME_NAME ? 'light' : CODEX_DARK_THEME_NAME)}
            >
              {editorTheme === CODEX_DARK_THEME_NAME ? <Sun size={18} /> : <Moon size={18} />}
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
          <ExplorerPanel
            workspace={currentWorkspace}
            fileTree={fileTree}
            activeFile={activeFile}
            gitStatus={gitStatus}
            onSelectFile={handleSelectFile}
            onDoubleClickFile={handleSelectFile}
            onRefresh={handleRefreshExplorer}
            onOpenFolder={handleOpenFolderDialog}
            onOpenWorkspace={handleOpenWorkspaceDialog}
            onAddFolder={handleAddFolderDialog}
            showToast={showToast}
          />
        )}

        {activeActivity === 'git' && (
          <SourceControlPanel
            projectRoot={room.diskPath || null}
            filesystemService={filesystemService}
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
            activeFile={activeFile}
            fileTree={fileTree}
            onNavigateToFile={handleNavigateToFile}
            onOpenBottomTab={(tab) => {
              setShowBottomPanel(true);
              setBottomPanelTab(tab);
            }}
            showToast={showToast}
          />
        )}

        {activeActivity === 'test' && (
          <TestExplorerPanel
            workspaceRoot={room.diskPath || null}
            fileTree={fileTree}
            onNavigateToFile={handleNavigateToFile}
            onOpenBottomTab={(tab) => {
              setShowBottomPanel(true);
              setBottomPanelTab(tab);
            }}
            showToast={showToast}
          />
        )}

        {activeActivity === 'coverage' && (
          <CoveragePanel
            workspaceRoot={room.diskPath || null}
            fileTree={fileTree}
            activeFile={activeFile?.path || activeFile?.name}
            onOpenFile={handleOpenFileFromCoverage}
            editor={editorRef.current}
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
            <DebugToolbar
              isDebugging={debugToolbarState.isDebugging}
              sessionState={debugToolbarState.sessionState}
              activeFrame={debugToolbarState.activeFrame}
            />
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
                    language={getLanguageForFilename(diffFile.path)}
                    original={diffFile.original}
                    modified={diffFile.modified}
                    beforeMount={handleBeforeMount}
                    options={getEditorOptions({
                      readOnly: true,
                      minimap: { enabled: false },
                      renderSideBySide: true,
                    })}
                  />
                </div>
              </div>
            ) : activeFile ? (
              <Editor
                height="100%"
                theme={editorTheme}
                path={activeFileUri}
                language={activeFileLanguage}
                value={activeFile.content || ''}
                beforeMount={handleBeforeMount}
                onMount={handleEditorDidMount}
                onChange={handleEditorChange}
                options={getEditorOptions()}
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
            markers={diagnosticsMarkers}
            onNavigateToProblem={(marker) => {
              if (marker?.resource) {
                const targetFile = modelManager.findFileByUri(
                  fileTree,
                  marker.resource,
                  room.diskPath || room.roomCode || 'workspace'
                );
                if (targetFile) {
                  handleNavigateToFile(targetFile, {
                    lineNumber: marker.startLineNumber,
                    column: marker.startColumn,
                  });
                }
              }
            }}
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

          <div
            className="status-item"
            title={`${diagnosticsCount.errors} Errors, ${diagnosticsCount.warnings} Warnings`}
            onClick={() => {
              setShowBottomPanel(true);
              setBottomPanelTab('problems');
            }}
            style={{ cursor: 'pointer' }}
          >
            <span style={{ color: diagnosticsCount.errors > 0 ? '#f87171' : 'inherit', fontWeight: diagnosticsCount.errors > 0 ? '600' : 'normal' }}>
              {diagnosticsCount.errors}
            </span>
            <span style={{ opacity: 0.6, marginLeft: '4px', color: diagnosticsCount.warnings > 0 ? '#facc15' : 'inherit' }}>
              {diagnosticsCount.warnings}
            </span>
          </div>

          <div className="status-item" title="Collaboration / Session Status">
            {isOffline ? (
              <>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#e5c07b', display: 'inline-block', marginRight: 4 }} />
                <span style={{ color: '#e5c07b' }}>Offline Mode</span>
              </>
            ) : (
              <>
                <span className="status-dot-green" />
                <span>{isSynced ? 'Live Sync' : 'Connecting...'}</span>
              </>
            )}
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
              <span>{getLanguageLabel(activeFileLanguage, activeFile.name)}</span>
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

      {/* Refactoring Preview Modal */}
      {refactorPreview && (
        <RefactorPreviewModal
          isOpen={Boolean(refactorPreview)}
          title={refactorPreview.title}
          preview={refactorPreview.preview}
          onApply={() => codeActionManager.applyPreview()}
          onCancel={() => codeActionManager.cancelPreview()}
        />
      )}

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

      {/* Git History Modal */}
      {showGitHistory && (
        <GitHistoryModal
          repoPath={gitManager.getActiveRepository()?.root || room.diskPath}
          onOpenDiff={handleOpenDiff}
          onClose={() => setShowGitHistory(false)}
          showToast={showToast}
        />
      )}

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

      {/* Recent Workspaces Modal */}
      {showRecentWorkspaces && (
        <RecentWorkspacesModal
          isOpen={showRecentWorkspaces}
          onClose={() => setShowRecentWorkspaces(false)}
          onOpenWorkspace={handleOpenWorkspaceFromPath}
          showToast={showToast}
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
