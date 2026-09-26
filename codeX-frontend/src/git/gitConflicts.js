/**
 * Git Merge and Conflict Resolution Subsystem
 */

import { gitService } from '../services/native/git.js';

export const gitConflicts = {
  /**
   * Retrieves 3-way merge conflict stages (:1 base, :2 ours, :3 theirs)
   */
  async getConflictStages(repoPath, filePath) {
    if (!repoPath || !filePath) {
      return { base: '', ours: '', theirs: '', filePath };
    }
    return await gitService.getConflictStages(repoPath, filePath);
  },

  /**
   * Parses conflict markers in text:
   * <<<<<<< HEAD
   * current content
   * =======
   * incoming content
   * >>>>>>> branch
   */
  parseConflictMarkers(text) {
    if (!text || typeof text !== 'string') return [];
    const lines = text.split('\n');
    const conflicts = [];
    let inConflict = false;
    let currentBlock = [];
    let incomingBlock = [];
    let separatorReached = false;
    let startLine = 0;
    let currentBranchName = '';
    let incomingBranchName = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('<<<<<<<')) {
        inConflict = true;
        separatorReached = false;
        currentBlock = [];
        incomingBlock = [];
        startLine = i + 1;
        currentBranchName = line.replace('<<<<<<<', '').trim() || 'Current Change';
      } else if (inConflict && line.startsWith('=======')) {
        separatorReached = true;
      } else if (inConflict && line.startsWith('>>>>>>>')) {
        inConflict = false;
        incomingBranchName = line.replace('>>>>>>>', '').trim() || 'Incoming Change';
        conflicts.push({
          startLine,
          endLine: i + 1,
          current: currentBlock.join('\n'),
          incoming: incomingBlock.join('\n'),
          currentBranchName,
          incomingBranchName,
        });
      } else if (inConflict) {
        if (!separatorReached) {
          currentBlock.push(line);
        } else {
          incomingBlock.push(line);
        }
      }
    }

    return conflicts;
  },

  /**
   * Resolves a conflict by accepting 'current' (ours), writing to file and staging
   */
  async acceptCurrent(repoPath, filePath, filesystemService) {
    const { ours } = await this.getConflictStages(repoPath, filePath);
    const content = ours || '';
    const fullPath = filePath.startsWith('/') || filePath.includes(':')
      ? filePath
      : `${repoPath.replace(/\\/g, '/')}/${filePath}`;

    if (filesystemService) {
      await filesystemService.writeFile(fullPath, content);
    }
    await gitService.stage(repoPath, [filePath]);
    return content;
  },

  /**
   * Resolves a conflict by accepting 'incoming' (theirs), writing to file and staging
   */
  async acceptIncoming(repoPath, filePath, filesystemService) {
    const { theirs } = await this.getConflictStages(repoPath, filePath);
    const content = theirs || '';
    const fullPath = filePath.startsWith('/') || filePath.includes(':')
      ? filePath
      : `${repoPath.replace(/\\/g, '/')}/${filePath}`;

    if (filesystemService) {
      await filesystemService.writeFile(fullPath, content);
    }
    await gitService.stage(repoPath, [filePath]);
    return content;
  },

  /**
   * Resolves a conflict by accepting both (current followed by incoming)
   */
  async acceptBoth(repoPath, filePath, filesystemService) {
    const { ours, theirs } = await this.getConflictStages(repoPath, filePath);
    const content = `${ours || ''}\n${theirs || ''}`;
    const fullPath = filePath.startsWith('/') || filePath.includes(':')
      ? filePath
      : `${repoPath.replace(/\\/g, '/')}/${filePath}`;

    if (filesystemService) {
      await filesystemService.writeFile(fullPath, content);
    }
    await gitService.stage(repoPath, [filePath]);
    return content;
  },

  /**
   * Marks a conflict as resolved by staging the file
   */
  async markResolved(repoPath, filePath) {
    await gitService.stage(repoPath, [filePath]);
  },

  /**
   * Merge a branch
   */
  async merge(repoPath, branch) {
    return await gitService.merge(repoPath, branch);
  },

  /**
   * Abort merge
   */
  async mergeAbort(repoPath) {
    return await gitService.mergeAbort(repoPath);
  },
};
