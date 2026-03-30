// ReferralDashboard — Owner-driver referral earnings view.
// Shows split between jobs done personally vs pool, plus referral earnings breakdown.

import { useState, useEffect } from 'react';
import api from '../lib/api.js';

export default function ReferralDashboard({ driver }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const token = localStorage.getItem('driver_token');
      const res = await api('/api/driver-data?type=referral-stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setData(await res.json());
      }
      setLoading(false);
    }
    load();
  }, []);

  function formatDate(d) {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short',
    });
  }

  if (loading) return <p style={s.muted}>Loading referral stats...</p>;
  if (!data) return <p style={s.muted}>Could not load referral stats</p>;

  const { summary, referrals } = data;
  const totalJobs = summary.my_jobs + summary.pool_jobs;
  const poolPct = totalJobs > 0 ? Math.round((summary.pool_jobs / totalJobs) * 100) : 0;

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.headerTitle}>Referral Earnings</div>
        <p style={{ color: '#666', fontSize: '0.75rem', margin: '4px 0 0' }}>
          Earn when pool drivers complete jobs from your funnel
        </p>
      </div>

      {/* Stats cards */}
      <div style={{ display: 'flex', gap: '10px', padding: '16px 20px 0' }}>
        <div style={s.statCard}>
          <div style={s.statLabel}>This month</div>
          <div style={s.statValue}>£{summary.referral_earned_month.toFixed(2)}</div>
        </div>
        <div style={s.statCard}>
          <div style={s.statLabel}>All time</div>
          <div style={s.statValue}>£{summary.referral_earned_all_time.toFixed(2)}</div>
        </div>
        <div style={s.statCard}>
          <div style={s.statLabel}>Referrals</div>
          <div style={s.statValue}>{summary.referral_count}</div>
        </div>
      </div>

      {/* Jobs split */}
      {totalJobs > 0 && (
        <div style={{ padding: '16px 20px 0' }}>
          <div style={{ ...s.sectionTitle, marginBottom: '8px' }}>YOUR FUNNEL JOBS</div>
          <div style={s.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: '#ccc', fontSize: '0.85rem' }}>You completed</span>
              <span style={{ color: '#fff', fontWeight: 700 }}>{summary.my_jobs}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ color: '#ccc', fontSize: '0.85rem' }}>Pool completed</span>
              <span style={{ color: '#d946ef', fontWeight: 700 }}>{summary.pool_jobs}</span>
            </div>
            {/* Progress bar */}
            <div style={{ background: '#333', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
              <div style={{
                background: '#d946ef', height: '100%', borderRadius: '4px',
                width: `${poolPct}%`, transition: 'width 0.3s',
              }} />
            </div>
            <p style={{ color: '#666', fontSize: '0.7rem', marginTop: '4px', textAlign: 'center' }}>
              {poolPct}% completed by pool drivers
            </p>
          </div>
        </div>
      )}

      {/* Referral history */}
      <div style={{ padding: '16px 20px 0' }}>
        <div style={s.sectionTitle}>REFERRAL HISTORY</div>
        {referrals.length === 0 ? (
          <div style={s.card}>
            <p style={{ color: '#888', fontSize: '0.85rem', margin: 0 }}>
              No referral payouts yet. When pool drivers complete jobs from your funnel, you'll earn a cut.
            </p>
          </div>
        ) : (
          <div style={{ background: '#1a1a1a', borderRadius: '12px', overflow: 'hidden' }}>
            {referrals.map((ref, i) => (
              <div key={ref.job_id + i} style={s.refRow}>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 600 }}>
                    {ref.pickup} → {ref.destination}
                  </div>
                  <div style={{ color: '#888', fontSize: '0.75rem', marginTop: '2px' }}>
                    {formatDate(ref.move_date)} · {ref.driver_name}
                  </div>
                </div>
                <div style={{ color: '#d946ef', fontWeight: 700, fontSize: '0.95rem' }}>
                  +£{ref.amount_gbp.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ height: '80px' }} />
    </div>
  );
}

const s = {
  page: { background: '#0a0a0a', minHeight: '100dvh', color: '#fff', fontFamily: 'system-ui, sans-serif' },
  header: { padding: '24px 20px 16px', borderBottom: '1px solid #1e1e1e' },
  headerTitle: { color: '#fff', fontSize: '1.2rem', fontWeight: 700 },
  muted: { color: '#666', textAlign: 'center', paddingTop: '40px' },
  sectionTitle: { color: '#666', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' },
  card: { background: '#1a1a1a', borderRadius: '12px', padding: '16px' },

  statCard: {
    flex: 1, background: '#1a1a1a', borderRadius: '12px', padding: '14px 12px', textAlign: 'center',
  },
  statLabel: { color: '#666', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' },
  statValue: { color: '#fff', fontSize: '1.2rem', fontWeight: 800, marginTop: '4px' },

  refRow: {
    display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px',
    borderBottom: '1px solid #252525',
  },
};
