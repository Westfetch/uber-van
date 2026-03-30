import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAdmin } from './AdminContext.jsx';
import api from '../../lib/api.js';
import StatusBadge from './StatusBadge.jsx';
import { s, colors } from './styles.js';
import { getVanLabel } from '../../lib/vanConfig.js';

const JOB_STATUSES = ['pending_payment', 'pending_acceptance', 'accepted', 'in_progress', 'completed', 'cancelled', 'refunded'];

export default function JobDetail() {
  const { jobId }  = useParams();
  const { token }  = useAdmin();
  const navigate    = useNavigate();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);

  // Action state
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showCancel, setShowCancel] = useState(false);
  const [statusOverride, setStatusOverride] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [showOverride, setShowOverride] = useState(false);
  const [actionMsg, setActionMsg] = useState('');

  // Refund state
  const [showRefund, setShowRefund] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refunding, setRefunding] = useState(false);

  useEffect(() => {
    loadJob();
  }, [jobId, token]);

  async function loadJob() {
    setLoading(true);
    const res = await api(`/api/admin?action=job&id=${jobId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = res.ok ? await res.json() : null;
    setJob(data);
    setLoading(false);
  }

  async function cancelJob() {
    setCancelling(true);
    try {
      const res = await api('/api/admin?action=job-cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ job_id: jobId, reason: cancelReason }),
      });
      if (res.ok) {
        setShowCancel(false);
        setCancelReason('');
        setActionMsg('Job cancelled');
        loadJob();
      } else {
        const err = await res.json();
        setActionMsg(err.error || 'Failed to cancel');
      }
    } catch {
      setActionMsg('Failed to cancel');
    } finally {
      setCancelling(false);
      setTimeout(() => setActionMsg(''), 3000);
    }
  }

  async function updateStatus() {
    try {
      const res = await api('/api/admin?action=job-status-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ job_id: jobId, status: statusOverride, reason: overrideReason }),
      });
      if (res.ok) {
        setShowOverride(false);
        setStatusOverride('');
        setOverrideReason('');
        setActionMsg('Status updated');
        loadJob();
      } else {
        const err = await res.json();
        setActionMsg(err.error || 'Failed to update');
      }
    } catch {
      setActionMsg('Failed to update');
    }
    setTimeout(() => setActionMsg(''), 3000);
  }

  async function refundJob() {
    setRefunding(true);
    try {
      const body = { job_id: jobId, reason: refundReason };
      if (refundAmount) body.amount_gbp = parseFloat(refundAmount);
      const res = await api('/api/admin?action=refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        setShowRefund(false);
        setRefundAmount('');
        setRefundReason('');
        setActionMsg(`Refunded £${data.amount_gbp.toFixed(2)}`);
        loadJob();
      } else {
        const err = await res.json();
        setActionMsg(err.error || 'Refund failed');
      }
    } catch {
      setActionMsg('Refund failed');
    } finally {
      setRefunding(false);
      setTimeout(() => setActionMsg(''), 4000);
    }
  }

  if (loading) return <p style={{ color: colors.muted, padding: '40px', textAlign: 'center' }}>Loading...</p>;
  if (!job) return <p style={{ color: colors.error, padding: '40px', textAlign: 'center' }}>Job not found</p>;

  const j = job.job;
  const cancellable = ['pending_payment', 'pending_acceptance', 'accepted'].includes(j.status);
  const refundable = ['completed', 'cancelled'].includes(j.status);

  return (
    <div>
      <button style={s.backLink} onClick={() => navigate('/admin/jobs')}>← Back to jobs</button>

      {/* Header */}
      <div style={{ ...s.card, marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: 0, color: colors.white, fontSize: '1.2rem' }}>{j.customer_name || 'Unknown'}</h2>
          <p style={{ margin: '4px 0 0', color: colors.muted, fontSize: '0.85rem' }}>
            {j.pickup_postcode} → {j.destination_postcode} &middot; {j.move_date}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <StatusBadge status={j.status} />
          {cancellable && (
            <button
              style={{ ...s.btnOutline, color: colors.error, borderColor: colors.error }}
              onClick={() => setShowCancel(!showCancel)}
            >
              Cancel job
            </button>
          )}
          <button
            style={s.btnOutline}
            onClick={() => setShowOverride(!showOverride)}
          >
            Override status
          </button>
          {refundable && (
            <button
              style={{ ...s.btnOutline, color: '#f59e0b', borderColor: '#f59e0b' }}
              onClick={() => { setShowRefund(!showRefund); setRefundAmount(num(j.deposit_gbp)); }}
            >
              Refund
            </button>
          )}
        </div>
      </div>

      {/* Action feedback */}
      {actionMsg && (
        <p style={{ color: actionMsg.includes('Failed') ? colors.error : '#4ade80', fontSize: '0.85rem', textAlign: 'center', margin: '0 0 8px' }}>{actionMsg}</p>
      )}

      {/* Cancel form */}
      {showCancel && (
        <div style={{ ...s.card, border: `1px solid ${colors.error}` }}>
          <p style={{ ...s.label, margin: '0 0 8px' }}>Cancel reason (optional)</p>
          <input
            value={cancelReason}
            onChange={e => setCancelReason(e.target.value)}
            placeholder="e.g. Customer requested cancellation"
            style={{ ...s.input, marginBottom: 8 }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              style={{ ...s.btn, background: colors.error, opacity: cancelling ? 0.5 : 1 }}
              onClick={cancelJob}
              disabled={cancelling}
            >
              {cancelling ? 'Cancelling...' : 'Confirm cancellation'}
            </button>
            <button style={s.btnOutline} onClick={() => setShowCancel(false)}>Dismiss</button>
          </div>
        </div>
      )}

      {/* Status override form */}
      {showOverride && (
        <div style={{ ...s.card, border: `1px solid ${colors.accent}` }}>
          <p style={{ ...s.label, margin: '0 0 8px' }}>Override job status</p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            {JOB_STATUSES.filter(st => st !== j.status).map(st => (
              <button
                key={st}
                onClick={() => setStatusOverride(st)}
                style={{
                  ...s.filterTab,
                  ...(statusOverride === st ? s.filterTabActive : {}),
                  fontSize: '0.75rem',
                }}
              >
                {st.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
          <input
            value={overrideReason}
            onChange={e => setOverrideReason(e.target.value)}
            placeholder="Reason for override"
            style={{ ...s.input, marginBottom: 8 }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              style={{ ...s.btn, opacity: !statusOverride ? 0.5 : 1 }}
              onClick={updateStatus}
              disabled={!statusOverride}
            >
              Apply override
            </button>
            <button style={s.btnOutline} onClick={() => setShowOverride(false)}>Dismiss</button>
          </div>
        </div>
      )}

      {/* Refund form */}
      {showRefund && (
        <div style={{ ...s.card, border: '1px solid #f59e0b' }}>
          <p style={{ ...s.label, margin: '0 0 8px' }}>Issue refund via Stripe</p>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '120px' }}>
              <label style={{ color: colors.muted, fontSize: '0.75rem' }}>Amount (£)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={refundAmount}
                onChange={e => setRefundAmount(e.target.value)}
                placeholder={num(j.deposit_gbp)}
                style={{ ...s.input, marginTop: '4px' }}
              />
            </div>
            <div style={{ flex: 2, minWidth: '200px' }}>
              <label style={{ color: colors.muted, fontSize: '0.75rem' }}>Reason (optional)</label>
              <input
                value={refundReason}
                onChange={e => setRefundReason(e.target.value)}
                placeholder="e.g. Customer requested refund"
                style={{ ...s.input, marginTop: '4px' }}
              />
            </div>
          </div>
          <p style={{ color: colors.muted, fontSize: '0.75rem', margin: '0 0 8px' }}>
            Deposit: £{num(j.deposit_gbp)} · Quote: £{num(j.customer_quote_gbp)}
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              style={{ ...s.btn, background: '#f59e0b', opacity: refunding ? 0.5 : 1 }}
              onClick={refundJob}
              disabled={refunding}
            >
              {refunding ? 'Processing...' : `Refund £${refundAmount || num(j.deposit_gbp)}`}
            </button>
            <button style={s.btnOutline} onClick={() => setShowRefund(false)}>Dismiss</button>
          </div>
        </div>
      )}

      {/* Grid: Customer + Financials */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(320px, 100%), 1fr))', gap: '16px' }}>
        <div style={s.card}>
          <p style={s.sectionTitle}>Customer</p>
          <Row label="Name" value={j.customer_name} />
          <Row label="Phone" value={j.customer_phone} />
          <Row label="Email" value={j.customer_email} />
          <Row label="Move date" value={j.move_date} />
          <Row label="Start time" value={j.start_time} />
        </div>
        <div style={s.card}>
          <p style={s.sectionTitle}>Financials</p>
          <Row label="Quote" value={`£${num(j.customer_quote_gbp)}`} />
          <Row label="Deposit (30%)" value={`£${num(j.deposit_gbp)}`} />
          <Row label="Balance (70%)" value={`£${num(j.balance_gbp)}`} />
          <Row label="Final total" value={j.final_total_gbp ? `£${num(j.final_total_gbp)}` : '-'} />
          <Row label="Vehicle" value={`${j.van_loads > 1 ? j.van_loads + 'x ' : ''}${getVanLabel(j.van_size || 'luton')}`} />
          <Row label="Crew" value={j.crew_required} />
          <Row label="Volume" value={j.effective_volume_cuft ? `${num(j.effective_volume_cuft)} cu ft` : '-'} />
        </div>
      </div>

      {/* Items */}
      <div style={s.card}>
        <p style={s.sectionTitle}>Items ({job.items?.length || 0})</p>
        {job.items?.length > 0 ? (
          <div style={s.tableWrap}><table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Item</th>
                <th style={s.th}>Qty</th>
                <th style={s.th}>Volume</th>
                <th style={s.th}>Added by</th>
                <th style={s.th}>Price delta</th>
                <th style={s.th}>Active</th>
              </tr>
            </thead>
            <tbody>
              {job.items.map(item => (
                <tr key={item.id}>
                  <td style={s.td}>{item.canonical_name}</td>
                  <td style={s.td}>{item.quantity}</td>
                  <td style={{ ...s.td, color: colors.muted }}>{item.volume_cuft ? `${num(item.volume_cuft)} cu ft` : '-'}</td>
                  <td style={s.td}>{item.added_by}</td>
                  <td style={s.td}>{item.price_delta_gbp !== 0 ? `£${num(item.price_delta_gbp)}` : '-'}</td>
                  <td style={s.td}>{item.active ? 'Yes' : 'Removed'}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        ) : (
          <p style={{ color: colors.muted, fontSize: '0.85rem' }}>No items</p>
        )}
      </div>

      {/* Offers */}
      <div style={s.card}>
        <p style={s.sectionTitle}>Offers ({job.offers?.length || 0})</p>
        {job.offers?.length > 0 ? (
          <div style={s.tableWrap}><table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Driver</th>
                <th style={s.th}>Payout</th>
                <th style={s.th}>Miles</th>
                <th style={s.th}>Offered</th>
                <th style={s.th}>Expires</th>
                <th style={s.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {job.offers.map(o => (
                <tr key={o.id}>
                  <td style={s.td}>{o.driver_name || o.driver_id}</td>
                  <td style={s.td}>£{num(o.driver_payout_gbp)}</td>
                  <td style={s.td}>{o.driver_road_miles ? num(o.driver_road_miles) : '-'}</td>
                  <td style={{ ...s.td, fontSize: '0.8rem', color: colors.muted }}>{fmtDate(o.offered_at)}</td>
                  <td style={{ ...s.td, fontSize: '0.8rem', color: colors.muted }}>{fmtDate(o.expires_at)}</td>
                  <td style={s.td}><StatusBadge status={o.status} /></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        ) : (
          <p style={{ color: colors.muted, fontSize: '0.85rem' }}>No offers sent yet</p>
        )}
      </div>

      {/* Payout */}
      {job.payout && (
        <div style={s.card}>
          <p style={s.sectionTitle}>Payout</p>
          <Row label="Gross" value={`£${num(job.payout.gross_gbp)}`} />
          <Row label="Platform fee" value={`£${num(job.payout.platform_fee_gbp)}`} />
          <Row label="Net to driver" value={`£${num(job.payout.net_gbp)}`} />
          <Row label="Status" value={<StatusBadge status={job.payout.status} />} />
          <Row label="Stripe transfer" value={job.payout.stripe_transfer_id || '-'} />
        </div>
      )}

      {/* Event timeline */}
      <div style={s.card}>
        <p style={s.sectionTitle}>Timeline ({job.events?.length || 0})</p>
        {job.events?.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {job.events.map(ev => (
              <div key={ev.id} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <span style={{ color: colors.accent, fontSize: '0.75rem', minWidth: '130px', flexShrink: 0 }}>
                  {fmtDate(ev.created_at)}
                </span>
                <span style={{ color: colors.white, fontSize: '0.85rem', fontWeight: 600 }}>
                  {ev.event_type.replace(/_/g, ' ')}
                </span>
                {ev.created_by && (
                  <span style={{ color: colors.dim, fontSize: '0.75rem' }}>by {ev.created_by}</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: colors.muted, fontSize: '0.85rem' }}>No events</p>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
      <span style={{ color: colors.muted, fontSize: '0.85rem' }}>{label}</span>
      <span style={{ color: colors.white, fontSize: '0.85rem', fontWeight: 600 }}>
        {value ?? '-'}
      </span>
    </div>
  );
}

function num(v) { return v != null ? Number(v).toFixed(2) : '0.00'; }
function fmtDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
