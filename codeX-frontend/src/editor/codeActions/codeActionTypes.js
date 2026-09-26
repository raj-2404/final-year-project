/**
 * CodeX Code Action & Refactoring Types
 * Level 3F — Refactoring & Code Actions
 */

export const CodeActionKind = {
  Empty: '',
  QuickFix: 'quickfix',
  Refactor: 'refactor',
  RefactorExtract: 'refactor.extract',
  RefactorInline: 'refactor.inline',
  RefactorRewrite: 'refactor.rewrite',
  Source: 'source',
  SourceOrganizeImports: 'source.organizeImports',
  SourceFixAll: 'source.fixAll',
};

export const CodeActionTriggerKind = {
  Invoke: 1,
  Automatic: 2,
};

export const EditOperationType = {
  TEXT_EDIT: 'text_edit',
  CREATE_FILE: 'create_file',
  RENAME_FILE: 'rename_file',
  DELETE_FILE: 'delete_file',
};

export const TransactionState = {
  IDLE: 'IDLE',
  PENDING_CONFIRMATION: 'PENDING_CONFIRMATION',
  APPLYING: 'APPLYING',
  APPLIED: 'APPLIED',
  ROLLED_BACK: 'ROLLED_BACK',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
};
