/**
 * CodeX Test Process
 * Level 3D — Test Execution Process Lifecycle
 *
 * Manages the lifecycle of an individual test execution process:
 * IDLE -> RUNNING -> STOPPING -> PASSED | FAILED | CANCELLED | ERROR
 */

import { TestLifecycleState } from './testTypes.js';
import { nativeTestService } from '../services/native/testing.js';

export class TestProcess {
  constructor({ id, command, args = [], cwd = '', env = null, target = null }) {
    this.id = id || `test_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    this.command = command;
    this.args = args;
    this.cwd = cwd;
    this.env = env;
    this.target = target;

    this.state = TestLifecycleState.IDLE;
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
        console.error('Error in test process state listener:', e);
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
        console.error('Error in test output listener:', e);
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
    if (!nativeTestService.isSupported()) {
      const msg = 'Local test execution is only available in CodeX Desktop.';
      this.appendOutput(msg + '\n', 'stderr');
      this.setState(TestLifecycleState.ERROR);
      throw new Error(msg);
    }

    this.setState(TestLifecycleState.RUNNING);
    this.startTime = Date.now();

    const fullCmd = [this.command, ...this.args].join(' ');
    this.appendOutput(`$ ${fullCmd}\n`, 'system');

    try {
      await nativeTestService.startProcess({
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
    } catch (err) {
      this.endTime = Date.now();
      const errMsg = err?.message || String(err);
      this.appendOutput(`\n[Test process failed to start]: ${errMsg}\n`, 'stderr');
      this.setState(TestLifecycleState.ERROR);
      throw err;
    }
  }

  handleExit(payload) {
    this.endTime = Date.now();
    this.exitCode = payload?.exitCode ?? (payload?.success ? 0 : 1);

    const isSuccess = payload?.success || this.exitCode === 0;

    if (this.state === TestLifecycleState.STOPPING) {
      this.setState(TestLifecycleState.CANCELLED);
      this.appendOutput(`\n[Tests cancelled by user] (${this.getFormattedDuration()})\n`, 'system');
    } else if (isSuccess) {
      this.setState(TestLifecycleState.PASSED);
      this.appendOutput(`\n[Test run completed successfully] (${this.getFormattedDuration()})\n`, 'system');
    } else {
      this.setState(TestLifecycleState.FAILED);
      this.appendOutput(`\n[Test run finished with failures, exit code ${this.exitCode}] (${this.getFormattedDuration()})\n`, 'system');
    }
  }

  async write(data) {
    if (this.state !== TestLifecycleState.RUNNING) return;
    try {
      await nativeTestService.writeProcess(this.id, data);
    } catch (e) {
      console.error('Failed to write to test process:', e);
    }
  }

  async stop() {
    if (this.state !== TestLifecycleState.RUNNING) return;
    this.setState(TestLifecycleState.STOPPING);
    this.appendOutput('\n[Stopping tests...]\n', 'system');
    try {
      await nativeTestService.stopProcess(this.id);
    } catch (e) {
      console.error('Failed to stop test process:', e);
    }
  }

  async kill() {
    if (this.state !== TestLifecycleState.RUNNING && this.state !== TestLifecycleState.STOPPING) return;
    this.setState(TestLifecycleState.STOPPING);
    this.appendOutput('\n[Force killing test process...]\n', 'system');
    try {
      await nativeTestService.killProcess(this.id);
    } catch (e) {
      console.error('Failed to kill test process:', e);
    }
  }
}
