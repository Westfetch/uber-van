// api/_lib/idempotency.js
// Lightweight idempotency using job_events table.
// If a request with the same idempotency key was already processed, returns the cached result.

/**
 * Check if an idempotency key has already been used for this job.
 * Returns { duplicate: true, result } if already processed, { duplicate: false } otherwise.
 *
 * @param {SupabaseClient} sb
 * @param {string} jobId
 * @param {string} key - idempotency key from request header
 */
export async function checkIdempotency(sb, jobId, key) {
  if (!key) return { duplicate: false };

  const { data } = await sb
    .from('job_events')
    .select('payload')
    .eq('job_id', jobId)
    .eq('event_type', 'idempotency_key')
    .eq('payload->>key', key)
    .maybeSingle();

  if (data) return { duplicate: true, result: data.payload?.result };
  return { duplicate: false };
}

/**
 * Record that an idempotency key was used, along with the response payload.
 * Fire-and-forget.
 */
export function recordIdempotencyKey(sb, jobId, key, result) {
  if (!key) return;
  sb.from('job_events').insert({
    job_id: jobId,
    event_type: 'idempotency_key',
    payload: { key, result },
    created_by: 'system',
  }).then(null, () => {});
}
