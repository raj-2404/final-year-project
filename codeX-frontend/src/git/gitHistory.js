/**
 * Git History and Log Utilities
 */

import { gitService } from '../services/native/git.js';

export const gitHistory = {
  /**
   * Retrieves commit list for repo or specific file
   */
  async getLog(repoPath, maxCount = 30, filePath = null) {
    if (!repoPath) return [];
    const commits = await gitService.log(repoPath, maxCount, filePath);
    return (commits || []).map((c) => ({
      hash: c.hash,
      shortHash: c.hash ? c.hash.substring(0, 7) : '',
      author: c.author || 'Unknown',
      email: c.email || '',
      date: c.date || '',
      message: c.message || '',
      files: c.files || [],
    }));
  },

  /**
   * Retrieves commit history for a specific file
   */
  async getFileHistory(repoPath, filePath, maxCount = 20) {
    if (!repoPath || !filePath) return [];
    return await this.getLog(repoPath, maxCount, filePath);
  },

  /**
   * Retrieves file content at a specific commit
   */
  async getFileAtCommit(repoPath, commitHash, filePath) {
    if (!repoPath || !commitHash || !filePath) return '';
    const cleanPath = filePath.replace(/\\/g, '/');
    return await gitService.show(repoPath, `${commitHash}:${cleanPath}`);
  },

  /**
   * Retrieves patch for a specific commit
   */
  async getCommitDiff(repoPath, commitHash) {
    if (!repoPath || !commitHash) return '';
    return await gitService.show(repoPath, commitHash);
  },
};
