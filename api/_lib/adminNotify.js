// Push notifications to all admins via Firebase Cloud Messaging.
// Fire-and-forget — never blocks the caller.

import { sendPush } from './push.js';
import { getSupabaseAdmin } from './auth.js';

export async function notifyAdmins({ title, body, data, channelId = 'admin-alerts' }) {
  try {
    const sb = getSupabaseAdmin();
    const { data: admins } = await sb
      .from('admins')
      .select('fcm_token')
      .not('fcm_token', 'is', null);

    if (!admins?.length) return;

    const pushData = data ? Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, String(v)])
    ) : {};

    await Promise.allSettled(
      admins.map(a => sendPush(a.fcm_token, { title, body, data: pushData, channelId }))
    );
  } catch (err) {
    console.error('notifyAdmins failed:', err.message);
  }
}
