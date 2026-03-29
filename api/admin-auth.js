// /api/admin-auth — Admin login (POST) and verify (GET)
// POST body: { email, password } → { token, admin }
// GET headers: Authorization: Bearer <token> → { admin }

import bcrypt from 'bcryptjs';
import { signAdminToken, verifyAdmin, getSupabaseAdmin } from './_lib/auth.js';

export default async function handler(req, res) {
  const sb = getSupabaseAdmin();

  // GET — verify token
  if (req.method === 'GET') {
    const admin = await verifyAdmin(req);
    if (!admin) return res.status(401).json({ error: 'Unauthorized' });

    const { data, error } = await sb
      .from('admins')
      .select('id, email, name')
      .eq('id', admin.id)
      .single();

    if (error || !data) return res.status(401).json({ error: 'Admin not found' });
    return res.json({ admin: data });
  }

  // POST — login
  if (req.method === 'POST') {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const { data: admin, error } = await sb
      .from('admins')
      .select('id, email, name, password_hash')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (error || !admin) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = signAdminToken(admin.id);
    return res.json({ token, admin: { id: admin.id, email: admin.email, name: admin.name } });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
