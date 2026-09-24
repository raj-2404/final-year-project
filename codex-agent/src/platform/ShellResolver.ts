import fs from 'fs';
import path from 'path';

export interface ResolvedShell {
  executable: string;
  args: string[];
}

export class ShellResolver {
  private static readonly ALLOWED_SHELL_NAMES = new Set([
    'default',
    'zsh',
    'bash',
    'sh',
    'powershell',
    'pwsh',
    'cmd',
  ]);

  /**
   * Resolves the default interactive shell for the current operating system.
   */
  public static resolveDefaultShell(): ResolvedShell {
    const platform = process.platform;

    if (platform === 'win32') {
      return this.resolveWindowsShell();
    } else if (platform === 'darwin') {
      return this.resolveMacShell();
    } else {
      return this.resolveLinuxShell();
    }
  }

  /**
   * Validates and resolves a requested shell string from the frontend.
   * If requested is 'default' or undefined, returns the OS default shell.
   * Disallows arbitrary executable paths.
   */
  public static resolveShell(requested?: string): ResolvedShell {
    if (!requested || requested.trim().toLowerCase() === 'default') {
      return this.resolveDefaultShell();
    }

    const normalized = requested.trim().toLowerCase();
    const baseName = path.basename(normalized).replace(/\.exe$/i, '');

    if (!this.ALLOWED_SHELL_NAMES.has(baseName)) {
      throw new Error(`Requested shell '${requested}' is not permitted. Only standard shells are supported.`);
    }

    const platform = process.platform;
    if (platform === 'win32') {
      if (baseName === 'powershell' || baseName === 'pwsh') {
        return { executable: this.findInWinSystem32('WindowsPowerShell\\v1.0\\powershell.exe') || 'powershell.exe', args: ['-NoLogo'] };
      }
      if (baseName === 'cmd') {
        return { executable: process.env.COMSPEC || 'cmd.exe', args: [] };
      }
      return this.resolveWindowsShell();
    }

    // Unix shells (macOS / Linux)
    const candidates = [
      `/bin/${baseName}`,
      `/usr/bin/${baseName}`,
      `/usr/local/bin/${baseName}`,
      `/opt/homebrew/bin/${baseName}`,
    ];

    for (const cand of candidates) {
      if (fs.existsSync(cand) && this.isExecutable(cand)) {
        return { executable: cand, args: ['-l'] }; // Login shell for environment loading
      }
    }

    // Fallback to default if named shell not found
    return this.resolveDefaultShell();
  }

  private static resolveMacShell(): ResolvedShell {
    const envShell = process.env.SHELL;
    if (envShell && fs.existsSync(envShell) && this.isExecutable(envShell)) {
      return { executable: envShell, args: ['-l'] };
    }

    const candidates = ['/bin/zsh', '/bin/bash', '/bin/sh'];
    for (const cand of candidates) {
      if (fs.existsSync(cand) && this.isExecutable(cand)) {
        return { executable: cand, args: ['-l'] };
      }
    }

    return { executable: '/bin/zsh', args: ['-l'] };
  }

  private static resolveLinuxShell(): ResolvedShell {
    const envShell = process.env.SHELL;
    if (envShell && fs.existsSync(envShell) && this.isExecutable(envShell)) {
      return { executable: envShell, args: ['-l'] };
    }

    const candidates = ['/bin/bash', '/usr/bin/bash', '/bin/zsh', '/bin/sh'];
    for (const cand of candidates) {
      if (fs.existsSync(cand) && this.isExecutable(cand)) {
        return { executable: cand, args: ['-l'] };
      }
    }

    return { executable: '/bin/sh', args: ['-l'] };
  }

  private static resolveWindowsShell(): ResolvedShell {
    const systemRoot = process.env.SystemRoot || 'C:\\Windows';
    const powershellPath = path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');

    if (fs.existsSync(powershellPath)) {
      return { executable: powershellPath, args: ['-NoLogo'] };
    }

    if (process.env.COMSPEC && fs.existsSync(process.env.COMSPEC)) {
      return { executable: process.env.COMSPEC, args: [] };
    }

    return { executable: 'powershell.exe', args: ['-NoLogo'] };
  }

  private static findInWinSystem32(relativePath: string): string | null {
    const systemRoot = process.env.SystemRoot || 'C:\\Windows';
    const fullPath = path.join(systemRoot, 'System32', relativePath);
    return fs.existsSync(fullPath) ? fullPath : null;
  }

  private static isExecutable(filePath: string): boolean {
    try {
      fs.accessSync(filePath, fs.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  }
}
