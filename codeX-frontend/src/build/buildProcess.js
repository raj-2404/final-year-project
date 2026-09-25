/**
 * CodeX Build Process Manager
 * Level 3C — Build & Run Process Lifecycle
 *
 * Represents an individual execution instance of a build or run task.
 * Manages states: IDLE -> STARTING -> RUNNING -> SUCCEEDED | FAILED | TERMINATED
 */

import { BuildProcessState } from './buildTypes.js';
import { nativeBuildService } from '../services/native/build.js';

export class BuildProcess {
  constructor({ id, taskType, command, args = [], cwd = '', env = null }) {
    this.id = id || `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    this.taskType = taskType;
    this.command = command;
    this.args = args;
    this.cwd = cwd;
    this.env = env;

    this.state = BuildProcessState.IDLE;
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
        console.error('Error in state listener:', e);
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
        console.error('Error in output listener:', e);
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
    const sec = (ms / 1000).toFixed(2);
    return `${sec}s`;
  }

  async start() {
    if (!nativeBuildService.isSupported()) {
      const msg = 'Build & Run operations are only supported in desktop mode.';
      this.appendOutput(msg + '\n', 'stderr');
      this.setState(BuildProcessState.FAILED);
      throw new Error(msg);
    }

    this.setState(BuildProcessState.STARTING);
    this.startTime = Date.now();

    const fullCmd = [this.command, ...this.args].join(' ');
    this.appendOutput(`$ ${fullCmd}\n`, 'system');

    try {
      await nativeBuildService.startProcess({
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
        onExit: (payload) => {
          this.handleExit(payload);
        },
      });

      this.setState(BuildProcessState.RUNNING);
    } catch (err) {
      this.endTime = Date.now();
      const errMsg = err?.message || String(err);
      this.appendOutput(`\n[Process failed to start]: ${errMsg}\n`, 'stderr');
      this.setState(BuildProcessState.FAILED);
      throw err;
    }
  }

  handleExit(payload) {
    this.endTime = Date.now();
    this.exitCode = payload?.code ?? (payload?.success ? 0 : 1);

    const isSuccess = payload?.success || this.exitCode === 0;
    if (this.state === BuildProcessState.STOPPING) {
      this.setState(BuildProcessState.TERMINATED);
      this.appendOutput(`\n[Process terminated by user] (${this.getFormattedDuration()})\n`, 'system');
    } else if (isSuccess) {
      this.setState(BuildProcessState.SUCCEEDED);
      this.appendOutput(`\n[Process completed successfully with exit code 0] (${this.getFormattedDuration()})\n`, 'system');
    } else {
      this.setState(BuildProcessState.FAILED);
      this.appendOutput(`\n[Process exited with code ${this.exitCode}] (${this.getFormattedDuration()})\n`, 'system');
    }
  }

  async write(data) {
    if (this.state !== BuildProcessState.RUNNING) return;
    try {
      await nativeBuildService.writeProcess(this.id, data);
    } catch (e) {
      console.error('Failed to write to process:', e);
    }
  }

  async stop() {
    if (this.state !== BuildProcessState.RUNNING && this.state !== BuildProcessState.STARTING) return;
    this.setState(BuildProcessState.STOPPING);
    this.appendOutput('\n[Stopping process...]\n', 'system');
    try {
      await nativeBuildService.stopProcess(this.id);
    } catch (e) {
      console.error('Failed to stop process:', e);
    }
  }

  async kill() {
    if (this.state !== BuildProcessState.RUNNING && this.state !== BuildProcessState.STOPPING) return;
    this.setState(BuildProcessState.STOPPING);
    this.appendOutput('\n[Killing process...]\n', 'system');
    try {
      await nativeBuildService.killProcess(this.id);
    } catch (e) {
      console.error('Failed to kill process:', e);
    }
  }
}
