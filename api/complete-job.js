// api/complete-job.js → POST /api/complete-job
// Driver confirms job complete after customer sign-off.
// Creates payout record (pending). Payouts are settled via weekly invoices + BACS.

import { verifyDriver, getSupabaseAdmin } from './_lib/auth.js';
import { sendEmail, signBookingLink } from './_lib/email.js';
import { sendSMS } from './_lib/sms.js';
import cors from './_lib/cors.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).end();

  const caller = await verifyDriver(req);
  if (!caller) return res.status(401).json({ error: 'Unauthorized' });

  const { job_id } = req.body || {};
  if (!job_id) return res.status(400).json({ error: 'job_id required' });

  const admin = getSupabaseAdmin();

  const { data: job } = await admin
    .from('jobs')
    .select('id, status, driver_id, customer_quote_gbp, deposit_gbp, balance_gbp, final_total_gbp, stripe_payment_intent_id, customer_email, customer_name, customer_phone, pickup_postcode, destination_postcode, move_date')
    .eq('id', job_id)
    .eq('driver_id', caller.id)
    .maybeSingle();

  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (!['accepted', 'in_progress'].includes(job.status))
    return res.status(409).json({ error: 'Job is not in a completable state' });

  // Recalculate final total server-side from quote + active item deltas
  const { data: items } = await admin
    .from('job_items')
    .select('price_delta_gbp')
    .eq('job_id', job_id)
    .eq('active', true);

  const itemDeltas = (items || []).reduce((sum, i) => sum + Math.max(0, Number(i.price_delta_gbp) || 0), 0);
  const finalTotal = Number(job.customer_quote_gbp) + itemDeltas;

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

  // SMS: receipt
  if (job.customer_phone) {
    const smsBookingUrl = signBookingLink(job_id);
    sendSMS({
      to: job.customer_phone,
      body: `Move complete! Total: £${finalTotal.toFixed(2)}. View your receipt: ${smsBookingUrl}`,
    }).catch(err => console.error('[complete-job] Receipt SMS failed:', err));
  }

  // Send receipt email to customer
  if (job.customer_email) {
    const bookingUrl = signBookingLink(job_id);
    const custName = job.customer_name?.split(' ')[0] || 'there';
    const moveDate = new Date(job.move_date).toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long',
    });

    sendEmail({
      to:      job.customer_email,
      subject: `Move complete — receipt for ${job.pickup_postcode} to ${job.destination_postcode}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#111">
          <h2 style="margin-bottom:4px">Hi ${custName},</h2>
          <p>Your move is complete. Here's your receipt.</p>

          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid #eee"><strong>Move date</strong></td>
              <td style="padding:8px 0;border-bottom:1px solid #eee">${moveDate}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid #eee"><strong>Route</strong></td>
              <td style="padding:8px 0;border-bottom:1px solid #eee">${job.pickup_postcode} to ${job.destination_postcode}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid #eee"><strong>Deposit paid</strong></td>
              <td style="padding:8px 0;border-bottom:1px solid #eee">&pound;${job.deposit_gbp?.toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid #eee"><strong>Balance charged</strong></td>
              <td style="padding:8px 0;border-bottom:1px solid #eee">&pound;${(finalTotal - (job.deposit_gbp || 0)).toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding:8px 0"><strong>Total paid</strong></td>
              <td style="padding:8px 0;font-size:1.2em;font-weight:bold">&pound;${finalTotal.toFixed(2)}</td>
            </tr>
          </table>

          <a href="${bookingUrl}" style="display:inline-block;background:#d946ef;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:1.1em;margin:16px 0">
            View full receipt
          </a>

          <p style="color:#aaa;font-size:0.8em;margin-top:24px">
            Thank you for choosing VDM. We hope your move went smoothly.
          </p>
        </div>
      `,
    }).catch(err => console.error('[complete-job] Receipt email failed:', err));
  }

  res.json({ ok: true, final_total_gbp: finalTotal });
}
