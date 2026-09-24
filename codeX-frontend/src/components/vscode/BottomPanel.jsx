import React, { useState } from 'react';
import { Terminal, AlertCircle, FileText, Bug, X, Trash2, Maximize2, Minimize2 } from 'lucide-react';

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
  const [terminalHistory, setTerminalHistory] = useState([
    `CodeX Live Integrated Terminal v1.0`,
    `Connected to workspace "${room.title}" [Room: ${room.roomCode}]`,
    `User: @${user?.username || user?.name || 'developer'}`,
    `Type commands below (local execution bridge ready)`,
  ]);
  const [terminalInput, setTerminalInput] = useState('');

  if (!isOpen) return null;

  const handleTerminalSubmit = (e) => {
    e.preventDefault();
    const cmd = terminalInput.trim();
    if (!cmd) return;

    if (cmd === 'clear' || cmd === 'cls') {
      setTerminalHistory([]);
      setTerminalInput('');
      return;
    }

    const output = [
      ...terminalHistory,
      `~/workspace $ ${cmd}`,
    ];

    if (cmd === 'help') {
      output.push('Available commands: help, status, pwd, ls, clear');
    } else if (cmd === 'status') {
      output.push(`Room: ${room.roomCode} | Visibility: ${room.visibility || 'PRIVATE'}`);
    } else if (cmd === 'pwd') {
      output.push(`/Users/${user?.username || 'developer'}/${room.title}`);
    } else if (cmd === 'ls') {
      output.push('src/  package.json  README.md');
    } else {
      output.push(`Executed: ${cmd}`);
    }

    setTerminalHistory(output);
    setTerminalInput('');
  };

  const clearHistory = () => {
    setTerminalHistory([]);
  };

  return (
    <div className={`vscode-bottom-panel ${isMaximized ? 'maximized' : ''}`}>
      {/* Panel Tab Header */}
      <div className="bottom-panel-header">
        <div className="bottom-panel-tabs">
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
            className={`bottom-panel-tab ${currentTab === 'terminal' ? 'active' : ''}`}
            onClick={() => {
              setCurrentTab('terminal');
              if (onTabChange) onTabChange('terminal');
            }}
          >
            <Terminal size={13} />
            <span>TERMINAL</span>
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

        {/* Panel Right Actions */}
        <div className="bottom-panel-actions">
          {currentTab === 'terminal' && (
            <button className="panel-action-btn" title="Clear Terminal" onClick={clearHistory}>
              <Trash2 size={13} />
            </button>
          )}
          <button
            className="panel-action-btn"
            title={isMaximized ? 'Restore Panel' : 'Maximize Panel'}
            onClick={() => setIsMaximized(!isMaximized)}
          >
            {isMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
          <button className="panel-action-btn" title="Close Panel" onClick={onClose}>
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Panel Body */}
      <div className="bottom-panel-body">
        {currentTab === 'terminal' && (
          <div className="panel-terminal-view">
            <div className="terminal-lines">
              {terminalHistory.map((line, idx) => (
                <div key={idx} className="terminal-line">
                  {line.startsWith('~/workspace $') ? (
                    <span>
                      <span className="terminal-prompt">~/workspace $ </span>
                      <span className="terminal-command">{line.replace('~/workspace $ ', '')}</span>
                    </span>
                  ) : (
                    <span>{line}</span>
                  )}
                </div>
              ))}
            </div>

            <form onSubmit={handleTerminalSubmit} className="terminal-input-form">
              <span className="terminal-prompt">~/workspace $ </span>
              <input
                type="text"
                className="terminal-input"
                value={terminalInput}
                onChange={(e) => setTerminalInput(e.target.value)}
                autoFocus
                placeholder="type a command..."
              />
            </form>
          </div>
        )}

        {currentTab === 'problems' && (
          <div className="panel-empty-state">
            <AlertCircle size={24} color="#858585" />
            <span>No problems have been detected in the workspace.</span>
          </div>
        )}

        {currentTab === 'output' && (
          <div className="panel-output-view">
            <div>[LiveSync] Connected to collaborative room: {room.roomCode}</div>
            <div>[Storage] PostgreSQL synchronization active (debounced 1.5s)</div>
            <div>[STOMP] Protocol STOMP v1.2 over SockJS WebSocket transport</div>
            <div>[Presence] Active user: @{user?.username || user?.name || 'developer'}</div>
          </div>
        )}

        {currentTab === 'debug' && (
          <div className="panel-empty-state">
            <Bug size={24} color="#858585" />
            <span>Debug session idle. Start debugging from the activity bar.</span>
          </div>
        )}
      </div>
    </div>
  );
}
