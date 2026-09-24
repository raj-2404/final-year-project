import fs from 'fs';
import { Paths } from '../platform/Paths.js';
import { logger } from '../logger/Logger.js';

export interface AgentConfig {
  host: string;
  port: number;
  auth: {
    tokenFile: string;
  };
  terminal: {
    maxSessions: number;
    idleTimeout: number; // in milliseconds (default 30 mins)
    disconnectGracePeriod: number; // in milliseconds (default 60s to allow reconnects)
  };
}

export const DEFAULT_CONFIG: AgentConfig = {
  host: '127.0.0.1',
  port: 7777,
  auth: {
    tokenFile: Paths.getTokenFile(),
  },
  terminal: {
    maxSessions: 10,
    idleTimeout: 1800000,
    disconnectGracePeriod: 60000,
  },
};

export class ConfigManager {
  private config: AgentConfig;

  constructor() {
    this.config = this.loadConfig();
  }

  public getConfig(): AgentConfig {
    return { ...this.config };
  }

  public getHost(): string {
    return this.config.host;
  }

  public getPort(): number {
    return this.config.port;
  }

  public getMaxSessions(): number {
    return this.config.terminal.maxSessions;
  }

  public getIdleTimeout(): number {
    return this.config.terminal.idleTimeout;
  }

  public getDisconnectGracePeriod(): number {
    return this.config.terminal.disconnectGracePeriod;
  }

  public updateConfig(partial: Partial<AgentConfig>): AgentConfig {
    this.config = {
      ...this.config,
      ...partial,
      auth: { ...this.config.auth, ...(partial.auth || {}) },
      terminal: { ...this.config.terminal, ...(partial.terminal || {}) },
    };
    this.saveConfig();
    return this.getConfig();
  }

  private loadConfig(): AgentConfig {
    Paths.ensureConfigDir();
    const configFile = Paths.getConfigFile();

    if (!fs.existsSync(configFile)) {
      this.saveConfigDirect(DEFAULT_CONFIG);
      return { ...DEFAULT_CONFIG };
    }

    try {
      const raw = fs.readFileSync(configFile, 'utf8');
      const parsed = JSON.parse(raw);
      return {
        host: parsed.host || DEFAULT_CONFIG.host,
        port: Number(parsed.port) || DEFAULT_CONFIG.port,
        auth: {
          tokenFile: parsed.auth?.tokenFile || DEFAULT_CONFIG.auth.tokenFile,
        },
        terminal: {
          maxSessions: Number(parsed.terminal?.maxSessions) || DEFAULT_CONFIG.terminal.maxSessions,
          idleTimeout: Number(parsed.terminal?.idleTimeout) || DEFAULT_CONFIG.terminal.idleTimeout,
          disconnectGracePeriod:
            Number(parsed.terminal?.disconnectGracePeriod) || DEFAULT_CONFIG.terminal.disconnectGracePeriod,
        },
      };
    } catch (err) {
      logger.warn({ err }, 'Failed to parse config file, using defaults');
      return { ...DEFAULT_CONFIG };
    }
  }

  private saveConfig(): void {
    this.saveConfigDirect(this.config);
  }

  private saveConfigDirect(cfg: AgentConfig): void {
    try {
      Paths.ensureConfigDir();
      const configFile = Paths.getConfigFile();
      fs.writeFileSync(configFile, JSON.stringify(cfg, null, 2), {
        mode: 0o600,
        encoding: 'utf8',
      });
    } catch (err) {
      logger.error({ err }, 'Failed to write config file');
    }
  }
}
