import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  Square,
  RotateCw,
  ArrowRight,
  ArrowDown,
  ArrowUp,
  ExternalLink,
  Plus,
  Trash2,
  ChevronRight,
  ChevronDown,
  Bug,
  Circle,
  CheckCircle2,
} from 'lucide-react';
import { projectService } from '../../services/native/project';
import { processService } from '../../services/native/process';
import { isDesktopApp } from '../../services/native/platform';
import { debuggerManager } from '../../debugger/debuggerManager.js';
import { breakpointManager } from '../../debugger/breakpointManager.js';
import { DebugSessionState } from '../../debugger/debugTypes.js';
import { buildManager, runManager } from '../../build';

// Recursive Variable Tree Node for nested object inspection
function VariableItem({ variable, session, depth = 0 }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [children, setChildren] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const hasChildren = variable.variablesReference > 0;

  const toggleExpand = async () => {
    if (!hasChildren) return;
    if (!isExpanded && children.length === 0 && session) {
      setIsLoading(true);
      try {
        const childVars = await session.getChildVariables(variable.variablesReference);
        setChildren(childVars);
      } catch {}
      setIsLoading(false);
    }
    setIsExpanded(!isExpanded);
  };

  const getValueClass = () => {
    if (variable.type === 'number') return 'number';
    if (variable.type === 'boolean') return 'boolean';
    if (variable.type === 'object') return 'object';
    return '';
  };

  return (
    <div style={{ marginLeft: `${depth * 12}px` }}>
      <div
        className="codex-var-row"
        onClick={toggleExpand}
        style={{ cursor: hasChildren ? 'pointer' : 'default' }}
      >
        {hasChildren ? (
          <span style={{ marginRight: '4px', color: '#858585', display: 'inline-flex' }}>
            {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          </span>
        ) : (
          <span style={{ width: '15px', display: 'inline-block' }} />
        )}
        <span className="codex-var-key">{variable.name}:</span>
        <span className={`codex-var-val ${getValueClass()}`}>
          {variable.value}
        </span>
      </div>

      {isExpanded && (
        <div>
          {isLoading ? (
            <div style={{ paddingLeft: '16px', fontSize: '10.5px', color: '#858585' }}>
              Loading...
            </div>
          ) : (
            children.map((child, idx) => (
              <VariableItem
                key={`${child.name}-${idx}`}
                variable={child}
                session={session}
                depth={depth + 1}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function RunDebugPanel({
  projectRoot,
  activeFile,
  fileTree = [],
  onNavigateToFile,
  onOpenBottomTab,
  showToast,
}) {
  const [config, setConfig] = useState({ name: 'Project', run: {} });
  const [runningProcesses, setRunningProcesses] = useState([]);
  const [newRunName, setNewRunName] = useState('');
  const [newRunCmd, setNewRunCmd] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // Debugger state
  const [debugState, setDebugState] = useState({
    isDebugging: false,
    sessionState: DebugSessionState.STOPPED,
    activeFrame: null,
    stackFrames: [],
    scopes: [],
    variables: [],
    breakpoints: [],
  });

  const [expandedSections, setExpandedSections] = useState({
    variables: true,
    callStack: true,
    breakpoints: true,
    runConfigs: true,
  });

  const isDesktop = isDesktopApp();

  const loadData = async () => {
    if (!isDesktop || !projectRoot) return;
    try {
      const projConfig = await projectService.loadConfig(projectRoot);
      setConfig(projConfig);
      const procs = await processService.listProcesses();
      setRunningProcesses(procs);
    } catch {}
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, [projectRoot]);

  // Listen to debuggerManager updates
  useEffect(() => {
    const unsub = debuggerManager.onStateChange((state) => {
      setDebugState(state);
    });
    // Initial state
    setDebugState({
      isDebugging: Boolean(debuggerManager.activeSession && debuggerManager.activeSession.state !== DebugSessionState.STOPPED),
      sessionState: debuggerManager.activeSession ? debuggerManager.activeSession.state : DebugSessionState.STOPPED,
      activeFrame: debuggerManager.activeSession?.activeFrame || null,
      stackFrames: debuggerManager.activeSession?.stackFrames || [],
      scopes: debuggerManager.activeSession?.scopes || [],
      variables: debuggerManager.activeSession?.variables || [],
      breakpoints: breakpointManager.getAllBreakpoints(),
    });
    return unsub;
  }, []);

  if (!isDesktop) {
    return (
      <div className="vscode-sidebar">
        <div className="sidebar-header">
          <span className="sidebar-header-title">RUN & DEBUG</span>
        </div>
        <div style={{ padding: '16px', color: '#858585', fontSize: '12px' }}>
          Debugging and process execution operate in the CodeX Desktop application.
        </div>
      </div>
    );
  }

  const toggleSection = (sec) => {
    setExpandedSections((prev) => ({ ...prev, [sec]: !prev[sec] }));
  };

  // Debugger Start Action
  const handleStartDebugging = async () => {
    if (!activeFile) {
      showToast?.('Please open a file to debug');
      return;
    }

    try {
      showToast?.(`Starting debug session for ${activeFile.name}...`);
      await debuggerManager.startDebugging({}, activeFile);
      if (onOpenBottomTab) {
        onOpenBottomTab('debug');
      }
    } catch (err) {
      showToast?.(`Failed to start debugger: ${err.message || err}`);
    }
  };

  const handleStartBuild = async () => {
    try {
      showToast?.('Starting project build task...');
      await buildManager.startBuild({
        workspaceRoot: projectRoot,
        fileTree,
      });
      if (onOpenBottomTab) onOpenBottomTab('output');
    } catch (err) {
      showToast?.(`Build error: ${err.message || err}`);
    }
  };

  const handleStartRun = async () => {
    try {
      showToast?.('Running project without debugging...');
      await runManager.startRun({
        workspaceRoot: projectRoot,
        fileTree,
      });
      if (onOpenBottomTab) onOpenBottomTab('output');
    } catch (err) {
      showToast?.(`Run error: ${err.message || err}`);
    }
  };

  const handleJumpToBreakpoint = (bp) => {
    if (!onNavigateToFile || !fileTree.length) return;
    const norm = bp.fileUri.replace(/\\/g, '/');
    const target = fileTree.find(
      (f) =>
        f.type === 'file' &&
        (f.path?.replace(/\\/g, '/') === norm ||
          norm.endsWith('/' + f.name) ||
          norm.endsWith('\\' + f.name))
    );
    if (target) {
      onNavigateToFile(target, { lineNumber: bp.line, column: bp.column || 1 });
    }
  };

  const handleJumpToFrame = (frame) => {
    if (!onNavigateToFile || !fileTree.length || !frame?.source?.path) return;
    const norm = frame.source.path.replace(/\\/g, '/');
    const target = fileTree.find(
      (f) =>
        f.type === 'file' &&
        (f.path?.replace(/\\/g, '/') === norm ||
          norm.endsWith('/' + f.name) ||
          norm.endsWith('\\' + f.name))
    );
    if (target) {
      onNavigateToFile(target, { lineNumber: frame.line, column: frame.column || 1 });
    }
  };

  const handleStartProcess = async (name, command) => {
    try {
      const id = `proc-${name.toLowerCase().replace(/\s+/g, '-')}`;
      await processService.startProcess({
        id,
        name,
        command,
        cwd: projectRoot,
      });

      if (onOpenBottomTab) {
        onOpenBottomTab('debug');
      }
      showToast(`Started process "${name}"`);
      loadData();
    } catch (err) {
      showToast(`Failed to run: ${err.message || err}`);
    }
  };

  const handleStopProcess = async (id) => {
    try {
      await processService.stopProcess(id);
      showToast('Stopped process');
      loadData();
    } catch (err) {
      showToast(`Failed to stop: ${err.message || err}`);
    }
  };

  const handleAddRunCommand = async (e) => {
    e.preventDefault();
    if (!newRunName.trim() || !newRunCmd.trim()) return;

    const updatedRun = {
      ...config.run,
      [newRunName.trim()]: newRunCmd.trim(),
    };

    const newConfig = {
      ...config,
      run: updatedRun,
    };

    setConfig(newConfig);
    await projectService.saveConfig(projectRoot, newConfig);
    setNewRunName('');
    setNewRunCmd('');
    setShowAddForm(false);
    showToast(`Saved run configuration "${newRunName}" to .codex/project.json`);
  };

  const activeSession = debuggerManager.getActiveSession();
  const isPaused = debugState.sessionState === DebugSessionState.PAUSED;
  const runEntries = Object.entries(config.run || {});

  return (
    <div className="vscode-sidebar">
      {/* Header with Title and Debug Play Button */}
      <div className="sidebar-header">
        <span className="sidebar-header-title">RUN & DEBUG</span>
        <div className="sidebar-actions">
          {debugState.isDebugging ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              {isPaused ? (
                <button
                  className="sidebar-action-btn"
                  title="Continue (F5)"
                  onClick={() => debuggerManager.continue()}
                  style={{ color: '#4ade80' }}
                >
                  <Play size={13} fill="currentColor" />
                </button>
              ) : (
                <button
                  className="sidebar-action-btn"
                  title="Pause (F6)"
                  onClick={() => debuggerManager.pause()}
                  style={{ color: '#facc15' }}
                >
                  <Pause size={13} fill="currentColor" />
                </button>
              )}
              <button
                className="sidebar-action-btn"
                title="Step Over (F10)"
                disabled={!isPaused}
                onClick={() => debuggerManager.stepOver()}
              >
                <ArrowRight size={13} />
              </button>
              <button
                className="sidebar-action-btn"
                title="Stop (Shift+F5)"
                onClick={() => debuggerManager.stop()}
                style={{ color: '#ef4444' }}
              >
                <Square size={12} fill="currentColor" />
              </button>
            </div>
          ) : (
            <button
              className="sidebar-action-btn"
              title="Start Debugging (F5)"
              onClick={handleStartDebugging}
              style={{ color: '#4ade80' }}
            >
              <Play size={13} fill="currentColor" />
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: '8px 10px', flex: 1, overflowY: 'auto' }}>
        {/* Debug Target Launch Bar */}
        <div
          style={{
            backgroundColor: '#252526',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '4px',
            padding: '8px 10px',
            marginBottom: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <Bug size={14} color="#007acc" />
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#ffffff' }}>
                {activeFile ? `Debug ${activeFile.name}` : 'Node.js Debugger'}
              </div>
              <div style={{ fontSize: '10px', color: '#858585' }}>
                {debugState.isDebugging
                  ? (isPaused ? `Paused (line ${debugState.activeFrame?.line || ''})` : 'Session Running')
                  : 'Ready (F5)'}
              </div>
            </div>
          </div>

          {debugState.isDebugging ? (
            <button
              className="sidebar-action-btn"
              title="Stop Debugging"
              onClick={() => debuggerManager.stop()}
              style={{ color: '#ef4444' }}
            >
              <Square size={12} fill="currentColor" />
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                className="node-btn"
                style={{ color: '#38bdf8', padding: '3px 6px' }}
                title="Run Without Debugging (⌃F5 / Ctrl+F5)"
                onClick={handleStartRun}
              >
                <Play size={13} />
              </button>
              <button
                className="node-btn"
                style={{ color: '#f59e0b', padding: '3px 6px' }}
                title="Build Project (⇧⌘B / Ctrl+Shift+B)"
                onClick={handleStartBuild}
              >
                <RotateCw size={13} />
              </button>
              <button
                className="node-btn"
                style={{ color: '#4ade80', padding: '3px 6px' }}
                title="Start Debugging (F5)"
                onClick={handleStartDebugging}
              >
                <Play size={13} fill="currentColor" />
              </button>
            </div>
          )}
        </div>

        {/* 1. VARIABLES ACCORDION (Requirement 9) */}
        <div style={{ marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px' }}>
          <div
            onClick={() => toggleSection('variables')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 600,
              color: '#cccccc',
              textTransform: 'uppercase',
              padding: '4px 0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {expandedSections.variables ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <span>Variables</span>
            </div>
          </div>

          {expandedSections.variables && (
            <div style={{ marginTop: '4px' }}>
              {!debugState.isDebugging ? (
                <div style={{ fontSize: '11px', color: '#858585', padding: '4px 8px' }}>
                  Not debugging.
                </div>
              ) : !isPaused ? (
                <div style={{ fontSize: '11px', color: '#858585', padding: '4px 8px' }}>
                  Execution is running...
                </div>
              ) : debugState.variables.length === 0 ? (
                <div style={{ fontSize: '11px', color: '#858585', padding: '4px 8px' }}>
                  No variables in scope.
                </div>
              ) : (
                debugState.variables.map((scopeGroup, sIdx) => (
                  <div key={`${scopeGroup.scopeName}-${sIdx}`} style={{ marginBottom: '6px' }}>
                    <div
                      style={{
                        fontSize: '10.5px',
                        fontWeight: 600,
                        color: '#007acc',
                        padding: '2px 6px',
                        backgroundColor: 'rgba(0, 122, 204, 0.08)',
                        borderRadius: '3px',
                        marginBottom: '2px',
                      }}
                    >
                      {scopeGroup.scopeName}
                    </div>
                    {scopeGroup.variables.map((v, vIdx) => (
                      <VariableItem
                        key={`${v.name}-${vIdx}`}
                        variable={v}
                        session={activeSession}
                        depth={0}
                      />
                    ))}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* 2. CALL STACK ACCORDION */}
        <div style={{ marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px' }}>
          <div
            onClick={() => toggleSection('callStack')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 600,
              color: '#cccccc',
              textTransform: 'uppercase',
              padding: '4px 0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {expandedSections.callStack ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <span>Call Stack</span>
            </div>
          </div>

          {expandedSections.callStack && (
            <div style={{ marginTop: '4px' }}>
              {!debugState.isDebugging || !isPaused ? (
                <div style={{ fontSize: '11px', color: '#858585', padding: '4px 8px' }}>
                  Not paused.
                </div>
              ) : debugState.stackFrames.length === 0 ? (
                <div style={{ fontSize: '11px', color: '#858585', padding: '4px 8px' }}>
                  No stack frames.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {debugState.stackFrames.map((frame, fIdx) => (
                    <div
                      key={`${frame.name}-${fIdx}`}
                      onClick={() => handleJumpToFrame(frame)}
                      style={{
                        padding: '3px 6px',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontFamily: 'monospace',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: fIdx === 0 ? 'rgba(234, 179, 8, 0.12)' : 'transparent',
                        color: fIdx === 0 ? '#facc15' : '#cccccc',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = fIdx === 0 ? 'rgba(234, 179, 8, 0.12)' : 'transparent')}
                    >
                      <span style={{ fontWeight: 500 }}>{frame.name}</span>
                      <span style={{ color: '#858585', fontSize: '10px' }}>
                        {frame.source?.name}:{frame.line}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 3. BREAKPOINTS ACCORDION (Requirement 5) */}
        <div style={{ marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '11px',
              fontWeight: 600,
              color: '#cccccc',
              textTransform: 'uppercase',
              padding: '4px 0',
            }}
          >
            <div
              onClick={() => toggleSection('breakpoints')}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
            >
              {expandedSections.breakpoints ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <span>Breakpoints ({debugState.breakpoints.length})</span>
            </div>

            {debugState.breakpoints.length > 0 && (
              <button
                className="sidebar-action-btn"
                title="Remove All Breakpoints"
                onClick={() => breakpointManager.removeAllBreakpoints()}
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>

          {expandedSections.breakpoints && (
            <div style={{ marginTop: '4px' }}>
              {debugState.breakpoints.length === 0 ? (
                <div style={{ fontSize: '11px', color: '#858585', padding: '4px 8px' }}>
                  No breakpoints. Click the editor gutter to toggle.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {debugState.breakpoints.map((bp) => {
                    const fileName = bp.fileUri.split('/').pop();
                    return (
                      <div
                        key={`${bp.fileUri}-${bp.line}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '3px 6px',
                          borderRadius: '3px',
                          fontSize: '11.5px',
                        }}
                      >
                        <div
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', flex: 1, minWidth: 0 }}
                          onClick={() => handleJumpToBreakpoint(bp)}
                        >
                          <input
                            type="checkbox"
                            checked={bp.enabled}
                            onChange={(e) => {
                              e.stopPropagation();
                              breakpointManager.toggleBreakpointEnabled(bp.fileUri, bp.line);
                            }}
                            style={{ cursor: 'pointer' }}
                          />
                          <span
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: bp.enabled ? '#e51400' : '#858585',
                              display: 'inline-block',
                              flexShrink: 0,
                            }}
                          />
                          <span
                            style={{
                              color: bp.enabled ? '#ffffff' : '#858585',
                              fontFamily: 'monospace',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {fileName}:{bp.line}
                          </span>
                        </div>

                        <button
                          className="sidebar-action-btn"
                          title="Remove Breakpoint"
                          onClick={() => breakpointManager.removeBreakpoint(bp.fileUri, bp.line)}
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 4. RUN CONFIGURATIONS / PROCESSES (Preserved Existing System) */}
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '11px',
              fontWeight: 600,
              color: '#cccccc',
              textTransform: 'uppercase',
              padding: '4px 0',
            }}
          >
            <div
              onClick={() => toggleSection('runConfigs')}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
            >
              {expandedSections.runConfigs ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <span>Configurations</span>
            </div>
            <button
              className="sidebar-action-btn"
              title="Add Run Command"
              onClick={() => setShowAddForm(!showAddForm)}
            >
              <Plus size={13} />
            </button>
          </div>

          {expandedSections.runConfigs && (
            <div style={{ marginTop: '4px' }}>
              {runEntries.length === 0 ? (
                <div style={{ fontSize: '11px', color: '#858585', padding: '4px 8px' }}>
                  No run commands configured.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {runEntries.map(([name, cmd]) => {
                    const activeProc = runningProcesses.find(
                      (p) => p.name === name && p.status === 'running'
                    );

                    return (
                      <div
                        key={name}
                        style={{
                          backgroundColor: '#1e1e1e',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: '4px',
                          padding: '6px 8px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#ffffff' }}>{name}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {activeProc ? (
                              <button
                                type="button"
                                className="node-btn delete-btn"
                                title="Stop"
                                onClick={() => handleStopProcess(activeProc.id)}
                              >
                                <Square size={12} fill="currentColor" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="node-btn"
                                style={{ color: '#4ade80' }}
                                title={`Run ${name}`}
                                onClick={() => handleStartProcess(name, cmd)}
                              >
                                <Play size={12} fill="currentColor" />
                              </button>
                            )}
                          </div>
                        </div>

                        <div style={{ fontSize: '10px', color: '#888888', fontFamily: 'monospace', marginTop: '3px' }}>
                          $ {cmd}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {showAddForm && (
                <form
                  onSubmit={handleAddRunCommand}
                  style={{
                    marginTop: '8px',
                    backgroundColor: '#1f1f1f',
                    border: '1px solid #007acc',
                    borderRadius: '4px',
                    padding: '8px',
                  }}
                >
                  <input
                    type="text"
                    placeholder="Name (e.g. dev, test)"
                    value={newRunName}
                    onChange={(e) => setNewRunName(e.target.value)}
                    className="inline-create-input"
                    style={{ width: '100%', marginBottom: '4px', boxSizing: 'border-box' }}
                  />
                  <input
                    type="text"
                    placeholder="Command (e.g. npm run dev)"
                    value={newRunCmd}
                    onChange={(e) => setNewRunCmd(e.target.value)}
                    className="inline-create-input"
                    style={{ width: '100%', marginBottom: '6px', boxSizing: 'border-box' }}
                  />
                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="panel-action-btn"
                      onClick={() => setShowAddForm(false)}
                      style={{ fontSize: '11px', padding: '2px 6px' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn-create-initial-terminal"
                      style={{ padding: '2px 8px', fontSize: '11px' }}
                    >
                      Save
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
