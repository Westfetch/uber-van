// api/driver-data.js — Consolidated driver data endpoint
// GET /api/driver-data?type=job&id=:jobId
// GET /api/driver-data?type=offer&id=:offerId

import { verifyDriver, getSupabaseAdmin } from './_lib/auth.js';
import cors from './_lib/cors.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).end();

  const caller = await verifyDriver(req);
  if (!caller) return res.status(401).json({ error: 'Unauthorized' });

  const type = req.query.type;
  const sb = getSupabaseAdmin();

  switch (type) {
    case 'job':   return handleJob(req, res, sb, caller);
    case 'offer': return handleOffer(req, res, sb, caller);
    default:      return res.status(400).json({ error: `Unknown type: ${type}` });
  }
}

// ── Job detail for assigned driver ──────────────────────────────────────────
async function handleJob(req, res, sb, caller) {
  const jobId = req.query.id;

  const { data: job, error } = await sb
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

// ── Offer + job summary for driver offer screen ─────────────────────────────
async function handleOffer(req, res, sb, caller) {
  const offerId = req.query.id;

  const { data: offer, error } = await sb
    .from('job_offers')
    .select('id, job_id, driver_id, driver_payout_gbp, driver_road_miles, expires_at, status')
    .eq('id', offerId)
    .eq('driver_id', caller.id)
    .maybeSingle();

  if (error || !offer) return res.status(404).json({ error: 'Offer not found' });

  const { data: job } = await sb
    .from('jobs')
    .select('id, pickup_postcode, destination_postcode, move_date, start_time, customer_quote_gbp, context_block, quote_data, effective_volume_cuft, van_loads, crew_required')
    .eq('id', offer.job_id)
    .maybeSingle();

  res.json({ offer, job });
}
