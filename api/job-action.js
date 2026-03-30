// api/job-action.js
// Consolidated driver job actions: accept, complete, decline.
// POST /api/job-action?action=accept|complete|decline

import Stripe from 'stripe';
import { verifyDriver, getSupabaseAdmin } from './_lib/auth.js';
import { sendEmail, signBookingLink } from './_lib/email.js';
import { sendSMS } from './_lib/sms.js';
import { getVanLabel } from './_lib/vanConfig.js';
import { advanceDispatch } from './_lib/dispatch.js';
import cors from './_lib/cors.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).end();

  const caller = await verifyDriver(req);
  if (!caller) return res.status(401).json({ error: 'Unauthorized' });

  const action = req.query.action || req.body?.action;
  const admin = getSupabaseAdmin();

  switch (action) {
    case 'accept':       return handleAccept(req, res, admin, caller);
    case 'complete':     return handleComplete(req, res, admin, caller);
    case 'decline':      return handleDecline(req, res, admin, caller);
    case 'board-accept': return handleBoardAccept(req, res, admin, caller);
    default:
      return res.status(400).json({ error: 'Invalid action. Use accept, complete, decline, or board-accept.' });
  }
}

// ── Accept offer ──────────────────────────────────────────────────────────────

async function handleAccept(req, res, admin, caller) {
  const { offer_id } = req.body || {};
  if (!offer_id) return res.status(400).json({ error: 'offer_id required' });

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
    .update({ status: 'accepted', driver_id: caller.id, accepted_at: new Date().toISOString(), dispatch_phase: 'filled' })
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

  // Expire any other pending offers on this job
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
      .from('drivers').select('name, van_size').eq('id', caller.id).maybeSingle();
    const driverName = driverRow?.name?.split(' ')[0] || 'Your driver';
    const vanLabel = getVanLabel(driverRow?.van_size || 'luton', 'customer');
    const moveDate = new Date(job.move_date).toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long',
    });
    const bookingUrl = signBookingLink(offer.job_id);
    const custName = job.customer_name?.split(' ')[0] || 'there';

    // SMS: driver assigned
    if (job.customer_phone) {
      sendSMS({
        to: job.customer_phone,
        body: `Your move on ${moveDate} is confirmed! ${driverName} will arrive at ${job.pickup_postcode} at ${job.start_time || '08:00'} in a ${vanLabel}. Track your booking: ${bookingUrl}`,
      }).catch(err => console.error('[job-action/accept] Customer SMS failed:', err));
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
              <td style="padding:8px 0;border-bottom:1px solid #eee"><strong>Vehicle</strong></td>
              <td style="padding:8px 0;border-bottom:1px solid #eee">${vanLabel.charAt(0).toUpperCase() + vanLabel.slice(1)}</td>
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
    }).catch(err => console.error('[job-action/accept] Customer email failed:', err));
  }

  res.json({ ok: true, job });
}

// ── Complete job ──────────────────────────────────────────────────────────────

async function handleComplete(req, res, admin, caller) {
  const { job_id } = req.body || {};
  if (!job_id) return res.status(400).json({ error: 'job_id required' });

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

  // Create payout record
  const { data: funnel } = await admin
    .from('jobs')
    .select('funnel_id, owner_referral_driver_id, funnels(platform_fee_pct)')
    .eq('id', job_id)
    .maybeSingle();

  const feePct     = funnel?.funnels?.platform_fee_pct || 5;
  const gross      = Number(finalTotal);
  const fee        = parseFloat((gross * feePct / 100).toFixed(2));
  const net        = parseFloat((gross - fee).toFixed(2));

  const { data: driverPayout } = await admin.from('payouts').insert({
    job_id, driver_id: caller.id,
    gross_gbp: gross, platform_fee_gbp: fee, net_gbp: net,
    status: 'pending',
  }).select('id').single();

  // Referral payout: if a pool driver completed an owner's funnel job
  const ownerRefId = funnel?.owner_referral_driver_id;
  if (ownerRefId && ownerRefId !== caller.id) {
    const stripeFeePct = 0.029;
    const stripeFeeFlat = 0.20;
    const smsCost = 0.28;
    const stripeFee = parseFloat((gross * stripeFeePct + stripeFeeFlat).toFixed(2));
    const netPlatformFee = Math.max(0, fee - stripeFee - smsCost);
    const referralAmount = parseFloat((netPlatformFee * 0.50).toFixed(2));

    if (referralAmount > 0) {
      const { data: refPayout } = await admin.from('payouts').insert({
        job_id, driver_id: ownerRefId,
        gross_gbp: referralAmount, platform_fee_gbp: 0, net_gbp: referralAmount,
        status: 'pending',
      }).select('id').single();

      if (refPayout && driverPayout) {
        await admin.from('payouts')
          .update({ referral_payout_id: refPayout.id })
          .eq('id', driverPayout.id);
      }

      await admin.from('job_events').insert({
        job_id,
        event_type: 'referral_payout_created',
        payload: { owner_driver_id: ownerRefId, referral_gbp: referralAmount, driver_payout_id: driverPayout?.id },
        created_by: 'system',
      });
    }
  }

  // SMS: receipt
  if (job.customer_phone) {
    const smsBookingUrl = signBookingLink(job_id);
    sendSMS({
      to: job.customer_phone,
      body: `Move complete! Total: £${finalTotal.toFixed(2)}. View your receipt: ${smsBookingUrl}`,
    }).catch(err => console.error('[job-action/complete] Receipt SMS failed:', err));
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
    }).catch(err => console.error('[job-action/complete] Receipt email failed:', err));
  }

  res.json({ ok: true, final_total_gbp: finalTotal });
}

// ── Decline offer ─────────────────────────────────────────────────────────────

async function handleDecline(req, res, admin, caller) {
  const { offer_id } = req.body || {};
  if (!offer_id) return res.status(400).json({ error: 'offer_id required' });

  const { data: offer } = await admin
    .from('job_offers')
    .update({ status: 'declined' })
    .eq('id', offer_id)
    .eq('driver_id', caller.id)
    .eq('status', 'pending')
    .select('job_id')
    .maybeSingle();

  if (!offer) return res.status(404).json({ error: 'Offer not found or already actioned' });

  await admin.from('job_events').insert({
    job_id:     offer.job_id,
    event_type: 'offer_declined',
    payload:    { driver_id: caller.id, offer_id },
    created_by: 'driver',
  });

  // Advance dispatch — offer to next driver in cascade, or escalate to board
  advanceDispatch(admin, offer.job_id).catch(err =>
    console.error('[job-action/decline] Dispatch advance failed:', err)
  );

  res.json({ ok: true });
}

// ── Board accept: pool driver grabs a job from the open board ────────────────
// Creates offer + accepts atomically. No prior offer exists for this driver.

async function handleBoardAccept(req, res, admin, caller) {
  const { job_id } = req.body || {};
  if (!job_id) return res.status(400).json({ error: 'job_id required' });

  // Verify job is on the board and still available
  const { data: job, error: jobErr } = await admin
    .from('jobs')
    .update({ status: 'accepted', driver_id: caller.id, accepted_at: new Date().toISOString(), dispatch_phase: 'filled' })
    .eq('id', job_id)
    .eq('status', 'pending_acceptance')
    .eq('dispatch_phase', 'board')
    .select('id, pickup_postcode, destination_postcode, move_date, start_time, customer_quote_gbp, deposit_gbp, balance_gbp, context_block, quote_data, effective_volume_cuft, van_loads, crew_required, stripe_payment_intent_id, customer_email, customer_name, customer_phone, funnel_id')
    .maybeSingle();

  if (jobErr || !job) return res.status(409).json({ error: 'Job no longer available' });

  // Get fee pct for payout calc
  const { data: funnel } = await admin
    .from('funnels')
    .select('platform_fee_pct')
    .eq('id', job.funnel_id)
    .maybeSingle();
  const feePct = funnel?.platform_fee_pct || 5;
  const driverPayout = parseFloat((Number(job.customer_quote_gbp) * (1 - feePct / 100)).toFixed(2));

  // Create the offer record (for audit trail consistency)
  await admin.from('job_offers').insert({
    job_id,
    driver_id: caller.id,
    expires_at: new Date().toISOString(), // already accepted, expired immediately
    driver_payout_gbp: driverPayout,
    status: 'accepted',
  });

  // Expire any other pending offers on this job
  await admin
    .from('job_offers')
    .update({ status: 'expired' })
    .eq('job_id', job_id)
    .eq('status', 'pending')
    .neq('driver_id', caller.id);

  // Capture deposit
  if (job.stripe_payment_intent_id) {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    await stripe.paymentIntents.capture(job.stripe_payment_intent_id);
  }

  // Audit log
  await admin.from('job_events').insert({
    job_id,
    event_type: 'offer_accepted',
    payload: { driver_id: caller.id, payout_gbp: driverPayout, phase: 'board' },
    created_by: 'driver',
  });

  // Notify customer (same as regular accept)
  if (job.customer_email) {
    const { data: driverRow } = await admin
      .from('drivers').select('name, van_size').eq('id', caller.id).maybeSingle();
    const driverName = driverRow?.name?.split(' ')[0] || 'Your driver';
    const vanLabel = getVanLabel(driverRow?.van_size || 'luton', 'customer');
    const moveDate = new Date(job.move_date).toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long',
    });
    const bookingUrl = signBookingLink(job_id);
    const custName = job.customer_name?.split(' ')[0] || 'there';

    if (job.customer_phone) {
      sendSMS({
        to: job.customer_phone,
        body: `Your move on ${moveDate} is confirmed! ${driverName} will arrive at ${job.pickup_postcode} at ${job.start_time || '08:00'} in a ${vanLabel}. Track your booking: ${bookingUrl}`,
      }).catch(err => console.error('[job-action/board-accept] Customer SMS failed:', err));
    }

    sendEmail({
      to: job.customer_email,
      subject: `You're booked! ${driverName} confirmed for ${job.pickup_postcode} to ${job.destination_postcode}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#111">
          <h2 style="margin-bottom:4px">Hi ${custName},</h2>
          <p><strong>${driverName}</strong> has confirmed your move. Your deposit has been charged.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <tr><td style="padding:8px 0;border-bottom:1px solid #eee"><strong>Date</strong></td><td style="padding:8px 0;border-bottom:1px solid #eee">${moveDate}</td></tr>
            <tr><td style="padding:8px 0;border-bottom:1px solid #eee"><strong>Start time</strong></td><td style="padding:8px 0;border-bottom:1px solid #eee">${job.start_time || '08:00'}</td></tr>
            <tr><td style="padding:8px 0;border-bottom:1px solid #eee"><strong>Pickup</strong></td><td style="padding:8px 0;border-bottom:1px solid #eee">${job.pickup_postcode}</td></tr>
            <tr><td style="padding:8px 0;border-bottom:1px solid #eee"><strong>Driver</strong></td><td style="padding:8px 0;border-bottom:1px solid #eee">${driverName}</td></tr>
            <tr><td style="padding:8px 0"><strong>Deposit charged</strong></td><td style="padding:8px 0">&pound;${job.deposit_gbp?.toFixed(2)}</td></tr>
          </table>
          <p style="color:#666;font-size:0.9em">Balance of &pound;${job.balance_gbp?.toFixed(2)} is due on the day of your move.</p>
          <a href="${bookingUrl}" style="display:inline-block;background:#d946ef;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:1.1em;margin:16px 0">View your booking</a>
        </div>
      `,
    }).catch(err => console.error('[job-action/board-accept] Customer email failed:', err));
  }

  res.json({ ok: true, job });
}
