/**
 * Native Project Configuration Service
 * Reads and persists `.codex/project.json` for custom build & run actions.
 */

import { isDesktopApp } from './platform.js';

export const projectService = {
  isSupported() {
    return isDesktopApp();
  },

  async loadConfig(projectPath) {
    if (!isDesktopApp() || !projectPath) {
      return {
        name: 'Project',
        run: {},
      };
    }
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('project_load_config', { projectPath });
  },

  async saveConfig(projectPath, config) {
    if (!isDesktopApp() || !projectPath) return;
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('project_save_config', { projectPath, config });
  },
};
