/**
 * CodeX Build & Run Provider Registry
 * Level 3C — Extensible Language & Build Tool Ecosystem
 *
 * Provides registered build and run command strategies for:
 * - Node.js (npm / pnpm / yarn / bun)
 * - Python (python3)
 * - Rust (cargo)
 * - Go (go)
 * - Java (Maven / Gradle)
 * - C/C++ (CMake / Make)
 */

import { PackageManager, ProjectType, TaskType } from './buildTypes.js';

class BuildRegistry {
  constructor() {
    this.providers = new Map();
    this.registerBuiltInProviders();
  }

  registerProvider(provider) {
    if (!provider || !provider.id) return;
    this.providers.set(provider.id, provider);
  }

  getProvider(projectType) {
    return this.providers.get(projectType) || null;
  }

  resolveDefaultTask(projectType, taskType, projectMeta = {}, workspaceRoot = '') {
    const provider = this.getProvider(projectType);
    if (!provider) return null;

    if (taskType === TaskType.BUILD && provider.resolveBuildCommand) {
      return provider.resolveBuildCommand(projectMeta, workspaceRoot);
    }
    if (taskType === TaskType.RUN && provider.resolveRunCommand) {
      return provider.resolveRunCommand(projectMeta, workspaceRoot);
    }
    return null;
  }

  registerBuiltInProviders() {
    // 1. Node.js Provider
    this.registerProvider({
      id: ProjectType.NODE,
      name: 'Node.js',
      resolveBuildCommand(meta, cwd) {
        const pm = meta.packageManager || PackageManager.NPM;
        if (pm === PackageManager.YARN) {
          return { command: 'yarn', args: ['build'], cwd };
        }
        if (pm === PackageManager.PNPM) {
          return { command: 'pnpm', args: ['run', 'build'], cwd };
        }
        if (pm === PackageManager.BUN) {
          return { command: 'bun', args: ['run', 'build'], cwd };
        }
        return { command: 'npm', args: ['run', 'build'], cwd };
      },
      resolveRunCommand(meta, cwd) {
        const pm = meta.packageManager || PackageManager.NPM;
        const scripts = meta.scripts || {};
        const targetScript = scripts.start ? 'start' : scripts.dev ? 'dev' : 'start';

        if (pm === PackageManager.YARN) {
          return { command: 'yarn', args: [targetScript], cwd };
        }
        if (pm === PackageManager.PNPM) {
          return { command: 'pnpm', args: targetScript === 'start' ? ['start'] : ['run', targetScript], cwd };
        }
        if (pm === PackageManager.BUN) {
          return { command: 'bun', args: targetScript === 'start' ? ['start'] : ['run', targetScript], cwd };
        }
        return { command: 'npm', args: targetScript === 'start' ? ['start'] : ['run', targetScript], cwd };
      },
    });

    // 2. Rust Provider
    this.registerProvider({
      id: ProjectType.RUST,
      name: 'Rust (Cargo)',
      resolveBuildCommand(_meta, cwd) {
        return { command: 'cargo', args: ['build'], cwd };
      },
      resolveRunCommand(_meta, cwd) {
        return { command: 'cargo', args: ['run'], cwd };
      },
    });

    // 3. Go Provider
    this.registerProvider({
      id: ProjectType.GO,
      name: 'Go Modules',
      resolveBuildCommand(_meta, cwd) {
        return { command: 'go', args: ['build', './...'], cwd };
      },
      resolveRunCommand(_meta, cwd) {
        return { command: 'go', args: ['run', '.'], cwd };
      },
    });

    // 4. Python Provider
    this.registerProvider({
      id: ProjectType.PYTHON,
      name: 'Python',
      resolveBuildCommand(_meta, cwd) {
        return { command: 'python3', args: ['-m', 'compileall', '.'], cwd };
      },
      resolveRunCommand(meta, cwd) {
        const entry = meta.configFile === 'main.py' ? 'main.py' : 'main.py';
        return { command: 'python3', args: [entry], cwd };
      },
    });

    // 5. Java Maven Provider
    this.registerProvider({
      id: ProjectType.JAVA_MAVEN,
      name: 'Java (Maven)',
      resolveBuildCommand(_meta, cwd) {
        return { command: 'mvn', args: ['compile'], cwd };
      },
      resolveRunCommand(_meta, cwd) {
        return { command: 'mvn', args: ['exec:java'], cwd };
      },
    });

    // 6. Java Gradle Provider
    this.registerProvider({
      id: ProjectType.JAVA_GRADLE,
      name: 'Java (Gradle)',
      resolveBuildCommand(_meta, cwd) {
        return { command: './gradlew', args: ['build'], cwd };
      },
      resolveRunCommand(_meta, cwd) {
        return { command: './gradlew', args: ['run'], cwd };
      },
    });

    // 7. CMake Provider
    this.registerProvider({
      id: ProjectType.CMAKE,
      name: 'C/C++ (CMake)',
      resolveBuildCommand(_meta, cwd) {
        return { command: 'cmake', args: ['--build', 'build'], cwd };
      },
      resolveRunCommand(_meta, cwd) {
        return { command: 'ctest', args: ['--test-dir', 'build'], cwd };
      },
    });

    // 8. Make Provider
    this.registerProvider({
      id: ProjectType.MAKE,
      name: 'C/C++ (Make)',
      resolveBuildCommand(_meta, cwd) {
        return { command: 'make', args: [], cwd };
      },
      resolveRunCommand(_meta, cwd) {
        return { command: 'make', args: ['run'], cwd };
      },
    });
  }
}

export const buildRegistry = new BuildRegistry();
