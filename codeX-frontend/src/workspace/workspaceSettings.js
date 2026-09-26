/**
 * Workspace Settings Manager
 * Resolves settings through 4-tier precedence:
 * 1. Built-in defaults
 * 2. User settings
 * 3. Workspace settings
 * 4. Folder/project settings
 */

import { DEFAULT_WORKSPACE_SETTINGS } from './workspaceTypes.js';

const USER_SETTINGS_KEY = 'codex_user_settings';

export class WorkspaceSettings {
  constructor() {
    this.workspaceSettings = {};
    this.folderSettings = new Map(); // folderPath -> settings
  }

  getUserSettings() {
    try {
      const data = localStorage.getItem(USER_SETTINGS_KEY);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  }

  saveUserSettings(settings) {
    try {
      localStorage.setItem(USER_SETTINGS_KEY, JSON.stringify(settings));
    } catch (err) {
      console.warn('Failed to save user settings:', err);
    }
  }

  setWorkspaceSettings(settings = {}) {
    this.workspaceSettings = { ...settings };
  }

  setFolderSettings(folderPath, settings = {}) {
    if (!folderPath) return;
    this.folderSettings.set(folderPath.replace(/\\/g, '/'), { ...settings });
  }

  clearFolderSettings() {
    this.folderSettings.clear();
  }

  getSetting(key, folderPath = null) {
    // 4. Folder/project settings
    if (folderPath) {
      const clean = folderPath.replace(/\\/g, '/');
      const folderSet = this.folderSettings.get(clean);
      if (folderSet && folderSet[key] !== undefined) {
        return folderSet[key];
      }
    }

    // 3. Workspace settings
    if (this.workspaceSettings && this.workspaceSettings[key] !== undefined) {
      return this.workspaceSettings[key];
    }

    // 2. User settings
    const userSet = this.getUserSettings();
    if (userSet && userSet[key] !== undefined) {
      return userSet[key];
    }

    // 1. Built-in defaults
    return DEFAULT_WORKSPACE_SETTINGS[key];
  }

  getAllSettings(folderPath = null) {
    const userSet = this.getUserSettings();
    let merged = {
      ...DEFAULT_WORKSPACE_SETTINGS,
      ...userSet,
      ...this.workspaceSettings,
    };

    if (folderPath) {
      const clean = folderPath.replace(/\\/g, '/');
      const folderSet = this.folderSettings.get(clean);
      if (folderSet) {
        merged = { ...merged, ...folderSet };
      }
    }

    return merged;
  }
}

export const workspaceSettings = new WorkspaceSettings();
