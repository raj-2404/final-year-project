/**
 * CodeX Monaco Editor Options Configuration
 * Level 1 — Syntax Foundation + Level 2 — Language Intelligence
 *
 * Provides:
 * - Level 1: Syntax coloring, bracket pair colorization, folding, indentation guides
 * - Level 2: Autocomplete / IntelliSense, Hover, Go to Definition, References,
 *            Diagnostics, Lightbulb, Formatting, Parameter Hints
 */

/**
 * Returns complete Monaco editor options with optional overrides.
 * @param {object} [customOverrides={}] - Custom option overrides
 * @returns {object} Monaco editor options object
 */
export function getEditorOptions(customOverrides = {}) {
  return {
    // 1. Font & Typography
    fontFamily:
      "'JetBrains Mono', 'Fira Code', 'Menlo', 'Monaco', 'Consolas', 'Courier New', monospace",
    fontSize: 13.5,
    lineHeight: 22,
    fontLigatures: true,
    letterSpacing: 0.2,

    // 2. Line Numbers & Gutter (Glyph margin enabled for error squiggles/markers)
    lineNumbers: 'on',
    lineNumbersMinChars: 3,
    lineDecorationsWidth: 10,
    glyphMargin: true,

    // 3. Current-line & Selection Highlighting
    renderLineHighlight: 'all',
    renderLineHighlightOnlyWhenFocus: false,
    renderWhitespace: 'selection',

    // 4. Cursor Behavior
    cursorBlinking: 'smooth',
    cursorSmoothCaretAnimation: 'on',
    cursorStyle: 'line',
    cursorWidth: 2,

    // 5. Bracket Matching & Colorization (Level 1 Foundation)
    matchBrackets: 'always',
    bracketPairColorization: {
      enabled: true,
      independentColorPoolPerBracketType: true,
    },

    // 6. Indentation & Structural Guides
    autoIndent: 'full',
    tabSize: 2,
    insertSpaces: true,
    detectIndentation: true,
    guides: {
      bracketPairs: true,
      bracketPairsHorizontal: true,
      highlightActiveBracketPair: true,
      indentation: true,
      highlightActiveIndentation: true,
    },

    // 7. Code Folding
    folding: true,
    foldingStrategy: 'auto',
    showFoldingControls: 'always',
    foldingHighlight: true,
    unfoldOnClickAfterEndOfLine: true,

    // 8. Minimap
    minimap: {
      enabled: true,
      maxColumn: 80,
      renderCharacters: false,
      scale: 1,
    },

    // 9. Scrolling & Layout
    scrollBeyondLastLine: false,
    smoothScrolling: true,
    automaticLayout: true,
    padding: {
      top: 8,
      bottom: 8,
    },

    // 10. Word Wrap & Text Flow
    wordWrap: 'on',
    wrappingStrategy: 'advanced',
    wrappingIndent: 'indent',

    // 11. Readability & Context Menu
    overviewRulerBorder: false,
    hideCursorInOverviewRuler: true,
    contextmenu: true,

    // ==========================================
    // LEVEL 2 — LANGUAGE INTELLIGENCE OPTIONS
    // ==========================================

    // 12. Autocomplete / IntelliSense
    suggestOnTriggerCharacters: true,
    quickSuggestions: {
      other: 'on',
      comments: 'off',
      strings: 'on',
    },
    quickSuggestionsDelay: 10,
    suggest: {
      showKeywords: true,
      showSnippets: true,
      showWords: true,
      showClasses: true,
      showFunctions: true,
      showVariables: true,
      showModules: true,
      showProperties: true,
      showInterfaces: true,
      showTypes: true,
      showIcons: true,
      showMethods: true,
      preview: true,
      previewMode: 'prefix',
      shareSuggestSelections: true,
    },
    acceptSuggestionOnCommitCharacter: true,
    acceptSuggestionOnEnter: 'on',
    snippetSuggestions: 'inline',
    wordBasedSuggestions: 'matchingDocuments',

    // 13. Parameter Hints
    parameterHints: {
      enabled: true,
      cycle: true,
    },

    // 14. Hover Information
    hover: {
      enabled: true,
      delay: 300,
      sticky: true,
    },

    // 15. Go To Definition & References Navigation
    definitionLinkOpensInPeek: false,
    gotoLocation: {
      multiple: 'peek',
      multipleDefinitions: 'peek',
      multipleTypeDefinitions: 'peek',
      multipleDeclarations: 'peek',
      multipleImplementations: 'peek',
      multipleReferences: 'peek',
    },

    // 16. Code Actions & Lightbulb
    lightbulb: {
      enabled: 'on',
    },

    // 17. Formatting
    formatOnType: true,
    formatOnPaste: false,

    ...customOverrides,
  };
}
