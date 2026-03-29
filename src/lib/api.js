// Centralised API fetch helper.
// In the browser (Vite dev / Vercel), calls are relative (/api/...).
// In Capacitor (APK), VITE_API_BASE_URL points to the Vercel deployment.

const BASE = import.meta.env.VITE_API_BASE_URL || '';

export default function api(path, opts) {
  return fetch(`${BASE}${path}`, opts);
}
