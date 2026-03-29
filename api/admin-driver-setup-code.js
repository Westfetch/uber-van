// POST /api/admin-driver-setup-code — Generate a one-time setup code for a driver
// Body: { driver_id }
// Returns: { code } (plaintext, 9 chars, uppercase alphanumeric)

import crypto from 'crypto';
import { verifyAdmin, getSupabaseAdmin } from './_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const admin = await verifyAdmin(req);
  if (!admin) return res.status(401).json({ error: 'Unauthorized' });

  const { driver_id } = req.body || {};
  if (!driver_id) return res.status(400).json({ error: 'driver_id required' });

  const sb = getSupabaseAdmin();

  // Verify driver exists
  const { data: driver } = await sb.from('drivers').select('id').eq('id', driver_id).single();
  if (!driver) return res.status(404).json({ error: 'Driver not found' });

  // Generate 9-char alphanumeric code
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid confusion
  let code = '';
  const bytes = crypto.randomBytes(9);
  for (let i = 0; i < 9; i++) code += chars[bytes[i] % chars.length];

  // Hash and store
  const hash = crypto.createHash('sha256').update(code).digest('hex');
  const expires = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(); // 48 hours

  const { error } = await sb
    .from('drivers')
    .update({ setup_code_hash: hash, setup_code_expires_at: expires })
    .eq('id', driver_id);

  if (error) return res.status(500).json({ error: error.message });

  res.json({ code });
}
