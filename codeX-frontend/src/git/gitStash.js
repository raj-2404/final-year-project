/**
 * Git Stash Operations Service
 */

import { gitService } from '../services/native/git.js';

export const gitStash = {
  async getStashList(repoPath) {
    if (!repoPath) return [];
    return await gitService.stashList(repoPath);
  },

  async save(repoPath, message = null, includeUntracked = false) {
    if (!repoPath) throw new Error('Repository path is required');
    return await gitService.stashSave(repoPath, message, includeUntracked);
  },

  async apply(repoPath, index = 0) {
    if (!repoPath) throw new Error('Repository path is required');
    return await gitService.stashApply(repoPath, index);
  },

  async pop(repoPath, index = 0) {
    if (!repoPath) throw new Error('Repository path is required');
    return await gitService.stashPop(repoPath, index);
  },

  async drop(repoPath, index = 0) {
    if (!repoPath) throw new Error('Repository path is required');
    return await gitService.stashDrop(repoPath, index);
  },
};
