import fs from 'fs';
import os from 'os';
import * as pty from 'node-pty';
import { ShellResolver } from '../platform/ShellResolver.js';
import { Environment } from '../platform/Environment.js';
import { logger } from '../logger/Logger.js';

export interface PtySpawnOptions {
  cwd?: string;
  shell?: string;
  cols?: number;
  rows?: number;
  env?: Record<string, string>;
}

export interface PtySpawnResult {
  ptyProcess: pty.IPty;
  shell: string;
  cwd: string;
  cols: number;
  rows: number;
}

export class PtyFactory {
  public static spawn(options: PtySpawnOptions = {}): PtySpawnResult {
    // 1. Resolve and validate working directory
    let resolvedCwd = options.cwd ? options.cwd.trim() : '';

    if (!resolvedCwd) {
      resolvedCwd = os.homedir();
    } else {
      if (!fs.existsSync(resolvedCwd)) {
        throw new Error(`Working directory does not exist: ${resolvedCwd}`);
      }
      const stat = fs.statSync(resolvedCwd);
      if (!stat.isDirectory()) {
        throw new Error(`Specified path is not a directory: ${resolvedCwd}`);
      }
    }

    // 2. Resolve shell
    const resolvedShell = ShellResolver.resolveShell(options.shell);

    // 3. Prepare environment
    const ptyEnv = Environment.getPtyEnvironment(options.env);

    const cols = options.cols && options.cols > 0 ? options.cols : 120;
    const rows = options.rows && options.rows > 0 ? options.rows : 30;

    logger.debug({ shell: resolvedShell.executable, cwd: resolvedCwd, cols, rows }, 'Spawning PTY process');

    try {
      const ptyProcess = pty.spawn(resolvedShell.executable, resolvedShell.args, {
        name: 'xterm-256color',
        cols,
        rows,
        cwd: resolvedCwd,
        env: ptyEnv,
        encoding: 'utf8',
      });

      return {
        ptyProcess,
        shell: resolvedShell.executable,
        cwd: resolvedCwd,
        cols,
        rows,
      };
    } catch (err: any) {
      logger.error({ err, shell: resolvedShell.executable, cwd: resolvedCwd }, 'Failed to spawn PTY');
      throw new Error(`Failed to create terminal process: ${err.message || String(err)}`);
    }
  }
}
