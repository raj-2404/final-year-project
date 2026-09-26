/**
 * CodeX Coverage Navigation
 * Level 3E — Code Coverage & Test Intelligence
 *
 * Provides actions to jump between uncovered and partially covered lines in Monaco Editor.
 */

import { coverageStore } from './coverageStore.js';

export class CoverageNavigation {
  constructor(store = coverageStore) {
    this.store = store;
  }

  /**
   * Jumps to the next uncovered or partially covered line in the current editor.
   */
  nextUncoveredLine(editor, filePath, workspaceRoot) {
    if (!editor || !filePath) return null;

    const fileCoverage = this.store.getFileCoverage(filePath, workspaceRoot);
    if (!fileCoverage) return null;

    const attentionLines = fileCoverage.getAttentionLines();
    if (attentionLines.length === 0) return null;

    const currentPosition = editor.getPosition();
    const currentLine = currentPosition ? currentPosition.lineNumber : 1;

    // Find first line strictly greater than currentLine
    let targetLine = attentionLines.find((line) => line > currentLine);

    // If none found after current position, wrap to the first one
    if (!targetLine) {
      targetLine = attentionLines[0];
    }

    this.jumpToLine(editor, targetLine);
    return targetLine;
  }

  /**
   * Jumps to the previous uncovered or partially covered line in the current editor.
   */
  previousUncoveredLine(editor, filePath, workspaceRoot) {
    if (!editor || !filePath) return null;

    const fileCoverage = this.store.getFileCoverage(filePath, workspaceRoot);
    if (!fileCoverage) return null;

    const attentionLines = fileCoverage.getAttentionLines();
    if (attentionLines.length === 0) return null;

    const currentPosition = editor.getPosition();
    const currentLine = currentPosition ? currentPosition.lineNumber : 1;

    // Find lines strictly before currentLine
    const priorLines = attentionLines.filter((line) => line < currentLine);

    // If any prior, take the last one; otherwise wrap to the last attention line
    const targetLine = priorLines.length > 0 ? priorLines[priorLines.length - 1] : attentionLines[attentionLines.length - 1];

    this.jumpToLine(editor, targetLine);
    return targetLine;
  }

  jumpToLine(editor, lineNumber) {
    if (!editor || !lineNumber) return;

    editor.setPosition({ lineNumber, column: 1 });
    editor.revealLineInCenter(lineNumber);
    editor.focus();
  }
}

export const coverageNavigation = new CoverageNavigation();
