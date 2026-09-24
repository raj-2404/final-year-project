import { describe, it, expect } from 'vitest';
import fs from 'fs';
import { ShellResolver } from '../src/platform/ShellResolver.js';

describe('ShellResolver', () => {
  it('resolves the default shell for the current operating system', () => {
    const shell = ShellResolver.resolveDefaultShell();
    expect(shell).toBeDefined();
    expect(shell.executable).toBeDefined();
    expect(typeof shell.executable).toBe('string');
    expect(Array.isArray(shell.args)).toBe(true);

    if (process.platform === 'darwin' || process.platform === 'linux') {
      expect(fs.existsSync(shell.executable)).toBe(true);
    }
  });

  it('resolves standard whitelisted shell requests', () => {
    const defaultShell = ShellResolver.resolveShell('default');
    expect(defaultShell).toBeDefined();

    if (process.platform === 'darwin' || process.platform === 'linux') {
      const zshShell = ShellResolver.resolveShell('zsh');
      expect(zshShell.executable).toMatch(/(zsh|bash|sh)/);

      const bashShell = ShellResolver.resolveShell('bash');
      expect(bashShell.executable).toMatch(/(bash|sh|zsh)/);
    }
  });

  it('rejects arbitrary executable paths for security', () => {
    expect(() => ShellResolver.resolveShell('/usr/bin/curl')).toThrow(
      /Requested shell.*is not permitted/
    );
    expect(() => ShellResolver.resolveShell('node')).toThrow(
      /Requested shell.*is not permitted/
    );
    expect(() => ShellResolver.resolveShell('python3')).toThrow(
      /Requested shell.*is not permitted/
    );
    expect(() => ShellResolver.resolveShell('../../malicious.sh')).toThrow(
      /Requested shell.*is not permitted/
    );
  });
});
