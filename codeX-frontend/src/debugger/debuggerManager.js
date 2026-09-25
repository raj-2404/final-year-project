/**
 * CodeX Debugger Manager
 * Level 3B — Central Debugger Coordinator & Monaco Editor Bridge
 *
 * Coordinates:
 * - Active Debug Session lifecycle
 * - Breakpoint management & Monaco gutter click interaction
 * - Current execution location tracking, line highlight, and gutter arrow glyph
 * - Cross-file jump when paused in another file
 * - Keyboard shortcuts (F5, F6, F10, F11, Shift+F11, Shift+F5, Ctrl+Shift+F5)
 * - Variables & Scopes inspection
 */

import { DebugSession } from './debugSession.js';
import { breakpointManager } from './breakpointManager.js';
import { debugAdapterRegistry } from './debugAdapter.js';
import { DebugSessionState } from './debugTypes.js';

class DebuggerManager {
  constructor() {
    this.activeSession = null;
    this.monaco = null;
    this.editor = null;
    this.activeFile = null;
    this.fileTree = [];
    this.workspaceRoot = '';
    this.navigationHandler = null;
    this.activeLineDecorations = [];
    this.listeners = new Set();
    this.gutterListenerDisposed = null;

    // Listen to breakpoint changes to refresh editor decorations
    breakpointManager.onDidChangeBreakpoints(() => {
      this.refreshBreakpoints();
      this.notifyState();
    });
  }

  /**
   * Initializes DebuggerManager with Monaco instance and context.
   */
  initialize(monaco, context = {}) {
    this.monaco = monaco;
    this.workspaceRoot = context.workspaceRoot || this.workspaceRoot;
    this.fileTree = context.fileTree || this.fileTree;
    this.navigationHandler = context.onNavigate || this.navigationHandler;
  }

  /**
   * Attaches Monaco Editor instance for gutter clicks and decorations.
   */
  attachEditor(editor, monaco, activeFile, options = {}) {
    this.editor = editor;
    this.monaco = monaco || this.monaco;
    this.activeFile = activeFile;
    if (options.fileTree) this.fileTree = options.fileTree;
    if (options.workspaceRoot) this.workspaceRoot = options.workspaceRoot;
    if (options.onNavigate) this.navigationHandler = options.onNavigate;

    // 1. Setup Gutter Click Listener for Breakpoints
    if (this.gutterListenerDisposed) {
      try {
        this.gutterListenerDisposed.dispose();
      } catch {}
      this.gutterListenerDisposed = null;
    }

    if (this.editor?.onMouseDown) {
      this.gutterListenerDisposed = this.editor.onMouseDown((e) => {
        this.handleEditorMouseDown(e);
      });
    }

    // 2. Render current breakpoints on active file
    this.refreshBreakpoints();

    // 3. Re-render active execution line if paused on active file
    this.refreshActiveExecutionLine();
  }

  handleEditorMouseDown(e) {
    if (!this.activeFile || !this.editor || !this.monaco) return;

    // Target types: GUTTER_GLYPH_MARGIN (2) or GUTTER_LINE_NUMBERS (3)
    const targetType = e.target?.type;
    const isGutterClick =
      targetType === this.monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN ||
      targetType === this.monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS;

    if (isGutterClick) {
      const line = e.target.position?.lineNumber;
      if (line && line > 0) {
        const fileUri = this.activeFile.path || this.activeFile.name;
        breakpointManager.toggleBreakpoint(fileUri, line);

        // If session is running, synchronize immediately
        if (this.activeSession) {
          const bps = breakpointManager.getBreakpointsForFile(fileUri);
          this.activeSession.syncBreakpointsForFile(fileUri, bps);
        }
      }
    }
  }

  /**
   * Starts a debugging session for a file or configuration.
   */
  async startDebugging(config = {}, targetFile = this.activeFile) {
    if (this.activeSession && this.activeSession.state !== DebugSessionState.STOPPED) {
      console.warn('[DebuggerManager] Debug session is already active');
      return this.activeSession;
    }

    const resolved = debugAdapterRegistry.resolveLaunchConfig(
      config,
      targetFile,
      this.workspaceRoot
    );

    const session = new DebugSession();
    this.activeSession = session;

    session.onEvent((type, data) => {
      this.handleSessionEvent(type, data);
    });

    try {
      await session.start(resolved, this.workspaceRoot);
      this.notifyState();
      return session;
    } catch (err) {
      this.activeSession = null;
      this.clearExecutionLine();
      this.notifyState();
      throw err;
    }
  }

  handleSessionEvent(type, data) {
    if (type === 'stopped') {
      this.handleExecutionStopped(data);
    } else if (type === 'continued') {
      this.clearExecutionLine();
    } else if (type === 'terminated') {
      this.clearExecutionLine();
      this.activeSession = null;
    }

    this.notifyState();
  }

  /**
   * Handles paused execution: highlights execution line and jumps to file if needed.
   */
  handleExecutionStopped(data) {
    const frame = data.frame;
    if (!frame) return;

    const framePath = frame.source?.path;
    const line = frame.line;
    const column = frame.column || 1;

    // 1. Check if paused file is different from active file
    if (framePath && this.navigationHandler && this.fileTree.length > 0) {
      const normFrame = framePath.replace(/\\/g, '/');
      const isCurrentFile =
        this.activeFile &&
        (this.activeFile.path?.replace(/\\/g, '/') === normFrame ||
          this.activeFile.name === normFrame.split('/').pop());

      if (!isCurrentFile) {
        // Find matching file in tree
        const target = this.fileTree.find(
          (f) =>
            f.type === 'file' &&
            (f.path?.replace(/\\/g, '/') === normFrame ||
              normFrame.endsWith('/' + f.name) ||
              normFrame.endsWith('\\' + f.name))
        );

        if (target) {
          this.navigationHandler(target, { lineNumber: line, column });
        }
      }
    }

    // 2. Highlight line in editor
    this.highlightExecutionLine(line, column);
  }

  highlightExecutionLine(line, column = 1) {
    if (!this.editor || !this.monaco || !line) return;

    try {
      this.editor.revealLineInCenter(line);
      this.editor.setPosition({ lineNumber: line, column });

      const newDecorations = [
        {
          range: new this.monaco.Range(line, 1, line, 1),
          options: {
            isWholeLine: true,
            className: 'codex-debug-active-line',
            glyphMarginClassName: 'codex-debug-active-glyph',
            glyphMarginHoverMessage: { value: 'Current Execution Location' },
          },
        },
      ];

      this.activeLineDecorations = this.editor.deltaDecorations(
        this.activeLineDecorations,
        newDecorations
      );
    } catch (err) {
      console.warn('[DebuggerManager] Error highlighting execution line:', err);
    }
  }

  clearExecutionLine() {
    if (this.editor && this.activeLineDecorations.length > 0) {
      try {
        this.activeLineDecorations = this.editor.deltaDecorations(
          this.activeLineDecorations,
          []
        );
      } catch {}
    }
  }

  refreshActiveExecutionLine() {
    if (
      this.activeSession &&
      this.activeSession.state === DebugSessionState.PAUSED &&
      this.activeSession.activeFrame
    ) {
      const frame = this.activeSession.activeFrame;
      const framePath = frame.source?.path?.replace(/\\/g, '/');
      const activePath = (this.activeFile?.path || this.activeFile?.name || '').replace(/\\/g, '/');

      if (framePath && activePath && (framePath === activePath || framePath.endsWith('/' + this.activeFile?.name))) {
        this.highlightExecutionLine(frame.line, frame.column);
      }
    } else {
      this.clearExecutionLine();
    }
  }

  refreshBreakpoints() {
    if (this.editor && this.monaco && this.activeFile) {
      const fileUri = this.activeFile.path || this.activeFile.name;
      breakpointManager.updateMonacoDecorations(this.editor, this.monaco, fileUri);
    }
  }

  // --- Controls delegated to active session ---

  async continue() {
    if (this.activeSession) await this.activeSession.continue();
  }

  async pause() {
    if (this.activeSession) await this.activeSession.pause();
  }

  async stepOver() {
    if (this.activeSession) await this.activeSession.stepOver();
  }

  async stepInto() {
    if (this.activeSession) await this.activeSession.stepInto();
  }

  async stepOut() {
    if (this.activeSession) await this.activeSession.stepOut();
  }

  async restart() {
    if (this.activeSession) await this.activeSession.restart();
  }

  async stop() {
    if (this.activeSession) {
      await this.activeSession.stop();
      this.activeSession = null;
      this.clearExecutionLine();
      this.notifyState();
    }
  }

  getActiveSession() {
    return this.activeSession;
  }

  onStateChange(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notifyState() {
    const state = {
      isDebugging: Boolean(this.activeSession && this.activeSession.state !== DebugSessionState.STOPPED),
      sessionState: this.activeSession ? this.activeSession.state : DebugSessionState.STOPPED,
      activeFrame: this.activeSession?.activeFrame || null,
      stackFrames: this.activeSession?.stackFrames || [],
      scopes: this.activeSession?.scopes || [],
      variables: this.activeSession?.variables || [],
      breakpoints: breakpointManager.getAllBreakpoints(),
    };

    this.listeners.forEach((fn) => {
      try {
        fn(state);
      } catch (err) {
        console.error('[DebuggerManager] Listener error:', err);
      }
    });
  }

  dispose() {
    if (this.gutterListenerDisposed) {
      try {
        this.gutterListenerDisposed.dispose();
      } catch {}
      this.gutterListenerDisposed = null;
    }
    this.clearExecutionLine();
    if (this.activeSession) {
      this.activeSession.stop().catch(() => {});
      this.activeSession = null;
    }
  }
}

export const debuggerManager = new DebuggerManager();
