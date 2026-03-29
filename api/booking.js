// api/booking.js
// Customer booking status page — token-based auth, no password needed.
// GET ?id={jobId}&token={token}        — primary auth (permanent URL)
// GET ?id={jobId}&sig={sig}&exp={exp}  — signed email link (30-day TTL)
// Returns customer-safe job data, items, and relevant events.

import crypto from 'crypto';
import { verifyDriver, getSupabaseAdmin } from './_lib/auth.js';
import { verifyBookingSig, signBookingLink } from './_lib/email.js';
import { sendSMS } from './_lib/sms.js';
import cors from './_lib/cors.js';

// Event types the customer should see
const CUSTOMER_EVENTS = [
  'deposit_charged',
  'offer_accepted',
  'item_added',
  'item_removed',
  'customer_signoff_requested',
  'customer_signed_off',
  'balance_charged',
];

// Statuses where we include driver info
const DRIVER_VISIBLE_STATUSES = ['accepted', 'in_progress', 'completed'];

export default async function handler(req, res) {
  if (cors(req, res)) return;

  // POST — customer sign-off actions (was customer-signoff.js)
  if (req.method === 'POST') return handleSignoff(req, res);

  if (req.method !== 'GET') return res.status(405).end();

  const { id, token, sig, exp } = req.query || {};
  if (!id) return res.status(400).json({ error: 'id required' });
  if (!token && !sig) return res.status(400).json({ error: 'token or sig required' });

  const db = getSupabaseAdmin();

  // Fetch job
  const { data: job, error: jobErr } = await db
    .from('jobs')
    .select('id, status, pickup_postcode, destination_postcode, move_date, start_time, customer_name, customer_quote_gbp, deposit_gbp, balance_gbp, van_loads, crew_required, van_size, accepted_at, completed_at, customer_token_hash, driver_id')
    .eq('id', id)
    .maybeSingle();

  if (jobErr || !job)
    return res.status(404).json({ error: 'Booking not found' });

  // Auth: either raw token (SHA-256 comparison) or signed email link (HMAC)
  let authenticated = false;

  if (token && job.customer_token_hash) {
    const incomingHash = crypto.createHash('sha256').update(token).digest('hex');
    const stored = Buffer.from(job.customer_token_hash, 'hex');
    const given  = Buffer.from(incomingHash, 'hex');
    authenticated = stored.length === given.length && crypto.timingSafeEqual(stored, given);
  } else if (sig) {
    authenticated = verifyBookingSig(id, sig, exp);
  }

  if (!authenticated) return res.status(401).json({ error: 'Invalid token' });

  // Build customer-safe response
  const response = {
    id:                    job.id,
    status:                job.status,
    pickup_postcode:       job.pickup_postcode,
    destination_postcode:  job.destination_postcode,
    move_date:             job.move_date,
    start_time:            job.start_time,
    customer_name:         job.customer_name,
    customer_quote_gbp:    job.customer_quote_gbp,
    deposit_gbp:           job.deposit_gbp,
    balance_gbp:           job.balance_gbp,
    van_loads:             job.van_loads,
    crew_required:         job.crew_required,
    van_size:              job.van_size || 'luton',
    accepted_at:           job.accepted_at,
    completed_at:          job.completed_at,
    driver_name:           null,
    items:                 [],
    events:                [],
  };

  // Include driver first name if job is accepted+
  if (DRIVER_VISIBLE_STATUSES.includes(job.status) && job.driver_id) {
    const { data: driver } = await db
      .from('drivers')
      .select('name')
      .eq('id', job.driver_id)
      .maybeSingle();

    if (driver?.name) {
      response.driver_name = driver.name.split(' ')[0];
    }
  }

  // Fetch job items
  const { data: items } = await db
    .from('job_items')
    .select('canonical_name, quantity, volume_cuft, added_by, active, price_delta_gbp, added_at')
    .eq('job_id', id)
    .order('added_at', { ascending: true });

  response.items = items || [];

  // Fetch customer-relevant events
  const { data: events } = await db
    .from('job_events')
    .select('event_type, payload, created_at')
    .eq('job_id', id)
    .in('event_type', CUSTOMER_EVENTS)
    .order('created_at', { ascending: true });

  response.events = events || [];

  res.json(response);
}

// ── POST: Customer sign-off (was customer-signoff.js) ───────────────────────
async function handleSignoff(req, res) {
  const { action } = req.body || {};
  const admin = getSupabaseAdmin();

  // Driver requests sign-off
  if (action === 'request') {
    const caller = await verifyDriver(req);
    if (!caller) return res.status(401).json({ error: 'Unauthorized' });

    const { job_id } = req.body;
    if (!job_id) return res.status(400).json({ error: 'job_id required' });

    const { data: job } = await admin
      .from('jobs')
      .select('id, status, driver_id, customer_phone, pickup_postcode, destination_postcode')
      .eq('id', job_id)
      .eq('driver_id', caller.id)
      .maybeSingle();

    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (!['accepted', 'in_progress'].includes(job.status))
      return res.status(409).json({ error: 'Job not in a signable state' });

    await admin.from('job_events').insert({
      job_id, event_type: 'customer_signoff_requested',
      payload: {}, created_by: 'driver',
    });

    if (job.status === 'accepted') {
      await admin.from('jobs').update({ status: 'in_progress' }).eq('id', job_id);
    }

    if (job.customer_phone) {
      const bookingUrl = signBookingLink(job_id);
      sendSMS({
        to: job.customer_phone,
        body: `Your move is wrapping up! Please review your inventory and confirm everything's correct: ${bookingUrl}`,
      }).catch(err => console.error('[booking/signoff] SMS failed:', err));
    }

    return res.json({ ok: true });
  }

  // Customer confirms sign-off
  if (action === 'confirm') {
    const { id, token } = req.body;
    if (!id || !token) return res.status(400).json({ error: 'id and token required' });

    const { data: job } = await admin
      .from('jobs')
      .select('id, customer_token_hash')
      .eq('id', id)
      .maybeSingle();

    if (!job?.customer_token_hash)
      return res.status(404).json({ error: 'Booking not found' });

    const incomingHash = crypto.createHash('sha256').update(token).digest('hex');
    const stored = Buffer.from(job.customer_token_hash, 'hex');
    const given  = Buffer.from(incomingHash, 'hex');
    const match  = stored.length === given.length && crypto.timingSafeEqual(stored, given);

    if (!match) return res.status(401).json({ error: 'Invalid token' });

    const { data: existing } = await admin
      .from('job_events')
      .select('id')
      .eq('job_id', id)
      .eq('event_type', 'customer_signed_off')
      .maybeSingle();

    if (existing) return res.json({ ok: true, already: true });

    await admin.from('job_events').insert({
      job_id: id, event_type: 'customer_signed_off',
      payload: { confirmed_at: new Date().toISOString() },
      created_by: 'customer',
    });

    return res.json({ ok: true });
  }

  res.status(400).json({ error: `Unknown action: ${action}` });
}
