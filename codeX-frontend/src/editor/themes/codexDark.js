/**
 * CodeX Dark Editor Theme
 * Professional, restrained IDE color palette inspired by modern VS Code Dark+
 * Provides clear syntax differentiation across all supported languages.
 */

export const CODEX_DARK_THEME_NAME = 'codex-dark';

export const codexDarkTheme = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    // Default text
    { token: '', foreground: 'd4d4d4', background: '1e1e1e' },

    // Comments - muted, readable, non-competing
    { token: 'comment', foreground: '6a9955', fontStyle: 'italic' },
    { token: 'comment.doc', foreground: '6a9955', fontStyle: 'italic' },
    { token: 'comment.block', foreground: '6a9955', fontStyle: 'italic' },
    { token: 'comment.line', foreground: '6a9955', fontStyle: 'italic' },

    // Strings
    { token: 'string', foreground: 'ce9178' },
    { token: 'string.quote', foreground: 'ce9178' },
    { token: 'string.escape', foreground: 'd7ba7d' },
    { token: 'string.regex', foreground: 'd16969' },
    { token: 'regexp', foreground: 'd16969' },

    // Numbers & Booleans
    { token: 'number', foreground: 'b5cea8' },
    { token: 'number.hex', foreground: 'b5cea8' },
    { token: 'number.float', foreground: 'b5cea8' },
    { token: 'constant.numeric', foreground: 'b5cea8' },
    { token: 'constant.language', foreground: '569cd6' },

    // Keywords
    { token: 'keyword', foreground: 'c586c0' },
    { token: 'keyword.control', foreground: 'c586c0' },
    { token: 'keyword.import', foreground: 'c586c0' },
    { token: 'keyword.export', foreground: 'c586c0' },
    { token: 'keyword.from', foreground: 'c586c0' },
    { token: 'keyword.operator', foreground: '569cd6' },
    { token: 'keyword.other', foreground: '569cd6' },
    { token: 'storage', foreground: '569cd6' },
    { token: 'storage.type', foreground: '569cd6' },
    { token: 'storage.modifier', foreground: '569cd6' },

    // Variables, Parameters & Constants
    { token: 'identifier', foreground: '9cdcfe' },
    { token: 'variable', foreground: '9cdcfe' },
    { token: 'variable.parameter', foreground: '9cdcfe' },
    { token: 'variable.predefined', foreground: '4fc1ff' },
    { token: 'variable.other.constant', foreground: '4fc1ff' },
    { token: 'constant', foreground: '4fc1ff' },

    // Functions & Methods
    { token: 'entity.name.function', foreground: 'dcdcaa' },
    { token: 'support.function', foreground: 'dcdcaa' },
    { token: 'function', foreground: 'dcdcaa' },
    { token: 'method', foreground: 'dcdcaa' },

    // Classes, Types & Interfaces
    { token: 'entity.name.type', foreground: '4ec9b0' },
    { token: 'entity.name.class', foreground: '4ec9b0' },
    { token: 'support.type', foreground: '4ec9b0' },
    { token: 'support.class', foreground: '4ec9b0' },
    { token: 'type', foreground: '4ec9b0' },
    { token: 'type.identifier', foreground: '4ec9b0' },
    { token: 'constructor', foreground: '4ec9b0' },

    // JSX / HTML Tags & Components
    { token: 'tag', foreground: '569cd6' },
    { token: 'tag.id', foreground: '4ec9b0' },
    { token: 'tag.class', foreground: '4ec9b0' },
    { token: 'tag.tag-name', foreground: '569cd6' },
    { token: 'entity.name.tag', foreground: '569cd6' },
    { token: 'entity.name.tag.jsx', foreground: '4ec9b0' },
    { token: 'entity.name.tag.tsx', foreground: '4ec9b0' },

    // JSX / HTML Attributes
    { token: 'tag.attribute', foreground: '9cdcfe' },
    { token: 'attribute.name', foreground: '9cdcfe' },
    { token: 'entity.other.attribute-name', foreground: '9cdcfe' },
    { token: 'attribute.value', foreground: 'ce9178' },
    { token: 'metatag', foreground: '569cd6' },

    // Properties
    { token: 'property', foreground: '9cdcfe' },
    { token: 'variable.property', foreground: '9cdcfe' },
    { token: 'support.type.property-name', foreground: '9cdcfe' },

    // Operators & Delimiters
    { token: 'operator', foreground: 'd4d4d4' },
    { token: 'delimiter', foreground: 'd4d4d4' },
    { token: 'delimiter.bracket', foreground: 'ffd700' },
    { token: 'delimiter.parenthesis', foreground: 'ffd700' },
    { token: 'delimiter.square', foreground: 'ffd700' },
    { token: 'delimiter.html', foreground: '808080' },
    { token: 'punctuation', foreground: 'd4d4d4' },

    // CSS specific rules
    { token: 'attribute.value.css', foreground: 'ce9178' },
    { token: 'attribute.value.unit', foreground: 'b5cea8' },
    { token: 'string.css', foreground: 'ce9178' },
    { token: 'number.css', foreground: 'b5cea8' },
  ],
  colors: {
    // Editor Surface
    'editor.background': '#1e1e1e',
    'editor.foreground': '#d4d4d4',
    'editor.lineHighlightBackground': '#2a2d2e55',
    'editor.lineHighlightBorder': '#00000000',
    'editor.selectionBackground': '#264f78',
    'editor.inactiveSelectionBackground': '#3a3d4180',
    'editorCursor.foreground': '#528bff',

    // Whitespace & Line Numbers
    'editorWhitespace.foreground': '#3b3a32',
    'editorLineNumber.foreground': '#6e7681',
    'editorLineNumber.activeForeground': '#c6c6c6',

    // Indentation & Guides
    'editorIndentGuide.background': '#404040',
    'editorIndentGuide.activeBackground': '#707070',

    // Bracket Highlighting & Guides
    'editorBracketMatch.background': '#00640026',
    'editorBracketMatch.border': '#888888',
    'editorBracketHighlight.foreground1': '#ffd700',
    'editorBracketHighlight.foreground2': '#da70d6',
    'editorBracketHighlight.foreground3': '#179fff',
    'editorBracketPairGuide.activeBackground1': '#ffd70080',
    'editorBracketPairGuide.activeBackground2': '#da70d680',
    'editorBracketPairGuide.activeBackground3': '#179fff80',

    // Gutter & Folding Controls
    'editorGutter.background': '#1e1e1e',
    'editorGutter.foldingControlForeground': '#c5c5c5',

    // Widgets
    'editorWidget.background': '#252526',
    'editorWidget.border': '#454545',
    'editorWidget.foreground': '#cccccc',
  },
};
