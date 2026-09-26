import assert from 'node:assert';
import {
  GitFileStatus,
  GitConflictType,
  GitStatusColor,
  normalizeStatusItem,
  categorizeStatus,
  isConflictCode,
  gitDiff,
  gitBranches,
  gitConflicts,
  gitCommands,
  gitManager,
} from '../src/git/index.js';

console.log('--- RUNNING LEVEL 3G GIT UNIT TESTS ---');

// Test 1: Types and Enums
console.log('Test 1: Types and Enums');
assert.strictEqual(GitFileStatus.MODIFIED, 'M');
assert.strictEqual(GitFileStatus.UNTRACKED, 'U');
assert.strictEqual(GitConflictType.BOTH_MODIFIED, 'UU');
assert.strictEqual(GitStatusColor.M, '#eab308');

// Test 2: Status Normalization & Categorization
console.log('Test 2: Status Normalization & Categorization');
assert.strictEqual(isConflictCode('UU'), true);
assert.strictEqual(isConflictCode('AA'), true);
assert.strictEqual(isConflictCode('M'), false);

const mockRawStatus = {
  is_repo: true,
  root: '/workspace/project',
  branch: 'main',
  is_detached: false,
  ahead: 2,
  behind: 1,
  staged: [
    { path: 'src/index.js', status: 'M' },
    { path: 'src/newFile.ts', status: 'A' },
  ],
  unstaged: [
    { path: 'README.md', status: 'M' },
  ],
  untracked: [
    { path: 'temp.log', status: 'U' },
  ],
  conflicts: [
    { path: 'src/conflict.js', status: 'UU', conflicted: true },
  ],
};

const categorized = categorizeStatus(mockRawStatus);
assert.strictEqual(categorized.isRepo, true);
assert.strictEqual(categorized.branch, 'main');
assert.strictEqual(categorized.ahead, 2);
assert.strictEqual(categorized.behind, 1);
assert.strictEqual(categorized.staged.length, 2);
assert.strictEqual(categorized.unstaged.length, 1);
assert.strictEqual(categorized.untracked.length, 1);
assert.strictEqual(categorized.conflicts.length, 1);
assert.strictEqual(categorized.totalChanges, 5);

// Test 3: Safe checkout check
console.log('Test 3: Uncommitted changes safety check');
assert.strictEqual(gitBranches.hasUncommittedChanges(mockRawStatus), true);
assert.strictEqual(gitBranches.hasUncommittedChanges({ is_repo: true, staged: [], unstaged: [] }), false);

// Test 4: Unified Diff Hunk Parsing for Gutter Indicators
console.log('Test 4: Unified Diff Hunk Parsing');
const mockDiff = `
diff --git a/src/app.js b/src/app.js
index 123456..789abc 100644
--- a/src/app.js
+++ b/src/app.js
@@ -10,0 +11,4 @@
+const a = 1;
+const b = 2;
+const c = 3;
+const d = 4;
@@ -25,3 +29,2 @@
-old line 1
-old line 2
-old line 3
+new line 1
+new line 2
@@ -40,2 +42,0 @@
-deleted line 1
-deleted line 2
`;

const hunks = gitDiff.parseDiffHunks(mockDiff);
assert.strictEqual(hunks.length, 3);
// Added lines hunk
assert.strictEqual(hunks[0].type, 'added');
assert.strictEqual(hunks[0].startLine, 11);
assert.strictEqual(hunks[0].endLine, 14);

// Modified lines hunk
assert.strictEqual(hunks[1].type, 'modified');
assert.strictEqual(hunks[1].startLine, 29);
assert.strictEqual(hunks[1].endLine, 30);

// Deleted lines hunk
assert.strictEqual(hunks[2].type, 'deleted');
assert.strictEqual(hunks[2].startLine, 42);

// Test 5: Conflict Marker Parser
console.log('Test 5: Conflict Marker Parser');
const conflictContent = `
function test() {
<<<<<<< HEAD
  const x = 'current branch change';
=======
  const x = 'incoming branch change';
>>>>>>> feature-branch
  return x;
}
`;

const parsedConflicts = gitConflicts.parseConflictMarkers(conflictContent);
assert.strictEqual(parsedConflicts.length, 1);
assert.strictEqual(parsedConflicts[0].current.trim(), "const x = 'current branch change';");
assert.strictEqual(parsedConflicts[0].incoming.trim(), "const x = 'incoming branch change';");
assert.strictEqual(parsedConflicts[0].currentBranchName, 'HEAD');
assert.strictEqual(parsedConflicts[0].incomingBranchName, 'feature-branch');

// Test 6: Security Assert Local Execution
console.log('Test 6: Security Assert Local Execution');
// In node test environment, isDesktopApp() is false so assertLocalExecution must throw!
assert.throws(() => {
  gitCommands.assertLocalExecution();
}, /Security check: Git execution is only allowed on the local desktop machine/);

// Test 7: GitManager Singleton & Pub-Sub
console.log('Test 7: GitManager Pub-Sub and Debounce');
let receivedEvent = null;
const unsub = gitManager.subscribe((event, data) => {
  receivedEvent = { event, data };
});
gitManager.notify('test-event', { ok: true });
assert.deepStrictEqual(receivedEvent, { event: 'test-event', data: { ok: true } });
unsub();

console.log('ALL 7 LEVEL 3G TESTS PASSED SUCCESSFULLY!');
