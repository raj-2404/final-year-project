/**
 * Git Status Utility and Normalizer
 */

export function normalizeStatusItem(item, isStaged = false) {
  if (!item) return null;
  return {
    path: item.path || '',
    status: item.status || 'M',
    staged: isStaged || !!item.staged,
    unstaged: !isStaged && !!item.unstaged,
    oldPath: item.old_path || item.oldPath || null,
    isConflicted: !!item.conflicted || isConflictCode(item.status),
  };
}

export function isConflictCode(code) {
  if (!code || typeof code !== 'string') return false;
  const upper = code.toUpperCase();
  return ['UU', 'AA', 'DD', 'AU', 'UD', 'UA', 'DU'].includes(upper);
}

export function categorizeStatus(statusResult) {
  if (!statusResult || !statusResult.is_repo) {
    return {
      isRepo: false,
      root: '',
      branch: '',
      isDetached: false,
      ahead: 0,
      behind: 0,
      staged: [],
      unstaged: [],
      untracked: [],
      conflicts: [],
      totalChanges: 0,
    };
  }

  const staged = (statusResult.staged || []).map((item) => normalizeStatusItem(item, true));
  const unstaged = (statusResult.unstaged || []).map((item) => normalizeStatusItem(item, false));
  const untracked = (statusResult.untracked || []).map((item) => normalizeStatusItem(item, false));
  const conflicts = (statusResult.conflicts || []).map((item) => normalizeStatusItem(item, false));

  const totalChanges = staged.length + unstaged.length + untracked.length + conflicts.length;

  return {
    isRepo: true,
    root: statusResult.root || '',
    branch: statusResult.branch || 'main',
    isDetached: !!statusResult.is_detached,
    ahead: statusResult.ahead || 0,
    behind: statusResult.behind || 0,
    staged,
    unstaged,
    untracked,
    conflicts,
    totalChanges,
  };
}
