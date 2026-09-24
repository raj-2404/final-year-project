import { WebSocketServer as WSServer, WebSocket } from 'ws';
import { IncomingMessage, Server } from 'http';
import http from 'http';
import url from 'url';
import fs from 'fs';
import { AuthManager } from './AuthManager.js';
import { Protocol, ClientMessage, ServerMessage } from './Protocol.js';
import { TerminalManager } from '../terminal/TerminalManager.js';
import { logger } from '../logger/Logger.js';
import { Paths } from '../platform/Paths.js';

export interface AgentServerOptions {
  host?: string;
  port?: number;
  authManager?: AuthManager;
  terminalManager?: TerminalManager;
  disconnectGracePeriod?: number; // ms
}

interface AuthenticatedSocketState {
  authenticated: boolean;
  authTimer: NodeJS.Timeout | null;
  terminalIds: Set<string>;
}

export class AgentServer {
  public readonly host: string;
  public readonly port: number;

  private httpServer: Server | null = null;
  private wss: WSServer | null = null;
  private authManager: AuthManager;
  private terminalManager: TerminalManager;
  private socketStates: Map<WebSocket, AuthenticatedSocketState> = new Map();
  private disconnectGracePeriod: number;
  private running = false;

  constructor(options: AgentServerOptions = {}) {
    this.host = options.host || '127.0.0.1';
    this.port = options.port || 7777;
    this.authManager = options.authManager || new AuthManager();
    this.terminalManager = options.terminalManager || new TerminalManager();
    this.disconnectGracePeriod = options.disconnectGracePeriod ?? 60000;
  }

  public getAuthManager(): AuthManager {
    return this.authManager;
  }

  public getTerminalManager(): TerminalManager {
    return this.terminalManager;
  }

  public isRunning(): boolean {
    return this.running;
  }

  public async start(): Promise<{ host: string; port: number }> {
    if (this.running) {
      return { host: this.host, port: this.port };
    }

    return new Promise((resolve, reject) => {
      try {
        // Create HTTP server bound to loopback only
        this.httpServer = http.createServer((req, res) => {
          // Security: no general HTTP endpoint to run commands or read files
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'CodeX Agent accepts WebSocket connections only' }));
        });

        this.wss = new WSServer({ noServer: true });

        // Handle HTTP upgrade to WebSocket
        this.httpServer.on('upgrade', (req: IncomingMessage, socket, head) => {
          this.handleUpgrade(req, socket, head);
        });

        this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
          this.handleConnection(ws, req);
        });

        this.httpServer.on('error', (err: any) => {
          logger.error({ err }, 'Agent HTTP server encountered error');
          reject(err);
        });

        this.httpServer.listen(this.port, this.host, () => {
          this.running = true;
          this.writePidFile();
          logger.info(`CodeX Terminal Agent started on ${this.host}:${this.port}`);
          resolve({ host: this.host, port: this.port });
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  public async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;

    logger.info('Stopping CodeX Terminal Agent...');

    // 1. Close all active sockets
    for (const [ws, state] of this.socketStates.entries()) {
      if (state.authTimer) {
        clearTimeout(state.authTimer);
      }
      try {
        ws.close(1001, 'Agent stopping');
      } catch {}
    }
    this.socketStates.clear();

    // 2. Terminate all terminal sessions
    this.terminalManager.disposeAll();

    // 3. Close WebSocket server
    if (this.wss) {
      try {
        this.wss.close();
      } catch {}
      this.wss = null;
    }

    // 4. Close HTTP server
    if (this.httpServer) {
      await new Promise<void>((res) => {
        this.httpServer?.close(() => res());
      });
      this.httpServer = null;
    }

    // 5. Remove PID file
    this.removePidFile();
    logger.info('CodeX Terminal Agent stopped');
  }

  private handleUpgrade(req: IncomingMessage, socket: any, head: Buffer): void {
    // Check if token was passed in query parameter
    const hostHeader = req.headers.host || `${this.host}:${this.port}`;
    const parsedUrl = new URL(req.url || '/', `http://${hostHeader}`);
    const tokenQuery = parsedUrl.searchParams.get('token') || undefined;

    // Check Authorization header
    let tokenHeader: string | undefined;
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      tokenHeader = authHeader.substring(7).trim();
    }

    const candidateToken = tokenQuery || tokenHeader;
    const preAuthenticated = candidateToken ? this.authManager.validateToken(candidateToken) : false;

    this.wss?.handleUpgrade(req, socket, head, (ws) => {
      (ws as any)._preAuthenticated = preAuthenticated;
      this.wss?.emit('connection', ws, req);
    });
  }

  private handleConnection(ws: WebSocket, req: IncomingMessage): void {
    const isPreAuth = Boolean((ws as any)._preAuthenticated);

    const state: AuthenticatedSocketState = {
      authenticated: isPreAuth,
      authTimer: null,
      terminalIds: new Set(),
    };

    this.socketStates.set(ws, state);

    if (isPreAuth) {
      logger.info('Client connected and authenticated via handshake token');
      this.send(ws, { type: 'auth.success' });
    } else {
      logger.info('Client connected, awaiting auth message');
      // Set 5-second auth timeout
      state.authTimer = setTimeout(() => {
        if (!state.authenticated && ws.readyState === WebSocket.OPEN) {
          logger.warn('Client authentication timed out, closing connection');
          this.send(ws, { type: 'auth.error', message: 'Authentication timeout' });
          ws.close(4401, 'Authentication timeout');
        }
      }, 5000);
    }

    ws.on('message', (data: Buffer | string) => {
      this.handleSocketMessage(ws, data.toString());
    });

    ws.on('close', (code, reason) => {
      this.handleSocketClose(ws, code, reason ? reason.toString() : '');
    });

    ws.on('error', (err) => {
      logger.warn({ err }, 'WebSocket client connection error');
    });
  }

  private handleSocketMessage(ws: WebSocket, raw: string): void {
    const state = this.socketStates.get(ws);
    if (!state) return;

    let msg: ClientMessage;
    try {
      msg = Protocol.parseClientMessage(raw);
    } catch (err: any) {
      logger.warn({ err: err.message }, 'Received malformed message from client');
      this.send(ws, {
        type: 'terminal.error',
        message: `Invalid message format: ${err.message || 'Validation error'}`,
      });
      return;
    }

    // 1. Handle AUTH message
    if (msg.type === 'auth') {
      if (this.authManager.validateToken(msg.token)) {
        state.authenticated = true;
        if (state.authTimer) {
          clearTimeout(state.authTimer);
          state.authTimer = null;
        }
        logger.info('Client authenticated successfully via auth message');
        this.send(ws, { type: 'auth.success' });
      } else {
        logger.warn('Client authentication failed: invalid token');
        this.send(ws, { type: 'auth.error', message: 'Invalid authentication token' });
        ws.close(4401, 'Invalid authentication token');
      }
      return;
    }

    // 2. Handle PING
    if (msg.type === 'ping') {
      this.send(ws, { type: 'pong' });
      return;
    }

    // Security Gate: Reject all terminal actions if unauthenticated
    if (!state.authenticated) {
      logger.warn({ type: msg.type }, 'Rejected unauthenticated terminal action');
      this.send(ws, {
        type: 'terminal.error',
        message: 'Unauthorized. You must authenticate before accessing the terminal.',
      });
      ws.close(4401, 'Unauthorized');
      return;
    }

    // 3. Handle TERMINAL CREATE
    if (msg.type === 'terminal.create') {
      try {
        const session = this.terminalManager.createSession(
          {
            cwd: msg.cwd,
            shell: msg.shell,
            cols: msg.cols,
            rows: msg.rows,
          },
          // PTY Output handler
          (termId: string, outData: string) => {
            if (ws.readyState === WebSocket.OPEN) {
              this.send(ws, {
                type: 'terminal.output',
                terminalId: termId,
                data: outData,
              });
            }
          },
          // PTY Exit handler
          (termId: string, exitCode: number, signal?: number) => {
            state.terminalIds.delete(termId);
            if (ws.readyState === WebSocket.OPEN) {
              this.send(ws, {
                type: 'terminal.exit',
                terminalId: termId,
                exitCode,
                signal: signal ?? null,
              });
            }
          }
        );

        state.terminalIds.add(session.terminalId);

        this.send(ws, {
          type: 'terminal.created',
          terminalId: session.terminalId,
          cwd: session.cwd,
          shell: session.shell,
        });
      } catch (err: any) {
        logger.error({ err }, 'Failed to create terminal session');
        this.send(ws, {
          type: 'terminal.error',
          message: err.message || 'Failed to create terminal session',
        });
      }
      return;
    }

    // 4. Handle TERMINAL INPUT
    if (msg.type === 'terminal.input') {
      try {
        this.terminalManager.write(msg.terminalId, msg.data);
      } catch (err: any) {
        this.send(ws, {
          type: 'terminal.error',
          terminalId: msg.terminalId,
          message: err.message || 'Failed to write input to terminal',
        });
      }
      return;
    }

    // 5. Handle TERMINAL RESIZE
    if (msg.type === 'terminal.resize') {
      try {
        this.terminalManager.resize(msg.terminalId, msg.cols, msg.rows);
      } catch (err: any) {
        this.send(ws, {
          type: 'terminal.error',
          terminalId: msg.terminalId,
          message: err.message || 'Failed to resize terminal',
        });
      }
      return;
    }

    // 6. Handle TERMINAL KILL / CLOSE
    if (msg.type === 'terminal.kill' || msg.type === 'terminal.close') {
      const killed = this.terminalManager.kill(msg.terminalId);
      state.terminalIds.delete(msg.terminalId);
      if (!killed) {
        this.send(ws, {
          type: 'terminal.error',
          terminalId: msg.terminalId,
          message: `Terminal session ${msg.terminalId} not found or already closed`,
        });
      }
      return;
    }
  }

  private handleSocketClose(ws: WebSocket, code: number, reason: string): void {
    const state = this.socketStates.get(ws);
    if (!state) return;

    if (state.authTimer) {
      clearTimeout(state.authTimer);
    }

    const ownedTerminalIds = Array.from(state.terminalIds);
    this.socketStates.delete(ws);

    logger.info({ code, reason, sessionsCount: ownedTerminalIds.length }, 'WebSocket client disconnected');

    // If client disconnected, give a grace period before disposing their terminal sessions
    // This allows browser page reload without terminating active long-running jobs!
    if (ownedTerminalIds.length > 0) {
      setTimeout(() => {
        // If the session is still active and no other socket claimed it, terminate it
        for (const termId of ownedTerminalIds) {
          const isStillClaimed = Array.from(this.socketStates.values()).some((s) => s.terminalIds.has(termId));
          if (!isStillClaimed) {
            const session = this.terminalManager.get(termId);
            if (session) {
              logger.info({ terminalId: termId }, 'Cleaning up abandoned terminal session after grace period');
              this.terminalManager.kill(termId);
            }
          }
        }
      }, this.disconnectGracePeriod);
    }
  }

  private send(ws: WebSocket, msg: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(Protocol.serializeServerMessage(msg));
    }
  }

  private writePidFile(): void {
    try {
      Paths.ensureConfigDir();
      fs.writeFileSync(Paths.getPidFile(), process.pid.toString(), {
        mode: 0o600,
        encoding: 'utf8',
      });
    } catch (err) {
      logger.warn({ err }, 'Failed to write agent PID file');
    }
  }

  private removePidFile(): void {
    try {
      const pidFile = Paths.getPidFile();
      if (fs.existsSync(pidFile)) {
        fs.unlinkSync(pidFile);
      }
    } catch {}
  }
}
