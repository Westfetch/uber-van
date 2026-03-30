// api/_lib/rateLimit.js
// IP-based rate limiter using Supabase for persistence across serverless invocations.
// Usage: if (await checkRateLimit(req, res, sb, { window: 15, max: 5 })) return;

const DEFAULT_WINDOW_MINS = 15;
const DEFAULT_MAX_ATTEMPTS = 5;

function getClientIP(req) {
  // Vercel sets x-forwarded-for; take the first (client) IP
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

/**
 * Check if the IP has exceeded the rate limit.
 * Returns true (and sends 429 response) if blocked.
 * Returns false if the request is allowed.
 *
 * @param {Request} req
 * @param {Response} res
 * @param {SupabaseClient} sb - admin client
 * @param {{ scope?: string, window?: number, max?: number }} opts
 */
export async function checkRateLimit(req, res, sb, opts = {}) {
  const scope  = opts.scope || 'auth';
  const window = opts.window || DEFAULT_WINDOW_MINS;
  const max    = opts.max || DEFAULT_MAX_ATTEMPTS;
  const ip     = getClientIP(req);

  const cutoff = new Date(Date.now() - window * 60 * 1000).toISOString();

  try {
    // Count recent failed attempts for this IP + scope
    const { count } = await sb
      .from('rate_limits')
      .select('*', { count: 'exact', head: true })
      .eq('ip', ip)
      .eq('scope', scope)
      .gte('created_at', cutoff);

    if (count >= max) {
      res.status(429).json({
        error: `Too many attempts. Try again in ${window} minutes.`,
      });
      return true;
    }
  } catch {
    // If rate_limits table doesn't exist or query fails, allow the request
    // (fail open — don't block legitimate users due to infra issues)
  }

  return false;
}

/**
 * Record a failed attempt for rate limiting.
 * Fire-and-forget — never blocks the response.
 */
export function recordFailedAttempt(sb, req, scope = 'auth') {
  const ip = getClientIP(req);
  sb.from('rate_limits').insert({ ip, scope }).then(null, () => {});
}
