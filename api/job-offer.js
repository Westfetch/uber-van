// api/job-offer.js → GET /api/job-offer/:offerId
// Returns offer + job summary for the driver offer screen.
// Only returns data for the offer's assigned driver.

import { verifyDriver, getSupabaseAdmin } from './_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const caller = await verifyDriver(req);
  if (!caller) return res.status(401).json({ error: 'Unauthorized' });

  const offerId = req.query.id || req.url.split('/').pop();
  const admin   = getSupabaseAdmin();

  const { data: offer, error } = await admin
    .from('job_offers')
    .select('id, job_id, driver_id, driver_payout_gbp, driver_road_miles, expires_at, status')
    .eq('id', offerId)
    .eq('driver_id', caller.id)
    .maybeSingle();

  if (error || !offer) return res.status(404).json({ error: 'Offer not found' });

  const { data: job } = await admin
    .from('jobs')
    .select('id, pickup_postcode, destination_postcode, move_date, start_time, customer_quote_gbp, context_block, quote_data, effective_volume_cuft, van_loads, crew_required')
    .eq('id', offer.job_id)
    .maybeSingle();

  res.json({ offer, job });
}
