import React, { useState, useEffect } from 'react';
import {
  Users,
  User,
  HardDrive,
  FolderPlus,
  KeyRound,
  Zap,
  RefreshCw,
  Laptop,
  Globe,
  Lock,
  LogOut,
  Folder,
} from 'lucide-react';
import { roomsApi, teamApi } from '../../services/api';
import { localFileSystem } from '../../services/localFileSystem';
import TeamModal from '../team/TeamModal';
import './VSCode.css';

export default function VSCodeWelcome({ user, onOpenWorkspace, onLogout }) {
  const [modalMode, setModalMode] = useState(null); // 'new' | 'join' | null
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [teamCount, setTeamCount] = useState(0);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  // Workspaces state
  const [teamWorkspaces, setTeamWorkspaces] = useState([]);
  const [recentWorkspaces, setRecentWorkspaces] = useState([]);

  // Form inputs
  const [projectNameInput, setProjectNameInput] = useState('');
  const [projectVisibility, setProjectVisibility] = useState('PUBLIC'); // 'PUBLIC' or 'PRIVATE'
  const [roomCodeInput, setRoomCodeInput] = useState('');
  
  // Loading and error states
  const [loading, setLoading] = useState(false);
  const [openingPcFolder, setOpeningPcFolder] = useState(false);
  const [error, setError] = useState('');

  const refreshData = async () => {
    try {
      const [teamData, incoming, teamRooms] = await Promise.all([
        teamApi.getTeam().catch(() => ({ count: 0 })),
        teamApi.getIncomingRequests().catch(() => []),
        roomsApi.getTeamRooms().catch(() => []),
      ]);
      setTeamCount(teamData.count || 0);
      setPendingRequestsCount(Array.isArray(incoming) ? incoming.length : 0);
      setTeamWorkspaces(Array.isArray(teamRooms) ? teamRooms : []);
    } catch {}
  };

  useEffect(() => {
    try {
      const recents = JSON.parse(localStorage.getItem('recentWorkspaces') || '[]');
      setRecentWorkspaces(recents);
    } catch {
      setRecentWorkspaces([]);
    }

    refreshData();
    const interval = setInterval(refreshData, 10000);
    return () => clearInterval(interval);
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
          visibility: room.visibility,
          ownerName: room.ownerName || room.ownerUsername,
          openedAt: new Date().toLocaleDateString(),
        },
        ...filtered,
      ].slice(0, 8);
      localStorage.setItem('recentWorkspaces', JSON.stringify(updated));
    } catch {}
  };

  // 1. Create New Empty Project Folder (No default language files)
  const handleCreateNewProject = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const title = projectNameInput.trim() || 'My-Project-Folder';
      const room = await roomsApi.createRoom({
        title,
        visibility: projectVisibility,
        initialTreeJson: '[]',
      });

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

  // 2. Open Folder from PC with direct native disk sync
  const handleOpenFromPc = async () => {
    setError('');
    if (!localFileSystem.isSupported()) {
      alert('Your browser does not support the File System Access API. Please open in Google Chrome, Microsoft Edge, or Opera.');
      return;
    }

    setOpeningPcFolder(true);
    try {
      const { folderName, dirHandle, tree, fileHandles, dirHandles } = await localFileSystem.openDirectory();

      const room = await roomsApi.createRoom({
        title: folderName,
        visibility: projectVisibility,
        initialTreeJson: JSON.stringify(tree),
      });

      room.localDirHandle = dirHandle;
      room.localFileHandles = fileHandles;
      room.localDirHandles = dirHandles;

      saveToRecents(room);
      if (onOpenWorkspace) {
        onOpenWorkspace(room);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Failed to open local folder from PC');
      }
    } finally {
      setOpeningPcFolder(false);
    }
  };

  // 3. Join with Room Code
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

  // 4. Open Recent or Team Workspace
  const handleOpenWorkspaceDirectly = async (workspace) => {
    setLoading(true);
    try {
      const room = await roomsApi.getRoom(workspace.roomCode);
      saveToRecents(room);
      if (onOpenWorkspace) {
        onOpenWorkspace(room);
      }
    } catch {
      onOpenWorkspace(workspace);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="vscode-welcome-container">
      {/* Top Application Bar */}
      <div className="vscode-welcome-header">
        <div className="vscode-welcome-title">
          <span style={{ color: '#007acc', fontWeight: 700, fontFamily: 'monospace' }}>&lt;/&gt;</span>
          <span style={{ fontWeight: 600 }}>CodeX Live</span>
          <span style={{ color: '#858585', fontSize: '11.5px' }}>— Collaborative IDE Workspace</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Team Members Button */}
          <button
            onClick={() => setShowTeamModal(true)}
            style={{
              background: '#007acc',
              border: 'none',
              color: '#ffffff',
              padding: '4px 10px',
              borderRadius: '4px',
              fontSize: '11.5px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.12s ease',
            }}
            title="Manage Team Members and Invitations"
          >
            <Users size={13} />
            <span>Team Members</span>
            <span style={{
              background: 'rgba(255, 255, 255, 0.22)',
              padding: '1px 6px',
              borderRadius: '10px',
              fontSize: '10.5px',
              fontWeight: 700,
            }}>
              {teamCount}
            </span>
            {pendingRequestsCount > 0 && (
              <span style={{
                background: '#ef4444',
                color: '#ffffff',
                padding: '1px 5px',
                borderRadius: '10px',
                fontSize: '10px',
                fontWeight: 700,
              }}>
                {pendingRequestsCount} new
              </span>
            )}
          </button>

          <span style={{ color: '#4ec9b0', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <User size={13} />
            <span>@{user?.username || user?.name || 'Developer'}</span>
            {user?.id && <span style={{ color: '#858585', fontSize: '11px' }}>#{user.id}</span>}
          </span>

          <button
            onClick={onLogout}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#cccccc',
              padding: '3px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <LogOut size={12} />
            <span>Sign Out</span>
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
                <h1 className="welcome-heading">CodeX Live</h1>
                <p className="welcome-subheading">Minimalist, real-time collaborative development environment.</p>
              </div>
            </div>

            <div className="welcome-card-group">
              <div className="welcome-section-title">Start</div>

              {/* Team Management */}
              <div
                className="welcome-action-item"
                onClick={() => setShowTeamModal(true)}
              >
                <Users size={16} />
                <span>
                  Team Members ({teamCount})
                  {pendingRequestsCount > 0 && (
                    <span style={{
                      marginLeft: '8px',
                      background: '#ef4444',
                      color: 'white',
                      fontSize: '10px',
                      padding: '1px 6px',
                      borderRadius: '10px',
                      fontWeight: 700,
                    }}>
                      {pendingRequestsCount} pending
                    </span>
                  )}
                </span>
                <span className="welcome-action-desc">
                  {pendingRequestsCount > 0
                    ? `${pendingRequestsCount} invitation(s) pending`
                    : 'Manage collaborators'}
                </span>
              </div>

              {/* 1. Open Local Folder from PC */}
              <div
                className="welcome-action-item"
                onClick={handleOpenFromPc}
                style={{ borderLeft: '2px solid #4ade80' }}
              >
                <HardDrive size={16} color="#4ade80" />
                <span style={{ color: '#4ade80', fontWeight: 600 }}>
                  {openingPcFolder ? 'Scanning Folder...' : 'Open Folder from PC...'}
                </span>
                <span className="welcome-action-desc">
                  Direct live disk sync
                </span>
              </div>

              {/* 2. New Clean Project Folder */}
              <div
                className="welcome-action-item"
                onClick={() => {
                  setError('');
                  setModalMode('new');
                }}
              >
                <FolderPlus size={16} />
                <span>New Project Folder...</span>
                <span className="welcome-action-desc">Clean folder (Public / Private)</span>
              </div>

              {/* 3. Open by Room Code */}
              <div
                className="welcome-action-item"
                onClick={() => {
                  setError('');
                  setModalMode('join');
                }}
              >
                <KeyRound size={16} />
                <span>Join with Room Code...</span>
                <span className="welcome-action-desc">Enter 6-character code</span>
              </div>
            </div>

            <div className="welcome-card-group">
              <div className="welcome-section-title">Features</div>
              <div style={{ fontSize: '12.5px', color: '#858585', lineHeight: '1.6' }}>
                <p style={{ margin: '0 0 6px 0' }}>
                  <HardDrive size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />
                  <strong>Real-Time PC Disk Sync:</strong> Open any folder from your computer. Edits automatically write to your hard drive.
                </p>
                <p style={{ margin: '0 0 6px 0' }}>
                  <Users size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />
                  <strong>Team Workspaces:</strong> Public projects are automatically discoverable by your teammates.
                </p>
                <p style={{ margin: 0 }}>
                  <Folder size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />
                  <strong>Clean Folders:</strong> Create empty project folders and add custom files with any extension.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Team Workspaces & Recents */}
          <div>
            {/* Team Public Workspaces Section */}
            <div className="welcome-section-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Team Workspaces (Public)</span>
              <span style={{ fontSize: '11px', color: '#60a5fa', fontWeight: 500 }}>
                {teamWorkspaces.length} available
              </span>
            </div>

            {teamWorkspaces.length === 0 ? (
              <div style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px dashed rgba(255, 255, 255, 0.08)',
                borderRadius: '4px',
                padding: '14px',
                color: '#858585',
                fontSize: '12px',
                marginBottom: '24px',
              }}>
                No public projects from your team members yet. When teammates create a public project, it will appear here for instant collaboration!
              </div>
            ) : (
              <div className="recent-workspaces-list" style={{ marginBottom: '24px' }}>
                {teamWorkspaces.map((room) => (
                  <div
                    key={room.roomCode}
                    className="recent-item"
                    onClick={() => handleOpenWorkspaceDirectly(room)}
                    style={{ borderLeft: '2px solid #007acc' }}
                  >
                    <div>
                      <div className="recent-name" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{room.title || 'Untitled Workspace'}</span>
                        <span style={{
                          background: 'rgba(59, 130, 246, 0.15)',
                          color: '#60a5fa',
                          fontSize: '10px',
                          padding: '1px 5px',
                          borderRadius: '3px',
                        }}>
                          Team Public
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#858585', marginTop: '2px' }}>
                        Owner: @{room.ownerUsername || room.ownerName || 'teammate'} • Code: {room.roomCode}
                      </div>
                    </div>
                    <button
                      style={{
                        background: '#007acc',
                        border: 'none',
                        color: 'white',
                        padding: '3px 8px',
                        borderRadius: '3px',
                        fontSize: '11px',
                        fontWeight: 500,
                        cursor: 'pointer',
                      }}
                    >
                      Join
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Recent Workspaces Section */}
            <div className="welcome-section-title">Recent Workspaces</div>
            {recentWorkspaces.length === 0 ? (
              <div style={{ color: '#666', fontSize: '12px', fontStyle: 'italic', padding: '10px 0' }}>
                No recent workspaces. Open a folder from your PC or create a new project.
              </div>
            ) : (
              <div className="recent-workspaces-list">
                {recentWorkspaces.map((recent) => (
                  <div
                    key={recent.roomCode}
                    className="recent-item"
                    onClick={() => handleOpenWorkspaceDirectly(recent)}
                  >
                    <div>
                      <div className="recent-name">{recent.title || 'Untitled Project'}</div>
                      <div style={{ fontSize: '11px', color: '#858585' }}>
                        Opened {recent.openedAt || 'recently'}
                        {recent.visibility && (
                          <span style={{ marginLeft: '6px', color: recent.visibility === 'PUBLIC' ? '#60a5fa' : '#858585' }}>
                            • {recent.visibility === 'PUBLIC' ? 'Public' : 'Private'}
                          </span>
                        )}
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

      {/* Modal for New Project / Join Project */}
      {modalMode && (
        <div className="vscode-modal-overlay" onClick={() => setModalMode(null)}>
          <div className="vscode-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="vscode-modal-title">
              {modalMode === 'new' ? 'Create New Project Folder' : 'Join Existing Workspace'}
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
                    placeholder="e.g. My-Algorithms-Project"
                    value={projectNameInput}
                    onChange={(e) => setProjectNameInput(e.target.value)}
                    autoFocus
                  />
                  <span style={{ fontSize: '11px', color: '#858585', marginTop: '4px', display: 'block' }}>
                    Creates a clean folder. You can add any file type inside the editor explorer.
                  </span>
                </div>

                {/* Visibility Options */}
                <div className="vscode-input-group">
                  <label className="vscode-input-label">Workspace Visibility</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                        background: projectVisibility === 'PUBLIC' ? 'rgba(0, 122, 204, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                        border: `1px solid ${projectVisibility === 'PUBLIC' ? '#007acc' : 'rgba(255, 255, 255, 0.08)'}`,
                        borderRadius: '4px',
                        padding: '10px 12px',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="radio"
                        name="visibility"
                        value="PUBLIC"
                        checked={projectVisibility === 'PUBLIC'}
                        onChange={() => setProjectVisibility('PUBLIC')}
                        style={{ marginTop: '2px' }}
                      />
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <Globe size={13} color="#60a5fa" />
                          <span>Public to Team (Recommended)</span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#858585', marginTop: '2px' }}>
                          All accepted team members can see and open this project directly.
                        </div>
                      </div>
                    </label>

                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                        background: projectVisibility === 'PRIVATE' ? 'rgba(0, 122, 204, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                        border: `1px solid ${projectVisibility === 'PRIVATE' ? '#007acc' : 'rgba(255, 255, 255, 0.08)'}`,
                        borderRadius: '4px',
                        padding: '10px 12px',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="radio"
                        name="visibility"
                        value="PRIVATE"
                        checked={projectVisibility === 'PRIVATE'}
                        onChange={() => setProjectVisibility('PRIVATE')}
                        style={{ marginTop: '2px' }}
                      />
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <Lock size={13} color="#858585" />
                          <span>Private</span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#858585', marginTop: '2px' }}>
                          Only you can see this project. Others must be given the room code.
                        </div>
                      </div>
                    </label>
                  </div>
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
                    {loading ? 'Creating...' : 'Create Folder'}
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

      {/* Team Modal */}
      {showTeamModal && (
        <TeamModal
          user={user}
          onClose={() => setShowTeamModal(false)}
          onTeamUpdated={(newCount, newPendingCount) => {
            setTeamCount(newCount);
            if (newPendingCount !== undefined) {
              setPendingRequestsCount(newPendingCount);
            }
            refreshData();
          }}
        />
      )}
    </div>
  );
}
