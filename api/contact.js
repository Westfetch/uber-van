// api/contact.js — Public contact form endpoint (no auth required)
// POST { source, name, email, phone, message }
// CORS enabled for wizard and PAR site domains.

import { getSupabaseAdmin } from './_lib/auth.js';

const ALLOWED_ORIGINS = [
  'https://packingandremovalsbristol.co.uk',
  'https://www.packingandremovalsbristol.co.uk',
  'https://packingservicebristol.com',
  'https://www.packingservicebristol.com',
];

function setCors(req, res) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (origin?.includes('vercel.app') || origin?.includes('localhost')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { source, name, email, phone, message } = req.body || {};

  if (!message?.trim()) return res.status(400).json({ error: 'Message is required' });
  if (message.length > 2000) return res.status(413).json({ error: 'Message too long (max 2000 chars)' });
  if (!source) return res.status(400).json({ error: 'Source is required' });

  const sb = getSupabaseAdmin();

  const { error } = await sb.from('messages').insert({
    source: source.slice(0, 50),
    name: name?.slice(0, 100) || null,
    email: email?.slice(0, 200) || null,
    phone: phone?.slice(0, 30) || null,
    message: message.trim().slice(0, 2000),
  });

  if (error) return res.status(500).json({ error: 'Failed to save message' });

  res.json({ success: true });
}
