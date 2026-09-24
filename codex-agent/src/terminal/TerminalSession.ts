import * as pty from 'node-pty';
import { logger } from '../logger/Logger.js';

export interface TerminalSessionOptions {
  terminalId: string;
  ptyProcess: pty.IPty;
  shell: string;
  cwd: string;
  cols: number;
  rows: number;
  onData: (terminalId: string, data: string) => void;
  onExit: (terminalId: string, exitCode: number, signal?: number) => void;
}

export class TerminalSession {
  public readonly terminalId: string;
  public readonly shell: string;
  public readonly cwd: string;
  public cols: number;
  public rows: number;
  public readonly createdAt: Date;
  public lastActivityAt: Date;

  private ptyProcess: pty.IPty | null;
  private disposed = false;
  private dataDisposable: pty.IDisposable | null = null;
  private exitDisposable: pty.IDisposable | null = null;

  constructor(options: TerminalSessionOptions) {
    this.terminalId = options.terminalId;
    this.ptyProcess = options.ptyProcess;
    this.shell = options.shell;
    this.cwd = options.cwd;
    this.cols = options.cols;
    this.rows = options.rows;
    this.createdAt = new Date();
    this.lastActivityAt = new Date();

    // Wire PTY stdout / stderr stream
    this.dataDisposable = this.ptyProcess.onData((data: string) => {
      if (this.disposed) return;
      this.lastActivityAt = new Date();
      try {
        options.onData(this.terminalId, data);
      } catch (err) {
        logger.error({ err, terminalId: this.terminalId }, 'Error forwarding PTY output');
      }
    });

    // Wire PTY process exit
    this.exitDisposable = this.ptyProcess.onExit((e: { exitCode: number; signal?: number }) => {
      logger.info({ terminalId: this.terminalId, exitCode: e.exitCode, signal: e.signal }, 'PTY process exited');
      this.dispose();
      try {
        options.onExit(this.terminalId, e.exitCode, e.signal);
      } catch (err) {
        logger.error({ err, terminalId: this.terminalId }, 'Error handling PTY exit');
      }
    });
  }

  public isAlive(): boolean {
    return !this.disposed && this.ptyProcess !== null;
  }

  public write(data: string): void {
    if (this.disposed || !this.ptyProcess) {
      throw new Error(`Cannot write to disposed terminal: ${this.terminalId}`);
    }
    this.lastActivityAt = new Date();
    try {
      this.ptyProcess.write(data);
    } catch (err: any) {
      logger.error({ err, terminalId: this.terminalId }, 'Error writing to PTY process');
      throw err;
    }
  }

  public resize(cols: number, rows: number): void {
    if (this.disposed || !this.ptyProcess) {
      throw new Error(`Cannot resize disposed terminal: ${this.terminalId}`);
    }
    if (cols <= 0 || rows <= 0) {
      throw new Error(`Invalid dimensions for resize: cols=${cols}, rows=${rows}`);
    }
    this.cols = cols;
    this.rows = rows;
    this.lastActivityAt = new Date();
    try {
      this.ptyProcess.resize(cols, rows);
      logger.debug({ terminalId: this.terminalId, cols, rows }, 'Resized PTY session');
    } catch (err: any) {
      logger.warn({ err, terminalId: this.terminalId }, 'Failed to resize PTY');
    }
  }

  public kill(): void {
    if (this.disposed || !this.ptyProcess) {
      return;
    }
    logger.info({ terminalId: this.terminalId }, 'Killing PTY process');
    try {
      this.ptyProcess.kill();
    } catch (err) {
      logger.warn({ err, terminalId: this.terminalId }, 'Error sending kill signal to PTY');
    } finally {
      this.dispose();
    }
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    if (this.dataDisposable) {
      try {
        this.dataDisposable.dispose();
      } catch {}
      this.dataDisposable = null;
    }

    if (this.exitDisposable) {
      try {
        this.exitDisposable.dispose();
      } catch {}
      this.exitDisposable = null;
    }

    if (this.ptyProcess) {
      try {
        this.ptyProcess.kill();
      } catch {}
      this.ptyProcess = null;
    }
  }
}
