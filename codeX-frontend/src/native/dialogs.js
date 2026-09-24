import { isDesktopApp } from './environment';

/**
 * Native Dialogs Abstraction (Phase 2 Foundation).
 */

export async function showMessage(title, message) {
  if (isDesktopApp()) {
    // Phase 2 hook for native dialog
    window.alert(`${title}\n\n${message}`);
    return;
  }
  window.alert(`${title}\n\n${message}`);
}

export async function askConfirmation(message) {
  return window.confirm(message);
}
