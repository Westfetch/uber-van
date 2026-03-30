import { useState, useEffect, useCallback } from 'react';
import { useAdmin } from './AdminContext.jsx';
import api from '../../lib/api.js';
import StatusBadge from './StatusBadge.jsx';
import { s, colors } from './styles.js';
import { exportCSV } from './exportCSV.js';

const STATUSES = ['all', 'issued', 'paid', 'failed'];

export default function InvoiceList() {
  const { token } = useAdmin();

  const [invoices, setInvoices]   = useState([]);
  const [summary, setSummary]     = useState({});
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [pages, setPages]         = useState(1);
  const [status, setStatus]       = useState('all');
  const [from, setFrom]           = useState('');
  const [to, setTo]               = useState('');
  const [loading, setLoading]     = useState(true);
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState('');

  // Pay modal
  const [payModal, setPayModal]   = useState(null); // invoice object
  const [payRef, setPayRef]       = useState('');
  const [paying, setPaying]       = useState(false);

  // Expanded detail
  const [expanded, setExpanded]   = useState(null);
  const [lines, setLines]         = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ action: 'invoices', page, limit: 20 });
    if (status !== 'all') params.set('status', status);
    if (from) params.set('from', from);
    if (to)   params.set('to', to);

    try {
      const res = await api(`/api/admin?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setInvoices(data.invoices);
      setSummary(data.summary);
      setTotal(data.total);
      setPages(data.pages);
    } catch {
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, [token, page, status, from, to]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [status, from, to]);

  async function handleGenerate() {
    setGenerating(true);
    setGenResult('');
    try {
      const res = await api('/api/admin?action=generate-invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setGenResult(`Generated ${data.invoicesCreated} invoice(s) for ${data.week}`);
        load();
      } else {
        setGenResult(data.error || 'Failed');
      }
    } catch {
      setGenResult('Network error');
    } finally {
      setGenerating(false);
    }
  }

  async function handlePay() {
    if (!payModal) return;
    setPaying(true);
    try {
      const res = await api('/api/admin?action=invoice-pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ invoice_id: payModal.id, payment_ref: payRef }),
      });
      if (res.ok) {
        setPayModal(null);
        setPayRef('');
        load();
      }
    } finally {
      setPaying(false);
    }
  }

  const [failErr, setFailErr] = useState('');

  async function handleFail(invoiceId) {
    if (!window.confirm('Mark this invoice as failed?')) return;
    setFailErr('');
    try {
      const res = await api('/api/admin?action=invoice-fail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ invoice_id: invoiceId }),
      });
      if (!res.ok) {
        const err = await res.json();
        setFailErr(err.error || 'Failed to update invoice');
      } else {
        load();
      }
    } catch {
      setFailErr('Failed to update invoice');
    }
    setTimeout(() => setFailErr(''), 3000);
  }

  async function toggleDetail(inv) {
    if (expanded === inv.id) { setExpanded(null); setLines([]); return; }
    setExpanded(inv.id);
    setLines([]);
    const res = await api(`/api/admin?action=invoice-detail&id=${inv.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setLines(data.lines || []);
    }
  }

  function fmt(d) {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  return (
    <div>
      <div style={s.header}>
        <h1 style={s.h1}>Invoices</h1>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {genResult && <span style={{ color: genResult.startsWith('Generated') ? '#4ade80' : colors.error, fontSize: '0.8rem' }}>{genResult}</span>}
          <button
            style={{ ...s.btn, opacity: generating ? 0.6 : 1 }}
            disabled={generating}
            onClick={handleGenerate}
          >
            {generating ? 'Generating...' : 'Generate Invoices Now'}
          </button>
          <button style={s.btnOutline} onClick={() => exportCSV('invoices', token, { status, from, to })}>Export CSV</button>
        </div>
      </div>

      {/* Summary cards */}
      <div style={s.statRow}>
        <div style={s.statCard}>
          <p style={s.statValue}>£{Number(summary.total_invoiced || 0).toFixed(2)}</p>
          <p style={s.statLabel}>Total Invoiced</p>
        </div>
        <div style={s.statCard}>
          <p style={s.statValue}>£{Number(summary.total_paid || 0).toFixed(2)}</p>
          <p style={s.statLabel}>Total Paid</p>
        </div>
        <div style={s.statCard}>
          <p style={s.statValue}>£{Number(summary.total_outstanding || 0).toFixed(2)}</p>
          <p style={s.statLabel}>Outstanding</p>
        </div>
        <div style={s.statCard}>
          <p style={s.statValue}>{summary.count || 0}</p>
          <p style={s.statLabel}>Invoices</p>
        </div>
      </div>

      {/* Status tabs + date filters */}
      <div style={s.filterBar}>
        {STATUSES.map(st => (
          <button
            key={st}
            onClick={() => setStatus(st)}
            style={{ ...s.filterTab, ...(status === st ? s.filterTabActive : {}) }}
          >
            {st === 'all' ? 'All' : st}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <input style={{ ...s.input, maxWidth: '160px' }} type="date" value={from} onChange={e => setFrom(e.target.value)} />
        <input style={{ ...s.input, maxWidth: '160px' }} type="date" value={to} onChange={e => setTo(e.target.value)} />
      </div>

      {failErr && <p style={{ color: colors.error, fontSize: '0.85rem', margin: '0 0 8px' }}>{failErr}</p>}

      {/* Table */}
      <div style={s.card}>
        {loading ? (
          <p style={{ color: colors.muted, textAlign: 'center', padding: '20px' }}>Loading...</p>
        ) : invoices.length === 0 ? (
          <p style={{ color: colors.muted, textAlign: 'center', padding: '20px' }}>No invoices</p>
        ) : (
          <div style={s.tableWrap}><table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Invoice</th>
                <th style={s.th}>Driver</th>
                <th style={s.th}>Week</th>
                <th style={s.th}>Jobs</th>
                <th style={s.th}>Net</th>
                <th style={s.th}>Status</th>
                <th style={s.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => (
                <>
                  <tr
                    key={inv.id}
                    style={s.trClickable}
                    onPointerEnter={s.trHoverOn}
                    onPointerLeave={s.trHoverOff}
                  >
                    <td style={{ ...s.td, fontFamily: 'monospace', fontSize: '0.8rem', color: colors.muted }} onClick={() => toggleDetail(inv)}>
                      {inv.invoice_number}
                    </td>
                    <td style={s.td} onClick={() => toggleDetail(inv)}>{inv.driver_name || '-'}</td>
                    <td style={{ ...s.td, fontSize: '0.85rem' }} onClick={() => toggleDetail(inv)}>
                      {fmt(inv.week_start)} – {fmt(inv.week_end)}
                    </td>
                    <td style={{ ...s.td, color: colors.muted }} onClick={() => toggleDetail(inv)}>{inv.job_count}</td>
                    <td style={{ ...s.td, fontWeight: 600 }} onClick={() => toggleDetail(inv)}>£{Number(inv.net_gbp).toFixed(2)}</td>
                    <td style={s.td}><StatusBadge status={inv.status} /></td>
                    <td style={s.td}>
                      {inv.status === 'issued' && (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            style={{ ...s.btnSmall, minHeight: '44px' }}
                            onClick={() => { setPayModal(inv); setPayRef(''); }}
                          >
                            Mark Paid
                          </button>
                          <button
                            style={{ ...s.btnOutline, minHeight: '44px', color: colors.error, borderColor: colors.error }}
                            onClick={() => handleFail(inv.id)}
                          >
                            Failed
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                  {expanded === inv.id && (
                    <tr key={`${inv.id}-detail`}>
                      <td colSpan={7} style={{ padding: '0 16px 12px', background: '#0f0f0f' }}>
                        {lines.length === 0 ? (
                          <p style={{ color: colors.muted, fontSize: '0.8rem', margin: '8px 0' }}>Loading lines...</p>
                        ) : (
                          <table style={{ ...s.table, margin: '8px 0' }}>
                            <thead>
                              <tr>
                                <th style={{ ...s.th, fontSize: '0.75rem' }}>Description</th>
                                <th style={{ ...s.th, fontSize: '0.75rem' }}>Gross</th>
                                <th style={{ ...s.th, fontSize: '0.75rem' }}>Fee</th>
                                <th style={{ ...s.th, fontSize: '0.75rem' }}>Net</th>
                              </tr>
                            </thead>
                            <tbody>
                              {lines.map(l => (
                                <tr key={l.id}>
                                  <td style={{ ...s.td, color: colors.muted, fontSize: '0.8rem' }}>{l.description}</td>
                                  <td style={{ ...s.td, fontSize: '0.8rem' }}>£{Number(l.gross_gbp).toFixed(2)}</td>
                                  <td style={{ ...s.td, fontSize: '0.8rem', color: colors.accent }}>£{Number(l.fee_gbp).toFixed(2)}</td>
                                  <td style={{ ...s.td, fontSize: '0.8rem', fontWeight: 600 }}>£{Number(l.net_gbp).toFixed(2)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </>
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

      {/* Mark Paid modal */}
      {payModal && (
        <div style={modalOverlay} onClick={() => setPayModal(null)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <h2 style={{ color: '#fff', marginTop: 0, fontSize: '1rem' }}>Mark {payModal.invoice_number} as Paid</h2>
            <p style={{ color: colors.muted, fontSize: '0.85rem', margin: '0 0 16px' }}>
              Driver: {payModal.driver_name} · £{Number(payModal.net_gbp).toFixed(2)}
            </p>
            <label style={{ color: colors.muted, fontSize: '0.75rem', fontWeight: 600 }}>BACS Reference (optional)</label>
            <input
              style={{ ...s.input, marginTop: '6px', marginBottom: '16px' }}
              type="text"
              value={payRef}
              onChange={e => setPayRef(e.target.value)}
              placeholder="e.g. VDM-INV-2026-0001"
              autoFocus
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button style={{ ...s.btn, flex: 1, opacity: paying ? 0.6 : 1 }} disabled={paying} onClick={handlePay}>
                {paying ? 'Saving...' : 'Confirm Paid'}
              </button>
              <button style={{ ...s.btnOutline, flex: 1 }} onClick={() => setPayModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const modalOverlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
  display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '15vh', zIndex: 200,
  overflowY: 'auto',
};
const modalBox = {
  background: '#1a1a1a', borderRadius: '12px', padding: '24px',
  width: '100%', maxWidth: '400px', boxSizing: 'border-box',
};
