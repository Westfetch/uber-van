// api/job.js → GET /api/job/:jobId
// Returns full job data for the assigned driver.

import { verifyDriver, getSupabaseAdmin } from './_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const caller = await verifyDriver(req);
  if (!caller) return res.status(401).json({ error: 'Unauthorized' });

  const jobId = req.query.id || req.url.split('/').pop();
  const admin = getSupabaseAdmin();

  const { data: job, error } = await admin
    .from('jobs')
    .select(`
      id, pickup_postcode, destination_postcode, move_date, start_time,
      customer_quote_gbp, deposit_gbp, balance_gbp, final_total_gbp,
      status, context_block, quote_data, effective_volume_cuft, van_loads, crew_required,
      actual_miles, customer_name, customer_phone
    `)
    .eq('id', jobId)
    .eq('driver_id', caller.id)
    .maybeSingle();

  if (error || !job) return res.status(404).json({ error: 'Job not found' });

  res.json({ job });
}
