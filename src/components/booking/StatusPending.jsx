// StatusPending — shown for pending_payment and pending_acceptance
// Animated pulse, "Finding your crew", move date, deposit info

import { getVanLabel } from '../../lib/vanConfig.js';

export default function StatusPending({ booking }) {
  const isPaid = booking.status === 'pending_acceptance';

  const formatDate = d => new Date(d).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <div style={styles.wrap}>
      {/* Pulse animation */}
      <div style={styles.pulseWrap}>
        <div style={styles.pulseOuter} />
        <div style={styles.pulseInner}>
          <span style={styles.pulseIcon}>&#128694;</span>
        </div>
      </div>

      <h2 style={styles.heading}>
        {isPaid ? "We're on it" : 'Processing your payment'}
      </h2>
      <p style={styles.subtext}>
        {isPaid
          ? "Finding you a suitable driver. Check back here for updates - we'll also send you an email once someone's confirmed."
          : 'Your payment is being processed. This page will update automatically.'}
      </p>

      {/* Move details card */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>Your move</div>
        <div style={styles.detailRow}>
          <span style={styles.detailKey}>Date</span>
          <span style={styles.detailVal}>{formatDate(booking.move_date)}</span>
        </div>
        <div style={styles.detailRow}>
          <span style={styles.detailKey}>Start time</span>
          <span style={styles.detailVal}>{booking.start_time || '08:00'}</span>
        </div>
        <div style={styles.detailRow}>
          <span style={styles.detailKey}>Crew</span>
          <span style={styles.detailVal}>{booking.crew_required}-person</span>
        </div>
        <div style={styles.detailRow}>
          <span style={styles.detailKey}>Vehicle</span>
          <span style={styles.detailVal}>{booking.van_loads > 1 ? `${booking.van_loads}x ` : ''}{getVanLabel(booking.van_size || 'luton', 'customer')}</span>
        </div>
      </div>

      {/* Deposit info */}
      {isPaid && (
        <div style={styles.card}>
          <div style={styles.cardTitle}>Payment</div>
          <div style={styles.detailRow}>
            <span style={styles.detailKey}>Deposit held</span>
            <span style={styles.detailVal}>
              £{booking.deposit_gbp?.toFixed(2)}
            </span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.detailKey}>Balance due on day</span>
            <span style={styles.detailVal}>
              £{booking.balance_gbp?.toFixed(2)}
            </span>
          </div>
          <p style={styles.hint}>
            Your card won't be charged until a driver confirms your booking.
          </p>
        </div>
      )}
    </div>
  );
}

const styles = {
  wrap: { textAlign: 'center' },
  pulseWrap: {
    position: 'relative',
    width: '80px',
    height: '80px',
    margin: '0 auto 20px',
  },
  pulseOuter: {
    position: 'absolute',
    inset: 0,
    borderRadius: '50%',
    background: 'rgba(251, 146, 60, 0.15)',
    animation: 'pulse 2s ease-in-out infinite',
  },
  pulseInner: {
    position: 'absolute',
    inset: '16px',
    borderRadius: '50%',
    background: '#1e1e1e',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseIcon: { fontSize: '1.5rem' },
  heading: { color: '#fff', fontSize: '1.3rem', fontWeight: 700, margin: '0 0 8px' },
  subtext: { color: '#888', fontSize: '0.9rem', lineHeight: 1.5, margin: '0 0 24px' },
  card: {
    background: '#1e1e1e',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '12px',
    textAlign: 'left',
  },
  cardTitle: {
    color: '#666',
    fontSize: '0.7rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    marginBottom: '10px',
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '1px solid #252525',
  },
  detailKey: { color: '#888', fontSize: '0.9rem' },
  detailVal: { color: '#fff', fontSize: '0.9rem', fontWeight: 500 },
  hint: {
    color: '#666',
    fontSize: '0.8rem',
    margin: '12px 0 0',
    lineHeight: 1.4,
  },
};
