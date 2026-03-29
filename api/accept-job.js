// api/accept-job.js
// Driver accepts a job offer. Atomic — only succeeds if offer is still pending.
//
// POST { offer_id }
// Authorization: Bearer <driver-token>
// Returns { ok: true, job }

import Stripe from 'stripe';
import { verifyDriver, getSupabaseAdmin } from './_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const caller = await verifyDriver(req);
  if (!caller) return res.status(401).json({ error: 'Unauthorized' });

  const { offer_id } = req.body || {};
  if (!offer_id) return res.status(400).json({ error: 'offer_id required' });

  const admin = getSupabaseAdmin();

  // Fetch the offer
  const { data: offer, error: offerErr } = await admin
    .from('job_offers')
    .select('id, job_id, driver_id, expires_at, status, driver_payout_gbp')
    .eq('id', offer_id)
    .eq('driver_id', caller.id)
    .maybeSingle();

  if (offerErr || !offer) return res.status(404).json({ error: 'Offer not found' });
  if (offer.driver_id !== caller.id) return res.status(403).json({ error: 'Forbidden' });
  if (offer.status !== 'pending') return res.status(409).json({ error: `Offer already ${offer.status}` });
  if (new Date(offer.expires_at) < new Date()) {
    await admin.from('job_offers').update({ status: 'expired' }).eq('id', offer_id);
    return res.status(410).json({ error: 'Offer has expired' });
  }

  // Atomic acceptance: only proceeds if job is still pending_acceptance
  const { data: job, error: jobErr } = await admin
    .from('jobs')
    .update({ status: 'accepted', driver_id: caller.id, accepted_at: new Date().toISOString() })
    .eq('id', offer.job_id)
    .eq('status', 'pending_acceptance')
    .select('id, pickup_postcode, destination_postcode, move_date, start_time, customer_quote_gbp, deposit_gbp, balance_gbp, context_block, quote_data, effective_volume_cuft, van_loads, crew_required, stripe_payment_intent_id')
    .maybeSingle();

  if (jobErr || !job) return res.status(409).json({ error: 'Job no longer available' });

  // Mark offer accepted
  await admin
    .from('job_offers')
    .update({ status: 'accepted' })
    .eq('id', offer_id);

  // Expire any other pending offers on this job (shouldn't exist in MVP but good hygiene)
  await admin
    .from('job_offers')
    .update({ status: 'expired' })
    .eq('job_id', offer.job_id)
    .eq('status', 'pending')
    .neq('id', offer_id);

  // Capture the held deposit via Stripe
  if (job.stripe_payment_intent_id) {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    await stripe.paymentIntents.capture(job.stripe_payment_intent_id);
  }

  // Audit log
  await admin.from('job_events').insert({
    job_id:     offer.job_id,
    event_type: 'offer_accepted',
    payload:    { driver_id: caller.id, offer_id, payout_gbp: offer.driver_payout_gbp },
    created_by: 'driver',
  });

  res.json({ ok: true, job });
}
