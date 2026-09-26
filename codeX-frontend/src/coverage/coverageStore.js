/**
 * CodeX In-Memory Coverage Store
 * Level 3E — Code Coverage & Test Intelligence
 *
 * Workspace-aware, indexed storage for active coverage runs, project totals, and per-file coverage.
 */

export class CoverageStore {
  constructor() {
    this.runs = new Map(); // workspaceRoot -> ProjectCoverage
    this.activeWorkspace = '';
    this.listeners = new Set();
  }

  setActiveWorkspace(workspaceRoot) {
    this.activeWorkspace = workspaceRoot ? workspaceRoot.replace(/\\/g, '/') : '';
  }

  setCoverage(workspaceRoot, projectCoverage) {
    const key = workspaceRoot ? workspaceRoot.replace(/\\/g, '/') : '';
    this.runs.set(key, projectCoverage);
    this.notify({ type: 'coverage-updated', workspaceRoot: key, projectCoverage });
  }

  getCoverage(workspaceRoot) {
    const key = workspaceRoot ? workspaceRoot.replace(/\\/g, '/') : this.activeWorkspace;
    return this.runs.get(key) || null;
  }

  getFileCoverage(filePath, workspaceRoot) {
    const project = this.getCoverage(workspaceRoot);
    if (!project) return null;
    return project.getFile(filePath);
  }

  getLineCoverage(filePath, lineNumber, workspaceRoot) {
    const file = this.getFileCoverage(filePath, workspaceRoot);
    if (!file) return null;
    return file.getLine(lineNumber);
  }

  getSummary(workspaceRoot) {
    const project = this.getCoverage(workspaceRoot);
    if (!project) {
      return {
        hasCoverage: false,
        lines: { total: 0, covered: 0, pct: 0 },
        statements: { total: 0, covered: 0, pct: 0 },
        functions: { total: 0, covered: 0, pct: 0 },
        branches: { total: 0, covered: 0, pct: 0 },
        passedThresholds: true,
        fileCount: 0,
        framework: '',
        timestamp: null,
      };
    }

    return {
      hasCoverage: true,
      lines: project.lines,
      statements: project.statements,
      functions: project.functions,
      branches: project.branches,
      passedThresholds: project.passedThresholds,
      fileCount: Object.keys(project.files).length,
      framework: project.framework,
      timestamp: project.timestamp,
    };
  }

  clearCoverage(workspaceRoot) {
    const key = workspaceRoot ? workspaceRoot.replace(/\\/g, '/') : this.activeWorkspace;
    if (key) {
      this.runs.delete(key);
    } else {
      this.runs.clear();
    }
    this.notify({ type: 'coverage-cleared', workspaceRoot: key });
  }

  subscribe(listener) {
    if (typeof listener === 'function') {
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    }
    return () => {};
  }

  notify(event) {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('[CoverageStore] Listener error:', err);
      }
    }
  }
}

export const coverageStore = new CoverageStore();
