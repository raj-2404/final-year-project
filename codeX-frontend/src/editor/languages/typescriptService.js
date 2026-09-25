/**
 * CodeX Monaco TypeScript & JavaScript Language Service
 * Level 2 — Language Intelligence
 *
 * Configures Monaco's built-in TypeScript/JavaScript language service for:
 * - Autocomplete / IntelliSense (variables, functions, imports, JSX elements, JSX attributes)
 * - Hover information (types, function signatures, params, documentation)
 * - Diagnostics (syntax errors, invalid JS/TS, unresolved identifiers, type errors)
 * - Go to Definition & Find References
 * - Rename Symbol
 * - Document & Range Formatting
 */

// Core React and JSX type declarations for offline/desktop autocompletion and hover
const REACT_DECLARATIONS = `
declare namespace React {
  export type ReactNode = string | number | boolean | null | undefined | ReactElement | ReactNodeArray;
  export interface ReactElement<P = any, T extends string | JSXElementConstructor<any> = string | JSXElementConstructor<any>> {
    type: T;
    props: P;
    key: string | null;
  }
  export interface ReactNodeArray extends Array<ReactNode> {}
  export type JSXElementConstructor<P> = ((props: P) => ReactElement<any, any> | null) | (new (props: P) => any);

  export type FC<P = {}> = FunctionComponent<P>;
  export interface FunctionComponent<P = {}> {
    (props: P, context?: any): ReactElement<any, any> | null;
    propTypes?: any;
    contextTypes?: any;
    defaultProps?: Partial<P>;
    displayName?: string;
  }

  export function useState<T>(initialState: T | (() => T)): [T, (newState: T | ((prevState: T) => T)) => void];
  export function useState<T = undefined>(): [T | undefined, (newState: T | undefined | ((prevState: T | undefined) => T | undefined)) => void];
  export function useEffect(effect: () => void | (() => void), deps?: readonly any[]): void;
  export function useLayoutEffect(effect: () => void | (() => void), deps?: readonly any[]): void;
  export function useContext<T>(context: any): T;
  export function useReducer<R extends (state: any, action: any) => any>(reducer: R, initialState: any): [any, any];
  export function useCallback<T extends (...args: any[]) => any>(callback: T, deps: readonly any[]): T;
  export function useMemo<T>(factory: () => T, deps: readonly any[] | undefined): T;
  export function useRef<T>(initialValue: T): { current: T };
  export function useRef<T = undefined>(): { current: T | undefined };
  export function useId(): string;
  export function createContext<T>(defaultValue: T): any;
  export function createElement(type: any, props?: any, ...children: any[]): ReactElement;
  export const Fragment: any;

  export interface HTMLAttributes {
    className?: string;
    id?: string;
    style?: any;
    title?: string;
    role?: string;
    tabIndex?: number;
    hidden?: boolean;
    children?: ReactNode;
    key?: string | number | null;
    ref?: any;
    onClick?: (event: any) => void;
    onChange?: (event: any) => void;
    onSubmit?: (event: any) => void;
    onKeyDown?: (event: any) => void;
    onKeyUp?: (event: any) => void;
    onFocus?: (event: any) => void;
    onBlur?: (event: any) => void;
    onMouseEnter?: (event: any) => void;
    onMouseLeave?: (event: any) => void;
    [prop: string]: any;
  }
}

declare namespace JSX {
  interface Element extends React.ReactElement<any, any> {}
  interface ElementClass {
    render(): React.ReactNode;
  }
  interface ElementAttributesProperty { props: {}; }
  interface ElementChildrenAttribute { children: {}; }
  interface IntrinsicElements {
    div: React.HTMLAttributes;
    span: React.HTMLAttributes;
    p: React.HTMLAttributes;
    h1: React.HTMLAttributes;
    h2: React.HTMLAttributes;
    h3: React.HTMLAttributes;
    h4: React.HTMLAttributes;
    h5: React.HTMLAttributes;
    h6: React.HTMLAttributes;
    a: React.HTMLAttributes & { href?: string; target?: string; rel?: string };
    button: React.HTMLAttributes & { type?: 'button' | 'submit' | 'reset'; disabled?: boolean };
    input: React.HTMLAttributes & { type?: string; value?: any; placeholder?: string; disabled?: boolean; checked?: boolean; name?: string };
    textarea: React.HTMLAttributes & { value?: string; placeholder?: string; rows?: number; cols?: number };
    form: React.HTMLAttributes & { action?: string; method?: string };
    img: React.HTMLAttributes & { src?: string; alt?: string; width?: number | string; height?: number | string };
    ul: React.HTMLAttributes;
    ol: React.HTMLAttributes;
    li: React.HTMLAttributes;
    table: React.HTMLAttributes;
    tr: React.HTMLAttributes;
    td: React.HTMLAttributes;
    th: React.HTMLAttributes;
    thead: React.HTMLAttributes;
    tbody: React.HTMLAttributes;
    select: React.HTMLAttributes & { value?: any; disabled?: boolean };
    option: React.HTMLAttributes & { value?: any; selected?: boolean };
    label: React.HTMLAttributes & { htmlFor?: string };
    header: React.HTMLAttributes;
    footer: React.HTMLAttributes;
    nav: React.HTMLAttributes;
    main: React.HTMLAttributes;
    section: React.HTMLAttributes;
    article: React.HTMLAttributes;
    aside: React.HTMLAttributes;
    [elemName: string]: any;
  }
}

declare module "react" {
  export = React;
}

declare module "react/jsx-runtime" {
  export const jsx: any;
  export const jsxs: any;
  export const Fragment: any;
}

declare module "react-dom" {
  export function createRoot(container: any): { render(element: any): void; unmount(): void };
  export function render(element: any, container: any): void;
}
`;

class TypeScriptService {
  constructor() {
    this.isInitialized = false;
    this.extraLibsRegistered = false;
  }

  /**
   * Configures Monaco's JavaScript and TypeScript language service defaults.
   * @param {object} monaco - Monaco editor instance
   * @param {object} [projectOptions={}] - Optional compiler options from tsconfig.json / jsconfig.json
   */
  setup(monaco, projectOptions = {}) {
    if (!monaco?.languages?.typescript) return;

    const { javascriptDefaults, typescriptDefaults, ScriptTarget, ModuleKind, ModuleResolutionKind, JsxEmit } =
      monaco.languages.typescript;

    // 1. Base Compiler Options
    const baseCompilerOptions = {
      target: ScriptTarget.ES2022,
      module: ModuleKind.ESNext,
      moduleResolution: ModuleResolutionKind.NodeJs,
      jsx: JsxEmit.React,
      jsxFactory: 'React.createElement',
      jsxFragmentFactory: 'React.Fragment',
      allowNonTsExtensions: true,
      allowJs: true,
      checkJs: false,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
      resolveJsonModule: true,
      isolatedModules: true,
      noEmit: true,
      ...projectOptions,
    };

    // 2. Set JS and TS Compiler Options
    javascriptDefaults.setCompilerOptions({
      ...baseCompilerOptions,
      checkJs: false, // Don't overwhelm plain JS files with strict type errors
    });

    typescriptDefaults.setCompilerOptions({
      ...baseCompilerOptions,
      strict: false, // Balance strictness for developer friendly autocomplete & typechecking
    });

    // 3. Diagnostics Configuration (Level 2: Real language-aware error & warning squiggles)
    // Ignore harmless module-resolution error codes when local external packages aren't physically present
    const diagnosticCodesToIgnore = [
      2686, // 'React' refers to a UMD global, but the current file is a module
      1375, // 'await' expressions are only allowed at the top level of a file
      1378, // top-level await
      2792, // Cannot find module. Did you mean to set 'moduleResolution' to 'bundler'?
    ];

    javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
      diagnosticCodesToIgnore,
    });

    typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
      diagnosticCodesToIgnore,
    });

    // 4. Mode Configuration (Enable full language intelligence suite)
    const modeConfig = {
      completionItems: true,
      hovers: true,
      documentSymbols: true,
      definitions: true,
      references: true,
      documentHighlights: true,
      rename: true,
      diagnostics: true,
      documentFormattingEdits: true,
      documentRangeFormattingEdits: true,
      onTypeFormattingEdits: true,
      signatureHelps: true,
      selectionRanges: true,
    };

    if (typeof javascriptDefaults.setModeConfiguration === 'function') {
      javascriptDefaults.setModeConfiguration(modeConfig);
    }
    if (typeof typescriptDefaults.setModeConfiguration === 'function') {
      typescriptDefaults.setModeConfiguration(modeConfig);
    }

    // 5. Eager Model Sync (Ensures all workspace models are instantly synchronized to the TS worker)
    if (typeof javascriptDefaults.setEagerModelSync === 'function') {
      javascriptDefaults.setEagerModelSync(true);
    }
    if (typeof typescriptDefaults.setEagerModelSync === 'function') {
      typescriptDefaults.setEagerModelSync(true);
    }

    // 6. Register React and JSX Type Definitions
    if (!this.extraLibsRegistered) {
      try {
        const libUri = 'ts:filename/react.d.ts';
        javascriptDefaults.addExtraLib(REACT_DECLARATIONS, libUri);
        typescriptDefaults.addExtraLib(REACT_DECLARATIONS, libUri);
        this.extraLibsRegistered = true;
      } catch (err) {
        console.warn('[TypeScriptService] Failed to inject React type declarations:', err);
      }
    }

    this.isInitialized = true;
  }

  /**
   * Inspects workspace file tree for tsconfig.json or jsconfig.json and applies compilerOptions.
   * @param {object} monaco - Monaco editor instance
   * @param {Array} fileTree - Workspace file tree array
   */
  loadProjectConfig(monaco, fileTree) {
    if (!monaco?.languages?.typescript || !Array.isArray(fileTree)) return;

    const configFile = fileTree.find(
      (f) => f.type === 'file' && (f.name === 'tsconfig.json' || f.name === 'jsconfig.json')
    );

    if (configFile?.content) {
      try {
        const parsed = JSON.parse(configFile.content);
        if (parsed.compilerOptions) {
          const mapped = {};
          const raw = parsed.compilerOptions;
          const { ScriptTarget, ModuleKind, ModuleResolutionKind, JsxEmit } = monaco.languages.typescript;

          if (raw.target) {
            const t = String(raw.target).toUpperCase();
            if (t.includes('2022')) mapped.target = ScriptTarget.ES2022;
            else if (t.includes('2020')) mapped.target = ScriptTarget.ES2020;
            else if (t.includes('NEXT')) mapped.target = ScriptTarget.Latest;
          }

          if (raw.module) {
            const m = String(raw.module).toUpperCase();
            if (m.includes('ESNEXT')) mapped.module = ModuleKind.ESNext;
            else if (m.includes('COMMONJS')) mapped.module = ModuleKind.CommonJS;
          }

          if (raw.moduleResolution) {
            const mr = String(raw.moduleResolution).toLowerCase();
            if (mr === 'node' || mr === 'nodejs') mapped.moduleResolution = ModuleResolutionKind.NodeJs;
          }

          if (raw.jsx) {
            const j = String(raw.jsx).toLowerCase();
            if (j === 'react') mapped.jsx = JsxEmit.React;
            else if (j.includes('preserve')) mapped.jsx = JsxEmit.Preserve;
          }

          if (raw.baseUrl) mapped.baseUrl = raw.baseUrl;
          if (raw.paths) mapped.paths = raw.paths;
          if (typeof raw.allowJs === 'boolean') mapped.allowJs = raw.allowJs;
          if (typeof raw.checkJs === 'boolean') mapped.checkJs = raw.checkJs;

          this.setup(monaco, mapped);
        }
      } catch (err) {
        console.warn('[TypeScriptService] Could not parse project configuration:', err);
      }
    }
  }
}

export const typescriptService = new TypeScriptService();
