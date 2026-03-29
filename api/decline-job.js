// api/decline-job.js → POST /api/decline-job
// Driver declines an offer.

import { verifyDriver, getSupabaseAdmin } from './_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const caller = await verifyDriver(req);
  if (!caller) return res.status(401).json({ error: 'Unauthorized' });

  const { offer_id } = req.body || {};
  if (!offer_id) return res.status(400).json({ error: 'offer_id required' });

  const admin = getSupabaseAdmin();

  const { data: offer } = await admin
    .from('job_offers')
    .update({ status: 'declined' })
    .eq('id', offer_id)
    .eq('driver_id', caller.id)
    .eq('status', 'pending')
    .select('job_id')
    .maybeSingle();

  if (!offer) return res.status(404).json({ error: 'Offer not found or already actioned' });

  await admin.from('job_events').insert({
    job_id:     offer.job_id,
    event_type: 'offer_declined',
    payload:    { driver_id: caller.id, offer_id },
    created_by: 'driver',
  });

  res.json({ ok: true });
}
