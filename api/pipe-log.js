// api/pipe-log.js — Receives diagnostic events from The Pipe Android app.
// No auth required — events are tagged with a device ID for filtering.
// POST { events: [{ type, message, data, timestamp }] }

import { getSupabaseAdmin } from './_lib/auth.js';

export default async function handler(req, res) {
  // Open CORS — The Pipe posts from an Android app (no origin header)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { events, deviceId, shiftId } = req.body || {};

  if (!Array.isArray(events) || events.length === 0) {
    return res.status(400).json({ error: 'events array required' });
  }

  if (events.length > 50) {
    return res.status(413).json({ error: 'Max 50 events per batch' });
  }

  const sb = getSupabaseAdmin();

  const rows = events.map(e => ({
    device_id: deviceId || 'unknown',
    shift_id: shiftId || null,
    event_type: e.type || 'log',
    message: (e.message || '').substring(0, 500),
    data: e.data || null,
    client_timestamp: e.timestamp || new Date().toISOString(),
  }));

  const { error } = await sb.from('pipe_logs').insert(rows);

  if (error) {
    console.error('pipe-log insert error:', error.message);
    return res.status(500).json({ error: 'Failed to store events' });
  }

  return res.status(200).json({ stored: rows.length });
}
