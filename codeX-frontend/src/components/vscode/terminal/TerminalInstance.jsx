import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { terminalService } from '../../../services/native/terminal';

export default function TerminalInstance({
  sessionId,
  shell,
  cwd,
  isActive,
  onExit,
  onSessionReady,
  split = false,
}) {
  const containerRef = useRef(null);
  const xtermRef = useRef(null);
  const fitAddonRef = useRef(null);
  const ptySessionRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

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
    term.open(containerRef.current);

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    let isDisposed = false;

    const startPty = async () => {
      try {
        fitAddon.fit();
        const cols = term.cols || 80;
        const rows = term.rows || 24;

        const session = await terminalService.createSession({
          id: sessionId,
          shell,
          cwd,
          cols,
          rows,
          onData: (chunk) => {
            if (!isDisposed && term) {
              term.write(chunk);
            }
          },
          onExit: (code) => {
            if (onExit) onExit(sessionId, code);
          },
        });

        ptySessionRef.current = session;
        if (onSessionReady) onSessionReady(session);

        term.onData((data) => {
          if (session && session.write) {
            session.write(data);
          }
        });

        setTimeout(() => {
          try {
            fitAddon.fit();
            if (session.resize) {
              session.resize(term.cols, term.rows);
            }
            term.focus();
          } catch {}
        }, 80);
      } catch (err) {
        term.write(`\r\n\x1b[31m[CodeX Terminal Error]\x1b[0m ${err.message || err}\r\n`);
      }
    };

    startPty();

    const handleResize = () => {
      if (fitAddonRef.current && xtermRef.current && ptySessionRef.current) {
        try {
          fitAddonRef.current.fit();
          ptySessionRef.current.resize(xtermRef.current.cols, xtermRef.current.rows);
        } catch {}
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      isDisposed = true;
      window.removeEventListener('resize', handleResize);
      if (ptySessionRef.current) {
        ptySessionRef.current.close().catch(() => {});
      }
      try {
        term.dispose();
      } catch {}
      xtermRef.current = null;
    };
  }, [sessionId, shell, cwd]);

  useEffect(() => {
    if (isActive && xtermRef.current && fitAddonRef.current) {
      const timer = setTimeout(() => {
        try {
          fitAddonRef.current.fit();
          if (ptySessionRef.current?.resize) {
            ptySessionRef.current.resize(xtermRef.current.cols, xtermRef.current.rows);
          }
          xtermRef.current.focus();
        } catch {}
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isActive]);

  const handleContainerClick = () => {
    if (xtermRef.current) {
      try {
        xtermRef.current.focus();
      } catch {}
    }
  };

  return (
    <div
      ref={containerRef}
      className={`terminal-instance-container ${split ? 'split' : ''}`}
      onClick={handleContainerClick}
      style={{
        display: isActive ? 'block' : 'none',
        flex: split ? '1 1 50%' : '1 1 100%',
        width: '100%',
        height: '100%',
        padding: '4px 6px',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    />
  );
}
