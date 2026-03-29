// GET /api/admin-drivers — All drivers with job counts and earnings

import { verifyAdmin, getSupabaseAdmin } from './_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const admin = await verifyAdmin(req);
  if (!admin) return res.status(401).json({ error: 'Unauthorized' });

  const sb = getSupabaseAdmin();

  const { data: drivers, error } = await sb
    .from('drivers')
    .select('id, name, phone, email, van_size, depot_postcode, online, created_at')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  // Get aggregated stats per driver from payouts
  const { data: stats } = await sb
    .from('payouts')
    .select('driver_id, net_gbp');

  const statsMap = {};
  for (const s of (stats || [])) {
    if (!statsMap[s.driver_id]) statsMap[s.driver_id] = { count: 0, total: 0 };
    statsMap[s.driver_id].count++;
    statsMap[s.driver_id].total += Number(s.net_gbp);
  }

  const mapped = (drivers || []).map(d => ({
    ...d,
    job_count:    statsMap[d.id]?.count || 0,
    total_earned: statsMap[d.id]?.total || 0,
  }));

  res.json({ drivers: mapped });
}
