/**
 * Native Platform Service
 * Detects running environment (Tauri Desktop vs Web Browser)
 * and provides OS-level platform utilities.
 */

export function isDesktopApp() {
  if (typeof window === 'undefined') return false;
  return Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__);
}

export async function getDesktopInfo() {
  if (!isDesktopApp()) {
    return {
      isDesktop: false,
      platform: 'web',
      appName: 'CodeX',
      version: 'web',
    };
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const info = await invoke('get_desktop_info');
    return {
      isDesktop: true,
      ...info,
    };
  } catch (err) {
    return {
      isDesktop: true,
      platform: 'desktop',
      appName: 'CodeX',
      version: '0.1.0',
    };
  }
}

export async function getAvailableShells() {
  if (!isDesktopApp()) {
    return [
      { id: 'web-simulated', name: 'Web Terminal', path: 'simulated', is_default: true },
    ];
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('term_get_shells');
  } catch (err) {
    console.error('Failed to get available shells:', err);
    return [];
  }
}

export async function revealInFileManager(path) {
  if (!isDesktopApp()) {
    throw new Error('Reveal in file manager is only available on desktop');
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return await invoke('fs_reveal_in_file_manager', { path });
}

export const platformService = {
  isDesktopApp,
  getDesktopInfo,
  getAvailableShells,
  revealInFileManager,
};
