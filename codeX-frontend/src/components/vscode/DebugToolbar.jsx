import React from 'react';
import {
  Play,
  Pause,
  ArrowRight,
  ArrowDown,
  ArrowUp,
  RotateCw,
  Square,
} from 'lucide-react';
import { debuggerManager } from '../../debugger/debuggerManager.js';
import { DebugSessionState } from '../../debugger/debugTypes.js';

export default function DebugToolbar({ isDebugging, sessionState, activeFrame }) {
  if (!isDebugging) return null;

  const isPaused = sessionState === DebugSessionState.PAUSED;

  return (
    <div className="codex-debug-toolbar">
      <div className="codex-debug-toolbar-status">
        <span
          style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            backgroundColor: isPaused ? '#eab308' : '#4ade80',
            display: 'inline-block',
          }}
        />
        <span>
          {isPaused
            ? `Paused :${activeFrame?.line || ''}`
            : 'Running'}
        </span>
      </div>

      {isPaused ? (
        <button
          className="codex-debug-toolbar-btn"
          title="Continue (F5)"
          onClick={() => debuggerManager.continue()}
          style={{ color: '#4ade80' }}
        >
          <Play size={15} fill="currentColor" />
        </button>
      ) : (
        <button
          className="codex-debug-toolbar-btn"
          title="Pause (F6)"
          onClick={() => debuggerManager.pause()}
          style={{ color: '#facc15' }}
        >
          <Pause size={15} fill="currentColor" />
        </button>
      )}

      <button
        className="codex-debug-toolbar-btn"
        title="Step Over (F10)"
        disabled={!isPaused}
        onClick={() => debuggerManager.stepOver()}
      >
        <ArrowRight size={15} />
      </button>

      <button
        className="codex-debug-toolbar-btn"
        title="Step Into (F11)"
        disabled={!isPaused}
        onClick={() => debuggerManager.stepInto()}
      >
        <ArrowDown size={15} />
      </button>

      <button
        className="codex-debug-toolbar-btn"
        title="Step Out (Shift+F11)"
        disabled={!isPaused}
        onClick={() => debuggerManager.stepOut()}
      >
        <ArrowUp size={15} />
      </button>

      <button
        className="codex-debug-toolbar-btn"
        title="Restart (Ctrl+Shift+F5)"
        onClick={() => debuggerManager.restart()}
        style={{ color: '#38bdf8' }}
      >
        <RotateCw size={14} />
      </button>

      <button
        className="codex-debug-toolbar-btn"
        title="Stop (Shift+F5)"
        onClick={() => debuggerManager.stop()}
        style={{ color: '#ef4444' }}
      >
        <Square size={13} fill="currentColor" />
      </button>
    </div>
  );
}
