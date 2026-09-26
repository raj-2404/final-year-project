/**
 * CodeX Coverage Provider Registry
 * Level 3E — Code Coverage & Test Intelligence
 *
 * Defines execution strategies, command templates, and expected report outputs for each framework.
 */

import { TestFramework } from '../testing/testTypes.js';
import { CoverageFormat, DefaultCoverageThresholds } from './coverageTypes.js';

class CoverageRegistry {
  constructor() {
    this.providers = new Map();
    this.registerBuiltInProviders();
  }

  registerProvider(provider) {
    if (!provider || !provider.id) return;
    this.providers.set(provider.id, provider);
  }

  getProvider(framework) {
    return this.providers.get(framework) || null;
  }

  hasProvider(framework) {
    return this.providers.has(framework);
  }

  registerBuiltInProviders() {
    // 1. Vitest Provider
    this.registerProvider({
      id: TestFramework.VITEST,
      framework: 'Vitest',
      defaultReportPath: 'coverage/lcov.info',
      alternateReportPaths: ['coverage/coverage-final.json', 'coverage/coverage-summary.json'],
      defaultFormat: CoverageFormat.LCOV,
      resolveCommand({ workspaceRoot, packageManager = 'npm' }) {
        const pm = packageManager || 'npm';
        const execCmd = pm === 'pnpm' ? 'pnpm' : pm === 'yarn' ? 'yarn' : pm === 'bun' ? 'bun' : 'npx';
        return {
          command: execCmd,
          args: ['vitest', 'run', '--coverage'],
          cwd: workspaceRoot,
        };
      },
    });

    // 2. Jest Provider
    this.registerProvider({
      id: TestFramework.JEST,
      framework: 'Jest',
      defaultReportPath: 'coverage/lcov.info',
      alternateReportPaths: ['coverage/coverage-final.json', 'coverage/coverage-summary.json'],
      defaultFormat: CoverageFormat.LCOV,
      resolveCommand({ workspaceRoot, packageManager = 'npm' }) {
        const pm = packageManager || 'npm';
        const execCmd = pm === 'pnpm' ? 'pnpm' : pm === 'yarn' ? 'yarn' : pm === 'bun' ? 'bun' : 'npx';
        return {
          command: execCmd,
          args: ['jest', '--coverage', '--coverageReporters=lcov', '--coverageReporters=text', '--runInBand'],
          cwd: workspaceRoot,
        };
      },
    });

    // 3. Mocha Provider (c8 / nyc)
    this.registerProvider({
      id: TestFramework.MOCHA,
      framework: 'Mocha',
      defaultReportPath: 'coverage/lcov.info',
      alternateReportPaths: ['coverage/coverage-summary.json'],
      defaultFormat: CoverageFormat.LCOV,
      resolveCommand({ workspaceRoot, packageManager = 'npm' }) {
        const pm = packageManager || 'npm';
        const execCmd = pm === 'pnpm' ? 'pnpm' : pm === 'yarn' ? 'yarn' : pm === 'bun' ? 'bun' : 'npx';
        return {
          command: execCmd,
          args: ['c8', '--reporter=lcov', '--reporter=text', 'mocha'],
          cwd: workspaceRoot,
        };
      },
    });

    // 4. Pytest Provider (pytest-cov)
    this.registerProvider({
      id: TestFramework.PYTEST,
      framework: 'Pytest',
      defaultReportPath: 'coverage.lcov',
      alternateReportPaths: ['coverage.xml', '.coverage'],
      defaultFormat: CoverageFormat.LCOV,
      resolveCommand({ workspaceRoot }) {
        return {
          command: 'pytest',
          args: ['--cov=.', '--cov-report=lcov:coverage.lcov', '--cov-report=term'],
          cwd: workspaceRoot,
        };
      },
    });

    // 5. Go Test Provider
    this.registerProvider({
      id: TestFramework.GO_TEST,
      framework: 'Go Test',
      defaultReportPath: 'coverage.out',
      alternateReportPaths: [],
      defaultFormat: CoverageFormat.GO_COVER,
      resolveCommand({ workspaceRoot }) {
        return {
          command: 'go',
          args: ['test', '-coverprofile=coverage.out', './...'],
          cwd: workspaceRoot,
        };
      },
    });

    // 6. Rust Cargo Provider (cargo llvm-cov / tarpaulin)
    this.registerProvider({
      id: TestFramework.CARGO_TEST,
      framework: 'Cargo',
      defaultReportPath: 'lcov.info',
      alternateReportPaths: ['target/llvm-cov/lcov.info'],
      defaultFormat: CoverageFormat.LCOV,
      resolveCommand({ workspaceRoot }) {
        return {
          command: 'cargo',
          args: ['llvm-cov', '--lcov', '--output-path', 'lcov.info'],
          cwd: workspaceRoot,
        };
      },
    });

    // 7. Maven JaCoCo Provider
    this.registerProvider({
      id: TestFramework.JUNIT_MAVEN,
      framework: 'Maven',
      defaultReportPath: 'target/site/jacoco/jacoco.xml',
      alternateReportPaths: [],
      defaultFormat: CoverageFormat.JACOCO_XML,
      resolveCommand({ workspaceRoot }) {
        return {
          command: 'mvn',
          args: ['test', 'jacoco:report'],
          cwd: workspaceRoot,
        };
      },
    });

    // 8. Gradle JaCoCo Provider
    this.registerProvider({
      id: TestFramework.JUNIT_GRADLE,
      framework: 'Gradle',
      defaultReportPath: 'build/reports/jacoco/test/jacocoTestReport.xml',
      alternateReportPaths: [],
      defaultFormat: CoverageFormat.JACOCO_XML,
      resolveCommand({ workspaceRoot }) {
        return {
          command: './gradlew',
          args: ['test', 'jacocoTestReport'],
          cwd: workspaceRoot,
        };
      },
    });

    // 9. CTest Provider
    this.registerProvider({
      id: TestFramework.CTEST,
      framework: 'CTest',
      defaultReportPath: 'coverage.lcov',
      alternateReportPaths: [],
      defaultFormat: CoverageFormat.LCOV,
      resolveCommand({ workspaceRoot }) {
        return {
          command: 'ctest',
          args: ['--output-on-failure'],
          cwd: workspaceRoot,
        };
      },
    });

    // 10. Custom / Generic Provider
    this.registerProvider({
      id: TestFramework.CUSTOM,
      framework: 'Custom',
      defaultReportPath: 'coverage/lcov.info',
      alternateReportPaths: ['coverage.lcov', 'coverage.out', 'coverage.xml'],
      defaultFormat: CoverageFormat.LCOV,
      resolveCommand({ workspaceRoot }) {
        return {
          command: 'npm',
          args: ['test', '--', '--coverage'],
          cwd: workspaceRoot,
        };
      },
    });
  }
}

export const coverageRegistry = new CoverageRegistry();
