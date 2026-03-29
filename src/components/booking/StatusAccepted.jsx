// StatusAccepted — driver confirmed, deposit captured
// Shows driver name, date/time/location, countdown to move day

export default function StatusAccepted({ booking }) {
  const formatDate = d => new Date(d).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  // Days until move
  const now     = new Date();
  const move    = new Date(booking.move_date);
  const diffMs  = move.setHours(0,0,0,0) - now.setHours(0,0,0,0);
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  const countdownText = diffDays === 0 ? 'Today'
    : diffDays === 1 ? 'Tomorrow'
    : diffDays > 0 ? `${diffDays} days away`
    : 'Move date passed';

  return (
    <div style={styles.wrap}>
      {/* Confirmation banner */}
      <div style={styles.banner}>
        <div style={styles.checkCircle}>&#10003;</div>
        <h2 style={styles.heading}>You're booked!</h2>
        {booking.driver_name && (
          <p style={styles.driverIntro}>
            {booking.driver_name} will be handling your move
          </p>
        )}
      </div>

      {/* Move details */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>Move details</div>
        <div style={styles.detailRow}>
          <span style={styles.detailKey}>Date</span>
          <span style={styles.detailVal}>{formatDate(booking.move_date)}</span>
        </div>
        <div style={styles.detailRow}>
          <span style={styles.detailKey}>Start time</span>
          <span style={styles.detailVal}>{booking.start_time || '08:00'}</span>
        </div>
        <div style={styles.detailRow}>
          <span style={styles.detailKey}>Pickup</span>
          <span style={styles.detailVal}>{booking.pickup_postcode}</span>
        </div>
        {booking.driver_name && (
          <div style={styles.detailRow}>
            <span style={styles.detailKey}>Driver</span>
            <span style={styles.detailVal}>{booking.driver_name}</span>
          </div>
        )}
        <div style={styles.detailRow}>
          <span style={styles.detailKey}>Crew</span>
          <span style={styles.detailVal}>{booking.crew_required}-person</span>
        </div>
      </div>

      {/* Countdown */}
      {diffDays >= 0 && (
        <div style={styles.countdown}>
          <div style={styles.countdownNumber}>
            {diffDays === 0 ? 'Today' : diffDays}
          </div>
          {diffDays > 0 && (
            <div style={styles.countdownLabel}>
              {diffDays === 1 ? 'day to go' : 'days to go'}
            </div>
          )}
        </div>
      )}

      {/* Payment summary */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>Payment</div>
        <div style={styles.detailRow}>
          <span style={styles.detailKey}>Deposit charged</span>
          <span style={styles.detailVal}>£{booking.deposit_gbp?.toFixed(2)}</span>
        </div>
        <div style={styles.detailRow}>
          <span style={styles.detailKey}>Balance due on day</span>
          <span style={styles.detailVal}>£{booking.balance_gbp?.toFixed(2)}</span>
        </div>
        <div style={{ ...styles.detailRow, borderBottom: 'none' }}>
          <span style={styles.detailKey}>Total</span>
          <span style={{ ...styles.detailVal, fontWeight: 700 }}>
            £{booking.customer_quote_gbp?.toFixed(2)}
          </span>
        </div>
      </div>

      <p style={styles.hint}>
        You'll get a text on the day of your move with live updates. This page will also update in real time.
      </p>
    </div>
  );
}

const styles = {
  wrap: {},
  banner: {
    background: 'rgba(74, 222, 128, 0.08)',
    borderRadius: '12px',
    padding: '24px 16px',
    textAlign: 'center',
    marginBottom: '16px',
    border: '1px solid rgba(74, 222, 128, 0.2)',
  },
  checkCircle: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    background: '#4ade80',
    color: '#000',
    fontSize: '1.5rem',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 12px',
  },
  heading: { color: '#fff', fontSize: '1.3rem', fontWeight: 700, margin: '0 0 6px' },
  driverIntro: { color: '#aaa', fontSize: '0.9rem', margin: 0 },
  card: {
    background: '#1e1e1e',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '12px',
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
  countdown: {
    background: '#1e1e1e',
    borderRadius: '12px',
    padding: '20px',
    textAlign: 'center',
    marginBottom: '12px',
  },
  countdownNumber: {
    color: '#d946ef',
    fontSize: '2.5rem',
    fontWeight: 800,
    lineHeight: 1,
  },
  countdownLabel: {
    color: '#888',
    fontSize: '0.85rem',
    marginTop: '4px',
  },
  hint: {
    color: '#666',
    fontSize: '0.8rem',
    textAlign: 'center',
    lineHeight: 1.4,
    margin: '16px 0 0',
  },
};
