/**
 * CodeX Test Manager
 * Level 3D — Central Test Coordinator
 *
 * Coordinates test discovery, execution, status synchronization,
 * and UI notification across the IDE.
 */

import { TestLifecycleState } from './testTypes.js';
import { TestTree } from './testTree.js';
import { testDetector } from './testDetector.js';
import { testDiscovery } from './testDiscovery.js';
import { testRunner } from './testRunner.js';
import { testController } from './testController.js';

class TestManager {
  constructor() {
    this.testTree = new TestTree();
    this.activeFramework = null;
    this.detectedFrameworks = [];
    this.packageManager = 'npm';
    this.workspaceRoot = '';
    this.fileTree = [];

    this.state = TestLifecycleState.IDLE;
    this.treeListeners = new Set();
    this.stateListeners = new Set();
    this.outputListeners = new Set();
    this.problemsListeners = new Set();

    // Wire runner listeners to manager
    testRunner.onOutput((chunk, type) => {
      this.notifyOutput(chunk, type);
    });

    testRunner.onStateChange((state) => {
      this.state = state;
      this.notifyState(state);
      this.notifyTreeChange();
    });

    testRunner.onProblemsChange((problems) => {
      this.notifyProblems(problems);
    });
  }

  getState() {
    return this.state;
  }

  getTree() {
    return this.testTree;
  }

  getStats() {
    return this.testTree.getStats();
  }

  getActiveFramework() {
    return this.activeFramework;
  }

  setActiveFramework(framework) {
    this.activeFramework = framework;
    this.notifyTreeChange();
  }

  onTreeChange(callback) {
    this.treeListeners.add(callback);
    return () => this.treeListeners.delete(callback);
  }

  onStateChange(callback) {
    this.stateListeners.add(callback);
    return () => this.stateListeners.delete(callback);
  }

  onOutput(callback) {
    this.outputListeners.add(callback);
    return () => this.outputListeners.delete(callback);
  }

  onProblemsChange(callback) {
    this.problemsListeners.add(callback);
    return () => this.problemsListeners.delete(callback);
  }

  notifyTreeChange() {
    this.treeListeners.forEach((fn) => {
      try {
        fn(this.testTree);
      } catch (e) {
        console.error('Error in tree listener:', e);
      }
    });
  }

  notifyState(state) {
    this.stateListeners.forEach((fn) => {
      try {
        fn(state);
      } catch (e) {
        console.error('Error in state listener:', e);
      }
    });
  }

  notifyOutput(chunk, type) {
    this.outputListeners.forEach((fn) => {
      try {
        fn(chunk, type);
      } catch (e) {
        console.error('Error in output listener:', e);
      }
    });
  }

  notifyProblems(problems) {
    this.problemsListeners.forEach((fn) => {
      try {
        fn(problems);
      } catch (e) {
        console.error('Error in problems listener:', e);
      }
    });
  }

  /**
   * Discovers test files and test suites across the workspace.
   */
  async discoverTests({ workspaceRoot = '', fileTree = [] } = {}) {
    this.workspaceRoot = workspaceRoot;
    this.fileTree = fileTree;
    this.state = TestLifecycleState.DISCOVERING;
    this.notifyState(this.state);

    const detection = testDetector.detect(fileTree, workspaceRoot);
    this.detectedFrameworks = detection.detectedFrameworks;
    this.packageManager = detection.packageManager;

    if (!this.activeFramework || !this.detectedFrameworks.includes(this.activeFramework)) {
      this.activeFramework = detection.primaryFramework || this.detectedFrameworks[0] || null;
    }

    await testDiscovery.discover(
      detection.testFiles,
      this.testTree,
      this.activeFramework,
      workspaceRoot
    );

    this.state = TestLifecycleState.READY;
    this.notifyState(this.state);
    this.notifyTreeChange();
  }

  /**
   * Runs the entire test suite/project.
   */
  async runAllTests(overrides = {}) {
    if (!this.activeFramework) {
      throw new Error('No test framework detected or selected.');
    }

    return await testRunner.run({
      target: { type: 'project', label: 'All Tests' },
      framework: this.activeFramework,
      workspaceRoot: this.workspaceRoot,
      fileTree: this.fileTree,
      packageManager: this.packageManager,
      testTree: this.testTree,
      overrides,
    });
  }

  /**
   * Runs a specific file's tests.
   */
  async runFileTests(file, overrides = {}) {
    if (!this.activeFramework) {
      throw new Error('No test framework detected or selected.');
    }

    const filePath = file.path || file.name;
    return await testRunner.run({
      target: { type: 'file', file: filePath, name: file.name || filePath.split('/').pop() },
      framework: this.activeFramework,
      workspaceRoot: this.workspaceRoot,
      fileTree: this.fileTree,
      packageManager: this.packageManager,
      testTree: this.testTree,
      overrides,
    });
  }

  /**
   * Runs a selected test node (file, suite, or individual test).
   */
  async runTestNode(nodeId, overrides = {}) {
    const node = this.testTree.getNode(nodeId);
    if (!node) {
      throw new Error(`Test node not found: ${nodeId}`);
    }

    return await testRunner.run({
      target: node,
      framework: node.framework || this.activeFramework,
      workspaceRoot: this.workspaceRoot,
      fileTree: this.fileTree,
      packageManager: this.packageManager,
      testTree: this.testTree,
      overrides,
    });
  }

  /**
   * Starts debugging for a selected test node.
   */
  async debugTestNode(nodeId) {
    const node = this.testTree.getNode(nodeId);
    if (!node) {
      throw new Error(`Test node not found: ${nodeId}`);
    }

    await testController.debugTarget(node, {
      framework: node.framework || this.activeFramework,
      workspaceRoot: this.workspaceRoot,
      fileTree: this.fileTree,
    });
  }

  /**
   * Stops active test run.
   */
  async stopTests() {
    await testRunner.stop();
  }

  /**
   * Force kills active test run.
   */
  async killTests() {
    await testRunner.kill();
  }
}

export const testManager = new TestManager();
