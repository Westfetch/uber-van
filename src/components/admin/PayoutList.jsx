import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from './AdminContext.jsx';
import api from '../../lib/api.js';
import StatusBadge from './StatusBadge.jsx';
import { s, colors } from './styles.js';

import { exportCSV } from './exportCSV.js';

const STATUSES = ['all', 'pending', 'transferred', 'failed'];

export default function PayoutList() {
  const { token }  = useAdmin();
  const navigate    = useNavigate();

  const [payouts, setPayouts]   = useState([]);
  const [summary, setSummary]   = useState({});
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [pages, setPages]       = useState(1);
  const [status, setStatus]     = useState('all');
  const [from, setFrom]         = useState('');
  const [to, setTo]             = useState('');
  const [loading, setLoading]   = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit: 20 });
    if (status !== 'all') params.set('status', status);
    if (from) params.set('from', from);
    if (to)   params.set('to', to);

    try {
      params.set('action', 'payouts');
      const res = await api(`/api/admin?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPayouts(data.payouts);
      setSummary(data.summary);
      setTotal(data.total);
      setPages(data.pages);
    } catch {
      setPayouts([]);
    } finally {
      setLoading(false);
    }
  }, [token, page, status, from, to]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [status, from, to]);

  const [updatingId, setUpdatingId] = useState(null);
  const [updateErr, setUpdateErr] = useState('');

  async function updatePayout(payoutId, newStatus) {
    setUpdatingId(payoutId);
    setUpdateErr('');
    try {
      const res = await api('/api/admin?action=payout-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ payout_id: payoutId, status: newStatus }),
      });
      if (!res.ok) {
        const err = await res.json();
        setUpdateErr(err.error || 'Failed to update payout');
      } else {
        load();
      }
    } catch {
      setUpdateErr('Failed to update payout');
    } finally {
      setUpdatingId(null);
      setTimeout(() => setUpdateErr(''), 3000);
    }
  }

  return (
    <div>
      <div style={s.header}>
        <h1 style={s.h1}>Payouts</h1>
        <button style={s.btnOutline} onClick={() => exportCSV('payouts', token, { status, from, to })}>Export CSV</button>
      </div>

      {/* Summary cards */}
      <div style={s.statRow}>
        <div style={s.statCard}>
          <p style={s.statValue}>£{Number(summary.total_gross || 0).toFixed(2)}</p>
          <p style={s.statLabel}>Total Revenue</p>
        </div>
        <div style={s.statCard}>
          <p style={s.statValue}>£{Number(summary.total_fees || 0).toFixed(2)}</p>
          <p style={s.statLabel}>Platform Earnings</p>
        </div>
        <div style={s.statCard}>
          <p style={s.statValue}>£{Number(summary.total_net || 0).toFixed(2)}</p>
          <p style={s.statLabel}>Total Payouts</p>
        </div>
        <div style={s.statCard}>
          <p style={s.statValue}>{summary.count || 0}</p>
          <p style={s.statLabel}>Total Jobs</p>
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
            {st === 'all' ? 'All' : st}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <input style={{ ...s.input, maxWidth: '160px' }} type="date" value={from} onChange={e => setFrom(e.target.value)} />
        <input style={{ ...s.input, maxWidth: '160px' }} type="date" value={to} onChange={e => setTo(e.target.value)} />
      </div>

      {updateErr && <p style={{ color: colors.error, fontSize: '0.85rem', margin: '0 0 8px' }}>{updateErr}</p>}

      {/* Table */}
      <div style={s.card}>
        {loading ? (
          <p style={{ color: colors.muted, textAlign: 'center', padding: '20px' }}>Loading...</p>
        ) : payouts.length === 0 ? (
          <p style={{ color: colors.muted, textAlign: 'center', padding: '20px' }}>No payouts</p>
        ) : (
          <div style={s.tableWrap}><table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Date</th>
                <th style={s.th}>Driver</th>
                <th style={s.th}>Job Ref</th>
                <th style={s.th}>Gross</th>
                <th style={s.th}>Fee</th>
                <th style={s.th}>Net</th>
                <th style={s.th}>Status</th>
                <th style={s.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map(p => (
                <tr
                  key={p.id}
                  style={s.trClickable}
                  onPointerEnter={s.trHoverOn}
                  onPointerLeave={s.trHoverOff}
                >
                  <td style={s.td} onClick={() => navigate(`/admin/jobs/${p.job_id}`)}>{p.move_date || '-'}</td>
                  <td style={s.td} onClick={() => navigate(`/admin/jobs/${p.job_id}`)}>{p.driver_name || '-'}</td>
                  <td style={{ ...s.td, color: colors.muted, fontSize: '0.8rem' }} onClick={() => navigate(`/admin/jobs/${p.job_id}`)}>{p.funnel_job_ref || '-'}</td>
                  <td style={s.td} onClick={() => navigate(`/admin/jobs/${p.job_id}`)}>£{Number(p.gross_gbp).toFixed(2)}</td>
                  <td style={{ ...s.td, color: colors.accent }} onClick={() => navigate(`/admin/jobs/${p.job_id}`)}>£{Number(p.platform_fee_gbp).toFixed(2)}</td>
                  <td style={s.td} onClick={() => navigate(`/admin/jobs/${p.job_id}`)}>£{Number(p.net_gbp).toFixed(2)}</td>
                  <td style={s.td}><StatusBadge status={p.status} /></td>
                  <td style={s.td}>
                    {p.status === 'pending' && (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          style={{ ...s.btnSmall, minHeight: '44px', opacity: updatingId === p.id ? 0.5 : 1 }}
                          disabled={updatingId === p.id}
                          onClick={() => updatePayout(p.id, 'transferred')}
                        >
                          {updatingId === p.id ? '...' : 'Transferred'}
                        </button>
                        <button
                          style={{ ...s.btnOutline, minHeight: '44px', color: colors.error, borderColor: colors.error, opacity: updatingId === p.id ? 0.5 : 1 }}
                          disabled={updatingId === p.id}
                          onClick={() => updatePayout(p.id, 'failed')}
                        >
                          Failed
                        </button>
                      </div>
                    )}
                  </td>
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
