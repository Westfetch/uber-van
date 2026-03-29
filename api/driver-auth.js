// api/driver-auth.js
// POST — Driver first login. One-time setup code (SHA-256 hashed in DB) → JWT token.
//   Body: { name, setupCode }
//   Returns: { token, driver }
// GET  — Verify stored token, return fresh driver data.
//   Headers: Authorization: Bearer <token>
//   Returns: { driver }

import crypto from 'crypto';
import { getSupabaseAdmin, signDriverToken, verifyDriver } from './_lib/auth.js';

const SAFE_COLS = 'id, name, phone, depot_postcode, van_size, online, push_subscription, approval_status';

function hashCode(code) {
  return crypto.createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
}

export default async function handler(req, res) {
  // GET — verify token
  if (req.method === 'GET') {
    const caller = await verifyDriver(req);
    if (!caller) return res.status(401).json({ error: 'Unauthorized' });

    const admin = getSupabaseAdmin();
    const { data: driver, error } = await admin
      .from('drivers')
      .select(SAFE_COLS)
      .eq('id', caller.id)
      .maybeSingle();

    if (error || !driver) return res.status(404).json({ error: 'Driver not found' });
    if (driver.approval_status === 'suspended')
      return res.status(403).json({ error: 'Your account has been suspended' });
    return res.json({ driver });
  }

  // POST — login with setup code
  if (req.method !== 'POST') return res.status(405).end();

  const { name, setupCode } = req.body || {};
  if (!name || !setupCode)
    return res.status(400).json({ error: 'name and setupCode required' });

  const admin = getSupabaseAdmin();
  const incomingHash = hashCode(setupCode);

  const { data: driver, error } = await admin
    .from('drivers')
    .select(`${SAFE_COLS}, setup_code_hash, setup_code_expires_at`)
    .ilike('name', name.trim())
    .maybeSingle();

  // Always run comparison to prevent timing-based enumeration
  const dummy = Buffer.from('0'.repeat(64), 'hex');
  if (error || !driver || !driver.setup_code_hash) {
    crypto.timingSafeEqual(Buffer.from(incomingHash, 'hex'), dummy);
    return res.status(401).json({ error: 'Invalid name or setup code' });
  }

  if (new Date(driver.setup_code_expires_at) < new Date()) {
    return res.status(401).json({ error: 'Setup code expired — ask the platform for a new one' });
  }

  const stored = Buffer.from(driver.setup_code_hash, 'hex');
  const given  = Buffer.from(incomingHash, 'hex');
  const match  = stored.length === given.length && crypto.timingSafeEqual(stored, given);

  if (!match) return res.status(401).json({ error: 'Invalid name or setup code' });

  // Block unapproved / suspended drivers
  if (driver.approval_status === 'suspended')
    return res.status(403).json({ error: 'Your account has been suspended — contact the platform' });
  if (driver.approval_status !== 'approved')
    return res.status(403).json({ error: 'Your account is pending approval — we\'ll be in touch soon' });

  // Clear setup code — single use
  await admin
    .from('drivers')
    .update({ setup_code_hash: null, setup_code_expires_at: null })
    .eq('id', driver.id);

  const token = signDriverToken(driver.id);
  const { setup_code_hash, setup_code_expires_at, ...safeDriver } = driver;

  res.json({ token, driver: safeDriver });
}
