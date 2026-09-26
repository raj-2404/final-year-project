/**
 * Git Diff and Patch Utilities
 */

import { gitService } from '../services/native/git.js';

export const gitDiff = {
  /**
   * Retrieves unified diff text
   */
  async getDiff(repoPath, filePath = null, staged = false) {
    if (!repoPath) return '';
    return await gitService.diff(repoPath, filePath, staged);
  },

  /**
   * Retrieves original (HEAD or Staged) and modified content for Monaco DiffEditor
   */
  async getDiffModels(repoPath, filePath, staged = false, filesystemService = null) {
    if (!repoPath || !filePath) {
      return { original: '', modified: '', path: filePath, isStaged: staged };
    }

    const cleanPath = filePath.replace(/\\/g, '/');
    let original = '';
    let modified = '';

    try {
      if (staged) {
        // Original is HEAD, modified is staged index (:0:path)
        original = await gitService.show(repoPath, `HEAD:${cleanPath}`).catch(() => '');
        modified = await gitService.show(repoPath, `:0:${cleanPath}`).catch(() => '');
      } else {
        // Original is staged or HEAD
        const inIndex = await gitService.show(repoPath, `:0:${cleanPath}`).catch(() => null);
        if (inIndex !== null) {
          original = inIndex;
        } else {
          original = await gitService.show(repoPath, `HEAD:${cleanPath}`).catch(() => '');
        }

        // Modified is current file on disk
        if (filesystemService) {
          const fullPath = cleanPath.startsWith('/') || cleanPath.includes(':')
            ? cleanPath
            : `${repoPath.replace(/\\/g, '/')}/${cleanPath}`;
          modified = await filesystemService.readFile(fullPath).catch(() => '');
        }
      }
    } catch {
      // Fallback
    }

    return {
      path: cleanPath,
      original,
      modified,
      isStaged: staged,
    };
  },

  /**
   * Parses unified diff (-U0) into line-level changes for Monaco gutter decorations
   * Returns: Array of { startLine, endLine, type: 'added' | 'modified' | 'deleted' }
   */
  parseDiffHunks(diffText) {
    if (!diffText || typeof diffText !== 'string') return [];

    const changes = [];
    const hunkHeaderRegex = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

    const lines = diffText.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(hunkHeaderRegex);
      if (!match) continue;

      const _delStart = parseInt(match[1], 10);
      const delCount = match[2] !== undefined ? parseInt(match[2], 10) : 1;
      const addStart = parseInt(match[3], 10);
      const addCount = match[4] !== undefined ? parseInt(match[4], 10) : 1;

      if (delCount > 0 && addCount > 0) {
        // Modified lines
        changes.push({
          startLine: Math.max(1, addStart),
          endLine: Math.max(1, addStart + addCount - 1),
          type: 'modified',
        });
      } else if (delCount === 0 && addCount > 0) {
        // Added lines
        changes.push({
          startLine: Math.max(1, addStart),
          endLine: Math.max(1, addStart + addCount - 1),
          type: 'added',
        });
      } else if (delCount > 0 && addCount === 0) {
        // Deleted lines (place indicator at addStart or addStart + 1)
        changes.push({
          startLine: Math.max(1, addStart),
          endLine: Math.max(1, addStart),
          type: 'deleted',
        });
      }
    }

    return changes;
  },
};
