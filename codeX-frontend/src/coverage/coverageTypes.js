/**
 * CodeX Code Coverage Types & Definitions
 * Level 3E — Code Coverage & Test Intelligence
 */

export const CoverageLifecycleState = {
  IDLE: 'IDLE',
  CONFIGURING: 'CONFIGURING',
  RUNNING: 'RUNNING',
  PARSING: 'PARSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  ERROR: 'ERROR',
};

export const CoverageStatus = {
  COVERED: 'COVERED',
  PARTIAL: 'PARTIAL',
  UNCOVERED: 'UNCOVERED',
  UNKNOWN: 'UNKNOWN',
};

export const CoverageFormat = {
  LCOV: 'LCOV',
  JSON_SUMMARY: 'JSON_SUMMARY',
  JSON_ISTANBUL: 'JSON_ISTANBUL',
  JACOCO_XML: 'JACOCO_XML',
  COBERTURA_XML: 'COBERTURA_XML',
  GO_COVER: 'GO_COVER',
  UNKNOWN: 'UNKNOWN',
};

export const CoverageMetricType = {
  LINES: 'lines',
  STATEMENTS: 'statements',
  FUNCTIONS: 'functions',
  BRANCHES: 'branches',
};

export const DefaultCoverageThresholds = {
  statements: 80,
  branches: 80,
  functions: 80,
  lines: 80,
};
