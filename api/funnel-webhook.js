// api/funnel-webhook.js
// Receives confirmed bookings from funnels (e.g. VDM wizard after Stripe deposit).
// Verifies HMAC-SHA256 signature, writes job to DB, creates first job_offer for Joe.
//
// POST /api/funnel-webhook
// Headers: x-funnel-slug, x-signature (HMAC-SHA256 hex of raw body)
// Body: {
//   funnel_job_ref, customer_name, customer_phone, customer_email,
//   pickup_postcode, destination_postcode, move_date, start_time,
//   context_block, quote_data, effective_volume_cuft, van_loads, crew_required,
//   customer_quote_gbp, deposit_gbp, balance_gbp, stripe_payment_intent_id
// }

import crypto from 'crypto';
import { getSupabaseAdmin } from './_lib/auth.js';
import { sendPush } from './_lib/push.js';

// Joe's driver ID — first dibs on all VDM jobs.
// Set via env var so this doesn't need a code deploy when Joe's ID changes.
const JOE_DRIVER_ID = process.env.JOE_DRIVER_ID;
const OFFER_WINDOW_MINS = 30;

function verifySignature(rawBody, secret, signature) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(signature, 'hex')
    );
  } catch { return false; }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const slug      = req.headers['x-funnel-slug'];
  const signature = req.headers['x-signature'];
  if (!slug || !signature)
    return res.status(400).json({ error: 'x-funnel-slug and x-signature headers required' });

  // Raw body needed for HMAC — Vercel provides it as req.body (string) when Content-Type is application/json
  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  const body    = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

  const admin = getSupabaseAdmin();

  // Look up funnel
  const { data: funnel, error: funnelErr } = await admin
    .from('funnels')
    .select('id, platform_fee_pct, webhook_secret')
    .eq('slug', slug)
    .maybeSingle();

  if (funnelErr || !funnel)
    return res.status(404).json({ error: 'Unknown funnel' });

  if (!verifySignature(rawBody, funnel.webhook_secret, signature))
    return res.status(401).json({ error: 'Invalid signature' });

  const {
    funnel_job_ref, customer_name, customer_phone, customer_email,
    pickup_postcode, destination_postcode, move_date, start_time,
    context_block, quote_data, effective_volume_cuft, van_loads, crew_required, van_size,
    customer_quote_gbp, deposit_gbp, balance_gbp, stripe_payment_intent_id,
  } = body;

  // Create the job
  const { data: job, error: jobErr } = await admin
    .from('jobs')
    .insert({
      funnel_id: funnel.id,
      funnel_job_ref,
      customer_name, customer_phone, customer_email,
      pickup_postcode: pickup_postcode.toUpperCase(),
      destination_postcode: destination_postcode.toUpperCase(),
      move_date, start_time,
      context_block, quote_data,
      effective_volume_cuft, van_loads, crew_required,
      van_size: van_size || 'luton',
      customer_quote_gbp, deposit_gbp, balance_gbp,
      stripe_payment_intent_id,
      status: 'pending_acceptance',
    })
    .select('id')
    .single();

  if (jobErr) {
    console.error('Failed to create job:', jobErr);
    return res.status(500).json({ error: 'Failed to create job' });
  }

  // Log deposit_charged event
  await admin.from('job_events').insert({
    job_id:     job.id,
    event_type: 'deposit_charged',
    payload:    { amount_gbp: deposit_gbp, stripe_payment_intent_id },
    created_by: 'system',
  });

  // Calculate driver payout for Joe
  // For MVP: payout = customer_quote × (1 - fee_pct/100)
  // Full distance recalculation (driver depot → pickup → dest) done in accept-job
  const driverPayout = parseFloat(
    (customer_quote_gbp * (1 - funnel.platform_fee_pct / 100)).toFixed(2)
  );

  const expiresAt = new Date(Date.now() + OFFER_WINDOW_MINS * 60 * 1000).toISOString();

  // Create offer for Joe (first dibs)
  if (JOE_DRIVER_ID) {
    await admin.from('job_offers').insert({
      job_id:            job.id,
      driver_id:         JOE_DRIVER_ID,
      expires_at:        expiresAt,
      driver_payout_gbp: driverPayout,
    });

    await admin.from('job_events').insert({
      job_id:     job.id,
      event_type: 'offer_sent',
      payload:    { driver_id: JOE_DRIVER_ID, payout_gbp: driverPayout, expires_at: expiresAt },
      created_by: 'system',
    });

    // Push notification to driver's device (fire and forget)
    const { data: driverRow } = await admin
      .from('drivers').select('fcm_token').eq('id', JOE_DRIVER_ID).maybeSingle();
    if (driverRow?.fcm_token) {
      sendPush(driverRow.fcm_token, {
        title: 'New job offer',
        body: `${body.pickup_postcode} → ${body.destination_postcode} — ${body.move_date}`,
        data: { offer_id: job.id },
      }).catch(err => console.error('Push send failed:', err));
    }
  }

  // Notify Joe via email (fire and forget)
  fetch(`${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/api/notify`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'x-internal': process.env.INTERNAL_SECRET || '' },
    body:    JSON.stringify({ type: 'new_job', job_id: job.id, driver_id: JOE_DRIVER_ID }),
  }).catch(err => console.error('Notify failed:', err));

  res.json({ ok: true, job_id: job.id });
}
