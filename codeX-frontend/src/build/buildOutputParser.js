/**
 * CodeX Build Output Parser
 * Level 3C — Structured Error Parsing for Problems Panel
 *
 * Parses compiler, runtime, and linter errors from build/run output streams into
 * structured problem objects:
 * { file, line, column, severity, message, source }
 *
 * Supports:
 * - TypeScript / JavaScript (tsc, node)
 * - Python (tracebacks, syntax errors)
 * - Rust (cargo, rustc)
 * - Go (go build, go run)
 * - GCC / Clang (c, cpp)
 * - Java (javac, maven, gradle)
 */

class BuildOutputParser {
  /**
   * Parses raw output text and returns an array of structured problem objects.
   * @param {string} text - Raw output text (stdout/stderr)
   * @param {string} [workspaceRoot=''] - Workspace root directory for relative path resolution
   * @returns {Array<object>} Parsed problems
   */
  parse(text, workspaceRoot = '') {
    if (!text || typeof text !== 'string') return [];

    const problems = [];
    const lines = text.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // 1. TypeScript / TSC: file.ts(12,5): error TS2322: ...
      const tsMatch = line.match(/^([^\(\r\n]+\.(?:ts|tsx|js|jsx))\s*\((\d+),(\d+)\):\s*(error|warning)\s*([A-Za-z0-9]+)?:\s*(.*)$/);
      if (tsMatch) {
        problems.push({
          file: this.resolveFilePath(tsMatch[1], workspaceRoot),
          line: parseInt(tsMatch[2], 10),
          column: parseInt(tsMatch[3], 10),
          severity: tsMatch[4].toLowerCase() === 'warning' ? 'warning' : 'error',
          message: tsMatch[5] ? `TS${tsMatch[5]}: ${tsMatch[6]}` : tsMatch[6],
          source: 'TypeScript',
        });
        continue;
      }

      // 2. GCC / Clang / Make: file.c:14:5: error: ...
      const gccMatch = line.match(/^([^:\r\n]+\.(?:c|cpp|cc|cxx|h|hpp)):(\d+):(\d+):\s*(fatal error|error|warning|note):\s*(.*)$/i);
      if (gccMatch) {
        const sev = gccMatch[4].toLowerCase().includes('warning') ? 'warning' : 'error';
        problems.push({
          file: this.resolveFilePath(gccMatch[1], workspaceRoot),
          line: parseInt(gccMatch[2], 10),
          column: parseInt(gccMatch[3], 10),
          severity: sev,
          message: gccMatch[5],
          source: 'GCC/Clang',
        });
        continue;
      }

      // 3. Go: file.go:15:2: undefined: ...
      const goMatch = line.match(/^([^:\r\n]+\.go):(\d+):(\d+):\s*(.*)$/);
      if (goMatch) {
        problems.push({
          file: this.resolveFilePath(goMatch[1], workspaceRoot),
          line: parseInt(goMatch[2], 10),
          column: parseInt(goMatch[3], 10),
          severity: 'error',
          message: goMatch[4],
          source: 'Go',
        });
        continue;
      }

      // 4. Java: [ERROR] /path/to/File.java:[23,12] message or File.java:23: error: message
      const javaMatch = line.match(/^(?:\[ERROR\]\s*)?([^:\[\r\n]+\.java):(?:\[(\d+),(\d+)\]|(\d+))(?::\s*(error|warning)?:)?\s*(.*)$/);
      if (javaMatch) {
        const lineNum = javaMatch[2] ? parseInt(javaMatch[2], 10) : parseInt(javaMatch[4], 10);
        const colNum = javaMatch[3] ? parseInt(javaMatch[3], 10) : 1;
        const sev = javaMatch[5]?.toLowerCase() === 'warning' ? 'warning' : 'error';
        problems.push({
          file: this.resolveFilePath(javaMatch[1], workspaceRoot),
          line: lineNum,
          column: colNum,
          severity: sev,
          message: javaMatch[6] || 'Java compilation error',
          source: 'Java',
        });
        continue;
      }

      // 5. Rust Cargo / rustc: error[E0425]: cannot find value ... followed by --> file:line:col
      const rustArrowMatch = line.match(/^\s*-->\s*([^:\r\n]+):(\d+):(\d+)$/);
      if (rustArrowMatch) {
        let rustMsg = 'Rust compilation error';
        if (i > 0) {
          const prev = lines[i - 1].trim();
          if (prev.startsWith('error') || prev.startsWith('warning')) {
            rustMsg = prev;
          }
        }
        problems.push({
          file: this.resolveFilePath(rustArrowMatch[1], workspaceRoot),
          line: parseInt(rustArrowMatch[2], 10),
          column: parseInt(rustArrowMatch[3], 10),
          severity: rustMsg.startsWith('warning') ? 'warning' : 'error',
          message: rustMsg,
          source: 'Rust',
        });
        continue;
      }

      // 6. Python Traceback: File "file.py", line 12, in <module>
      const pyFileMatch = line.match(/^File\s+"([^"]+\.py)",\s+line\s+(\d+)(?:,\s+in\s+.*)?$/);
      if (pyFileMatch) {
        let pyMsg = 'Python runtime error';
        for (let j = i + 1; j < Math.min(lines.length, i + 4); j++) {
          const check = lines[j].trim();
          if (check.match(/^[A-Za-z_][A-Za-z0-9_]*(?:Error|Exception|Warning):/)) {
            pyMsg = check;
            break;
          }
        }
        problems.push({
          file: this.resolveFilePath(pyFileMatch[1], workspaceRoot),
          line: parseInt(pyFileMatch[2], 10),
          column: 1,
          severity: pyMsg.includes('Warning') ? 'warning' : 'error',
          message: pyMsg,
          source: 'Python',
        });
        continue;
      }

      // 7. Node / V8 stack frame: at Object.<anonymous> (/path/to/file.js:12:5)
      const nodeStackMatch = line.match(/^\s*at\s+(?:.*?\s+\()?([^:\r\n\(\)]+\.(?:js|mjs|cjs|ts|tsx)):(\d+):(\d+)\)?$/);
      if (nodeStackMatch) {
        let nodeMsg = 'Runtime exception';
        if (i > 0) {
          const prev = lines[i - 1].trim();
          if (prev && !prev.startsWith('at ')) {
            nodeMsg = prev;
          }
        }
        problems.push({
          file: this.resolveFilePath(nodeStackMatch[1], workspaceRoot),
          line: parseInt(nodeStackMatch[2], 10),
          column: parseInt(nodeStackMatch[3], 10),
          severity: 'error',
          message: nodeMsg,
          source: 'Node.js',
        });
        continue;
      }
    }

    return problems;
  }

  resolveFilePath(relOrAbsPath, workspaceRoot) {
    let clean = relOrAbsPath.trim().replace(/^['"]|['"]$/g, '');
    clean = clean.replace(/\\/g, '/');

    if (!clean.startsWith('/') && !clean.includes(':/') && workspaceRoot) {
      const cleanRoot = workspaceRoot.replace(/\\/g, '/').replace(/\/+$/, '');
      clean = `${cleanRoot}/${clean.replace(/^\.\//, '')}`;
    }

    return clean;
  }
}

export const buildOutputParser = new BuildOutputParser();
