import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Terminal as TerminalIcon,
  AlertCircle,
  FileText,
  Bug,
  X,
  Trash2,
  Maximize2,
  Minimize2,
  Play,
  Square,
  RotateCw,
  Users,
  Loader2,
} from 'lucide-react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { stompService } from '../../services/stompService';
import { terminalApi } from '../../services/api';
import { isDesktopApp } from '../../services/native/platform';
import TerminalPanel from './terminal/TerminalPanel';
import ProcessConsole from './ProcessConsole';

export default function BottomPanel({
  isOpen,
  onClose,
  activeTab = 'terminal',
  onTabChange,
  room,
  user,
}) {
  const [currentTab, setCurrentTab] = useState(activeTab || 'terminal');
  const [isMaximized, setIsMaximized] = useState(false);
  const [panelHeight, setPanelHeight] = useState(() => {
    const saved = localStorage.getItem('codex_bottom_panel_height');
    return saved ? parseInt(saved, 10) : 240;
  });
  const [isResizing, setIsResizing] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [startedBy, setStartedBy] = useState('');
  const [hostUsername, setHostUsername] = useState('');

  const terminalContainerRef = useRef(null);
  const xtermRef = useRef(null);
  const fitAddonRef = useRef(null);
  const isRunningRef = useRef(false);

  const currentUsername = user?.username || user?.name || 'developer';
  const isDesktop = isDesktopApp();

  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  useEffect(() => {
    if (activeTab) {
      setCurrentTab(activeTab);
    }
  }, [activeTab]);

  // Query backend state on mount or room change (Web only)
  const checkTerminalState = useCallback(async () => {
    if (isDesktop || !room?.roomCode) return;
    try {
      const state = await terminalApi.getState(room.roomCode);
      if (state) {
        setIsRunning(Boolean(state.running));
        if (state.startedBy) setStartedBy(state.startedBy);
        if (state.hostUsername) setHostUsername(state.hostUsername);
        if (state.running && xtermRef.current && state.data) {
          xtermRef.current.write(state.data);
        }
      }
    } catch {
      // fallback to stomp
      stompService.sendTerminalInit(room.roomCode, currentUsername);
    }
  }, [room?.roomCode, currentUsername]);

  useEffect(() => {
    if (isOpen && currentTab === 'terminal') {
      checkTerminalState();
    }
  }, [isOpen, currentTab, checkTerminalState]);

  const pendingHistoryRef = useRef('');

  // Subscribe to STOMP Terminal events (Web only)
  useEffect(() => {
    if (isDesktop || !room?.roomCode) return;

    const sub = stompService.subscribeTerminal(room.roomCode, (msg) => {
      if (msg.hostUsername) setHostUsername(msg.hostUsername);
      if (msg.startedBy) setStartedBy(msg.startedBy);

      if (msg.type === 'STARTED') {
        setIsRunning(true);
        setIsStarting(false);
        if (msg.data) {
          if (xtermRef.current) {
            xtermRef.current.write(msg.data);
          } else {
            pendingHistoryRef.current = (pendingHistoryRef.current || '') + msg.data;
          }
        }
      } else if (msg.type === 'STOPPED') {
        setIsRunning(false);
        setIsStarting(false);
        pendingHistoryRef.current = '';
        if (xtermRef.current) {
          try {
            xtermRef.current.dispose();
          } catch {}
          xtermRef.current = null;
        }
      } else if (msg.type === 'INIT') {
        const running = Boolean(msg.running);
        setIsRunning(running);
        if (running) {
          if (xtermRef.current) {
            xtermRef.current.reset();
            if (msg.data) {
              xtermRef.current.write(msg.data);
            }
          } else if (msg.data) {
            pendingHistoryRef.current = msg.data;
          }
        }
      } else if (msg.type === 'OUTPUT' || msg.type === 'STATUS') {
        if (msg.data) {
          if (xtermRef.current) {
            xtermRef.current.write(msg.data);
          } else {
            pendingHistoryRef.current = (pendingHistoryRef.current || '') + msg.data;
          }
        }
      }
    });

    return () => {
      stompService.unsubscribeTerminal();
    };
  }, [room?.roomCode]);

  const focusTerminal = useCallback(() => {
    if (xtermRef.current) {
      try {
        xtermRef.current.focus();
      } catch {}
    }
  }, []);

  // Auto-focus terminal whenever terminal tab is visible & active
  useEffect(() => {
    if (isOpen && currentTab === 'terminal' && isRunning) {
      const timer = setTimeout(() => {
        focusTerminal();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, currentTab, isRunning, focusTerminal]);

  // Mount xterm when isRunning is true and terminal container is available (Web only)
  useEffect(() => {
    if (isDesktop || !isOpen || currentTab !== 'terminal' || !isRunning || !terminalContainerRef.current) {
      return;
    }

    if (!xtermRef.current) {
      const term = new Terminal({
        cursorBlink: true,
        cursorStyle: 'block',
        fontSize: 12.5,
        lineHeight: 1.25,
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Menlo', 'Monaco', 'Courier New', monospace",
        theme: {
          background: '#141414',
          foreground: '#cccccc',
          cursor: '#528bff',
          cursorAccent: '#141414',
          selectionBackground: 'rgba(0, 122, 204, 0.4)',
          black: '#000000',
          red: '#cd3131',
          green: '#0dbc79',
          yellow: '#e5e510',
          blue: '#2472c8',
          magenta: '#bc3fbc',
          cyan: '#11a8cd',
          white: '#e5e5e5',
          brightBlack: '#666666',
          brightRed: '#f14c4c',
          brightGreen: '#23d18b',
          brightYellow: '#f5f543',
          brightBlue: '#3b8eea',
          brightMagenta: '#d670d6',
          brightCyan: '#29b8db',
          brightWhite: '#e5e5e5',
        },
        convertEol: true,
        scrollback: 10000,
        allowProposedApi: true,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(terminalContainerRef.current);

      xtermRef.current = term;
      fitAddonRef.current = fitAddon;

      // Automatically focus terminal so user can type immediately
      setTimeout(() => {
        try {
          term.focus();
        } catch {}
      }, 80);

      // Handle user keystrokes — collaborative write for ALL room members
      term.onData((data) => {
        if (room?.roomCode) {
          stompService.sendTerminalInput(room.roomCode, data, currentUsername);
        }
      });

      // Write any pending data received before container mount
      if (pendingHistoryRef.current) {
        term.write(pendingHistoryRef.current);
        pendingHistoryRef.current = '';
      } else {
        // Fetch latest state via REST directly and write to ensure no dropped initial banner
        terminalApi.getState(room.roomCode).then((state) => {
          if (state?.data && xtermRef.current) {
            xtermRef.current.write(state.data);
          }
          setTimeout(() => {
            try {
              fitAddon.fit();
            } catch {}
          }, 30);
        }).catch(() => {});
      }

      // Request buffered history from backend via STOMP as well
      stompService.sendTerminalInit(room.roomCode, currentUsername);
    }

    const fitTimer = setTimeout(() => {
      try {
        fitAddonRef.current?.fit();
      } catch {}
    }, 60);

    const handleResize = () => {
      try {
        fitAddonRef.current?.fit();
      } catch {}
    };

    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(fitTimer);
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen, currentTab, isRunning, room?.roomCode, currentUsername]);

  // Fit when maximized/restored or height resized
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        fitAddonRef.current?.fit();
      } catch {}
    }, 50);
    return () => clearTimeout(timer);
  }, [panelHeight, isMaximized]);

  // Handle Drag Resizing of Bottom Panel (like VS Code)
  const handleStartResize = (e) => {
    e.preventDefault();
    setIsResizing(true);
    const startY = e.clientY;
    const startHeight = panelHeight;

    const handleMouseMove = (moveEvent) => {
      // Moving up increases panel height; moving down decreases panel height
      const deltaY = startY - moveEvent.clientY;
      const minHeight = 90;
      const maxHeight = Math.max(minHeight, window.innerHeight - 100);
      const nextHeight = Math.min(Math.max(minHeight, startHeight + deltaY), maxHeight);
      setPanelHeight(nextHeight);
      try {
        fitAddonRef.current?.fit();
      } catch {}
    };

    const handleMouseUp = (upEvent) => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      const deltaY = startY - upEvent.clientY;
      const minHeight = 90;
      const maxHeight = Math.max(minHeight, window.innerHeight - 100);
      const finalHeight = Math.min(Math.max(minHeight, startHeight + deltaY), maxHeight);
      localStorage.setItem('codex_bottom_panel_height', String(finalHeight));
      setTimeout(() => {
        try {
          fitAddonRef.current?.fit();
        } catch {}
      }, 50);
    };

    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Start Terminal Session (can be triggered by ANY room member)
  const handleStartTerminal = async () => {
    if (!room?.roomCode || isStarting) return;
    setIsStarting(true);
    try {
      stompService.sendTerminalStart(room.roomCode, currentUsername);
      await terminalApi.start(room.roomCode).catch(() => null);
    } finally {
      setTimeout(() => setIsStarting(false), 800);
    }
  };

  // Stop Terminal Session
  const handleStopTerminal = async () => {
    if (!room?.roomCode) return;
    stompService.sendTerminalStop(room.roomCode, currentUsername);
    await terminalApi.stop(room.roomCode).catch(() => null);
  };

  // Restart Terminal Session
  const handleRestartTerminal = async () => {
    if (!room?.roomCode) return;
    await handleStopTerminal();
    setTimeout(() => {
      handleStartTerminal();
    }, 300);
  };

  // Clear Terminal Viewport
  const handleClearTerminal = () => {
    if (xtermRef.current) {
      xtermRef.current.clear();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={`vscode-bottom-panel ${isMaximized ? 'maximized' : ''} ${isResizing ? 'resizing' : ''}`}
      style={!isMaximized ? { height: `${panelHeight}px` } : {}}
    >
      {/* Top Resize Handle Bar (VS Code style) */}
      <div
        className={`bottom-panel-resizer ${isResizing ? 'resizing' : ''}`}
        onMouseDown={handleStartResize}
        onDoubleClick={() => setIsMaximized((prev) => !prev)}
        title="Drag up/down to resize panel • Double-click to toggle maximize"
      />
      {/* Panel Tab Header */}
      <div className="bottom-panel-header">
        <div className="bottom-panel-tabs">
          <button
            className={`bottom-panel-tab ${currentTab === 'terminal' ? 'active' : ''}`}
            onClick={() => {
              setCurrentTab('terminal');
              if (onTabChange) onTabChange('terminal');
            }}
          >
            <TerminalIcon size={13} />
            <span>TERMINAL</span>
          </button>

          <button
            className={`bottom-panel-tab ${currentTab === 'problems' ? 'active' : ''}`}
            onClick={() => {
              setCurrentTab('problems');
              if (onTabChange) onTabChange('problems');
            }}
          >
            <AlertCircle size={13} />
            <span>PROBLEMS</span>
            <span className="panel-badge-zero">0</span>
          </button>

          <button
            className={`bottom-panel-tab ${currentTab === 'output' ? 'active' : ''}`}
            onClick={() => {
              setCurrentTab('output');
              if (onTabChange) onTabChange('output');
            }}
          >
            <FileText size={13} />
            <span>OUTPUT</span>
          </button>

          <button
            className={`bottom-panel-tab ${currentTab === 'debug' ? 'active' : ''}`}
            onClick={() => {
              setCurrentTab('debug');
              if (onTabChange) onTabChange('debug');
            }}
          >
            <Bug size={13} />
            <span>DEBUG CONSOLE</span>
          </button>
        </div>

        {/* Panel Right Actions & Live Share Controls */}
        <div className="bottom-panel-actions">
          {currentTab === 'terminal' && (
            <div className="terminal-header-controls">
              {isDesktop ? (
                <div
                  className="terminal-live-share-pill running"
                  title="Local PTY Terminal Engine (Host OS Shell)"
                >
                  <span className="live-dot" style={{ backgroundColor: '#22c55e' }} />
                  <span className="live-label">LOCAL • PTY</span>
                </div>
              ) : isRunning ? (
                <>
                  <div
                    className="terminal-live-share-pill running"
                    title={`Live Shared Native Terminal • Active on host PC (started by @${startedBy || 'teammate'})`}
                  >
                    <span className="live-dot" />
                    <span className="live-label">RUNNING • SHARED</span>
                  </div>

                  <div
                    className="terminal-permission-badge interactive"
                    title="All room members have interactive command execution access"
                  >
                    <Users size={11} />
                    <span>Interactive for All</span>
                  </div>

                  <button
                    type="button"
                    className="btn-terminal-action"
                    title="Restart Terminal Session"
                    onClick={handleRestartTerminal}
                  >
                    <RotateCw size={12} />
                  </button>

                  <button
                    type="button"
                    className="btn-terminal-action danger"
                    title="Stop Terminal Process"
                    onClick={handleStopTerminal}
                  >
                    <Square size={12} fill="currentColor" />
                  </button>

                  <button
                    type="button"
                    className="btn-terminal-action"
                    title="Clear Terminal Screen"
                    onClick={handleClearTerminal}
                  >
                    <Trash2 size={12} />
                  </button>
                </>
              ) : (
                <div className="terminal-live-share-pill stopped" title="Terminal is currently offline">
                  <span className="live-dot" />
                  <span className="live-label">NOT RUNNING</span>
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            className="panel-action-btn"
            title={isMaximized ? 'Restore Panel' : 'Maximize Panel'}
            onClick={() => setIsMaximized(!isMaximized)}
          >
            {isMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
          <button type="button" className="panel-action-btn" title="Close Panel" onClick={onClose}>
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Panel Body */}
      <div
        className="bottom-panel-body"
        style={
          currentTab === 'terminal'
            ? {
                padding: '2px 4px',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                height: 'calc(100% - 32px)',
                minHeight: 0,
              }
            : {}
        }
      >
        {currentTab === 'terminal' && (
          isDesktop ? (
            <TerminalPanel projectRoot={room?.diskPath || null} />
          ) : (
            <div
              className="panel-terminal-view"
              onClick={focusTerminal}
              onMouseDown={focusTerminal}
              style={{
                flex: 1,
                height: '100%',
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                overflow: 'hidden',
                cursor: 'text',
              }}
            >
              {isRunning ? (
                <div
                  ref={terminalContainerRef}
                  className="xterm-terminal-container"
                  onClick={focusTerminal}
                  onMouseDown={focusTerminal}
                  tabIndex={0}
                  style={{
                    flex: 1,
                    width: '100%',
                    height: '100%',
                    minHeight: '80px',
                    position: 'relative',
                    outline: 'none',
                  }}
                />
              ) : (
                <div className="terminal-idle-state">
                  <div className="terminal-idle-card">
                    <div className="terminal-idle-icon-wrapper">
                      <TerminalIcon size={26} />
                    </div>
                    <div className="terminal-idle-title">Terminal is not running</div>
                    <div className="terminal-idle-subtitle">
                      Project Workspace: <code>{room?.title || 'Current Project'}</code>
                    </div>
                    <div className="terminal-idle-description">
                      Start an interactive native shell in your project's physical folder. Anyone in this room can start the terminal, and once started, it is visible and fully interactive for all teammates.
                    </div>
                    <button
                      type="button"
                      className="btn-start-terminal"
                      onClick={handleStartTerminal}
                      disabled={isStarting}
                    >
                      {isStarting ? (
                        <>
                          <Loader2 size={14} className="spin" />
                          <span>Starting Terminal...</span>
                        </>
                      ) : (
                        <>
                          <Play size={14} fill="currentColor" />
                          <span>Start Terminal</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        )}

        {currentTab === 'problems' && (
          <div className="panel-empty-state">
            <AlertCircle size={24} color="#858585" />
            <span>No problems have been detected in the workspace.</span>
          </div>
        )}

        {currentTab === 'output' && (
          <div className="panel-output-view">
            <div>[LiveSync] Connected to collaborative room: {room?.roomCode}</div>
            <div>[Storage] PostgreSQL synchronization active (debounced 1.5s)</div>
            <div>[Terminal] {isDesktop ? 'Local PTY Engine Active (Isolated)' : 'Native ZSH session bridge ready'}</div>
            <div>[Status] {isDesktop ? 'Native Desktop Terminal session' : (isRunning ? 'Terminal is RUNNING and shared with all members' : 'Terminal is STOPPED')}</div>
            <div>[Protocol] STOMP v1.2 over SockJS WebSocket transport</div>
            <div>[User] Active user: @{currentUsername}</div>
          </div>
        )}

        {currentTab === 'debug' && (
          <ProcessConsole projectRoot={room?.diskPath || null} />
        )}
      </div>
    </div>
  );
}
