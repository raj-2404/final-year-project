/**
 * CodeX Code Coverage Models
 * Level 3E — Code Coverage & Test Intelligence
 *
 * Framework-independent normalized models for project, file, line, branch, and function coverage.
 */

import { CoverageStatus, DefaultCoverageThresholds } from './coverageTypes.js';

export function calculateMetric(covered = 0, total = 0) {
  const safeTotal = Math.max(0, Number(total) || 0);
  const safeCovered = Math.max(0, Math.min(Number(covered) || 0, safeTotal));
  const pct = safeTotal === 0 ? 100 : Number(((safeCovered / safeTotal) * 100).toFixed(2));
  return { total: safeTotal, covered: safeCovered, pct };
}

export class BranchCoverage {
  constructor({ line = 0, branchNumber = 0, takenCount = 0, totalCount = 1 } = {}) {
    this.line = Number(line);
    this.branchNumber = Number(branchNumber);
    this.takenCount = Number(takenCount) || 0;
    this.totalCount = Number(totalCount) || 1;
  }

  get isCovered() {
    return this.takenCount > 0;
  }
}

export class FunctionCoverage {
  constructor({ name = '', lineNumber = 0, hitCount = 0 } = {}) {
    this.name = String(name || '');
    this.lineNumber = Number(lineNumber) || 0;
    this.hitCount = Number(hitCount) || 0;
  }

  get isCovered() {
    return this.hitCount > 0;
  }
}

export class LineCoverage {
  constructor({ lineNumber = 0, hitCount = 0, branches = [] } = {}) {
    this.lineNumber = Number(lineNumber);
    this.hitCount = Number(hitCount) || 0;
    this.branches = Array.isArray(branches) ? branches : [];
  }

  get status() {
    if (this.hitCount === 0) {
      return CoverageStatus.UNCOVERED;
    }
    if (this.branches.length > 0) {
      const taken = this.branches.filter((b) => b.takenCount > 0).length;
      if (taken < this.branches.length) {
        return CoverageStatus.PARTIAL;
      }
    }
    return CoverageStatus.COVERED;
  }
}

export class FileCoverage {
  constructor({
    file = '',
    fullPath = '',
    lines = { total: 0, covered: 0 },
    statements = { total: 0, covered: 0 },
    functions = { total: 0, covered: 0 },
    branches = { total: 0, covered: 0 },
    lineMap = {},
    functionList = [],
  } = {}) {
    this.file = String(file || '');
    this.fullPath = String(fullPath || file || '');
    this.lines = calculateMetric(lines.covered, lines.total);
    this.statements = calculateMetric(statements.covered, statements.total);
    this.functions = calculateMetric(functions.covered, functions.total);
    this.branches = calculateMetric(branches.covered, branches.total);
    this.lineMap = lineMap || {}; // Map line number -> LineCoverage
    this.functionList = Array.isArray(functionList) ? functionList : [];
  }

  getLine(lineNumber) {
    return this.lineMap[lineNumber] || null;
  }

  getUncoveredLines() {
    const list = [];
    for (const [lineStr, lineCov] of Object.entries(this.lineMap)) {
      if (lineCov.status === CoverageStatus.UNCOVERED) {
        list.push(Number(lineStr));
      }
    }
    return list.sort((a, b) => a - b);
  }

  getPartialLines() {
    const list = [];
    for (const [lineStr, lineCov] of Object.entries(this.lineMap)) {
      if (lineCov.status === CoverageStatus.PARTIAL) {
        list.push(Number(lineStr));
      }
    }
    return list.sort((a, b) => a - b);
  }

  getAttentionLines() {
    // Both uncovered and partial lines that need testing attention
    const list = [];
    for (const [lineStr, lineCov] of Object.entries(this.lineMap)) {
      if (lineCov.status === CoverageStatus.UNCOVERED || lineCov.status === CoverageStatus.PARTIAL) {
        list.push(Number(lineStr));
      }
    }
    return list.sort((a, b) => a - b);
  }
}

export class ProjectCoverage {
  constructor({
    workspaceRoot = '',
    framework = '',
    timestamp = Date.now(),
    files = {},
    thresholds = DefaultCoverageThresholds,
  } = {}) {
    this.workspaceRoot = workspaceRoot;
    this.framework = framework;
    this.timestamp = timestamp;
    this.files = files; // Map of normalized path -> FileCoverage
    this.thresholds = { ...DefaultCoverageThresholds, ...thresholds };

    this.recomputeTotals();
  }

  recomputeTotals() {
    let lineTot = 0, lineCov = 0;
    let stmtTot = 0, stmtCov = 0;
    let fnTot = 0, fnCov = 0;
    let brTot = 0, brCov = 0;

    const fileEntries = Object.values(this.files);
    for (const file of fileEntries) {
      lineTot += file.lines.total;
      lineCov += file.lines.covered;
      stmtTot += file.statements.total;
      stmtCov += file.statements.covered;
      fnTot += file.functions.total;
      fnCov += file.functions.covered;
      brTot += file.branches.total;
      brCov += file.branches.covered;
    }

    this.lines = calculateMetric(lineCov, lineTot);
    this.statements = calculateMetric(stmtCov, stmtTot);
    this.functions = calculateMetric(fnCov, fnTot);
    this.branches = calculateMetric(brCov, brTot);

    this.passedThresholds =
      this.lines.pct >= (this.thresholds.lines || 0) &&
      this.statements.pct >= (this.thresholds.statements || 0) &&
      this.functions.pct >= (this.thresholds.functions || 0) &&
      this.branches.pct >= (this.thresholds.branches || 0);
  }

  getFile(filePath) {
    if (!filePath) return null;
    const normalized = filePath.replace(/\\/g, '/');

    // Direct match
    if (this.files[normalized]) return this.files[normalized];

    // Relative match or suffix match
    for (const [key, file] of Object.entries(this.files)) {
      if (key === normalized || key.endsWith(normalized) || normalized.endsWith(key)) {
        return file;
      }
    }
    return null;
  }
}
