export { AgentServer, AgentServerOptions } from './server/WebSocketServer.js';
export { AuthManager } from './server/AuthManager.js';
export { ConfigManager, AgentConfig, DEFAULT_CONFIG } from './config/ConfigManager.js';
export { TerminalManager, TerminalManagerOptions } from './terminal/TerminalManager.js';
export { TerminalSession } from './terminal/TerminalSession.js';
export { PtyFactory, PtySpawnOptions, PtySpawnResult } from './terminal/PtyFactory.js';
export { ShellResolver, ResolvedShell } from './platform/ShellResolver.js';
export { Environment } from './platform/Environment.js';
export { Paths } from './platform/Paths.js';
export { logger } from './logger/Logger.js';
export {
  Protocol,
  ClientMessage,
  ServerMessage,
  AuthMessage,
  TerminalCreateMessage,
  TerminalInputMessage,
  TerminalResizeMessage,
  TerminalKillMessage,
  TerminalCloseMessage,
  PingMessage,
  AuthSuccessMessage,
  AuthErrorMessage,
  TerminalCreatedMessage,
  TerminalOutputMessage,
  TerminalExitMessage,
  TerminalErrorMessage,
  PongMessage,
} from './server/Protocol.js';
export { createCli } from './cli/index.js';
