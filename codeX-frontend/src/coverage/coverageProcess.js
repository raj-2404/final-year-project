/**
 * CodeX Coverage Process
 * Level 3E — Code Coverage & Test Intelligence
 *
 * Manages the lifecycle of an individual coverage execution process:
 * IDLE -> RUNNING -> PARSING -> COMPLETED | FAILED | CANCELLED | ERROR
 */

import { CoverageLifecycleState } from './coverageTypes.js';
import { nativeCoverageService } from '../services/native/coverage.js';

export class CoverageProcess {
  constructor({ id, command, args = [], cwd = '', env = null }) {
    this.id = id || `cov_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    this.command = command;
    this.args = args;
    this.cwd = cwd;
    this.env = env;

    this.state = CoverageLifecycleState.IDLE;
    this.startTime = null;
    this.endTime = null;
    this.exitCode = null;
    this.outputBuffer = [];

    this.outputListeners = new Set();
    this.stateListeners = new Set();
  }

  onOutput(callback) {
    this.outputListeners.add(callback);
    return () => this.outputListeners.delete(callback);
  }

  onStateChange(callback) {
    this.stateListeners.add(callback);
    return () => this.stateListeners.delete(callback);
  }

  setState(newState) {
    if (this.state === newState) return;
    this.state = newState;
    this.stateListeners.forEach((fn) => {
      try {
        fn(newState, this);
      } catch (e) {
        console.error('Error in coverage process state listener:', e);
      }
    });
  }

  appendOutput(text, type = 'stdout') {
    const entry = { text, type, time: Date.now() };
    this.outputBuffer.push(entry);
    this.outputListeners.forEach((fn) => {
      try {
        fn(text, type);
      } catch (e) {
        console.error('Error in coverage output listener:', e);
      }
    });
  }

  getDuration() {
    if (!this.startTime) return 0;
    const end = this.endTime || Date.now();
    return Math.max(0, end - this.startTime);
  }

  getFormattedDuration() {
    const ms = this.getDuration();
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }

  async start() {
    if (!nativeCoverageService.isSupported()) {
      const msg = 'Local coverage execution is only available in CodeX Desktop.';
      this.appendOutput(msg + '\n', 'stderr');
      this.setState(CoverageLifecycleState.ERROR);
      throw new Error(msg);
    }

    this.setState(CoverageLifecycleState.RUNNING);
    this.startTime = Date.now();

    const fullCmd = [this.command, ...this.args].join(' ');
    this.appendOutput(`$ ${fullCmd}\n`, 'system');

    return new Promise((resolve, reject) => {
      let resolved = false;

      nativeCoverageService
        .startProcess({
          id: this.id,
          executable: this.command,
          args: this.args,
          cwd: this.cwd,
          env: this.env,
          onStdout: (chunk) => {
            this.appendOutput(chunk, 'stdout');
          },
          onStderr: (chunk) => {
            this.appendOutput(chunk, 'stderr');
          },
          onExit: ({ exitCode, success }) => {
            this.endTime = Date.now();
            this.exitCode = exitCode;
            this.appendOutput(
              `\nProcess exited with code ${exitCode} (${this.getFormattedDuration()})\n`,
              'system'
            );

            if (this.state === CoverageLifecycleState.CANCELLED) {
              if (!resolved) {
                resolved = true;
                resolve({ exitCode, success: false, cancelled: true });
              }
              return;
            }

            // Note: even if test exitCode !== 0 (e.g. failing tests), coverage reports may still have been produced!
            this.setState(CoverageLifecycleState.PARSING);
            if (!resolved) {
              resolved = true;
              resolve({ exitCode, success });
            }
          },
        })
        .catch((err) => {
          this.endTime = Date.now();
          this.setState(CoverageLifecycleState.ERROR);
          this.appendOutput(`Execution error: ${err.message || err}\n`, 'stderr');
          if (!resolved) {
            resolved = true;
            reject(err);
          }
        });
    });
  }

  async write(data) {
    return nativeCoverageService.writeProcess(this.id, data);
  }

  async stop() {
    this.setState(CoverageLifecycleState.CANCELLED);
    return nativeCoverageService.stopProcess(this.id);
  }

  async kill() {
    this.setState(CoverageLifecycleState.CANCELLED);
    return nativeCoverageService.killProcess(this.id);
  }
}
