// JobBoard — Available board-phase jobs for pool drivers (and owners browsing).
// First-to-accept wins. Auto-refreshes via polling.

import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api.js';

export default function JobBoard({ driver }) {
  const [jobs, setJobs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(null);
  const [error, setError]     = useState('');

  const load = useCallback(async () => {
    const token = localStorage.getItem('driver_token');
    const res = await api('/api/driver-data?type=job-board', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setJobs(data.jobs || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000); // refresh every 15s
    return () => clearInterval(interval);
  }, [load]);

  async function handleAccept(job) {
    setAccepting(job.id);
    setError('');

    try {
      const token = localStorage.getItem('driver_token');
      // Create an offer and accept in one go via the board
      // The job-board accept creates the offer + accepts atomically
      const res = await api('/api/job-action?action=board-accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ job_id: job.id }),
      });

      if (res.ok) {
        setJobs(prev => prev.filter(j => j.id !== job.id));
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to accept');
        load(); // refresh to see if it was taken
      }
    } catch {
      setError('Network error');
    } finally {
      setAccepting(null);
    }
  }

  function formatDate(d) {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short',
    });
  }

  if (loading) return <p style={s.muted}>Loading available jobs...</p>;

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.headerTitle}>Available Jobs</div>
        <p style={{ color: '#666', fontSize: '0.75rem', margin: '4px 0 0' }}>
          First to accept wins. Refreshes automatically.
        </p>
      </div>

      {error && <p style={{ color: '#ef4444', fontSize: '0.85rem', padding: '0 20px' }}>{error}</p>}

      {jobs.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '12px' }}>📋</div>
          <p style={{ color: '#888', fontSize: '0.9rem', margin: 0 }}>
            No jobs available right now
          </p>
          <p style={{ color: '#555', fontSize: '0.8rem', marginTop: '4px' }}>
            Jobs appear here when owners pass on them or the pool needs drivers.
          </p>
        </div>
      ) : (
        <div style={{ padding: '0 20px' }}>
          {jobs.map(job => (
            <div key={job.id} style={s.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={s.date}>{formatDate(job.move_date)}</span>
                {job.start_time && <span style={s.time}>{job.start_time.slice(0, 5)}</span>}
              </div>

              <div style={s.route}>
                <span style={s.postcode}>{job.pickup_postcode}</span>
                <span style={{ color: '#555' }}> → </span>
                <span style={s.postcode}>{job.destination_postcode}</span>
              </div>

              <div style={s.meta}>
                {job.van_size && <span style={s.tag}>{job.van_size.toUpperCase()}</span>}
                {job.van_loads && <span style={s.tag}>{job.van_loads} load{job.van_loads > 1 ? 's' : ''}</span>}
                {job.crew_required > 1 && <span style={s.tag}>{job.crew_required} crew</span>}
                {job.context_block?.is_bank_holiday && <span style={{ ...s.tag, background: '#7c3aed33', color: '#a78bfa' }}>Bank Holiday</span>}
                {job.context_block?.is_sunday && <span style={{ ...s.tag, background: '#7c3aed33', color: '#a78bfa' }}>Sunday</span>}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px' }}>
                <div style={s.payout}>
                  £{job.driver_payout_gbp.toFixed(2)}
                </div>
                <button
                  onClick={() => handleAccept(job)}
                  disabled={accepting === job.id}
                  style={{ ...s.acceptBtn, opacity: accepting === job.id ? 0.6 : 1 }}
                >
                  {accepting === job.id ? 'Accepting...' : 'Accept Job'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ height: '80px' }} />
    </div>
  );
}

const s = {
  page: { background: '#0a0a0a', minHeight: '100dvh', color: '#fff', fontFamily: 'system-ui, sans-serif' },
  header: { padding: '24px 20px 16px', borderBottom: '1px solid #1e1e1e' },
  headerTitle: { color: '#fff', fontSize: '1.2rem', fontWeight: 700 },
  muted: { color: '#666', textAlign: 'center', paddingTop: '40px' },

  card: {
    background: '#1a1a1a', borderRadius: '12px', padding: '16px',
    marginTop: '12px',
  },
  date: { color: '#ccc', fontSize: '0.85rem', fontWeight: 600 },
  time: { color: '#888', fontSize: '0.85rem' },
  route: { fontSize: '1.05rem', fontWeight: 700, marginBottom: '8px' },
  postcode: { color: '#fff' },
  meta: { display: 'flex', flexWrap: 'wrap', gap: '6px' },
  tag: {
    background: '#ffffff10', color: '#aaa', fontSize: '0.7rem', fontWeight: 600,
    padding: '3px 8px', borderRadius: '4px', textTransform: 'uppercase',
  },
  payout: {
    color: '#d946ef', fontSize: '1.4rem', fontWeight: 800,
  },
  acceptBtn: {
    background: '#d946ef', border: 'none', borderRadius: '8px',
    color: '#fff', fontSize: '0.9rem', fontWeight: 600, padding: '10px 20px',
    cursor: 'pointer',
  },
};
