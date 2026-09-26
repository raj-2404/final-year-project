/**
 * CodeX Coverage Runner Orchestrator
 * Level 3E — Code Coverage & Test Intelligence
 *
 * Coordinates execution, artifact report discovery, parsing, and store updating.
 */

import { CoverageLifecycleState } from './coverageTypes.js';
import { CoverageProcess } from './coverageProcess.js';
import { coverageConfiguration } from './coverageConfiguration.js';
import { CoverageParser } from './coverageParser.js';
import { coverageStore } from './coverageStore.js';
import { filesystemService } from '../services/native/index.js';
import { isDesktopApp } from '../services/native/platform.js';

export class CoverageRunner {
  constructor() {
    this.activeProcess = null;
  }

  async runCoverage({
    workspaceRoot = '',
    fileTree = [],
    framework = '',
    packageManager = 'npm',
    explicitOverrides = {},
    onOutput = null,
    onStateChange = null,
  } = {}) {
    if (this.activeProcess && this.activeProcess.state === CoverageLifecycleState.RUNNING) {
      throw new Error('A coverage run is already in progress.');
    }

    const config = await coverageConfiguration.resolveConfig({
      workspaceRoot,
      fileTree,
      framework,
      packageManager,
      explicitOverrides,
    });

    const process = new CoverageProcess({
      command: config.command,
      args: config.args,
      cwd: config.cwd,
      env: config.env,
    });

    this.activeProcess = process;

    if (onOutput) {
      process.onOutput(onOutput);
    }
    if (onStateChange) {
      process.onStateChange(onStateChange);
    }

    try {
      await process.start();

      // Search and read coverage report artifact
      const reportContent = await this.findAndReadReport(config, workspaceRoot, fileTree);

      if (!reportContent) {
        process.setState(CoverageLifecycleState.FAILED);
        const msg = `Coverage report not found at expected path: ${config.reportPath}`;
        process.appendOutput(`\n[Coverage] Warning: ${msg}\n`, 'stderr');
        return {
          success: false,
          error: msg,
          projectCoverage: null,
          process,
        };
      }

      // Parse report
      process.appendOutput('[Coverage] Parsing coverage report...\n', 'system');
      const projectCoverage = CoverageParser.parse(reportContent, {
        workspaceRoot,
        framework: config.framework,
      });

      projectCoverage.thresholds = config.thresholds;
      projectCoverage.recomputeTotals();

      // Store in memory
      coverageStore.setCoverage(workspaceRoot, projectCoverage);

      process.setState(CoverageLifecycleState.COMPLETED);
      process.appendOutput(
        `[Coverage] Completed. Overall Lines: ${projectCoverage.lines.pct}% (${projectCoverage.lines.covered}/${projectCoverage.lines.total})\n`,
        'system'
      );

      return {
        success: true,
        projectCoverage,
        process,
      };
    } catch (err) {
      if (process.state !== CoverageLifecycleState.CANCELLED) {
        process.setState(CoverageLifecycleState.ERROR);
      }
      process.appendOutput(`\n[Coverage Error] ${err.message || err}\n`, 'stderr');
      return {
        success: false,
        error: err.message || err,
        projectCoverage: null,
        process,
      };
    } finally {
      if (this.activeProcess === process) {
        this.activeProcess = null;
      }
    }
  }

  async findAndReadReport(config, workspaceRoot, fileTree = []) {
    const candidatePaths = [
      config.reportPath,
      ...(config.alternateReportPaths || []),
      'coverage/lcov.info',
      'lcov.info',
      'coverage.lcov',
      'coverage.out',
      'coverage/coverage-final.json',
      'coverage/coverage-summary.json',
      'target/site/jacoco/jacoco.xml',
      'build/reports/jacoco/test/jacocoTestReport.xml',
    ];

    const cleanRoot = workspaceRoot ? workspaceRoot.replace(/\\/g, '/').replace(/\/+$/, '') : '';

    for (const relPath of candidatePaths) {
      if (!relPath) continue;

      // 1. Desktop check via filesystemService
      if (isDesktopApp() && cleanRoot) {
        try {
          const fullPath = relPath.startsWith('/') ? relPath : `${cleanRoot}/${relPath}`;
          const exists = await filesystemService.exists(fullPath);
          if (exists) {
            const content = await filesystemService.readFile(fullPath);
            if (content && content.trim().length > 0) {
              return content;
            }
          }
        } catch {}
      }

      // 2. Check in memory fileTree
      const matched = fileTree.find((f) => {
        const p = (f.path || f.name || '').replace(/\\/g, '/');
        return p === relPath || p.endsWith(`/${relPath}`);
      });

      if (matched?.content && matched.content.trim().length > 0) {
        return matched.content;
      }
    }

    return null;
  }

  stop() {
    if (this.activeProcess) {
      this.activeProcess.stop();
    }
  }

  kill() {
    if (this.activeProcess) {
      this.activeProcess.kill();
    }
  }
}

export const coverageRunner = new CoverageRunner();
