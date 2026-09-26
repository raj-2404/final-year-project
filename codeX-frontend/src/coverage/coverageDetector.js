/**
 * CodeX Coverage Tool & Capability Detector
 * Level 3E — Code Coverage & Test Intelligence
 *
 * Inspects workspace files and package manifests to determine supported coverage tools,
 * report formats, and expected artifact output paths.
 */

import { TestFramework } from '../testing/testTypes.js';
import { CoverageFormat } from './coverageTypes.js';
import { nativeCoverageService } from '../services/native/coverage.js';

export class CoverageDetector {
  /**
   * Detects coverage capability from workspace files and package manager.
   * @param {Array<object>} fileTree
   * @param {string} workspaceRoot
   * @returns {Promise<{ tool: string, framework: string, format: string, reportPath: string, isAvailable: boolean }>}
   */
  async detect(fileTree = [], workspaceRoot = '') {
    const fileNames = new Set(
      fileTree.map((f) => (f.name || f.path?.split('/').pop() || '').toLowerCase())
    );

    // 1. Check Node.js / TypeScript projects (package.json)
    if (fileNames.has('package.json')) {
      const pkgFile = fileTree.find((f) => (f.name || '').toLowerCase() === 'package.json');
      let pkg = {};
      if (pkgFile?.content) {
        try {
          pkg = JSON.parse(pkgFile.content);
        } catch {}
      }

      const allDeps = {
        ...(pkg.dependencies || {}),
        ...(pkg.devDependencies || {}),
      };
      const scripts = pkg.scripts || {};
      const testScript = (scripts.test || '').toLowerCase();

      // Check Vitest
      if (
        allDeps.vitest ||
        testScript.includes('vitest') ||
        fileNames.has('vitest.config.js') ||
        fileNames.has('vitest.config.ts')
      ) {
        return {
          tool: 'vitest',
          framework: TestFramework.VITEST,
          format: CoverageFormat.LCOV,
          reportPath: 'coverage/lcov.info',
          alternateReportPath: 'coverage/coverage-final.json',
          isAvailable: true,
        };
      }

      // Check Jest
      if (
        allDeps.jest ||
        testScript.includes('jest') ||
        fileNames.has('jest.config.js') ||
        fileNames.has('jest.config.ts')
      ) {
        return {
          tool: 'jest',
          framework: TestFramework.JEST,
          format: CoverageFormat.LCOV,
          reportPath: 'coverage/lcov.info',
          alternateReportPath: 'coverage/coverage-final.json',
          isAvailable: true,
        };
      }

      // Check Mocha with c8 or nyc
      if (
        allDeps.c8 ||
        allDeps.nyc ||
        allDeps.mocha ||
        testScript.includes('c8') ||
        testScript.includes('nyc') ||
        testScript.includes('mocha')
      ) {
        return {
          tool: allDeps.c8 || testScript.includes('c8') ? 'c8' : 'nyc',
          framework: TestFramework.MOCHA,
          format: CoverageFormat.LCOV,
          reportPath: 'coverage/lcov.info',
          isAvailable: true,
        };
      }
    }

    // 2. Python (pytest-cov)
    if (
      fileNames.has('pytest.ini') ||
      fileNames.has('setup.cfg') ||
      fileNames.has('pyproject.toml') ||
      fileNames.has('requirements.txt')
    ) {
      const hasPytest = await nativeCoverageService.checkBinary('pytest');
      return {
        tool: 'pytest-cov',
        framework: TestFramework.PYTEST,
        format: CoverageFormat.LCOV,
        reportPath: 'coverage.lcov',
        alternateReportPath: 'coverage.xml',
        isAvailable: hasPytest,
      };
    }

    // 3. Go (go test -coverprofile)
    if (fileNames.has('go.mod') || fileTree.some((f) => (f.name || '').endsWith('.go'))) {
      const hasGo = await nativeCoverageService.checkBinary('go');
      return {
        tool: 'go_cover',
        framework: TestFramework.GO_TEST,
        format: CoverageFormat.GO_COVER,
        reportPath: 'coverage.out',
        isAvailable: hasGo,
      };
    }

    // 4. Rust Cargo (cargo llvm-cov / tarpaulin)
    if (fileNames.has('cargo.toml')) {
      const hasLlvmCov = await nativeCoverageService.checkBinary('cargo-llvm-cov');
      const hasTarpaulin = !hasLlvmCov && (await nativeCoverageService.checkBinary('cargo-tarpaulin'));
      return {
        tool: hasLlvmCov ? 'cargo-llvm-cov' : hasTarpaulin ? 'cargo-tarpaulin' : 'cargo-test',
        framework: TestFramework.CARGO_TEST,
        format: CoverageFormat.LCOV,
        reportPath: 'lcov.info',
        isAvailable: hasLlvmCov || hasTarpaulin,
      };
    }

    // 5. Java (Maven / Gradle JaCoCo)
    if (fileNames.has('pom.xml')) {
      const hasMvn = await nativeCoverageService.checkBinary('mvn');
      return {
        tool: 'maven-jacoco',
        framework: TestFramework.JUNIT_MAVEN,
        format: CoverageFormat.JACOCO_XML,
        reportPath: 'target/site/jacoco/jacoco.xml',
        isAvailable: hasMvn,
      };
    }

    if (fileNames.has('build.gradle') || fileNames.has('build.gradle.kts')) {
      const hasGradle = await nativeCoverageService.checkBinary('gradle');
      return {
        tool: 'gradle-jacoco',
        framework: TestFramework.JUNIT_GRADLE,
        format: CoverageFormat.JACOCO_XML,
        reportPath: 'build/reports/jacoco/test/jacocoTestReport.xml',
        isAvailable: hasGradle,
      };
    }

    // 6. C/C++ CTest / gcovr
    if (fileNames.has('cmakelists.txt')) {
      const hasCtest = await nativeCoverageService.checkBinary('ctest');
      return {
        tool: 'ctest-gcov',
        framework: TestFramework.CTEST,
        format: CoverageFormat.LCOV,
        reportPath: 'coverage.lcov',
        isAvailable: hasCtest,
      };
    }

    // Fallback: Default to vitest / lcov
    return {
      tool: 'generic',
      framework: TestFramework.CUSTOM,
      format: CoverageFormat.LCOV,
      reportPath: 'coverage/lcov.info',
      isAvailable: false,
    };
  }
}

export const coverageDetector = new CoverageDetector();
