/**
 * Project / Ecosystem Discovery Service
 */

import { workspaceService } from '../services/native/workspace.js';

export const workspaceDiscovery = {
  /**
   * Detects project metadata for a folder path
   */
  async detectProject(folderPath) {
    if (!folderPath) return null;
    const cleanPath = folderPath.replace(/\\/g, '/');

    try {
      if (workspaceService.isSupported()) {
        const detected = await workspaceService.detectProject(cleanPath);
        if (detected) {
          return {
            root: detected.root,
            name: detected.name,
            ecosystem: detected.ecosystem,
            language: detected.language,
            packageManager: detected.package_manager,
            buildSystem: detected.build_system,
            configFiles: detected.config_files || [],
            subprojects: (detected.subprojects || []).map((sub) => ({
              root: sub.root,
              name: sub.name,
              ecosystem: sub.ecosystem,
              language: sub.language,
              packageManager: sub.package_manager,
              buildSystem: sub.build_system,
              configFiles: sub.config_files || [],
            })),
          };
        }
      }
    } catch (err) {
      console.warn(`Native project discovery failed for ${cleanPath}:`, err);
    }

    // Fallback generic info
    const folderName = cleanPath.split('/').filter(Boolean).pop() || 'Project';
    return {
      root: cleanPath,
      name: folderName,
      ecosystem: 'generic',
      language: 'plaintext',
      packageManager: null,
      buildSystem: null,
      configFiles: [],
      subprojects: [],
    };
  },
};
