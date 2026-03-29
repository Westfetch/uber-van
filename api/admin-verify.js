// GET /api/admin-verify — Verify admin token, return admin profile
// Headers: Authorization: Bearer <token>

import { verifyAdmin, getSupabaseAdmin } from './_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const admin = await verifyAdmin(req);
  if (!admin) return res.status(401).json({ error: 'Unauthorized' });

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('admins')
    .select('id, email, name')
    .eq('id', admin.id)
    .single();

  if (error || !data) return res.status(401).json({ error: 'Admin not found' });

  res.json({ admin: data });
}
