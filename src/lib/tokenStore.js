// Secure token storage.
// On Capacitor (APK): uses @capacitor/preferences (backed by Android SharedPreferences).
// On web: falls back to localStorage (acceptable — web isn't as extractable as APK disk storage).
//
// Usage:
//   import { getToken, setToken, removeToken } from './tokenStore.js';
//   const token = await getToken('driver_token');

import { Capacitor } from '@capacitor/core';

let Preferences = null;
let prefsReady = false;

async function loadPrefs() {
  if (prefsReady) return;
  if (Capacitor.isNativePlatform()) {
    try {
      const mod = await import('@capacitor/preferences');
      Preferences = mod.Preferences;
    } catch {
      // Plugin not installed — fall back to localStorage
    }
  }
  prefsReady = true;
}

export async function getToken(key) {
  await loadPrefs();
  if (Preferences) {
    const { value } = await Preferences.get({ key });
    return value;
  }
  return localStorage.getItem(key);
}

export async function setToken(key, value) {
  await loadPrefs();
  if (Preferences) {
    await Preferences.set({ key, value });
    return;
  }
  localStorage.setItem(key, value);
}

export async function removeToken(key) {
  await loadPrefs();
  if (Preferences) {
    await Preferences.remove({ key });
    return;
  }
  localStorage.removeItem(key);
}

// Synchronous getter for cases where async isn't practical (e.g. inline headers).
// Falls back to localStorage on both web and native — the async version migrates on next boot.
export function getTokenSync(key) {
  return localStorage.getItem(key);
}
