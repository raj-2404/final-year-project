/**
 * Workspace Local Storage and Persistence
 */

function getActiveUserId() {
  try {
    const raw = localStorage.getItem('currentUser');
    if (raw) {
      const u = JSON.parse(raw);
      return u?.id || u?.username || 'default';
    }
  } catch {}
  return 'guest';
}

function getRecentWorkspacesKey() {
  return `codex_recent_workspaces_${getActiveUserId()}`;
}

const LAST_WORKSPACE_KEY = 'codex_last_workspace';
const WORKSPACE_STATE_PREFIX = 'codex_workspace_state_';

export const workspaceStorage = {
  getRecentWorkspaces() {
    try {
      const data = localStorage.getItem(getRecentWorkspacesKey());
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  addRecentWorkspace(workspace) {
    if (!workspace || !workspace.root) return;
    try {
      const recent = this.getRecentWorkspaces().filter(
        (w) => w.root !== workspace.root && w.path !== workspace.root
      );
      recent.unshift({
        id: workspace.id,
        name: workspace.name || 'Workspace',
        root: workspace.root,
        path: workspace.root,
        isMultiRoot: Boolean(workspace.isMultiRoot),
        lastOpened: Date.now(),
      });
      // Keep up to 25 recent
      localStorage.setItem(getRecentWorkspacesKey(), JSON.stringify(recent.slice(0, 25)));
    } catch (err) {
      console.warn('Failed to save recent workspace:', err);
    }
  },

  removeRecentWorkspace(rootPath) {
    try {
      const recent = this.getRecentWorkspaces().filter(
        (w) => w.root !== rootPath && w.path !== rootPath
      );
      localStorage.setItem(getRecentWorkspacesKey(), JSON.stringify(recent));
    } catch {}
  },

  clearRecentWorkspaces() {
    try {
      localStorage.removeItem(getRecentWorkspacesKey());
    } catch {}
  },

  getLastWorkspace() {
    try {
      const data = localStorage.getItem(LAST_WORKSPACE_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  setLastWorkspace(workspaceSummary) {
    try {
      if (!workspaceSummary) {
        localStorage.removeItem(LAST_WORKSPACE_KEY);
      } else {
        localStorage.setItem(LAST_WORKSPACE_KEY, JSON.stringify(workspaceSummary));
      }
    } catch {}
  },

  getWorkspaceState(workspaceId) {
    if (!workspaceId) return null;
    try {
      const data = localStorage.getItem(`${WORKSPACE_STATE_PREFIX}${workspaceId}`);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  saveWorkspaceState(workspaceId, state) {
    if (!workspaceId || !state) return;
    try {
      localStorage.setItem(`${WORKSPACE_STATE_PREFIX}${workspaceId}`, JSON.stringify(state));
    } catch (err) {
      console.warn('Failed to save workspace state:', err);
    }
  },
};
