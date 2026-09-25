/**
 * CodeX Debug Adapter Registry & Launch Configuration Resolver
 * Level 3B — Debugging Architecture
 *
 * Manages supported debug adapters:
 * - Node.js / JavaScript / TypeScript (Standalone DAP adapter via Node)
 * - Python (debugpy)
 * - C/C++ & Rust (lldb-dap)
 * - Go (delve dap)
 */

import { nativeDebugService } from '../services/native/debugger.js';
import { DebugAdapterType } from './debugTypes.js';

class DebugAdapterRegistry {
  constructor() {
    this.adapters = new Map();
    this.registerBuiltinAdapters();
  }

  registerBuiltinAdapters() {
    // 1. Node.js / JavaScript / TypeScript
    this.registerAdapter({
      type: DebugAdapterType.NODE,
      name: 'Node.js Debugger',
      languages: ['javascript', 'typescript'],
      binaryCandidates: ['node'],
      getLaunchCommand: (targetProgram, workspaceRoot) => {
        // Point to our standalone DAP adapter script
        return {
          executable: 'node',
          args: [
            // Adapter script relative to workspace or resolved via node
            '-e',
            `require('${this.getAdapterScriptPath()}');`,
          ],
        };
      },
    });

    // 2. Python (debugpy adapter)
    this.registerAdapter({
      type: DebugAdapterType.PYTHON,
      name: 'Python Debugger (debugpy)',
      languages: ['python'],
      binaryCandidates: ['python3', 'python'],
      getLaunchCommand: () => ({
        executable: 'python3',
        args: ['-m', 'debugpy.adapter'],
      }),
    });

    // 3. C / C++ / Rust (lldb-dap)
    this.registerAdapter({
      type: DebugAdapterType.CPP,
      name: 'LLDB DAP (C/C++/Rust)',
      languages: ['c', 'cpp', 'rust'],
      binaryCandidates: ['lldb-dap', 'lldb-vscode'],
      getLaunchCommand: () => ({
        executable: 'lldb-dap',
        args: [],
      }),
    });

    // 4. Go (delve dap)
    this.registerAdapter({
      type: DebugAdapterType.GO,
      name: 'Go Debugger (Delve DAP)',
      languages: ['go'],
      binaryCandidates: ['dlv'],
      getLaunchCommand: () => ({
        executable: 'dlv',
        args: ['dap'],
      }),
    });
  }

  getAdapterScriptPath() {
    // Return absolute path or relative path to nodeDebugAdapter.cjs
    return '/Users/rajshaikh/Desktop/final-year-project/codeX-frontend/src/debugger/adapters/nodeDebugAdapter.cjs';
  }

  registerAdapter(adapterDef) {
    if (!adapterDef?.type) return;
    this.adapters.set(adapterDef.type, adapterDef);
  }

  getAdapterForLanguage(languageId) {
    if (!languageId) return this.adapters.get(DebugAdapterType.NODE);
    const lang = languageId.toLowerCase();

    for (const adapter of this.adapters.values()) {
      if (adapter.languages.includes(lang)) {
        return adapter;
      }
    }
    return this.adapters.get(DebugAdapterType.NODE);
  }

  async checkAvailability(type) {
    if (!nativeDebugService.isSupported()) return false;
    const adapter = this.adapters.get(type);
    if (!adapter) return false;

    for (const bin of adapter.binaryCandidates) {
      const exists = await nativeDebugService.checkBinary(bin);
      if (exists) return true;
    }
    return false;
  }

  /**
   * Resolves a complete DAP launch configuration.
   */
  resolveLaunchConfig(userConfig = {}, activeFile = null, workspaceRoot = '') {
    const language = activeFile?.language || 'javascript';
    const adapter = this.getAdapterForLanguage(language);

    const program = userConfig.program || activeFile?.path || activeFile?.name || '';
    const cwd = userConfig.cwd || workspaceRoot || '';
    const stopOnEntry = userConfig.stopOnEntry ?? false;
    const args = userConfig.args || [];
    const env = userConfig.env || {};

    const launchCmd = adapter.getLaunchCommand(program, workspaceRoot);

    return {
      type: adapter.type,
      name: userConfig.name || `Debug ${activeFile?.name || 'Program'}`,
      adapterExecutable: launchCmd.executable,
      adapterArgs: launchCmd.args,
      dapLaunchArgs: {
        program,
        cwd,
        args,
        env,
        stopOnEntry,
      },
    };
  }
}

export const debugAdapterRegistry = new DebugAdapterRegistry();
