import React, { useState, useEffect } from 'react';
import AuthPage from './components/auth/AuthPage';
import VSCodeWelcome from './components/vscode/VSCodeWelcome';
import VSCodeEditor from './components/vscode/VSCodeEditor';
import { authApi } from './services/api';

function App() {
  const [currentUser, setCurrentUser] = useState(authApi.getStoredUser());
  const [currentWorkspace, setCurrentWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);

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
    setCurrentUser(null);
    setCurrentWorkspace(null);
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
      <VSCodeEditor
        room={currentWorkspace}
        user={activeUser}
        onCloseWorkspace={() => setCurrentWorkspace(null)}
      />
    );
  }

  // 2. Default screen is ALWAYS the VSCodeWelcome screen!
  // Login / Register is available as a modal trigger from the top header
  return (
    <>
      <VSCodeWelcome
        user={currentUser}
        onOpenWorkspace={(room) => setCurrentWorkspace(room)}
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
