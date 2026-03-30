// api/driver-data.js — Consolidated driver data endpoint
// GET  /api/driver-data?type=job&id=:jobId
// GET  /api/driver-data?type=offer&id=:offerId
// GET  /api/driver-data?type=dashboard
// POST /api/driver-data?type=toggle-online

import { verifyDriver, getSupabaseAdmin } from './_lib/auth.js';
import cors from './_lib/cors.js';
import { VAN_DB_VALUES } from './_lib/vanConfig.js';

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
    case 'register-push': return handleRegisterPush(req, res, sb, caller);
    case 'settings':       return handleSettings(req, res, sb, caller);
    case 'bank-details':   return handleBankDetails(req, res, sb, caller);
    case 'invoices':       return handleInvoices(req, res, sb, caller);
    case 'invoice-detail': return handleInvoiceDetail(req, res, sb, caller);
    case 'van-settings':   return handleVanSettings(req, res, sb, caller);
    case 'owner-settings': return handleOwnerSettings(req, res, sb, caller);
    case 'referral-stats': return handleReferralStats(req, res, sb, caller);
    case 'job-board':      return handleJobBoard(req, res, sb, caller);
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
      status, context_block, quote_data, effective_volume_cuft, van_loads, crew_required, van_size,
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
    .select('id, pickup_postcode, destination_postcode, move_date, start_time, customer_quote_gbp, context_block, quote_data, effective_volume_cuft, van_loads, crew_required, van_size')
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

  // Referral earnings for owner-drivers
  let referralStats = null;
  const driverInfo = driverRes.data;
  if (driverInfo?.driver_type === 'owner') {
    const { data: refPayouts } = await sb
      .from('payouts')
      .select('net_gbp, created_at')
      .eq('driver_id', caller.id)
      .eq('platform_fee_gbp', 0); // referral payouts have 0 platform fee
    const refAll = (refPayouts || []).reduce((s, p) => s + Number(p.net_gbp), 0);
    const refMonth = (refPayouts || [])
      .filter(p => p.created_at >= monthStart)
      .reduce((s, p) => s + Number(p.net_gbp), 0);
    referralStats = {
      referral_earned_month: Math.round(refMonth * 100) / 100,
      referral_earned_all_time: Math.round(refAll * 100) / 100,
      referral_count: (refPayouts || []).length,
    };
  }

  res.json({
    stats: {
      total_earned_month: Math.round(totalMonth * 100) / 100,
      total_earned_all_time: Math.round(totalAll * 100) / 100,
      job_count: payouts.length,
      avg_payout: payouts.length ? Math.round((totalAll / payouts.length) * 100) / 100 : 0,
      member_since: driverInfo?.created_at || null,
      driver_type: driverInfo?.driver_type || 'pool',
      ...(referralStats || {}),
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

// ── Register FCM push token ──────────────────────────────────────────────────
async function handleRegisterPush(req, res, sb, caller) {
  if (req.method !== 'POST') return res.status(405).end();

  const { fcm_token } = req.body || {};
  if (!fcm_token) return res.status(400).json({ error: 'fcm_token required' });

  const { error } = await sb
    .from('drivers')
    .update({ fcm_token })
    .eq('id', caller.id);

  if (error) return res.status(500).json({ error: 'Failed to save token' });
  res.json({ ok: true });
}

// ── Settings: return driver profile + bank details ──────────────────────────
async function handleSettings(req, res, sb, caller) {
  if (req.method !== 'GET') return res.status(405).end();

  const { data: driver, error } = await sb
    .from('drivers')
    .select('id, name, phone, email, van_size, depot_postcode, online, bank_sort_code, bank_account_no, bank_account_name, driver_type, priority_window_mins, working_radius_miles, crew_count, blocked_dates, created_at')
    .eq('id', caller.id)
    .maybeSingle();

  if (error || !driver) return res.status(500).json({ error: 'Failed to load settings' });

  // Mask account number for display (show last 4)
  if (driver.bank_account_no && driver.bank_account_no.length >= 4) {
    driver.bank_account_no_masked = '****' + driver.bank_account_no.slice(-4);
  }

  res.json({ driver });
}

// ── Save bank details ───────────────────────────────────────────────────────
async function handleBankDetails(req, res, sb, caller) {
  if (req.method !== 'POST') return res.status(405).end();

  const { sort_code, account_no, account_name } = req.body || {};

  if (!sort_code || !account_no || !account_name)
    return res.status(400).json({ error: 'sort_code, account_no, and account_name are required' });

  // Validate: sort code = 6 digits (with or without dashes)
  const cleanSort = sort_code.replace(/[-\s]/g, '');
  if (!/^\d{6}$/.test(cleanSort))
    return res.status(400).json({ error: 'Sort code must be 6 digits' });

  // Validate: account number = 8 digits
  const cleanAcct = account_no.replace(/\s/g, '');
  if (!/^\d{8}$/.test(cleanAcct))
    return res.status(400).json({ error: 'Account number must be 8 digits' });

  const { error } = await sb
    .from('drivers')
    .update({
      bank_sort_code:    cleanSort,
      bank_account_no:   cleanAcct,
      bank_account_name: account_name.trim(),
    })
    .eq('id', caller.id);

  if (error) return res.status(500).json({ error: 'Failed to save bank details' });
  res.json({ ok: true });
}

// ── Driver invoices list ────────────────────────────────────────────────────
async function handleInvoices(req, res, sb, caller) {
  if (req.method !== 'GET') return res.status(405).end();

  const { data: invoices, error } = await sb
    .from('invoices')
    .select('id, invoice_number, week_start, week_end, job_count, net_gbp, status, issued_at, paid_at')
    .eq('driver_id', caller.id)
    .order('week_start', { ascending: false })
    .limit(20);

  if (error) return res.status(500).json({ error: 'Failed to load invoices' });
  res.json({ invoices: invoices || [] });
}

// ── Single invoice with line items ──────────────────────────────────────────
async function handleInvoiceDetail(req, res, sb, caller) {
  if (req.method !== 'GET') return res.status(405).end();

  const id = req.query.id;
  if (!id) return res.status(400).json({ error: 'Invoice ID required' });

  const { data: invoice, error: invErr } = await sb
    .from('invoices')
    .select('*')
    .eq('id', id)
    .eq('driver_id', caller.id)
    .maybeSingle();

  if (invErr || !invoice) return res.status(404).json({ error: 'Invoice not found' });

  const { data: lines } = await sb
    .from('invoice_lines')
    .select('id, description, move_date, gross_gbp, fee_gbp, net_gbp')
    .eq('invoice_id', id)
    .order('move_date', { ascending: true });

  res.json({ invoice, lines: lines || [] });
}

// ── Van settings: POST van_size + crew_count (all drivers) ──────────────────
async function handleVanSettings(req, res, sb, caller) {
  if (req.method !== 'POST') return res.status(405).end();

  const { van_size, crew_count } = req.body || {};
  const updates = {};

  if (van_size !== undefined) {
    if (!VAN_DB_VALUES.includes(van_size))
      return res.status(400).json({ error: `van_size must be one of: ${VAN_DB_VALUES.join(', ')}` });
    updates.van_size = van_size;
  }
  if (crew_count !== undefined) {
    const c = parseInt(crew_count);
    if (isNaN(c) || c < 0 || c > 2) return res.status(400).json({ error: 'crew_count must be 0-2' });
    updates.crew_count = c;
  }

  if (Object.keys(updates).length === 0)
    return res.status(400).json({ error: 'No fields to update' });

  const { error } = await sb.from('drivers').update(updates).eq('id', caller.id);
  if (error) return res.status(500).json({ error: 'Failed to save settings' });

  res.json({ ok: true, ...updates });
}

// ── Owner settings: GET/POST priority window, radius, blocked dates ─────────
async function handleOwnerSettings(req, res, sb, caller) {
  const { data: driver } = await sb
    .from('drivers')
    .select('driver_type, priority_window_mins, working_radius_miles, blocked_dates')
    .eq('id', caller.id)
    .maybeSingle();

  if (!driver || driver.driver_type !== 'owner')
    return res.status(403).json({ error: 'Owner settings only available for owner-drivers' });

  if (req.method === 'GET') {
    return res.json({
      priority_window_mins: driver.priority_window_mins,
      working_radius_miles: driver.working_radius_miles,
      blocked_dates: driver.blocked_dates || [],
    });
  }

  if (req.method !== 'POST') return res.status(405).end();

  const { priority_window_mins, working_radius_miles, blocked_dates } = req.body || {};
  const updates = {};

  if (priority_window_mins !== undefined) {
    const mins = parseInt(priority_window_mins);
    if (isNaN(mins) || mins < 5 || mins > 240)
      return res.status(400).json({ error: 'priority_window_mins must be 5-240' });
    updates.priority_window_mins = mins;
  }
  if (working_radius_miles !== undefined) {
    if (working_radius_miles === null) {
      updates.working_radius_miles = null;
    } else {
      const r = parseInt(working_radius_miles);
      if (isNaN(r) || r < 1) return res.status(400).json({ error: 'working_radius_miles must be >= 1 or null' });
      updates.working_radius_miles = r;
    }
  }
  if (blocked_dates !== undefined) {
    if (!Array.isArray(blocked_dates)) return res.status(400).json({ error: 'blocked_dates must be an array' });
    updates.blocked_dates = blocked_dates;
  }

  if (Object.keys(updates).length === 0)
    return res.status(400).json({ error: 'No fields to update' });

  const { error } = await sb.from('drivers').update(updates).eq('id', caller.id);
  if (error) return res.status(500).json({ error: 'Failed to save settings' });

  res.json({ ok: true, ...updates });
}

// ── Referral stats for owner-drivers ────────────────────────────────────────
async function handleReferralStats(req, res, sb, caller) {
  if (req.method !== 'GET') return res.status(405).end();

  const { data: driver } = await sb
    .from('drivers')
    .select('driver_type')
    .eq('id', caller.id)
    .maybeSingle();

  if (!driver || driver.driver_type !== 'owner')
    return res.status(403).json({ error: 'Referral stats only available for owner-drivers' });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // Referral payouts are ones with platform_fee_gbp = 0 (owner gets full amount)
  const { data: refPayouts } = await sb
    .from('payouts')
    .select('id, job_id, net_gbp, created_at, jobs(pickup_postcode, destination_postcode, move_date, drivers(name))')
    .eq('driver_id', caller.id)
    .eq('platform_fee_gbp', 0)
    .order('created_at', { ascending: false })
    .limit(50);

  const all = refPayouts || [];
  const totalAll = all.reduce((s, p) => s + Number(p.net_gbp), 0);
  const monthItems = all.filter(p => p.created_at >= monthStart);
  const totalMonth = monthItems.reduce((s, p) => s + Number(p.net_gbp), 0);

  // Also get count of jobs I did vs pool did from my funnel
  const { data: funnelLink } = await sb
    .from('funnels')
    .select('id')
    .eq('owner_driver_id', caller.id)
    .maybeSingle();

  let myJobs = 0, poolJobs = 0;
  if (funnelLink) {
    const { data: funnelJobs } = await sb
      .from('jobs')
      .select('driver_id')
      .eq('funnel_id', funnelLink.id)
      .eq('status', 'completed');

    for (const j of (funnelJobs || [])) {
      if (j.driver_id === caller.id) myJobs++;
      else poolJobs++;
    }
  }

  const referrals = all.map(p => ({
    job_id: p.job_id,
    amount_gbp: Number(p.net_gbp),
    created_at: p.created_at,
    pickup: p.jobs?.pickup_postcode,
    destination: p.jobs?.destination_postcode,
    move_date: p.jobs?.move_date,
    driver_name: p.jobs?.drivers?.name || 'Unknown',
  }));

  res.json({
    summary: {
      referral_earned_month: Math.round(totalMonth * 100) / 100,
      referral_earned_all_time: Math.round(totalAll * 100) / 100,
      referral_count: all.length,
      my_jobs: myJobs,
      pool_jobs: poolJobs,
    },
    referrals,
  });
}

// ── Job board: available board-phase jobs for pool drivers ───────────────────
async function handleJobBoard(req, res, sb, caller) {
  if (req.method !== 'GET') return res.status(405).end();

  const { data: driver } = await sb
    .from('drivers')
    .select('van_size, working_radius_miles, crew_count, depot_postcode, approval_status, online')
    .eq('id', caller.id)
    .maybeSingle();

  if (!driver || driver.approval_status !== 'approved')
    return res.status(403).json({ error: 'Not eligible for job board' });

  // Get all board-phase jobs
  const { data: jobs } = await sb
    .from('jobs')
    .select('id, pickup_postcode, destination_postcode, move_date, start_time, customer_quote_gbp, van_size, crew_required, context_block, effective_volume_cuft, van_loads, board_visible_at, funnel_id, funnels(platform_fee_pct)')
    .eq('status', 'pending_acceptance')
    .eq('dispatch_phase', 'board')
    .order('board_visible_at', { ascending: false });

  if (!jobs?.length) return res.json({ jobs: [] });

  // Filter by van size and crew eligibility
  const VAN_RANK = { swb: 1, mwb: 2, lwb: 3, luton: 4, '7.5t': 5 };
  const driverVanRank = VAN_RANK[driver.van_size] || 0;

  const eligible = jobs.filter(j => {
    if ((VAN_RANK[j.van_size] || 0) > driverVanRank) return false;
    if (j.crew_required && (driver.crew_count + 1) < j.crew_required) return false;
    return true;
  });

  // Calculate payout for each job
  const mapped = eligible.map(j => {
    const feePct = j.funnels?.platform_fee_pct || 5;
    const payout = parseFloat((Number(j.customer_quote_gbp) * (1 - feePct / 100)).toFixed(2));
    return {
      id: j.id,
      pickup_postcode: j.pickup_postcode,
      destination_postcode: j.destination_postcode,
      move_date: j.move_date,
      start_time: j.start_time,
      van_size: j.van_size,
      crew_required: j.crew_required,
      van_loads: j.van_loads,
      context_block: j.context_block,
      driver_payout_gbp: payout,
      board_visible_at: j.board_visible_at,
    };
  });

  res.json({ jobs: mapped });
}
