// POST /api/admin-driver-create — Create a new driver
// Body: { name, phone, email, van_size, depot_postcode }

import { verifyAdmin, getSupabaseAdmin } from './_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const admin = await verifyAdmin(req);
  if (!admin) return res.status(401).json({ error: 'Unauthorized' });

  const { name, phone, email, van_size, depot_postcode } = req.body || {};
  if (!name || !van_size || !depot_postcode) {
    return res.status(400).json({ error: 'Name, van_size, and depot_postcode are required' });
  }

  const sb = getSupabaseAdmin();

  const { data: driver, error } = await sb
    .from('drivers')
    .insert({ name, phone, email, van_size, depot_postcode })
    .select('id, name, phone, email, van_size, depot_postcode, online, created_at')
    .single();

  if (error) return res.status(500).json({ error: error.message });

  res.json({ driver });
}
