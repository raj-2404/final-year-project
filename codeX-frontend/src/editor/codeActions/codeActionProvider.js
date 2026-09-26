/**
 * CodeX Code Action Provider Bridge
 * Level 3F — Refactoring & Code Actions
 *
 * Implements Monaco's CodeActionProvider interface:
 * - JavaScript/TypeScript: Monaco built-in TypeScript worker (fixes, refactors, organize imports)
 * - LSP Languages: textDocument/codeAction (quick fixes, refactors, commands)
 * - Never invents fixes when language services do not provide one
 */

import { CodeActionKind } from './codeActionTypes.js';
import { lspManager } from '../languages/lsp/lspManager.js';
import { modelManager } from '../languages/modelManager.js';

export class CodeActionProvider {
  constructor({ monaco = null, workspaceRoot = '' } = {}) {
    this.monaco = monaco;
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * Monaco CodeActionProvider entrypoint.
   * @param {object} model - Monaco ITextModel
   * @param {object} range - Monaco Range
   * @param {object} context - Monaco CodeActionContext { markers, only, trigger }
   * @returns {Promise<{ actions: Array, dispose: Function }>}
   */
  async provideCodeActions(model, range, context) {
    if (!model || model.isDisposed()) {
      return { actions: [], dispose: () => {} };
    }

    const languageId = model.getLanguageId().toLowerCase();
    const actions = [];

    try {
      // 1. JavaScript / TypeScript: query Monaco's TypeScript language service worker
      if (['javascript', 'typescript', 'javascriptreact', 'typescriptreact'].includes(languageId)) {
        const tsActions = await this.provideTypeScriptCodeActions(model, range, context);
        actions.push(...tsActions);
      } else if (lspManager.isLspLanguage(languageId)) {
        // 2. LSP Languages (Python, Rust, Go, Java, C/C++, HTML, CSS, SQL): query textDocument/codeAction
        const lspActions = await this.provideLspCodeActions(model, range, context);
        actions.push(...lspActions);
      }
    } catch (err) {
      console.warn(`[CodeActionProvider] Error fetching actions for ${languageId}:`, err);
    }

    return {
      actions,
      dispose: () => {},
    };
  }

  /**
   * Fetches genuine code fixes, refactors, and organize imports from TypeScript worker.
   */
  async provideTypeScriptCodeActions(model, range, context) {
    const actions = [];
    const monaco = this.monaco;
    if (!monaco?.languages?.typescript) return actions;

    const uri = model.uri;
    const uriStr = uri.toString();
    const isJs = model.getLanguageId().includes('javascript');

    try {
      const getWorker = isJs
        ? await monaco.languages.typescript.getJavaScriptWorker()
        : await monaco.languages.typescript.getTypeScriptWorker();
      const worker = await getWorker(uri);

      const startOffset = model.getOffsetAt({ lineNumber: range.startLineNumber, column: range.startColumn });
      const endOffset = model.getOffsetAt({ lineNumber: range.endLineNumber, column: range.endColumn });

      // 1. Diagnostic Quick Fixes
      if (context.markers && context.markers.length > 0) {
        // Extract diagnostic error codes
        const errorCodes = context.markers
          .map((m) => (typeof m.code === 'number' ? m.code : parseInt(m.code, 10)))
          .filter((code) => !isNaN(code));

        if (errorCodes.length > 0) {
          const fixes = await worker.getCodeFixesAtPosition(
            uriStr,
            startOffset,
            endOffset,
            errorCodes,
            {},
            {}
          );

          if (Array.isArray(fixes)) {
            for (const fix of fixes) {
              const edit = this.convertTsChangesToWorkspaceEdit(model, fix.changes);
              actions.push({
                title: fix.description,
                kind: CodeActionKind.QuickFix,
                diagnostics: context.markers,
                isPreferred: true,
                edit,
              });
            }
          }
        }
      }

      // 2. Refactoring Actions (Extract variable, function, etc.)
      if (!context.only || context.only.includes(CodeActionKind.Refactor)) {
        const refactors = await worker.getApplicableRefactors(
          uriStr,
          { pos: startOffset, end: endOffset },
          {}
        );

        if (Array.isArray(refactors)) {
          for (const ref of refactors) {
            if (Array.isArray(ref.actions)) {
              for (const act of ref.actions) {
                const editInfo = await worker.getEditsForRefactor(
                  uriStr,
                  {},
                  { pos: startOffset, end: endOffset },
                  ref.name,
                  act.name,
                  {}
                );

                if (editInfo?.edits) {
                  const edit = this.convertTsChangesToWorkspaceEdit(model, editInfo.edits);
                  actions.push({
                    title: act.description || ref.description,
                    kind: act.kind || CodeActionKind.Refactor,
                    edit,
                  });
                }
              }
            }
          }
        }
      }

      // 3. Organize Imports
      if (!context.only || context.only === CodeActionKind.SourceOrganizeImports || context.only.includes(CodeActionKind.Source)) {
        const orgChanges = await worker.getOrganizeImports(
          { type: 'file', fileName: uriStr },
          {},
          {}
        );

        if (Array.isArray(orgChanges) && orgChanges.length > 0) {
          const edit = this.convertTsChangesToWorkspaceEdit(model, orgChanges);
          actions.push({
            title: 'Organize Imports',
            kind: CodeActionKind.SourceOrganizeImports,
            isPreferred: true,
            edit,
          });
        }
      }
    } catch (err) {
      console.warn('[CodeActionProvider] TypeScript worker query error:', err);
    }

    return actions;
  }

  /**
   * Fetches LSP code actions from language server via textDocument/codeAction.
   */
  async provideLspCodeActions(model, range, context) {
    const actions = [];
    const monaco = this.monaco;
    const languageId = model.getLanguageId();
    const uriStr = model.uri.toString();

    // Convert Monaco 1-based range to LSP 0-based range
    const lspRange = {
      start: { line: range.startLineNumber - 1, character: range.startColumn - 1 },
      end: { line: range.endLineNumber - 1, character: range.endColumn - 1 },
    };

    // Convert Monaco markers to LSP diagnostics
    const lspDiagnostics = (context.markers || []).map((m) => ({
      range: {
        start: { line: m.startLineNumber - 1, character: m.startColumn - 1 },
        end: { line: m.endLineNumber - 1, character: m.endColumn - 1 },
      },
      message: m.message,
      severity: m.severity,
      code: m.code,
      source: m.source,
    }));

    const lspResult = await lspManager.getCodeActions(languageId, uriStr, lspRange, {
      diagnostics: lspDiagnostics,
      only: context.only ? [context.only] : undefined,
    });

    if (!Array.isArray(lspResult)) return actions;

    for (const item of lspResult) {
      if (!item) continue;

      // item could be a Command or a CodeAction
      const title = item.title || item.command?.title || 'Apply Code Action';
      const kind = item.kind || (item.diagnostics?.length ? CodeActionKind.QuickFix : CodeActionKind.Refactor);

      let edit = null;
      if (item.edit) {
        edit = this.convertLspWorkspaceEditToMonaco(item.edit);
      }

      actions.push({
        title,
        kind,
        diagnostics: context.markers,
        isPreferred: Boolean(item.isPreferred),
        edit,
        command: item.command,
        rawLspAction: item,
      });
    }

    return actions;
  }

  /**
   * Converts TypeScript worker FileTextChanges into Monaco WorkspaceEdit.
   */
  convertTsChangesToWorkspaceEdit(currentModel, fileChanges = []) {
    const monaco = this.monaco;
    const edits = [];

    for (const fileChange of fileChanges) {
      const uri = fileChange.fileName.startsWith('file://')
        ? monaco.Uri.parse(fileChange.fileName)
        : modelManager.getCanonicalUri(monaco, fileChange.fileName, this.workspaceRoot);

      const targetModel = monaco.editor.getModel(uri) || currentModel;

      for (const tc of fileChange.textChanges || []) {
        const startPos = targetModel.getPositionAt(tc.span.start);
        const endPos = targetModel.getPositionAt(tc.span.start + tc.span.length);

        edits.push({
          resource: uri,
          textEdit: {
            range: new monaco.Range(
              startPos.lineNumber,
              startPos.column,
              endPos.lineNumber,
              endPos.column
            ),
            text: tc.newText,
          },
        });
      }
    }

    return { edits };
  }

  /**
   * Converts LSP WorkspaceEdit into Monaco WorkspaceEdit.
   */
  convertLspWorkspaceEditToMonaco(lspEdit) {
    const monaco = this.monaco;
    const edits = [];

    if (lspEdit.changes) {
      for (const [uriStr, textEdits] of Object.entries(lspEdit.changes)) {
        const uri = monaco.Uri.parse(uriStr);
        for (const te of textEdits) {
          edits.push({
            resource: uri,
            textEdit: {
              range: new monaco.Range(
                te.range.start.line + 1,
                te.range.start.character + 1,
                te.range.end.line + 1,
                te.range.end.character + 1
              ),
              text: te.newText,
            },
          });
        }
      }
    }

    if (Array.isArray(lspEdit.documentChanges)) {
      for (const dc of lspEdit.documentChanges) {
        if (dc.textDocument && Array.isArray(dc.edits)) {
          const uri = monaco.Uri.parse(dc.textDocument.uri);
          for (const te of dc.edits) {
            edits.push({
              resource: uri,
              textEdit: {
                range: new monaco.Range(
                  te.range.start.line + 1,
                  te.range.start.character + 1,
                  te.range.end.line + 1,
                  te.range.end.character + 1
                ),
                text: te.newText,
              },
            });
          }
        } else if (dc.kind === 'create') {
          edits.push({
            newResource: monaco.Uri.parse(dc.uri),
          });
        } else if (dc.kind === 'rename') {
          edits.push({
            oldResource: monaco.Uri.parse(dc.oldUri),
            newResource: monaco.Uri.parse(dc.newUri),
          });
        } else if (dc.kind === 'delete') {
          edits.push({
            oldResource: monaco.Uri.parse(dc.uri),
          });
        }
      }
    }

    return { edits };
  }
}
