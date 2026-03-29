// api/notify.js
// Sends email notifications to drivers.
// MVP: email via Resend. Future: VAPID push.
//
// POST { type: 'new_job', job_id, driver_id }
// Header: x-internal (internal secret, not driver token)

import { getSupabaseAdmin } from './_lib/auth.js';

const RESEND_API_KEY  = process.env.RESEND_API_KEY;
const FROM_EMAIL      = process.env.NOTIFY_FROM_EMAIL || 'jobs@uber-van.co.uk';
const BASE_URL        = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'http://localhost:5174';

function verifyInternal(req) {
  const secret = process.env.INTERNAL_SECRET;
  if (!secret) return false;
  return req.headers['x-internal'] === secret;
}

async function sendEmail({ to, subject, html }) {
  if (!RESEND_API_KEY) {
    console.log(`[notify] Email (no RESEND_API_KEY): to=${to} subject=${subject}`);
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });
  if (!res.ok) console.error('[notify] Resend error:', await res.text());
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!verifyInternal(req)) return res.status(401).json({ error: 'Unauthorized' });

  const { type, job_id, driver_id } = req.body || {};
  if (!type || !job_id || !driver_id)
    return res.status(400).json({ error: 'type, job_id, driver_id required' });

  const admin = getSupabaseAdmin();

  if (type === 'new_job') {
    const [{ data: job }, { data: driver }, { data: offer }] = await Promise.all([
      admin.from('jobs').select('pickup_postcode, destination_postcode, move_date, start_time, context_block, customer_quote_gbp, crew_required').eq('id', job_id).maybeSingle(),
      admin.from('drivers').select('name, email').eq('id', driver_id).maybeSingle(),
      admin.from('job_offers').select('id, driver_payout_gbp, expires_at').eq('job_id', job_id).eq('driver_id', driver_id).maybeSingle(),
    ]);

    if (!job || !driver?.email || !offer) {
      return res.status(404).json({ error: 'Job, driver, or offer not found' });
    }

    const ctx   = job.context_block || {};
    const flags = [
      ctx.is_bank_holiday && 'Bank holiday',
      ctx.is_sunday && 'Sunday',
      ctx.is_early_start && 'Early start',
    ].filter(Boolean).join(' · ') || 'No flags';

    const moveDate = new Date(job.move_date).toLocaleDateString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short',
    });

    const offerUrl  = `${BASE_URL}/offer/${offer.id}`;
    const expiresAt = new Date(offer.expires_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const roadMiles = ctx.road_miles || ctx.ROAD_MILES || '?';

    await sendEmail({
      to:      driver.email,
      subject: `New job — ${job.pickup_postcode} → ${job.destination_postcode}, ${moveDate}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#111">
          <h2 style="margin-bottom:4px">New job offer</h2>
          <p style="color:#666;margin-top:0">${moveDate} · ${job.start_time || '08:00'} start</p>

          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid #eee"><strong>Route</strong></td>
              <td style="padding:8px 0;border-bottom:1px solid #eee">${job.pickup_postcode} → ${job.destination_postcode} (${roadMiles} mi)</td>
            </tr>
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid #eee"><strong>Crew</strong></td>
              <td style="padding:8px 0;border-bottom:1px solid #eee">${job.crew_required}-person lift</td>
            </tr>
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid #eee"><strong>Flags</strong></td>
              <td style="padding:8px 0;border-bottom:1px solid #eee">${flags}</td>
            </tr>
            <tr>
              <td style="padding:8px 0"><strong>Your payout</strong></td>
              <td style="padding:8px 0;font-size:1.4em;font-weight:bold;color:#d946ef">£${Number(offer.driver_payout_gbp).toFixed(2)}</td>
            </tr>
          </table>

          <p style="color:#e11d48;font-size:0.9em">Offer expires at ${expiresAt}. First come, first served.</p>

          <a href="${offerUrl}" style="display:inline-block;background:#d946ef;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:1.1em">
            View job offer
          </a>

          <p style="color:#aaa;font-size:0.8em;margin-top:24px">
            This offer will expire automatically. You can decline if it doesn't suit.
          </p>
        </div>
      `,
    });

    return res.json({ ok: true });
  }

  res.status(400).json({ error: `Unknown notification type: ${type}` });
}
