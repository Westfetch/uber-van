// StatusCancelled — cancellation or refund messaging

export default function StatusCancelled({ booking }) {
  const isRefunded = booking.status === 'refunded';

  return (
    <div style={styles.wrap}>
      <div style={styles.icon}>{isRefunded ? '↩' : '✕'}</div>
      <h2 style={styles.heading}>
        {isRefunded ? 'Booking refunded' : 'Booking cancelled'}
      </h2>
      <p style={styles.text}>
        {isRefunded
          ? 'Your booking has been refunded. The refund should appear on your statement within 5-10 business days.'
          : 'This booking has been cancelled. If you have any questions, please get in touch.'}
      </p>

      {booking.deposit_gbp > 0 && isRefunded && (
        <div style={styles.card}>
          <div style={styles.detailRow}>
            <span style={styles.detailKey}>Refund amount</span>
            <span style={styles.detailVal}>£{booking.deposit_gbp.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  wrap: { textAlign: 'center', paddingTop: '20px' },
  icon: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    background: '#f87171',
    color: '#fff',
    fontSize: '1.5rem',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px',
  },
  heading: { color: '#fff', fontSize: '1.2rem', fontWeight: 700, margin: '0 0 8px' },
  text: { color: '#888', fontSize: '0.9rem', lineHeight: 1.5, margin: '0 0 20px' },
  card: {
    background: '#1e1e1e',
    borderRadius: '12px',
    padding: '16px',
    textAlign: 'left',
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
  },
  detailKey: { color: '#888', fontSize: '0.9rem' },
  detailVal: { color: '#fff', fontSize: '0.9rem', fontWeight: 500 },
};
