/**
 * CodeX Test Provider Registry
 * Level 3D — Test Provider Architecture
 *
 * Provides registered test execution and debug targeting strategies for:
 * - Vitest, Jest, Mocha (Node/TS)
 * - Pytest, Python unittest
 * - Rust (cargo test)
 * - Go (go test)
 * - Java (JUnit via Maven/Gradle)
 * - C/C++ (CTest)
 */

import { TestFramework } from './testTypes.js';

class TestRegistry {
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
      language: 'javascript',
      framework: 'Vitest',
      capabilities: { projectRun: true, fileRun: true, testRun: true, debug: true, watch: true },
      resolveRunTarget(target, { workspaceRoot, packageManager = 'npm' }) {
        const pm = packageManager || 'npm';
        const execCmd = pm === 'pnpm' ? 'pnpm' : pm === 'yarn' ? 'yarn' : pm === 'bun' ? 'bun' : 'npx';
        const baseArgs = pm === 'bun' ? ['vitest', 'run'] : pm === 'yarn' ? ['vitest', 'run'] : ['vitest', 'run'];

        if (!target || target.type === 'project') {
          return { command: execCmd, args: baseArgs, cwd: workspaceRoot };
        }
        if (target.type === 'file') {
          return { command: execCmd, args: [...baseArgs, target.file], cwd: workspaceRoot };
        }
        if (target.type === 'test' || target.type === 'suite') {
          const filter = target.name || target.label;
          return { command: execCmd, args: [...baseArgs, target.file, '-t', filter], cwd: workspaceRoot };
        }
        return { command: execCmd, args: baseArgs, cwd: workspaceRoot };
      },
      resolveDebugTarget(target, { workspaceRoot }) {
        return {
          program: 'npx',
          args: ['vitest', 'run', target.file || ''],
          cwd: workspaceRoot,
        };
      },
    });

    // 2. Jest Provider
    this.registerProvider({
      id: TestFramework.JEST,
      language: 'javascript',
      framework: 'Jest',
      capabilities: { projectRun: true, fileRun: true, testRun: true, debug: true, watch: true },
      resolveRunTarget(target, { workspaceRoot, packageManager = 'npm' }) {
        const pm = packageManager || 'npm';
        const execCmd = pm === 'pnpm' ? 'pnpm' : pm === 'yarn' ? 'yarn' : pm === 'bun' ? 'bun' : 'npx';
        const baseArgs = ['jest', '--colors', '--runInBand'];

        if (!target || target.type === 'project') {
          return { command: execCmd, args: baseArgs, cwd: workspaceRoot };
        }
        if (target.type === 'file') {
          return { command: execCmd, args: [...baseArgs, target.file], cwd: workspaceRoot };
        }
        if (target.type === 'test' || target.type === 'suite') {
          const filter = target.name || target.label;
          return { command: execCmd, args: [...baseArgs, target.file, '-t', filter], cwd: workspaceRoot };
        }
        return { command: execCmd, args: baseArgs, cwd: workspaceRoot };
      },
      resolveDebugTarget(target, { workspaceRoot }) {
        return {
          program: 'npx',
          args: ['jest', '--runInBand', target.file || ''],
          cwd: workspaceRoot,
        };
      },
    });

    // 3. Mocha Provider
    this.registerProvider({
      id: TestFramework.MOCHA,
      language: 'javascript',
      framework: 'Mocha',
      capabilities: { projectRun: true, fileRun: true, testRun: true, debug: true, watch: false },
      resolveRunTarget(target, { workspaceRoot, packageManager = 'npm' }) {
        const pm = packageManager || 'npm';
        const execCmd = pm === 'pnpm' ? 'pnpm' : pm === 'yarn' ? 'yarn' : pm === 'bun' ? 'bun' : 'npx';
        const baseArgs = ['mocha'];

        if (!target || target.type === 'project') {
          return { command: execCmd, args: baseArgs, cwd: workspaceRoot };
        }
        if (target.type === 'file') {
          return { command: execCmd, args: [...baseArgs, target.file], cwd: workspaceRoot };
        }
        if (target.type === 'test' || target.type === 'suite') {
          const filter = target.name || target.label;
          return { command: execCmd, args: [...baseArgs, target.file, '--grep', filter], cwd: workspaceRoot };
        }
        return { command: execCmd, args: baseArgs, cwd: workspaceRoot };
      },
      resolveDebugTarget(target, { workspaceRoot }) {
        return {
          program: 'npx',
          args: ['mocha', target.file || ''],
          cwd: workspaceRoot,
        };
      },
    });

    // 4. Pytest Provider
    this.registerProvider({
      id: TestFramework.PYTEST,
      language: 'python',
      framework: 'Pytest',
      capabilities: { projectRun: true, fileRun: true, testRun: true, debug: false, watch: false },
      resolveRunTarget(target, { workspaceRoot }) {
        const baseArgs = ['-v'];
        if (!target || target.type === 'project') {
          return { command: 'pytest', args: baseArgs, cwd: workspaceRoot };
        }
        if (target.type === 'file') {
          return { command: 'pytest', args: [...baseArgs, target.file], cwd: workspaceRoot };
        }
        if (target.type === 'test' || target.type === 'suite') {
          const spec = target.file ? `${target.file}::${target.name}` : target.name;
          return { command: 'pytest', args: [...baseArgs, spec], cwd: workspaceRoot };
        }
        return { command: 'pytest', args: baseArgs, cwd: workspaceRoot };
      },
    });

    // 5. Python Unittest Provider
    this.registerProvider({
      id: TestFramework.UNITTEST,
      language: 'python',
      framework: 'Unittest',
      capabilities: { projectRun: true, fileRun: true, testRun: false, debug: false, watch: false },
      resolveRunTarget(target, { workspaceRoot }) {
        if (!target || target.type === 'project') {
          return { command: 'python3', args: ['-m', 'unittest', 'discover'], cwd: workspaceRoot };
        }
        if (target.type === 'file') {
          return { command: 'python3', args: ['-m', 'unittest', target.file], cwd: workspaceRoot };
        }
        return { command: 'python3', args: ['-m', 'unittest', 'discover'], cwd: workspaceRoot };
      },
    });

    // 6. Rust Cargo Test Provider
    this.registerProvider({
      id: TestFramework.CARGO_TEST,
      language: 'rust',
      framework: 'Cargo Test',
      capabilities: { projectRun: true, fileRun: true, testRun: true, debug: false, watch: false },
      resolveRunTarget(target, { workspaceRoot }) {
        if (!target || target.type === 'project') {
          return { command: 'cargo', args: ['test'], cwd: workspaceRoot };
        }
        if (target.type === 'file') {
          const testName = target.name?.replace(/\.rs$/, '');
          return { command: 'cargo', args: ['test', '--test', testName], cwd: workspaceRoot };
        }
        if (target.type === 'test') {
          return { command: 'cargo', args: ['test', target.name], cwd: workspaceRoot };
        }
        return { command: 'cargo', args: ['test'], cwd: workspaceRoot };
      },
    });

    // 7. Go Test Provider
    this.registerProvider({
      id: TestFramework.GO_TEST,
      language: 'go',
      framework: 'Go Test',
      capabilities: { projectRun: true, fileRun: true, testRun: true, debug: false, watch: false },
      resolveRunTarget(target, { workspaceRoot }) {
        if (!target || target.type === 'project') {
          return { command: 'go', args: ['test', '-v', './...'], cwd: workspaceRoot };
        }
        if (target.type === 'file') {
          return { command: 'go', args: ['test', '-v', target.file], cwd: workspaceRoot };
        }
        if (target.type === 'test') {
          const safePattern = `^${target.name.replace(/[^a-zA-Z0-9_]/g, '')}$`;
          return { command: 'go', args: ['test', '-v', '-run', safePattern], cwd: workspaceRoot };
        }
        return { command: 'go', args: ['test', '-v', './...'], cwd: workspaceRoot };
      },
    });

    // 8. Java JUnit (Maven)
    this.registerProvider({
      id: TestFramework.JUNIT_MAVEN,
      language: 'java',
      framework: 'JUnit (Maven)',
      capabilities: { projectRun: true, fileRun: true, testRun: true, debug: false, watch: false },
      resolveRunTarget(target, { workspaceRoot }) {
        if (!target || target.type === 'project') {
          return { command: 'mvn', args: ['test'], cwd: workspaceRoot };
        }
        if (target.type === 'file' || target.type === 'suite') {
          const className = (target.name || '').replace(/\.java$/, '');
          return { command: 'mvn', args: ['test', `-Dtest=${className}`], cwd: workspaceRoot };
        }
        if (target.type === 'test') {
          const className = (target.parentName || '').replace(/\.java$/, '');
          const pattern = className ? `${className}#${target.name}` : target.name;
          return { command: 'mvn', args: ['test', `-Dtest=${pattern}`], cwd: workspaceRoot };
        }
        return { command: 'mvn', args: ['test'], cwd: workspaceRoot };
      },
    });

    // 9. Java JUnit (Gradle)
    this.registerProvider({
      id: TestFramework.JUNIT_GRADLE,
      language: 'java',
      framework: 'JUnit (Gradle)',
      capabilities: { projectRun: true, fileRun: true, testRun: true, debug: false, watch: false },
      resolveRunTarget(target, { workspaceRoot }) {
        const cmd = './gradlew';
        if (!target || target.type === 'project') {
          return { command: cmd, args: ['test'], cwd: workspaceRoot };
        }
        if (target.type === 'file' || target.type === 'test') {
          const pattern = target.name.replace(/\.java$/, '');
          return { command: cmd, args: ['test', '--tests', pattern], cwd: workspaceRoot };
        }
        return { command: cmd, args: ['test'], cwd: workspaceRoot };
      },
    });

    // 10. C / C++ (CTest)
    this.registerProvider({
      id: TestFramework.CTEST,
      language: 'cpp',
      framework: 'CTest',
      capabilities: { projectRun: true, fileRun: false, testRun: false, debug: false, watch: false },
      resolveRunTarget(_target, { workspaceRoot }) {
        return { command: 'ctest', args: ['--output-on-failure'], cwd: workspaceRoot };
      },
    });
  }
}

export const testRegistry = new TestRegistry();
