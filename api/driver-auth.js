// api/driver-auth.js
// Driver first login. One-time setup code (SHA-256 hashed in DB) → JWT token.
//
// POST { name, setupCode }
// Returns { token, driver: { id, name, phone, depot_postcode, van_size, online } }

import crypto from 'crypto';
import { getSupabaseAdmin, signDriverToken } from './_lib/auth.js';

const SAFE_COLS = 'id, name, phone, depot_postcode, van_size, online, push_subscription';

function hashCode(code) {
  return crypto.createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
}

export default async function handler(req, res) {
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

  // Clear setup code — single use
  await admin
    .from('drivers')
    .update({ setup_code_hash: null, setup_code_expires_at: null })
    .eq('id', driver.id);

  const token = signDriverToken(driver.id);
  const { setup_code_hash, setup_code_expires_at, ...safeDriver } = driver;

  res.json({ token, driver: safeDriver });
}
