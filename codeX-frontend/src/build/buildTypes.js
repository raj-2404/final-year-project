/**
 * CodeX Build & Run Types & State Definitions
 * Level 3C — Build & Run Architecture
 */

export const BuildProcessState = {
  IDLE: 'IDLE',
  STARTING: 'STARTING',
  RUNNING: 'RUNNING',
  STOPPING: 'STOPPING',
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED',
  TERMINATED: 'TERMINATED',
};

export const TaskType = {
  BUILD: 'build',
  RUN: 'run',
  RUN_FILE: 'run_file',
};

export const PackageManager = {
  NPM: 'npm',
  PNPM: 'pnpm',
  YARN: 'yarn',
  BUN: 'bun',
};

export const ProjectType = {
  NODE: 'node',
  PYTHON: 'python',
  RUST: 'rust',
  GO: 'go',
  JAVA_MAVEN: 'java_maven',
  JAVA_GRADLE: 'java_gradle',
  CMAKE: 'cmake',
  MAKE: 'make',
  GENERIC: 'generic',
};
