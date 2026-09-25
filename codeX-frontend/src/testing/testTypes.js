/**
 * CodeX Test Runner Types & Definitions
 * Level 3D — Test Runner Architecture
 */

export const TestLifecycleState = {
  IDLE: 'IDLE',
  DISCOVERING: 'DISCOVERING',
  READY: 'READY',
  RUNNING: 'RUNNING',
  STOPPING: 'STOPPING',
  PASSED: 'PASSED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  ERROR: 'ERROR',
};

export const TestStatus = {
  UNKNOWN: 'UNKNOWN',
  DISCOVERING: 'DISCOVERING',
  RUNNING: 'RUNNING',
  PASSED: 'PASSED',
  FAILED: 'FAILED',
  SKIPPED: 'SKIPPED',
  TODO: 'TODO',
  CANCELLED: 'CANCELLED',
};

export const TestNodeType = {
  PROJECT: 'project',
  SUITE: 'suite',
  FILE: 'file',
  TEST: 'test',
  GROUP: 'group',
};

export const TestFramework = {
  VITEST: 'vitest',
  JEST: 'jest',
  MOCHA: 'mocha',
  PYTEST: 'pytest',
  UNITTEST: 'unittest',
  JUNIT_MAVEN: 'junit_maven',
  JUNIT_GRADLE: 'junit_gradle',
  CARGO_TEST: 'cargo_test',
  GO_TEST: 'go_test',
  CTEST: 'ctest',
  CUSTOM: 'custom',
};
