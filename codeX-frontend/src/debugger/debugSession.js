/**
 * CodeX Debug Session
 * Level 3B — Debug Session Lifecycle & DAP Coordination
 *
 * Implements:
 * - Session lifecycle: start, initialize, launch, running, paused, restart, stop, cleanup
 * - Execution controls: continue, pause, stepOver, stepInto, stepOut
 * - Stack trace & Scope / Variable evaluation on pause
 * - Breakpoint synchronization with active debug adapter
 */

import { DebugTransport } from './debugTransport.js';
import { DebugSessionState, SteppingType } from './debugTypes.js';
import { breakpointManager } from './breakpointManager.js';

export class DebugSession {
  constructor(sessionId) {
    this.id = sessionId || `session-${Date.now()}`;
    this.transport = new DebugTransport(this.id);
    this.state = DebugSessionState.STOPPED;
    this.launchConfig = null;
    this.activeThreadId = 1;
    this.stackFrames = [];
    this.activeFrame = null;
    this.scopes = [];
    this.variables = []; // Array of { scopeName, variables: [...] }
    this.outputLogs = [];
    this.listeners = new Set();
  }

  setState(newState) {
    if (this.state !== newState) {
      this.state = newState;
      this.notifyChange('state', { state: this.state });
    }
  }

  /**
   * Starts debug adapter process and initiates DAP handshake.
   */
  async start(resolvedConfig, workspaceRoot = '') {
    this.launchConfig = resolvedConfig;
    this.setState(DebugSessionState.STARTING);

    try {
      // 1. Start transport with adapter executable
      await this.transport.start({
        executable: resolvedConfig.adapterExecutable,
        args: resolvedConfig.adapterArgs,
        cwd: resolvedConfig.dapLaunchArgs?.cwd || workspaceRoot,
        env: resolvedConfig.dapLaunchArgs?.env || null,
      });

      // 2. Wire DAP event listeners
      this.transport.onEvent('stopped', (body) => this.handleStopped(body));
      this.transport.onEvent('continued', (body) => this.handleContinued(body));
      this.transport.onEvent('output', (body) => this.handleOutput(body));
      this.transport.onEvent('terminated', (body) => this.handleTerminated(body));

      // 3. DAP Handshake: initialize
      await this.transport.sendRequest('initialize', {
        clientID: 'codex-desktop',
        clientName: 'CodeX',
        adapterID: resolvedConfig.type,
        linesStartAt1: true,
        columnsStartAt1: true,
        pathFormat: 'path',
      });

      // 4. Synchronize all current breakpoints before configurationDone
      await this.syncAllBreakpoints();

      // 5. DAP Launch
      await this.transport.sendRequest('launch', resolvedConfig.dapLaunchArgs);

      // 6. DAP ConfigurationDone
      await this.transport.sendRequest('configurationDone').catch(() => {});

      this.setState(DebugSessionState.RUNNING);
    } catch (err) {
      this.setState(DebugSessionState.STOPPED);
      this.handleOutput({ category: 'stderr', output: `Debugger error: ${err.message || err}\n` });
      throw err;
    }
  }

  /**
   * Synchronizes breakpoints across all files with active adapter.
   */
  async syncAllBreakpoints() {
    const allBps = breakpointManager.getAllBreakpoints();
    const fileMap = new Map();

    allBps.forEach((bp) => {
      if (!fileMap.has(bp.fileUri)) {
        fileMap.set(bp.fileUri, []);
      }
      if (bp.enabled) {
        fileMap.get(bp.fileUri).push(bp);
      }
    });

    for (const [fileUri, bps] of fileMap.entries()) {
      await this.syncBreakpointsForFile(fileUri, bps);
    }
  }

  /**
   * Synchronizes breakpoints for a specific file.
   */
  async syncBreakpointsForFile(fileUri, bps) {
    if (!this.transport.isConnected) return;

    try {
      const filePath = fileUri.replace(/^file:\/\//, '');
      const response = await this.transport.sendRequest('setBreakpoints', {
        source: { path: filePath },
        breakpoints: bps.map((b) => ({ line: b.line, column: b.column || 1 })),
      });

      const verifiedList = response.breakpoints || [];
      verifiedList.forEach((v, idx) => {
        if (bps[idx]) {
          breakpointManager.updateVerification(fileUri, bps[idx].line, v.verified, v.line);
        }
      });
    } catch (err) {
      console.warn('[DebugSession] Failed to sync breakpoints for:', fileUri, err);
    }
  }

  /**
   * Handler when execution pauses (breakpoint hit, step, or pause).
   */
  async handleStopped(body) {
    this.setState(DebugSessionState.PAUSED);
    this.activeThreadId = body.threadId || 1;

    try {
      // 1. Fetch Call Stack
      const stackRes = await this.transport.sendRequest('stackTrace', {
        threadId: this.activeThreadId,
      });

      this.stackFrames = stackRes.stackFrames || [];
      this.activeFrame = this.stackFrames[0] || null;

      // 2. Fetch Scopes & Variables for the top frame
      if (this.activeFrame) {
        const scopesRes = await this.transport.sendRequest('scopes', {
          frameId: this.activeFrame.id,
        });

        this.scopes = scopesRes.scopes || [];
        this.variables = [];

        for (const scope of this.scopes) {
          if (!scope.expensive && scope.variablesReference > 0) {
            try {
              const varsRes = await this.transport.sendRequest('variables', {
                variablesReference: scope.variablesReference,
              });
              this.variables.push({
                scopeName: scope.name,
                variablesReference: scope.variablesReference,
                variables: varsRes.variables || [],
              });
            } catch {}
          }
        }
      }

      this.notifyChange('stopped', {
        reason: body.reason,
        threadId: this.activeThreadId,
        frame: this.activeFrame,
        stackFrames: this.stackFrames,
        scopes: this.scopes,
        variables: this.variables,
      });
    } catch (err) {
      console.warn('[DebugSession] Error updating stopped state:', err);
    }
  }

  handleContinued() {
    this.setState(DebugSessionState.RUNNING);
    this.activeFrame = null;
    this.stackFrames = [];
    this.variables = [];
    this.notifyChange('continued', {});
  }

  handleOutput(body) {
    const entry = {
      id: `out-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      category: body.category || 'console',
      text: body.output || '',
      timestamp: Date.now(),
    };
    this.outputLogs.push(entry);
    this.notifyChange('output', entry);
  }

  handleTerminated() {
    this.setState(DebugSessionState.STOPPED);
    this.activeFrame = null;
    this.stackFrames = [];
    this.variables = [];
    this.notifyChange('terminated', {});
  }

  // --- Debugger Stepping Controls ---

  async continue() {
    if (this.state !== DebugSessionState.PAUSED) return;
    try {
      await this.transport.sendRequest(SteppingType.CONTINUE, {
        threadId: this.activeThreadId,
      });
      this.handleContinued();
    } catch (err) {
      console.warn('[DebugSession] Continue failed:', err);
    }
  }

  async pause() {
    if (this.state !== DebugSessionState.RUNNING) return;
    try {
      await this.transport.sendRequest(SteppingType.PAUSE, {
        threadId: this.activeThreadId,
      });
    } catch (err) {
      console.warn('[DebugSession] Pause failed:', err);
    }
  }

  async stepOver() {
    if (this.state !== DebugSessionState.PAUSED) return;
    try {
      await this.transport.sendRequest(SteppingType.STEP_OVER, {
        threadId: this.activeThreadId,
      });
      this.setState(DebugSessionState.RUNNING);
    } catch (err) {
      console.warn('[DebugSession] StepOver failed:', err);
    }
  }

  async stepInto() {
    if (this.state !== DebugSessionState.PAUSED) return;
    try {
      await this.transport.sendRequest(SteppingType.STEP_INTO, {
        threadId: this.activeThreadId,
      });
      this.setState(DebugSessionState.RUNNING);
    } catch (err) {
      console.warn('[DebugSession] StepInto failed:', err);
    }
  }

  async stepOut() {
    if (this.state !== DebugSessionState.PAUSED) return;
    try {
      await this.transport.sendRequest(SteppingType.STEP_OUT, {
        threadId: this.activeThreadId,
      });
      this.setState(DebugSessionState.RUNNING);
    } catch (err) {
      console.warn('[DebugSession] StepOut failed:', err);
    }
  }

  async restart() {
    try {
      await this.transport.sendRequest('restart', {}).catch(() => {});
      if (this.launchConfig) {
        await this.stop();
        await this.start(this.launchConfig);
      }
    } catch (err) {
      console.warn('[DebugSession] Restart failed:', err);
    }
  }

  async stop() {
    this.setState(DebugSessionState.STOPPING);
    try {
      await this.transport.sendRequest('disconnect', { terminateDebuggee: true }).catch(() => {});
    } catch {}
    await this.transport.close();
    this.setState(DebugSessionState.STOPPED);
    this.handleTerminated();
  }

  /**
   * Fetches nested child variables for an expandable object.
   */
  async getChildVariables(variablesReference) {
    if (!this.transport.isConnected || !variablesReference) return [];
    try {
      const res = await this.transport.sendRequest('variables', { variablesReference });
      return res.variables || [];
    } catch {
      return [];
    }
  }

  /**
   * Evaluates an expression in the current call frame.
   */
  async evaluate(expression) {
    if (!this.transport.isConnected) return null;
    try {
      return await this.transport.sendRequest('evaluate', {
        expression,
        frameId: this.activeFrame?.id,
        context: 'repl',
      });
    } catch (err) {
      return { result: err.message, isError: true };
    }
  }

  onEvent(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notifyChange(type, data) {
    this.listeners.forEach((fn) => {
      try {
        fn(type, data);
      } catch (err) {
        console.error('[DebugSession] Listener error:', err);
      }
    });
  }
}
