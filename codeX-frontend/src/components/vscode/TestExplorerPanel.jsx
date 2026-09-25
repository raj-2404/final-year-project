import React, { useState, useEffect } from 'react';
import {
  Play,
  RotateCw,
  Square,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Circle,
  Loader2,
  Bug,
  FileCode,
  Folder,
  Layers,
  Search,
  FlaskConical,
} from 'lucide-react';
import { isDesktopApp } from '../../services/native/platform.js';
import { testManager } from '../../testing/testManager.js';
import { TestStatus, TestNodeType, TestLifecycleState } from '../../testing/testTypes.js';

export default function TestExplorerPanel({
  workspaceRoot,
  fileTree = [],
  onNavigateToFile,
  onOpenBottomTab,
  showToast,
}) {
  const [filterText, setFilterText] = useState('');
  const [collapsedNodes, setCollapsedNodes] = useState(new Set());
  const [treeVersion, setTreeVersion] = useState(0);
  const [selectedNodeId, setSelectedNodeId] = useState(null);

  const isDesktop = isDesktopApp();
  const tree = testManager.getTree();
  const state = testManager.getState();
  const stats = testManager.getStats();
  const activeFramework = testManager.getActiveFramework();
  const detectedFrameworks = testManager.detectedFrameworks;

  useEffect(() => {
    const unsubTree = testManager.onTreeChange(() => {
      setTreeVersion((v) => v + 1);
    });
    const unsubState = testManager.onStateChange(() => {
      setTreeVersion((v) => v + 1);
    });

    if (fileTree.length > 0 && tree.getAllNodes().length === 0) {
      testManager.discoverTests({ workspaceRoot, fileTree });
    }

    return () => {
      unsubTree();
      unsubState();
    };
  }, [workspaceRoot, fileTree]);

  const toggleCollapse = (id) => {
    setCollapsedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleRefresh = async () => {
    try {
      showToast?.('Discovering tests...');
      await testManager.discoverTests({ workspaceRoot, fileTree });
    } catch (err) {
      showToast?.(`Discovery error: ${err.message || err}`);
    }
  };

  const handleRunAll = async () => {
    if (!isDesktop) {
      showToast?.('Local test execution requires CodeX Desktop.');
      return;
    }
    try {
      if (onOpenBottomTab) onOpenBottomTab('output');
      showToast?.('Running all tests...');
      await testManager.runAllTests();
    } catch (err) {
      showToast?.(`Test error: ${err.message || err}`);
    }
  };

  const handleRunNode = async (node, e) => {
    e?.stopPropagation();
    if (!isDesktop) {
      showToast?.('Local test execution requires CodeX Desktop.');
      return;
    }
    try {
      if (onOpenBottomTab) onOpenBottomTab('output');
      showToast?.(`Running ${node.name}...`);
      await testManager.runTestNode(node.id);
    } catch (err) {
      showToast?.(`Run error: ${err.message || err}`);
    }
  };

  const handleDebugNode = async (node, e) => {
    e?.stopPropagation();
    if (!isDesktop) {
      showToast?.('Debugging tests requires CodeX Desktop.');
      return;
    }
    try {
      showToast?.(`Debugging ${node.name}...`);
      await testManager.debugTestNode(node.id);
    } catch (err) {
      showToast?.(`Debug test error: ${err.message || err}`);
    }
  };

  const handleStop = async () => {
    try {
      showToast?.('Stopping tests...');
      await testManager.stopTests();
    } catch (err) {
      showToast?.(`Stop error: ${err.message || err}`);
    }
  };

  const handleNodeClick = (node) => {
    setSelectedNodeId(node.id);
    if (node.file && onNavigateToFile) {
      const matched = fileTree.find(
        (f) => f.path === node.file || f.name === node.file || (node.file && f.path?.endsWith(node.file))
      );
      if (matched) {
        onNavigateToFile(matched, {
          lineNumber: node.line || 1,
          column: node.column || 1,
        });
      }
    }
  };

  const renderStatusIcon = (nodeStatus) => {
    switch (nodeStatus) {
      case TestStatus.PASSED:
        return <CheckCircle2 size={13} color="#4ade80" />;
      case TestStatus.FAILED:
        return <XCircle size={13} color="#f87171" />;
      case TestStatus.SKIPPED:
        return <MinusCircle size={13} color="#facc15" />;
      case TestStatus.RUNNING:
        return <Loader2 size={13} color="#38bdf8" className="spin" />;
      default:
        return <Circle size={13} color="#6b7280" />;
    }
  };

  const renderTypeIcon = (type) => {
    switch (type) {
      case TestNodeType.PROJECT:
        return <Folder size={13} color="#60a5fa" />;
      case TestNodeType.FILE:
        return <FileCode size={13} color="#93c5fd" />;
      case TestNodeType.SUITE:
        return <Layers size={13} color="#c084fc" />;
      default:
        return null;
    }
  };

  const renderTreeNode = (node, depth = 0) => {
    if (!node) return null;
    const isCollapsed = collapsedNodes.has(node.id);
    const children = tree.getChildren(node.id);
    const hasChildren = children.length > 0;
    const isSelected = selectedNodeId === node.id;

    if (
      filterText &&
      !node.name.toLowerCase().includes(filterText.toLowerCase()) &&
      !children.some((c) => c.name.toLowerCase().includes(filterText.toLowerCase()))
    ) {
      return null;
    }

    return (
      <div key={node.id}>
        <div
          className={`codex-tree-row ${isSelected ? 'selected' : ''}`}
          onClick={() => handleNodeClick(node)}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '3px 8px',
            paddingLeft: `${depth * 14 + 6}px`,
            fontSize: '11.5px',
            cursor: 'pointer',
            backgroundColor: isSelected ? 'rgba(0, 122, 204, 0.25)' : 'transparent',
            borderRadius: '3px',
            gap: '6px',
            position: 'relative',
          }}
          onMouseEnter={(e) => {
            if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
          }}
          onMouseLeave={(e) => {
            if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          {/* Chevron for items with children */}
          {hasChildren ? (
            <span
              onClick={(e) => {
                e.stopPropagation();
                toggleCollapse(node.id);
              }}
              style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', color: '#858585' }}
            >
              {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
            </span>
          ) : (
            <span style={{ width: '12px' }} />
          )}

          {/* Node Type or Status Icon */}
          {node.type === TestNodeType.TEST ? (
            renderStatusIcon(node.status)
          ) : (
            <>
              {renderTypeIcon(node.type)}
              {node.status !== TestStatus.UNKNOWN && (
                <span style={{ marginLeft: '-2px' }}>{renderStatusIcon(node.status)}</span>
              )}
            </>
          )}

          {/* Label */}
          <span
            style={{
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: node.status === TestStatus.FAILED ? '#f87171' : '#e2e8f0',
            }}
          >
            {node.label || node.name}
          </span>

          {/* Duration */}
          {node.duration && (
            <span style={{ fontSize: '10px', color: '#858585', flexShrink: 0 }}>
              {node.duration}
            </span>
          )}

          {/* Action buttons on hover */}
          <div className="test-node-actions" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              className="sidebar-action-btn"
              title={`Run ${node.name}`}
              onClick={(e) => handleRunNode(node, e)}
              style={{ color: '#4ade80' }}
            >
              <Play size={11} fill="currentColor" />
            </button>
            {node.framework === 'vitest' || node.framework === 'jest' || node.framework === 'mocha' ? (
              <button
                className="sidebar-action-btn"
                title={`Debug ${node.name}`}
                onClick={(e) => handleDebugNode(node, e)}
                style={{ color: '#38bdf8' }}
              >
                <Bug size={11} />
              </button>
            ) : null}
          </div>
        </div>

        {/* Failure message card if selected and failed */}
        {isSelected && node.status === TestStatus.FAILED && node.message && (
          <div
            style={{
              margin: '4px 8px 8px 24px',
              padding: '6px 8px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '4px',
              fontSize: '11px',
              color: '#f87171',
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: '2px' }}>Error: {node.message}</div>
            {node.stackTrace && <div style={{ fontSize: '10px', color: '#fca5a5' }}>{node.stackTrace}</div>}
          </div>
        )}

        {/* Children nodes */}
        {hasChildren && !isCollapsed && (
          <div>{children.map((child) => renderTreeNode(child, depth + 1))}</div>
        )}
      </div>
    );
  };

  const isRunning = state === TestLifecycleState.RUNNING || state === TestLifecycleState.STOPPING;

  return (
    <div className="vscode-sidebar">
      {/* 1. Header */}
      <div className="sidebar-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <FlaskConical size={14} color="#a855f7" />
          <span className="sidebar-header-title">TESTING</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {isRunning ? (
            <button
              className="sidebar-action-btn danger"
              title="Stop Tests"
              onClick={handleStop}
              style={{ color: '#ef4444' }}
            >
              <Square size={12} fill="currentColor" />
            </button>
          ) : (
            <button
              className="sidebar-action-btn"
              title="Run All Tests (⇧⌘T / Ctrl+Shift+T)"
              onClick={handleRunAll}
              style={{ color: '#4ade80' }}
            >
              <Play size={12} fill="currentColor" />
            </button>
          )}

          <button
            className="sidebar-action-btn"
            title="Refresh / Rediscover Tests"
            onClick={handleRefresh}
          >
            <RotateCw size={12} className={state === TestLifecycleState.DISCOVERING ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* 2. Framework Selector & Aggregate Badges */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontSize: '11px', color: '#858585' }}>Framework:</span>
          {detectedFrameworks.length > 1 ? (
            <select
              value={activeFramework || ''}
              onChange={(e) => testManager.setActiveFramework(e.target.value)}
              style={{
                backgroundColor: '#252526',
                color: '#cccccc',
                border: '1px solid #3c3c3c',
                borderRadius: '3px',
                fontSize: '11px',
                padding: '2px 4px',
                outline: 'none',
              }}
            >
              {detectedFrameworks.map((fw) => (
                <option key={fw} value={fw}>
                  {fw.toUpperCase()}
                </option>
              ))}
            </select>
          ) : (
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#38bdf8' }}>
              {(activeFramework || 'None').toUpperCase()}
            </span>
          )}
        </div>

        {/* Aggregate Stats */}
        {stats.total > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10.5px' }}>
            <span style={{ color: '#4ade80', fontWeight: 600 }}>{stats.passed} ✓</span>
            <span style={{ color: stats.failed > 0 ? '#f87171' : '#858585', fontWeight: stats.failed > 0 ? 600 : 400 }}>
              {stats.failed} ✗
            </span>
            <span style={{ color: '#facc15' }}>{stats.skipped} ○</span>
            <span style={{ color: '#858585' }}>({stats.total} total)</span>
          </div>
        )}
      </div>

      {/* 3. Search / Filter Input */}
      <div style={{ padding: '6px 8px', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#1e1e1e', borderRadius: '3px', border: '1px solid #3c3c3c', padding: '2px 6px' }}>
          <Search size={12} color="#858585" style={{ marginRight: '6px' }} />
          <input
            type="text"
            placeholder="Filter tests..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: '#cccccc',
              fontSize: '11px',
              outline: 'none',
              width: '100%',
            }}
          />
        </div>
      </div>

      {/* 4. Test Tree Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {!isDesktop && (
          <div style={{ padding: '12px', fontSize: '11.5px', color: '#858585' }}>
            Local test execution is available in CodeX Desktop mode.
          </div>
        )}

        {tree.getAllNodes().length === 0 ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: '#858585', fontSize: '12px' }}>
            <div style={{ marginBottom: '8px' }}>No tests discovered in this workspace.</div>
            <div style={{ fontSize: '11px', color: '#666666', marginBottom: '12px' }}>
              Add test files (*.test.ts, test_*.py, etc.) or configure in .codex/tasks.json.
            </div>
            <button
              className="btn-create-initial-terminal"
              onClick={handleRefresh}
              style={{ fontSize: '11px', padding: '4px 10px' }}
            >
              Refresh Tests
            </button>
          </div>
        ) : (
          tree.getRootNodes().map((rootNode) => renderTreeNode(rootNode, 0))
        )}
      </div>
    </div>
  );
}
