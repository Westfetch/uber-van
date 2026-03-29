// StatusInProgress — move day, live inventory, price adjustments, sign-off
import api from '../../lib/api.js';

export default function StatusInProgress({ booking }) {
  const formatDate = d => new Date(d).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  const activeItems  = (booking.items || []).filter(i => i.active !== false);
  const removedItems = (booking.items || []).filter(i => i.active === false);

  // Calculate adjusted total from original quote + price deltas
  const totalDelta = activeItems.reduce((sum, i) => sum + (i.price_delta_gbp || 0), 0)
    + removedItems.reduce((sum, i) => sum + (i.price_delta_gbp || 0), 0);

  const adjustedTotal = (booking.customer_quote_gbp || 0) + totalDelta;

  // Check for sign-off request in events
  const signoffRequested = (booking.events || []).some(
    e => e.event_type === 'customer_signoff_requested'
  );
  const signedOff = (booking.events || []).some(
    e => e.event_type === 'customer_signed_off'
  );

  return (
    <div style={styles.wrap}>
      {/* Live banner */}
      <div style={styles.liveBanner}>
        <div style={styles.liveDot} />
        <span>Move underway</span>
      </div>

      {/* Move info */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>Today's move</div>
        <div style={styles.detailRow}>
          <span style={styles.detailKey}>Date</span>
          <span style={styles.detailVal}>{formatDate(booking.move_date)}</span>
        </div>
        {booking.driver_name && (
          <div style={styles.detailRow}>
            <span style={styles.detailKey}>Driver</span>
            <span style={styles.detailVal}>{booking.driver_name}</span>
          </div>
        )}
      </div>

      {/* Inventory */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>
          Inventory ({activeItems.length} item{activeItems.length !== 1 ? 's' : ''})
        </div>

        {activeItems.map((item, i) => (
          <div key={i} style={styles.itemRow}>
            <div style={styles.itemLeft}>
              <span style={styles.itemName}>{item.canonical_name}</span>
              {item.added_by === 'driver' && (
                <span style={styles.addedBadge}>Added on day</span>
              )}
            </div>
            <div style={styles.itemRight}>
              <span style={styles.itemQty}>x{item.quantity || 1}</span>
              {item.price_delta_gbp > 0 && (
                <span style={styles.pricePlus}>+£{item.price_delta_gbp.toFixed(2)}</span>
              )}
            </div>
          </div>
        ))}

        {removedItems.map((item, i) => (
          <div key={`r${i}`} style={{ ...styles.itemRow, opacity: 0.5 }}>
            <div style={styles.itemLeft}>
              <span style={{ ...styles.itemName, textDecoration: 'line-through' }}>
                {item.canonical_name}
              </span>
              <span style={styles.removedBadge}>Removed</span>
            </div>
            <div style={styles.itemRight}>
              {item.price_delta_gbp < 0 && (
                <span style={styles.priceMinus}>
                  -£{Math.abs(item.price_delta_gbp).toFixed(2)}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Price summary */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>Cost</div>
        <div style={styles.detailRow}>
          <span style={styles.detailKey}>Original quote</span>
          <span style={styles.detailVal}>£{booking.customer_quote_gbp?.toFixed(2)}</span>
        </div>
        {totalDelta !== 0 && (
          <div style={styles.detailRow}>
            <span style={styles.detailKey}>Day-of adjustments</span>
            <span style={{
              ...styles.detailVal,
              color: totalDelta > 0 ? '#fb923c' : '#4ade80',
            }}>
              {totalDelta > 0 ? '+' : '-'}£{Math.abs(totalDelta).toFixed(2)}
            </span>
          </div>
        )}
        <div style={{ ...styles.detailRow, borderBottom: 'none' }}>
          <span style={styles.detailKey}>Current total</span>
          <span style={{ ...styles.detailVal, fontWeight: 700 }}>
            £{adjustedTotal.toFixed(2)}
          </span>
        </div>
        <div style={styles.detailRow}>
          <span style={styles.detailKey}>Deposit paid</span>
          <span style={styles.detailVal}>-£{booking.deposit_gbp?.toFixed(2)}</span>
        </div>
        <div style={{ ...styles.detailRow, borderBottom: 'none' }}>
          <span style={styles.detailKey}>Remaining balance</span>
          <span style={{ ...styles.detailVal, fontWeight: 700 }}>
            £{(adjustedTotal - (booking.deposit_gbp || 0)).toFixed(2)}
          </span>
        </div>
      </div>

      {/* Sign-off prompt */}
      {signoffRequested && !signedOff && (
        <div style={styles.signoffBanner}>
          <div style={styles.signoffTitle}>Sign-off requested</div>
          <p style={styles.signoffText}>
            Your driver has finished loading. Please review the inventory above and confirm everything looks correct.
          </p>
          <button
            style={styles.signoffBtn}
            onClick={() => {
              // Will be wired in Phase 5
              const token = sessionStorage.getItem(`booking_token_${booking.id}`);
              api('/api/booking', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: booking.id, token, action: 'confirm' }),
              });
            }}
          >
            I confirm this is correct
          </button>
        </div>
      )}

      {signedOff && (
        <div style={styles.signedOffBanner}>
          Signed off - waiting for move to complete
        </div>
      )}

      <p style={styles.hint}>
        This page updates every 30 seconds. You'll also get texts for any inventory changes.
      </p>
    </div>
  );
}

const styles = {
  wrap: {},
  liveBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'rgba(96, 165, 250, 0.1)',
    color: '#60a5fa',
    borderRadius: '10px',
    padding: '10px 14px',
    fontSize: '0.9rem',
    fontWeight: 600,
    marginBottom: '16px',
    border: '1px solid rgba(96, 165, 250, 0.2)',
  },
  liveDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#60a5fa',
    animation: 'pulse 2s ease-in-out infinite',
  },
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
  itemRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
    borderBottom: '1px solid #252525',
  },
  itemLeft: { display: 'flex', alignItems: 'center', gap: '8px' },
  itemRight: { display: 'flex', alignItems: 'center', gap: '8px' },
  itemName: { color: '#ccc', fontSize: '0.9rem' },
  itemQty: { color: '#888', fontSize: '0.85rem' },
  addedBadge: {
    background: 'rgba(74, 222, 128, 0.15)',
    color: '#4ade80',
    fontSize: '0.65rem',
    fontWeight: 600,
    padding: '2px 6px',
    borderRadius: '4px',
  },
  removedBadge: {
    background: 'rgba(248, 113, 113, 0.15)',
    color: '#f87171',
    fontSize: '0.65rem',
    fontWeight: 600,
    padding: '2px 6px',
    borderRadius: '4px',
  },
  pricePlus: { color: '#fb923c', fontSize: '0.85rem', fontWeight: 600 },
  priceMinus: { color: '#4ade80', fontSize: '0.85rem', fontWeight: 600 },
  signoffBanner: {
    background: 'rgba(217, 70, 239, 0.08)',
    border: '1px solid rgba(217, 70, 239, 0.3)',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '12px',
    textAlign: 'center',
  },
  signoffTitle: {
    color: '#d946ef',
    fontSize: '1rem',
    fontWeight: 700,
    marginBottom: '8px',
  },
  signoffText: { color: '#aaa', fontSize: '0.85rem', margin: '0 0 12px', lineHeight: 1.4 },
  signoffBtn: {
    background: '#d946ef',
    border: 'none',
    borderRadius: '10px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: 700,
    padding: '12px 24px',
    width: '100%',
  },
  signedOffBanner: {
    background: 'rgba(74, 222, 128, 0.08)',
    border: '1px solid rgba(74, 222, 128, 0.2)',
    borderRadius: '10px',
    padding: '12px 14px',
    color: '#4ade80',
    fontSize: '0.9rem',
    fontWeight: 600,
    textAlign: 'center',
    marginBottom: '12px',
  },
  hint: {
    color: '#666',
    fontSize: '0.8rem',
    textAlign: 'center',
    lineHeight: 1.4,
    margin: '16px 0 0',
  },
};
