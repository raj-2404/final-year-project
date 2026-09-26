import React, { useState, useEffect, useCallback } from 'react';
import {
  GitBranch,
  Plus,
  Minus,
  Check,
  RotateCw,
  ArrowUp,
  ArrowDown,
  FileText,
  ChevronRight,
  ChevronDown,
  GitCommit,
  RotateCcw,
  AlertTriangle,
  FolderGit2,
  Archive,
  History,
  Trash2,
  PlusCircle,
} from 'lucide-react';
import { gitManager } from '../../git/gitManager';
import { gitService } from '../../services/native/git';
import { gitStash } from '../../git/gitStash';
import { gitBranches } from '../../git/gitBranches';
import { isDesktopApp } from '../../services/native/platform';
import GitConflictModal from './GitConflictModal';
import GitHistoryModal from './GitHistoryModal';

export default function SourceControlPanel({
  projectRoot,
  filesystemService,
  gitStatus: externalStatus,
  onRefresh,
  onOpenDiff,
  onOpenFile,
  showToast,
}) {
  const [commitMessage, setCommitMessage] = useState('');
  const [isCommitting, setIsCommitting] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [isFetching, setIsFetching] = useState(false);

  // Accordion section visibility
  const [stagedExpanded, setStagedExpanded] = useState(true);
  const [changesExpanded, setChangesExpanded] = useState(true);
  const [untrackedExpanded, setUntrackedExpanded] = useState(true);
  const [conflictsExpanded, setConflictsExpanded] = useState(true);
  const [stashExpanded, setStashExpanded] = useState(false);

  // Multi-repo
  const [repos, setRepos] = useState([]);
  const [activeRepoPath, setActiveRepoPath] = useState(projectRoot || '');

  // Branch menu
  const [showBranchMenu, setShowBranchMenu] = useState(false);
  const [branches, setBranches] = useState([]);
  const [stashes, setStashes] = useState([]);

  // Modals
  const [conflictModalFile, setConflictModalFile] = useState(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const isDesktop = isDesktopApp();

  // Load repositories in workspace
  useEffect(() => {
    let mounted = true;
    async function initRepos() {
      if (!isDesktop || !projectRoot) return;
      const discovered = await gitManager.discoverWorkspaceRepositories(projectRoot);
      if (mounted) {
        setRepos(discovered);
        const active = gitManager.getActiveRepository();
        if (active) {
          setActiveRepoPath(active.root);
        }
      }
    }
    initRepos();
    return () => {
      mounted = false;
    };
  }, [projectRoot, isDesktop]);

  // Load branches and stashes
  const refreshAuxiliaryData = useCallback(async (targetRepoPath) => {
    const p = targetRepoPath || activeRepoPath || projectRoot;
    if (!p || !isDesktop) return;
    try {
      const bList = await gitBranches.getBranches(p).catch(() => []);
      setBranches(bList);
      const sList = await gitStash.getStashList(p).catch(() => []);
      setStashes(sList);
    } catch {}
  }, [activeRepoPath, projectRoot, isDesktop]);

  useEffect(() => {
    refreshAuxiliaryData();
  }, [refreshAuxiliaryData]);

  if (!isDesktop) {
    return (
      <div className="vscode-sidebar">
        <div className="sidebar-header">
          <span className="sidebar-header-title">SOURCE CONTROL</span>
        </div>
        <div style={{ padding: '16px', color: '#858585', fontSize: '12px' }}>
          Git source control is available in the CodeX Desktop application.
        </div>
      </div>
    );
  }

  const activeRepo = gitManager.getActiveRepository();
  const gitStatus = activeRepo?.status || externalStatus;

  if (!gitStatus || !gitStatus.is_repo && !gitStatus.isRepo) {
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
            onClick={() => {
              if (onRefresh) onRefresh();
              refreshAuxiliaryData();
            }}
          >
            <RotateCw size={13} /> Check Again
          </button>
        </div>
      </div>
    );
  }

  const staged = gitStatus.staged || [];
  const unstaged = gitStatus.unstaged || [];
  const untracked = gitStatus.untracked || [];
  const conflicts = gitStatus.conflicts || [];
  const totalChanges = staged.length + unstaged.length + untracked.length + conflicts.length;

  const currentRepoRoot = activeRepo?.root || activeRepoPath || projectRoot;

  const handleRefresh = async () => {
    if (activeRepo) {
      await activeRepo.refresh();
    }
    if (onRefresh) onRefresh();
    await refreshAuxiliaryData(currentRepoRoot);
  };

  const handleSelectRepo = async (newRepoPath) => {
    setActiveRepoPath(newRepoPath);
    await gitManager.setActiveRepository(newRepoPath);
    await refreshAuxiliaryData(newRepoPath);
    if (onRefresh) onRefresh();
  };

  const handleStageAll = async () => {
    try {
      const paths = [...unstaged, ...untracked].map((f) => f.path);
      if (paths.length === 0) return;
      await gitService.stage(currentRepoRoot, paths);
      await handleRefresh();
      showToast('Staged all changes');
    } catch (err) {
      showToast(`Stage error: ${err.message || err}`);
    }
  };

  const handleStageFile = async (e, path) => {
    e.stopPropagation();
    try {
      await gitService.stage(currentRepoRoot, [path]);
      await handleRefresh();
    } catch (err) {
      showToast(`Stage error: ${err.message || err}`);
    }
  };

  const handleUnstageAll = async () => {
    try {
      const paths = staged.map((f) => f.path);
      if (paths.length === 0) return;
      await gitService.unstage(currentRepoRoot, paths);
      await handleRefresh();
      showToast('Unstaged all changes');
    } catch (err) {
      showToast(`Unstage error: ${err.message || err}`);
    }
  };

  const handleUnstageFile = async (e, path) => {
    e.stopPropagation();
    try {
      await gitService.unstage(currentRepoRoot, [path]);
      await handleRefresh();
    } catch (err) {
      showToast(`Unstage error: ${err.message || err}`);
    }
  };

  const handleDiscardChanges = async (e, path) => {
    e.stopPropagation();
    const confirmed = window.confirm(`Are you sure you want to discard changes in "${path}"?\n\nThis cannot be undone.`);
    if (!confirmed) return;

    try {
      await gitService.discard(currentRepoRoot, path);
      await handleRefresh();
      showToast(`Discarded changes in ${path}`);
    } catch (err) {
      showToast(`Discard error: ${err.message || err}`);
    }
  };

  const handleCommit = async (andPush = false) => {
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
      await gitService.commit(currentRepoRoot, commitMessage.trim());
      setCommitMessage('');
      if (andPush) {
        showToast('Committed. Pushing to remote...');
        await gitService.push(currentRepoRoot);
        showToast('Pushed changes successfully');
      } else {
        showToast('Committed changes successfully');
      }
      await handleRefresh();
    } catch (err) {
      showToast(`Commit failed: ${err.message || err}`);
    } finally {
      setIsCommitting(false);
    }
  };

  const handlePull = async () => {
    setIsPulling(true);
    try {
      await gitService.pull(currentRepoRoot);
      await handleRefresh();
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
      await gitService.push(currentRepoRoot);
      await handleRefresh();
      showToast('Pushed commits to remote');
    } catch (err) {
      showToast(`Push error: ${err.message || err}`);
    } finally {
      setIsPushing(false);
    }
  };

  const handleFetch = async () => {
    setIsFetching(true);
    try {
      await gitService.fetch(currentRepoRoot);
      await handleRefresh();
      showToast('Fetched updates from remote');
    } catch (err) {
      showToast(`Fetch error: ${err.message || err}`);
    } finally {
      setIsFetching(false);
    }
  };

  const handleSwitchBranch = async (branchName) => {
    setShowBranchMenu(false);
    try {
      await gitService.checkout(currentRepoRoot, branchName);
      await handleRefresh();
      showToast(`Switched to branch "${branchName}"`);
    } catch (err) {
      showToast(`Checkout error: ${err.message || err}`);
    }
  };

  const handleCreateBranch = async () => {
    const branchName = window.prompt('Enter new branch name:');
    if (!branchName || !branchName.trim()) return;
    try {
      await gitBranches.createBranch(currentRepoRoot, branchName.trim(), true);
      await handleRefresh();
      showToast(`Created and checked out branch "${branchName.trim()}"`);
    } catch (err) {
      showToast(`Branch creation error: ${err.message || err}`);
    }
  };

  const handleSaveStash = async () => {
    const msg = window.prompt('Stash message (optional):');
    if (msg === null) return;
    try {
      await gitStash.save(currentRepoRoot, msg || undefined, true);
      await handleRefresh();
      showToast('Changes stashed successfully');
    } catch (err) {
      showToast(`Stash error: ${err.message || err}`);
    }
  };

  const handlePopStash = async (index) => {
    try {
      await gitStash.pop(currentRepoRoot, index);
      await handleRefresh();
      showToast(`Popped stash@{${index}}`);
    } catch (err) {
      showToast(`Stash pop error: ${err.message || err}`);
    }
  };

  const handleDropStash = async (index) => {
    const confirmed = window.confirm(`Drop stash@{${index}}?\nThis cannot be undone.`);
    if (!confirmed) return;
    try {
      await gitStash.drop(currentRepoRoot, index);
      await handleRefresh();
      showToast(`Dropped stash@{${index}}`);
    } catch (err) {
      showToast(`Stash drop error: ${err.message || err}`);
    }
  };

  return (
    <div className="vscode-sidebar">
      {/* Sidebar Header */}
      <div className="sidebar-header">
        <span className="sidebar-header-title">SOURCE CONTROL</span>
        <div className="sidebar-actions">
          <button className="sidebar-action-btn" title="Refresh Git Status" onClick={handleRefresh}>
            <RotateCw size={13} />
          </button>
          <button className="sidebar-action-btn" title="Fetch" onClick={handleFetch} disabled={isFetching}>
            <RotateCcw size={13} />
          </button>
          <button className="sidebar-action-btn" title="Pull" onClick={handlePull} disabled={isPulling}>
            <ArrowDown size={13} />
          </button>
          <button className="sidebar-action-btn" title="Push" onClick={handlePush} disabled={isPushing}>
            <ArrowUp size={13} />
          </button>
          <button className="sidebar-action-btn" title="View Commit History" onClick={() => setShowHistoryModal(true)}>
            <History size={13} />
          </button>
        </div>
      </div>

      {/* Multi-repo Selector (when more than 1 repository exists) */}
      {repos.length > 1 && (
        <div
          style={{
            padding: '6px 12px',
            backgroundColor: '#1e1e1e',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '11px',
          }}
        >
          <FolderGit2 size={13} color="#60a5fa" />
          <select
            value={currentRepoRoot}
            onChange={(e) => handleSelectRepo(e.target.value)}
            style={{
              flex: 1,
              backgroundColor: '#252526',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#ffffff',
              fontSize: '11px',
              padding: '2px 6px',
              borderRadius: '3px',
              outline: 'none',
            }}
          >
            {repos.map((r) => (
              <option key={r.root} value={r.root}>
                {r.name} ({r.root})
              </option>
            ))}
          </select>
        </div>
      )}

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
        onClick={() => setShowBranchMenu(!showBranchMenu)}
        title="Click to switch or create branch"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <GitBranch size={13} color={gitStatus.is_detached || gitStatus.isDetached ? '#f97316' : '#60a5fa'} />
          <span style={{ fontWeight: 600 }}>{gitStatus.branch || 'main'}</span>
          {(gitStatus.is_detached || gitStatus.isDetached) && (
            <span style={{ color: '#f97316', fontSize: '10px' }}>(detached HEAD)</span>
          )}
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
            maxHeight: '180px',
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              padding: '5px 12px',
              fontSize: '11px',
              color: '#4ade80',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            }}
            onClick={handleCreateBranch}
          >
            <PlusCircle size={12} />
            <span>Create New Branch...</span>
          </div>

          {branches.map((b) => {
            const bName = typeof b === 'string' ? b : b.name;
            const isCurr = bName === gitStatus.branch;
            return (
              <div
                key={bName}
                style={{
                  padding: '5px 12px',
                  fontSize: '11.5px',
                  color: isCurr ? '#60a5fa' : '#cccccc',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
                onClick={() => handleSwitchBranch(bName)}
              >
                {isCurr && <Check size={11} />}
                <span>{bName}</span>
              </div>
            );
          })}
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
              handleCommit(false);
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

        <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
          <button
            type="button"
            onClick={() => handleCommit(false)}
            disabled={isCommitting || staged.length === 0}
            style={{
              flex: 1,
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

          <button
            type="button"
            onClick={() => handleCommit(true)}
            disabled={isCommitting || staged.length === 0}
            title="Commit & Push"
            style={{
              backgroundColor: staged.length > 0 ? '#1f6feb' : '#333333',
              color: '#ffffff',
              border: 'none',
              borderRadius: '3px',
              padding: '5px 8px',
              cursor: staged.length > 0 ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <ArrowUp size={13} />
          </button>
        </div>
      </div>

      {/* Changes View Container */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* 1. Merge Conflicts Section */}
        {conflicts.length > 0 && (
          <div style={{ borderBottom: '1px solid rgba(249, 115, 22, 0.2)' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 12px',
                cursor: 'pointer',
                userSelect: 'none',
                backgroundColor: 'rgba(249, 115, 22, 0.1)',
              }}
              onClick={() => setConflictsExpanded(!conflictsExpanded)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, color: '#f97316' }}>
                {conflictsExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                <AlertTriangle size={12} color="#f97316" />
                <span>MERGE CONFLICTS</span>
                <span style={{ marginLeft: '4px', color: '#fb923c' }}>{conflicts.length}</span>
              </div>
            </div>

            {conflictsExpanded &&
              conflicts.map((f) => (
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
                  onClick={() => setConflictModalFile(f.path)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                    <FileText size={13} color="#f97316" />
                    <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', color: '#ffedd5' }}>
                      {f.path}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#f97316' }}>
                      {f.status || 'UU'}
                    </span>
                    <button
                      className="node-btn"
                      title="Resolve Conflict"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConflictModalFile(f.path);
                      }}
                      style={{ color: '#f97316' }}
                    >
                      Resolve
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* 2. Staged Changes Section */}
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

        {/* 3. Unstaged Changes Section */}
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
              <span style={{ color: '#858585', marginLeft: '4px' }}>{unstaged.length}</span>
            </div>
            {unstaged.length > 0 && (
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
            unstaged.map((f) => (
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
                      color: f.status === 'D' ? '#ef4444' : '#eab308',
                    }}
                  >
                    {f.status || 'M'}
                  </span>
                  <button
                    className="node-btn"
                    title="Discard Changes"
                    onClick={(e) => handleDiscardChanges(e, f.path)}
                  >
                    <RotateCcw size={11} />
                  </button>
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
        </div>

        {/* 4. Untracked Files Section */}
        {untracked.length > 0 && (
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
              onClick={() => setUntrackedExpanded(!untrackedExpanded)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600 }}>
                {untrackedExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                <span>UNTRACKED FILES</span>
                <span style={{ color: '#858585', marginLeft: '4px' }}>{untracked.length}</span>
              </div>
            </div>

            {untrackedExpanded &&
              untracked.map((f) => (
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
                  onClick={() => onOpenFile && onOpenFile(f.path)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                    <FileText size={13} color="#22c55e" />
                    <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {f.path}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#22c55e' }}>
                      U
                    </span>
                    <button
                      className="node-btn"
                      title="Stage Untracked File"
                      onClick={(e) => handleStageFile(e, f.path)}
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* 5. Stash Section */}
        <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
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
            onClick={() => setStashExpanded(!stashExpanded)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600 }}>
              {stashExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              <Archive size={12} color="#cccccc" />
              <span>STASH</span>
              <span style={{ color: '#858585', marginLeft: '4px' }}>{stashes.length}</span>
            </div>
            <button
              className="sidebar-action-btn"
              title="Stash Changes"
              onClick={(e) => {
                e.stopPropagation();
                handleSaveStash();
              }}
            >
              <Plus size={12} />
            </button>
          </div>

          {stashExpanded && (
            <div style={{ padding: '4px 0' }}>
              {stashes.length === 0 ? (
                <div style={{ padding: '6px 24px', fontSize: '11px', color: '#858585' }}>
                  No stashes saved.
                </div>
              ) : (
                stashes.map((s) => (
                  <div
                    key={s.index}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '4px 12px 4px 24px',
                      fontSize: '11px',
                    }}
                    className="tree-node"
                  >
                    <span style={{ color: '#cccccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      stash@{`{${s.index}}`}: {s.message || 'WIP'}
                    </span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        className="node-btn"
                        title="Apply Stash"
                        onClick={() => handlePopStash(s.index)}
                      >
                        Pop
                      </button>
                      <button
                        className="node-btn"
                        title="Drop Stash"
                        onClick={() => handleDropStash(s.index)}
                      >
                        <Trash2 size={11} color="#f87171" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {totalChanges === 0 && (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: '#858585', fontSize: '11.5px' }}>
            No changes detected in working tree.
          </div>
        )}
      </div>

      {/* Conflict Editor Modal */}
      {conflictModalFile && (
        <GitConflictModal
          repoPath={currentRepoRoot}
          filePath={conflictModalFile}
          filesystemService={filesystemService}
          onClose={() => setConflictModalFile(null)}
          onResolved={handleRefresh}
          showToast={showToast}
        />
      )}

      {/* Git History Modal */}
      {showHistoryModal && (
        <GitHistoryModal
          repoPath={currentRepoRoot}
          onOpenDiff={onOpenDiff}
          onClose={() => setShowHistoryModal(false)}
          showToast={showToast}
        />
      )}
    </div>
  );
}
