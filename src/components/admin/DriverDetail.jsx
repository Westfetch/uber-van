import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAdmin } from './AdminContext.jsx';
import StatusBadge from './StatusBadge.jsx';
import { s, colors } from './styles.js';

export default function DriverDetail() {
  const { driverId } = useParams();
  const { token }     = useAdmin();
  const navigate       = useNavigate();

  const [data, setData]             = useState(null);
  const [loading, setLoading]       = useState(true);
  const [setupCode, setSetupCode]   = useState(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetch(`/api/admin?action=driver&id=${driverId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [driverId, token]);

  async function generateCode() {
    setGenerating(true);
    try {
      const res = await fetch('/api/admin?action=driver-setup-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ driver_id: driverId }),
      });
      const d = await res.json();
      if (res.ok) setSetupCode(d.code);
    } catch {} finally {
      setGenerating(false);
    }
  }

  if (loading) return <p style={{ color: colors.muted, padding: '40px', textAlign: 'center' }}>Loading...</p>;
  if (!data) return <p style={{ color: colors.error, padding: '40px', textAlign: 'center' }}>Driver not found</p>;

  const d = data.driver;

  return (
    <div>
      <button style={s.backLink} onClick={() => navigate('/admin/drivers')}>← Back to drivers</button>

      {/* Header */}
      <div style={{ ...s.card, marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: 0, color: colors.white, fontSize: '1.2rem' }}>
            <span style={{
              display: 'inline-block',
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: d.online ? '#4ade80' : '#555',
              marginRight: '8px',
            }} />
            {d.name}
          </h2>
          <p style={{ margin: '4px 0 0', color: colors.muted, fontSize: '0.85rem' }}>
            {d.van_size} &middot; {d.depot_postcode} &middot; {d.phone || 'No phone'} &middot; {d.email || 'No email'}
          </p>
        </div>
        <button
          style={{ ...s.btn, opacity: generating ? 0.6 : 1 }}
          onClick={generateCode}
          disabled={generating}
        >
          {generating ? 'Generating...' : 'Generate setup code'}
        </button>
      </div>

      {/* Setup code display */}
      {setupCode && (
        <div style={{ ...s.card, background: '#1e1e1e', textAlign: 'center' }}>
          <p style={{ color: colors.muted, fontSize: '0.8rem', margin: '0 0 8px' }}>
            Setup code (expires in 48h, one-time use)
          </p>
          <p style={{
            fontFamily: 'monospace',
            fontSize: '2rem',
            fontWeight: 700,
            color: colors.accent,
            margin: 0,
            letterSpacing: '0.15em',
            userSelect: 'all',
          }}>
            {setupCode}
          </p>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
        <div style={s.statCard}>
          <p style={s.statValue}>{data.stats?.job_count || 0}</p>
          <p style={s.statLabel}>Jobs completed</p>
        </div>
        <div style={s.statCard}>
          <p style={s.statValue}>£{Number(data.stats?.total_net || 0).toFixed(2)}</p>
          <p style={s.statLabel}>Total earned</p>
        </div>
        <div style={s.statCard}>
          <p style={s.statValue}>£{Number(data.stats?.avg_payout || 0).toFixed(2)}</p>
          <p style={s.statLabel}>Avg per job</p>
        </div>
      </div>

      {/* Job history */}
      <div style={s.card}>
        <p style={s.sectionTitle}>Job History</p>
        {data.jobs?.length > 0 ? (
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Date</th>
                <th style={s.th}>Route</th>
                <th style={s.th}>Quote</th>
                <th style={s.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.jobs.map(job => (
                <tr
                  key={job.id}
                  style={s.trClickable}
                  onClick={() => navigate(`/admin/jobs/${job.id}`)}
                  onMouseEnter={e => e.currentTarget.style.background = '#1e1e1e'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={s.td}>{job.move_date || '-'}</td>
                  <td style={{ ...s.td, fontSize: '0.8rem', color: colors.muted }}>
                    {job.pickup_postcode} → {job.destination_postcode}
                  </td>
                  <td style={s.td}>£{Number(job.customer_quote_gbp).toFixed(2)}</td>
                  <td style={s.td}><StatusBadge status={job.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ color: colors.muted, fontSize: '0.85rem' }}>No jobs yet</p>
        )}
      </div>
    </div>
  );
}
