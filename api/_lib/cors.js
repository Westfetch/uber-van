// CORS helper for Capacitor APK (and any future cross-origin clients).
// Usage: if (cors(req, res)) return;   // handles OPTIONS preflight and sets headers

const ALLOWED_ORIGINS = [
  process.env.CORS_ORIGIN,            // e.g. https://uber-van.vercel.app
  'capacitor://localhost',             // Android Capacitor
  'ionic://localhost',                 // iOS Capacitor
  'http://localhost:5173',             // Vite dev
  'http://localhost:5174',
].filter(Boolean);

export default function cors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-internal');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}
