import os from 'os';
import path from 'path';
import fs from 'fs';

export class Paths {
  /**
   * Returns the configuration directory for the current operating system.
   * macOS/Linux: ~/.codex-agent
   * Windows: %APPDATA%\codex-agent (or ~/.codex-agent if APPDATA is unset)
   */
  public static getConfigDir(): string {
    const isWindows = process.platform === 'win32';
    if (isWindows && process.env.APPDATA) {
      return path.join(process.env.APPDATA, 'codex-agent');
    }
    return path.join(os.homedir(), '.codex-agent');
  }

  public static getConfigFile(): string {
    return path.join(this.getConfigDir(), 'config.json');
  }

  public static getTokenFile(): string {
    return path.join(this.getConfigDir(), 'token');
  }

  public static getPidFile(): string {
    return path.join(this.getConfigDir(), 'agent.pid');
  }

  public static ensureConfigDir(): string {
    const dir = this.getConfigDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    } else {
      // Ensure private permissions on Unix
      if (process.platform !== 'win32') {
        try {
          fs.chmodSync(dir, 0o700);
        } catch {
          // ignore permission errors on non-posix or restricted fs
        }
      }
    }
    return dir;
  }
}
