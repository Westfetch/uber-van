// api/driver-verify.js
// Validates a stored driver token and returns fresh driver data.
//
// GET (Authorization: Bearer <token>)
// Returns { driver: { id, name, phone, depot_postcode, van_size, online } }

import { verifyDriver, getSupabaseAdmin } from './_lib/auth.js';

const SAFE_COLS = 'id, name, phone, depot_postcode, van_size, online, push_subscription';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const caller = await verifyDriver(req);
  if (!caller) return res.status(401).json({ error: 'Unauthorized' });

  const admin = getSupabaseAdmin();
  const { data: driver, error } = await admin
    .from('drivers')
    .select(SAFE_COLS)
    .eq('id', caller.id)
    .maybeSingle();

  if (error || !driver) return res.status(404).json({ error: 'Driver not found' });

  res.json({ driver });
}
