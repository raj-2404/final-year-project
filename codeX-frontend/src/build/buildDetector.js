/**
 * CodeX Build & Project Detector
 * Level 3C — Build & Run Project Detection
 *
 * Detects:
 * - Project ecosystem (Node, Python, Rust, Go, Java, C/C++)
 * - Package manager (npm, pnpm, yarn, bun) based on lockfile presence
 * - Package.json scripts (build, start, dev, test)
 * - Active file runnability
 */

import { PackageManager, ProjectType } from './buildTypes.js';

class BuildDetector {
  /**
   * Analyzes fileTree and returns project metadata.
   * @param {Array<object>} fileTree - Virtual or native file tree
   * @param {string} [workspaceRoot=''] - Workspace root path
   * @returns {object} Project detection result
   */
  detectProject(fileTree = [], workspaceRoot = '') {
    const fileNames = new Set(
      fileTree.map((f) => (f.name || f.path?.split('/').pop() || '').toLowerCase())
    );

    // 1. Detect Package Manager (Lockfile check)
    let packageManager = PackageManager.NPM;
    if (fileNames.has('pnpm-lock.yaml')) {
      packageManager = PackageManager.PNPM;
    } else if (fileNames.has('yarn.lock')) {
      packageManager = PackageManager.YARN;
    } else if (fileNames.has('bun.lock') || fileNames.has('bun.lockb')) {
      packageManager = PackageManager.BUN;
    } else if (fileNames.has('package-lock.json')) {
      packageManager = PackageManager.NPM;
    }

    // 2. JavaScript / TypeScript Project (package.json)
    if (fileNames.has('package.json')) {
      const packageJsonFile = fileTree.find(
        (f) => (f.name || '').toLowerCase() === 'package.json'
      );
      let scripts = {};
      if (packageJsonFile?.content) {
        try {
          const parsed = JSON.parse(packageJsonFile.content);
          scripts = parsed.scripts || {};
        } catch {}
      }

      return {
        type: ProjectType.NODE,
        packageManager,
        scripts,
        hasBuildScript: Boolean(scripts.build),
        hasStartScript: Boolean(scripts.start),
        hasDevScript: Boolean(scripts.dev),
        hasTestScript: Boolean(scripts.test),
        configFile: 'package.json',
      };
    }

    // 3. Rust Cargo Project (Cargo.toml)
    if (fileNames.has('cargo.toml')) {
      return {
        type: ProjectType.RUST,
        configFile: 'Cargo.toml',
      };
    }

    // 4. Go Module Project (go.mod)
    if (fileNames.has('go.mod')) {
      return {
        type: ProjectType.GO,
        configFile: 'go.mod',
      };
    }

    // 5. Python Project (pyproject.toml, requirements.txt, setup.py, main.py)
    if (
      fileNames.has('pyproject.toml') ||
      fileNames.has('requirements.txt') ||
      fileNames.has('setup.py') ||
      fileNames.has('main.py')
    ) {
      return {
        type: ProjectType.PYTHON,
        configFile: fileNames.has('pyproject.toml')
          ? 'pyproject.toml'
          : fileNames.has('requirements.txt')
          ? 'requirements.txt'
          : 'main.py',
      };
    }

    // 6. Java Projects (pom.xml or build.gradle)
    if (fileNames.has('pom.xml')) {
      return {
        type: ProjectType.JAVA_MAVEN,
        configFile: 'pom.xml',
      };
    }

    if (fileNames.has('build.gradle') || fileNames.has('build.gradle.kts')) {
      return {
        type: ProjectType.JAVA_GRADLE,
        configFile: fileNames.has('build.gradle.kts') ? 'build.gradle.kts' : 'build.gradle',
      };
    }

    // 7. C / C++ Projects (CMakeLists.txt, Makefile)
    if (fileNames.has('cmakelists.txt')) {
      return {
        type: ProjectType.CMAKE,
        configFile: 'CMakeLists.txt',
      };
    }

    if (fileNames.has('makefile') || fileNames.has('gnumakefile')) {
      return {
        type: ProjectType.MAKE,
        configFile: 'Makefile',
      };
    }

    return {
      type: ProjectType.GENERIC,
      packageManager: PackageManager.NPM,
      configFile: null,
    };
  }

  /**
   * Determines if a specific file can be executed directly ("Run File").
   * @param {object} file - File item
   * @returns {boolean} True if file can be run directly
   */
  canRunFile(file) {
    if (!file || file.type === 'folder') return false;
    const name = (file.name || file.path || '').toLowerCase();
    const ext = name.split('.').pop();

    const runnableExts = [
      'js', 'mjs', 'cjs',
      'ts', 'tsx',
      'py', 'pyw',
      'go',
      'rs',
      'c', 'cpp',
      'sh', 'bash',
    ];

    return runnableExts.includes(ext);
  }

  /**
   * Returns default run command for a single file.
   * @param {object} file - Active file item
   * @returns {{ executable: string, args: string[] }|null}
   */
  resolveFileRunCommand(file) {
    if (!this.canRunFile(file)) return null;

    const name = file.name || file.path || '';
    const filePath = file.path || file.name || '';
    const ext = name.toLowerCase().split('.').pop();

    switch (ext) {
      case 'js':
      case 'mjs':
      case 'cjs':
        return { executable: 'node', args: [filePath] };

      case 'ts':
      case 'tsx':
        // Try ts-node or bun or node
        return { executable: 'node', args: [filePath] };

      case 'py':
      case 'pyw':
        return { executable: 'python3', args: [filePath] };

      case 'go':
        return { executable: 'go', args: ['run', filePath] };

      case 'rs':
        return { executable: 'rustc', args: [filePath, '-o', 'temp_run_bin'] };

      case 'sh':
      case 'bash':
        return { executable: 'bash', args: [filePath] };

      default:
        return null;
    }
  }
}

export const buildDetector = new BuildDetector();
