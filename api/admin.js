// /api/admin?action=<action> — Consolidated admin API
// All routes require admin auth (Bearer token).
// Actions: jobs, job, drivers, driver, driver-create, driver-setup-code, payouts

import crypto from 'crypto';
import { verifyAdmin, getSupabaseAdmin } from './_lib/auth.js';

export default async function handler(req, res) {
  const admin = await verifyAdmin(req);
  if (!admin) return res.status(401).json({ error: 'Unauthorized' });

  const sb     = getSupabaseAdmin();
  const action = req.query.action;

  switch (action) {
    case 'jobs':    return handleJobs(req, res, sb);
    case 'job':     return handleJob(req, res, sb);
    case 'drivers': return handleDrivers(req, res, sb);
    case 'driver':  return handleDriver(req, res, sb);
    case 'driver-create':     return handleDriverCreate(req, res, sb);
    case 'driver-setup-code': return handleDriverSetupCode(req, res, sb);
    case 'payouts': return handlePayouts(req, res, sb);
    default:        return res.status(400).json({ error: `Unknown action: ${action}` });
  }
}

// ── Jobs list ──────────────────────────────────────────────────────────────────
async function handleJobs(req, res, sb) {
  const { status, from, to, search, page = '1', limit = '20' } = req.query;
  const pg     = Math.max(1, parseInt(page));
  const lim    = Math.min(100, Math.max(1, parseInt(limit)));
  const offset = (pg - 1) * lim;

  let query = sb
    .from('jobs')
    .select(`
      id, customer_name, pickup_postcode, destination_postcode,
      move_date, customer_quote_gbp, status, driver_id, created_at,
      drivers(name)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + lim - 1);

  if (status && status !== 'all') query = query.eq('status', status);
  if (from)   query = query.gte('move_date', from);
  if (to)     query = query.lte('move_date', to);
  if (search) query = query.ilike('customer_name', `%${search}%`);

  const { data: jobs, count, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  const mapped = (jobs || []).map(j => ({
    ...j,
    driver_name: j.drivers?.name || null,
    drivers: undefined,
  }));

  res.json({ jobs: mapped, total: count || 0, page: pg, pages: Math.ceil((count || 0) / lim) });
}

// ── Single job detail ──────────────────────────────────────────────────────────
async function handleJob(req, res, sb) {
  const id = req.query.id;
  if (!id) return res.status(400).json({ error: 'Job ID required' });

  const [jobRes, itemsRes, eventsRes, offersRes, payoutRes] = await Promise.all([
    sb.from('jobs').select('*, drivers(name), funnels(name, slug)').eq('id', id).single(),
    sb.from('job_items').select('*').eq('job_id', id).order('added_at', { ascending: true }),
    sb.from('job_events').select('*').eq('job_id', id).order('created_at', { ascending: true }),
    sb.from('job_offers').select('*, drivers(name)').eq('job_id', id).order('offered_at', { ascending: true }),
    sb.from('payouts').select('*').eq('job_id', id).maybeSingle(),
  ]);

  if (jobRes.error || !jobRes.data) return res.status(404).json({ error: 'Job not found' });

  const offers = (offersRes.data || []).map(o => ({
    ...o, driver_name: o.drivers?.name || null, drivers: undefined,
  }));

  res.json({ job: jobRes.data, items: itemsRes.data || [], events: eventsRes.data || [], offers, payout: payoutRes.data || null });
}

// ── Drivers list ───────────────────────────────────────────────────────────────
async function handleDrivers(req, res, sb) {
  const { data: drivers, error } = await sb
    .from('drivers')
    .select('id, name, phone, email, van_size, depot_postcode, online, created_at')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const { data: stats } = await sb.from('payouts').select('driver_id, net_gbp');
  const statsMap = {};
  for (const s of (stats || [])) {
    if (!statsMap[s.driver_id]) statsMap[s.driver_id] = { count: 0, total: 0 };
    statsMap[s.driver_id].count++;
    statsMap[s.driver_id].total += Number(s.net_gbp);
  }

  const mapped = (drivers || []).map(d => ({
    ...d, job_count: statsMap[d.id]?.count || 0, total_earned: statsMap[d.id]?.total || 0,
  }));

  res.json({ drivers: mapped });
}

// ── Single driver detail ───────────────────────────────────────────────────────
async function handleDriver(req, res, sb) {
  const id = req.query.id;
  if (!id) return res.status(400).json({ error: 'Driver ID required' });

  const [driverRes, jobsRes, payoutsRes] = await Promise.all([
    sb.from('drivers').select('*').eq('id', id).single(),
    sb.from('jobs')
      .select('id, move_date, pickup_postcode, destination_postcode, customer_quote_gbp, status')
      .eq('driver_id', id)
      .order('move_date', { ascending: false }),
    sb.from('payouts').select('net_gbp').eq('driver_id', id),
  ]);

  if (driverRes.error || !driverRes.data) return res.status(404).json({ error: 'Driver not found' });

  const payouts  = payoutsRes.data || [];
  const totalNet = payouts.reduce((sum, p) => sum + Number(p.net_gbp), 0);

  res.json({
    driver: driverRes.data,
    jobs:   jobsRes.data || [],
    stats:  { job_count: payouts.length, total_net: totalNet, avg_payout: payouts.length > 0 ? totalNet / payouts.length : 0 },
  });
}

// ── Create driver ──────────────────────────────────────────────────────────────
async function handleDriverCreate(req, res, sb) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, phone, email, van_size, depot_postcode } = req.body || {};
  if (!name || !van_size || !depot_postcode) return res.status(400).json({ error: 'Name, van_size, and depot_postcode are required' });

  const { data: driver, error } = await sb
    .from('drivers')
    .insert({ name, phone, email, van_size, depot_postcode })
    .select('id, name, phone, email, van_size, depot_postcode, online, created_at')
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ driver });
}

// ── Generate setup code ────────────────────────────────────────────────────────
async function handleDriverSetupCode(req, res, sb) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { driver_id } = req.body || {};
  if (!driver_id) return res.status(400).json({ error: 'driver_id required' });

  const { data: driver } = await sb.from('drivers').select('id').eq('id', driver_id).single();
  if (!driver) return res.status(404).json({ error: 'Driver not found' });

  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  const bytes = crypto.randomBytes(9);
  for (let i = 0; i < 9; i++) code += chars[bytes[i] % chars.length];

  const hash    = crypto.createHash('sha256').update(code).digest('hex');
  const expires = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

  const { error } = await sb
    .from('drivers')
    .update({ setup_code_hash: hash, setup_code_expires_at: expires })
    .eq('id', driver_id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ code });
}

// ── Payouts list ───────────────────────────────────────────────────────────────
async function handlePayouts(req, res, sb) {
  const { status, from, to, page = '1', limit = '20' } = req.query;
  const pg     = Math.max(1, parseInt(page));
  const lim    = Math.min(100, Math.max(1, parseInt(limit)));
  const offset = (pg - 1) * lim;

  let query = sb
    .from('payouts')
    .select(`
      id, job_id, driver_id, gross_gbp, platform_fee_gbp, net_gbp,
      stripe_transfer_id, status, created_at,
      drivers(name), jobs(funnel_job_ref, move_date)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + lim - 1);

  if (status && status !== 'all') query = query.eq('status', status);

  const { data: payouts, count, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  // Summary
  const { data: allPayouts } = await sb.from('payouts').select('gross_gbp, platform_fee_gbp, net_gbp, jobs(move_date)');
  let filtered = allPayouts || [];
  if (from) filtered = filtered.filter(p => p.jobs?.move_date >= from);
  if (to)   filtered = filtered.filter(p => p.jobs?.move_date <= to);

  const summary = {
    total_gross: filtered.reduce((s, p) => s + Number(p.gross_gbp), 0),
    total_fees:  filtered.reduce((s, p) => s + Number(p.platform_fee_gbp), 0),
    total_net:   filtered.reduce((s, p) => s + Number(p.net_gbp), 0),
    count:       filtered.length,
  };

  const mapped = (payouts || []).map(p => ({
    ...p, driver_name: p.drivers?.name || null, funnel_job_ref: p.jobs?.funnel_job_ref || null,
    move_date: p.jobs?.move_date || null, drivers: undefined, jobs: undefined,
  }));

  res.json({ payouts: mapped, summary, total: count || 0, page: pg, pages: Math.ceil((count || 0) / lim) });
}
