/**
 * CodeX Build Task Resolver
 * Level 3C — Build & Run Strategy Resolution
 *
 * Coordinates detection, registry lookup, and configuration hierarchy
 * to determine the exact command, arguments, working directory, and environment
 * for a build or run task.
 */

import { TaskType, ProjectType } from './buildTypes.js';
import { buildDetector } from './buildDetector.js';
import { buildRegistry } from './buildRegistry.js';
import { buildConfiguration } from './buildConfiguration.js';

class BuildTaskResolver {
  /**
   * Resolves the complete execution plan for a build or run operation.
   *
   * @param {string} taskType - 'build' | 'run' | 'run_file'
   * @param {object} context - Execution context
   * @param {string} context.workspaceRoot - Root directory of current project
   * @param {Array<object>} [context.fileTree=[]] - Workspace file tree
   * @param {object} [context.activeFile=null] - Currently active file in Monaco
   * @param {object} [context.explicitOverrides={}] - Caller-supplied overrides
   * @returns {Promise<object>} Resolved task configuration
   */
  async resolveTask(taskType, { workspaceRoot = '', fileTree = [], activeFile = null, explicitOverrides = {} } = {}) {
    // Case 1: Run Single Active File
    if (taskType === TaskType.RUN_FILE) {
      if (!activeFile) {
        throw new Error('No active file selected to run.');
      }
      const fileCmd = buildDetector.resolveFileRunCommand(activeFile);
      if (!fileCmd) {
        const ext = (activeFile.name || '').split('.').pop();
        throw new Error(`File extension .${ext} is not directly executable.`);
      }

      // Check if user has explicit override for this file
      return {
        taskType: TaskType.RUN_FILE,
        command: explicitOverrides.command || fileCmd.executable,
        args: explicitOverrides.args || fileCmd.args,
        cwd: explicitOverrides.cwd || workspaceRoot || '',
        env: explicitOverrides.env || {},
        source: explicitOverrides.command ? 'explicit' : 'detected-file',
        targetFile: activeFile.path || activeFile.name,
      };
    }

    // Case 2: Project-level Build or Run
    const projectMeta = buildDetector.detectProject(fileTree, workspaceRoot);

    // Get default task from registered ecosystem providers
    const detectedDefault = buildRegistry.resolveDefaultTask(
      projectMeta.type,
      taskType,
      projectMeta,
      workspaceRoot
    );

    // Apply 4-level precedence: explicit -> tasks.json -> project.json -> detected default
    const resolved = await buildConfiguration.resolveTaskConfig(
      taskType,
      workspaceRoot,
      fileTree,
      detectedDefault,
      explicitOverrides
    );

    if (!resolved || !resolved.command) {
      const taskLabel = taskType === TaskType.BUILD ? 'build' : 'run';
      throw new Error(
        `Unable to determine ${taskLabel} command for project (${projectMeta.type}). Configure it in .codex/tasks.json.`
      );
    }

    return {
      taskType,
      command: resolved.command,
      args: resolved.args || [],
      cwd: resolved.cwd || workspaceRoot || '',
      env: resolved.env || {},
      source: resolved.source,
      projectType: projectMeta.type,
      packageManager: projectMeta.packageManager,
    };
  }
}

export const buildTaskResolver = new BuildTaskResolver();
