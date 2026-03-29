// POST /api/admin-auth — Admin login
// Body: { email, password }
// Returns: { token, admin: { id, email, name } }

import bcrypt from 'bcryptjs';
import { signAdminToken, getSupabaseAdmin } from './_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const sb = getSupabaseAdmin();

  const { data: admin, error } = await sb
    .from('admins')
    .select('id, email, name, password_hash')
    .eq('email', email.toLowerCase().trim())
    .single();

  if (error || !admin) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = await bcrypt.compare(password, admin.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  const token = signAdminToken(admin.id);
  res.json({ token, admin: { id: admin.id, email: admin.email, name: admin.name } });
}
