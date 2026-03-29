// Itinerary tab — shown on the day of the job
// Shows route, access notes, start time, customer phone, inventory summary

import { getVanLabel } from '../lib/vanConfig.js';

function AccessNote({ label, access }) {
  if (!access) return null;
  const lines = [
    access.floor != null && `Floor ${access.floor}${access.lift ? ' (lift)' : ''}`,
    access.stair_count > 0 && `${access.stair_count} flights of stairs`,
    access.carry_distance_band && `Carry: ${access.carry_distance_band.replace(/_/g, ' ')}`,
    access.parking_difficulty && `Parking: ${access.parking_difficulty.replace(/_/g, ' ')}`,
    access.tight_access && 'Tight access',
  ].filter(Boolean);

  return (
    <div style={styles.accessBlock}>
      <div style={styles.accessLabel}>{label}</div>
      {lines.length ? lines.map(l => (
        <div key={l} style={styles.accessLine}>{l}</div>
      )) : <div style={styles.accessLine}>No issues noted</div>}
    </div>
  );
}

export default function Itinerary({ job }) {
  if (!job) return null;

  const ctx    = job.context_block || {};
  const access = job.quote_data?.access || {};
  const items  = job.quote_data?.matched_items || [];

  const formatDate = d => new Date(d).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  const roadMiles   = ctx.road_miles || ctx.ROAD_MILES || '?';
  const isBankHol   = ctx.is_bank_holiday || ctx.IS_BANK_HOLIDAY;
  const tollCharge  = ctx.toll_charge || ctx.TOLL_CHARGE;
  const cazZones    = ctx.caz_zones || ctx.CAZ_ZONES;

  return (
    <div style={styles.wrap}>
      {/* Header */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Job details</div>
        <div style={styles.detailRow}>
          <span style={styles.detailKey}>Date</span>
          <span style={styles.detailVal}>{formatDate(job.move_date)}</span>
        </div>
        <div style={styles.detailRow}>
          <span style={styles.detailKey}>Start time</span>
          <span style={styles.detailVal}>{job.start_time || '08:00'}</span>
        </div>
        <div style={styles.detailRow}>
          <span style={styles.detailKey}>Vehicle</span>
          <span style={styles.detailVal}>{(job.van_loads || 1) > 1 ? `${job.van_loads}x ` : ''}{getVanLabel(job.van_size || 'luton', 'customer')}</span>
        </div>
        <div style={styles.detailRow}>
          <span style={styles.detailKey}>Crew</span>
          <span style={styles.detailVal}>{job.crew_required}-person lift</span>
        </div>
        {isBankHol && (
          <div style={styles.detailRow}>
            <span style={styles.detailKey}>Note</span>
            <span style={{ ...styles.detailVal, color: '#f59e0b' }}>Bank holiday</span>
          </div>
        )}
      </div>

      {/* Route */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Route</div>
        <div style={styles.routeCard}>
          <div style={styles.routeStop}>
            <div style={styles.routeDot} />
            <div>
              <div style={styles.postcode}>{job.pickup_postcode}</div>
              <div style={styles.routeLabel}>Pickup</div>
            </div>
          </div>
          <div style={styles.routeLine} />
          <div style={styles.routeStop}>
            <div style={{ ...styles.routeDot, background: '#d946ef' }} />
            <div>
              <div style={styles.postcode}>{job.destination_postcode}</div>
              <div style={styles.routeLabel}>Drop-off</div>
            </div>
          </div>
          <div style={styles.routeMiles}>{roadMiles} mi</div>
        </div>
        {tollCharge > 0 && (
          <div style={styles.routeNote}>Toll: £{Number(tollCharge).toFixed(2)} (pre-approved)</div>
        )}
        {cazZones && cazZones !== 'none' && (
          <div style={styles.routeNote}>CAZ zones: {cazZones} — fleet compliant</div>
        )}
      </div>

      {/* Access notes */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Access</div>
        <AccessNote label="Pickup" access={access.pickup} />
        <AccessNote label="Drop-off" access={access.destination} />
      </div>

      {/* Customer contact */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Customer</div>
        <div style={styles.contactCard}>
          <div style={styles.contactName}>{job.customer_name || 'Customer'}</div>
          {job.customer_phone && (
            <a href={`tel:${job.customer_phone}`} style={styles.callBtn}>
              Call customer
            </a>
          )}
        </div>
      </div>

      {/* Inventory summary */}
      {items.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Booked inventory ({items.length} lines)</div>
          {items.map((item, i) => (
            <div key={i} style={styles.itemRow}>
              <span style={styles.itemName}>{item.canonical_name}</span>
              <span style={styles.itemQty}>×{item.quantity || 1}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  wrap: { padding: '0 0 32px' },
  section: { marginBottom: '20px' },
  sectionTitle: {
    color: '#666',
    fontSize: '0.7rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    marginBottom: '8px',
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '1px solid #252525',
  },
  detailKey: { color: '#888', fontSize: '0.9rem' },
  detailVal: { color: '#fff', fontSize: '0.9rem', fontWeight: 500 },
  routeCard: {
    background: '#1e1e1e',
    borderRadius: '12px',
    padding: '16px',
    position: 'relative',
  },
  routeStop: { display: 'flex', alignItems: 'center', gap: '12px', padding: '4px 0' },
  routeDot:  { width: '10px', height: '10px', borderRadius: '50%', background: '#fff', flexShrink: 0 },
  postcode:  { color: '#fff', fontWeight: 700, fontSize: '1rem' },
  routeLabel: { color: '#666', fontSize: '0.75rem' },
  routeLine: { width: '2px', height: '20px', background: '#333', marginLeft: '4px', marginRight: '22px' },
  routeMiles: {
    position: 'absolute',
    right: '16px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#888',
    fontSize: '0.85rem',
  },
  routeNote: { color: '#888', fontSize: '0.8rem', marginTop: '8px', paddingLeft: '4px' },
  accessBlock: { background: '#1e1e1e', borderRadius: '10px', padding: '12px 14px', marginBottom: '8px' },
  accessLabel: { color: '#aaa', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' },
  accessLine:  { color: '#ccc', fontSize: '0.85rem', padding: '2px 0' },
  contactCard: {
    background: '#1e1e1e',
    borderRadius: '12px',
    padding: '14px 16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  contactName: { color: '#fff', fontWeight: 600 },
  callBtn: {
    background: '#d946ef',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '0.85rem',
    fontWeight: 600,
    padding: '8px 14px',
    textDecoration: 'none',
  },
  itemRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '1px solid #252525',
  },
  itemName: { color: '#ccc', fontSize: '0.9rem' },
  itemQty:  { color: '#888', fontSize: '0.9rem' },
};
