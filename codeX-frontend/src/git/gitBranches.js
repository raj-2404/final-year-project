/**
 * Git Branch Management Service
 */

import { gitService } from '../services/native/git.js';

export const gitBranches = {
  async getBranches(repoPath) {
    if (!repoPath) return [];
    const list = await gitService.getBranches(repoPath);
    // Standardize return into branch info objects
    return (list || []).map((item) => {
      if (typeof item === 'string') {
        return {
          name: item,
          isCurrent: false,
          isRemote: item.startsWith('origin/') || item.startsWith('remotes/'),
          upstream: null,
          ahead: 0,
          behind: 0,
        };
      }
      return {
        name: item.name,
        isCurrent: !!item.is_current,
        isRemote: !!item.is_remote,
        upstream: item.upstream || null,
        ahead: item.ahead || 0,
        behind: item.behind || 0,
      };
    });
  },

  async createBranch(repoPath, name, checkout = false) {
    if (!name || !name.trim()) throw new Error('Branch name cannot be empty');
    return await gitService.createBranch(repoPath, name.trim(), checkout);
  },

  async deleteBranch(repoPath, name, force = false) {
    if (!name) throw new Error('Branch name required for deletion');
    return await gitService.deleteBranch(repoPath, name, force);
  },

  async renameBranch(repoPath, oldName, newName) {
    if (!oldName || !newName || !newName.trim()) {
      throw new Error('Valid old and new branch names are required');
    }
    return await gitService.renameBranch(repoPath, oldName, newName.trim());
  },

  async checkout(repoPath, branch) {
    if (!branch) throw new Error('Branch name is required for checkout');
    return await gitService.checkout(repoPath, branch);
  },

  hasUncommittedChanges(statusResult) {
    if (!statusResult) return false;
    const stagedCount = statusResult.staged ? statusResult.staged.length : 0;
    const unstagedCount = statusResult.unstaged ? statusResult.unstaged.length : 0;
    return stagedCount > 0 || unstagedCount > 0;
  },
};
