import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, RotateCw, ExternalLink, Trash2, Bug } from 'lucide-react';
import { processService } from '../../services/native/process';
import { isDesktopApp } from '../../services/native/platform';

export default function ProcessConsole({ projectRoot }) {
  const [processes, setProcesses] = useState([]);
  const [selectedProcessId, setSelectedProcessId] = useState(null);
  const [logsByProcess, setLogsByProcess] = useState({});
  const logEndRef = useRef(null);

  const isDesktop = isDesktopApp();

  const refreshProcesses = async () => {
    if (!isDesktop) return;
    try {
      const list = await processService.listProcesses();
      setProcesses(list);
      if (list.length > 0 && !selectedProcessId) {
        setSelectedProcessId(list[0].id);
      }
    } catch {}
  };

  useEffect(() => {
    refreshProcesses();
    const interval = setInterval(refreshProcesses, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleStop = async (id) => {
    await processService.stopProcess(id);
    refreshProcesses();
  };

  const handleClear = (id) => {
    setLogsByProcess((prev) => ({
      ...prev,
      [id]: [],
    }));
  };

  const currentProcess = processes.find((p) => p.id === selectedProcessId);
  const currentLogs = (selectedProcessId && logsByProcess[selectedProcessId]) || [];

  if (!isDesktop) {
    return (
      <div className="panel-empty-state">
        <Bug size={24} color="#858585" />
        <span>Process execution is supported in the CodeX Desktop application.</span>
      </div>
    );
  }

  if (processes.length === 0) {
    return (
      <div className="panel-empty-state">
        <Bug size={24} color="#858585" />
        <span>No background processes currently running. Start a run configuration from the Run & Debug activity tab.</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      {/* Header bar with process selector & controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '28px',
          padding: '0 8px',
          backgroundColor: '#1e1e1e',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          fontSize: '11.5px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <select
            value={selectedProcessId || ''}
            onChange={(e) => setSelectedProcessId(e.target.value)}
            style={{
              backgroundColor: '#2d2d2d',
              color: '#cccccc',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '3px',
              padding: '2px 6px',
              fontSize: '11px',
              outline: 'none',
            }}
          >
            {processes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.status})
              </option>
            ))}
          </select>

          {currentProcess && (
            <span
              style={{
                fontSize: '10.5px',
                color: currentProcess.status === 'running' ? '#4ade80' : '#888888',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: currentProcess.status === 'running' ? '#4ade80' : '#888888',
                }}
              />
              {currentProcess.status.toUpperCase()}
              {currentProcess.pid ? ` • PID: ${currentProcess.pid}` : ''}
            </span>
          )}

          {currentProcess?.ports && currentProcess.ports.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '6px' }}>
              {currentProcess.ports.map((port) => (
                <a
                  key={port}
                  href={`http://localhost:${port}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    fontSize: '10.5px',
                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                    color: '#60a5fa',
                    padding: '1px 6px',
                    borderRadius: '3px',
                    textDecoration: 'none',
                  }}
                >
                  <ExternalLink size={10} />
                  <span>http://localhost:{port}</span>
                </a>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {currentProcess && currentProcess.status === 'running' && (
            <button
              type="button"
              onClick={() => handleStop(currentProcess.id)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#f87171',
                cursor: 'pointer',
                padding: '2px 4px',
              }}
              title="Stop Process"
            >
              <Square size={12} fill="currentColor" />
            </button>
          )}

          {selectedProcessId && (
            <button
              type="button"
              onClick={() => handleClear(selectedProcessId)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#999999',
                cursor: 'pointer',
                padding: '2px 4px',
              }}
              title="Clear Logs"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Logs Viewport */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '12px',
          lineHeight: '1.5',
          color: '#d4d4d4',
          backgroundColor: '#141414',
        }}
      >
        {currentLogs.length === 0 ? (
          <div style={{ color: '#666666', fontStyle: 'italic' }}>No logs recorded yet.</div>
        ) : (
          currentLogs.map((log, i) => <div key={i}>{log}</div>)
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  );
}
