/**
 * CodeX Test Discovery Engine
 * Level 3D — Asynchronous Test Discovery
 *
 * Scans workspace files and parses test suite / test case definitions
 * without blocking editor performance.
 */

import { TestNodeType, TestStatus } from './testTypes.js';

class TestDiscovery {
  /**
   * Discovers tests from fileTree and populates testTree.
   * @param {Array<object>} testFiles
   * @param {import('./testTree.js').TestTree} testTree
   * @param {string} framework
   * @param {string} workspaceRoot
   */
  async discover(testFiles = [], testTree, framework = '', workspaceRoot = '') {
    testTree.clear();

    const projectRootId = 'project_root';
    testTree.addNode({
      id: projectRootId,
      name: workspaceRoot ? workspaceRoot.split('/').pop() || 'Workspace' : 'Workspace',
      label: workspaceRoot ? workspaceRoot.split('/').pop() || 'Workspace' : 'Workspace',
      type: TestNodeType.PROJECT,
      framework,
      status: TestStatus.UNKNOWN,
    });

    for (const file of testFiles) {
      const filePath = file.path || file.name || '';
      const fileName = file.name || filePath.split('/').pop() || '';
      const fileId = `file_${filePath}`;

      testTree.addNode({
        id: fileId,
        name: fileName,
        label: fileName,
        type: TestNodeType.FILE,
        file: filePath,
        parentId: projectRootId,
        framework,
        status: TestStatus.UNKNOWN,
      });

      // Parse file content if available
      const content = file.content || '';
      if (!content) continue;

      this.parseFileContent(content, filePath, fileId, testTree, framework);
    }
  }

  parseFileContent(content, filePath, fileId, testTree, framework) {
    const lines = content.split('\n');
    let currentSuiteId = fileId;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      const lineNum = lineIdx + 1;

      // JS/TS: describe(...)
      const describeMatch = line.match(/describe\s*\(\s*['"`](.+?)['"`]/);
      if (describeMatch) {
        const suiteName = describeMatch[1];
        const suiteId = `${fileId}_suite_${lineNum}`;
        testTree.addNode({
          id: suiteId,
          name: suiteName,
          label: suiteName,
          type: TestNodeType.SUITE,
          file: filePath,
          line: lineNum,
          column: describeMatch.index ? describeMatch.index + 1 : 1,
          parentId: fileId,
          framework,
          status: TestStatus.UNKNOWN,
        });
        currentSuiteId = suiteId;
        continue;
      }

      // JS/TS: it(...) or test(...)
      const testMatch = line.match(/(?:it|test)\s*\(\s*['"`](.+?)['"`]/);
      if (testMatch) {
        const testName = testMatch[1];
        const testId = `${fileId}_test_${lineNum}`;
        testTree.addNode({
          id: testId,
          name: testName,
          label: testName,
          type: TestNodeType.TEST,
          file: filePath,
          line: lineNum,
          column: testMatch.index ? testMatch.index + 1 : 1,
          parentId: currentSuiteId,
          framework,
          status: TestStatus.UNKNOWN,
        });
        continue;
      }

      // Python: class TestFoo:
      const pyClassMatch = line.match(/class\s+(Test[a-zA-Z0-9_]*)\s*[:\(]/);
      if (pyClassMatch) {
        const suiteName = pyClassMatch[1];
        const suiteId = `${fileId}_suite_${lineNum}`;
        testTree.addNode({
          id: suiteId,
          name: suiteName,
          label: suiteName,
          type: TestNodeType.SUITE,
          file: filePath,
          line: lineNum,
          column: 1,
          parentId: fileId,
          framework,
          status: TestStatus.UNKNOWN,
        });
        currentSuiteId = suiteId;
        continue;
      }

      // Python: def test_foo(self):
      const pyFuncMatch = line.match(/def\s+(test_[a-zA-Z0-9_]*)\s*\(/);
      if (pyFuncMatch) {
        const testName = pyFuncMatch[1];
        const testId = `${fileId}_test_${lineNum}`;
        testTree.addNode({
          id: testId,
          name: testName,
          label: testName,
          type: TestNodeType.TEST,
          file: filePath,
          line: lineNum,
          column: 1,
          parentId: currentSuiteId,
          framework,
          status: TestStatus.UNKNOWN,
        });
        continue;
      }

      // Go: func TestFoo(t *testing.T)
      const goTestMatch = line.match(/func\s+(Test[a-zA-Z0-9_]*)\s*\(/);
      if (goTestMatch) {
        const testName = goTestMatch[1];
        const testId = `${fileId}_test_${lineNum}`;
        testTree.addNode({
          id: testId,
          name: testName,
          label: testName,
          type: TestNodeType.TEST,
          file: filePath,
          line: lineNum,
          column: 1,
          parentId: fileId,
          framework,
          status: TestStatus.UNKNOWN,
        });
        continue;
      }

      // Rust: #[test] followed by fn foo()
      if (line.includes('#[test]')) {
        const nextLine = lines[lineIdx + 1] || '';
        const rustFnMatch = nextLine.match(/fn\s+([a-zA-Z0-9_]+)\s*\(/);
        if (rustFnMatch) {
          const testName = rustFnMatch[1];
          const testId = `${fileId}_test_${lineNum + 1}`;
          testTree.addNode({
            id: testId,
            name: testName,
            label: testName,
            type: TestNodeType.TEST,
            file: filePath,
            line: lineNum + 1,
            column: 1,
            parentId: fileId,
            framework,
            status: TestStatus.UNKNOWN,
          });
        }
        continue;
      }

      // Java: @Test followed by void testFoo()
      if (line.includes('@Test')) {
        const nextLine = lines[lineIdx + 1] || '';
        const javaFnMatch = nextLine.match(/void\s+([a-zA-Z0-9_]+)\s*\(/);
        if (javaFnMatch) {
          const testName = javaFnMatch[1];
          const testId = `${fileId}_test_${lineNum + 1}`;
          testTree.addNode({
            id: testId,
            name: testName,
            label: testName,
            type: TestNodeType.TEST,
            file: filePath,
            line: lineNum + 1,
            column: 1,
            parentId: fileId,
            framework,
            status: TestStatus.UNKNOWN,
          });
        }
        continue;
      }
    }
  }
}

export const testDiscovery = new TestDiscovery();
