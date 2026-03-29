import { useState, useEffect, useRef } from 'react';
import { searchItems } from '../lib/itemLookup.js';

function ItemRow({ item, onRemove, readOnly }) {
  return (
    <div style={{ ...styles.itemCard, ...(item.added_by === 'driver' ? styles.itemCardNew : {}) }}>
      <div style={styles.itemInfo}>
        <div style={styles.itemName}>
          {item.canonical_name}
          {item.added_by === 'driver' && <span style={styles.newBadge}>new</span>}
        </div>
        <div style={styles.itemSub}>
          {item.volume_cuft ? `${item.volume_cuft} cu ft` : ''}
          {item.added_by === 'driver' ? ' · customer notified' : ''}
        </div>
      </div>
      <div style={styles.itemControls}>
        <span style={styles.itemQty}>×{item.quantity}</span>
        {!readOnly && item.added_by === 'driver' && (
          <button style={styles.removeBtn} onClick={() => onRemove(item.id)}>✕</button>
        )}
      </div>
    </div>
  );
}

function AddItemSheet({ onAdd, onClose }) {
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      const res = await searchItems(query, 6);
      setResults(res);
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <div style={styles.sheet}>
      <div style={styles.sheetHandle} />
      <h3 style={styles.sheetTitle}>Add item</h3>
      <input
        ref={inputRef}
        style={styles.searchInput}
        placeholder="Search — sofa, wardrobe, box..."
        value={query}
        onChange={e => setQuery(e.target.value)}
      />
      {results.map(item => (
        <button key={item.canonical_name} style={styles.resultBtn} onClick={() => onAdd(item)}>
          <span style={styles.resultName}>{item.canonical_name}</span>
          <span style={styles.resultSub}>{item.volume_cuft} cu ft</span>
        </button>
      ))}
      {query && !results.length && (
        <p style={styles.noResults}>No match — try a different name</p>
      )}
      <button style={styles.cancelBtn} onClick={onClose}>Cancel</button>
    </div>
  );
}

export default function InventoryEditor({ job, onUpdate }) {
  const [items, setItems]           = useState([]);
  const [actualMiles, setActualMiles] = useState('');
  const [editMiles, setEditMiles]   = useState(false);
  const [showAdd, setShowAdd]       = useState(false);
  const [saving, setSaving]         = useState(false);

  const quotedMiles = job?.context_block?.road_miles || job?.context_block?.ROAD_MILES || 0;
  const originalQuote = Number(job?.customer_quote_gbp || 0);

  useEffect(() => {
    if (!job) return;
    // Load booked items from quote_data
    const booked = (job.quote_data?.matched_items || []).map(i => ({
      ...i,
      added_by: 'customer',
      active: true,
    }));
    setItems(booked);
    setActualMiles(String(quotedMiles));
  }, [job]);

  // Compute running adjustments
  const driverItems = items.filter(i => i.added_by === 'driver' && i.active);
  const addedItemsTotal = driverItems.reduce((s, i) => s + (i.price_delta_gbp || 0), 0);

  const mileDelta    = Math.max(0, Number(actualMiles) - quotedMiles);
  const extraMileage = mileDelta * 1.25;
  const newTotal     = originalQuote + addedItemsTotal + extraMileage;

  async function post(body) {
    const token = localStorage.getItem('driver_token');
    const res = await fetch('/api/update-inventory', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ job_id: job.id, ...body }),
    });
    return res.json();
  }

  async function handleAdd(itemSpec) {
    setSaving(true);
    const priceDelta = itemSpec.volume_cuft
      ? parseFloat((itemSpec.volume_cuft * 0.55).toFixed(2)) // rough: £0.55/cu ft labour
      : 0;
    const data = await post({
      action:         'add_item',
      canonical_name: itemSpec.canonical_name,
      quantity:       1,
      volume_cuft:    itemSpec.volume_cuft,
      price_delta_gbp: priceDelta,
    });
    if (data.item) {
      setItems(prev => [...prev, { ...data.item, added_by: 'driver', active: true }]);
      onUpdate?.();
    }
    setShowAdd(false);
    setSaving(false);
  }

  async function handleRemove(itemId) {
    setSaving(true);
    await post({ action: 'remove_item', item_id: itemId });
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, active: false } : i));
    onUpdate?.();
    setSaving(false);
  }

  async function handleSaveMiles() {
    setSaving(true);
    await post({ action: 'set_miles', actual_miles: Number(actualMiles) });
    setEditMiles(false);
    onUpdate?.();
    setSaving(false);
  }

  const bookedItems  = items.filter(i => i.added_by === 'customer' && i.active);
  const addedItems   = items.filter(i => i.added_by === 'driver' && i.active);

  return (
    <div style={styles.wrap}>
      {saving && <div style={styles.savingBar}>Saving...</div>}

      {/* Booked inventory */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Booked inventory</div>
        {bookedItems.map(item => (
          <ItemRow key={item.canonical_name} item={item} readOnly />
        ))}
      </div>

      {/* Added on the day */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Added on the day</div>
        {addedItems.map(item => (
          <ItemRow key={item.id} item={item} onRemove={handleRemove} />
        ))}
        <button style={styles.addBtn} onClick={() => setShowAdd(true)}>+ Add item</button>
      </div>

      {/* Mileage */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Mileage</div>
        <div style={styles.milesRow}>
          <div style={styles.milesStat}>
            <div style={styles.milesValue}>
              {editMiles ? (
                <input
                  style={styles.milesInput}
                  type="number"
                  value={actualMiles}
                  onChange={e => setActualMiles(e.target.value)}
                  autoFocus
                />
              ) : actualMiles}
              {!editMiles && (
                <button style={styles.editLink} onClick={() => setEditMiles(true)}>edit</button>
              )}
              {editMiles && (
                <button style={styles.saveLink} onClick={handleSaveMiles}>save</button>
              )}
            </div>
            <div style={styles.milesLabel}>Actual miles driven</div>
          </div>
          <div style={styles.milesStat}>
            <div style={{ ...styles.milesValue, color: '#666' }}>{quotedMiles}</div>
            <div style={styles.milesLabel}>Quoted miles</div>
          </div>
        </div>
      </div>

      {/* Price breakdown */}
      <div style={styles.breakdownCard}>
        <div style={styles.breakdownRow}>
          <span>Original quote</span>
          <span>£{originalQuote.toFixed(2)}</span>
        </div>
        {addedItemsTotal > 0 && (
          <div style={styles.breakdownRow}>
            <span>Added items</span>
            <span style={{ color: '#d946ef' }}>+£{addedItemsTotal.toFixed(2)}</span>
          </div>
        )}
        {extraMileage > 0 && (
          <div style={styles.breakdownRow}>
            <span>Extra mileage ({mileDelta.toFixed(0)} mi)</span>
            <span style={{ color: '#d946ef' }}>+£{extraMileage.toFixed(2)}</span>
          </div>
        )}
        <div style={styles.breakdownTotal}>
          <span>New total</span>
          <span>£{newTotal.toFixed(2)}</span>
        </div>
      </div>

      {showAdd && (
        <div style={styles.overlay} onClick={() => setShowAdd(false)}>
          <div onClick={e => e.stopPropagation()}>
            <AddItemSheet onAdd={handleAdd} onClose={() => setShowAdd(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  wrap:    { padding: '0 0 32px', position: 'relative' },
  savingBar: {
    background: '#d946ef22',
    color: '#d946ef',
    fontSize: '0.8rem',
    fontWeight: 600,
    padding: '6px 12px',
    borderRadius: '8px',
    marginBottom: '12px',
    textAlign: 'center',
  },
  section:      { marginBottom: '20px' },
  sectionTitle: {
    color: '#666',
    fontSize: '0.7rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    marginBottom: '8px',
  },
  itemCard: {
    background: '#1e1e1e',
    borderRadius: '10px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '6px',
    padding: '12px 14px',
  },
  itemCardNew: {
    border: '1px solid #d946ef55',
    background: '#1a0a1e',
  },
  itemInfo: { flex: 1 },
  itemName: { color: '#fff', fontSize: '0.95rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' },
  itemSub:  { color: '#666', fontSize: '0.75rem', marginTop: '2px' },
  newBadge: {
    background: '#d946ef',
    borderRadius: '4px',
    color: '#fff',
    fontSize: '0.65rem',
    fontWeight: 700,
    padding: '2px 6px',
    textTransform: 'uppercase',
  },
  itemControls: { display: 'flex', alignItems: 'center', gap: '10px' },
  itemQty:  { color: '#888', fontSize: '0.9rem' },
  removeBtn: {
    background: 'transparent',
    border: 'none',
    color: '#666',
    cursor: 'pointer',
    fontSize: '0.85rem',
    padding: '4px',
  },
  addBtn: {
    background: '#1e1e1e',
    border: '1px dashed #444',
    borderRadius: '10px',
    color: '#888',
    cursor: 'pointer',
    fontSize: '0.9rem',
    padding: '12px',
    width: '100%',
    marginTop: '6px',
  },
  milesRow: { display: 'flex', gap: '10px' },
  milesStat: {
    background: '#1e1e1e',
    borderRadius: '10px',
    flex: 1,
    padding: '12px 14px',
  },
  milesValue: { color: '#fff', fontSize: '1.4rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' },
  milesLabel: { color: '#666', fontSize: '0.75rem', marginTop: '2px' },
  milesInput: {
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid #d946ef',
    color: '#fff',
    fontSize: '1.4rem',
    fontWeight: 700,
    outline: 'none',
    width: '64px',
  },
  editLink: { background: 'none', border: 'none', color: '#d946ef', cursor: 'pointer', fontSize: '0.8rem', padding: 0 },
  saveLink: { background: 'none', border: 'none', color: '#4ade80', cursor: 'pointer', fontSize: '0.8rem', padding: 0 },
  breakdownCard: {
    background: '#1a0a1e',
    border: '1px solid #d946ef33',
    borderRadius: '12px',
    padding: '16px',
  },
  breakdownRow: {
    display: 'flex',
    justifyContent: 'space-between',
    color: '#aaa',
    fontSize: '0.9rem',
    padding: '4px 0',
  },
  breakdownTotal: {
    borderTop: '1px solid #d946ef33',
    display: 'flex',
    justifyContent: 'space-between',
    color: '#fff',
    fontSize: '1.1rem',
    fontWeight: 700,
    marginTop: '8px',
    paddingTop: '10px',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    zIndex: 100,
  },
  sheet: {
    background: '#1a1a1a',
    borderRadius: '20px 20px 0 0',
    padding: '12px 20px 40px',
    width: '100%',
    maxWidth: '480px',
  },
  sheetHandle: {
    background: '#444',
    borderRadius: '3px',
    height: '4px',
    margin: '0 auto 16px',
    width: '40px',
  },
  sheetTitle:  { color: '#fff', fontSize: '1.1rem', fontWeight: 700, marginBottom: '12px' },
  searchInput: {
    background: '#252525',
    border: '1px solid #333',
    borderRadius: '10px',
    color: '#fff',
    fontSize: '1rem',
    marginBottom: '10px',
    outline: 'none',
    padding: '12px 14px',
    width: '100%',
    boxSizing: 'border-box',
  },
  resultBtn: {
    background: '#252525',
    border: 'none',
    borderRadius: '10px',
    color: '#fff',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '6px',
    padding: '12px 14px',
    textAlign: 'left',
    width: '100%',
  },
  resultName: { fontSize: '0.95rem', fontWeight: 500 },
  resultSub:  { color: '#888', fontSize: '0.8rem' },
  noResults:  { color: '#666', fontSize: '0.85rem', textAlign: 'center', margin: '8px 0' },
  cancelBtn: {
    background: 'transparent',
    border: 'none',
    color: '#888',
    cursor: 'pointer',
    fontSize: '0.95rem',
    marginTop: '8px',
    padding: '12px',
    width: '100%',
  },
};
