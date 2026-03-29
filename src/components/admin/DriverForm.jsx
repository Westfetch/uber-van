import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from './AdminContext.jsx';
import { s, colors } from './styles.js';

const VAN_SIZES = ['transit', 'luton', 'large_luton', '7.5t'];

export default function DriverForm() {
  const { token }  = useAdmin();
  const navigate    = useNavigate();

  const [form, setForm]     = useState({ name: '', phone: '', email: '', van_size: 'luton', depot_postcode: '' });
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  function set(key, val) { setForm(f => ({ ...f, [key]: val })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/admin-driver-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create driver');
      navigate(`/admin/drivers/${data.driver.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button style={s.backLink} onClick={() => navigate('/admin/drivers')}>← Back to drivers</button>

      <div style={{ ...s.card, maxWidth: '480px', marginTop: '12px' }}>
        <h2 style={{ margin: '0 0 20px', color: colors.white, fontSize: '1.1rem' }}>Add driver</h2>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={s.label}>Name *</label>
            <input style={{ ...s.input, marginTop: '4px' }} value={form.name} onChange={e => set('name', e.target.value)} required />
          </div>
          <div>
            <label style={s.label}>Phone</label>
            <input style={{ ...s.input, marginTop: '4px' }} type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} />
          </div>
          <div>
            <label style={s.label}>Email</label>
            <input style={{ ...s.input, marginTop: '4px' }} type="email" value={form.email} onChange={e => set('email', e.target.value)} />
          </div>
          <div>
            <label style={s.label}>Van size *</label>
            <select
              style={{ ...s.input, marginTop: '4px', cursor: 'pointer' }}
              value={form.van_size}
              onChange={e => set('van_size', e.target.value)}
            >
              {VAN_SIZES.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label style={s.label}>Depot postcode *</label>
            <input style={{ ...s.input, marginTop: '4px' }} value={form.depot_postcode} onChange={e => set('depot_postcode', e.target.value)} required />
          </div>

          {error && <p style={{ color: colors.error, fontSize: '0.85rem', margin: 0 }}>{error}</p>}

          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button style={{ ...s.btn, opacity: loading ? 0.6 : 1 }} disabled={loading}>
              {loading ? 'Creating...' : 'Create driver'}
            </button>
            <button type="button" style={s.btnOutline} onClick={() => navigate('/admin/drivers')}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
