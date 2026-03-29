// api/accept-job.js
// Driver accepts a job offer. Atomic — only succeeds if offer is still pending.
//
// POST { offer_id }
// Authorization: Bearer <driver-token>
// Returns { ok: true, job }

import Stripe from 'stripe';
import { verifyDriver, getSupabaseAdmin } from './_lib/auth.js';
import { sendEmail, signBookingLink } from './_lib/email.js';
import { sendSMS } from './_lib/sms.js';

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
    .select('id, pickup_postcode, destination_postcode, move_date, start_time, customer_quote_gbp, deposit_gbp, balance_gbp, context_block, quote_data, effective_volume_cuft, van_loads, crew_required, stripe_payment_intent_id, customer_email, customer_name, customer_phone')
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

  // Notify customer: driver assigned, deposit captured
  if (job.customer_email) {
    const { data: driverRow } = await admin
      .from('drivers').select('name').eq('id', caller.id).maybeSingle();
    const driverName = driverRow?.name?.split(' ')[0] || 'Your driver';
    const moveDate = new Date(job.move_date).toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long',
    });
    const bookingUrl = signBookingLink(offer.job_id);
    const custName = job.customer_name?.split(' ')[0] || 'there';

    // SMS: driver assigned
    if (job.customer_phone) {
      sendSMS({
        to: job.customer_phone,
        body: `Your move on ${moveDate} is confirmed! ${driverName} will be at ${job.pickup_postcode} at ${job.start_time || '08:00'}. Track your booking: ${bookingUrl}`,
      }).catch(err => console.error('[accept-job] Customer SMS failed:', err));
    }

    sendEmail({
      to:      job.customer_email,
      subject: `You're booked! ${driverName} confirmed for ${job.pickup_postcode} to ${job.destination_postcode}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#111">
          <h2 style="margin-bottom:4px">Hi ${custName},</h2>
          <p><strong>${driverName}</strong> has confirmed your move. Your deposit has been charged.</p>

          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid #eee"><strong>Date</strong></td>
              <td style="padding:8px 0;border-bottom:1px solid #eee">${moveDate}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid #eee"><strong>Start time</strong></td>
              <td style="padding:8px 0;border-bottom:1px solid #eee">${job.start_time || '08:00'}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid #eee"><strong>Pickup</strong></td>
              <td style="padding:8px 0;border-bottom:1px solid #eee">${job.pickup_postcode}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid #eee"><strong>Driver</strong></td>
              <td style="padding:8px 0;border-bottom:1px solid #eee">${driverName}</td>
            </tr>
            <tr>
              <td style="padding:8px 0"><strong>Deposit charged</strong></td>
              <td style="padding:8px 0">&pound;${job.deposit_gbp?.toFixed(2)}</td>
            </tr>
          </table>

          <p style="color:#666;font-size:0.9em">Balance of &pound;${job.balance_gbp?.toFixed(2)} is due on the day of your move.</p>

          <a href="${bookingUrl}" style="display:inline-block;background:#d946ef;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:1.1em;margin:16px 0">
            View your booking
          </a>

          <p style="color:#aaa;font-size:0.8em;margin-top:24px">
            You'll get a text on move day with live inventory updates.
          </p>
        </div>
      `,
    }).catch(err => console.error('[accept-job] Customer email failed:', err));
  }

  res.json({ ok: true, job });
}
