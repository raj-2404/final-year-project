/**
 * CodeX Monaco Coverage Decorations Manager
 * Level 3E — Code Coverage & Test Intelligence
 *
 * Renders gutter markers and hover tooltips in Monaco Editor for:
 * - Covered lines (green)
 * - Partial lines (amber/yellow)
 * - Uncovered lines (red)
 *
 * Operates in its own decoration collection so it NEVER interferes with:
 * - Breakpoints
 * - Debug stepping line
 * - Linter diagnostics
 */

import { coverageStore } from './coverageStore.js';
import { CoverageStatus } from './coverageTypes.js';

export class CoverageDecorations {
  constructor() {
    this.editorDecorations = new Map(); // editorId -> decorationIds[]
    this.currentEditor = null;
    this.currentMonaco = null;
    this.currentFilePath = null;
    this.currentWorkspaceRoot = null;

    // Automatically re-render decorations when coverage store changes
    this.unsubscribeStore = coverageStore.subscribe(() => {
      this.refresh();
    });
  }

  attachEditor(editor, monaco, filePath, workspaceRoot) {
    this.currentEditor = editor;
    this.currentMonaco = monaco;
    this.currentFilePath = filePath;
    this.currentWorkspaceRoot = workspaceRoot;

    this.updateDecorations(editor, monaco, filePath, workspaceRoot);
  }

  setFile(filePath, workspaceRoot) {
    this.currentFilePath = filePath;
    if (workspaceRoot !== undefined) {
      this.currentWorkspaceRoot = workspaceRoot;
    }
    this.refresh();
  }

  refresh() {
    if (this.currentEditor && this.currentMonaco && this.currentFilePath) {
      this.updateDecorations(
        this.currentEditor,
        this.currentMonaco,
        this.currentFilePath,
        this.currentWorkspaceRoot
      );
    }
  }

  updateDecorations(editor, monaco, filePath, workspaceRoot) {
    if (!editor || !monaco || !filePath) return;

    const editorId = editor.getId ? editor.getId() : 'default';
    const oldDecorations = this.editorDecorations.get(editorId) || [];

    const fileCoverage = coverageStore.getFileCoverage(filePath, workspaceRoot);

    if (!fileCoverage || !fileCoverage.lineMap) {
      // Clear coverage decorations for this editor
      const createdIds = editor.deltaDecorations(oldDecorations, []);
      this.editorDecorations.set(editorId, createdIds);
      return;
    }

    const newDecorations = [];
    const lineEntries = Object.entries(fileCoverage.lineMap);

    for (const [lineStr, lineCov] of lineEntries) {
      const lineNum = Number(lineStr);
      if (!lineNum || lineNum <= 0) continue;

      let gutterClass = '';
      let hoverText = '';

      switch (lineCov.status) {
        case CoverageStatus.COVERED:
          gutterClass = 'codex-coverage-gutter-covered';
          hoverText = `**Covered** — Executed ${lineCov.hitCount} time${lineCov.hitCount === 1 ? '' : 's'}`;
          break;
        case CoverageStatus.PARTIAL: {
          gutterClass = 'codex-coverage-gutter-partial';
          const totalBranches = lineCov.branches.length;
          const coveredBranches = lineCov.branches.filter((b) => b.takenCount > 0).length;
          hoverText = `**Partially Covered** — ${coveredBranches} of ${totalBranches} branch${totalBranches === 1 ? '' : 'es'} taken`;
          break;
        }
        case CoverageStatus.UNCOVERED:
          gutterClass = 'codex-coverage-gutter-uncovered';
          hoverText = `**Not Covered** — Line never executed in test run`;
          break;
        default:
          continue;
      }

      newDecorations.push({
        range: new monaco.Range(lineNum, 1, lineNum, 1),
        options: {
          isWholeLine: false,
          linesDecorationsClassName: gutterClass,
          hoverMessage: {
            value: hoverText,
          },
        },
      });
    }

    const createdIds = editor.deltaDecorations(oldDecorations, newDecorations);
    this.editorDecorations.set(editorId, createdIds);
  }

  clearDecorations(editor = this.currentEditor) {
    if (!editor) return;
    const editorId = editor.getId ? editor.getId() : 'default';
    const oldDecorations = this.editorDecorations.get(editorId) || [];
    editor.deltaDecorations(oldDecorations, []);
    this.editorDecorations.delete(editorId);
  }

  dispose() {
    if (this.unsubscribeStore) {
      this.unsubscribeStore();
      this.unsubscribeStore = null;
    }
    this.clearDecorations();
    this.currentEditor = null;
    this.currentMonaco = null;
  }
}

export const coverageDecorations = new CoverageDecorations();
