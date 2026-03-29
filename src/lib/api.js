// Centralised API fetch helper.
// In the browser (Vite dev / Vercel), calls are relative (/api/...).
// In Capacitor (APK), VITE_API_BASE_URL points to the Vercel deployment.

const BASE = import.meta.env.VITE_API_BASE_URL || '';

export default function api(path, opts) {
  return fetch(`${BASE}${path}`, opts);
}

// App origin for building shareable links (invite URLs, etc.).
// In Capacitor, window.location.origin is capacitor://localhost — useless for links.
export const APP_ORIGIN = import.meta.env.VITE_APP_ORIGIN || window.location.origin;
