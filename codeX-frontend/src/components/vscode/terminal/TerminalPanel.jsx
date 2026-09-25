import React, { useState, useEffect, useRef, useCallback } from 'react';
import { terminalService } from '../../../services/native/terminal';
import { platformService } from '../../../services/native/platform';
import TerminalTabs from './TerminalTabs';
import TerminalInstance from './TerminalInstance';
import './Terminal.css';

export default function TerminalPanel({ projectRoot }) {
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [splitSessionId, setSplitSessionId] = useState(null);
  const [availableShells, setAvailableShells] = useState([]);
  const [defaultShell, setDefaultShell] = useState('');
  const sessionCounterRef = useRef(1);

  // 1. Fetch available shells and initialize first terminal session
  useEffect(() => {
    let isMounted = true;

    async function initShells() {
      try {
        const [shells, defShell] = await Promise.all([
          platformService.getAvailableShells().catch(() => []),
          terminalService.getDefaultShell().catch(() => ''),
        ]);

        if (!isMounted) return;
        setAvailableShells(shells);
        setDefaultShell(defShell);

        const initialShellPath = defShell || (shells[0] ? shells[0].path : undefined);
        const initialTitle = shells[0] ? shells[0].name : 'terminal';
        const initialId = `term-${Date.now()}-${sessionCounterRef.current++}`;

        const firstSession = {
          id: initialId,
          title: initialTitle,
          shell: initialShellPath,
          cwd: projectRoot || null,
        };

        setSessions([firstSession]);
        setActiveSessionId(initialId);
      } catch (err) {
        console.error('Failed to initialize terminal shells:', err);
      }
    }

    initShells();

    return () => {
      isMounted = false;
    };
  }, [projectRoot]);

  // Create new terminal session
  const handleCreateSession = useCallback(
    (shellPath, shellName) => {
      const chosenShell = shellPath || defaultShell;
      const title = shellName || (chosenShell ? chosenShell.replace(/\\/g, '/').split('/').pop() : 'terminal');
      const newId = `term-${Date.now()}-${sessionCounterRef.current++}`;

      const newSession = {
        id: newId,
        title,
        shell: chosenShell,
        cwd: projectRoot || null,
      };

      setSessions((prev) => [...prev, newSession]);
      setActiveSessionId(newId);
    },
    [defaultShell, projectRoot]
  );

  // Close terminal session
  const handleCloseSession = useCallback(
    (id) => {
      terminalService.close(id).catch(() => {});

      setSessions((prev) => {
        const filtered = prev.filter((s) => s.id !== id);
        if (id === activeSessionId) {
          if (filtered.length > 0) {
            setActiveSessionId(filtered[filtered.length - 1].id);
          } else {
            setActiveSessionId(null);
          }
        }
        return filtered;
      });

      if (splitSessionId === id) {
        setSplitSessionId(null);
      }
    },
    [activeSessionId, splitSessionId]
  );

  // Restart terminal session
  const handleRestartSession = useCallback(
    (id) => {
      const session = sessions.find((s) => s.id === id);
      if (!session) return;

      terminalService.close(id).catch(() => {});

      // Replace with new session ID while preserving title & shell
      const newId = `term-${Date.now()}-${sessionCounterRef.current++}`;
      setSessions((prev) =>
        prev.map((s) =>
          s.id === id
            ? { ...s, id: newId }
            : s
        )
      );

      if (activeSessionId === id) {
        setActiveSessionId(newId);
      }
      if (splitSessionId === id) {
        setSplitSessionId(newId);
      }
    },
    [sessions, activeSessionId, splitSessionId]
  );

  // Rename session
  const handleRenameSession = useCallback((id, newTitle) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, title: newTitle } : s))
    );
    terminalService.rename(id, newTitle).catch(() => {});
  }, []);

  // Split terminal
  const handleSplitSession = useCallback(
    (id) => {
      if (splitSessionId) {
        setSplitSessionId(null);
        return;
      }

      // Create a companion split terminal
      const baseSession = sessions.find((s) => s.id === id);
      const splitId = `term-${Date.now()}-${sessionCounterRef.current++}`;
      const newSession = {
        id: splitId,
        title: `${baseSession ? baseSession.title : 'terminal'} (split)`,
        shell: baseSession ? baseSession.shell : defaultShell,
        cwd: projectRoot || null,
      };

      setSessions((prev) => [...prev, newSession]);
      setSplitSessionId(splitId);
    },
    [sessions, splitSessionId, defaultShell, projectRoot]
  );

  // Handle process exit from inside terminal
  const handleSessionExit = useCallback((id, exitCode) => {
    console.log(`Terminal session ${id} exited with code ${exitCode}`);
  }, []);

  if (sessions.length === 0) {
    return (
      <div className="terminal-empty-container">
        <button
          type="button"
          className="btn-create-initial-terminal"
          onClick={() => handleCreateSession()}
        >
          Create New Terminal
        </button>
      </div>
    );
  }

  return (
    <div className="terminal-panel-root">
      {/* Horizontal Tabs & Action Bar */}
      <TerminalTabs
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={setActiveSessionId}
        onCreateSession={handleCreateSession}
        onCloseSession={handleCloseSession}
        onRestartSession={handleRestartSession}
        onRenameSession={handleRenameSession}
        onSplitSession={handleSplitSession}
        availableShells={availableShells}
      />

      {/* Terminal Viewport Container (keeps all sessions mounted in background) */}
      <div className={`terminal-viewport-container ${splitSessionId ? 'split-active' : ''}`}>
        {sessions.map((session) => {
          const isActive = session.id === activeSessionId;
          const isSplitCompanion = session.id === splitSessionId;
          const shouldRender = isActive || isSplitCompanion;

          return (
            <TerminalInstance
              key={session.id}
              sessionId={session.id}
              shell={session.shell}
              cwd={session.cwd}
              isActive={shouldRender}
              split={Boolean(splitSessionId && shouldRender)}
              onExit={handleSessionExit}
            />
          );
        })}
      </div>
    </div>
  );
}
