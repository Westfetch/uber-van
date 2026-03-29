import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const OFFER_EXPIRED_MSG = 'This offer has expired or is no longer available.';

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

function formatCountdown(expiresAt) {
  const diff = Math.max(0, new Date(expiresAt) - Date.now());
  const m = Math.floor(diff / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function Flag({ label, color = '#2d6a4f' }) {
  return (
    <span style={{ ...styles.flag, background: color + '33', color: color, border: `1px solid ${color}66` }}>
      {label}
    </span>
  );
}

export default function JobOffer() {
  const { offerId }    = useParams();
  const navigate       = useNavigate();
  const [offer, setOffer] = useState(null);
  const [job, setJob]     = useState(null);
  const [countdown, setCountdown] = useState('--:--');
  const [expired, setExpired]     = useState(false);
  const [loading, setLoading]     = useState(true);
  const [acting, setActing]       = useState(false);
  const [error, setError]         = useState('');

  useEffect(() => {
    async function load() {
      const token = localStorage.getItem('driver_token');
      if (!token) { navigate('/login'); return; }

      const res = await fetch(`/api/job-offer/${offerId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { setError(OFFER_EXPIRED_MSG); setLoading(false); return; }

      const data = await res.json();
      setOffer(data.offer);
      setJob(data.job);
      setLoading(false);
    }
    load();
  }, [offerId, navigate]);

  useEffect(() => {
    if (!offer) return;
    const tick = setInterval(() => {
      if (new Date(offer.expires_at) <= Date.now()) {
        setExpired(true);
        clearInterval(tick);
      } else {
        setCountdown(formatCountdown(offer.expires_at));
      }
    }, 1000);
    setCountdown(formatCountdown(offer.expires_at));
    return () => clearInterval(tick);
  }, [offer]);

  const handleAccept = useCallback(async () => {
    if (acting || expired) return;
    setActing(true);
    const token = localStorage.getItem('driver_token');
    const res   = await fetch('/api/accept-job', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ offer_id: offerId }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || 'Failed to accept'); setActing(false); return; }
    navigate(`/job/${data.job.id}`);
  }, [acting, expired, offerId, navigate]);

  const handleDecline = useCallback(async () => {
    if (acting) return;
    setActing(true);
    const token = localStorage.getItem('driver_token');
    await fetch('/api/decline-job', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ offer_id: offerId }),
    });
    navigate('/');
  }, [acting, offerId, navigate]);

  if (loading) return <div style={styles.page}><p style={styles.muted}>Loading offer...</p></div>;
  if (error || expired) return (
    <div style={styles.page}>
      <div style={styles.card}>
        <p style={styles.expiredMsg}>{error || OFFER_EXPIRED_MSG}</p>
        <button style={styles.btnSecondary} onClick={() => navigate('/')}>Back to jobs</button>
      </div>
    </div>
  );

  const ctx        = job?.context_block || {};
  const roadMiles  = ctx.road_miles || ctx.ROAD_MILES || '?';
  const isBankHol  = ctx.is_bank_holiday || ctx.IS_BANK_HOLIDAY;
  const isSunday   = ctx.is_sunday || ctx.IS_SUNDAY;
  const isEarly    = ctx.is_early_start || ctx.IS_EARLY_START;
  const jobType    = job?.quote_data?.job_type || 'Removal';
  const vanLoads   = job?.van_loads || 1;
  const crew       = job?.crew_required || 1;

  // Estimate duration from quote_data
  const totalMins = job?.quote_data?.running_totals?.total_load_time_mins;
  const durationHrs = totalMins ? Math.round(totalMins / crew / 60 * 10) / 10 : null;

  return (
    <div style={styles.page}>
      <div style={styles.badge}>New job offer</div>

      <div style={styles.card}>
        <h2 style={styles.jobTitle}>{jobType.replace('_', ' ')}</h2>
        <p style={styles.jobMeta}>{formatDate(job?.move_date)} · {job?.start_time || '08:00'} start</p>

        <div style={styles.routeRow}>
          <div style={styles.postcode}>{job?.pickup_postcode}</div>
          <div style={styles.routeArrow}>→ {roadMiles} mi →</div>
          <div style={styles.postcode}>{job?.destination_postcode}</div>
        </div>

        <div style={styles.flags}>
          {isBankHol && <Flag label="Bank holiday" color="#b45309" />}
          {isSunday  && <Flag label="Sunday" color="#6d28d9" />}
          {isEarly   && <Flag label="Early start" color="#0369a1" />}
          {job?.quote_data?.access?.pickup?.stair_count > 0 &&
            <Flag label={`${job.quote_data.access.pickup.stair_count} flight stairs (pickup)`} color="#065f46" />}
          {job?.quote_data?.access?.destination?.floor === 0 &&
            <Flag label="Ground floor (drop-off)" color="#065f46" />}
          {vanLoads <= 1 && <Flag label="Luton fits" color="#065f46" />}
        </div>

        <div style={styles.statsGrid}>
          {durationHrs && (
            <div style={styles.stat}>
              <div style={styles.statValue}>{durationHrs} hrs</div>
              <div style={styles.statLabel}>Est. duration</div>
            </div>
          )}
          <div style={styles.stat}>
            <div style={styles.statValue}>{roadMiles} mi</div>
            <div style={styles.statLabel}>Your distance</div>
          </div>
          <div style={styles.stat}>
            <div style={styles.statValue}>{vanLoads} load</div>
            <div style={styles.statLabel}>Van loads</div>
          </div>
          <div style={styles.stat}>
            <div style={styles.statValue}>{crew}-person</div>
            <div style={styles.statLabel}>Crew required</div>
          </div>
        </div>

        <div style={styles.payoutBox}>
          <div>
            <div style={styles.payoutLabel}>Your payout</div>
            <div style={styles.payoutAmount}>£{Number(offer?.driver_payout_gbp || 0).toFixed(2)}</div>
          </div>
        </div>

        <p style={{ ...styles.muted, textAlign: 'center' }}>
          Offer expires in{' '}
          <span style={{ color: '#d946ef', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            {countdown}
          </span>
        </p>

        <div style={styles.actions}>
          <button style={styles.btnDecline} onClick={handleDecline} disabled={acting}>
            Decline
          </button>
          <button style={{ ...styles.btnAccept, opacity: acting ? 0.6 : 1 }} onClick={handleAccept} disabled={acting}>
            {acting ? 'Accepting...' : 'Accept job'}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100dvh',
    background: '#0a0a0a',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
    gap: '12px',
  },
  badge: {
    background: '#d946ef22',
    border: '1px solid #d946ef66',
    borderRadius: '20px',
    color: '#d946ef',
    fontSize: '0.8rem',
    fontWeight: 600,
    padding: '4px 14px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  card: {
    background: '#1a1a1a',
    borderRadius: '16px',
    padding: '24px',
    width: '100%',
    maxWidth: '420px',
  },
  jobTitle: { color: '#fff', fontSize: '1.3rem', fontWeight: 700, margin: '0 0 4px', textTransform: 'capitalize' },
  jobMeta:  { color: '#888', fontSize: '0.85rem', margin: '0 0 16px' },
  routeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '14px',
  },
  postcode: {
    background: '#252525',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '0.95rem',
    fontWeight: 700,
    padding: '8px 14px',
    flex: '0 0 auto',
  },
  routeArrow: { color: '#666', fontSize: '0.8rem', flex: 1, textAlign: 'center' },
  flags: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' },
  flag: {
    borderRadius: '20px',
    fontSize: '0.75rem',
    fontWeight: 600,
    padding: '4px 10px',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px',
    marginBottom: '16px',
  },
  stat: {
    background: '#252525',
    borderRadius: '10px',
    padding: '12px',
  },
  statValue: { color: '#fff', fontSize: '1.1rem', fontWeight: 700 },
  statLabel: { color: '#888', fontSize: '0.75rem', marginTop: '2px' },
  payoutBox: {
    background: '#1a0a1e',
    border: '1px solid #d946ef55',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '12px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  payoutLabel:  { color: '#aaa', fontSize: '0.85rem' },
  payoutAmount: { color: '#d946ef', fontSize: '1.8rem', fontWeight: 700 },
  muted: { color: '#666', fontSize: '0.85rem', margin: '0 0 16px' },
  actions: { display: 'flex', gap: '10px', marginTop: '8px' },
  btnDecline: {
    background: '#252525',
    border: 'none',
    borderRadius: '10px',
    color: '#888',
    cursor: 'pointer',
    flex: 1,
    fontSize: '0.95rem',
    fontWeight: 600,
    padding: '14px',
  },
  btnAccept: {
    background: '#d946ef',
    border: 'none',
    borderRadius: '10px',
    color: '#fff',
    cursor: 'pointer',
    flex: 2,
    fontSize: '1rem',
    fontWeight: 700,
    padding: '14px',
    transition: 'opacity 0.15s',
  },
  expiredMsg:   { color: '#aaa', fontSize: '0.95rem', textAlign: 'center', marginBottom: '16px' },
  btnSecondary: {
    background: '#252525',
    border: 'none',
    borderRadius: '10px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '0.95rem',
    padding: '12px 24px',
    width: '100%',
  },
};
