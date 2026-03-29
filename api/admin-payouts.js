// GET /api/admin-payouts — Payout list with summary aggregates
// Query: status, from, to, page, limit

import { verifyAdmin, getSupabaseAdmin } from './_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const admin = await verifyAdmin(req);
  if (!admin) return res.status(401).json({ error: 'Unauthorized' });

  const sb    = getSupabaseAdmin();
  const { status, from, to, page = '1', limit = '20' } = req.query;
  const pg    = Math.max(1, parseInt(page));
  const lim   = Math.min(100, Math.max(1, parseInt(limit)));
  const offset = (pg - 1) * lim;

  // Paginated list
  let query = sb
    .from('payouts')
    .select(`
      id, job_id, driver_id, gross_gbp, platform_fee_gbp, net_gbp,
      stripe_transfer_id, status, created_at,
      drivers(name),
      jobs(funnel_job_ref, move_date)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + lim - 1);

  if (status && status !== 'all') query = query.eq('status', status);

  const { data: payouts, count, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  // Summary aggregates (all payouts, respecting date filters only)
  let summaryQuery = sb.from('payouts').select('gross_gbp, platform_fee_gbp, net_gbp, jobs(move_date)');
  const { data: allPayouts } = await summaryQuery;

  let filtered = allPayouts || [];
  if (from) filtered = filtered.filter(p => p.jobs?.move_date >= from);
  if (to)   filtered = filtered.filter(p => p.jobs?.move_date <= to);

  const summary = {
    total_gross: filtered.reduce((s, p) => s + Number(p.gross_gbp), 0),
    total_fees:  filtered.reduce((s, p) => s + Number(p.platform_fee_gbp), 0),
    total_net:   filtered.reduce((s, p) => s + Number(p.net_gbp), 0),
    count:       filtered.length,
  };

  const mapped = (payouts || []).map(p => ({
    ...p,
    driver_name:   p.drivers?.name || null,
    funnel_job_ref: p.jobs?.funnel_job_ref || null,
    move_date:     p.jobs?.move_date || null,
    drivers:       undefined,
    jobs:          undefined,
  }));

  res.json({
    payouts: mapped,
    summary,
    total:   count || 0,
    page:    pg,
    pages:   Math.ceil((count || 0) / lim),
  });
}
