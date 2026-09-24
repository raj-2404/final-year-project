import { describe, it, expect, afterEach } from 'vitest';
import os from 'os';
import { TerminalManager } from '../src/terminal/TerminalManager.js';

describe('TerminalManager', () => {
  let manager: TerminalManager;

  afterEach(() => {
    if (manager) {
      manager.disposeAll();
    }
  });

  it('creates an interactive terminal session and executes safe commands', async () => {
    manager = new TerminalManager({ maxSessions: 5 });

    let collectedOutput = '';
    const outputPromise = new Promise<string>((resolve) => {
      const session = manager.createSession(
        {
          cwd: os.homedir(),
          cols: 80,
          rows: 24,
        },
        (_id, data) => {
          collectedOutput += data;
          if (collectedOutput.includes('HELLO_CODEX_TEST')) {
            resolve(collectedOutput);
          }
        },
        () => {}
      );

      expect(session).toBeDefined();
      expect(session.terminalId).toMatch(/^term-/);
      expect(manager.getSessionCount()).toBe(1);

      // Send safe command
      setTimeout(() => {
        manager.write(session.terminalId, 'echo HELLO_CODEX_TEST\r');
      }, 300);
    });

    const result = await outputPromise;
    expect(result).toContain('HELLO_CODEX_TEST');
  });

  it('supports terminal resizing', () => {
    manager = new TerminalManager();
    const session = manager.createSession(
      { cwd: os.homedir(), cols: 80, rows: 24 },
      () => {},
      () => {}
    );

    expect(session.cols).toBe(80);
    expect(session.rows).toBe(24);

    manager.resize(session.terminalId, 120, 35);
    expect(session.cols).toBe(120);
    expect(session.rows).toBe(35);
  });

  it('rejects nonexistent cwd', () => {
    manager = new TerminalManager();

    expect(() =>
      manager.createSession(
        { cwd: '/nonexistent/path/for/codex/testing/12345' },
        () => {},
        () => {}
      )
    ).toThrow(/Working directory does not exist/);
  });

  it('enforces maximum concurrent terminal sessions limit', () => {
    manager = new TerminalManager({ maxSessions: 2 });

    const s1 = manager.createSession({ cwd: os.homedir() }, () => {}, () => {});
    const s2 = manager.createSession({ cwd: os.homedir() }, () => {}, () => {});
    expect(manager.getSessionCount()).toBe(2);

    expect(() =>
      manager.createSession({ cwd: os.homedir() }, () => {}, () => {})
    ).toThrow(/Maximum terminal sessions reached \(2\)/);

    // After killing one, a new one can be created
    manager.kill(s1.terminalId);
    expect(manager.getSessionCount()).toBe(1);

    const s3 = manager.createSession({ cwd: os.homedir() }, () => {}, () => {});
    expect(manager.getSessionCount()).toBe(2);
    expect(s3).toBeDefined();
  });

  it('supports multiple independent terminal sessions simultaneously', () => {
    manager = new TerminalManager({ maxSessions: 5 });

    const s1 = manager.createSession({ cwd: os.homedir() }, () => {}, () => {});
    const s2 = manager.createSession({ cwd: os.homedir() }, () => {}, () => {});
    const s3 = manager.createSession({ cwd: os.homedir() }, () => {}, () => {});

    expect(manager.getSessionCount()).toBe(3);
    expect(s1.terminalId).not.toBe(s2.terminalId);
    expect(s2.terminalId).not.toBe(s3.terminalId);

    const list = manager.list();
    expect(list.length).toBe(3);
    expect(list.map((s) => s.terminalId)).toContain(s1.terminalId);
    expect(list.map((s) => s.terminalId)).toContain(s2.terminalId);
    expect(list.map((s) => s.terminalId)).toContain(s3.terminalId);
  });

  it('handles terminal exit cleanly', async () => {
    manager = new TerminalManager();

    const exitPromise = new Promise<number>((resolve) => {
      const session = manager.createSession(
        { cwd: os.homedir() },
        () => {},
        (_id, exitCode) => {
          resolve(exitCode);
        }
      );

      // Send exit command
      setTimeout(() => {
        manager.write(session.terminalId, 'exit 0\r');
      }, 300);
    });

    const exitCode = await exitPromise;
    expect(exitCode).toBe(0);
    expect(manager.getSessionCount()).toBe(0);
  });
});
