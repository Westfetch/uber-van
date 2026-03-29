// api/customer-signoff.js
// Two actions:
//   action: 'request' — Driver triggers sign-off request → SMS sent to customer
//   action: 'confirm' — Customer confirms inventory → job_event logged
//
// Request: POST { job_id, action: 'request' }  Authorization: Bearer <driver-token>
// Confirm: POST { id, token, action: 'confirm' }  (customer token auth)

import crypto from 'crypto';
import { verifyDriver, getSupabaseAdmin } from './_lib/auth.js';
import { sendSMS } from './_lib/sms.js';
import { signBookingLink } from './_lib/email.js';
import cors from './_lib/cors.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).end();

  const { action } = req.body || {};
  const admin = getSupabaseAdmin();

  // ── Driver requests sign-off ──────────────────────────────────────────
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

    // Log the request event
    await admin.from('job_events').insert({
      job_id, event_type: 'customer_signoff_requested',
      payload: {}, created_by: 'driver',
    });

    // Move to in_progress if still accepted
    if (job.status === 'accepted') {
      await admin.from('jobs').update({ status: 'in_progress' }).eq('id', job_id);
    }

    // SMS the customer
    if (job.customer_phone) {
      const bookingUrl = signBookingLink(job_id);
      sendSMS({
        to: job.customer_phone,
        body: `Your move is wrapping up! Please review your inventory and confirm everything's correct: ${bookingUrl}`,
      }).catch(err => console.error('[customer-signoff] SMS failed:', err));
    }

    return res.json({ ok: true });
  }

  // ── Customer confirms sign-off ────────────────────────────────────────
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

    // Timing-safe token verification
    const incomingHash = crypto.createHash('sha256').update(token).digest('hex');
    const stored = Buffer.from(job.customer_token_hash, 'hex');
    const given  = Buffer.from(incomingHash, 'hex');
    const match  = stored.length === given.length && crypto.timingSafeEqual(stored, given);

    if (!match) return res.status(401).json({ error: 'Invalid token' });

    // Check not already signed off
    const { data: existing } = await admin
      .from('job_events')
      .select('id')
      .eq('job_id', id)
      .eq('event_type', 'customer_signed_off')
      .maybeSingle();

    if (existing) return res.json({ ok: true, already: true });

    // Log the sign-off
    await admin.from('job_events').insert({
      job_id: id, event_type: 'customer_signed_off',
      payload: { confirmed_at: new Date().toISOString() },
      created_by: 'customer',
    });

    return res.json({ ok: true });
  }

  res.status(400).json({ error: `Unknown action: ${action}` });
}
