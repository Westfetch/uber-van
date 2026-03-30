// Secure token storage.
// On Capacitor (APK): uses @capacitor/preferences (backed by Android SharedPreferences).
// On web: falls back to localStorage (acceptable — web isn't as extractable as APK disk storage).
//
// Usage:
//   import { getToken, setToken, removeToken } from './tokenStore.js';
//   const token = await getToken('driver_token');

// Token storage — uses localStorage everywhere.
// Both APKs load from a remote Vercel URL, so Capacitor native plugins
// (like @capacitor/preferences) aren't reliably available. localStorage
// is fine — the real security boundary is the HTTPS connection + JWT expiry.

export async function getToken(key) {
  return localStorage.getItem(key);
}

export async function setToken(key, value) {
  localStorage.setItem(key, value);
}

export async function removeToken(key) {
  localStorage.removeItem(key);
}

export function getTokenSync(key) {
  return localStorage.getItem(key);
}
