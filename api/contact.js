// api/contact.js — Public contact form endpoint (no auth required)
// POST { source, name, email, phone, message, website }
// Saves to the messages table and emails the admin inbox.
// `website` is a honeypot: real users never fill it, bots do.

import { getSupabaseAdmin } from './_lib/auth.js';
import { checkRateLimit, recordFailedAttempt } from './_lib/rateLimit.js';
import { sendEmail } from './_lib/email.js';

const ADMIN_EMAIL = process.env.CONTACT_ADMIN_EMAIL || 'admin@graft.tools';

const ALLOWED_ORIGINS = [
  'https://packingandremovalsbristol.co.uk',
  'https://www.packingandremovalsbristol.co.uk',
  'https://packingservicebristol.com',
  'https://www.packingservicebristol.com',
  'https://graft.tools',
  'https://www.graft.tools',
];

function setCors(req, res) {
  const origin = req.headers.origin;
  // Explicit allowlist only, plus localhost for local dev. Never reflect
  // arbitrary *.vercel.app origins (anyone can deploy one).
  if (ALLOWED_ORIGINS.includes(origin) || origin?.startsWith('http://localhost')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

const esc = (s) => String(s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { source, name, email, phone, message, website } = req.body || {};

  // Honeypot: silently accept and drop bot submissions.
  if (website) return res.json({ success: true });

  if (!message?.trim()) return res.status(400).json({ error: 'Message is required' });
  if (message.length > 2000) return res.status(413).json({ error: 'Message too long (max 2000 chars)' });
  if (!source) return res.status(400).json({ error: 'Source is required' });

  const sb = getSupabaseAdmin();

  // Throttle to 5 submissions per IP per 10 minutes.
  if (await checkRateLimit(req, res, sb, { scope: 'contact', window: 10, max: 5 })) return;

  const cleanSource = source.slice(0, 50);
  const cleanName   = name?.slice(0, 100) || null;
  const cleanEmail  = email?.slice(0, 200) || null;
  const cleanPhone  = phone?.slice(0, 30) || null;
  const cleanMsg    = message.trim().slice(0, 2000);

  const { error } = await sb.from('messages').insert({
    source: cleanSource,
    name: cleanName,
    email: cleanEmail,
    phone: cleanPhone,
    message: cleanMsg,
  });

  if (error) return res.status(500).json({ error: 'Failed to save message' });

  // Count this submission toward the rate limit window.
  recordFailedAttempt(sb, req, 'contact');

  // Notify the admin inbox. Best-effort: never block the response on email.
  const validEmail = cleanEmail && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail);
  sendEmail({
    to: ADMIN_EMAIL,
    replyTo: validEmail ? cleanEmail : undefined,
    subject: `Contact via ${cleanSource}${cleanName ? ` — ${cleanName}` : ''}`,
    html: `
      <p><strong>Source:</strong> ${esc(cleanSource)}</p>
      <p><strong>Name:</strong> ${esc(cleanName) || '(none)'}</p>
      <p><strong>Email:</strong> ${esc(cleanEmail) || '(none)'}</p>
      <p><strong>Phone:</strong> ${esc(cleanPhone) || '(none)'}</p>
      <p><strong>Message:</strong></p>
      <p>${esc(cleanMsg).replace(/\n/g, '<br>')}</p>
    `,
  }).catch((e) => console.error('[contact] email failed:', e?.message));

  res.json({ success: true });
}
