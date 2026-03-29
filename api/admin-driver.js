// GET /api/admin-driver?id=<uuid> — Single driver detail with job history and stats

import { verifyAdmin, getSupabaseAdmin } from './_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const admin = await verifyAdmin(req);
  if (!admin) return res.status(401).json({ error: 'Unauthorized' });

  const id = req.query.id;
  if (!id) return res.status(400).json({ error: 'Driver ID required' });

  const sb = getSupabaseAdmin();

  const [driverRes, jobsRes, payoutsRes] = await Promise.all([
    sb.from('drivers').select('*').eq('id', id).single(),
    sb.from('jobs')
      .select('id, move_date, pickup_postcode, destination_postcode, customer_quote_gbp, status')
      .eq('driver_id', id)
      .order('move_date', { ascending: false }),
    sb.from('payouts')
      .select('net_gbp')
      .eq('driver_id', id),
  ]);

  if (driverRes.error || !driverRes.data) {
    return res.status(404).json({ error: 'Driver not found' });
  }

  const payouts = payoutsRes.data || [];
  const totalNet = payouts.reduce((sum, p) => sum + Number(p.net_gbp), 0);

  res.json({
    driver: driverRes.data,
    jobs:   jobsRes.data || [],
    stats: {
      job_count:  payouts.length,
      total_net:  totalNet,
      avg_payout: payouts.length > 0 ? totalNet / payouts.length : 0,
    },
  });
}
