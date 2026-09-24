import { isDesktopApp } from './environment';

export function getPlatform() {
  if (!isDesktopApp()) {
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : '';
    if (userAgent.includes('mac')) return 'macos';
    if (userAgent.includes('win')) return 'windows';
    if (userAgent.includes('linux')) return 'linux';
    return 'web';
  }

  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : '';
  if (userAgent.includes('mac')) return 'macos';
  if (userAgent.includes('win')) return 'windows';
  if (userAgent.includes('linux')) return 'linux';
  return 'desktop';
}

export function isMacOS() {
  return getPlatform() === 'macos';
}

export function isWindows() {
  return getPlatform() === 'windows';
}

export function isLinux() {
  return getPlatform() === 'linux';
}
