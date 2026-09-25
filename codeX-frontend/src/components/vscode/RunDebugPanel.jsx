import React, { useState, useEffect } from 'react';
import { Play, Square, RotateCw, ExternalLink, Settings, Plus, Terminal } from 'lucide-react';
import { projectService } from '../../services/native/project';
import { processService } from '../../services/native/process';
import { isDesktopApp } from '../../services/native/platform';

export default function RunDebugPanel({
  projectRoot,
  onOpenBottomTab,
  showToast,
}) {
  const [config, setConfig] = useState({ name: 'Project', run: {} });
  const [runningProcesses, setRunningProcesses] = useState([]);
  const [newRunName, setNewRunName] = useState('');
  const [newRunCmd, setNewRunCmd] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

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

  if (!isDesktop) {
    return (
      <div className="vscode-sidebar">
        <div className="sidebar-header">
          <span className="sidebar-header-title">RUN & DEBUG</span>
        </div>
        <div style={{ padding: '16px', color: '#858585', fontSize: '12px' }}>
          Process execution is supported in the CodeX Desktop application.
        </div>
      </div>
    );
  }

  const handleStart = async (name, command) => {
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

  const handleStop = async (id) => {
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

  const runEntries = Object.entries(config.run || {});

  return (
    <div className="vscode-sidebar">
      <div className="sidebar-header">
        <span className="sidebar-header-title">RUN & DEBUG</span>
        <div className="sidebar-actions">
          <button
            className="sidebar-action-btn"
            title="Add Run Configuration"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            <Plus size={13} />
          </button>
        </div>
      </div>

      <div style={{ padding: '12px', flex: 1, overflowY: 'auto' }}>
        <div style={{ fontSize: '11px', fontWeight: 600, color: '#858585', marginBottom: '8px', textTransform: 'uppercase' }}>
          Configurations
        </div>

        {runEntries.length === 0 ? (
          <div style={{ fontSize: '11.5px', color: '#858585', marginBottom: '12px' }}>
            No run commands configured. Click + to add dev or start scripts.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                    padding: '8px 10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff' }}>{name}</span>
                      {activeProc && (
                        <span
                          style={{
                            fontSize: '9.5px',
                            color: '#4ade80',
                            backgroundColor: 'rgba(74, 222, 128, 0.1)',
                            padding: '1px 5px',
                            borderRadius: '3px',
                          }}
                        >
                          RUNNING
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {activeProc ? (
                        <button
                          type="button"
                          className="node-btn delete-btn"
                          title="Stop"
                          onClick={() => handleStop(activeProc.id)}
                        >
                          <Square size={12} fill="currentColor" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="node-btn"
                          style={{ color: '#4ade80' }}
                          title={`Run ${name}`}
                          onClick={() => handleStart(name, cmd)}
                        >
                          <Play size={13} fill="currentColor" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ fontSize: '10.5px', color: '#888888', fontFamily: 'monospace', marginTop: '4px' }}>
                    $ {cmd}
                  </div>

                  {activeProc?.ports && activeProc.ports.length > 0 && (
                    <div style={{ marginTop: '6px' }}>
                      {activeProc.ports.map((port) => (
                        <a
                          key={port}
                          href={`http://localhost:${port}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '10.5px',
                            color: '#60a5fa',
                            backgroundColor: 'rgba(59, 130, 246, 0.15)',
                            padding: '2px 6px',
                            borderRadius: '3px',
                            textDecoration: 'none',
                          }}
                        >
                          <ExternalLink size={10} />
                          <span>http://localhost:{port}</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {showAddForm && (
          <form
            onSubmit={handleAddRunCommand}
            style={{
              marginTop: '12px',
              backgroundColor: '#1f1f1f',
              border: '1px solid #007acc',
              borderRadius: '4px',
              padding: '10px',
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#ffffff', marginBottom: '6px' }}>
              Add Configuration
            </div>
            <input
              type="text"
              placeholder="Name (e.g. dev, test)"
              value={newRunName}
              onChange={(e) => setNewRunName(e.target.value)}
              className="inline-create-input"
              style={{ width: '100%', marginBottom: '6px', boxSizing: 'border-box' }}
            />
            <input
              type="text"
              placeholder="Command (e.g. npm run dev)"
              value={newRunCmd}
              onChange={(e) => setNewRunCmd(e.target.value)}
              className="inline-create-input"
              style={{ width: '100%', marginBottom: '8px', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="panel-action-btn"
                onClick={() => setShowAddForm(false)}
                style={{ fontSize: '11px', padding: '3px 8px' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-create-initial-terminal"
                style={{ padding: '3px 10px', fontSize: '11px' }}
              >
                Save
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
