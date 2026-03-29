import { useState, useEffect, useRef } from 'react';
import api from '../lib/api.js';

export default function SignOff({ job, onComplete }) {
  const [signLinkSent, setSignLinkSent]   = useState(false);
  const [customerSigned, setCustomerSigned] = useState(false);
  const [completing, setCompleting]         = useState(false);
  const [done, setDone]                     = useState(false);
  const [error, setError]                   = useState('');

  const originalQuote = Number(job?.customer_quote_gbp || 0);
  const finalTotal    = Number(job?.final_total_gbp || originalQuote);
  const balance       = Number(job?.balance_gbp || 0);
  const adjustments   = finalTotal - originalQuote;

  // Poll for customer sign-off event every 10s after link is sent
  const pollRef = useRef(null);
  useEffect(() => {
    if (!signLinkSent || customerSigned) return;
    pollRef.current = setInterval(async () => {
      try {
        const token = localStorage.getItem('driver_token');
        const res = await api(`/api/admin?action=job&id=${job.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        const events = data.job?.events || data.events || [];
        if (events.some(e => e.event_type === 'customer_signed_off')) {
          setCustomerSigned(true);
          clearInterval(pollRef.current);
        }
      } catch {}
    }, 10_000);
    return () => clearInterval(pollRef.current);
  }, [signLinkSent, customerSigned, job?.id]);

  async function sendSignLink() {
    try {
      const token = localStorage.getItem('driver_token');
      const res = await api('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ job_id: job.id, action: 'request' }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to send sign-off link');
        return;
      }
      setSignLinkSent(true);
    } catch (err) {
      setError(err.message);
    }
  }

  async function confirmComplete() {
    if (!customerSigned) return;
    setCompleting(true);
    setError('');
    try {
      const token = localStorage.getItem('driver_token');
      const res = await api('/api/complete-job', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ job_id: job.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to complete job');
      setDone(true);
      onComplete?.();
    } catch (err) {
      setError(err.message);
      setCompleting(false);
    }
  }

  if (done) {
    return (
      <div style={styles.doneWrap}>
        <div style={styles.doneIcon}>✓</div>
        <h2 style={styles.doneTitle}>Job complete</h2>
        <p style={styles.doneSub}>Payment is being processed. Payout on its way.</p>
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      {/* Summary */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Final summary</div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryRow}>
            <span>Original quote</span>
            <span>£{originalQuote.toFixed(2)}</span>
          </div>
          {adjustments !== 0 && (
            <div style={styles.summaryRow}>
              <span>Day-of adjustments</span>
              <span style={{ color: adjustments > 0 ? '#d946ef' : '#4ade80' }}>
                {adjustments > 0 ? '+' : ''}£{adjustments.toFixed(2)}
              </span>
            </div>
          )}
          <div style={styles.summaryTotal}>
            <span>Customer total</span>
            <span>£{finalTotal.toFixed(2)}</span>
          </div>
          <div style={styles.summaryNote}>
            Deposit already paid: £{(finalTotal - balance).toFixed(2)} ·
            Balance to collect: £{balance.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Customer sign-off */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Customer sign-off</div>
        <div style={styles.signCard}>
          <p style={styles.signInfo}>
            Send the customer a link to review and sign off the final itemised bill.
            Once they sign, you can complete the job and trigger payment.
          </p>

          {!signLinkSent ? (
            <button style={styles.sendBtn} onClick={sendSignLink}>
              Send sign-off link to customer
            </button>
          ) : (
            <div style={styles.sentConfirm}>
              Link sent to {job?.customer_phone || 'customer'} — waiting for signature
            </div>
          )}

          {signLinkSent && (
            <label style={styles.checkLabel}>
              <input
                type="checkbox"
                style={styles.checkbox}
                checked={customerSigned}
                onChange={e => setCustomerSigned(e.target.checked)}
              />
              <span style={{ color: customerSigned ? '#4ade80' : '#888' }}>
                Customer has signed off
              </span>
            </label>
          )}
        </div>
      </div>

      {error && <p style={styles.error}>{error}</p>}

      <button
        style={{
          ...styles.completeBtn,
          opacity: customerSigned && !completing ? 1 : 0.4,
          cursor: customerSigned && !completing ? 'pointer' : 'default',
        }}
        onClick={confirmComplete}
        disabled={!customerSigned || completing}
      >
        {completing ? 'Processing...' : 'Confirm job complete'}
      </button>

      <p style={styles.hint}>
        This will charge the customer's balance and trigger your payout.
      </p>
    </div>
  );
}

const styles = {
  wrap: { padding: '0 0 40px' },
  section:      { marginBottom: '20px' },
  sectionTitle: {
    color: '#666',
    fontSize: '0.7rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    marginBottom: '8px',
  },
  summaryCard: {
    background: '#1a0a1e',
    border: '1px solid #d946ef33',
    borderRadius: '12px',
    padding: '16px',
  },
  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    color: '#aaa',
    fontSize: '0.9rem',
    padding: '4px 0',
  },
  summaryTotal: {
    borderTop: '1px solid #d946ef33',
    display: 'flex',
    justifyContent: 'space-between',
    color: '#fff',
    fontSize: '1.15rem',
    fontWeight: 700,
    marginTop: '8px',
    paddingTop: '10px',
  },
  summaryNote: { color: '#666', fontSize: '0.78rem', marginTop: '8px' },
  signCard: {
    background: '#1e1e1e',
    borderRadius: '12px',
    padding: '16px',
  },
  signInfo: { color: '#aaa', fontSize: '0.85rem', margin: '0 0 14px', lineHeight: 1.5 },
  sendBtn: {
    background: '#252525',
    border: '1px solid #444',
    borderRadius: '10px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: 600,
    padding: '12px',
    width: '100%',
  },
  sentConfirm: {
    background: '#0a1a10',
    border: '1px solid #4ade8044',
    borderRadius: '8px',
    color: '#4ade80',
    fontSize: '0.85rem',
    marginBottom: '12px',
    padding: '10px 12px',
  },
  checkLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    cursor: 'pointer',
    marginTop: '12px',
    fontSize: '0.9rem',
  },
  checkbox: { accentColor: '#d946ef', width: '18px', height: '18px', cursor: 'pointer' },
  error: { color: '#f87171', fontSize: '0.85rem', marginBottom: '8px' },
  completeBtn: {
    background: '#d946ef',
    border: 'none',
    borderRadius: '12px',
    color: '#fff',
    fontSize: '1rem',
    fontWeight: 700,
    padding: '16px',
    transition: 'opacity 0.15s',
    width: '100%',
  },
  hint: { color: '#555', fontSize: '0.78rem', textAlign: 'center', marginTop: '10px' },
  doneWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
    textAlign: 'center',
    padding: '32px',
  },
  doneIcon: {
    background: '#4ade8022',
    border: '2px solid #4ade80',
    borderRadius: '50%',
    color: '#4ade80',
    fontSize: '2rem',
    height: '64px',
    lineHeight: '64px',
    marginBottom: '20px',
    width: '64px',
  },
  doneTitle: { color: '#fff', fontSize: '1.4rem', fontWeight: 700, margin: '0 0 8px' },
  doneSub:   { color: '#888', fontSize: '0.9rem' },
};
