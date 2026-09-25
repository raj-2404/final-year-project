/**
 * CodeX Debugger Types & Constants
 * Level 3B — Debugging Architecture
 */

export const DebugSessionState = {
  STOPPED: 'stopped',
  STARTING: 'starting',
  RUNNING: 'running',
  PAUSED: 'paused',
  STOPPING: 'stopping',
};

export const BreakpointStatus = {
  PENDING: 'pending',
  VERIFIED: 'verified',
  UNVERIFIED: 'unverified',
};

export const DebugAdapterType = {
  NODE: 'node',
  PYTHON: 'python',
  CPP: 'cpp',
  RUST: 'rust',
  GO: 'go',
};

export const SteppingType = {
  CONTINUE: 'continue',
  PAUSE: 'pause',
  STEP_OVER: 'next',
  STEP_INTO: 'stepIn',
  STEP_OUT: 'stepOut',
};
