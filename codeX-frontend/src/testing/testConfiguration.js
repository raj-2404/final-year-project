/**
 * CodeX Test Configuration Resolver
 * Level 3D — Test Configuration & Precedence
 *
 * Implements strict 5-level precedence:
 * 1. Explicit local target action
 * 2. Explicit configuration overrides
 * 3. .codex/tasks.json ("test" block)
 * 4. .codex/project.json ("test" script)
 * 5. Detected framework defaults
 */

import { filesystemService, projectService } from '../services/native/index.js';
import { isDesktopApp } from '../services/native/platform.js';

class TestConfiguration {
  /**
   * Loads .codex/tasks.json from workspace.
   */
  async loadTasksJson(workspaceRoot, fileTree = []) {
    if (!workspaceRoot) return null;

    const tasksFile = fileTree.find(
      (f) =>
        f.path?.endsWith('.codex/tasks.json') ||
        f.path?.endsWith('.codex\\tasks.json') ||
        (f.name === 'tasks.json' && f.path?.includes('.codex'))
    );

    if (tasksFile?.content) {
      try {
        return JSON.parse(tasksFile.content);
      } catch {}
    }

    if (isDesktopApp()) {
      try {
        const fullPath = `${workspaceRoot.replace(/\\/g, '/').replace(/\/+$/, '')}/.codex/tasks.json`;
        const exists = await filesystemService.exists(fullPath);
        if (exists) {
          const content = await filesystemService.readFile(fullPath);
          return JSON.parse(content);
        }
      } catch {}
    }

    return null;
  }

  /**
   * Loads existing .codex/project.json.
   */
  async loadProjectJson(workspaceRoot) {
    if (!workspaceRoot || !isDesktopApp()) return null;
    try {
      return await projectService.loadConfig(workspaceRoot);
    } catch {
      return null;
    }
  }

  /**
   * Resolves effective test command, args, cwd, and env using the 5-level precedence rule.
   */
  async resolveTestConfig({ workspaceRoot = '', fileTree = [], detectedDefault = null, explicitOverrides = {} } = {}) {
    // 1 & 2. Explicit overrides provided by caller
    if (explicitOverrides?.command) {
      return {
        source: 'explicit',
        framework: explicitOverrides.framework || detectedDefault?.framework || 'custom',
        command: explicitOverrides.command,
        args: explicitOverrides.args || [],
        cwd: explicitOverrides.cwd || workspaceRoot || '',
        env: explicitOverrides.env || {},
      };
    }

    // 3. .codex/tasks.json ("test" section)
    const tasksJson = await this.loadTasksJson(workspaceRoot, fileTree);
    if (tasksJson?.test?.command) {
      const cfg = tasksJson.test;
      return {
        source: '.codex/tasks.json',
        framework: cfg.framework || detectedDefault?.framework || 'custom',
        command: cfg.command,
        args: Array.isArray(cfg.args) ? cfg.args : [],
        cwd: cfg.workingDirectory || cfg.cwd || workspaceRoot || '',
        env: cfg.env || {},
      };
    }

    // 4. .codex/project.json ("run.test" or "scripts.test")
    const projectJson = await this.loadProjectJson(workspaceRoot);
    if (projectJson?.run?.test) {
      const parts = projectJson.run.test.split(' ');
      return {
        source: '.codex/project.json',
        framework: detectedDefault?.framework || 'custom',
        command: parts[0],
        args: parts.slice(1),
        cwd: workspaceRoot || '',
        env: {},
      };
    }

    // 5. Detected framework defaults
    if (detectedDefault?.command) {
      return {
        source: 'detected',
        framework: detectedDefault.framework,
        command: detectedDefault.command,
        args: detectedDefault.args || [],
        cwd: detectedDefault.cwd || workspaceRoot || '',
        env: detectedDefault.env || {},
      };
    }

    return null;
  }
}

export const testConfiguration = new TestConfiguration();
