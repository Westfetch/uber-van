// BookingTimeline — vertical timeline from job_events

const EVENT_CONFIG = {
  deposit_charged:             { label: 'Deposit authorized', icon: '£', color: '#f59e0b' },
  offer_accepted:              { label: 'Driver confirmed',   icon: '✓', color: '#4ade80' },
  item_added:                  { label: 'Item added',         icon: '+', color: '#60a5fa' },
  item_removed:                { label: 'Item removed',       icon: '-', color: '#fb923c' },
  customer_signoff_requested:  { label: 'Sign-off requested', icon: '✎', color: '#d946ef' },
  customer_signed_off:         { label: 'Signed off',         icon: '✓', color: '#4ade80' },
  balance_charged:             { label: 'Balance charged',    icon: '£', color: '#4ade80' },
};

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    + ' at '
    + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export default function BookingTimeline({ events }) {
  if (!events?.length) return null;

  return (
    <div style={styles.wrap}>
      <div style={styles.title}>Timeline</div>
      <div style={styles.timeline}>
        {events.map((evt, i) => {
          const config = EVENT_CONFIG[evt.event_type] || {
            label: evt.event_type,
            icon: '•',
            color: '#888',
          };
          const isLast = i === events.length - 1;

          return (
            <div key={i} style={styles.entry}>
              {/* Connector line */}
              {!isLast && <div style={styles.line} />}

              {/* Dot */}
              <div style={{ ...styles.dot, background: config.color }}>
                <span style={styles.dotIcon}>{config.icon}</span>
              </div>

              {/* Content */}
              <div style={styles.content}>
                <div style={styles.label}>{config.label}</div>
                <div style={styles.time}>{formatTime(evt.created_at)}</div>
                {evt.payload?.canonical_name && (
                  <div style={styles.detail}>{evt.payload.canonical_name}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  wrap: { marginTop: '8px' },
  title: {
    color: '#666',
    fontSize: '0.7rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    marginBottom: '12px',
  },
  timeline: { position: 'relative' },
  entry: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    position: 'relative',
    paddingBottom: '20px',
  },
  line: {
    position: 'absolute',
    left: '11px',
    top: '24px',
    bottom: '0',
    width: '2px',
    background: '#333',
  },
  dot: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  dotIcon: { fontSize: '0.7rem', color: '#000', fontWeight: 700 },
  content: { paddingTop: '2px' },
  label: { color: '#ccc', fontSize: '0.85rem', fontWeight: 600 },
  time: { color: '#666', fontSize: '0.75rem', marginTop: '2px' },
  detail: { color: '#888', fontSize: '0.8rem', marginTop: '2px' },
};
