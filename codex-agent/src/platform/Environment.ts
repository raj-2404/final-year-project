import os from 'os';
import path from 'path';

export class Environment {
  /**
   * Builds an interactive terminal environment inheriting the user's real shell environment.
   */
  public static getPtyEnvironment(customEnv?: Record<string, string>): Record<string, string> {
    const inherited: Record<string, string> = {};

    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        inherited[key] = value;
      }
    }

    // Ensure essential terminal emulator variables
    inherited.TERM = inherited.TERM || 'xterm-256color';
    inherited.COLORTERM = inherited.COLORTERM || 'truecolor';
    inherited.LANG = inherited.LANG || 'en_US.UTF-8';

    // On macOS / Linux, ensure standard PATH binaries are accessible
    if (process.platform === 'darwin') {
      const standardPaths = [
        '/opt/homebrew/bin',
        '/opt/homebrew/sbin',
        '/usr/local/bin',
        '/usr/bin',
        '/bin',
        '/usr/sbin',
        '/sbin',
      ];
      const existingPaths = (inherited.PATH || '').split(path.delimiter);
      const combined = [...new Set([...existingPaths, ...standardPaths])].filter(Boolean);
      inherited.PATH = combined.join(path.delimiter);
    } else if (process.platform === 'linux') {
      const standardPaths = ['/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin'];
      const existingPaths = (inherited.PATH || '').split(path.delimiter);
      const combined = [...new Set([...existingPaths, ...standardPaths])].filter(Boolean);
      inherited.PATH = combined.join(path.delimiter);
    }

    if (!inherited.HOME) {
      inherited.HOME = os.homedir();
    }

    if (customEnv) {
      Object.assign(inherited, customEnv);
    }

    return inherited;
  }
}
