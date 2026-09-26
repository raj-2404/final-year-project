/**
 * CodeX Coverage Manager
 * Level 3E — Code Coverage & Test Intelligence
 *
 * Central coordinator for:
 * - Coverage detection
 * - Execution & artifact parsing
 * - Storage & summary
 * - Editor decorations
 * - Uncovered code navigation
 */

import { coverageRunner } from './coverageRunner.js';
import { coverageDetector } from './coverageDetector.js';
import { coverageStore } from './coverageStore.js';
import { coverageDecorations } from './coverageDecorations.js';
import { coverageNavigation } from './coverageNavigation.js';
import { CoverageLifecycleState } from './coverageTypes.js';

class CoverageManager {
  constructor() {
    this.runner = coverageRunner;
    this.detector = coverageDetector;
    this.store = coverageStore;
    this.decorations = coverageDecorations;
    this.navigation = coverageNavigation;

    this.activeWorkspace = '';
    this.eventListeners = new Set();
  }

  setWorkspace(workspaceRoot) {
    this.activeWorkspace = workspaceRoot || '';
    this.store.setActiveWorkspace(this.activeWorkspace);
  }

  isBusy() {
    return this.runner.activeProcess?.state === CoverageLifecycleState.RUNNING;
  }

  async runCoverage({
    workspaceRoot = this.activeWorkspace,
    fileTree = [],
    framework = '',
    packageManager = 'npm',
    explicitOverrides = {},
  } = {}) {
    const root = workspaceRoot || this.activeWorkspace;
    this.setWorkspace(root);

    // If framework not specified, detect from workspace
    let effectiveFramework = framework;
    if (!effectiveFramework) {
      const detected = await this.detector.detect(fileTree, root);
      effectiveFramework = detected.framework;
    }

    this.emit({ type: 'coverage-started', workspaceRoot: root, framework: effectiveFramework });

    const result = await this.runner.runCoverage({
      workspaceRoot: root,
      fileTree,
      framework: effectiveFramework,
      packageManager,
      explicitOverrides,
      onOutput: (text, type) => {
        this.emit({ type: 'coverage-output', text, streamType: type });
      },
      onStateChange: (state) => {
        this.emit({ type: 'coverage-state-change', state });
      },
    });

    if (result.success) {
      this.emit({ type: 'coverage-completed', projectCoverage: result.projectCoverage });
      this.decorations.refresh();
    } else {
      this.emit({ type: 'coverage-failed', error: result.error });
    }

    return result;
  }

  stopCoverage() {
    this.runner.stop();
    this.emit({ type: 'coverage-stopped' });
  }

  clearCoverage(workspaceRoot = this.activeWorkspace) {
    const root = workspaceRoot || this.activeWorkspace;
    this.store.clearCoverage(root);
    this.decorations.clearDecorations();
    this.emit({ type: 'coverage-cleared', workspaceRoot: root });
  }

  getSummary(workspaceRoot = this.activeWorkspace) {
    return this.store.getSummary(workspaceRoot || this.activeWorkspace);
  }

  navigateNextUncovered(editor, filePath, workspaceRoot = this.activeWorkspace) {
    return this.navigation.nextUncoveredLine(editor, filePath, workspaceRoot || this.activeWorkspace);
  }

  navigatePreviousUncovered(editor, filePath, workspaceRoot = this.activeWorkspace) {
    return this.navigation.previousUncoveredLine(editor, filePath, workspaceRoot || this.activeWorkspace);
  }

  onEvent(listener) {
    if (typeof listener === 'function') {
      this.eventListeners.add(listener);
      return () => this.eventListeners.delete(listener);
    }
    return () => {};
  }

  emit(event) {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('[CoverageManager] Listener error:', err);
      }
    }
  }
}

export const coverageManager = new CoverageManager();
