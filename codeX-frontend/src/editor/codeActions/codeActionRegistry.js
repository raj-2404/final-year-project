/**
 * CodeX Code Action Provider Registry
 * Level 3F — Refactoring & Code Actions
 *
 * Manages language-specific and custom code action providers.
 */

class CodeActionRegistry {
  constructor() {
    this.providers = new Map(); // languageId -> Set<Provider>
  }

  registerProvider(languageId, provider) {
    if (!languageId || !provider) return () => {};

    const key = languageId.toLowerCase();
    if (!this.providers.has(key)) {
      this.providers.set(key, new Set());
    }

    this.providers.get(key).add(provider);

    return () => {
      const set = this.providers.get(key);
      if (set) {
        set.delete(provider);
        if (set.size === 0) {
          this.providers.delete(key);
        }
      }
    };
  }

  getProviders(languageId) {
    if (!languageId) return [];
    const key = languageId.toLowerCase();
    const specific = Array.from(this.providers.get(key) || []);
    const globalProviders = Array.from(this.providers.get('*') || []);
    return [...specific, ...globalProviders];
  }

  getAllProviders() {
    return Array.from(this.providers.entries());
  }

  clear() {
    this.providers.clear();
  }
}

export const codeActionRegistry = new CodeActionRegistry();
