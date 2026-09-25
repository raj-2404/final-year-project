/**
 * CodeX Breakpoint Manager
 * Level 3B — Breakpoint Management & Monaco Decoration Bridge
 *
 * Manages:
 * - In-memory breakpoint registry across workspace files
 * - Breakpoint state: verified, unverified, pending, enabled/disabled
 * - Monaco Editor glyph-margin decorations (red circle markers in gutter)
 * - Breakpoint synchronization with active DAP sessions
 */

import { BreakpointStatus } from './debugTypes.js';

class BreakpointManager {
  constructor() {
    this.breakpoints = new Map(); // fileUri -> Map<line, Breakpoint>
    this.listeners = new Set();
    this.editorDecorations = new Map(); // editorInstanceId -> decorationIds[]
  }

  /**
   * Generates a stable key for file URI.
   */
  normalizeUri(uri) {
    if (!uri) return '';
    return uri.replace(/\\/g, '/');
  }

  /**
   * Toggles a breakpoint at a specific line in a file.
   */
  toggleBreakpoint(fileUri, line) {
    const norm = this.normalizeUri(fileUri);
    const fileBps = this.breakpoints.get(norm);

    if (fileBps && fileBps.has(line)) {
      this.removeBreakpoint(fileUri, line);
      return null;
    } else {
      return this.addBreakpoint(fileUri, line);
    }
  }

  /**
   * Adds a breakpoint.
   */
  addBreakpoint(fileUri, line, column = 1) {
    const norm = this.normalizeUri(fileUri);
    if (!this.breakpoints.has(norm)) {
      this.breakpoints.set(norm, new Map());
    }

    const bp = {
      id: `bp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      fileUri: norm,
      line: parseInt(line, 10),
      column: parseInt(column, 10) || 1,
      enabled: true,
      status: BreakpointStatus.PENDING,
      verifiedLine: parseInt(line, 10),
    };

    this.breakpoints.get(norm).set(bp.line, bp);
    this.notifyChange();
    return bp;
  }

  /**
   * Removes a breakpoint.
   */
  removeBreakpoint(fileUri, line) {
    const norm = this.normalizeUri(fileUri);
    const fileBps = this.breakpoints.get(norm);
    if (fileBps && fileBps.has(line)) {
      fileBps.delete(line);
      if (fileBps.size === 0) {
        this.breakpoints.delete(norm);
      }
      this.notifyChange();
      return true;
    }
    return false;
  }

  /**
   * Toggles enabled state of a breakpoint.
   */
  toggleBreakpointEnabled(fileUri, line) {
    const norm = this.normalizeUri(fileUri);
    const bp = this.breakpoints.get(norm)?.get(line);
    if (bp) {
      bp.enabled = !bp.enabled;
      this.notifyChange();
      return bp.enabled;
    }
    return false;
  }

  /**
   * Removes all breakpoints across all files.
   */
  removeAllBreakpoints() {
    this.breakpoints.clear();
    this.notifyChange();
  }

  /**
   * Gets all breakpoints for a given file.
   */
  getBreakpointsForFile(fileUri) {
    const norm = this.normalizeUri(fileUri);
    const fileBps = this.breakpoints.get(norm);
    if (!fileBps) return [];
    return Array.from(fileBps.values()).sort((a, b) => a.line - b.line);
  }

  /**
   * Gets all breakpoints across all files.
   */
  getAllBreakpoints() {
    const result = [];
    for (const fileBps of this.breakpoints.values()) {
      for (const bp of fileBps.values()) {
        result.push(bp);
      }
    }
    return result.sort((a, b) => a.fileUri.localeCompare(b.fileUri) || a.line - b.line);
  }

  /**
   * Updates verification status reported by debug adapter.
   */
  updateVerification(fileUri, line, verified, actualLine = null) {
    const norm = this.normalizeUri(fileUri);
    const bp = this.breakpoints.get(norm)?.get(line);
    if (bp) {
      bp.status = verified ? BreakpointStatus.VERIFIED : BreakpointStatus.UNVERIFIED;
      if (actualLine) {
        bp.verifiedLine = actualLine;
      }
      this.notifyChange();
    }
  }

  /**
   * Resets verification status of all breakpoints to pending.
   */
  resetAllToPending() {
    for (const fileBps of this.breakpoints.values()) {
      for (const bp of fileBps.values()) {
        bp.status = BreakpointStatus.PENDING;
      }
    }
    this.notifyChange();
  }

  /**
   * Updates Monaco editor decorations for breakpoints on the active file.
   */
  updateMonacoDecorations(editor, monaco, activeFileUri) {
    if (!editor || !monaco || !activeFileUri) return;

    const norm = this.normalizeUri(activeFileUri);
    const bps = this.getBreakpointsForFile(norm);

    const newDecorations = bps.map((bp) => {
      let glyphClass = 'codex-breakpoint-glyph';
      if (!bp.enabled) {
        glyphClass += ' disabled';
      } else if (bp.status === BreakpointStatus.UNVERIFIED) {
        glyphClass += ' unverified';
      }

      return {
        range: new monaco.Range(bp.line, 1, bp.line, 1),
        options: {
          isWholeLine: false,
          glyphMarginClassName: glyphClass,
          glyphMarginHoverMessage: {
            value: `Breakpoint (Line ${bp.line})${bp.enabled ? '' : ' [Disabled]'}${bp.status === BreakpointStatus.VERIFIED ? ' [Verified]' : ''}`,
          },
        },
      };
    });

    const editorId = editor.getId ? editor.getId() : 'default';
    const oldDecorations = this.editorDecorations.get(editorId) || [];
    const createdIds = editor.deltaDecorations(oldDecorations, newDecorations);
    this.editorDecorations.set(editorId, createdIds);
  }

  onDidChangeBreakpoints(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notifyChange() {
    const all = this.getAllBreakpoints();
    this.listeners.forEach((fn) => {
      try {
        fn(all);
      } catch (err) {
        console.error('[BreakpointManager] Listener error:', err);
      }
    });
  }
}

export const breakpointManager = new BreakpointManager();
