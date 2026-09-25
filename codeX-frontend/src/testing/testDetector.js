/**
 * CodeX Test Framework Detector
 * Level 3D — Test Framework & File Detection
 *
 * Detects:
 * - Test Frameworks: Vitest, Jest, Mocha, Pytest, Python unittest, Cargo test, Go test, JUnit (Maven/Gradle), CTest.
 * - Test Files: *.test.*, *.spec.*, test_*.py, *_test.py, *_test.go, tests/subdirs/*.rs, *Test.java.
 * - Package Manager: npm, pnpm, yarn, bun.
 */

import { TestFramework } from './testTypes.js';

class TestDetector {
  /**
   * Analyzes fileTree and returns all detected test frameworks and files.
   * @param {Array<object>} fileTree
   * @param {string} [workspaceRoot='']
   * @returns {{ primaryFramework: string|null, detectedFrameworks: Array<string>, testFiles: Array<object>, packageManager: string }}
   */
  detect(fileTree = [], workspaceRoot = '') {
    const fileNames = new Set(
      fileTree.map((f) => (f.name || f.path?.split('/').pop() || '').toLowerCase())
    );

    // 1. Detect Package Manager
    let packageManager = 'npm';
    if (fileNames.has('pnpm-lock.yaml')) {
      packageManager = 'pnpm';
    } else if (fileNames.has('yarn.lock')) {
      packageManager = 'yarn';
    } else if (fileNames.has('bun.lock') || fileNames.has('bun.lockb')) {
      packageManager = 'bun';
    } else if (fileNames.has('package-lock.json')) {
      packageManager = 'npm';
    }

    const detectedFrameworks = [];

    // 2. JavaScript / TypeScript (package.json check)
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
        detectedFrameworks.push(TestFramework.VITEST);
      }

      // Check Jest
      if (
        allDeps.jest ||
        testScript.includes('jest') ||
        fileNames.has('jest.config.js') ||
        fileNames.has('jest.config.ts')
      ) {
        detectedFrameworks.push(TestFramework.JEST);
      }

      // Check Mocha
      if (
        allDeps.mocha ||
        testScript.includes('mocha') ||
        fileNames.has('.mocharc.json') ||
        fileNames.has('.mocharc.js')
      ) {
        detectedFrameworks.push(TestFramework.MOCHA);
      }

      // Fallback if test script exists but no specific framework recognized
      if (detectedFrameworks.length === 0 && scripts.test) {
        detectedFrameworks.push(TestFramework.VITEST); // Default JS/TS runner
      }
    }

    // 3. Python (pytest / unittest)
    if (
      fileNames.has('pytest.ini') ||
      fileNames.has('setup.cfg') ||
      fileNames.has('pyproject.toml') ||
      fileNames.has('requirements.txt')
    ) {
      detectedFrameworks.push(TestFramework.PYTEST);
      detectedFrameworks.push(TestFramework.UNITTEST);
    }

    // 4. Rust (Cargo.toml)
    if (fileNames.has('cargo.toml')) {
      detectedFrameworks.push(TestFramework.CARGO_TEST);
    }

    // 5. Go (go.mod)
    if (fileNames.has('go.mod')) {
      detectedFrameworks.push(TestFramework.GO_TEST);
    }

    // 6. Java (pom.xml or build.gradle)
    if (fileNames.has('pom.xml')) {
      detectedFrameworks.push(TestFramework.JUNIT_MAVEN);
    }
    if (fileNames.has('build.gradle') || fileNames.has('build.gradle.kts')) {
      detectedFrameworks.push(TestFramework.JUNIT_GRADLE);
    }

    // 7. C / C++ (CMakeLists.txt)
    if (fileNames.has('cmakelists.txt')) {
      detectedFrameworks.push(TestFramework.CTEST);
    }

    // 8. Discover all test files in tree
    const testFiles = fileTree.filter((file) => this.isTestFile(file));

    return {
      primaryFramework: detectedFrameworks[0] || null,
      detectedFrameworks,
      testFiles,
      packageManager,
    };
  }

  /**
   * Determines if a file is a test file by its path/name.
   */
  isTestFile(file) {
    if (!file || file.type === 'folder') return false;
    const name = (file.name || file.path?.split('/').pop() || '').toLowerCase();
    const fullPath = (file.path || file.name || '').toLowerCase();

    // Ignore node_modules, dist, build, git
    if (
      fullPath.includes('/node_modules/') ||
      fullPath.includes('/.git/') ||
      fullPath.includes('/dist/') ||
      fullPath.includes('/build/') ||
      fullPath.includes('/target/')
    ) {
      return false;
    }

    // JS/TS test files (*.test.* or *.spec.*)
    if (/\.(test|spec)\.(js|jsx|ts|tsx|mjs|cjs)$/.test(name)) {
      return true;
    }

    // Python test files (test_*.py or *_test.py)
    if (/^(test_.*|.*_test)\.py$/.test(name)) {
      return true;
    }

    // Go test files (*_test.go)
    if (/.*_test\.go$/.test(name)) {
      return true;
    }

    // Rust test files (in tests/ directory or *_test.rs)
    if (name.endsWith('.rs') && (fullPath.includes('/tests/') || name.endsWith('_test.rs'))) {
      return true;
    }

    // Java test files (*Test.java or *Tests.java)
    if (/.*tests?\.java$/i.test(name)) {
      return true;
    }

    return false;
  }
}

export const testDetector = new TestDetector();
