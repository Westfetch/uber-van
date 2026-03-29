// GET /api/admin-jobs — Paginated job list with filters
// Query: status, from, to, search, page, limit

import { verifyAdmin, getSupabaseAdmin } from './_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const admin = await verifyAdmin(req);
  if (!admin) return res.status(401).json({ error: 'Unauthorized' });

  const sb    = getSupabaseAdmin();
  const { status, from, to, search, page = '1', limit = '20' } = req.query;
  const pg    = Math.max(1, parseInt(page));
  const lim   = Math.min(100, Math.max(1, parseInt(limit)));
  const offset = (pg - 1) * lim;

  // Build query
  let query = sb
    .from('jobs')
    .select(`
      id, customer_name, pickup_postcode, destination_postcode,
      move_date, customer_quote_gbp, status, driver_id, created_at,
      drivers(name)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + lim - 1);

  if (status && status !== 'all') query = query.eq('status', status);
  if (from)   query = query.gte('move_date', from);
  if (to)     query = query.lte('move_date', to);
  if (search) query = query.ilike('customer_name', `%${search}%`);

  const { data: jobs, count, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  const mapped = (jobs || []).map(j => ({
    ...j,
    driver_name: j.drivers?.name || null,
    drivers: undefined,
  }));

  res.json({
    jobs:  mapped,
    total: count || 0,
    page:  pg,
    pages: Math.ceil((count || 0) / lim),
  });
}
