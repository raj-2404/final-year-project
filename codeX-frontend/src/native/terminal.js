import { isDesktopApp } from './environment';

/**
 * Native Terminal Abstraction (Phase 3 Foundation).
 * Prepares the architecture for native PTY sessions.
 */

export function isNativeTerminalSupported() {
  return isDesktopApp();
}

export async function createTerminalSession(_options = {}) {
  // Phase 3 will hook into native PTY or codex-agent
  return null;
}
