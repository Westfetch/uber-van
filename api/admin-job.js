// GET /api/admin-job?id=<uuid> — Full job detail with items, events, offers, payout

import { verifyAdmin, getSupabaseAdmin } from './_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const admin = await verifyAdmin(req);
  if (!admin) return res.status(401).json({ error: 'Unauthorized' });

  const id = req.query.id;
  if (!id) return res.status(400).json({ error: 'Job ID required' });

  const sb = getSupabaseAdmin();

  // Fetch job + related data in parallel
  const [jobRes, itemsRes, eventsRes, offersRes, payoutRes] = await Promise.all([
    sb.from('jobs').select('*, drivers(name), funnels(name, slug)').eq('id', id).single(),
    sb.from('job_items').select('*').eq('job_id', id).order('added_at', { ascending: true }),
    sb.from('job_events').select('*').eq('job_id', id).order('created_at', { ascending: true }),
    sb.from('job_offers').select('*, drivers(name)').eq('job_id', id).order('offered_at', { ascending: true }),
    sb.from('payouts').select('*').eq('job_id', id).maybeSingle(),
  ]);

  if (jobRes.error || !jobRes.data) {
    return res.status(404).json({ error: 'Job not found' });
  }

  const offers = (offersRes.data || []).map(o => ({
    ...o,
    driver_name: o.drivers?.name || null,
    drivers: undefined,
  }));

  res.json({
    job:    jobRes.data,
    items:  itemsRes.data || [],
    events: eventsRes.data || [],
    offers,
    payout: payoutRes.data || null,
  });
}
