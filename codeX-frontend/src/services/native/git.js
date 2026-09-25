/**
 * Native Git Service
 * Manages local Git operations directly via local Git binary on desktop.
 * Never transmits Git credentials or repos across remote collaboration websockets.
 */

import { isDesktopApp } from './platform';

export const gitService = {
  isSupported() {
    return isDesktopApp();
  },

  async getStatus(repoPath) {
    if (!isDesktopApp() || !repoPath) {
      return {
        is_repo: false,
        branch: '',
        ahead: 0,
        behind: 0,
        staged: [],
        unstaged: [],
        untracked: [],
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

  async checkout(repoPath, branch) {
    if (!isDesktopApp() || !repoPath) {
      throw new Error('Git operations are only available on desktop');
    }
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

  async commit(repoPath, message) {
    if (!isDesktopApp() || !repoPath) {
      throw new Error('Git operations are only available on desktop');
    }
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('git_commit', { repoPath, message });
  },

  async diff(repoPath, filePath = null, staged = false) {
    if (!isDesktopApp() || !repoPath) return '';
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('git_diff', { repoPath, filePath, staged });
  },

  async log(repoPath, maxCount = 20) {
    if (!isDesktopApp() || !repoPath) return [];
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('git_log', { repoPath, maxCount });
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
};
