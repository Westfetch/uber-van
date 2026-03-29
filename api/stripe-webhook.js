// api/stripe-webhook.js
// Handles Stripe webhook events: payment failures, disputes, refunds.
// Deposit capture is handled in accept-job.js; this endpoint catches
// everything else Stripe sends us.
//
// Must disable body parsing for signature verification.

import Stripe from 'stripe';
import { getSupabaseAdmin } from './_lib/auth.js';

export const config = { api: { bodyParser: false } };

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const sig = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig) return res.status(400).json({ error: 'Missing stripe-signature header' });
  if (!secret) {
    console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET not configured');
    return res.status(500).json({ error: 'Webhook not configured' });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  let event;

  try {
    const rawBody = req.body instanceof Buffer ? req.body : await readRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err) {
    console.error('[stripe-webhook] Signature verification failed:', err.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  const admin = getSupabaseAdmin();

  // payment_intent.payment_failed — deposit auth failed or balance charge failed
  if (event.type === 'payment_intent.payment_failed') {
    const pi = event.data.object;
    const { data: job } = await admin
      .from('jobs')
      .select('id, status')
      .eq('stripe_payment_intent_id', pi.id)
      .maybeSingle();

    if (job) {
      await admin.from('job_events').insert({
        job_id: job.id,
        event_type: 'payment_failed',
        payload: { stripe_payment_intent_id: pi.id, failure_message: pi.last_payment_error?.message },
        created_by: 'system',
      });
    }
  }

  // charge.dispute.created — customer disputed the charge
  if (event.type === 'charge.dispute.created') {
    const dispute = event.data.object;
    const piId = dispute.payment_intent;

    if (piId) {
      const { data: job } = await admin
        .from('jobs')
        .select('id')
        .eq('stripe_payment_intent_id', piId)
        .maybeSingle();

      if (job) {
        await admin.from('job_events').insert({
          job_id: job.id,
          event_type: 'dispute_opened',
          payload: { dispute_id: dispute.id, amount: dispute.amount, reason: dispute.reason },
          created_by: 'system',
        });

        await admin.from('jobs').update({ status: 'disputed' }).eq('id', job.id);
      }
    }
  }

  // charge.refunded — a refund was issued (manually or via future /api/refund)
  if (event.type === 'charge.refunded') {
    const charge = event.data.object;
    const piId = charge.payment_intent;

    if (piId) {
      const { data: job } = await admin
        .from('jobs')
        .select('id')
        .eq('stripe_payment_intent_id', piId)
        .maybeSingle();

      if (job) {
        await admin.from('job_events').insert({
          job_id: job.id,
          event_type: 'refund_issued',
          payload: { charge_id: charge.id, amount_refunded: charge.amount_refunded },
          created_by: 'system',
        });
      }
    }
  }

  res.json({ received: true });
}
