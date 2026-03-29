// api/update-inventory.js
// Driver adds/removes items or adjusts actual miles on the day.
// Logs job_event for audit trail.
//
// POST { job_id, action: 'add_item'|'remove_item'|'set_miles', ...payload }
// Authorization: Bearer <driver-token>

import { verifyDriver, getSupabaseAdmin } from './_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const caller = await verifyDriver(req);
  if (!caller) return res.status(401).json({ error: 'Unauthorized' });

  const { job_id, action } = req.body || {};
  if (!job_id || !action) return res.status(400).json({ error: 'job_id and action required' });

  const admin = getSupabaseAdmin();

  // Verify the driver owns this job
  const { data: job } = await admin
    .from('jobs')
    .select('id, status, driver_id, customer_quote_gbp, balance_gbp')
    .eq('id', job_id)
    .eq('driver_id', caller.id)
    .maybeSingle();

  if (!job) return res.status(404).json({ error: 'Job not found or not assigned to you' });
  if (!['accepted', 'in_progress'].includes(job.status))
    return res.status(409).json({ error: 'Job is not in an editable state' });

  if (action === 'add_item') {
    const { canonical_name, quantity = 1, volume_cuft, price_delta_gbp = 0 } = req.body;
    if (!canonical_name) return res.status(400).json({ error: 'canonical_name required' });

    const { data: item } = await admin.from('job_items').insert({
      job_id, canonical_name, quantity, volume_cuft,
      added_by: 'driver', price_delta_gbp,
    }).select().single();

    await admin.from('job_events').insert({
      job_id, event_type: 'item_added',
      payload:    { item_id: item.id, canonical_name, quantity, price_delta_gbp },
      created_by: 'driver',
    });

    return res.json({ ok: true, item });
  }

  if (action === 'remove_item') {
    const { item_id } = req.body;
    if (!item_id) return res.status(400).json({ error: 'item_id required' });

    const { data: item } = await admin
      .from('job_items')
      .update({ active: false })
      .eq('id', item_id)
      .eq('job_id', job_id)
      .select()
      .maybeSingle();

    if (!item) return res.status(404).json({ error: 'Item not found' });

    await admin.from('job_events').insert({
      job_id, event_type: 'item_removed',
      payload:    { item_id, canonical_name: item.canonical_name },
      created_by: 'driver',
    });

    return res.json({ ok: true });
  }

  if (action === 'set_miles') {
    const { actual_miles } = req.body;
    if (actual_miles == null) return res.status(400).json({ error: 'actual_miles required' });

    await admin.from('jobs').update({ actual_miles, status: 'in_progress' }).eq('id', job_id);

    await admin.from('job_events').insert({
      job_id, event_type: 'miles_adjusted',
      payload:    { actual_miles },
      created_by: 'driver',
    });

    return res.json({ ok: true });
  }

  res.status(400).json({ error: `Unknown action: ${action}` });
}
