// api/driver-jobs.js → GET /api/driver-jobs
// Returns jobs assigned to the calling driver (active + recent completed).

import { verifyDriver, getSupabaseAdmin } from './_lib/auth.js';
import cors from './_lib/cors.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).end();

  const caller = await verifyDriver(req);
  if (!caller) return res.status(401).json({ error: 'Unauthorized' });

  const admin = getSupabaseAdmin();
  const { data: jobs, error } = await admin
    .from('jobs')
    .select('id, pickup_postcode, destination_postcode, move_date, start_time, customer_quote_gbp, status')
    .eq('driver_id', caller.id)
    .in('status', ['accepted', 'in_progress', 'completed'])
    .order('move_date', { ascending: false })
    .limit(20);

  if (error) return res.status(500).json({ error: 'Failed to load jobs' });

  res.json({ jobs: jobs || [] });
}
