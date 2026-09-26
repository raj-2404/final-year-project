/**
 * Git Repository Model
 * Represents a single Git repository in the workspace.
 */

import { gitService } from '../services/native/git.js';
import { categorizeStatus } from './gitStatus.js';
import { gitBranches } from './gitBranches.js';
import { gitStash } from './gitStash.js';

export class GitRepository {
  constructor(rootPath) {
    this.root = rootPath.replace(/\\/g, '/');
    this.name = this.root.split('/').filter(Boolean).pop() || 'Repository';
    this.status = null;
    this.branches = [];
    this.stashes = [];
    this.isLoading = false;
    this.listeners = new Set();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const listener of this.listeners) {
      try {
        listener(this);
      } catch (err) {
        console.error('Error in GitRepository listener:', err);
      }
    }
  }

  async refresh() {
    this.isLoading = true;
    try {
      const rawStatus = await gitService.getStatus(this.root);
      this.status = categorizeStatus(rawStatus);

      if (this.status.isRepo) {
        this.branches = await gitBranches.getBranches(this.root).catch(() => []);
        this.stashes = await gitStash.getStashList(this.root).catch(() => []);
      }
    } catch (err) {
      console.error(`Failed to refresh repository at ${this.root}:`, err);
    } finally {
      this.isLoading = false;
      this.notify();
    }
    return this.status;
  }

  async stage(paths) {
    await gitService.stage(this.root, paths);
    return await this.refresh();
  }

  async unstage(paths) {
    await gitService.unstage(this.root, paths);
    return await this.refresh();
  }

  async discard(path) {
    await gitService.discard(this.root, path);
    return await this.refresh();
  }

  async commit(message) {
    const res = await gitService.commit(this.root, message);
    await this.refresh();
    return res;
  }

  async push() {
    const res = await gitService.push(this.root);
    await this.refresh();
    return res;
  }

  async pull() {
    const res = await gitService.pull(this.root);
    await this.refresh();
    return res;
  }

  async fetch() {
    const res = await gitService.fetch(this.root);
    await this.refresh();
    return res;
  }

  async checkout(branch) {
    const res = await gitService.checkout(this.root, branch);
    await this.refresh();
    return res;
  }
}
