/**
 * Centralized environment detection for CodeX.
 * Distinguishes between running in a web browser vs running inside the Tauri native desktop app.
 */

export function isDesktopApp() {
  if (typeof window === 'undefined') return false;
  // Tauri 2 injects __TAURI_INTERNALS__ on window
  return Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__);
}

export function getAppType() {
  return isDesktopApp() ? 'desktop' : 'web';
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
  } catch {
    return {
      isDesktop: true,
      platform: 'desktop',
      appName: 'CodeX',
      version: '1.0.0',
    };
  }
}
