/**
 * Native Git Service
 * Manages local Git operations directly via local Git binary on desktop.
 * Never transmits Git credentials or repos across remote collaboration websockets.
 */

import { isDesktopApp } from './platform.js';

export const gitService = {
  isSupported() {
    return isDesktopApp();
  },

  async getStatus(repoPath) {
    if (!isDesktopApp() || !repoPath) {
      return {
        is_repo: false,
        root: '',
        branch: '',
        is_detached: false,
        ahead: 0,
        behind: 0,
        staged: [],
        unstaged: [],
        untracked: [],
        conflicts: [],
      };
    }
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('git_status', { repoPath });
  },

  async getBranches(repoPath) {
    if (!isDesktopApp() || !repoPath) return [];
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('git_branches', { repoPath });
  },

  async createBranch(repoPath, name, checkout = false) {
    if (!isDesktopApp() || !repoPath) throw new Error('Git operations are only available on desktop');
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('git_branch_create', { repoPath, name, checkout });
  },

  async deleteBranch(repoPath, name, force = false) {
    if (!isDesktopApp() || !repoPath) throw new Error('Git operations are only available on desktop');
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('git_branch_delete', { repoPath, name, force });
  },

  async renameBranch(repoPath, oldName, newName) {
    if (!isDesktopApp() || !repoPath) throw new Error('Git operations are only available on desktop');
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('git_branch_rename', { repoPath, oldName, newName });
  },

  async checkout(repoPath, branch) {
    if (!isDesktopApp() || !repoPath) throw new Error('Git operations are only available on desktop');
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('git_checkout', { repoPath, branch });
  },

  async stage(repoPath, paths) {
    if (!isDesktopApp() || !repoPath) return;
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('git_stage', { repoPath, paths });
  },

  async unstage(repoPath, paths) {
    if (!isDesktopApp() || !repoPath) return;
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('git_unstage', { repoPath, paths });
  },

  async discard(repoPath, path) {
    if (!isDesktopApp() || !repoPath) throw new Error('Git operations are only available on desktop');
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('git_discard', { repoPath, path });
  },

  async commit(repoPath, message) {
    if (!isDesktopApp() || !repoPath) throw new Error('Git operations are only available on desktop');
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('git_commit', { repoPath, message });
  },

  async diff(repoPath, filePath = null, staged = false) {
    if (!isDesktopApp() || !repoPath) return '';
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('git_diff', { repoPath, filePath, staged });
  },

  async show(repoPath, spec) {
    if (!isDesktopApp() || !repoPath) return '';
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('git_show', { repoPath, spec });
  },

  async log(repoPath, maxCount = 30, filePath = null) {
    if (!isDesktopApp() || !repoPath) return [];
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('git_log', { repoPath, maxCount, filePath });
  },

  async fetch(repoPath) {
    if (!isDesktopApp() || !repoPath) return '';
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('git_fetch', { repoPath });
  },

  async pull(repoPath) {
    if (!isDesktopApp() || !repoPath) return '';
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('git_pull', { repoPath });
  },

  async push(repoPath) {
    if (!isDesktopApp() || !repoPath) return '';
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('git_push', { repoPath });
  },

  async stashList(repoPath) {
    if (!isDesktopApp() || !repoPath) return [];
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('git_stash_list', { repoPath });
  },

  async stashSave(repoPath, message = null, includeUntracked = false) {
    if (!isDesktopApp() || !repoPath) throw new Error('Git operations are only available on desktop');
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('git_stash_save', { repoPath, message, includeUntracked });
  },

  async stashApply(repoPath, index = 0) {
    if (!isDesktopApp() || !repoPath) throw new Error('Git operations are only available on desktop');
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('git_stash_apply', { repoPath, index });
  },

  async stashPop(repoPath, index = 0) {
    if (!isDesktopApp() || !repoPath) throw new Error('Git operations are only available on desktop');
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('git_stash_pop', { repoPath, index });
  },

  async stashDrop(repoPath, index = 0) {
    if (!isDesktopApp() || !repoPath) throw new Error('Git operations are only available on desktop');
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('git_stash_drop', { repoPath, index });
  },

  async merge(repoPath, branch) {
    if (!isDesktopApp() || !repoPath) throw new Error('Git operations are only available on desktop');
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('git_merge', { repoPath, branch });
  },

  async mergeAbort(repoPath) {
    if (!isDesktopApp() || !repoPath) throw new Error('Git operations are only available on desktop');
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('git_merge_abort', { repoPath });
  },

  async getConflictStages(repoPath, filePath) {
    if (!isDesktopApp() || !repoPath) return { base: '', ours: '', theirs: '', filePath };
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('git_conflict_stages', { repoPath, filePath });
  },

  async discoverRepos(workspaceRoot) {
    if (!isDesktopApp() || !workspaceRoot) return [];
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('git_discover_repos', { workspaceRoot });
  },
};
