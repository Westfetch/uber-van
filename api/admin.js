// /api/admin?action=<action> — Consolidated admin API
// All routes require admin auth (Bearer token).
// Actions: jobs, job, drivers, driver, driver-create, driver-setup-code, payouts, messages, message-read

import crypto from 'crypto';
import { verifyAdmin, getSupabaseAdmin } from './_lib/auth.js';
import cors from './_lib/cors.js';
import { sendEmail } from './_lib/email.js';
import { sendSMS } from './_lib/sms.js';
import { VAN_DB_VALUES } from './_lib/vanConfig.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;

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
    case 'driver-update':     return handleDriverUpdate(req, res, sb);
    case 'driver-reset':      return handleDriverReset(req, res, sb);
    case 'payouts':      return handlePayouts(req, res, sb);
    case 'messages':       return handleMessages(req, res, sb);
    case 'message-read':   return handleMessageRead(req, res, sb);
    case 'message-reply':  return handleMessageReply(req, res, sb, admin);
    case 'message-replies': return handleMessageReplies(req, res, sb);
    case 'job-cancel':     return handleJobCancel(req, res, sb);
    case 'job-status-update': return handleJobStatusUpdate(req, res, sb);
    case 'payout-update':  return handlePayoutUpdate(req, res, sb);
    case 'config':         return handleConfig(req, res, sb);
    case 'config-update':  return handleConfigUpdate(req, res, sb);
    case 'funnel-update':  return handleFunnelUpdate(req, res, sb);
    case 'export':         return handleExport(req, res, sb);
    default:               return res.status(400).json({ error: `Unknown action: ${action}` });
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
    .select('id, name, phone, email, van_size, depot_postcode, online, approval_status, rating, rating_count, created_at')
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
  if (!VAN_DB_VALUES.includes(van_size)) return res.status(400).json({ error: `Invalid van_size. Must be one of: ${VAN_DB_VALUES.join(', ')}` });

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

// ── Update driver onboarding fields ──────────────────────────────────────────
async function handleDriverUpdate(req, res, sb) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { driver_id, name, phone, email, van_size, depot_postcode, approval_status, insurance_verified, insurance_expiry, license_verified, dbs_verified, notes } = req.body || {};
  if (!driver_id) return res.status(400).json({ error: 'driver_id required' });

  const updates = {};
  // Basic driver info
  if (name !== undefined)           updates.name = name;
  if (phone !== undefined)          updates.phone = phone || null;
  if (email !== undefined)          updates.email = email || null;
  if (van_size !== undefined) {
    if (!VAN_DB_VALUES.includes(van_size)) return res.status(400).json({ error: `Invalid van_size. Must be one of: ${VAN_DB_VALUES.join(', ')}` });
    updates.van_size = van_size;
  }
  if (depot_postcode !== undefined) updates.depot_postcode = depot_postcode;
  // Onboarding fields
  if (approval_status !== undefined)   updates.approval_status = approval_status;
  if (insurance_verified !== undefined) updates.insurance_verified = insurance_verified;
  if (insurance_expiry !== undefined)   updates.insurance_expiry = insurance_expiry || null;
  if (license_verified !== undefined)   updates.license_verified = license_verified;
  if (dbs_verified !== undefined)       updates.dbs_verified = dbs_verified;
  if (notes !== undefined)              updates.notes = notes || null;

  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No fields to update' });

  const { data: driver, error } = await sb
    .from('drivers')
    .update(updates)
    .eq('id', driver_id)
    .select('*')
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ driver });
}

// ── Reset driver account ─────────────────────────────────────────────────────
async function handleDriverReset(req, res, sb) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { driver_id } = req.body || {};
  if (!driver_id) return res.status(400).json({ error: 'driver_id required' });

  const { error } = await sb
    .from('drivers')
    .update({ setup_code_hash: null, setup_code_expires_at: null, online: false })
    .eq('id', driver_id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
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

// ── Messages list ─────────────────────────────────────────────────────────────
async function handleMessages(req, res, sb) {
  const { read, sort = 'newest', search, page = '1', limit = '20' } = req.query;
  const pg     = Math.max(1, parseInt(page));
  const lim    = Math.min(100, Math.max(1, parseInt(limit)));
  const offset = (pg - 1) * lim;

  let query = sb
    .from('messages')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: sort === 'oldest' })
    .range(offset, offset + lim - 1);

  if (read === 'true')  query = query.eq('read', true);
  if (read === 'false') query = query.eq('read', false);
  if (search) query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,message.ilike.%${search}%`);

  const { data: messages, count, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  // Unread count
  const { count: unread } = await sb.from('messages').select('*', { count: 'exact', head: true }).eq('read', false);

  res.json({ messages: messages || [], unread: unread || 0, total: count || 0, page: pg, pages: Math.ceil((count || 0) / lim) });
}

// ── Mark message as read ────────────────────────────────────────────────────
async function handleMessageRead(req, res, sb) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: 'Message ID required' });

  const { error } = await sb.from('messages').update({ read: true }).eq('id', id);
  if (error) return res.status(500).json({ error: error.message });

  res.json({ success: true });
}

// ── Reply to message ────────────────────────────────────────────────────────
async function handleMessageReply(req, res, sb, admin) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message_id, reply_text, via } = req.body || {};
  if (!message_id || !reply_text || !via) return res.status(400).json({ error: 'message_id, reply_text, and via required' });

  const { data: msg } = await sb.from('messages').select('*').eq('id', message_id).single();
  if (!msg) return res.status(404).json({ error: 'Message not found' });

  const errors = [];

  if ((via === 'email' || via === 'both') && msg.email) {
    try {
      await sendEmail({ to: msg.email, subject: 'Re: Your message', html: `<p>${reply_text.replace(/\n/g, '<br>')}</p>` });
    } catch (e) { errors.push(`Email failed: ${e.message}`); }
  }

  if ((via === 'sms' || via === 'both') && msg.phone) {
    try {
      await sendSMS({ to: msg.phone, message: reply_text });
    } catch (e) { errors.push(`SMS failed: ${e.message}`); }
  }

  // Store reply for audit
  await sb.from('message_replies').insert({
    message_id,
    reply_text,
    sent_via: via,
    admin_id: admin.id,
  });

  // Mark as read
  await sb.from('messages').update({ read: true }).eq('id', message_id);

  res.json({ success: true, errors: errors.length > 0 ? errors : undefined });
}

// ── Get replies for a message ──────────────────────────────────────────────
async function handleMessageReplies(req, res, sb) {
  const { message_id } = req.query;
  if (!message_id) return res.status(400).json({ error: 'message_id required' });

  const { data: replies, error } = await sb
    .from('message_replies')
    .select('*')
    .eq('message_id', message_id)
    .order('created_at', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ replies: replies || [] });
}

// ── Cancel job ──────────────────────────────────────────────────────────────
async function handleJobCancel(req, res, sb) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { job_id, reason } = req.body || {};
  if (!job_id) return res.status(400).json({ error: 'job_id required' });

  const { data: job } = await sb.from('jobs').select('status').eq('id', job_id).single();
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const cancellable = ['pending_payment', 'pending_acceptance', 'accepted'];
  if (!cancellable.includes(job.status))
    return res.status(400).json({ error: `Cannot cancel job in ${job.status} status` });

  const { error } = await sb.from('jobs').update({ status: 'cancelled' }).eq('id', job_id);
  if (error) return res.status(500).json({ error: error.message });

  await sb.from('job_events').insert({
    job_id,
    event_type: 'cancelled',
    payload: { reason: reason || 'Admin cancelled', previous_status: job.status },
    created_by: 'admin',
  });

  res.json({ success: true });
}

// ── Update job status (admin override) ──────────────────────────────────────
async function handleJobStatusUpdate(req, res, sb) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { job_id, status, reason } = req.body || {};
  if (!job_id || !status) return res.status(400).json({ error: 'job_id and status required' });

  const valid = ['pending_payment', 'pending_acceptance', 'accepted', 'in_progress', 'completed', 'cancelled', 'refunded'];
  if (!valid.includes(status)) return res.status(400).json({ error: `Invalid status: ${status}` });

  const { data: job } = await sb.from('jobs').select('status').eq('id', job_id).single();
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const { error } = await sb.from('jobs').update({ status }).eq('id', job_id);
  if (error) return res.status(500).json({ error: error.message });

  await sb.from('job_events').insert({
    job_id,
    event_type: 'status_override',
    payload: { from: job.status, to: status, reason: reason || 'Admin override' },
    created_by: 'admin',
  });

  res.json({ success: true });
}

// ── Update payout status ────────────────────────────────────────────────────
async function handlePayoutUpdate(req, res, sb) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { payout_id, status } = req.body || {};
  if (!payout_id || !status) return res.status(400).json({ error: 'payout_id and status required' });

  const valid = ['pending', 'transferred', 'failed'];
  if (!valid.includes(status)) return res.status(400).json({ error: `Invalid status: ${status}` });

  const { error } = await sb.from('payouts').update({ status }).eq('id', payout_id);
  if (error) return res.status(500).json({ error: error.message });

  res.json({ success: true });
}

// ── CSV Export ──────────────────────────────────────────────────────────────
async function handleExport(req, res, sb) {
  const { type, status, from, to } = req.query;

  if (type === 'jobs') {
    let query = sb.from('jobs').select('id, customer_name, pickup_postcode, destination_postcode, move_date, customer_quote_gbp, deposit_gbp, balance_gbp, status, created_at, drivers(name)');
    if (status && status !== 'all') query = query.eq('status', status);
    if (from) query = query.gte('move_date', from);
    if (to) query = query.lte('move_date', to);
    const { data } = await query.order('created_at', { ascending: false });
    const rows = (data || []).map(j => [j.id, j.customer_name, j.pickup_postcode, j.destination_postcode, j.move_date, j.customer_quote_gbp, j.deposit_gbp, j.balance_gbp, j.status, j.drivers?.name || '', j.created_at]);
    return sendCSV(res, 'jobs', ['ID','Customer','Pickup','Destination','Date','Quote','Deposit','Balance','Status','Driver','Created'], rows);
  }

  if (type === 'payouts') {
    let query = sb.from('payouts').select('id, gross_gbp, platform_fee_gbp, net_gbp, status, created_at, drivers(name), jobs(move_date, funnel_job_ref)');
    if (status && status !== 'all') query = query.eq('status', status);
    const { data } = await query.order('created_at', { ascending: false });
    const rows = (data || []).map(p => [p.id, p.drivers?.name || '', p.jobs?.move_date || '', p.gross_gbp, p.platform_fee_gbp, p.net_gbp, p.status, p.created_at]);
    return sendCSV(res, 'payouts', ['ID','Driver','Move Date','Gross','Fee','Net','Status','Created'], rows);
  }

  if (type === 'drivers') {
    const { data } = await sb.from('drivers').select('id, name, phone, email, van_size, depot_postcode, approval_status, online, rating, rating_count, created_at').order('created_at', { ascending: false });
    const rows = (data || []).map(d => [d.id, d.name, d.phone || '', d.email || '', d.van_size, d.depot_postcode, d.approval_status, d.online, d.rating || '', d.rating_count, d.created_at]);
    return sendCSV(res, 'drivers', ['ID','Name','Phone','Email','Van','Depot','Approval','Online','Rating','Reviews','Created'], rows);
  }

  res.status(400).json({ error: 'type must be jobs, payouts, or drivers' });
}

// ── Platform config ────────────────────────────────────────────────────────
async function handleConfig(req, res, sb) {
  const [configRes, funnelsRes] = await Promise.all([
    sb.from('platform_config').select('pricing, updated_at').eq('id', 1).single(),
    sb.from('funnels').select('id, name, slug, depot_postcode, platform_fee_pct').order('name'),
  ]);
  res.json({
    pricing: configRes.data?.pricing || {},
    updated_at: configRes.data?.updated_at || null,
    funnels: funnelsRes.data || [],
  });
}

async function handleConfigUpdate(req, res, sb) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const updates = req.body?.pricing;
  if (!updates || typeof updates !== 'object') return res.status(400).json({ error: 'pricing object required' });

  // Fetch current, deep-merge
  const { data: current } = await sb.from('platform_config').select('pricing').eq('id', 1).single();
  const merged = { ...(current?.pricing || {}), ...updates };
  // Merge nested objects (packing_buffers, parking_rates, etc.)
  for (const key of Object.keys(updates)) {
    if (updates[key] && typeof updates[key] === 'object' && !Array.isArray(updates[key]) && current?.pricing?.[key]) {
      merged[key] = { ...current.pricing[key], ...updates[key] };
    }
  }

  const { error } = await sb.from('platform_config')
    .update({ pricing: merged, updated_at: new Date().toISOString() })
    .eq('id', 1);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ pricing: merged });
}

async function handleFunnelUpdate(req, res, sb) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { funnel_id, platform_fee_pct, depot_postcode } = req.body || {};
  if (!funnel_id) return res.status(400).json({ error: 'funnel_id required' });

  const updates = {};
  if (platform_fee_pct !== undefined) {
    const pct = parseFloat(platform_fee_pct);
    if (isNaN(pct) || pct < 0 || pct > 100) return res.status(400).json({ error: 'platform_fee_pct must be 0-100' });
    updates.platform_fee_pct = pct;
  }
  if (depot_postcode !== undefined) updates.depot_postcode = depot_postcode;

  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No fields to update' });

  const { error } = await sb.from('funnels').update(updates).eq('id', funnel_id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
}

function sendCSV(res, filename, headers, rows) {
  const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [headers.join(','), ...rows.map(r => r.map(escape).join(','))].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}-${new Date().toISOString().slice(0,10)}.csv`);
  res.send(csv);
}
