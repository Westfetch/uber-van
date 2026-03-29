// api/_lib/auth.js
// Driver auth only — no customer accounts in the driver app.
// Driver token: HS256-style signed JWT, 90-day TTL, stored in localStorage.
//
// Usage in any handler:
//   const driver = await verifyDriver(req);
//   if (!driver) return res.status(401).json({ error: 'Unauthorized' });
//   // driver.id === uuid

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// ── Token signing ─────────────────────────────────────────────────────────────

function b64url(buf) {
  return buf.toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function getSecret() {
  const s = process.env.DRIVER_TOKEN_SECRET;
  if (!s || s.length < 32)
    throw new Error('DRIVER_TOKEN_SECRET missing or too short (32+ chars required)');
  return s;
}

export function signDriverToken(driverId) {
  const secret  = getSecret();
  const header  = b64url(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const exp     = Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60; // 90 days
  const payload = b64url(Buffer.from(JSON.stringify({ sub: driverId, role: 'driver', exp })));
  const sig     = b64url(
    crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest()
  );
  return `${header}.${payload}.${sig}`;
}

function verifyDriverToken(token) {
  try {
    const secret = getSecret();
    const parts  = token.split('.');
    if (parts.length !== 3) return null;
    const [header, payload, sig] = parts;

    const expected = crypto.createHmac('sha256', secret)
      .update(`${header}.${payload}`).digest();
    const actual   = Buffer.from(
      sig.replace(/-/g, '+').replace(/_/g, '/'), 'base64'
    );

    if (actual.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(actual, expected)) return null;

    const claims = JSON.parse(
      Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()
    );
    if (!claims.sub || claims.role !== 'driver') return null;
    if (claims.exp < Math.floor(Date.now() / 1000)) return null;

    return claims;
  } catch { return null; }
}

// ── Supabase admin client ─────────────────────────────────────────────────────

let _admin = null;
export function getSupabaseAdmin() {
  if (_admin) return _admin;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL or SUPABASE_SERVICE_KEY env var missing');
  _admin = createClient(url, key, { auth: { persistSession: false } });
  return _admin;
}

// ── Public entry point ────────────────────────────────────────────────────────

/**
 * Returns { id: string } or null.
 * Call at the top of every protected handler.
 */
export async function verifyDriver(req) {
  const raw   = req.headers.authorization || req.headers.Authorization || '';
  const token = raw.startsWith('Bearer ') ? raw.slice(7).trim() : null;
  if (!token) return null;
  const claims = verifyDriverToken(token);
  return claims ? { id: claims.sub } : null;
}

// ── Admin auth ────────────────────────────────────────────────────────────────

export function signAdminToken(adminId) {
  const secret  = getSecret();
  const header  = b64url(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const exp     = Math.floor(Date.now() / 1000) + 8 * 60 * 60; // 8-hour TTL
  const payload = b64url(Buffer.from(JSON.stringify({ sub: adminId, role: 'admin', exp })));
  const sig     = b64url(
    crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest()
  );
  return `${header}.${payload}.${sig}`;
}

function verifyAdminToken(token) {
  try {
    const secret = getSecret();
    const parts  = token.split('.');
    if (parts.length !== 3) return null;
    const [header, payload, sig] = parts;

    const expected = crypto.createHmac('sha256', secret)
      .update(`${header}.${payload}`).digest();
    const actual   = Buffer.from(
      sig.replace(/-/g, '+').replace(/_/g, '/'), 'base64'
    );

    if (actual.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(actual, expected)) return null;

    const claims = JSON.parse(
      Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()
    );
    if (!claims.sub || claims.role !== 'admin') return null;
    if (claims.exp < Math.floor(Date.now() / 1000)) return null;

    return claims;
  } catch { return null; }
}

export async function verifyAdmin(req) {
  const raw   = req.headers.authorization || req.headers.Authorization || '';
  const token = raw.startsWith('Bearer ') ? raw.slice(7).trim() : null;
  if (!token) return null;
  const claims = verifyAdminToken(token);
  return claims ? { id: claims.sub } : null;
}
