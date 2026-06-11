// api/_lib/email.js
// Shared email utility (Resend) + signed booking link generation.
// Used by notify.js (driver emails) and customer notification triggers.

import crypto from 'crypto';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL     = process.env.NOTIFY_FROM_EMAIL || 'jobs@uber-van.co.uk';
const BASE_URL       = process.env.NEXT_PUBLIC_BASE_URL
  || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5173');

export async function sendEmail({ to, subject, html, replyTo }) {
  if (!RESEND_API_KEY) {
    console.log(`[email] No RESEND_API_KEY: to=${to} subject=${subject}`);
    return;
  }
  const payload = { from: FROM_EMAIL, to, subject, html };
  if (replyTo) payload.reply_to = replyTo;
  const res = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });
  if (!res.ok) console.error('[email] Resend error:', await res.text());
}

// Signed booking link — HMAC-based, 30-day TTL.
// Used in emails where we don't have the raw customer token.
export function signBookingLink(jobId) {
  const secret = process.env.DRIVER_TOKEN_SECRET;
  if (!secret) throw new Error('DRIVER_TOKEN_SECRET required for signed links');

  const expires = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 days
  const payload = `${jobId}:${expires}`;
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  return `${BASE_URL}/booking/${jobId}?sig=${sig}&exp=${expires}`;
}

// Verify a signed booking link
export function verifyBookingSig(jobId, sig, exp) {
  const secret = process.env.DRIVER_TOKEN_SECRET;
  if (!secret || !sig || !exp) return false;

  const expNum = parseInt(exp, 10);
  if (isNaN(expNum) || expNum < Math.floor(Date.now() / 1000)) return false;

  const payload  = `${jobId}:${expNum}`;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(sig, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export { BASE_URL };
