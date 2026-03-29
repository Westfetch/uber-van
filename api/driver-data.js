// api/driver-data.js — Consolidated driver data endpoint
// GET  /api/driver-data?type=job&id=:jobId
// GET  /api/driver-data?type=offer&id=:offerId
// GET  /api/driver-data?type=dashboard
// POST /api/driver-data?type=toggle-online

import { verifyDriver, getSupabaseAdmin } from './_lib/auth.js';
import cors from './_lib/cors.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const caller = await verifyDriver(req);
  if (!caller) return res.status(401).json({ error: 'Unauthorized' });

  const type = req.query.type;
  const sb = getSupabaseAdmin();

  switch (type) {
    case 'job':           return handleJob(req, res, sb, caller);
    case 'offer':         return handleOffer(req, res, sb, caller);
    case 'dashboard':     return handleDashboard(req, res, sb, caller);
    case 'toggle-online': return handleToggleOnline(req, res, sb, caller);
    case 'jobs':          return handleJobs(req, res, sb, caller);
    default:              return res.status(400).json({ error: `Unknown type: ${type}` });
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

// ── Dashboard: stats, jobs, activity ────────────────────────────────────────
async function handleDashboard(req, res, sb, caller) {
  if (req.method !== 'GET') return res.status(405).end();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [payoutsRes, jobsRes, eventsRes, driverRes] = await Promise.all([
    sb.from('payouts')
      .select('net_gbp, created_at')
      .eq('driver_id', caller.id),

    sb.from('jobs')
      .select('id, pickup_postcode, destination_postcode, move_date, start_time, customer_quote_gbp, status')
      .eq('driver_id', caller.id)
      .in('status', ['accepted', 'in_progress', 'completed'])
      .order('move_date', { ascending: true })
      .limit(30),

    sb.from('job_events')
      .select('event_type, payload, created_at, job_id, jobs(pickup_postcode, destination_postcode)')
      .in('event_type', ['offer_accepted', 'customer_signed_off', 'balance_charged', 'item_added', 'item_removed'])
      .order('created_at', { ascending: false })
      .limit(50),

    sb.from('drivers')
      .select('created_at')
      .eq('id', caller.id)
      .maybeSingle(),
  ]);

  // Filter events to only this driver's jobs
  const driverJobIds = new Set((jobsRes.data || []).map(j => j.id));
  const activity = (eventsRes.data || [])
    .filter(e => driverJobIds.has(e.job_id))
    .slice(0, 10)
    .map(e => ({
      event_type: e.event_type,
      payload: e.payload,
      created_at: e.created_at,
      job_pickup: e.jobs?.pickup_postcode,
      job_destination: e.jobs?.destination_postcode,
    }));

  // Compute payout stats
  const payouts = payoutsRes.data || [];
  const totalAll = payouts.reduce((s, p) => s + Number(p.net_gbp), 0);
  const monthPayouts = payouts.filter(p => p.created_at >= monthStart);
  const totalMonth = monthPayouts.reduce((s, p) => s + Number(p.net_gbp), 0);

  res.json({
    stats: {
      total_earned_month: Math.round(totalMonth * 100) / 100,
      total_earned_all_time: Math.round(totalAll * 100) / 100,
      job_count: payouts.length,
      avg_payout: payouts.length ? Math.round((totalAll / payouts.length) * 100) / 100 : 0,
      member_since: driverRes.data?.created_at || null,
    },
    jobs: jobsRes.data || [],
    activity,
  });
}

// ── Toggle online status ────────────────────────────────────────────────────
async function handleToggleOnline(req, res, sb, caller) {
  if (req.method !== 'POST') return res.status(405).end();

  const { data: driver } = await sb
    .from('drivers')
    .select('online')
    .eq('id', caller.id)
    .maybeSingle();

  const newOnline = !driver?.online;

  const { error } = await sb
    .from('drivers')
    .update({ online: newOnline })
    .eq('id', caller.id);

  if (error) return res.status(500).json({ error: 'Failed to update' });
  res.json({ online: newOnline });
}

// ── Driver's assigned jobs list (was driver-jobs.js) ────────────────────────
async function handleJobs(req, res, sb, caller) {
  if (req.method !== 'GET') return res.status(405).end();

  const { data: jobs, error } = await sb
    .from('jobs')
    .select('id, pickup_postcode, destination_postcode, move_date, start_time, customer_quote_gbp, status')
    .eq('driver_id', caller.id)
    .in('status', ['accepted', 'in_progress', 'completed'])
    .order('move_date', { ascending: false })
    .limit(20);

  if (error) return res.status(500).json({ error: 'Failed to load jobs' });
  res.json({ jobs: jobs || [] });
}
