// api/complete-job.js → POST /api/complete-job
// Driver confirms job complete after customer sign-off.
// Triggers Stripe balance charge + payout (stubs for now — Stripe Connect setup required).

import { verifyDriver, getSupabaseAdmin } from './_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const caller = await verifyDriver(req);
  if (!caller) return res.status(401).json({ error: 'Unauthorized' });

  const { job_id } = req.body || {};
  if (!job_id) return res.status(400).json({ error: 'job_id required' });

  const admin = getSupabaseAdmin();

  const { data: job } = await admin
    .from('jobs')
    .select('id, status, driver_id, customer_quote_gbp, balance_gbp, final_total_gbp, stripe_payment_intent_id')
    .eq('id', job_id)
    .eq('driver_id', caller.id)
    .maybeSingle();

  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (!['accepted', 'in_progress'].includes(job.status))
    return res.status(409).json({ error: 'Job is not in a completable state' });

  // TODO: Charge Stripe balance (stripe.paymentIntents.capture or new charge for balance)
  // TODO: Stripe Connect transfer to driver.stripe_account_id

  const finalTotal = job.final_total_gbp || job.customer_quote_gbp;

  // Mark completed
  await admin
    .from('jobs')
    .update({ status: 'completed', completed_at: new Date().toISOString(), final_total_gbp: finalTotal })
    .eq('id', job_id);

  // Log events
  await admin.from('job_events').insert([
    {
      job_id, event_type: 'customer_signed_off',
      payload: { final_total_gbp: finalTotal }, created_by: 'driver',
    },
    {
      job_id, event_type: 'balance_charged',
      payload: { amount_gbp: job.balance_gbp, stripe_stub: true }, created_by: 'system',
    },
  ]);

  // Create payout record (transfer to be processed async)
  const { data: funnel } = await admin
    .from('jobs')
    .select('funnel_id, funnels(platform_fee_pct)')
    .eq('id', job_id)
    .maybeSingle();

  const feePct     = funnel?.funnels?.platform_fee_pct || 5;
  const gross      = Number(finalTotal);
  const fee        = parseFloat((gross * feePct / 100).toFixed(2));
  const net        = parseFloat((gross - fee).toFixed(2));

  await admin.from('payouts').insert({
    job_id, driver_id: caller.id,
    gross_gbp: gross, platform_fee_gbp: fee, net_gbp: net,
    status: 'pending',
  });

  res.json({ ok: true, final_total_gbp: finalTotal });
}
