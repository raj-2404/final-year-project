import { isDesktopApp } from './environment';

/**
 * Native Filesystem Abstraction (Phase 2 Foundation).
 * Keeps existing browser File System Access API working, while providing hooks
 * for future native Tauri filesystem plugins without cluttering UI components.
 */

export async function pickFolder() {
  if (isDesktopApp()) {
    // Phase 2 will implement native dialog
    console.debug('[Native] Native folder picker will be implemented in Phase 2');
    return null;
  }
  // Browser fallback
  if (typeof window !== 'undefined' && window.showDirectoryPicker) {
    return await window.showDirectoryPicker();
  }
  return null;
}

export async function readNativeFile(_path) {
  if (!isDesktopApp()) {
    throw new Error('Native file read is only available in desktop application');
  }
  // Future native Tauri filesystem plugin hook
  return null;
}

export async function writeNativeFile(_path, _content) {
  if (!isDesktopApp()) {
    throw new Error('Native file write is only available in desktop application');
  }
  // Future native Tauri filesystem plugin hook
  return null;
}
