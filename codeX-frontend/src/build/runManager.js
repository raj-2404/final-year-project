/**
 * CodeX Run Manager
 * Level 3C — Run Without Debugging & File Execution
 *
 * Coordinates running projects or individual files locally without DAP debugging.
 * Executes commands directly via Tauri native process manager and streams stdout/stderr.
 */

import { TaskType, BuildProcessState } from './buildTypes.js';
import { BuildProcess } from './buildProcess.js';
import { buildTaskResolver } from './buildTaskResolver.js';

class RunManager {
  constructor() {
    this.activeProcess = null;
    this.outputListeners = new Set();
    this.stateListeners = new Set();
  }

  isRunning() {
    return (
      this.activeProcess &&
      (this.activeProcess.state === BuildProcessState.STARTING ||
        this.activeProcess.state === BuildProcessState.RUNNING ||
        this.activeProcess.state === BuildProcessState.STOPPING)
    );
  }

  getState() {
    return this.activeProcess ? this.activeProcess.state : BuildProcessState.IDLE;
  }

  onOutput(callback) {
    this.outputListeners.add(callback);
    return () => this.outputListeners.delete(callback);
  }

  onStateChange(callback) {
    this.stateListeners.add(callback);
    return () => this.stateListeners.delete(callback);
  }

  notifyOutput(chunk, type) {
    this.outputListeners.forEach((fn) => {
      try {
        fn(chunk, type);
      } catch (e) {
        console.error('Error in run output listener:', e);
      }
    });
  }

  notifyState(state) {
    this.stateListeners.forEach((fn) => {
      try {
        fn(state, this.activeProcess);
      } catch (e) {
        console.error('Error in run state listener:', e);
      }
    });
  }

  /**
   * Starts running the project without debugging.
   */
  async startRun({ workspaceRoot, fileTree = [], overrides = {} } = {}) {
    if (this.isRunning()) {
      throw new Error('A run process is already active. Stop it first.');
    }

    const taskPlan = await buildTaskResolver.resolveTask(TaskType.RUN, {
      workspaceRoot,
      fileTree,
      explicitOverrides: overrides,
    });

    const proc = new BuildProcess({
      id: `run_${Date.now()}`,
      taskType: TaskType.RUN,
      command: taskPlan.command,
      args: taskPlan.args,
      cwd: taskPlan.cwd,
      env: taskPlan.env,
    });

    this.activeProcess = proc;

    proc.onOutput((chunk, type) => {
      this.notifyOutput(chunk, type);
    });

    proc.onStateChange((state) => {
      this.notifyState(state);
    });

    await proc.start();
    return proc;
  }

  /**
   * Runs the current active file directly.
   */
  async startRunFile({ workspaceRoot, fileTree = [], activeFile, overrides = {} } = {}) {
    if (this.isRunning()) {
      throw new Error('A run process is already active. Stop it first.');
    }

    if (!activeFile) {
      throw new Error('No active file selected to run.');
    }

    const taskPlan = await buildTaskResolver.resolveTask(TaskType.RUN_FILE, {
      workspaceRoot,
      fileTree,
      activeFile,
      explicitOverrides: overrides,
    });

    const proc = new BuildProcess({
      id: `run_file_${Date.now()}`,
      taskType: TaskType.RUN_FILE,
      command: taskPlan.command,
      args: taskPlan.args,
      cwd: taskPlan.cwd,
      env: taskPlan.env,
    });

    this.activeProcess = proc;

    proc.onOutput((chunk, type) => {
      this.notifyOutput(chunk, type);
    });

    proc.onStateChange((state) => {
      this.notifyState(state);
    });

    await proc.start();
    return proc;
  }

  async stopRun() {
    if (this.activeProcess) {
      await this.activeProcess.stop();
    }
  }

  async killRun() {
    if (this.activeProcess) {
      await this.activeProcess.kill();
    }
  }
}

export const runManager = new RunManager();
