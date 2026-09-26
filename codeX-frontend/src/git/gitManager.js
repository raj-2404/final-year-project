/**
 * Git Manager Subsystem
 * Central coordinator for Git operations, multi-repo workspace management,
 * debounced status refreshes, and editor gutter decorations.
 */

import { gitService } from '../services/native/git.js';
import { GitRepository } from './gitRepository.js';
import { gitDiff } from './gitDiff.js';

class GitManager {
  constructor() {
    this.repositories = new Map(); // path -> GitRepository
    this.activeRepoPath = null;
    this.refreshTimer = null;
    this.debounceMs = 400;
    this.listeners = new Set();
    this.editorDecorations = new Map(); // editorId -> decorationCollection
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(event, data) {
    for (const listener of this.listeners) {
      try {
        listener(event, data);
      } catch (err) {
        console.error('Error in GitManager listener:', err);
      }
    }
  }

  getActiveRepository() {
    if (!this.activeRepoPath) return null;
    return this.repositories.get(this.activeRepoPath) || null;
  }

  getAllRepositories() {
    return Array.from(this.repositories.values());
  }

  async setActiveRepository(repoPath) {
    if (!repoPath) {
      this.activeRepoPath = null;
      this.notify('active-repo-changed', null);
      return;
    }
    const clean = repoPath.replace(/\\/g, '/');
    if (!this.repositories.has(clean)) {
      const repo = new GitRepository(clean);
      this.repositories.set(clean, repo);
    }
    this.activeRepoPath = clean;
    const activeRepo = this.repositories.get(clean);
    await activeRepo.refresh();
    this.notify('active-repo-changed', activeRepo);
  }

  /**
   * Discovers repositories in workspaceRoot (workspace root + nested repos)
   */
  async discoverWorkspaceRepositories(workspaceRoot) {
    if (!workspaceRoot) return [];
    try {
      const detected = await gitService.discoverRepos(workspaceRoot);
      const cleanRoot = workspaceRoot.replace(/\\/g, '/');

      // If nothing detected or backend returned empty, check status of workspaceRoot
      if (detected.length === 0) {
        const check = await gitService.getStatus(cleanRoot);
        if (check && check.is_repo) {
          detected.push(cleanRoot);
        }
      }

      // Add discovered repos to map
      for (const path of detected) {
        const clean = path.replace(/\\/g, '/');
        if (!this.repositories.has(clean)) {
          this.repositories.set(clean, new GitRepository(clean));
        }
      }

      // If no active repo is set, select first
      if ((!this.activeRepoPath || !this.repositories.has(this.activeRepoPath)) && detected.length > 0) {
        const first = detected[0].replace(/\\/g, '/');
        await this.setActiveRepository(first);
      } else if (this.activeRepoPath && this.repositories.has(this.activeRepoPath)) {
        await this.repositories.get(this.activeRepoPath).refresh();
      }

      this.notify('repositories-discovered', this.getAllRepositories());
      return this.getAllRepositories();
    } catch (err) {
      console.error('Failed to discover workspace repositories:', err);
      return [];
    }
  }

  /**
   * Schedule debounced refresh on file edit, save, stage, commit, etc.
   */
  scheduleRefresh(delay = this.debounceMs) {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    this.refreshTimer = setTimeout(async () => {
      this.refreshTimer = null;
      const active = this.getActiveRepository();
      if (active) {
        await active.refresh();
        this.notify('status-updated', active.status);
      }
    }, delay);
  }

  /**
   * Immediate refresh of active repo
   */
  async refreshNow() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    const active = this.getActiveRepository();
    if (active) {
      await active.refresh();
      this.notify('status-updated', active.status);
    }
  }

  /**
   * Updates Monaco editor gutter decorations for a file
   * Dedicated owner 'codex-git' ensuring zero conflict with breakpoints or coverage
   */
  async updateGutterDecorations(editor, filePath) {
    if (!editor || !filePath) return;
    const activeRepo = this.getActiveRepository();
    if (!activeRepo) return;

    try {
      // Relative path within repo
      let relPath = filePath.replace(/\\/g, '/');
      const repoRoot = activeRepo.root;
      if (relPath.startsWith(repoRoot)) {
        relPath = relPath.substring(repoRoot.length).replace(/^\//, '');
      }

      const diffText = await gitDiff.getDiff(activeRepo.root, relPath, false);
      const changes = gitDiff.parseDiffHunks(diffText);

      const decorations = changes.map((ch) => {
        let className = 'codex-git-gutter-modified';
        let glyphClassName = 'codex-git-glyph-modified';

        if (ch.type === 'added') {
          className = 'codex-git-gutter-added';
          glyphClassName = 'codex-git-glyph-added';
        } else if (ch.type === 'deleted') {
          className = 'codex-git-gutter-deleted';
          glyphClassName = 'codex-git-glyph-deleted';
        }

        return {
          range: {
            startLineNumber: ch.startLine,
            startColumn: 1,
            endLineNumber: ch.endLine,
            endColumn: 1,
          },
          options: {
            isWholeLine: true,
            className,
            linesDecorationsClassName: glyphClassName,
            overviewRuler: {
              color: ch.type === 'added' ? '#22c55e' : ch.type === 'deleted' ? '#ef4444' : '#eab308',
              position: 4, // Center
            },
          },
        };
      });

      // Apply decoration collection
      const editorId = editor.getId ? editor.getId() : 'default-editor';
      if (this.editorDecorations.has(editorId)) {
        const oldCollection = this.editorDecorations.get(editorId);
        if (oldCollection && typeof oldCollection.set === 'function') {
          oldCollection.set(decorations);
          return;
        }
      }

      if (typeof editor.createDecorationsCollection === 'function') {
        const collection = editor.createDecorationsCollection(decorations);
        this.editorDecorations.set(editorId, collection);
      }
    } catch {
      // Silent error during gutter diffing
    }
  }

  clearDecorations(editor) {
    if (!editor) return;
    const editorId = editor.getId ? editor.getId() : 'default-editor';
    if (this.editorDecorations.has(editorId)) {
      const col = this.editorDecorations.get(editorId);
      if (col && typeof col.clear === 'function') {
        col.clear();
      }
      this.editorDecorations.delete(editorId);
    }
  }
}

export const gitManager = new GitManager();
