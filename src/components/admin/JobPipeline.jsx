import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from './AdminContext.jsx';
import api from '../../lib/api.js';
import StatusBadge from './StatusBadge.jsx';
import { exportCSV } from './exportCSV.js';
import { s, colors } from './styles.js';

const STATUSES = ['all', 'pending_payment', 'pending_acceptance', 'accepted', 'in_progress', 'completed', 'cancelled', 'refunded'];

export default function JobPipeline() {
  const { token } = useAdmin();
  const navigate   = useNavigate();

  const [jobs, setJobs]       = useState([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [pages, setPages]     = useState(1);
  const [status, setStatus]   = useState('all');
  const [search, setSearch]   = useState('');
  const [from, setFrom]       = useState('');
  const [to, setTo]           = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit: 20 });
    if (status !== 'all') params.set('status', status);
    if (search) params.set('search', search);
    if (from)   params.set('from', from);
    if (to)     params.set('to', to);

    try {
      params.set('action', 'jobs');
      const res = await api(`/api/admin?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setJobs(data.jobs);
      setTotal(data.total);
      setPages(data.pages);
    } catch {
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, [token, page, status, search, from, to]);

  useEffect(() => { load(); }, [load]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [status, search, from, to]);

  return (
    <div>
      <div style={s.header}>
        <h1 style={s.h1}>Jobs</h1>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ color: colors.muted, fontSize: '0.85rem' }}>{total} total</span>
          <button style={s.btnOutline} onClick={() => exportCSV('jobs', token, { status, from, to, search })}>Export CSV</button>
        </div>
      </div>

      {/* Status tabs */}
      <div style={s.filterBar}>
        {STATUSES.map(st => (
          <button
            key={st}
            onClick={() => setStatus(st)}
            style={{
              ...s.filterTab,
              ...(status === st ? s.filterTabActive : {}),
            }}
          >
            {st === 'all' ? 'All' : st.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* Search + date filters */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <input
          style={{ ...s.input, maxWidth: '240px' }}
          placeholder="Search customer name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <input style={{ ...s.input, maxWidth: '160px' }} type="date" value={from} onChange={e => setFrom(e.target.value)} />
        <input style={{ ...s.input, maxWidth: '160px' }} type="date" value={to} onChange={e => setTo(e.target.value)} />
      </div>

      {/* Table */}
      <div style={s.card}>
        {loading ? (
          <p style={{ color: colors.muted, textAlign: 'center', padding: '20px' }}>Loading...</p>
        ) : jobs.length === 0 ? (
          <p style={{ color: colors.muted, textAlign: 'center', padding: '20px' }}>No jobs found</p>
        ) : (
          <div style={s.tableWrap}><table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Date</th>
                <th style={s.th}>Customer</th>
                <th style={s.th}>Route</th>
                <th style={s.th}>Quote</th>
                <th style={s.th}>Driver</th>
                <th style={s.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map(job => (
                <tr
                  key={job.id}
                  style={s.trClickable}
                  onClick={() => navigate(`/admin/jobs/${job.id}`)}
                  onPointerEnter={s.trHoverOn}
                  onPointerLeave={s.trHoverOff}
                >
                  <td style={s.td}>{job.move_date || '-'}</td>
                  <td style={s.td}>{job.customer_name || '-'}</td>
                  <td style={{ ...s.td, fontSize: '0.8rem', color: colors.muted }}>
                    {job.pickup_postcode} → {job.destination_postcode}
                  </td>
                  <td style={s.td}>£{Number(job.customer_quote_gbp).toFixed(2)}</td>
                  <td style={s.td}>{job.driver_name || '-'}</td>
                  <td style={s.td}><StatusBadge status={job.status} /></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div style={s.pagination}>
          <button style={s.btnOutline} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</button>
          <span style={{ color: colors.muted, fontSize: '0.85rem' }}>Page {page} of {pages}</span>
          <button style={s.btnOutline} disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}
