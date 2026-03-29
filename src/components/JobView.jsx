// JobView.jsx — 3-tab on-the-day view for an accepted job
// Tabs: Itinerary | Inventory | Sign-off

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api.js';
import Itinerary from './Itinerary.jsx';
import InventoryEditor from './InventoryEditor.jsx';
import SignOff from './SignOff.jsx';

const TABS = ['Itinerary', 'Inventory', 'Sign-off'];

export default function JobView() {
  const { jobId }      = useParams();
  const navigate       = useNavigate();
  const [job, setJob]  = useState(null);
  const [tab, setTab]  = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  async function loadJob() {
    const token = localStorage.getItem('driver_token');
    if (!token) { navigate('/login'); return; }

    const res = await api(`/api/driver-data?type=job&id=${jobId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) { setError('Job not found'); setLoading(false); return; }
    const data = await res.json();
    setJob(data.job);
    setLoading(false);
  }

  useEffect(() => { loadJob(); }, [jobId]);

  if (loading) return (
    <div style={styles.page}><p style={styles.muted}>Loading job...</p></div>
  );

  if (error) return (
    <div style={styles.page}><p style={styles.error}>{error}</p></div>
  );

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={() => navigate('/')}>← Jobs</button>
        <span style={styles.headerTitle}>On the day</span>
        <span style={styles.headerRoute}>
          {job?.pickup_postcode?.split(' ')[0]} → {job?.destination_postcode?.split(' ')[0]}
        </span>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        {TABS.map((t, i) => (
          <button
            key={t}
            style={{ ...styles.tab, ...(tab === i ? styles.tabActive : {}) }}
            onClick={() => setTab(i)}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={styles.content}>
        {tab === 0 && <Itinerary job={job} />}
        {tab === 1 && <InventoryEditor job={job} onUpdate={loadJob} />}
        {tab === 2 && <SignOff job={job} onComplete={() => navigate('/')} />}
      </div>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px 8px',
    borderBottom: '1px solid #1e1e1e',
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: '#888',
    cursor: 'pointer',
    fontSize: '0.9rem',
    padding: 0,
  },
  headerTitle: { color: '#fff', fontWeight: 700, fontSize: '1rem' },
  headerRoute: { color: '#888', fontSize: '0.85rem' },
  tabs: {
    display: 'flex',
    borderBottom: '1px solid #1e1e1e',
    padding: '0 20px',
  },
  tab: {
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: '#666',
    cursor: 'pointer',
    flex: 1,
    fontSize: '0.9rem',
    fontWeight: 600,
    padding: '12px 0',
    transition: 'color 0.15s, border-color 0.15s',
  },
  tabActive: {
    borderBottomColor: '#d946ef',
    color: '#fff',
  },
  content: { padding: '20px' },
  muted: { color: '#666', textAlign: 'center', paddingTop: '40px' },
  error: { color: '#f87171', textAlign: 'center', paddingTop: '40px' },
};
