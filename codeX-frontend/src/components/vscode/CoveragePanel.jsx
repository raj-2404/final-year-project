import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Play,
  Square,
  RotateCw,
  Trash2,
  FileCode,
  ArrowDown,
  ArrowUp,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Search,
} from 'lucide-react';
import { isDesktopApp } from '../../services/native/platform.js';
import { coverageManager } from '../../coverage/coverageManager.js';
import { coverageStore } from '../../coverage/coverageStore.js';
import { CoverageStatus } from '../../coverage/coverageTypes.js';

export default function CoveragePanel({
  workspaceRoot,
  fileTree = [],
  activeFile,
  onOpenFile,
  editor,
  showToast,
}) {
  const [version, setVersion] = useState(0);
  const [filterText, setFilterText] = useState('');
  const [isRunning, setIsRunning] = useState(false);

  const isDesktop = isDesktopApp();
  const summary = coverageManager.getSummary(workspaceRoot);
  const projectCoverage = coverageStore.getCoverage(workspaceRoot);

  useEffect(() => {
    const unsubStore = coverageStore.subscribe(() => {
      setVersion((v) => v + 1);
    });

    const unsubManager = coverageManager.onEvent((event) => {
      if (event.type === 'coverage-started') {
        setIsRunning(true);
      } else if (event.type === 'coverage-completed' || event.type === 'coverage-failed' || event.type === 'coverage-stopped') {
        setIsRunning(false);
      }
      setVersion((v) => v + 1);
    });

    return () => {
      unsubStore();
      unsubManager();
    };
  }, [workspaceRoot]);

  const handleRunCoverage = async () => {
    if (!isDesktop) {
      if (showToast) {
        showToast('Local coverage requires CodeX Desktop mode.', 'warning');
      }
      return;
    }

    try {
      setIsRunning(true);
      const res = await coverageManager.runCoverage({
        workspaceRoot,
        fileTree,
      });

      if (!res.success) {
        if (showToast) {
          showToast(`Coverage failed: ${res.error}`, 'error');
        }
      } else if (showToast) {
        showToast(`Coverage completed (${res.projectCoverage.lines.pct}% lines)`, 'info');
      }
    } catch (err) {
      if (showToast) {
        showToast(`Coverage error: ${err.message || err}`, 'error');
      }
    } finally {
      setIsRunning(false);
    }
  };

  const handleStopCoverage = () => {
    coverageManager.stopCoverage();
    setIsRunning(false);
  };

  const handleClearCoverage = () => {
    coverageManager.clearCoverage(workspaceRoot);
    if (showToast) {
      showToast('Coverage data cleared.', 'info');
    }
  };

  const handleNextUncovered = () => {
    if (!editor || !activeFile) {
      if (showToast) showToast('Open a file in editor to navigate uncovered lines.', 'info');
      return;
    }
    const line = coverageManager.navigateNextUncovered(editor, activeFile, workspaceRoot);
    if (line && showToast) {
      showToast(`Jumped to line ${line}`, 'info');
    }
  };

  const handlePrevUncovered = () => {
    if (!editor || !activeFile) {
      if (showToast) showToast('Open a file in editor to navigate uncovered lines.', 'info');
      return;
    }
    const line = coverageManager.navigatePreviousUncovered(editor, activeFile, workspaceRoot);
    if (line && showToast) {
      showToast(`Jumped to line ${line}`, 'info');
    }
  };

  const filesList = projectCoverage ? Object.values(projectCoverage.files) : [];
  const filteredFiles = filesList.filter((f) =>
    f.file.toLowerCase().includes(filterText.toLowerCase())
  );

  const getPctColorClass = (pct) => {
    if (pct >= 80) return 'coverage-high';
    if (pct >= 50) return 'coverage-medium';
    return 'coverage-low';
  };

  const getPctBgClass = (pct) => {
    if (pct >= 80) return 'coverage-high-bg';
    if (pct >= 50) return 'coverage-medium-bg';
    return 'coverage-low-bg';
  };

  return (
    <div className="codex-coverage-panel">
      {/* Header with Title and Actions */}
      <div className="codex-coverage-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
          <ShieldCheck size={16} className="text-[#3b82f6]" />
          <span>CODE COVERAGE</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {isRunning ? (
            <button
              onClick={handleStopCoverage}
              className="p-1 rounded hover:bg-white/10 text-red-400"
              title="Stop Coverage Process"
            >
              <Square size={14} />
            </button>
          ) : (
            <button
              onClick={handleRunCoverage}
              className="p-1 rounded hover:bg-white/10 text-[#4ade80]"
              title="Run Tests with Coverage"
            >
              <Play size={14} />
            </button>
          )}
          <button
            onClick={handleClearCoverage}
            className="p-1 rounded hover:bg-white/10 text-[#888888] hover:text-white"
            title="Clear Coverage Results"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Summary Metrics Cards */}
      {summary.hasCoverage ? (
        <>
          <div className="codex-coverage-summary-cards">
            {/* Lines */}
            <div className="codex-coverage-card">
              <div className="codex-coverage-card-label">Lines</div>
              <div className="codex-coverage-card-val">
                <span className={getPctColorClass(summary.lines.pct)}>
                  {summary.lines.pct}%
                </span>
                <span style={{ fontSize: 11, color: '#888', fontWeight: 400 }}>
                  {summary.lines.covered}/{summary.lines.total}
                </span>
              </div>
              <div className="codex-coverage-progress-bar">
                <div
                  className={`codex-coverage-progress-fill ${getPctBgClass(summary.lines.pct)}`}
                  style={{ width: `${Math.min(100, summary.lines.pct)}%` }}
                />
              </div>
            </div>

            {/* Statements */}
            <div className="codex-coverage-card">
              <div className="codex-coverage-card-label">Statements</div>
              <div className="codex-coverage-card-val">
                <span className={getPctColorClass(summary.statements.pct)}>
                  {summary.statements.pct}%
                </span>
                <span style={{ fontSize: 11, color: '#888', fontWeight: 400 }}>
                  {summary.statements.covered}/{summary.statements.total}
                </span>
              </div>
              <div className="codex-coverage-progress-bar">
                <div
                  className={`codex-coverage-progress-fill ${getPctBgClass(summary.statements.pct)}`}
                  style={{ width: `${Math.min(100, summary.statements.pct)}%` }}
                />
              </div>
            </div>

            {/* Functions */}
            <div className="codex-coverage-card">
              <div className="codex-coverage-card-label">Functions</div>
              <div className="codex-coverage-card-val">
                <span className={getPctColorClass(summary.functions.pct)}>
                  {summary.functions.pct}%
                </span>
                <span style={{ fontSize: 11, color: '#888', fontWeight: 400 }}>
                  {summary.functions.covered}/{summary.functions.total}
                </span>
              </div>
              <div className="codex-coverage-progress-bar">
                <div
                  className={`codex-coverage-progress-fill ${getPctBgClass(summary.functions.pct)}`}
                  style={{ width: `${Math.min(100, summary.functions.pct)}%` }}
                />
              </div>
            </div>

            {/* Branches */}
            <div className="codex-coverage-card">
              <div className="codex-coverage-card-label">Branches</div>
              <div className="codex-coverage-card-val">
                <span className={getPctColorClass(summary.branches.pct)}>
                  {summary.branches.pct}%
                </span>
                <span style={{ fontSize: 11, color: '#888', fontWeight: 400 }}>
                  {summary.branches.covered}/{summary.branches.total}
                </span>
              </div>
              <div className="codex-coverage-progress-bar">
                <div
                  className={`codex-coverage-progress-fill ${getPctBgClass(summary.branches.pct)}`}
                  style={{ width: `${Math.min(100, summary.branches.pct)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Navigation & Threshold Bar */}
          <div
            style={{
              padding: '6px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(0,0,0,0.18)',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
              {summary.passedThresholds ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#2ea043' }}>
                  <CheckCircle2 size={13} /> Thresholds Passed
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#f85149' }}>
                  <AlertCircle size={13} /> Thresholds Not Met
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                onClick={handlePrevUncovered}
                className="p-1 rounded hover:bg-white/10 text-gray-300 hover:text-white"
                title="Previous Uncovered Line (Active File)"
              >
                <ArrowUp size={13} />
              </button>
              <button
                onClick={handleNextUncovered}
                className="p-1 rounded hover:bg-white/10 text-gray-300 hover:text-white"
                title="Next Uncovered Line (Active File)"
              >
                <ArrowDown size={13} />
              </button>
            </div>
          </div>
        </>
      ) : (
        <div style={{ padding: '24px 16px', textAlign: 'center', color: '#888888' }}>
          <ShieldCheck size={32} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
          <div style={{ fontSize: 13, fontWeight: 500, color: '#cccccc', marginBottom: 4 }}>
            No Coverage Data
          </div>
          <p style={{ fontSize: 11.5, lineHeight: 1.5, marginBottom: 12 }}>
            Run your test suite with coverage enabled to view line, branch, and statement intelligence.
          </p>
          <button
            onClick={handleRunCoverage}
            disabled={isRunning}
            style={{
              background: '#0e639c',
              color: '#ffffff',
              border: 'none',
              borderRadius: 3,
              padding: '6px 14px',
              fontSize: 12,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Play size={13} /> Run With Coverage
          </button>
        </div>
      )}

      {/* Filter input */}
      {summary.hasCoverage && (
        <div style={{ padding: '6px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'rgba(255,255,255,0.05)',
              padding: '3px 8px',
              borderRadius: 3,
            }}
          >
            <Search size={13} style={{ color: '#888', marginRight: 6 }} />
            <input
              type="text"
              placeholder="Filter files..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#fff',
                fontSize: 11.5,
                width: '100%',
              }}
            />
          </div>
        </div>
      )}

      {/* Files List */}
      {summary.hasCoverage && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
          {filteredFiles.map((file) => {
            const pct = file.lines.pct;
            const attnCount = file.getAttentionLines().length;

            return (
              <div
                key={file.file}
                className="codex-coverage-file-row"
                onClick={() => onOpenFile && onOpenFile(file.fullPath || file.file)}
                title={`${file.file} (${pct}% lines, ${attnCount} line(s) needing attention)`}
              >
                <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, gap: 6 }}>
                  <FileCode size={13} style={{ color: '#888', flexShrink: 0 }} />
                  <span className="codex-coverage-file-name">
                    {file.file.split('/').pop()}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {attnCount > 0 && (
                    <span
                      style={{
                        fontSize: 10,
                        background: 'rgba(248,81,73,0.15)',
                        color: '#f85149',
                        padding: '1px 5px',
                        borderRadius: 3,
                      }}
                    >
                      {attnCount}
                    </span>
                  )}
                  <span className={`codex-coverage-file-pct ${getPctColorClass(pct)}`}>
                    {pct}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
