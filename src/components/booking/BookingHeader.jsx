// BookingHeader — logo, route summary, status badge

const STATUS_LABELS = {
  pending_payment:    'Processing payment',
  pending_acceptance: 'Finding your crew',
  accepted:           'Booked',
  in_progress:        'Move underway',
  completed:          'Completed',
  cancelled:          'Cancelled',
  refunded:           'Refunded',
};

const STATUS_COLORS = {
  pending_payment:    '#f59e0b',
  pending_acceptance: '#fb923c',
  accepted:           '#4ade80',
  in_progress:        '#60a5fa',
  completed:          '#888',
  cancelled:          '#f87171',
  refunded:           '#f87171',
};

export default function BookingHeader({ booking }) {
  const color = STATUS_COLORS[booking.status] || '#888';
  const label = STATUS_LABELS[booking.status] || booking.status;

  return (
    <div style={styles.header}>
      {/* Brand */}
      <div style={styles.brand}>
        <span style={styles.logo}>VDM</span>
        <span style={styles.brandSub}>Your booking</span>
      </div>

      {/* Status badge */}
      <div style={{ ...styles.badge, background: `${color}20`, color }}>
        <div style={{ ...styles.badgeDot, background: color }} />
        {label}
      </div>

      {/* Route card */}
      <div style={styles.routeCard}>
        <div style={styles.routeStop}>
          <div style={styles.routeDot} />
          <div>
            <div style={styles.postcode}>{booking.pickup_postcode}</div>
            <div style={styles.routeLabel}>Pickup</div>
          </div>
        </div>
        <div style={styles.routeLine} />
        <div style={styles.routeStop}>
          <div style={{ ...styles.routeDot, background: '#d946ef' }} />
          <div>
            <div style={styles.postcode}>{booking.destination_postcode}</div>
            <div style={styles.routeLabel}>Drop-off</div>
          </div>
        </div>
      </div>

      {/* Customer greeting */}
      {booking.customer_name && (
        <div style={styles.greeting}>
          Hi {booking.customer_name.split(' ')[0]}
        </div>
      )}
    </div>
  );
}

const styles = {
  header: { marginBottom: '24px' },
  brand: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' },
  logo: {
    background: '#d946ef',
    color: '#fff',
    fontWeight: 800,
    fontSize: '0.8rem',
    letterSpacing: '0.1em',
    padding: '4px 8px',
    borderRadius: '6px',
  },
  brandSub: { color: '#888', fontSize: '0.85rem' },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: '20px',
    fontSize: '0.8rem',
    fontWeight: 600,
    marginBottom: '16px',
  },
  badgeDot: { width: '6px', height: '6px', borderRadius: '50%' },
  routeCard: {
    background: '#1e1e1e',
    borderRadius: '12px',
    padding: '16px',
  },
  routeStop: { display: 'flex', alignItems: 'center', gap: '12px', padding: '4px 0' },
  routeDot:  { width: '10px', height: '10px', borderRadius: '50%', background: '#fff', flexShrink: 0 },
  postcode:  { color: '#fff', fontWeight: 700, fontSize: '1rem' },
  routeLabel: { color: '#666', fontSize: '0.75rem' },
  routeLine: { width: '2px', height: '20px', background: '#333', marginLeft: '4px' },
  greeting: {
    color: '#ccc',
    fontSize: '1.1rem',
    fontWeight: 600,
    marginTop: '16px',
  },
};
