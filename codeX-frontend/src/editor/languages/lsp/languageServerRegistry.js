/**
 * CodeX Language Server Registry
 * Level 3A — Centralized Language Server Mapping & State Management
 *
 * Maps supported languages (Python, Rust, Go, C/C++, Java) to their local language server executables.
 * Tracks individual server status: 'available' | 'unavailable' | 'disabled' | 'starting' | 'running' | 'stopped' | 'failed'
 */

import { nativeLspService } from '../../../services/native/lsp.js';

export const ServerStatus = {
  AVAILABLE: 'available',
  UNAVAILABLE: 'unavailable',
  DISABLED: 'disabled',
  STARTING: 'starting',
  RUNNING: 'running',
  STOPPED: 'stopped',
  FAILED: 'failed',
};

class LanguageServerRegistry {
  constructor() {
    this.servers = new Map();
    this.statusMap = new Map();
    this.verifiedExecutables = new Map();

    // Register built-in Language Server definitions
    this.registerBuiltInServers();
  }

  registerBuiltInServers() {
    // 1. Python (pylsp / pyright / jedi)
    this.registerServer({
      id: 'python-ls',
      name: 'Python Language Server',
      languages: ['python'],
      candidates: ['pylsp', 'pyright-langserver', 'jedi-language-server'],
      defaultArgs: {
        'pylsp': [],
        'pyright-langserver': ['--stdio'],
        'jedi-language-server': [],
      },
    });

    // 2. Rust (rust-analyzer)
    this.registerServer({
      id: 'rust-analyzer',
      name: 'Rust Analyzer',
      languages: ['rust'],
      candidates: ['rust-analyzer'],
      defaultArgs: {
        'rust-analyzer': [],
      },
    });

    // 3. Go (gopls)
    this.registerServer({
      id: 'gopls',
      name: 'Go Language Server (gopls)',
      languages: ['go'],
      candidates: ['gopls'],
      defaultArgs: {
        'gopls': ['serve'],
      },
    });

    // 4. C / C++ (clangd)
    this.registerServer({
      id: 'clangd',
      name: 'Clangd (C/C++)',
      languages: ['c', 'cpp'],
      candidates: ['clangd'],
      defaultArgs: {
        'clangd': ['--background-index'],
      },
    });

    // 5. Java (jdtls)
    this.registerServer({
      id: 'jdtls',
      name: 'Eclipse JDT Language Server (Java)',
      languages: ['java'],
      candidates: ['jdtls'],
      defaultArgs: {
        'jdtls': [],
      },
    });

    // 6. HTML (vscode-html-language-server / html-languageserver)
    this.registerServer({
      id: 'html-ls',
      name: 'HTML Language Server',
      languages: ['html', 'htm'],
      candidates: ['vscode-html-language-server', 'html-languageserver'],
      defaultArgs: {
        'vscode-html-language-server': ['--stdio'],
        'html-languageserver': ['--stdio'],
      },
    });

    // 7. CSS / SCSS / LESS (vscode-css-language-server / css-languageserver)
    this.registerServer({
      id: 'css-ls',
      name: 'CSS Language Server',
      languages: ['css', 'scss', 'less'],
      candidates: ['vscode-css-language-server', 'css-languageserver'],
      defaultArgs: {
        'vscode-css-language-server': ['--stdio'],
        'css-languageserver': ['--stdio'],
      },
    });

    // 8. SQL (sql-language-server / sqls)
    this.registerServer({
      id: 'sql-ls',
      name: 'SQL Language Server',
      languages: ['sql'],
      candidates: ['sql-language-server', 'sqls'],
      defaultArgs: {
        'sql-language-server': ['up', '--method', 'stdio'],
        'sqls': [],
      },
      config: {
        dialect: 'generic', // Configurable: 'generic' | 'postgresql' | 'mysql' | 'sqlite'
      },
    });
  }

  /**
   * Registers a language server configuration.
   * @param {object} serverDef - Server configuration object
   */
  registerServer(serverDef) {
    if (!serverDef?.id || !Array.isArray(serverDef.languages)) return;

    this.servers.set(serverDef.id, serverDef);
    this.statusMap.set(serverDef.id, ServerStatus.UNAVAILABLE);
  }

  /**
   * Discovers whether a language server candidate is present on the user's local machine.
   * @param {string} serverId - Server identifier
   * @returns {Promise<boolean>} True if server binary exists locally
   */
  async discoverServer(serverId) {
    const server = this.servers.get(serverId);
    if (!server) return false;

    // In web browser, local language server processes are not available
    if (!nativeLspService.isSupported()) {
      this.statusMap.set(serverId, ServerStatus.UNAVAILABLE);
      return false;
    }

    // Check candidate binaries in order
    for (const candidate of server.candidates) {
      try {
        const isPresent = await nativeLspService.checkBinary(candidate);
        if (isPresent) {
          this.verifiedExecutables.set(serverId, candidate);
          this.statusMap.set(serverId, ServerStatus.AVAILABLE);
          return true;
        }
      } catch {}
    }

    this.statusMap.set(serverId, ServerStatus.UNAVAILABLE);
    return false;
  }

  /**
   * Retrieves the language server registered for a given language ID.
   * @param {string} languageId - Monaco language ID (e.g. 'python', 'rust', 'go')
   * @returns {object|null} Server definition or null
   */
  getServerForLanguage(languageId) {
    if (!languageId) return null;
    const lower = languageId.toLowerCase();

    for (const server of this.servers.values()) {
      if (server.languages.includes(lower)) {
        return server;
      }
    }
    return null;
  }

  /**
   * Returns the verified executable and arguments for a language server.
   * @param {string} serverId - Server identifier
   * @returns {{ executable: string, args: string[] }|null}
   */
  getLaunchConfig(serverId) {
    const server = this.servers.get(serverId);
    if (!server) return null;

    const executable = this.verifiedExecutables.get(serverId) || server.candidates[0];
    const args = server.defaultArgs?.[executable] || [];

    return {
      executable,
      args,
    };
  }

  /**
   * Sets the lifecycle status of a language server.
   * @param {string} serverId - Server ID
   * @param {string} status - ServerStatus value
   */
  setStatus(serverId, status) {
    if (this.statusMap.has(serverId)) {
      this.statusMap.set(serverId, status);
    }
  }

  /**
   * Gets the lifecycle status of a language server.
   * @param {string} serverId - Server ID
   * @returns {string} Status string
   */
  getStatus(serverId) {
    return this.statusMap.get(serverId) || ServerStatus.UNAVAILABLE;
  }

  /**
   * Returns list of all registered servers.
   */
  getAllServers() {
    return Array.from(this.servers.values()).map((s) => ({
      ...s,
      status: this.getStatus(s.id),
      verifiedExecutable: this.verifiedExecutables.get(s.id) || null,
    }));
  }

  /**
   * Sets custom configuration for a server (e.g. SQL dialect/database type).
   * @param {string} serverId
   * @param {object} config
   */
  setServerConfig(serverId, config) {
    const server = this.servers.get(serverId);
    if (server) {
      server.config = { ...(server.config || {}), ...config };
    }
  }

  /**
   * Gets configuration for a server.
   * @param {string} serverId
   * @returns {object}
   */
  getServerConfig(serverId) {
    const server = this.servers.get(serverId);
    return server?.config || {};
  }
}

export const languageServerRegistry = new LanguageServerRegistry();
