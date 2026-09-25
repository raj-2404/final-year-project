/**
 * CodeX Build Manager
 * Level 3C — Build Execution & Problem Parsing
 *
 * Coordinates project compilation and build tasks:
 * - Executes resolved build tasks
 * - Streams output
 * - Parses compiler/linter error messages into structured problems
 * - Publishes problems to Monaco markers and Problems panel
 */

import { TaskType, BuildProcessState } from './buildTypes.js';
import { BuildProcess } from './buildProcess.js';
import { buildTaskResolver } from './buildTaskResolver.js';
import { buildOutputParser } from './buildOutputParser.js';

class BuildManager {
  constructor() {
    this.activeProcess = null;
    this.problems = [];
    this.outputListeners = new Set();
    this.stateListeners = new Set();
    this.problemsListeners = new Set();
  }

  isBuilding() {
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

  getProblems() {
    return [...this.problems];
  }

  clearProblems() {
    this.problems = [];
    this.notifyProblems();
  }

  onOutput(callback) {
    this.outputListeners.add(callback);
    return () => this.outputListeners.delete(callback);
  }

  onStateChange(callback) {
    this.stateListeners.add(callback);
    return () => this.stateListeners.delete(callback);
  }

  onProblemsChange(callback) {
    this.problemsListeners.add(callback);
    return () => this.problemsListeners.delete(callback);
  }

  notifyProblems() {
    this.problemsListeners.forEach((fn) => {
      try {
        fn(this.getProblems());
      } catch (e) {
        console.error('Error in build problems listener:', e);
      }
    });
  }

  notifyOutput(chunk, type) {
    this.outputListeners.forEach((fn) => {
      try {
        fn(chunk, type);
      } catch (e) {
        console.error('Error in build output listener:', e);
      }
    });
  }

  notifyState(state) {
    this.stateListeners.forEach((fn) => {
      try {
        fn(state, this.activeProcess);
      } catch (e) {
        console.error('Error in build state listener:', e);
      }
    });
  }

  /**
   * Starts a build task for the current project.
   */
  async startBuild({ workspaceRoot, fileTree = [], overrides = {} } = {}) {
    if (this.isBuilding()) {
      throw new Error('A build process is already currently running.');
    }

    // 1. Clear previous build problems
    this.clearProblems();

    // 2. Resolve build task command
    const taskPlan = await buildTaskResolver.resolveTask(TaskType.BUILD, {
      workspaceRoot,
      fileTree,
      explicitOverrides: overrides,
    });

    // 3. Create process
    const proc = new BuildProcess({
      id: `build_${Date.now()}`,
      taskType: TaskType.BUILD,
      command: taskPlan.command,
      args: taskPlan.args,
      cwd: taskPlan.cwd,
      env: taskPlan.env,
    });

    this.activeProcess = proc;

    // 4. Hook output for streaming & error parsing
    proc.onOutput((chunk, type) => {
      this.notifyOutput(chunk, type);

      // Parse problems from output chunks (both stdout and stderr)
      const parsed = buildOutputParser.parse(chunk);
      if (parsed.length > 0) {
        this.problems.push(...parsed);
        this.notifyProblems();
      }
    });

    // 5. Hook state changes
    proc.onStateChange((state) => {
      this.notifyState(state);
    });

    // 6. Launch process
    await proc.start();
    return proc;
  }

  async stopBuild() {
    if (this.activeProcess) {
      await this.activeProcess.stop();
    }
  }

  async killBuild() {
    if (this.activeProcess) {
      await this.activeProcess.kill();
    }
  }
}

export const buildManager = new BuildManager();
