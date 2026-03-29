// StatusCompleted — final receipt: itemised breakdown, payment confirmation

export default function StatusCompleted({ booking }) {
  const formatDate = d => new Date(d).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  const activeItems  = (booking.items || []).filter(i => i.active !== false);
  const removedItems = (booking.items || []).filter(i => i.active === false);

  const totalDelta = activeItems.reduce((sum, i) => sum + (i.price_delta_gbp || 0), 0)
    + removedItems.reduce((sum, i) => sum + (i.price_delta_gbp || 0), 0);

  const finalTotal = (booking.customer_quote_gbp || 0) + totalDelta;

  return (
    <div style={styles.wrap}>
      {/* Complete banner */}
      <div style={styles.banner}>
        <div style={styles.checkCircle}>&#10003;</div>
        <h2 style={styles.heading}>Move complete</h2>
        <p style={styles.sub}>{formatDate(booking.move_date)}</p>
      </div>

      {/* Inventory receipt */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>Items moved</div>
        {activeItems.map((item, i) => (
          <div key={i} style={styles.itemRow}>
            <span style={styles.itemName}>
              {item.canonical_name} x{item.quantity || 1}
            </span>
            {item.price_delta_gbp > 0 && (
              <span style={styles.pricePlus}>+£{item.price_delta_gbp.toFixed(2)}</span>
            )}
          </div>
        ))}
        {removedItems.map((item, i) => (
          <div key={`r${i}`} style={{ ...styles.itemRow, opacity: 0.5 }}>
            <span style={{ ...styles.itemName, textDecoration: 'line-through' }}>
              {item.canonical_name}
            </span>
            {item.price_delta_gbp < 0 && (
              <span style={styles.priceMinus}>-£{Math.abs(item.price_delta_gbp).toFixed(2)}</span>
            )}
          </div>
        ))}
      </div>

      {/* Financial breakdown */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>Receipt</div>
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
        <div style={styles.divider} />
        <div style={styles.detailRow}>
          <span style={styles.detailKey}>Total</span>
          <span style={{ ...styles.detailVal, fontSize: '1.1rem', fontWeight: 700 }}>
            £{finalTotal.toFixed(2)}
          </span>
        </div>
        <div style={styles.divider} />
        <div style={styles.detailRow}>
          <span style={styles.detailKey}>Deposit charged</span>
          <span style={styles.detailVal}>£{booking.deposit_gbp?.toFixed(2)}</span>
        </div>
        <div style={styles.detailRow}>
          <span style={styles.detailKey}>Balance charged</span>
          <span style={styles.detailVal}>
            £{(finalTotal - (booking.deposit_gbp || 0)).toFixed(2)}
          </span>
        </div>
        <div style={{ ...styles.detailRow, borderBottom: 'none' }}>
          <span style={{ ...styles.detailKey, fontWeight: 600, color: '#aaa' }}>Total paid</span>
          <span style={{ ...styles.detailVal, fontWeight: 700, color: '#4ade80' }}>
            £{finalTotal.toFixed(2)}
          </span>
        </div>
      </div>

      <p style={styles.hint}>
        A copy of this receipt has been sent to your email. Thank you for choosing VDM.
      </p>
    </div>
  );
}

const styles = {
  wrap: {},
  banner: {
    textAlign: 'center',
    marginBottom: '16px',
    padding: '20px 0',
  },
  checkCircle: {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    background: '#888',
    color: '#000',
    fontSize: '1.8rem',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 12px',
  },
  heading: { color: '#fff', fontSize: '1.3rem', fontWeight: 700, margin: '0 0 4px' },
  sub: { color: '#888', fontSize: '0.9rem', margin: 0 },
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
  itemRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '6px 0',
    borderBottom: '1px solid #252525',
  },
  itemName: { color: '#ccc', fontSize: '0.9rem' },
  pricePlus: { color: '#fb923c', fontSize: '0.85rem', fontWeight: 600 },
  priceMinus: { color: '#4ade80', fontSize: '0.85rem', fontWeight: 600 },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '1px solid #252525',
  },
  detailKey: { color: '#888', fontSize: '0.9rem' },
  detailVal: { color: '#fff', fontSize: '0.9rem', fontWeight: 500 },
  divider: {
    height: '1px',
    background: '#333',
    margin: '4px 0',
  },
  hint: {
    color: '#666',
    fontSize: '0.8rem',
    textAlign: 'center',
    lineHeight: 1.4,
    margin: '16px 0 0',
  },
};
