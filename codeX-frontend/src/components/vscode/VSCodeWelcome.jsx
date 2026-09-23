import React, { useState, useEffect } from 'react';
import { roomsApi } from '../../services/api';
import './VSCode.css';

export default function VSCodeWelcome({ user, onOpenWorkspace, onLogout }) {
  const [modalMode, setModalMode] = useState(null); // 'new' | 'join' | null
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [projectNameInput, setProjectNameInput] = useState('');
  const [projectLanguage, setProjectLanguage] = useState('javascript');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [recentWorkspaces, setRecentWorkspaces] = useState([]);

  useEffect(() => {
    try {
      const recents = JSON.parse(localStorage.getItem('recentWorkspaces') || '[]');
      setRecentWorkspaces(recents);
    } catch {
      setRecentWorkspaces([]);
    }
  }, []);

  const saveToRecents = (room) => {
    try {
      const current = JSON.parse(localStorage.getItem('recentWorkspaces') || '[]');
      const filtered = current.filter((r) => r.roomCode !== room.roomCode);
      const updated = [
        {
          roomCode: room.roomCode,
          title: room.title,
          language: room.language,
          openedAt: new Date().toLocaleDateString(),
        },
        ...filtered,
      ].slice(0, 6);
      localStorage.setItem('recentWorkspaces', JSON.stringify(updated));
    } catch {}
  };

  const handleCreateNewProject = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const title = projectNameInput.trim() || 'My-CodeLive-Project';
      const room = await roomsApi.createRoom(title, projectLanguage);
      saveToRecents(room);
      setModalMode(null);
      if (onOpenWorkspace) {
        onOpenWorkspace(room);
      }
    } catch (err) {
      setError(err.message || 'Failed to create project workspace');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinProject = async (e) => {
    e.preventDefault();
    setError('');
    const code = roomCodeInput.trim();
    if (!code) {
      setError('Please enter a room code');
      return;
    }

    setLoading(true);
    try {
      const room = await roomsApi.getRoom(code);
      saveToRecents(room);
      setModalMode(null);
      if (onOpenWorkspace) {
        onOpenWorkspace(room);
      }
    } catch (err) {
      setError('Room not found. Check the code and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenRecent = async (recent) => {
    setLoading(true);
    try {
      const room = await roomsApi.getRoom(recent.roomCode);
      saveToRecents(room);
      if (onOpenWorkspace) {
        onOpenWorkspace(room);
      }
    } catch {
      // If room expired or not found, still open with recent code
      onOpenWorkspace(recent);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="vscode-welcome-container">
      {/* Top Application Bar */}
      <div className="vscode-welcome-header">
        <div className="vscode-welcome-title">
          <span>Visual Studio Code</span>
          <span style={{ color: '#858585' }}>— CodeLive Workspace</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span style={{ color: '#4ec9b0', fontSize: '12px' }}>
            👤 {user?.name || 'Developer'}
          </span>
          <button
            onClick={onLogout}
            style={{
              background: 'transparent',
              border: '1px solid #555555',
              color: '#cccccc',
              padding: '3px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Welcome Body */}
      <div className="vscode-welcome-body">
        <div className="vscode-welcome-content">
          {/* Left Column: Get Started */}
          <div>
            <div className="welcome-logo-section">
              <div className="welcome-logo-icon">&lt;/&gt;</div>
              <div>
                <h1 className="welcome-heading">Visual Studio Code</h1>
                <p className="welcome-subheading">Editing and collaborating evolved.</p>
              </div>
            </div>

            <div className="welcome-card-group">
              <div className="welcome-section-title">Start</div>

              <div
                className="welcome-action-item"
                onClick={() => {
                  setError('');
                  setModalMode('new');
                }}
              >
                <span>➕</span>
                <span>New Project Folder...</span>
                <span className="welcome-action-desc">Create collaborative room</span>
              </div>

              <div
                className="welcome-action-item"
                onClick={() => {
                  setError('');
                  setModalMode('join');
                }}
              >
                <span>📂</span>
                <span>Open Project Folder...</span>
                <span className="welcome-action-desc">Join with room code</span>
              </div>

              <div
                className="welcome-action-item"
                onClick={() => {
                  setRoomCodeInput('mNFSAR');
                  setModalMode('join');
                }}
              >
                <span>⭐</span>
                <span>Open Algorithms Demo Workspace</span>
                <span className="welcome-action-desc">Code: mNFSAR</span>
              </div>
            </div>

            <div className="welcome-card-group">
              <div className="welcome-section-title">Features</div>
              <div style={{ fontSize: '13px', color: '#858585', lineHeight: '1.6' }}>
                <p style={{ margin: '0 0 6px 0' }}>
                  ⚡ <strong>Live Real-time Sync:</strong> All files, folders, and edits instantly synchronize across connected browsers.
                </p>
                <p style={{ margin: '0 0 6px 0' }}>
                  🔄 <strong>Late-Joiner Synchronization:</strong> Anyone joining later automatically pulls the complete folder tree before making edits.
                </p>
                <p style={{ margin: 0 }}>
                  💻 <strong>Local Terminal Access:</strong> Run and execute your code directly using your own computer's terminal.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Recent Projects */}
          <div>
            <div className="welcome-section-title">Recent Workspaces</div>
            {recentWorkspaces.length === 0 ? (
              <div style={{ color: '#666', fontSize: '13px', fontStyle: 'italic', padding: '12px 0' }}>
                No recent workspaces. Create or join a project to get started.
              </div>
            ) : (
              <div className="recent-workspaces-list">
                {recentWorkspaces.map((recent) => (
                  <div
                    key={recent.roomCode}
                    className="recent-item"
                    onClick={() => handleOpenRecent(recent)}
                  >
                    <div>
                      <div className="recent-name">{recent.title || 'Untitled Project'}</div>
                      <div style={{ fontSize: '11px', color: '#858585' }}>
                        Opened {recent.openedAt || 'recently'}
                      </div>
                    </div>
                    <span className="recent-code">{recent.roomCode}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal for New Project / Open Project */}
      {modalMode && (
        <div className="vscode-modal-overlay" onClick={() => setModalMode(null)}>
          <div className="vscode-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="vscode-modal-title">
              {modalMode === 'new' ? 'Create New Project Workspace' : 'Open Existing Project Workspace'}
            </h3>

            {error && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                padding: '8px 12px',
                borderRadius: '4px',
                fontSize: '12px',
                marginBottom: '14px',
              }}>
                {error}
              </div>
            )}

            {modalMode === 'new' ? (
              <form onSubmit={handleCreateNewProject}>
                <div className="vscode-input-group">
                  <label className="vscode-input-label">Project / Folder Name</label>
                  <input
                    type="text"
                    className="vscode-input"
                    placeholder="e.g. My-Algorithm-Project"
                    value={projectNameInput}
                    onChange={(e) => setProjectNameInput(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="vscode-input-group">
                  <label className="vscode-input-label">Primary Language</label>
                  <select
                    className="vscode-input"
                    value={projectLanguage}
                    onChange={(e) => setProjectLanguage(e.target.value)}
                  >
                    <option value="python">Python (.py)</option>
                    <option value="javascript">JavaScript (.js)</option>
                    <option value="java">Java (.java)</option>
                    <option value="cpp">C++ (.cpp)</option>
                    <option value="html">HTML (.html)</option>
                    <option value="go">Go (.go)</option>
                  </select>
                </div>

                <div className="vscode-modal-buttons">
                  <button
                    type="button"
                    className="vscode-btn vscode-btn-secondary"
                    onClick={() => setModalMode(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="vscode-btn vscode-btn-primary"
                    disabled={loading}
                  >
                    {loading ? 'Creating...' : 'Open Workspace'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleJoinProject}>
                <div className="vscode-input-group">
                  <label className="vscode-input-label">Workspace Room Code (6 characters)</label>
                  <input
                    type="text"
                    className="vscode-input"
                    placeholder="e.g. mNFSAR"
                    value={roomCodeInput}
                    onChange={(e) => setRoomCodeInput(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="vscode-modal-buttons">
                  <button
                    type="button"
                    className="vscode-btn vscode-btn-secondary"
                    onClick={() => setModalMode(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="vscode-btn vscode-btn-primary"
                    disabled={loading}
                  >
                    {loading ? 'Opening...' : 'Open Project Folder'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
