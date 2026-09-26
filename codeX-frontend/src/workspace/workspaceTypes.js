/**
 * Workspace Types and Enums (Level 3H)
 */

export const ProjectType = Object.freeze({
  NODE: 'node',
  RUST: 'rust',
  PYTHON: 'python',
  GO: 'go',
  JAVA: 'java',
  C_CPP: 'c_cpp',
  GENERIC: 'generic',
});

export const ExternalChangeAction = Object.freeze({
  COMPARE: 'compare',
  RELOAD: 'reload',
  KEEP: 'keep',
});

export const WorkspaceEventType = Object.freeze({
  WORKSPACE_OPENED: 'workspace-opened',
  WORKSPACE_CLOSED: 'workspace-closed',
  WORKSPACE_SAVED: 'workspace-saved',
  WORKSPACE_RELOADED: 'workspace-reloaded',
  FOLDERS_CHANGED: 'folders-changed',
  ACTIVE_FOLDER_CHANGED: 'active-folder-changed',
  SETTINGS_CHANGED: 'settings-changed',
  PROJECT_DETECTED: 'project-detected',
  FILE_CHANGED: 'file-changed',
  EXTERNAL_CHANGE_DETECTED: 'external-change-detected',
  RECENT_WORKSPACES_CHANGED: 'recent-workspaces-changed',
});

export const DEFAULT_WORKSPACE_SETTINGS = Object.freeze({
  tabSize: 2,
  insertSpaces: true,
  formatOnSave: true,
  autoSave: 'off', // 'off' | 'afterDelay' | 'onFocusChange'
  excludePatterns: ['**/node_modules/**', '**/.git/**', '**/target/**', '**/dist/**', '**/.next/**'],
  minimap: true,
  defaultTerminalProfile: 'default',
  defaultFormatter: 'default',
  gitAutoRefresh: true,
  watcherExclusions: ['**/.git/**', '**/node_modules/**', '**/target/**', '**/dist/**'],
});
