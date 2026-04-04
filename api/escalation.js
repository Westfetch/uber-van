// api/escalation.js
// Receives escalation events from VDM Wizard / PAR Wizard.
// Writes to messages table and pushes notification to admins.
//
// POST /api/escalation
// Headers: x-signature (HMAC-SHA256 hex of raw body)
// Body: {
//   session_id, brand, job_type, escalation_type,
//   customer_summary, message, postcodes, move_date
// }

import crypto from 'crypto';
import { getSupabaseAdmin } from './_lib/auth.js';
import { notifyAdmins } from './_lib/adminNotify.js';

const ESCALATION_SECRET = process.env.ESCALATION_SECRET || process.env.INTERNAL_SECRET || '';

function verifySignature(rawBody, signature) {
  if (!ESCALATION_SECRET) return false;
  const expected = crypto
    .createHmac('sha256', ESCALATION_SECRET)
    .update(rawBody)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(signature, 'hex')
    );
  } catch { return false; }
}

const ESCALATION_LABELS = {
  manual_review: 'Manual review required',
  tbc_item: 'TBC item needs confirmation',
  packing_request: 'Packing service requested',
  unhappy_customer: 'Customer unhappy with quote',
  large_job: 'Large job (900+ cu ft)',
  payment_failure: 'Payment failed',
  general: 'Wizard escalation',
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const signature = req.headers['x-signature'];
  if (!signature) return res.status(400).json({ error: 'x-signature header required' });

  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

  if (!verifySignature(rawBody, signature)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const {
    session_id, brand, job_type, escalation_type,
    customer_summary, message, postcodes, move_date,
  } = body;

  if (!session_id || !escalation_type) {
    return res.status(400).json({ error: 'session_id and escalation_type required' });
  }

  const sb = getSupabaseAdmin();
  const label = ESCALATION_LABELS[escalation_type] || ESCALATION_LABELS.general;
  const brandLabel = brand === 'par' ? 'PAR' : 'VDM';
  const jobLabel = (job_type || 'unknown').replace(/_/g, ' ');

  // Build human-readable message for the inbox
  const parts = [`[${brandLabel}] ${label}`];
  if (postcodes) parts.push(`Route: ${postcodes}`);
  if (move_date) parts.push(`Date: ${move_date}`);
  if (customer_summary) parts.push(`\n${customer_summary}`);
  if (message) parts.push(`\nWizard told customer: "${message}"`);

  const { error } = await sb.from('messages').insert({
    source: `${brand || 'vdm'}-escalation`,
    name: `${brandLabel} Wizard`,
    message: parts.join('\n'),
    metadata: {
      session_id,
      brand: brand || 'vdm',
      job_type: job_type || null,
      escalation_type,
      postcodes: postcodes || null,
      move_date: move_date || null,
    },
  });

  if (error) {
    console.error('Escalation insert failed:', error.message);
    return res.status(500).json({ error: 'Failed to store escalation' });
  }

  // Push notification to admins
  notifyAdmins({
    title: `${brandLabel}: ${label}`,
    body: postcodes ? `${postcodes} — ${jobLabel}` : jobLabel,
    data: { type: 'escalation', session_id },
    channelId: 'admin-alerts',
  }).catch(err => console.error('Escalation push failed:', err.message));

  res.json({ ok: true });
}
