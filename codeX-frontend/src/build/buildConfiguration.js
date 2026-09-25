/**
 * CodeX Build Configuration Resolver
 * Level 3C — Task Configuration & Precedence Architecture
 *
 * Implements strict precedence order:
 * 1. Explicit user/caller configuration
 * 2. .codex/tasks.json
 * 3. existing .codex/project.json execution configuration
 * 4. detected project defaults
 */

import { filesystemService, projectService } from '../services/native/index.js';
import { isDesktopApp } from '../services/native/platform.js';

class BuildConfiguration {
  /**
   * Loads .codex/tasks.json from workspace.
   */
  async loadTasksJson(workspaceRoot, fileTree = []) {
    if (!workspaceRoot) return null;

    // First try in-memory fileTree
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

    // Next try native filesystem if on desktop
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
   * Loads existing .codex/project.json for backward compatibility.
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
   * Resolves effective command, args, cwd, and env for a task ('build' | 'run').
   */
  async resolveTaskConfig(taskType, workspaceRoot, fileTree = [], detectedDefault = null, explicitOverrides = {}) {
    // 1. Explicit override provided by user/call
    if (explicitOverrides?.command) {
      return {
        source: 'explicit',
        command: explicitOverrides.command,
        args: explicitOverrides.args || [],
        cwd: explicitOverrides.cwd || workspaceRoot || '',
        env: explicitOverrides.env || {},
      };
    }

    // 2. .codex/tasks.json
    const tasksJson = await this.loadTasksJson(workspaceRoot, fileTree);
    if (tasksJson && tasksJson[taskType]?.command) {
      const cfg = tasksJson[taskType];
      return {
        source: '.codex/tasks.json',
        command: cfg.command,
        args: Array.isArray(cfg.args) ? cfg.args : [],
        cwd: cfg.workingDirectory || cfg.cwd || workspaceRoot || '',
        env: cfg.env || {},
      };
    }

    // 3. Existing .codex/project.json (backward compatibility)
    const projectJson = await this.loadProjectJson(workspaceRoot);
    if (projectJson?.run) {
      // If taskType is 'build', check if there's a build script configured in project.json
      if (taskType === 'build' && projectJson.run.build) {
        const parts = projectJson.run.build.split(' ');
        return {
          source: '.codex/project.json',
          command: parts[0],
          args: parts.slice(1),
          cwd: workspaceRoot || '',
          env: {},
        };
      }

      // If taskType is 'run', check default run scripts (start, dev, etc.)
      if (taskType === 'run') {
        const runCmd = projectJson.run.start || projectJson.run.dev || Object.values(projectJson.run)[0];
        if (runCmd) {
          const parts = runCmd.split(' ');
          return {
            source: '.codex/project.json',
            command: parts[0],
            args: parts.slice(1),
            cwd: workspaceRoot || '',
            env: {},
          };
        }
      }
    }

    // 4. Detected project defaults
    if (detectedDefault?.command) {
      return {
        source: 'detected',
        command: detectedDefault.command,
        args: detectedDefault.args || [],
        cwd: detectedDefault.cwd || workspaceRoot || '',
        env: detectedDefault.env || {},
      };
    }

    return null;
  }

  /**
   * Saves or updates .codex/tasks.json in the workspace.
   */
  async saveTasksJson(workspaceRoot, config) {
    if (!workspaceRoot || !isDesktopApp()) return;
    const fullPath = `${workspaceRoot.replace(/\\/g, '/').replace(/\/+$/, '')}/.codex/tasks.json`;
    await filesystemService.writeFile(fullPath, JSON.stringify(config, null, 2));
  }
}

export const buildConfiguration = new BuildConfiguration();
