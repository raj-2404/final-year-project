import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import WebSocket from 'ws';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { AgentServer } from '../src/server/WebSocketServer.js';
import { AuthManager } from '../src/server/AuthManager.js';
import { TerminalManager } from '../src/terminal/TerminalManager.js';

describe('AgentServer Integration over WebSocket', () => {
  let server: AgentServer;
  let authManager: AuthManager;
  let tempDir: string;
  let tokenFile: string;
  const testPort = 17777;
  const testHost = '127.0.0.1';

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-integ-test-'));
    tokenFile = path.join(tempDir, 'test-token');
    authManager = new AuthManager(tokenFile);

    server = new AgentServer({
      host: testHost,
      port: testPort,
      authManager,
      terminalManager: new TerminalManager({ maxSessions: 5 }),
    });

    await server.start();
  });

  afterAll(async () => {
    await server.stop();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('rejects connection when authentication fails', async () => {
    const ws = new WebSocket(`ws://${testHost}:${testPort}`);

    const authFailedPromise = new Promise<{ code: number; reason: string }>((resolve) => {
      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'auth', token: 'wrong-token' }));
      });

      ws.on('close', (code, reason) => {
        resolve({ code, reason: reason.toString() });
      });
    });

    const result = await authFailedPromise;
    expect(result.code).toBe(4401);
  });

  it('authenticates, executes command, receives output, and exits', async () => {
    const ws = new WebSocket(`ws://${testHost}:${testPort}`);

    await new Promise<void>((resolve) => {
      ws.on('open', () => resolve());
    });

    // 1. Authenticate
    ws.send(JSON.stringify({ type: 'auth', token: authManager.getToken() }));

    const authSuccess = await new Promise<boolean>((resolve) => {
      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'auth.success') resolve(true);
      });
    });
    expect(authSuccess).toBe(true);

    // 2. Ping / Pong
    ws.send(JSON.stringify({ type: 'ping' }));
    const pongSuccess = await new Promise<boolean>((resolve) => {
      const handler = (raw: WebSocket.RawData) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'pong') {
          ws.off('message', handler);
          resolve(true);
        }
      };
      ws.on('message', handler);
    });
    expect(pongSuccess).toBe(true);

    // 3. Create Terminal Session
    ws.send(
      JSON.stringify({
        type: 'terminal.create',
        cwd: os.homedir(),
        cols: 80,
        rows: 24,
      })
    );

    const createdMsg = await new Promise<any>((resolve) => {
      const handler = (raw: WebSocket.RawData) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'terminal.created') {
          ws.off('message', handler);
          resolve(msg);
        }
      };
      ws.on('message', handler);
    });

    expect(createdMsg.terminalId).toBeDefined();
    expect(createdMsg.cwd).toBe(os.homedir());
    const termId = createdMsg.terminalId;

    // 4. Send command and capture output
    let captured = '';
    const outputPromise = new Promise<string>((resolve) => {
      const handler = (raw: WebSocket.RawData) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'terminal.output' && msg.terminalId === termId) {
          captured += msg.data;
          if (captured.includes('INTEG_ECHO_TEST')) {
            ws.off('message', handler);
            resolve(captured);
          }
        }
      };
      ws.on('message', handler);

      // Write command after small delay
      setTimeout(() => {
        ws.send(
          JSON.stringify({
            type: 'terminal.input',
            terminalId: termId,
            data: 'echo INTEG_ECHO_TEST\r',
          })
        );
      }, 300);
    });

    const output = await outputPromise;
    expect(output).toContain('INTEG_ECHO_TEST');

    // 5. Resize terminal
    ws.send(
      JSON.stringify({
        type: 'terminal.resize',
        terminalId: termId,
        cols: 100,
        rows: 30,
      })
    );

    // 6. Kill terminal
    ws.send(
      JSON.stringify({
        type: 'terminal.kill',
        terminalId: termId,
      })
    );

    ws.close();
  });
});
