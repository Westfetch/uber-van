// Dispatch engine — hybrid cascade-then-board job dispatch.
//
// Phase 1 (owner):   Owner-driver gets priority window (5min–4hrs)
// Phase 2 (cascade): Nearest eligible pool drivers offered one-by-one (5min each)
// Phase 3 (board):   Job visible to all eligible online drivers, first to accept wins

import { sendPush } from './push.js';

const CASCADE_OFFER_MINS = 5;

// ── Haversine distance (miles) between two lat/lng points ───────────────────
function haversine(lat1, lng1, lat2, lng2) {
  const R = 3958.8; // Earth radius in miles
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Batch geocode postcodes via postcodes.io (free, no key needed) ──────────
async function geocodePostcodes(postcodes) {
  const unique = [...new Set(postcodes.map(p => p.toUpperCase().replace(/\s/g, '')))];
  if (unique.length === 0) return {};

  // postcodes.io accepts max 100 per batch
  const results = {};
  for (let i = 0; i < unique.length; i += 100) {
    const batch = unique.slice(i, i + 100);
    try {
      const resp = await fetch('https://api.postcodes.io/postcodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postcodes: batch }),
      });
      const data = await resp.json();
      for (const item of (data.result || [])) {
        if (item.result) {
          results[item.query] = { lat: item.result.latitude, lng: item.result.longitude };
        }
      }
    } catch (err) {
      console.error('[dispatch] Geocode failed:', err.message);
    }
  }
  return results;
}

// ── Check if a driver is eligible for a job ─────────────────────────────────
const VAN_RANK = { swb: 1, mwb: 2, lwb: 3, luton: 4, '7.5t': 5 };

function isEligible(driver, job) {
  if (driver.approval_status !== 'approved') return false;
  if (!driver.online) return false;
  // Van must be large enough
  if ((VAN_RANK[driver.van_size] || 0) < (VAN_RANK[job.van_size] || 0)) return false;
  // Crew check: driver counts as 1
  if (job.crew_required && (driver.crew_count + 1) < job.crew_required) return false;
  // Blocked dates
  if (driver.blocked_dates?.includes(job.move_date)) return false;
  return true;
}

// ── Build cascade queue: rank eligible pool drivers by distance ──────────────
export async function buildCascadeQueue(sb, jobId) {
  const { data: job } = await sb
    .from('jobs')
    .select('id, pickup_postcode, van_size, crew_required, move_date')
    .eq('id', jobId)
    .single();

  if (!job) throw new Error(`Job ${jobId} not found`);

  // Get all pool drivers
  const { data: drivers } = await sb
    .from('drivers')
    .select('id, depot_postcode, van_size, crew_count, blocked_dates, approval_status, online')
    .eq('driver_type', 'pool')
    .eq('approval_status', 'approved')
    .eq('online', true);

  if (!drivers?.length) return [];

  // Filter eligible
  const eligible = drivers.filter(d => isEligible(d, job));
  if (!eligible.length) return [];

  // Geocode all postcodes (pickup + all driver depots)
  const allPostcodes = [job.pickup_postcode, ...eligible.map(d => d.depot_postcode)];
  const geo = await geocodePostcodes(allPostcodes);

  const pickupKey = job.pickup_postcode.toUpperCase().replace(/\s/g, '');
  const pickupGeo = geo[pickupKey];

  if (!pickupGeo) {
    console.error(`[dispatch] Could not geocode pickup: ${job.pickup_postcode}`);
    return [];
  }

  // Rank by distance
  const ranked = eligible
    .map(d => {
      const dKey = d.depot_postcode.toUpperCase().replace(/\s/g, '');
      const dGeo = geo[dKey];
      if (!dGeo) return null;
      const miles = haversine(pickupGeo.lat, pickupGeo.lng, dGeo.lat, dGeo.lng);
      // Check working radius
      if (d.working_radius_miles && miles > d.working_radius_miles) return null;
      return { driver_id: d.id, road_miles: Math.round(miles * 10) / 10 };
    })
    .filter(Boolean)
    .sort((a, b) => a.road_miles - b.road_miles);

  if (!ranked.length) return [];

  // Insert into dispatch_queue
  const rows = ranked.map((r, i) => ({
    job_id: jobId,
    driver_id: r.driver_id,
    priority: i + 1,
    road_miles: r.road_miles,
    status: 'queued',
  }));

  await sb.from('dispatch_queue').insert(rows);

  // Update job phase
  await sb.from('jobs').update({ dispatch_phase: 'cascade' }).eq('id', jobId);

  return ranked;
}

// ── Offer to next driver in cascade queue ───────────────────────────────────
export async function offerNextInQueue(sb, jobId, feePct) {
  // Find next queued driver
  const { data: next } = await sb
    .from('dispatch_queue')
    .select('id, driver_id, road_miles')
    .eq('job_id', jobId)
    .eq('status', 'queued')
    .order('priority', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!next) {
    // Queue exhausted — escalate to board
    return escalateToBoard(sb, jobId);
  }

  // Get job for payout calculation
  const { data: job } = await sb
    .from('jobs')
    .select('customer_quote_gbp, pickup_postcode, destination_postcode, move_date')
    .eq('id', jobId)
    .single();

  const driverPayout = parseFloat(
    (Number(job.customer_quote_gbp) * (1 - (feePct || 5) / 100)).toFixed(2)
  );

  const expiresAt = new Date(Date.now() + CASCADE_OFFER_MINS * 60 * 1000).toISOString();

  // Create offer
  await sb.from('job_offers').insert({
    job_id: jobId,
    driver_id: next.driver_id,
    expires_at: expiresAt,
    driver_payout_gbp: driverPayout,
    driver_road_miles: next.road_miles,
  });

  // Mark queue entry as offered
  await sb.from('dispatch_queue').update({ status: 'offered' }).eq('id', next.id);

  // Log event
  await sb.from('job_events').insert({
    job_id: jobId,
    event_type: 'offer_sent',
    payload: { driver_id: next.driver_id, payout_gbp: driverPayout, expires_at: expiresAt, phase: 'cascade' },
    created_by: 'system',
  });

  // Push notification
  const { data: driverRow } = await sb
    .from('drivers').select('fcm_token').eq('id', next.driver_id).maybeSingle();
  if (driverRow?.fcm_token) {
    sendPush(driverRow.fcm_token, {
      title: 'New job offer',
      body: `${job.pickup_postcode} → ${job.destination_postcode} — ${job.move_date}`,
      data: { job_id: jobId },
    }).catch(err => console.error('[dispatch] Push failed:', err));
  }

  return { phase: 'cascade', driver_id: next.driver_id };
}

// ── Escalate to open board ──────────────────────────────────────────────────
export async function escalateToBoard(sb, jobId) {
  await sb
    .from('jobs')
    .update({ dispatch_phase: 'board', board_visible_at: new Date().toISOString() })
    .eq('id', jobId);

  await sb.from('job_events').insert({
    job_id: jobId,
    event_type: 'board_listed',
    payload: {},
    created_by: 'system',
  });

  return { phase: 'board' };
}

// ── Advance dispatch after decline or expiry ────────────────────────────────
export async function advanceDispatch(sb, jobId) {
  const { data: job } = await sb
    .from('jobs')
    .select('dispatch_phase, funnel_id')
    .eq('id', jobId)
    .single();

  if (!job) return;

  // Get fee pct for payout calculation
  const { data: funnel } = await sb
    .from('funnels')
    .select('platform_fee_pct')
    .eq('id', job.funnel_id)
    .single();
  const feePct = funnel?.platform_fee_pct || 5;

  if (job.dispatch_phase === 'owner') {
    // Owner declined/expired — build cascade queue and offer first
    const queue = await buildCascadeQueue(sb, jobId);
    if (queue.length > 0) {
      return offerNextInQueue(sb, jobId, feePct);
    } else {
      return escalateToBoard(sb, jobId);
    }
  }

  if (job.dispatch_phase === 'cascade') {
    return offerNextInQueue(sb, jobId, feePct);
  }

  // Already on board or filled — nothing to do
  return { phase: job.dispatch_phase };
}

// ── Sweep expired offers (called from cron) ─────────────────────────────────
export async function sweepExpiredOffers(sb) {
  const { data: expired } = await sb
    .from('job_offers')
    .select('id, job_id, driver_id')
    .eq('status', 'pending')
    .lt('expires_at', new Date().toISOString());

  if (!expired?.length) return { swept: 0 };

  const jobIds = new Set();

  for (const offer of expired) {
    await sb.from('job_offers').update({ status: 'expired' }).eq('id', offer.id);

    await sb.from('job_events').insert({
      job_id: offer.job_id,
      event_type: 'offer_expired',
      payload: { driver_id: offer.driver_id, offer_id: offer.id },
      created_by: 'system',
    });

    jobIds.add(offer.job_id);
  }

  // Advance dispatch for each affected job
  for (const jobId of jobIds) {
    // Only advance if job is still pending_acceptance
    const { data: job } = await sb
      .from('jobs')
      .select('status')
      .eq('id', jobId)
      .single();

    if (job?.status === 'pending_acceptance') {
      await advanceDispatch(sb, jobId);
    }
  }

  return { swept: expired.length };
}
