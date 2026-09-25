import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, RotateCw, ExternalLink, Trash2, Bug, Terminal, ChevronRight } from 'lucide-react';
import { processService } from '../../services/native/process';
import { isDesktopApp } from '../../services/native/platform';
import { debuggerManager } from '../../debugger/debuggerManager.js';
import { DebugSessionState } from '../../debugger/debugTypes.js';

export default function ProcessConsole({ projectRoot }) {
  const [processes, setProcesses] = useState([]);
  const [selectedProcessId, setSelectedProcessId] = useState(null);
  const [logsByProcess, setLogsByProcess] = useState({});
  const [debugLogs, setDebugLogs] = useState([]);
  const [evalInput, setEvalInput] = useState('');
  const [isDebugging, setIsDebugging] = useState(false);
  const logEndRef = useRef(null);

  const isDesktop = isDesktopApp();

  const refreshProcesses = async () => {
    if (!isDesktop) return;
    try {
      const list = await processService.listProcesses();
      setProcesses(list);
      if (list.length > 0 && !selectedProcessId && selectedProcessId !== 'debug-session') {
        setSelectedProcessId(list[0].id);
      }
    } catch {}
  };

  useEffect(() => {
    refreshProcesses();
    const interval = setInterval(refreshProcesses, 3000);
    return () => clearInterval(interval);
  }, []);

  // Subscribe to Debugger Manager events & logs
  useEffect(() => {
    const unsub = debuggerManager.onStateChange((state) => {
      setIsDebugging(state.isDebugging);
      if (state.isDebugging) {
        setSelectedProcessId('debug-session');
        const session = debuggerManager.getActiveSession();
        if (session) {
          setDebugLogs([...session.outputLogs]);
        }
      }
    });

    const session = debuggerManager.getActiveSession();
    if (session) {
      setIsDebugging(session.state !== DebugSessionState.STOPPED);
      setDebugLogs([...session.outputLogs]);
      const sessionUnsub = session.onEvent((type, data) => {
        if (type === 'output') {
          setDebugLogs((prev) => [...prev, data]);
        } else if (type === 'terminated') {
          setDebugLogs((prev) => [
            ...prev,
            { id: `term-${Date.now()}`, category: 'console', text: '[Debugger Session Terminated]\n' },
          ]);
        }
      });
      return () => {
        unsub();
        sessionUnsub();
      };
    }

    return unsub;
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [debugLogs, logsByProcess, selectedProcessId]);

  const handleStop = async (id) => {
    if (id === 'debug-session') {
      await debuggerManager.stop();
    } else {
      await processService.stopProcess(id);
      refreshProcesses();
    }
  };

  const handleClear = (id) => {
    if (id === 'debug-session') {
      setDebugLogs([]);
    } else {
      setLogsByProcess((prev) => ({
        ...prev,
        [id]: [],
      }));
    }
  };

  const handleEvalSubmit = async (e) => {
    e.preventDefault();
    if (!evalInput.trim()) return;

    const expr = evalInput.trim();
    setEvalInput('');

    const session = debuggerManager.getActiveSession();
    if (!session) {
      setDebugLogs((prev) => [
        ...prev,
        { id: `eval-${Date.now()}`, category: 'stderr', text: 'No active debug session.\n' },
      ]);
      return;
    }

    setDebugLogs((prev) => [
      ...prev,
      { id: `in-${Date.now()}`, category: 'input', text: `> ${expr}\n` },
    ]);

    const res = await session.evaluate(expr);
    if (res) {
      setDebugLogs((prev) => [
        ...prev,
        {
          id: `res-${Date.now()}`,
          category: res.isError ? 'stderr' : 'result',
          text: `${res.result || res}\n`,
        },
      ]);
    }
  };

  const isDebugSessionSelected = selectedProcessId === 'debug-session';
  const currentProcess = processes.find((p) => p.id === selectedProcessId);
  const currentLogs = isDebugSessionSelected
    ? debugLogs
    : (selectedProcessId && logsByProcess[selectedProcessId]) || [];

  if (!isDesktop) {
    return (
      <div className="panel-empty-state">
        <Bug size={24} color="#858585" />
        <span>Debugging and process execution operate in the CodeX Desktop application.</span>
      </div>
    );
  }

  const hasAnySources = isDebugging || processes.length > 0;

  if (!hasAnySources) {
    return (
      <div className="panel-empty-state">
        <Bug size={24} color="#858585" />
        <span>No active debug session or background processes. Start debugging with F5 or run a script from the sidebar.</span>
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
            {isDebugging && (
              <option value="debug-session">
                Debugger Console (Node.js)
              </option>
            )}
            {processes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.status})
              </option>
            ))}
          </select>

          {isDebugSessionSelected ? (
            <span
              style={{
                fontSize: '10.5px',
                color: isDebugging ? '#4ade80' : '#888888',
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
                  backgroundColor: isDebugging ? '#4ade80' : '#888888',
                }}
              />
              {isDebugging ? 'DEBUGGING ACTIVE' : 'DEBUGGING STOPPED'}
            </span>
          ) : currentProcess ? (
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
          ) : null}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {isDebugSessionSelected && isDebugging && (
            <button
              type="button"
              onClick={() => handleStop('debug-session')}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#f87171',
                cursor: 'pointer',
                padding: '2px 4px',
              }}
              title="Stop Debugger"
            >
              <Square size={12} fill="currentColor" />
            </button>
          )}

          {!isDebugSessionSelected && currentProcess && currentProcess.status === 'running' && (
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
          <div style={{ color: '#666666', fontStyle: 'italic' }}>No console output recorded yet.</div>
        ) : isDebugSessionSelected ? (
          debugLogs.map((log, i) => {
            let color = '#d4d4d4';
            if (log.category === 'stderr') color = '#f87171';
            else if (log.category === 'input') color = '#93c5fd';
            else if (log.category === 'result') color = '#4ade80';
            else if (log.category === 'console') color = '#e2e8f0';

            return (
              <div key={log.id || i} style={{ color, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {log.text}
              </div>
            );
          })
        ) : (
          currentLogs.map((log, i) => <div key={i}>{log}</div>)
        )}
        <div ref={logEndRef} />
      </div>

      {/* Debug REPL Input (when in Debug Session mode) */}
      {isDebugSessionSelected && (
        <form
          onSubmit={handleEvalSubmit}
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#1a1a1a',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            padding: '4px 8px',
          }}
        >
          <span style={{ color: '#007acc', marginRight: '6px', fontSize: '13px', fontWeight: 'bold' }}>&gt;</span>
          <input
            type="text"
            placeholder="Evaluate expression in paused frame..."
            value={evalInput}
            onChange={(e) => setEvalInput(e.target.value)}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#ffffff',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '12px',
            }}
          />
        </form>
      )}
    </div>
  );
}
