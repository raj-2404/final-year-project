/**
 * CodeX Language Providers
 * Level 2 — Language Intelligence Providers & Level 3A Fallback Providers
 *
 * Configures:
 * - HTML defaults & formatting options (Monaco native)
 * - CSS/SCSS/LESS defaults & lint validation rules (Monaco native)
 * - JSON formatting provider
 * - SQL fallback completion, hover, and document formatting provider
 */

const SQL_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'INSERT INTO', 'VALUES', 'UPDATE', 'SET',
  'DELETE FROM', 'JOIN', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL JOIN',
  'CROSS JOIN', 'ON', 'GROUP BY', 'HAVING', 'ORDER BY', 'ASC', 'DESC',
  'LIMIT', 'OFFSET', 'UNION', 'UNION ALL', 'DISTINCT', 'AS', 'AND', 'OR', 'NOT',
  'IN', 'EXISTS', 'BETWEEN', 'LIKE', 'ILIKE', 'IS NULL', 'IS NOT NULL',
  'CREATE TABLE', 'ALTER TABLE', 'DROP TABLE', 'TRUNCATE TABLE', 'CREATE INDEX',
  'DROP INDEX', 'PRIMARY KEY', 'FOREIGN KEY', 'REFERENCES', 'DEFAULT',
  'CHECK', 'UNIQUE', 'CONSTRAINT', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
  'WITH', 'VIEW', 'TRANSACTION', 'BEGIN', 'COMMIT', 'ROLLBACK'
];

const SQL_TYPES = [
  'INT', 'INTEGER', 'BIGINT', 'SMALLINT', 'TINYINT', 'DECIMAL', 'NUMERIC',
  'FLOAT', 'REAL', 'DOUBLE PRECISION', 'VARCHAR', 'CHAR', 'TEXT', 'BOOLEAN',
  'DATE', 'TIME', 'TIMESTAMP', 'TIMESTAMPTZ', 'INTERVAL', 'JSON', 'JSONB',
  'UUID', 'BLOB', 'BYTEA', 'SERIAL', 'BIGSERIAL'
];

const SQL_FUNCTIONS = [
  { name: 'COUNT', detail: 'COUNT(expression)', doc: 'Returns the number of rows that match specified criteria.' },
  { name: 'SUM', detail: 'SUM(expression)', doc: 'Calculates the sum of a set of values.' },
  { name: 'AVG', detail: 'AVG(expression)', doc: 'Calculates the average value of a numeric column.' },
  { name: 'MIN', detail: 'MIN(expression)', doc: 'Returns the minimum value in a set of values.' },
  { name: 'MAX', detail: 'MAX(expression)', doc: 'Returns the maximum value in a set of values.' },
  { name: 'COALESCE', detail: 'COALESCE(val1, val2, ...)', doc: 'Returns the first non-null value in the list.' },
  { name: 'NULLIF', detail: 'NULLIF(expr1, expr2)', doc: 'Returns null if expr1 equals expr2, otherwise returns expr1.' },
  { name: 'CONCAT', detail: 'CONCAT(str1, str2, ...)', doc: 'Concatenates two or more strings together.' },
  { name: 'SUBSTRING', detail: 'SUBSTRING(string, start, length)', doc: 'Extracts a substring from a string.' },
  { name: 'TRIM', detail: 'TRIM(string)', doc: 'Removes leading and trailing spaces from a string.' },
  { name: 'UPPER', detail: 'UPPER(string)', doc: 'Converts a string to uppercase.' },
  { name: 'LOWER', detail: 'LOWER(string)', doc: 'Converts a string to lowercase.' },
  { name: 'ROUND', detail: 'ROUND(number, decimals)', doc: 'Rounds a number to a specified number of decimal places.' },
  { name: 'NOW', detail: 'NOW()', doc: 'Returns current date and time.' },
  { name: 'CURRENT_TIMESTAMP', detail: 'CURRENT_TIMESTAMP', doc: 'Returns current timestamp with timezone.' },
  { name: 'CAST', detail: 'CAST(expression AS target_type)', doc: 'Converts an expression into a specified datatype.' },
  { name: 'ROW_NUMBER', detail: 'ROW_NUMBER() OVER (...)', doc: 'Assigns a sequential integer to each row within a partition.' },
  { name: 'RANK', detail: 'RANK() OVER (...)', doc: 'Assigns a rank to each row within a partition.' },
  { name: 'DENSE_RANK', detail: 'DENSE_RANK() OVER (...)', doc: 'Assigns ranks to rows without gaps.' },
];

/**
 * Standard SQL formatter aligning clauses to 2 spaces and uppercasing keywords.
 */
function formatSql(sqlText, tabSize = 2) {
  if (!sqlText || !sqlText.trim()) return sqlText;

  const indent = ' '.repeat(tabSize);
  const majorClauses = [
    'SELECT', 'FROM', 'WHERE', 'GROUP BY', 'HAVING', 'ORDER BY',
    'LIMIT', 'OFFSET', 'UNION ALL', 'UNION', 'INNER JOIN', 'LEFT JOIN',
    'RIGHT JOIN', 'FULL JOIN', 'CROSS JOIN', 'JOIN', 'INSERT INTO',
    'VALUES', 'UPDATE', 'SET', 'DELETE FROM', 'CREATE TABLE', 'ALTER TABLE'
  ];

  // Tokenize preserving comments and strings
  const tokens = [];
  const regex = /(--[^\n]*|\/\*[\s\S]*?\*\/|'(''|[^'])*'|"(""|[^"])*"|\b[A-Za-z_][A-Za-z0-9_]*\b|,|\(|\)|;|\S+)/g;
  let match;
  while ((match = regex.exec(sqlText)) !== null) {
    tokens.push(match[0]);
  }

  if (tokens.length === 0) return sqlText;

  let result = '';
  let currentIndentLevel = 0;
  let isNewLine = true;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const upper = token.toUpperCase();
    const nextToken = (i + 1 < tokens.length) ? tokens[i + 1].toUpperCase() : '';
    const twoWordToken = `${upper} ${nextToken}`;

    const isTwoWordMajor = majorClauses.includes(twoWordToken);
    const isSingleMajor = majorClauses.includes(upper);

    if (isTwoWordMajor) {
      if (!isNewLine) result += '\n';
      result += indent.repeat(Math.max(0, currentIndentLevel)) + twoWordToken + ' ';
      i++; // Skip next token
      isNewLine = false;
      continue;
    }

    if (isSingleMajor) {
      if (!isNewLine) result += '\n';
      result += indent.repeat(Math.max(0, currentIndentLevel)) + upper + ' ';
      isNewLine = false;
      continue;
    }

    if (token === '(') {
      result += ' (';
      currentIndentLevel++;
      isNewLine = false;
      continue;
    }

    if (token === ')') {
      currentIndentLevel = Math.max(0, currentIndentLevel - 1);
      result += ')';
      isNewLine = false;
      continue;
    }

    if (token === ',') {
      result += ',\n' + indent.repeat(Math.max(0, currentIndentLevel + 1));
      isNewLine = false;
      continue;
    }

    if (token === ';') {
      result += ';\n';
      isNewLine = true;
      continue;
    }

    // Keyword uppercasing
    if (SQL_KEYWORDS.includes(upper) || SQL_TYPES.includes(upper)) {
      result += upper + ' ';
    } else {
      result += token + ' ';
    }
    isNewLine = false;
  }

  return result.trim() + '\n';
}

class LanguageProviderRegistry {
  constructor() {
    this.registeredProviders = [];
    this.isConfigured = false;
  }

  /**
   * Registers fallback providers and configures built-in language settings.
   * @param {object} monaco - Monaco instance
   */
  registerAll(monaco) {
    if (!monaco?.languages) return;

    // 1. Configure Monaco Native HTML Defaults
    if (monaco.languages.html?.htmlDefaults) {
      try {
        monaco.languages.html.htmlDefaults.setOptions({
          format: {
            tabSize: 2,
            insertSpaces: true,
            wrapLineLength: 120,
            unformatted: 'wbr',
            contentUnformatted: 'pre,code,textarea',
            indentInnerHtml: false,
            preserveNewLines: true,
            maxPreserveNewLines: null,
            indentHandlebars: false,
            endWithNewline: false,
            extraLiners: 'head, body, /html',
            wrapAttributes: 'auto',
          },
          suggest: {
            html5: true,
          },
        });
      } catch (err) {
        console.warn('[LanguageProviderRegistry] HTML defaults error:', err);
      }
    }

    // 2. Configure Monaco Native CSS / SCSS / LESS Defaults
    if (monaco.languages.css?.cssDefaults) {
      try {
        monaco.languages.css.cssDefaults.setOptions({
          validate: true,
          lint: {
            compatibleVendorPrefixes: 'ignore',
            vendorPrefix: 'warning',
            duplicateProperties: 'warning',
            emptyRules: 'warning',
            importStatement: 'ignore',
            boxModel: 'ignore',
            universalSelector: 'ignore',
            zeroUnits: 'ignore',
            fontFaceProperties: 'warning',
            hexColorLength: 'error',
            argumentsInColorFunction: 'error',
            unknownProperties: 'warning',
            ieHack: 'ignore',
            unknownVendorSpecificProperties: 'ignore',
            propertyIgnoredDueToDisplay: 'warning',
            important: 'ignore',
            float: 'ignore',
            idSelector: 'ignore',
          },
        });
      } catch (err) {
        console.warn('[LanguageProviderRegistry] CSS defaults error:', err);
      }
    }

    if (monaco.languages.css?.scssDefaults) {
      try {
        monaco.languages.css.scssDefaults.setOptions({ validate: true });
      } catch {}
    }

    if (monaco.languages.css?.lessDefaults) {
      try {
        monaco.languages.css.lessDefaults.setOptions({ validate: true });
      } catch {}
    }

    if (this.isConfigured) return;
    this.isConfigured = true;

    // 3. JSON Formatting fallback provider ensuring CodeX 2-space indentation
    if (monaco.languages.registerDocumentFormattingEditProvider) {
      try {
        const jsonFormatDisposable = monaco.languages.registerDocumentFormattingEditProvider('json', {
          provideDocumentFormattingEdits(model) {
            try {
              const text = model.getValue();
              const parsed = JSON.parse(text);
              const formatted = JSON.stringify(parsed, null, 2);
              return [
                {
                  range: model.getFullModelRange(),
                  text: formatted,
                },
              ];
            } catch {
              return [];
            }
          },
        });
        this.registeredProviders.push(jsonFormatDisposable);
      } catch (err) {
        console.warn('[LanguageProviderRegistry] JSON formatter error:', err);
      }
    }

    // 4. SQL Fallback Providers (Completion, Hover, Formatting)
    try {
      // 4a. SQL Autocompletion Provider
      const sqlCompletionDisposable = monaco.languages.registerCompletionItemProvider('sql', {
        triggerCharacters: [' ', '.', '(', ',', '*'],
        provideCompletionItems: (model, position) => {
          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          };

          const suggestions = [];

          // SQL Keywords
          SQL_KEYWORDS.forEach((kw) => {
            suggestions.push({
              label: kw,
              kind: monaco.languages.CompletionItemKind.Keyword,
              insertText: kw,
              detail: 'SQL Keyword',
              range,
              sortText: `1_${kw}`,
            });
          });

          // SQL Data Types
          SQL_TYPES.forEach((type) => {
            suggestions.push({
              label: type,
              kind: monaco.languages.CompletionItemKind.TypeParameter,
              insertText: type,
              detail: 'SQL Data Type',
              range,
              sortText: `2_${type}`,
            });
          });

          // SQL Functions
          SQL_FUNCTIONS.forEach((fn) => {
            suggestions.push({
              label: fn.name,
              kind: monaco.languages.CompletionItemKind.Function,
              insertText: `${fn.name}($0)`,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              detail: fn.detail,
              documentation: fn.doc,
              range,
              sortText: `0_${fn.name}`,
            });
          });

          // Common SQL Snippets
          suggestions.push(
            {
              label: 'SELECT * FROM',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: 'SELECT * FROM ${1:table_name} WHERE ${2:condition};',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              detail: 'SQL Query Template',
              range,
              sortText: '0_select_query',
            },
            {
              label: 'INSERT INTO VALUES',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: 'INSERT INTO ${1:table_name} (${2:columns})\nVALUES (${3:values});',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              detail: 'Insert Query Template',
              range,
              sortText: '0_insert_query',
            },
            {
              label: 'CREATE TABLE',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: 'CREATE TABLE ${1:table_name} (\n  ${2:id} SERIAL PRIMARY KEY,\n  ${3:name} VARCHAR(255) NOT NULL\n);',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              detail: 'Create Table Template',
              range,
              sortText: '0_create_table',
            }
          );

          return { suggestions };
        },
      });
      this.registeredProviders.push(sqlCompletionDisposable);

      // 4b. SQL Hover Provider
      const sqlHoverDisposable = monaco.languages.registerHoverProvider('sql', {
        provideHover: (model, position) => {
          const word = model.getWordAtPosition(position);
          if (!word) return null;

          const term = word.word.toUpperCase();
          const fn = SQL_FUNCTIONS.find((f) => f.name === term);
          if (fn) {
            return {
              range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
              contents: [
                { value: `**SQL Function:** \`${fn.detail}\`` },
                { value: fn.doc },
              ],
            };
          }

          if (SQL_KEYWORDS.includes(term)) {
            return {
              range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
              contents: [
                { value: `**SQL Clause/Keyword:** \`${term}\`` },
              ],
            };
          }

          if (SQL_TYPES.includes(term)) {
            return {
              range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
              contents: [
                { value: `**SQL Type:** \`${term}\`` },
              ],
            };
          }

          return null;
        },
      });
      this.registeredProviders.push(sqlHoverDisposable);

      // 4c. SQL Document Formatting Provider
      const sqlFormatDisposable = monaco.languages.registerDocumentFormattingEditProvider('sql', {
        provideDocumentFormattingEdits(model, options) {
          try {
            const rawSql = model.getValue();
            const formatted = formatSql(rawSql, options.tabSize || 2);
            return [
              {
                range: model.getFullModelRange(),
                text: formatted,
              },
            ];
          } catch {
            return [];
          }
        },
      });
      this.registeredProviders.push(sqlFormatDisposable);
    } catch (err) {
      console.warn('[LanguageProviderRegistry] SQL provider error:', err);
    }
  }

  /**
   * Disposes registered providers.
   */
  dispose() {
    for (const disposable of this.registeredProviders) {
      try {
        if (disposable && typeof disposable.dispose === 'function') {
          disposable.dispose();
        }
      } catch {}
    }
    this.registeredProviders = [];
    this.isConfigured = false;
  }
}

export const languageProviderRegistry = new LanguageProviderRegistry();
