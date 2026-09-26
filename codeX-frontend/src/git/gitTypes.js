/**
 * Git Types and Enums for CodeX Source Control
 */

export const GitFileStatus = Object.freeze({
  MODIFIED: 'M',
  ADDED: 'A',
  DELETED: 'D',
  RENAMED: 'R',
  COPIED: 'C',
  UNTRACKED: 'U',
  IGNORED: '!',
  CONFLICTED: '!',
});

export const GitConflictType = Object.freeze({
  BOTH_MODIFIED: 'UU',
  ADDED_BY_US: 'AU',
  ADDED_BY_THEM: 'UA',
  DELETED_BY_US: 'DU',
  DELETED_BY_THEM: 'UD',
  BOTH_ADDED: 'AA',
  BOTH_DELETED: 'DD',
});

export const GitStatusColor = Object.freeze({
  M: '#eab308', // Yellow
  A: '#22c55e', // Green
  D: '#ef4444', // Red
  R: '#3b82f6', // Blue
  C: '#8b5cf6', // Purple
  U: '#10b981', // Emerald
  CONFLICT: '#f97316', // Orange
});

export const GitGutterType = Object.freeze({
  ADDED: 'added',
  MODIFIED: 'modified',
  DELETED: 'deleted',
});
