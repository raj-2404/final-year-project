import React, { useState } from 'react';
import {
  GitBranch,
  Plus,
  Minus,
  Check,
  RotateCw,
  ArrowUp,
  ArrowDown,
  FileText,
  FilePlus,
  FileMinus,
  ChevronRight,
  ChevronDown,
  GitCommit,
  RotateCcw,
} from 'lucide-react';
import { gitService } from '../../services/native/git';
import { isDesktopApp } from '../../services/native/platform';

export default function SourceControlPanel({
  projectRoot,
  gitStatus,
  onRefresh,
  onOpenDiff,
  onOpenFile,
  showToast,
}) {
  const [commitMessage, setCommitMessage] = useState('');
  const [isCommitting, setIsCommitting] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [stagedExpanded, setStagedExpanded] = useState(true);
  const [changesExpanded, setChangesExpanded] = useState(true);
  const [showBranchMenu, setShowBranchMenu] = useState(false);
  const [branches, setBranches] = useState([]);

  const isDesktop = isDesktopApp();

  if (!isDesktop) {
    return (
      <div className="vscode-sidebar">
        <div className="sidebar-header">
          <span className="sidebar-header-title">SOURCE CONTROL</span>
        </div>
        <div style={{ padding: '16px', color: '#858585', fontSize: '12px' }}>
          Git integration is supported in the CodeX Desktop application.
        </div>
      </div>
    );
  }

  if (!gitStatus || !gitStatus.is_repo) {
    return (
      <div className="vscode-sidebar">
        <div className="sidebar-header">
          <span className="sidebar-header-title">SOURCE CONTROL</span>
        </div>
        <div style={{ padding: '16px', color: '#858585', fontSize: '12px', lineHeight: '1.5' }}>
          <div style={{ marginBottom: '12px' }}>The workspace folder is not currently a Git repository.</div>
          <button
            type="button"
            className="empty-create-btn"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={onRefresh}
          >
            <RotateCw size={13} /> Check Again
          </button>
        </div>
      </div>
    );
  }

  const allUnstaged = [...(gitStatus.unstaged || []), ...(gitStatus.untracked || [])];
  const staged = gitStatus.staged || [];
  const totalChanges = allUnstaged.length + staged.length;

  const handleStageAll = async () => {
    try {
      const paths = allUnstaged.map((f) => f.path);
      await gitService.stage(projectRoot, paths);
      if (onRefresh) onRefresh();
      showToast('Staged all changes');
    } catch (err) {
      showToast(`Stage error: ${err.message || err}`);
    }
  };

  const handleStageFile = async (e, path) => {
    e.stopPropagation();
    try {
      await gitService.stage(projectRoot, [path]);
      if (onRefresh) onRefresh();
    } catch (err) {
      showToast(`Stage error: ${err.message || err}`);
    }
  };

  const handleUnstageAll = async () => {
    try {
      const paths = staged.map((f) => f.path);
      await gitService.unstage(projectRoot, paths);
      if (onRefresh) onRefresh();
      showToast('Unstaged all changes');
    } catch (err) {
      showToast(`Unstage error: ${err.message || err}`);
    }
  };

  const handleUnstageFile = async (e, path) => {
    e.stopPropagation();
    try {
      await gitService.unstage(projectRoot, [path]);
      if (onRefresh) onRefresh();
    } catch (err) {
      showToast(`Unstage error: ${err.message || err}`);
    }
  };

  const handleCommit = async () => {
    if (!commitMessage.trim()) {
      showToast('Please enter a commit message');
      return;
    }
    if (staged.length === 0) {
      showToast('No staged changes to commit. Stage your changes first (+).');
      return;
    }

    setIsCommitting(true);
    try {
      await gitService.commit(projectRoot, commitMessage.trim());
      setCommitMessage('');
      if (onRefresh) onRefresh();
      showToast('Committed changes successfully');
    } catch (err) {
      showToast(`Commit failed: ${err.message || err}`);
    } finally {
      setIsCommitting(false);
    }
  };

  const handlePull = async () => {
    setIsPulling(true);
    try {
      await gitService.pull(projectRoot);
      if (onRefresh) onRefresh();
      showToast('Pulled latest changes from remote');
    } catch (err) {
      showToast(`Pull error: ${err.message || err}`);
    } finally {
      setIsPulling(false);
    }
  };

  const handlePush = async () => {
    setIsPushing(true);
    try {
      await gitService.push(projectRoot);
      if (onRefresh) onRefresh();
      showToast('Pushed commits to remote');
    } catch (err) {
      showToast(`Push error: ${err.message || err}`);
    } finally {
      setIsPushing(false);
    }
  };

  const handleOpenBranchMenu = async () => {
    try {
      const list = await gitService.getBranches(projectRoot);
      setBranches(list);
      setShowBranchMenu(!showBranchMenu);
    } catch {}
  };

  const handleSwitchBranch = async (branchName) => {
    setShowBranchMenu(false);
    try {
      await gitService.checkout(projectRoot, branchName);
      if (onRefresh) onRefresh();
      showToast(`Switched to branch "${branchName}"`);
    } catch (err) {
      showToast(`Checkout error: ${err.message || err}`);
    }
  };

  return (
    <div className="vscode-sidebar">
      {/* Sidebar Header */}
      <div className="sidebar-header">
        <span className="sidebar-header-title">SOURCE CONTROL</span>
        <div className="sidebar-actions">
          <button className="sidebar-action-btn" title="Refresh Git Status" onClick={onRefresh}>
            <RotateCw size={13} />
          </button>
          <button className="sidebar-action-btn" title="Pull" onClick={handlePull} disabled={isPulling}>
            <ArrowDown size={13} />
          </button>
          <button className="sidebar-action-btn" title="Push" onClick={handlePush} disabled={isPushing}>
            <ArrowUp size={13} />
          </button>
        </div>
      </div>

      {/* Branch selector banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px',
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          fontSize: '11.5px',
          color: '#cccccc',
          cursor: 'pointer',
        }}
        onClick={handleOpenBranchMenu}
        title="Click to switch branch"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <GitBranch size={13} color="#60a5fa" />
          <span style={{ fontWeight: 600 }}>{gitStatus.branch || 'main'}</span>
          {gitStatus.ahead > 0 && <span style={{ color: '#4ade80' }}>↑{gitStatus.ahead}</span>}
          {gitStatus.behind > 0 && <span style={{ color: '#f87171' }}>↓{gitStatus.behind}</span>}
        </div>
        <span style={{ fontSize: '10px', color: '#858585' }}>Switch ▾</span>
      </div>

      {showBranchMenu && (
        <div
          style={{
            backgroundColor: '#252526',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            padding: '4px 0',
          }}
        >
          {branches.map((b) => (
            <div
              key={b}
              style={{
                padding: '5px 12px',
                fontSize: '11.5px',
                color: b === gitStatus.branch ? '#60a5fa' : '#cccccc',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
              onClick={() => handleSwitchBranch(b)}
            >
              {b === gitStatus.branch && <Check size={11} />}
              <span>{b}</span>
            </div>
          ))}
        </div>
      )}

      {/* Commit Input Box */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
        <textarea
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          placeholder="Message (Cmd+Enter to commit)"
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              handleCommit();
            }
          }}
          rows={3}
          style={{
            width: '100%',
            backgroundColor: '#1e1e1e',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '3px',
            color: '#ffffff',
            padding: '6px 8px',
            fontSize: '11.5px',
            fontFamily: 'inherit',
            resize: 'none',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />

        <button
          type="button"
          onClick={handleCommit}
          disabled={isCommitting || staged.length === 0}
          style={{
            width: '100%',
            marginTop: '6px',
            backgroundColor: staged.length > 0 ? '#007acc' : '#333333',
            color: '#ffffff',
            border: 'none',
            borderRadius: '3px',
            padding: '5px 10px',
            fontSize: '12px',
            fontWeight: 500,
            cursor: staged.length > 0 ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <GitCommit size={13} />
          <span>{isCommitting ? 'Committing...' : `Commit (${staged.length})`}</span>
        </button>
      </div>

      {/* Changes View Container */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* 1. Staged Changes Section */}
        {staged.length > 0 && (
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 12px',
                cursor: 'pointer',
                userSelect: 'none',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
              }}
              onClick={() => setStagedExpanded(!stagedExpanded)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600 }}>
                {stagedExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                <span>STAGED CHANGES</span>
                <span style={{ color: '#858585', marginLeft: '4px' }}>{staged.length}</span>
              </div>
              <button
                className="sidebar-action-btn"
                title="Unstage All"
                onClick={(e) => {
                  e.stopPropagation();
                  handleUnstageAll();
                }}
              >
                <Minus size={12} />
              </button>
            </div>

            {stagedExpanded &&
              staged.map((f) => (
                <div
                  key={f.path}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '4px 12px 4px 24px',
                    fontSize: '11.5px',
                    cursor: 'pointer',
                  }}
                  className="tree-node"
                  onClick={() => onOpenDiff && onOpenDiff(f.path, true)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                    <FileText size={13} color="#cccccc" />
                    <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {f.path}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#4ade80' }}>
                      {f.status || 'S'}
                    </span>
                    <button
                      className="node-btn"
                      title="Unstage"
                      onClick={(e) => handleUnstageFile(e, f.path)}
                    >
                      <Minus size={12} />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* 2. Unstaged / Untracked Changes Section */}
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 12px',
              cursor: 'pointer',
              userSelect: 'none',
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
            }}
            onClick={() => setChangesExpanded(!changesExpanded)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600 }}>
              {changesExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              <span>CHANGES</span>
              <span style={{ color: '#858585', marginLeft: '4px' }}>{allUnstaged.length}</span>
            </div>
            {allUnstaged.length > 0 && (
              <button
                className="sidebar-action-btn"
                title="Stage All"
                onClick={(e) => {
                  e.stopPropagation();
                  handleStageAll();
                }}
              >
                <Plus size={12} />
              </button>
            )}
          </div>

          {changesExpanded &&
            allUnstaged.map((f) => (
              <div
                key={f.path}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '4px 12px 4px 24px',
                  fontSize: '11.5px',
                  cursor: 'pointer',
                }}
                className="tree-node"
                onClick={() => onOpenDiff && onOpenDiff(f.path, false)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                  <FileText size={13} color="#cccccc" />
                  <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {f.path}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    style={{
                      fontSize: '10.5px',
                      fontWeight: 700,
                      color: f.status === 'U' ? '#22c55e' : '#eab308',
                    }}
                  >
                    {f.status || 'M'}
                  </span>
                  <button
                    className="node-btn"
                    title="Stage Changes"
                    onClick={(e) => handleStageFile(e, f.path)}
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </div>
            ))}

          {totalChanges === 0 && (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: '#858585', fontSize: '11.5px' }}>
              No changes detected in working tree.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
