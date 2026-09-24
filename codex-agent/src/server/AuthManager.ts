import crypto from 'crypto';
import fs from 'fs';
import { Paths } from '../platform/Paths.js';
import { logger } from '../logger/Logger.js';

export class AuthManager {
  private token: string;
  private tokenFilePath: string;

  constructor(customTokenFile?: string) {
    this.tokenFilePath = customTokenFile || Paths.getTokenFile();
    this.token = this.loadOrGenerateToken();
  }

  public getTokenFilePath(): string {
    return this.tokenFilePath;
  }

  public getToken(): string {
    return this.token;
  }

  /**
   * Validates a client token using constant-time comparison to prevent timing attacks.
   */
  public validateToken(candidate?: string): boolean {
    if (!candidate || typeof candidate !== 'string') {
      return false;
    }

    try {
      const candidateBuffer = Buffer.from(candidate, 'utf8');
      const tokenBuffer = Buffer.from(this.token, 'utf8');

      if (candidateBuffer.length !== tokenBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(candidateBuffer, tokenBuffer);
    } catch {
      return false;
    }
  }

  public regenerateToken(): string {
    this.token = this.generateSecureToken();
    this.saveToken(this.token);
    logger.info('Authentication token regenerated');
    return this.token;
  }

  private loadOrGenerateToken(): string {
    Paths.ensureConfigDir();

    if (fs.existsSync(this.tokenFilePath)) {
      try {
        const stored = fs.readFileSync(this.tokenFilePath, 'utf8').trim();
        if (stored.length >= 32) {
          return stored;
        }
      } catch (err) {
        logger.warn({ err }, 'Failed reading token file, regenerating secure token');
      }
    }

    const newToken = this.generateSecureToken();
    this.saveToken(newToken);
    return newToken;
  }

  private generateSecureToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private saveToken(token: string): void {
    try {
      Paths.ensureConfigDir();
      fs.writeFileSync(this.tokenFilePath, token, {
        mode: 0o600,
        encoding: 'utf8',
      });
      // Ensure file permissions on Unix
      if (process.platform !== 'win32') {
        try {
          fs.chmodSync(this.tokenFilePath, 0o600);
        } catch {
          // ignore
        }
      }
    } catch (err) {
      logger.error({ err }, 'Failed to save token file');
      throw err;
    }
  }
}
