/**
 * CodeX Test Result Parser
 * Level 3D — Test Result Parsing
 *
 * Parses raw stdout/stderr from Vitest, Jest, Mocha, Pytest, Python unittest,
 * Cargo test, Go test, and JUnit Maven/Gradle into normalized test results
 * and problems for the Monaco editor.
 */

import { TestStatus } from './testTypes.js';

class TestResultParser {
  /**
   * Parses test output and updates individual test results & global counts.
   * @param {string} output - Raw process output chunk or full text
   * @param {string} [framework=''] - Detected test framework
   * @returns {{ results: Array<object>, summary: object, problems: Array<object> }}
   */
  parse(output, framework = '') {
    if (!output || typeof output !== 'string') {
      return { results: [], summary: { passed: 0, failed: 0, skipped: 0, total: 0 }, problems: [] };
    }

    const clean = output.replace(/\x1B\[[0-9;]*[mK]/g, ''); // Strip ANSI escape sequences
    const lines = clean.split('\n');

    const results = [];
    const problems = [];
    let passed = 0;
    let failed = 0;
    let skipped = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 1. Vitest / Jest Pattern (✓ / ✕ / ○ / PASS / FAIL)
      // e.g. " ✓ src/auth.test.ts > login > handles valid credentials (14ms)"
      // e.g. " ✕ src/auth.test.ts > login > rejects invalid password (22ms)"
      const vitestMatch = line.match(/^\s*([✓✔✕✖○!])\s+(.+?)(?:\s+\((\d+ms|\d+\.\d+s)\))?$/);
      if (vitestMatch) {
        const symbol = vitestMatch[1];
        const fullName = vitestMatch[2].trim();
        const durationStr = vitestMatch[3] || '0ms';
        const isPass = symbol === '✓' || symbol === '✔';
        const isFail = symbol === '✕' || symbol === '✖';
        const isSkip = symbol === '○' || symbol === '!';

        if (isPass) passed++;
        if (isFail) failed++;
        if (isSkip) skipped++;

        results.push({
          fullName,
          status: isPass ? TestStatus.PASSED : isFail ? TestStatus.FAILED : TestStatus.SKIPPED,
          duration: durationStr,
          message: isFail ? 'Test assertion failed' : '',
        });
        continue;
      }

      // 2. Pytest Pattern
      // e.g. "tests/test_auth.py::test_login PASSED [ 50%]"
      // e.g. "tests/test_auth.py::test_logout FAILED [100%]"
      // e.g. "tests/test_auth.py::test_skip SKIPPED"
      const pytestMatch = line.match(/^(\S+::\S+)\s+(PASSED|FAILED|SKIPPED|XFAIL|XPASS)/);
      if (pytestMatch) {
        const testPath = pytestMatch[1];
        const statusWord = pytestMatch[2];
        const isPass = statusWord === 'PASSED' || statusWord === 'XPASS';
        const isFail = statusWord === 'FAILED';
        const isSkip = statusWord === 'SKIPPED' || statusWord === 'XFAIL';

        if (isPass) passed++;
        if (isFail) failed++;
        if (isSkip) skipped++;

        results.push({
          fullName: testPath,
          status: isPass ? TestStatus.PASSED : isFail ? TestStatus.FAILED : TestStatus.SKIPPED,
          duration: '',
          message: isFail ? 'Pytest failure' : '',
        });
        continue;
      }

      // 3. Rust Cargo Test Pattern
      // e.g. "test tests::test_add ... ok"
      // e.g. "test tests::test_sub ... FAILED"
      // e.g. "test tests::test_ignored ... ignored"
      const cargoMatch = line.match(/^test\s+([^\s\.]+)\s+\.\.\.\s+(ok|FAILED|ignored)/);
      if (cargoMatch) {
        const testName = cargoMatch[1];
        const statusWord = cargoMatch[2];
        const isPass = statusWord === 'ok';
        const isFail = statusWord === 'FAILED';
        const isSkip = statusWord === 'ignored';

        if (isPass) passed++;
        if (isFail) failed++;
        if (isSkip) skipped++;

        results.push({
          fullName: testName,
          status: isPass ? TestStatus.PASSED : isFail ? TestStatus.FAILED : TestStatus.SKIPPED,
          duration: '',
          message: isFail ? 'Cargo test assertion failed' : '',
        });
        continue;
      }

      // 4. Go Test Pattern
      // e.g. "--- PASS: TestAdd (0.00s)"
      // e.g. "--- FAIL: TestSub (0.01s)"
      // e.g. "--- SKIP: TestIgnored (0.00s)"
      const goMatch = line.match(/^---\s+(PASS|FAIL|SKIP):\s+([^\s\(]+)(?:\s+\(([0-9\.]+)s\))?/);
      if (goMatch) {
        const statusWord = goMatch[1];
        const testName = goMatch[2];
        const durationSec = goMatch[3] ? `${parseFloat(goMatch[3]) * 1000}ms` : '';
        const isPass = statusWord === 'PASS';
        const isFail = statusWord === 'FAIL';
        const isSkip = statusWord === 'SKIP';

        if (isPass) passed++;
        if (isFail) failed++;
        if (isSkip) skipped++;

        results.push({
          fullName: testName,
          status: isPass ? TestStatus.PASSED : isFail ? TestStatus.FAILED : TestStatus.SKIPPED,
          duration: durationSec,
          message: isFail ? 'Go test failed' : '',
        });
        continue;
      }

      // 5. Python Unittest Pattern
      // e.g. "test_add (test_math.TestMath) ... ok"
      // e.g. "test_sub (test_math.TestMath) ... FAIL"
      const unittestMatch = line.match(/^([a-zA-Z0-9_]+)\s+\((.+?)\)\s+\.\.\.\s+(ok|FAIL|ERROR)/);
      if (unittestMatch) {
        const testMethod = unittestMatch[1];
        const testClass = unittestMatch[2];
        const statusWord = unittestMatch[3];
        const isPass = statusWord === 'ok';
        const isFail = statusWord === 'FAIL' || statusWord === 'ERROR';

        if (isPass) passed++;
        if (isFail) failed++;

        results.push({
          fullName: `${testClass}.${testMethod}`,
          status: isPass ? TestStatus.PASSED : TestStatus.FAILED,
          duration: '',
          message: isFail ? 'Unittest assertion failed' : '',
        });
        continue;
      }

      // 6. Source Location & Failure Extraction for Problems Panel
      // Matches standard stack frame formats:
      // at <function> (<path>:<line>:<col>)
      // File "<path>", line <line>, in <function>
      // <path>:<line>:<col>: error
      // <path>:<line>: assertion failed
      const stackMatchAt = line.match(/^\s*at\s+(?:.+?\s+\()?([a-zA-Z0-9_\-\/\.\\]+\.[a-zA-Z0-9]+):(\d+):(\d+)\)?$/);
      if (stackMatchAt) {
        const filePath = stackMatchAt[1];
        const lineNum = parseInt(stackMatchAt[2], 10);
        const colNum = parseInt(stackMatchAt[3], 10);
        if (!filePath.includes('node_modules')) {
          problems.push({
            file: filePath.replace(/\\/g, '/'),
            line: lineNum,
            column: colNum,
            severity: 'error',
            message: lines[Math.max(0, i - 1)]?.trim() || 'Test assertion failure',
            source: 'test',
          });
        }
      }

      const pyStackMatch = line.match(/^\s*File\s+"([^"]+)",\s+line\s+(\d+),\s+in\s+(\S+)/);
      if (pyStackMatch) {
        const filePath = pyStackMatch[1];
        const lineNum = parseInt(pyStackMatch[2], 10);
        const nextLine = lines[i + 1] || '';
        const errMsg = lines[i + 2] || nextLine;
        problems.push({
          file: filePath.replace(/\\/g, '/'),
          line: lineNum,
          column: 1,
          severity: 'error',
          message: errMsg.trim() || 'Pytest test failure',
          source: 'test',
        });
      }

      const rustStackMatch = line.match(/^\s*-->\s+([a-zA-Z0-9_\-\/\.\\]+\.rs):(\d+):(\d+)/);
      if (rustStackMatch) {
        const filePath = rustStackMatch[1];
        const lineNum = parseInt(rustStackMatch[2], 10);
        const colNum = parseInt(rustStackMatch[3], 10);
        problems.push({
          file: filePath.replace(/\\/g, '/'),
          line: lineNum,
          column: colNum,
          severity: 'error',
          message: 'Rust test assertion failure',
          source: 'test',
        });
      }

      const goErrMatch = line.match(/^\s*([a-zA-Z0-9_\-\/\.\\]+_test\.go):(\d+):\s*(.*)$/);
      if (goErrMatch) {
        const filePath = goErrMatch[1];
        const lineNum = parseInt(goErrMatch[2], 10);
        const msg = goErrMatch[3].trim() || 'Go test failure';
        problems.push({
          file: filePath.replace(/\\/g, '/'),
          line: lineNum,
          column: 1,
          severity: 'error',
          message: msg,
          source: 'test',
        });
      }
    }

    // Fallback: Check summary lines if individual tests weren't captured
    // e.g. "Tests: 12 passed, 2 failed, 14 total"
    const summaryMatch = clean.match(/Tests:\s+(?:(\d+)\s+failed,?\s*)?(?:(\d+)\s+passed,?\s*)?(?:(\d+)\s+skipped,?\s*)?(\d+)\s+total/i);
    if (summaryMatch) {
      if (summaryMatch[1]) failed = parseInt(summaryMatch[1], 10);
      if (summaryMatch[2]) passed = parseInt(summaryMatch[2], 10);
      if (summaryMatch[3]) skipped = parseInt(summaryMatch[3], 10);
    }

    // JUnit summary match: "Tests run: 5, Failures: 1, Errors: 0, Skipped: 0"
    const junitSummary = clean.match(/Tests run:\s*(\d+),\s*Failures:\s*(\d+),\s*Errors:\s*(\d+),\s*Skipped:\s*(\d+)/i);
    if (junitSummary) {
      const total = parseInt(junitSummary[1], 10);
      const fails = parseInt(junitSummary[2], 10) + parseInt(junitSummary[3], 10);
      const skips = parseInt(junitSummary[4], 10);
      failed = fails;
      skipped = skips;
      passed = Math.max(0, total - fails - skips);
    }

    const total = passed + failed + skipped || results.length;

    return {
      results,
      summary: {
        passed,
        failed,
        skipped,
        total,
      },
      problems,
    };
  }
}

export const testResultParser = new TestResultParser();
