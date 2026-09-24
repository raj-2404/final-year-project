import { describe, it, expect } from 'vitest';
import { Protocol } from '../src/server/Protocol.js';

describe('Protocol validation', () => {
  it('validates auth message', () => {
    const raw = JSON.stringify({ type: 'auth', token: 'valid-token-123' });
    const parsed = Protocol.parseClientMessage(raw);

    expect(parsed.type).toBe('auth');
    if (parsed.type === 'auth') {
      expect(parsed.token).toBe('valid-token-123');
    }
  });

  it('rejects auth message with missing token', () => {
    const raw = JSON.stringify({ type: 'auth' });
    expect(() => Protocol.parseClientMessage(raw)).toThrow();
  });

  it('validates terminal.create with defaults', () => {
    const raw = JSON.stringify({ type: 'terminal.create' });
    const parsed = Protocol.parseClientMessage(raw);

    expect(parsed.type).toBe('terminal.create');
    if (parsed.type === 'terminal.create') {
      expect(parsed.cols).toBe(120);
      expect(parsed.rows).toBe(30);
    }
  });

  it('validates terminal.create with custom options', () => {
    const raw = JSON.stringify({
      type: 'terminal.create',
      cwd: '/tmp',
      shell: 'zsh',
      cols: 100,
      rows: 40,
    });
    const parsed = Protocol.parseClientMessage(raw);

    expect(parsed.type).toBe('terminal.create');
    if (parsed.type === 'terminal.create') {
      expect(parsed.cwd).toBe('/tmp');
      expect(parsed.shell).toBe('zsh');
      expect(parsed.cols).toBe(100);
      expect(parsed.rows).toBe(40);
    }
  });

  it('validates terminal.input', () => {
    const raw = JSON.stringify({
      type: 'terminal.input',
      terminalId: 'term-123',
      data: 'ls -la\n',
    });
    const parsed = Protocol.parseClientMessage(raw);

    expect(parsed.type).toBe('terminal.input');
    if (parsed.type === 'terminal.input') {
      expect(parsed.terminalId).toBe('term-123');
      expect(parsed.data).toBe('ls -la\n');
    }
  });

  it('validates terminal.resize', () => {
    const raw = JSON.stringify({
      type: 'terminal.resize',
      terminalId: 'term-123',
      cols: 80,
      rows: 24,
    });
    const parsed = Protocol.parseClientMessage(raw);

    expect(parsed.type).toBe('terminal.resize');
    if (parsed.type === 'terminal.resize') {
      expect(parsed.terminalId).toBe('term-123');
      expect(parsed.cols).toBe(80);
      expect(parsed.rows).toBe(24);
    }
  });

  it('rejects terminal.resize with negative dimensions', () => {
    const raw = JSON.stringify({
      type: 'terminal.resize',
      terminalId: 'term-123',
      cols: -10,
      rows: 24,
    });
    expect(() => Protocol.parseClientMessage(raw)).toThrow();
  });

  it('validates terminal.kill and terminal.close', () => {
    const rawKill = JSON.stringify({ type: 'terminal.kill', terminalId: 'term-abc' });
    const parsedKill = Protocol.parseClientMessage(rawKill);
    expect(parsedKill.type).toBe('terminal.kill');

    const rawClose = JSON.stringify({ type: 'terminal.close', terminalId: 'term-abc' });
    const parsedClose = Protocol.parseClientMessage(rawClose);
    expect(parsedClose.type).toBe('terminal.close');
  });

  it('validates ping message', () => {
    const raw = JSON.stringify({ type: 'ping' });
    const parsed = Protocol.parseClientMessage(raw);
    expect(parsed.type).toBe('ping');
  });

  it('rejects unknown message type', () => {
    const raw = JSON.stringify({ type: 'unknown.action' });
    expect(() => Protocol.parseClientMessage(raw)).toThrow();
  });

  it('serializes server messages correctly', () => {
    const out = Protocol.serializeServerMessage({
      type: 'terminal.output',
      terminalId: 't1',
      data: 'hello world',
    });
    expect(JSON.parse(out)).toEqual({
      type: 'terminal.output',
      terminalId: 't1',
      data: 'hello world',
    });
  });
});
