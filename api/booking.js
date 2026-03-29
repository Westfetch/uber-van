// api/booking.js
// Customer booking status page — token-based auth, no password needed.
// GET ?id={jobId}&token={token}        — primary auth (permanent URL)
// GET ?id={jobId}&sig={sig}&exp={exp}  — signed email link (30-day TTL)
// Returns customer-safe job data, items, and relevant events.

import crypto from 'crypto';
import { getSupabaseAdmin } from './_lib/auth.js';
import { verifyBookingSig } from './_lib/email.js';
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
  if (req.method !== 'GET') return res.status(405).end();

  const { id, token, sig, exp } = req.query || {};
  if (!id) return res.status(400).json({ error: 'id required' });
  if (!token && !sig) return res.status(400).json({ error: 'token or sig required' });

  const db = getSupabaseAdmin();

  // Fetch job
  const { data: job, error: jobErr } = await db
    .from('jobs')
    .select('id, status, pickup_postcode, destination_postcode, move_date, start_time, customer_name, customer_quote_gbp, deposit_gbp, balance_gbp, van_loads, crew_required, accepted_at, completed_at, customer_token_hash, driver_id')
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
