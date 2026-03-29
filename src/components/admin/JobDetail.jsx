import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAdmin } from './AdminContext.jsx';
import api from '../../lib/api.js';
import StatusBadge from './StatusBadge.jsx';
import { s, colors } from './styles.js';

export default function JobDetail() {
  const { jobId }  = useParams();
  const { token }  = useAdmin();
  const navigate    = useNavigate();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api(`/api/admin?action=job&id=${jobId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => setJob(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [jobId, token]);

  if (loading) return <p style={{ color: colors.muted, padding: '40px', textAlign: 'center' }}>Loading...</p>;
  if (!job) return <p style={{ color: colors.error, padding: '40px', textAlign: 'center' }}>Job not found</p>;

  const j = job.job;

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
        <StatusBadge status={j.status} />
      </div>

      {/* Grid: Customer + Financials */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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
          <Row label="Van loads" value={j.van_loads} />
          <Row label="Crew" value={j.crew_required} />
          <Row label="Volume" value={j.effective_volume_cuft ? `${num(j.effective_volume_cuft)} cu ft` : '-'} />
        </div>
      </div>

      {/* Items */}
      <div style={s.card}>
        <p style={s.sectionTitle}>Items ({job.items?.length || 0})</p>
        {job.items?.length > 0 ? (
          <table style={s.table}>
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
          </table>
        ) : (
          <p style={{ color: colors.muted, fontSize: '0.85rem' }}>No items</p>
        )}
      </div>

      {/* Offers */}
      <div style={s.card}>
        <p style={s.sectionTitle}>Offers ({job.offers?.length || 0})</p>
        {job.offers?.length > 0 ? (
          <table style={s.table}>
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
          </table>
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
