/**
 * Git Commands and Action Controller
 * Strictly local execution only. Never allows remote collaborator triggering.
 */

import { gitService } from '../services/native/git.js';
import { isDesktopApp } from '../services/native/platform.js';

export const gitCommands = {
  assertLocalExecution() {
    if (!isDesktopApp()) {
      throw new Error('Security check: Git execution is only allowed on the local desktop machine.');
    }
  },

  async stageFile(repoPath, filePath) {
    this.assertLocalExecution();
    return await gitService.stage(repoPath, [filePath]);
  },

  async stageAll(repoPath, paths) {
    this.assertLocalExecution();
    return await gitService.stage(repoPath, paths);
  },

  async unstageFile(repoPath, filePath) {
    this.assertLocalExecution();
    return await gitService.unstage(repoPath, [filePath]);
  },

  async unstageAll(repoPath, paths) {
    this.assertLocalExecution();
    return await gitService.unstage(repoPath, paths);
  },

  async discardFile(repoPath, filePath) {
    this.assertLocalExecution();
    return await gitService.discard(repoPath, filePath);
  },

  async commit(repoPath, message) {
    this.assertLocalExecution();
    if (!message || !message.trim()) {
      throw new Error('Commit message cannot be empty');
    }
    return await gitService.commit(repoPath, message.trim());
  },

  async commitAndPush(repoPath, message) {
    this.assertLocalExecution();
    await this.commit(repoPath, message);
    return await gitService.push(repoPath);
  },

  async push(repoPath) {
    this.assertLocalExecution();
    return await gitService.push(repoPath);
  },

  async pull(repoPath) {
    this.assertLocalExecution();
    return await gitService.pull(repoPath);
  },

  async fetch(repoPath) {
    this.assertLocalExecution();
    return await gitService.fetch(repoPath);
  },

  async createBranch(repoPath, branchName, checkout = true) {
    this.assertLocalExecution();
    return await gitService.createBranch(repoPath, branchName, checkout);
  },

  async switchBranch(repoPath, branchName) {
    this.assertLocalExecution();
    return await gitService.checkout(repoPath, branchName);
  },
};
