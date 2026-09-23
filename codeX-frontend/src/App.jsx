import React, { useState, useEffect } from 'react';
import AuthPage from './components/auth/AuthPage';
import VSCodeWelcome from './components/vscode/VSCodeWelcome';
import VSCodeEditor from './components/vscode/VSCodeEditor';
import { authApi } from './services/api';

function App() {
  const [currentUser, setCurrentUser] = useState(authApi.getStoredUser());
  const [currentWorkspace, setCurrentWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function verifySession() {
      const token = authApi.getToken();
      if (token) {
        try {
          const user = await authApi.getCurrentUser();
          setCurrentUser(user);
        } catch (err) {
          // Token expired or invalid
          authApi.logout();
          setCurrentUser(null);
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
      email: data.email,
    });
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
        Loading CodeLive VS Code Workspace...
      </div>
    );
  }

  // 1. Not Authenticated -> Show Sign In / Sign Up
  if (!currentUser) {
    return <AuthPage onAuthSuccess={handleAuthSuccess} />;
  }

  // 2. Authenticated & In Active Workspace -> Show VS Code Collaborative Editor
  if (currentWorkspace) {
    return (
      <VSCodeEditor
        room={currentWorkspace}
        user={currentUser}
        onCloseWorkspace={() => setCurrentWorkspace(null)}
      />
    );
  }

  // 3. Authenticated -> Show VS Code Open Folder / Project Welcome Screen
  return (
    <VSCodeWelcome
      user={currentUser}
      onOpenWorkspace={(room) => setCurrentWorkspace(room)}
      onLogout={handleLogout}
    />
  );
}

export default App;
