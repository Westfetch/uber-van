import { useState, useEffect } from 'react';
import { useAdmin } from './AdminContext.jsx';
import { s, colors } from './styles.js';
import { VAN_CONFIG, VAN_DB_VALUES } from '../../lib/vanConfig.js';
import api from '../../lib/api.js';

const field = (label, key, type = 'number', opts = {}) => ({ label, key, type, ...opts });

const PRICING_SECTIONS = [
  { title: 'Labour',
    fields: [
      field('Rate per hour (£)', 'labour_rate_hr'),
      field('Overtime multiplier', 'overtime_multiplier', 'number', { step: '0.1' }),
      field('Overtime threshold (hrs)', 'overtime_threshold_hrs'),
      field('Multi-day threshold (hrs)', 'multiday_threshold_hrs'),
    ] },
  { title: 'Mileage',
    fields: [
      field('Rate per mile (£)', 'mileage_rate_mi', 'number', { step: '0.05' }),
      field('Minimum charge (£)', 'mileage_min_charge'),
      field('Driving speed (mph)', 'driving_speed_mph'),
    ] },
  { title: 'Accommodation & Subsistence',
    fields: [
      field('Per night (£)', 'accommodation_per_night'),
      field('Per day meals (£)', 'subsistence_per_day'),
    ] },
  { title: 'Deposit',
    fields: [
      field('Deposit %', 'deposit_pct', 'number', { step: '0.01', display: v => `${Math.round(v * 100)}%` }),
    ] },
  { title: 'Crew Thresholds (cu ft)',
    fields: [
      field('2-person crew above', 'crew_2_volume_threshold'),
      field('3-person crew above', 'crew_3_volume_threshold'),
    ] },
  { title: 'Van & Review',
    fields: [
      field('Default van size', 'default_van_size', 'select', { options: VAN_DB_VALUES.map(v => ({ value: v, label: VAN_CONFIG[v].adminLabel })) }),
      field('Manual review above (cu ft)', 'manual_review_volume'),
    ] },
  { title: 'Day Supplements (£ per crew member)',
    fields: [
      field('Sunday', 'sunday_supplement'),
      field('Bank holiday', 'bank_holiday_supplement'),
      field('Early start', 'early_start_supplement'),
    ] },
  { title: 'Stair Rates (£ per tier)',
    fields: [
      field('1-5 stairs', 'stair_rates.0'),
      field('6-13 stairs', 'stair_rates.1'),
      field('14-26 stairs', 'stair_rates.2'),
      field('27-39 stairs', 'stair_rates.3'),
      field('40-52 stairs', 'stair_rates.4'),
    ] },
  { title: 'Carry & Parking (£)',
    fields: [
      field('Long carry 20-50m', 'long_carry_rates.0'),
      field('Long carry 50m+', 'long_carry_rates.1'),
      field('Difficult parking', 'parking_rates.difficult'),
      field('City centre parking', 'parking_rates.city_centre'),
    ] },
  { title: 'Packing Buffers',
    fields: [
      field('Packed', 'packing_buffers.packed', 'number', { step: '0.05' }),
      field('Mostly packed', 'packing_buffers.mostly_packed', 'number', { step: '0.05' }),
      field('Partial', 'packing_buffers.partial', 'number', { step: '0.05' }),
      field('Unpacked', 'packing_buffers.unpacked', 'number', { step: '0.05' }),
    ] },
  { title: 'Loading',
    fields: [
      field('Buffer multiplier', 'loading_hours_buffer', 'number', { step: '0.05' }),
      field('Minimum hours', 'loading_hours_min', 'number', { step: '0.5' }),
      field('Multi-stop extra hrs', 'multi_stop_extra_hrs', 'number', { step: '0.25' }),
      field('Info buffer', 'info_buffer', 'number', { step: '0.05' }),
      field('Inefficiency buffer', 'inefficiency_buffer', 'number', { step: '0.05' }),
      field('Inefficiency (awkward)', 'inefficiency_buffer_awkward', 'number', { step: '0.05' }),
      field('Disassembly charge (mins)', 'disassembly_charge'),
      field('Disassembly sometimes (mins)', 'disassembly_charge_sometimes'),
    ] },
];

// Deep get/set for dotted keys like "stair_rates.0" or "parking_rates.difficult"
function deepGet(obj, path) {
  return path.split('.').reduce((o, k) => o?.[k], obj);
}
function deepSet(obj, path, value) {
  const clone = JSON.parse(JSON.stringify(obj));
  const keys = path.split('.');
  let cur = clone;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (cur[k] === undefined) cur[k] = isNaN(keys[i + 1]) ? {} : [];
    cur = cur[k];
  }
  const lastKey = keys[keys.length - 1];
  cur[lastKey] = value;
  return clone;
}

export default function ConfigPage() {
  const { token } = useAdmin();
  const [pricing, setPricing] = useState(null);
  const [funnels, setFunnels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [funnelSaving, setFunnelSaving] = useState({});
  const [updatedAt, setUpdatedAt] = useState(null);
  const [drivers, setDrivers] = useState([]);

  useEffect(() => {
    Promise.all([
      api('/api/admin?action=config', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      api('/api/admin?action=drivers', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ])
      .then(([configData, driversData]) => {
        setPricing(configData.pricing);
        setFunnels(configData.funnels || []);
        setUpdatedAt(configData.updated_at);
        setDrivers(driversData.drivers || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [token]);

  function handleChange(key, raw) {
    const value = typeof raw === 'string' && !isNaN(raw) && raw !== '' ? parseFloat(raw) : raw;
    setPricing(p => deepSet(p, key, value));
    setSaved(false);
  }

  async function savePricing() {
    setSaving(true);
    try {
      const res = await api('/api/admin?action=config-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pricing }),
      });
      const d = await res.json();
      if (d.pricing) setPricing(d.pricing);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch { /* */ }
    setSaving(false);
  }

  async function saveFunnel(f) {
    setFunnelSaving(p => ({ ...p, [f.id]: true }));
    try {
      await api('/api/admin?action=funnel-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ funnel_id: f.id, platform_fee_pct: f.platform_fee_pct, depot_postcode: f.depot_postcode, owner_driver_id: f.owner_driver_id || null }),
      });
    } catch { /* */ }
    setFunnelSaving(p => ({ ...p, [f.id]: false }));
  }

  if (loading) return <p style={{ color: colors.muted }}>Loading config...</p>;
  if (!pricing) return <p style={{ color: colors.error }}>Failed to load config</p>;

  return (
    <div>
      <div style={s.header}>
        <h1 style={s.h1}>Platform Config</h1>
        {updatedAt && (
          <span style={{ color: colors.dim, fontSize: '0.75rem' }}>
            Last updated: {new Date(updatedAt).toLocaleString()}
          </span>
        )}
      </div>

      {/* Pricing sections */}
      {PRICING_SECTIONS.map(section => (
        <div key={section.title} style={{ ...s.card, marginBottom: '12px' }}>
          <h3 style={{ ...s.sectionTitle, marginTop: 0 }}>{section.title}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
            {section.fields.map(f => {
              const val = deepGet(pricing, f.key);
              return (
                <div key={f.key}>
                  <label style={{ ...s.label, fontSize: '0.7rem', display: 'block', marginBottom: '4px' }}>{f.label}</label>
                  {f.type === 'select' ? (
                    <select
                      value={val || ''}
                      onChange={e => handleChange(f.key, e.target.value)}
                      style={{ ...s.input, padding: '8px 10px', fontSize: '0.85rem' }}
                    >
                      {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : (
                    <input
                      type="number"
                      value={val ?? ''}
                      step={f.step || '1'}
                      onChange={e => handleChange(f.key, e.target.value)}
                      style={{ ...s.input, padding: '8px 10px', fontSize: '0.85rem' }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '32px' }}>
        <button onClick={savePricing} disabled={saving} style={{ ...s.btn, opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Saving...' : 'Save pricing'}
        </button>
        {saved && <span style={{ color: '#4ade80', fontSize: '0.85rem' }}>Saved — quotes will use new values within 5 minutes</span>}
      </div>

      {/* Funnel settings */}
      <h2 style={{ ...s.h1, fontSize: '1.1rem', marginBottom: '16px' }}>Funnel Settings</h2>
      {funnels.map(f => (
        <div key={f.id} style={{ ...s.card, marginBottom: '12px' }}>
          <h3 style={{ ...s.sectionTitle, marginTop: 0 }}>{f.name} <span style={{ color: colors.dim, fontWeight: 400 }}>({f.slug})</span></h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ ...s.label, fontSize: '0.7rem', display: 'block', marginBottom: '4px' }}>Platform fee %</label>
              <input
                type="number"
                value={f.platform_fee_pct}
                step="0.5"
                min="0"
                max="100"
                onChange={e => setFunnels(fs => fs.map(x => x.id === f.id ? { ...x, platform_fee_pct: parseFloat(e.target.value) || 0 } : x))}
                style={{ ...s.input, padding: '8px 10px', fontSize: '0.85rem' }}
              />
            </div>
            <div>
              <label style={{ ...s.label, fontSize: '0.7rem', display: 'block', marginBottom: '4px' }}>Depot postcode</label>
              <input
                type="text"
                value={f.depot_postcode}
                onChange={e => setFunnels(fs => fs.map(x => x.id === f.id ? { ...x, depot_postcode: e.target.value } : x))}
                style={{ ...s.input, padding: '8px 10px', fontSize: '0.85rem' }}
              />
            </div>
            <div>
              <label style={{ ...s.label, fontSize: '0.7rem', display: 'block', marginBottom: '4px' }}>Owner driver</label>
              <select
                value={f.owner_driver_id || ''}
                onChange={e => setFunnels(fs => fs.map(x => x.id === f.id ? { ...x, owner_driver_id: e.target.value || null } : x))}
                style={{ ...s.input, padding: '8px 10px', fontSize: '0.85rem' }}
              >
                <option value="">None (pool only)</option>
                {drivers.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name}{d.driver_type === 'owner' ? ' (owner)' : ''} — {d.depot_postcode}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={() => saveFunnel(f)}
            disabled={funnelSaving[f.id]}
            style={{ ...s.btnSmall, opacity: funnelSaving[f.id] ? 0.6 : 1 }}
          >
            {funnelSaving[f.id] ? 'Saving...' : 'Save funnel'}
          </button>
        </div>
      ))}
    </div>
  );
}
