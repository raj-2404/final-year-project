/**
 * Centralized Language Detection for CodeX Editor
 * Accurately detects Monaco language ID from file name/extension.
 * Never defaults recognized source files to plaintext.
 */

// Extension to Monaco Language ID mappings
const EXTENSION_MAP = {
  // JavaScript & TypeScript
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  mts: 'typescript',
  cts: 'typescript',

  // Web Styles
  css: 'css',
  scss: 'scss',
  sass: 'scss',
  less: 'less',

  // Markup & Data
  html: 'html',
  htm: 'html',
  xhtml: 'html',
  xml: 'xml',
  svg: 'xml',
  plist: 'xml',
  json: 'json',
  jsonc: 'json',
  json5: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  ini: 'ini',
  cfg: 'ini',
  conf: 'ini',

  // Documentation
  md: 'markdown',
  markdown: 'markdown',
  mdown: 'markdown',
  mdx: 'markdown',

  // Systems & Native
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  hh: 'cpp',
  hxx: 'cpp',
  rs: 'rust',
  go: 'go',
  cs: 'csharp',
  java: 'java',
  jav: 'java',

  // Scripting & Dynamic
  py: 'python',
  pyw: 'python',
  r: 'r',
  rb: 'ruby',
  php: 'php',
  phtml: 'php',
  lua: 'lua',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  ksh: 'shell',
  fish: 'shell',
  bat: 'bat',
  cmd: 'bat',
  ps1: 'powershell',

  // Database
  sql: 'sql',

  // Container & DevOps
  dockerfile: 'dockerfile',
  containerfile: 'dockerfile',

  // Others supported by Monaco
  graphql: 'graphql',
  gql: 'graphql',
  swift: 'swift',
  kt: 'kotlin',
  kts: 'kotlin',
  dart: 'dart',
};

// Exact filename to Monaco Language ID mappings
const FILENAME_MAP = {
  dockerfile: 'dockerfile',
  containerfile: 'dockerfile',
  makefile: 'makefile',
  gnumakefile: 'makefile',
  cmakelists: 'cmake',
  '.dockerignore': 'dockerfile',
  '.gitignore': 'shell',
  '.npmignore': 'shell',
  '.editorconfig': 'ini',
  '.env': 'shell',
  '.env.local': 'shell',
  '.env.development': 'shell',
  '.env.production': 'shell',
  'package.json': 'json',
  'tsconfig.json': 'json',
  'jsconfig.json': 'json',
};

// Human-friendly display labels for status bar
const LANGUAGE_LABELS = {
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  css: 'CSS',
  scss: 'SCSS',
  less: 'Less',
  html: 'HTML',
  json: 'JSON',
  markdown: 'Markdown',
  yaml: 'YAML',
  python: 'Python',
  java: 'Java',
  c: 'C',
  cpp: 'C++',
  csharp: 'C#',
  go: 'Go',
  rust: 'Rust',
  php: 'PHP',
  sql: 'SQL',
  shell: 'Shell Script',
  xml: 'XML',
  dockerfile: 'Dockerfile',
  powershell: 'PowerShell',
  graphql: 'GraphQL',
  lua: 'Lua',
  ruby: 'Ruby',
  swift: 'Swift',
  kotlin: 'Kotlin',
  dart: 'Dart',
  ini: 'INI',
  bat: 'Batch',
  toml: 'TOML',
  plaintext: 'Plain Text',
};

/**
 * Detects the Monaco language identifier for a given filename or path.
 * @param {string} filename - The file name or path (e.g. 'AppRoutes.jsx', '/src/index.ts')
 * @param {string} [fallback='plaintext'] - Fallback language if not recognized
 * @returns {string} Monaco language identifier
 */
export function getLanguageForFilename(filename, fallback = 'plaintext') {
  if (!filename || typeof filename !== 'string') {
    return fallback;
  }

  // Extract base name without directory components
  const baseName = filename.replace(/\\/g, '/').split('/').pop()?.trim() || '';
  if (!baseName) return fallback;

  const lowerBaseName = baseName.toLowerCase();

  // 1. Exact filename check (e.g., 'Dockerfile', '.gitignore', 'package.json')
  if (FILENAME_MAP[lowerBaseName]) {
    return FILENAME_MAP[lowerBaseName];
  }

  // 2. Check for dockerfile prefix (e.g., 'Dockerfile.dev', 'Dockerfile.prod')
  if (lowerBaseName.startsWith('dockerfile.')) {
    return 'dockerfile';
  }

  // 3. Extension extraction
  const parts = lowerBaseName.split('.');
  if (parts.length <= 1) {
    return fallback;
  }

  // Compound extensions check (e.g. 'test.jsx' -> 'jsx', 'd.ts' -> 'ts')
  const ext = parts.pop();
  if (ext && EXTENSION_MAP[ext]) {
    return EXTENSION_MAP[ext];
  }

  return fallback;
}

/**
 * Returns a human-friendly label for a Monaco language identifier.
 * @param {string} languageId - Monaco language ID (e.g. 'javascript')
 * @param {string} [filename=''] - Optional filename for context (e.g. .jsx -> JavaScript React)
 * @returns {string} Human readable label (e.g. 'JavaScript', 'JavaScript React')
 */
export function getLanguageLabel(languageId, filename = '') {
  if (!languageId && !filename) return 'Plain Text';
  const effectiveId = languageId || getLanguageForFilename(filename);

  if (filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'jsx') return 'JavaScript React';
    if (ext === 'tsx') return 'TypeScript React';
  }

  return LANGUAGE_LABELS[effectiveId] || (effectiveId ? effectiveId.toUpperCase() : 'Plain Text');
}
