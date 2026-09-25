/**
 * CodeX Test Runner Engine
 * Level 3D — Test Execution Orchestration
 *
 * Coordinates execution plans, process execution, and live result mapping into the test tree.
 */

import { TestLifecycleState, TestStatus } from './testTypes.js';
import { TestProcess } from './testProcess.js';
import { testRegistry } from './testRegistry.js';
import { testConfiguration } from './testConfiguration.js';
import { testResultParser } from './testResultParser.js';

export class TestRunner {
  constructor() {
    this.activeProcess = null;
    this.problems = [];
    this.outputListeners = new Set();
    this.stateListeners = new Set();
    this.problemsListeners = new Set();
  }

  isRunning() {
    return (
      this.activeProcess &&
      (this.activeProcess.state === TestLifecycleState.RUNNING ||
        this.activeProcess.state === TestLifecycleState.STOPPING)
    );
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

  notifyOutput(chunk, type) {
    this.outputListeners.forEach((fn) => {
      try {
        fn(chunk, type);
      } catch (e) {
        console.error('Error in test runner output listener:', e);
      }
    });
  }

  notifyState(state, proc) {
    this.stateListeners.forEach((fn) => {
      try {
        fn(state, proc);
      } catch (e) {
        console.error('Error in test runner state listener:', e);
      }
    });
  }

  notifyProblems() {
    this.problemsListeners.forEach((fn) => {
      try {
        fn([...this.problems]);
      } catch (e) {
        console.error('Error in test runner problems listener:', e);
      }
    });
  }

  /**
   * Executes a test target (project, file, suite, test).
   */
  async run({
    target,
    framework,
    workspaceRoot = '',
    fileTree = [],
    packageManager = 'npm',
    testTree,
    overrides = {},
  }) {
    if (this.isRunning()) {
      throw new Error('A test run is already currently active. Stop it first.');
    }

    this.problems = [];
    this.notifyProblems();

    // 1. Resolve provider
    const provider = testRegistry.getProvider(framework);
    if (!provider) {
      throw new Error(`No test provider registered for framework: ${framework}`);
    }

    // 2. Resolve default target command from provider
    const detectedDefault = provider.resolveRunTarget(target, {
      workspaceRoot,
      packageManager,
    });
    detectedDefault.framework = framework;

    // 3. Resolve configuration hierarchy (explicit -> tasks.json -> project.json -> detected)
    const taskPlan = await testConfiguration.resolveTestConfig({
      workspaceRoot,
      fileTree,
      detectedDefault,
      explicitOverrides: overrides,
    });

    if (!taskPlan || !taskPlan.command) {
      throw new Error(`Unable to determine test command for ${framework}.`);
    }

    // 4. Mark targeted nodes as RUNNING in testTree
    if (testTree) {
      if (!target || target.type === 'project') {
        testTree.resetAllStatus(TestStatus.RUNNING);
      } else if (target.id) {
        testTree.updateNodeStatus(target.id, TestStatus.RUNNING);
        // Also mark children running
        testTree.getChildren(target.id).forEach((c) => {
          testTree.updateNodeStatus(c.id, TestStatus.RUNNING);
        });
      }
    }

    // 5. Create process
    const proc = new TestProcess({
      id: `test_${Date.now()}`,
      command: taskPlan.command,
      args: taskPlan.args,
      cwd: taskPlan.cwd,
      env: taskPlan.env,
      target,
    });

    this.activeProcess = proc;

    // 6. Hook output and stream/parse
    proc.onOutput((chunk, type) => {
      this.notifyOutput(chunk, type);

      const parsed = testResultParser.parse(chunk, framework);

      // Add problems
      if (parsed.problems.length > 0) {
        this.problems.push(...parsed.problems);
        this.notifyProblems();
      }

      // Update test tree node statuses
      if (testTree && parsed.results.length > 0) {
        parsed.results.forEach((res) => {
          const allNodes = testTree.getAllNodes();
          const matched = allNodes.find(
            (n) =>
              n.name === res.fullName ||
              res.fullName.endsWith(n.name) ||
              (n.file && res.fullName.includes(n.file))
          );
          if (matched) {
            testTree.updateNodeStatus(matched.id, res.status, {
              duration: res.duration,
              message: res.message,
            });
          }
        });
      }
    });

    // 7. Hook state changes
    proc.onStateChange((state) => {
      this.notifyState(state, proc);

      // On final completion, resolve any remaining RUNNING nodes
      if (
        testTree &&
        (state === TestLifecycleState.PASSED ||
          state === TestLifecycleState.FAILED ||
          state === TestLifecycleState.CANCELLED)
      ) {
        const fallbackStatus =
          state === TestLifecycleState.PASSED
            ? TestStatus.PASSED
            : state === TestLifecycleState.CANCELLED
            ? TestStatus.CANCELLED
            : TestStatus.FAILED;

        testTree.getAllNodes().forEach((n) => {
          if (n.status === TestStatus.RUNNING) {
            testTree.updateNodeStatus(n.id, fallbackStatus);
          }
        });
      }
    });

    await proc.start();
    return proc;
  }

  async stop() {
    if (this.activeProcess) {
      await this.activeProcess.stop();
    }
  }

  async kill() {
    if (this.activeProcess) {
      await this.activeProcess.kill();
    }
  }
}

export const testRunner = new TestRunner();
