/**
 * CodeX Test Controller
 * Level 3D — Test Editor & Debugger Integration
 *
 * Coordinates test actions with DebuggerManager (Level 3B) and Monaco Editor navigation.
 */

import { testRegistry } from './testRegistry.js';
import { debuggerManager } from '../debugger/debuggerManager.js';

class TestController {
  /**
   * Starts a DAP debugging session for a test target using the existing DebuggerManager.
   */
  async debugTarget(target, { framework, workspaceRoot, fileTree = [] }) {
    const provider = testRegistry.getProvider(framework);
    if (!provider || !provider.capabilities?.debug) {
      throw new Error(`Debugging is not currently supported for ${framework || 'this framework'}.`);
    }

    const debugPlan = provider.resolveDebugTarget(target, { workspaceRoot });
    if (!debugPlan) {
      throw new Error('Could not resolve debug target parameters.');
    }

    // Launch DAP session via Level 3B DebuggerManager
    const activeFile = fileTree.find((f) => f.path === target.file || f.name === target.file);
    await debuggerManager.startDebugging(
      {
        type: 'node',
        request: 'launch',
        program: debugPlan.program,
        args: debugPlan.args,
        cwd: debugPlan.cwd || workspaceRoot,
      },
      activeFile || { path: target.file, name: target.file?.split('/').pop() }
    );
  }
}

export const testController = new TestController();
