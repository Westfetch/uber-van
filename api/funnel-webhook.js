// api/funnel-webhook.js
// Receives confirmed bookings from funnels (e.g. VDM wizard after Stripe deposit).
// Verifies HMAC-SHA256 signature, writes job to DB, dispatches to owner-driver or pool.
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
import { notifyAdmins } from './_lib/adminNotify.js';
import { advanceDispatch } from './_lib/dispatch.js';

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

  // Look up funnel (now includes owner_driver_id)
  const { data: funnel, error: funnelErr } = await admin
    .from('funnels')
    .select('id, platform_fee_pct, webhook_secret, owner_driver_id')
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

  // Validate payment amounts
  if (typeof customer_quote_gbp !== 'number' || customer_quote_gbp <= 0 || customer_quote_gbp > 10000)
    return res.status(400).json({ error: 'customer_quote_gbp must be between 0 and 10000' });
  if (typeof deposit_gbp !== 'number' || deposit_gbp < 0)
    return res.status(400).json({ error: 'deposit_gbp must be non-negative' });
  if (typeof balance_gbp !== 'number' || balance_gbp < 0)
    return res.status(400).json({ error: 'balance_gbp must be non-negative' });
  const amountDrift = Math.abs((deposit_gbp + balance_gbp) - customer_quote_gbp);
  if (amountDrift > 0.02)
    return res.status(400).json({ error: 'deposit_gbp + balance_gbp must equal customer_quote_gbp' });

  // Deduplication: reject if funnel_job_ref already exists
  if (funnel_job_ref) {
    const { data: existing } = await admin
      .from('jobs')
      .select('id')
      .eq('funnel_job_ref', funnel_job_ref)
      .maybeSingle();
    if (existing)
      return res.json({ ok: true, job_id: existing.id, deduplicated: true });
  }

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
      dispatch_phase: 'owner',
      owner_referral_driver_id: funnel.owner_driver_id || null,
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

  // Calculate driver payout
  const driverPayout = parseFloat(
    (customer_quote_gbp * (1 - funnel.platform_fee_pct / 100)).toFixed(2)
  );

  // ── Dispatch: owner-driver first, then cascade/board ──────────────────────
  let ownerOffered = false;

  if (funnel.owner_driver_id) {
    // Check owner eligibility
    const { data: owner } = await admin
      .from('drivers')
      .select('id, online, approval_status, van_size, crew_count, blocked_dates, priority_window_mins, fcm_token')
      .eq('id', funnel.owner_driver_id)
      .maybeSingle();

    const VAN_RANK = { swb: 1, mwb: 2, lwb: 3, luton: 4, '7.5t': 5 };
    const jobVan = van_size || 'luton';
    const ownerEligible = owner
      && owner.approval_status === 'approved'
      && owner.online
      && (VAN_RANK[owner.van_size] || 0) >= (VAN_RANK[jobVan] || 0)
      && (!crew_required || (owner.crew_count + 1) >= crew_required)
      && !owner.blocked_dates?.includes(move_date);

    if (ownerEligible) {
      const windowMins = owner.priority_window_mins || 30;
      const expiresAt = new Date(Date.now() + windowMins * 60 * 1000).toISOString();

      await admin.from('job_offers').insert({
        job_id:            job.id,
        driver_id:         owner.id,
        expires_at:        expiresAt,
        driver_payout_gbp: driverPayout,
      });

      await admin.from('job_events').insert({
        job_id:     job.id,
        event_type: 'offer_sent',
        payload:    { driver_id: owner.id, payout_gbp: driverPayout, expires_at: expiresAt, phase: 'owner' },
        created_by: 'system',
      });

      // Push notification
      if (owner.fcm_token) {
        sendPush(owner.fcm_token, {
          title: 'New job offer',
          body: `${body.pickup_postcode} → ${body.destination_postcode} — ${body.move_date}`,
          data: { job_id: job.id },
        }).catch(err => console.error('Push send failed:', err));
      }

      // Email notification (fire and forget)
      fetch(`${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/api/notify`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal': process.env.INTERNAL_SECRET || '' },
        body:    JSON.stringify({ type: 'new_job', job_id: job.id, driver_id: owner.id }),
      }).catch(err => console.error('Notify failed:', err));

      ownerOffered = true;
    }
  }

  // If no owner or owner ineligible — skip straight to cascade/board
  if (!ownerOffered) {
    advanceDispatch(admin, job.id).catch(err =>
      console.error('[funnel-webhook] Dispatch advance failed:', err)
    );
  }

  // Notify admins of new job (fire-and-forget)
  notifyAdmins({
    title: 'New job created',
    body: `${body.pickup_postcode} → ${body.destination_postcode} — ${body.move_date} — £${body.customer_quote_gbp}`,
    data: { job_id: job.id },
  }).catch(err => console.error('[funnel-webhook] Admin notify failed:', err));

  res.json({ ok: true, job_id: job.id });
}
