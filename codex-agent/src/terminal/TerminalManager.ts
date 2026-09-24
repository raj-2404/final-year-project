import crypto from 'crypto';
import { TerminalSession } from './TerminalSession.js';
import { PtyFactory, PtySpawnOptions } from './PtyFactory.js';
import { logger } from '../logger/Logger.js';

export interface TerminalManagerOptions {
  maxSessions?: number;
  idleTimeout?: number;
}

export class TerminalManager {
  private sessions: Map<string, TerminalSession> = new Map();
  private maxSessions: number;
  private idleTimeout: number;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(options: TerminalManagerOptions = {}) {
    this.maxSessions = options.maxSessions || 10;
    this.idleTimeout = options.idleTimeout || 1800000; // 30 mins

    // Start background idle scanner
    this.startIdleCleanup();
  }

  public getSessionCount(): number {
    return this.sessions.size;
  }

  public getMaxSessions(): number {
    return this.maxSessions;
  }

  public setMaxSessions(limit: number): void {
    this.maxSessions = limit;
  }

  public createSession(
    options: PtySpawnOptions,
    onData: (terminalId: string, data: string) => void,
    onExit: (terminalId: string, exitCode: number, signal?: number) => void
  ): TerminalSession {
    if (this.sessions.size >= this.maxSessions) {
      throw new Error(`Maximum terminal sessions reached (${this.maxSessions})`);
    }

    const terminalId = this.generateTerminalId();

    const spawnResult = PtyFactory.spawn(options);

    const session = new TerminalSession({
      terminalId,
      ptyProcess: spawnResult.ptyProcess,
      shell: spawnResult.shell,
      cwd: spawnResult.cwd,
      cols: spawnResult.cols,
      rows: spawnResult.rows,
      onData,
      onExit: (id: string, code: number, sig?: number) => {
        this.sessions.delete(id);
        onExit(id, code, sig);
      },
    });

    this.sessions.set(terminalId, session);
    logger.info({ terminalId, shell: session.shell, cwd: session.cwd }, 'Terminal session created');

    return session;
  }

  public get(terminalId: string): TerminalSession | undefined {
    return this.sessions.get(terminalId);
  }

  public write(terminalId: string, data: string): void {
    const session = this.sessions.get(terminalId);
    if (!session) {
      throw new Error(`Terminal session not found: ${terminalId}`);
    }
    session.write(data);
  }

  public resize(terminalId: string, cols: number, rows: number): void {
    const session = this.sessions.get(terminalId);
    if (!session) {
      throw new Error(`Terminal session not found: ${terminalId}`);
    }
    session.resize(cols, rows);
  }

  public kill(terminalId: string): boolean {
    const session = this.sessions.get(terminalId);
    if (!session) {
      return false;
    }
    session.kill();
    this.sessions.delete(terminalId);
    return true;
  }

  public list(): Array<{
    terminalId: string;
    shell: string;
    cwd: string;
    cols: number;
    rows: number;
    createdAt: Date;
    lastActivityAt: Date;
  }> {
    return Array.from(this.sessions.values()).map((s) => ({
      terminalId: s.terminalId,
      shell: s.shell,
      cwd: s.cwd,
      cols: s.cols,
      rows: s.rows,
      createdAt: s.createdAt,
      lastActivityAt: s.lastActivityAt,
    }));
  }

  public disposeAll(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    for (const [id, session] of this.sessions.entries()) {
      try {
        session.dispose();
      } catch (err) {
        logger.error({ err, terminalId: id }, 'Error disposing session');
      }
    }
    this.sessions.clear();
    logger.info('All terminal sessions disposed');
  }

  private generateTerminalId(): string {
    return 'term-' + crypto.randomBytes(6).toString('hex');
  }

  private startIdleCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [id, session] of this.sessions.entries()) {
        if (now - session.lastActivityAt.getTime() > this.idleTimeout) {
          logger.info({ terminalId: id }, 'Closing idle terminal session due to timeout');
          session.kill();
          this.sessions.delete(id);
        }
      }
    }, 60000); // Check every minute

    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }
}
