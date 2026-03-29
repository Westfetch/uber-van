// DriverDashboard — home screen for a logged-in driver.
// Shows pending offers + active/upcoming jobs.

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

function JobCard({ job, onClick }) {
  const statusColor = {
    accepted:    '#4ade80',
    in_progress: '#60a5fa',
    completed:   '#888',
  }[job.status] || '#888';

  return (
    <button style={styles.jobCard} onClick={onClick}>
      <div style={styles.jobCardTop}>
        <span style={styles.jobCardRoute}>
          {job.pickup_postcode} → {job.destination_postcode}
        </span>
        <span style={{ ...styles.jobCardStatus, color: statusColor }}>
          {job.status.replace('_', ' ')}
        </span>
      </div>
      <div style={styles.jobCardMeta}>
        {formatDate(job.move_date)} · £{Number(job.customer_quote_gbp).toFixed(0)} job
      </div>
    </button>
  );
}

export default function DriverDashboard({ driver, onLogout }) {
  const navigate         = useNavigate();
  const [jobs, setJobs]  = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const token = localStorage.getItem('driver_token');
      const res = await fetch('/api/driver-jobs', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);
      }
      setLoading(false);
    }
    load();
  }, []);

  function handleLogout() {
    localStorage.removeItem('driver_token');
    onLogout();
  }

  const activeJobs  = jobs.filter(j => ['accepted','in_progress'].includes(j.status));
  const pastJobs    = jobs.filter(j => j.status === 'completed');

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <div style={styles.greeting}>Hey, {driver?.name?.split(' ')[0]} 👋</div>
          <div style={styles.subtitle}>
            <span style={{ ...styles.onlineDot, background: driver?.online ? '#4ade80' : '#666' }} />
            {driver?.online ? 'Online' : 'Offline'}
          </div>
        </div>
        <button style={styles.logoutBtn} onClick={handleLogout}>Sign out</button>
      </div>

      {loading ? (
        <p style={styles.muted}>Loading jobs...</p>
      ) : (
        <div style={styles.content}>
          {activeJobs.length > 0 && (
            <section style={styles.section}>
              <div style={styles.sectionTitle}>Active jobs</div>
              {activeJobs.map(job => (
                <JobCard key={job.id} job={job} onClick={() => navigate(`/job/${job.id}`)} />
              ))}
            </section>
          )}

          {activeJobs.length === 0 && (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>🚐</div>
              <p style={styles.emptyText}>No active jobs right now.</p>
              <p style={styles.emptyHint}>Job offers will appear in your email when they come in.</p>
            </div>
          )}

          {pastJobs.length > 0 && (
            <section style={styles.section}>
              <div style={styles.sectionTitle}>Recent</div>
              {pastJobs.slice(0, 5).map(job => (
                <JobCard key={job.id} job={job} onClick={() => navigate(`/job/${job.id}`)} />
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  page: {
    background: '#0a0a0a',
    minHeight: '100dvh',
    color: '#fff',
    fontFamily: 'system-ui, sans-serif',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '24px 20px 16px',
    borderBottom: '1px solid #1e1e1e',
  },
  greeting:   { color: '#fff', fontSize: '1.2rem', fontWeight: 700 },
  subtitle:   { color: '#888', fontSize: '0.85rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' },
  onlineDot:  { width: '8px', height: '8px', borderRadius: '50%', display: 'inline-block' },
  logoutBtn: {
    background: 'none',
    border: '1px solid #333',
    borderRadius: '8px',
    color: '#888',
    cursor: 'pointer',
    fontSize: '0.8rem',
    padding: '6px 12px',
  },
  content:      { padding: '20px' },
  section:      { marginBottom: '24px' },
  sectionTitle: {
    color: '#666',
    fontSize: '0.7rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    marginBottom: '10px',
  },
  jobCard: {
    background: '#1a1a1a',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    display: 'block',
    marginBottom: '8px',
    padding: '14px 16px',
    textAlign: 'left',
    width: '100%',
  },
  jobCardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' },
  jobCardRoute: { color: '#fff', fontWeight: 600, fontSize: '0.95rem' },
  jobCardStatus: { fontSize: '0.8rem', fontWeight: 600 },
  jobCardMeta: { color: '#888', fontSize: '0.8rem' },
  emptyState: { textAlign: 'center', padding: '60px 20px' },
  emptyIcon:  { fontSize: '3rem', marginBottom: '12px' },
  emptyText:  { color: '#aaa', fontSize: '1rem', margin: '0 0 6px' },
  emptyHint:  { color: '#666', fontSize: '0.85rem' },
  muted:      { color: '#666', textAlign: 'center', paddingTop: '40px' },
};
