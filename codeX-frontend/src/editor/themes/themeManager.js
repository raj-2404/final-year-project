/**
 * CodeX Monaco Theme Manager
 * Decouples Monaco theme definitions from UI components,
 * enabling modular addition of future themes without modifying editor views.
 */

import { CODEX_DARK_THEME_NAME, codexDarkTheme } from './codexDark.js';

class ThemeManager {
  constructor() {
    this.themes = new Map();
    this.activeTheme = CODEX_DARK_THEME_NAME;

    // Register built-in CodeX themes
    this.registerTheme(CODEX_DARK_THEME_NAME, codexDarkTheme);
  }

  /**
   * Registers a new Monaco editor theme.
   * @param {string} name - Unique identifier for the theme
   * @param {object} themeData - Monaco IStandaloneThemeData definition
   */
  registerTheme(name, themeData) {
    if (!name || !themeData) return;
    this.themes.set(name, themeData);
  }

  /**
   * Defines all registered themes within the given Monaco instance.
   * Safe to call multiple times or during Monaco beforeMount/onMount.
   * @param {object} monaco - Monaco instance
   */
  defineThemes(monaco) {
    if (!monaco || !monaco.editor || !monaco.editor.defineTheme) return;

    for (const [name, themeData] of this.themes.entries()) {
      try {
        monaco.editor.defineTheme(name, themeData);
      } catch (err) {
        console.warn(`[ThemeManager] Error defining theme "${name}":`, err);
      }
    }
  }

  /**
   * Applies the theme to the Monaco editor.
   * @param {object} monaco - Monaco instance
   * @param {string} [themeName] - Theme name (defaults to active theme)
   */
  applyTheme(monaco, themeName = this.activeTheme) {
    if (!monaco || !monaco.editor) return;

    this.defineThemes(monaco);

    if (this.themes.has(themeName)) {
      this.activeTheme = themeName;
      try {
        monaco.editor.setTheme(themeName);
      } catch (err) {
        console.warn(`[ThemeManager] Error applying theme "${themeName}":`, err);
      }
    }
  }

  /**
   * Returns the current active Monaco theme name.
   */
  getActiveTheme() {
    return this.activeTheme;
  }

  /**
   * Returns list of registered theme names.
   */
  getRegisteredThemes() {
    return Array.from(this.themes.keys());
  }
}

export const themeManager = new ThemeManager();
