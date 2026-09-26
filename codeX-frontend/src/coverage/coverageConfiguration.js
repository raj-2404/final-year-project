/**
 * CodeX Coverage Configuration Resolver
 * Level 3E — Code Coverage & Test Intelligence
 *
 * Implements strict precedence:
 * 1. Explicit caller options
 * 2. .codex/tasks.json ("coverage" block)
 * 3. Detected framework defaults from CoverageRegistry
 */

import { filesystemService } from '../services/native/index.js';
import { isDesktopApp } from '../services/native/platform.js';
import { coverageRegistry } from './coverageRegistry.js';
import { DefaultCoverageThresholds } from './coverageTypes.js';

class CoverageConfiguration {
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
   * Resolves final coverage execution configuration.
   */
  async resolveConfig({
    workspaceRoot = '',
    fileTree = [],
    framework = '',
    packageManager = 'npm',
    explicitOverrides = {},
  } = {}) {
    // 1. Explicit caller options
    if (explicitOverrides?.command) {
      const provider = coverageRegistry.getProvider(framework) || coverageRegistry.getProvider('custom');
      return {
        source: 'explicit',
        framework: explicitOverrides.framework || framework || 'custom',
        command: explicitOverrides.command,
        args: Array.isArray(explicitOverrides.args) ? explicitOverrides.args : [],
        cwd: explicitOverrides.cwd || workspaceRoot || '',
        env: explicitOverrides.env || {},
        reportPath: explicitOverrides.reportPath || provider?.defaultReportPath || 'coverage/lcov.info',
        alternateReportPaths: provider?.alternateReportPaths || [],
        thresholds: { ...DefaultCoverageThresholds, ...(explicitOverrides.thresholds || {}) },
      };
    }

    // 2. .codex/tasks.json ("coverage" block)
    const tasksJson = await this.loadTasksJson(workspaceRoot, fileTree);
    if (tasksJson?.coverage?.command) {
      const cfg = tasksJson.coverage;
      const provider = coverageRegistry.getProvider(cfg.framework || framework) || coverageRegistry.getProvider('custom');
      return {
        source: '.codex/tasks.json',
        framework: cfg.framework || framework || 'custom',
        command: cfg.command,
        args: Array.isArray(cfg.args) ? cfg.args : [],
        cwd: cfg.workingDirectory || cfg.cwd || workspaceRoot || '',
        env: cfg.env || {},
        reportPath: cfg.reportPath || provider?.defaultReportPath || 'coverage/lcov.info',
        alternateReportPaths: provider?.alternateReportPaths || [],
        thresholds: { ...DefaultCoverageThresholds, ...(cfg.thresholds || {}) },
      };
    }

    // 3. Provider defaults from CoverageRegistry
    const provider = coverageRegistry.getProvider(framework) || coverageRegistry.getProvider('custom');
    const resolved = provider.resolveCommand({ workspaceRoot, packageManager });

    return {
      source: 'registry_default',
      framework: framework || provider.id,
      command: resolved.command,
      args: resolved.args,
      cwd: resolved.cwd || workspaceRoot,
      env: {},
      reportPath: provider.defaultReportPath,
      alternateReportPaths: provider.alternateReportPaths || [],
      thresholds: DefaultCoverageThresholds,
    };
  }
}

export const coverageConfiguration = new CoverageConfiguration();
