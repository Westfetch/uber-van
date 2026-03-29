// api/cron-invoices.js — Weekly invoice generation
// Called by Vercel Cron every Monday at 06:00 UTC, or manually by admin.

import { verifyAdmin, getSupabaseAdmin } from './_lib/auth.js';
import { generateWeeklyInvoices } from './_lib/invoices.js';

export default async function handler(req, res) {
  // Auth: either Vercel Cron secret or admin Bearer token
  const cronAuth  = req.headers['authorization'] === `Bearer ${process.env.CRON_SECRET}`;
  const isForce   = req.query.force === 'true';

  if (!cronAuth) {
    const admin = await verifyAdmin(req);
    if (!admin) return res.status(401).json({ error: 'Unauthorized' });
  }

  const sb = getSupabaseAdmin();

  // Determine week range — previous Mon 00:00 to Sun 23:59:59 UTC
  const now   = new Date();
  const day   = now.getUTCDay(); // 0=Sun … 6=Sat
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  // Previous Monday: go back (day + 6) % 7 days to get this Monday, then -7 for last Monday
  const thisMon = new Date(today);
  thisMon.setUTCDate(today.getUTCDate() - ((day + 6) % 7));
  const lastMon = new Date(thisMon);
  lastMon.setUTCDate(thisMon.getUTCDate() - 7);
  const lastSun = new Date(thisMon);
  lastSun.setUTCDate(thisMon.getUTCDate() - 1);

  const weekStart = lastMon.toISOString();
  const weekEnd   = new Date(lastSun.getTime() + 86400000 - 1).toISOString(); // Sun 23:59:59.999

  try {
    const result = await generateWeeklyInvoices(sb, { weekStart, weekEnd });
    res.json({
      ok: true,
      week: `${lastMon.toISOString().slice(0, 10)} to ${lastSun.toISOString().slice(0, 10)}`,
      ...result,
    });
  } catch (err) {
    console.error('[cron-invoices] Error:', err);
    res.status(500).json({ error: err.message });
  }
}
