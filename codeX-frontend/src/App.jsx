import React, { useState, useEffect } from 'react';
import AuthPage from './components/auth/AuthPage';
import VSCodeWelcome from './components/vscode/VSCodeWelcome';
import VSCodeEditor from './components/vscode/VSCodeEditor';
import ErrorBoundary from './components/common/ErrorBoundary';
import { authApi } from './services/api';

const SESSION_WORKSPACE_KEY = 'codex_current_workspace';

function App() {
  const [currentUser, setCurrentUser] = useState(authApi.getStoredUser());
  const [currentWorkspace, setCurrentWorkspace] = useState(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_WORKSPACE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch (err) {
      console.warn('[App] Failed to load workspace from sessionStorage:', err);
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Sync currentWorkspace to sessionStorage whenever it changes
  useEffect(() => {
    try {
      if (currentWorkspace) {
        const serializable = { ...currentWorkspace };
        delete serializable.localDirHandle;
        delete serializable.localFileHandles;
        delete serializable.localDirHandles;
        sessionStorage.setItem(SESSION_WORKSPACE_KEY, JSON.stringify(serializable));
      } else {
        sessionStorage.removeItem(SESSION_WORKSPACE_KEY);
      }
    } catch (err) {
      console.warn('[App] Could not save currentWorkspace to sessionStorage:', err);
    }
  }, [currentWorkspace]);

  useEffect(() => {
    async function verifySession() {
      const token = authApi.getToken();
      if (token) {
        try {
          const user = await authApi.getCurrentUser();
          setCurrentUser(user);
        } catch (err) {
          // If explicitly rejected with 401 or 403, clear session
          if (err.status === 401 || err.status === 403) {
            authApi.logout();
            handleCloseWorkspace();
            setCurrentUser(null);
          } else {
            console.warn('[App] Backend not reachable for session verification; continuing with stored user:', err);
          }
        }
      }
      setLoading(false);
    }

    verifySession();
  }, []);

  const handleOpenWorkspace = (room) => {
    if (room) {
      try {
        const serializable = { ...room };
        delete serializable.localDirHandle;
        delete serializable.localFileHandles;
        delete serializable.localDirHandles;
        sessionStorage.setItem(SESSION_WORKSPACE_KEY, JSON.stringify(serializable));
      } catch (e) {
        console.warn('[App] Failed to persist workspace to sessionStorage:', e);
      }
    } else {
      sessionStorage.removeItem(SESSION_WORKSPACE_KEY);
    }
    setCurrentWorkspace(room);
  };

  const handleCloseWorkspace = () => {
    try {
      sessionStorage.removeItem(SESSION_WORKSPACE_KEY);
      sessionStorage.removeItem('codex_active_file');
      sessionStorage.removeItem('codex_open_tabs');
      sessionStorage.removeItem('codex_expanded_folders');
      sessionStorage.removeItem('codex_active_activity');
    } catch (e) {}
    setCurrentWorkspace(null);
  };

  const handleAuthSuccess = (data) => {
    setCurrentUser({
      id: data.id,
      name: data.name,
      username: data.username,
      email: data.email,
    });
    setShowAuthModal(false);
  };

  const handleLogout = () => {
    authApi.logout();
    handleCloseWorkspace();
    setCurrentUser(null);
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#1e1e1e',
          color: '#cccccc',
          fontFamily: 'sans-serif',
        }}
      >
        Loading CodeX Workspace...
      </div>
    );
  }

  // 1. If currently inside an open workspace, render the full editor
  if (currentWorkspace) {
    const activeUser = currentUser || {
      id: 'offline-local-user',
      name: 'Local User',
      username: 'local',
    };

    return (
      <ErrorBoundary onClose={handleCloseWorkspace}>
        <VSCodeEditor
          room={currentWorkspace}
          user={activeUser}
          onCloseWorkspace={handleCloseWorkspace}
        />
      </ErrorBoundary>
    );
  }

  // 2. Default screen is ALWAYS the VSCodeWelcome screen!
  // Login / Register is available as a modal trigger from the top header
  return (
    <>
      <VSCodeWelcome
        user={currentUser}
        onOpenWorkspace={handleOpenWorkspace}
        onLogout={handleLogout}
        onLoginClick={() => setShowAuthModal(true)}
      />

      {showAuthModal && (
        <AuthPage
          onClose={() => setShowAuthModal(false)}
          onAuthSuccess={handleAuthSuccess}
        />
      )}
    </>
  );
}

export default App;
