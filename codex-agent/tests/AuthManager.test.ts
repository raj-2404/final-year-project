import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { AuthManager } from '../src/server/AuthManager.js';

describe('AuthManager', () => {
  let tempDir: string;
  let tokenFile: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-auth-test-'));
    tokenFile = path.join(tempDir, 'test-token');
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('generates a secure 64-character hex token on first startup', () => {
    const auth = new AuthManager(tokenFile);
    const token = auth.getToken();

    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    expect(token.length).toBe(64);
    expect(fs.existsSync(tokenFile)).toBe(true);
    expect(fs.readFileSync(tokenFile, 'utf8').trim()).toBe(token);
  });

  it('persists and reloads the existing token on subsequent runs', () => {
    const auth1 = new AuthManager(tokenFile);
    const token1 = auth1.getToken();

    const auth2 = new AuthManager(tokenFile);
    const token2 = auth2.getToken();

    expect(token1).toBe(token2);
  });

  it('validates a correct authentication token', () => {
    const auth = new AuthManager(tokenFile);
    const validToken = auth.getToken();

    expect(auth.validateToken(validToken)).toBe(true);
  });

  it('rejects an invalid authentication token', () => {
    const auth = new AuthManager(tokenFile);

    expect(auth.validateToken('invalid-token-here-12345678901234567890123456789012')).toBe(false);
    expect(auth.validateToken('')).toBe(false);
    expect(auth.validateToken(undefined)).toBe(false);
    expect(auth.validateToken(null as any)).toBe(false);
    expect(auth.validateToken('short')).toBe(false);
  });

  it('regenerates a new token when requested', () => {
    const auth = new AuthManager(tokenFile);
    const token1 = auth.getToken();

    const token2 = auth.regenerateToken();
    expect(token1).not.toBe(token2);
    expect(auth.validateToken(token2)).toBe(true);
    expect(auth.validateToken(token1)).toBe(false);
  });
});
