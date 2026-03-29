import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAdmin } from './AdminContext.jsx';
import api, { APP_ORIGIN } from '../../lib/api.js';
import StatusBadge from './StatusBadge.jsx';
import { s, colors, statusColors } from './styles.js';
import { VAN_CONFIG, VAN_DB_VALUES, getVanLabel } from '../../lib/vanConfig.js';

export default function DriverDetail() {
  const { driverId } = useParams();
  const { token }     = useAdmin();
  const navigate       = useNavigate();

  const [data, setData]             = useState(null);
  const [loading, setLoading]       = useState(true);
  const [setupCode, setSetupCode]   = useState(null);
  const [generating, setGenerating] = useState(false);

  // Driver info form state
  const [info, setInfo] = useState({ name: '', phone: '', email: '', van_size: 'luton', depot_postcode: '' });
  const [savingInfo, setSavingInfo] = useState(false);
  const [infoMsg, setInfoMsg] = useState('');

  // Onboarding form state
  const [onboarding, setOnboarding] = useState({
    approval_status: 'pending',
    insurance_verified: false,
    insurance_expiry: '',
    license_verified: false,
    dbs_verified: false,
    notes: '',
  });
  const [saving, setSaving]       = useState(false);
  const [saveMsg, setSaveMsg]     = useState('');
  const [resetting, setResetting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState('');

  useEffect(() => {
    api(`/api/admin?action=driver&id=${driverId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        setData(d);
        if (d?.driver) {
          setInfo({
            name: d.driver.name || '',
            phone: d.driver.phone || '',
            email: d.driver.email || '',
            van_size: d.driver.van_size || 'luton',
            depot_postcode: d.driver.depot_postcode || '',
          });
          setOnboarding({
            approval_status: d.driver.approval_status || 'pending',
            insurance_verified: d.driver.insurance_verified || false,
            insurance_expiry: d.driver.insurance_expiry || '',
            license_verified: d.driver.license_verified || false,
            dbs_verified: d.driver.dbs_verified || false,
            notes: d.driver.notes || '',
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [driverId, token]);

  async function generateCode() {
    setGenerating(true);
    try {
      const res = await api('/api/admin?action=driver-setup-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ driver_id: driverId }),
      });
      const d = await res.json();
      if (res.ok) setSetupCode(d.code);
    } catch {} finally {
      setGenerating(false);
    }
  }

  async function saveOnboarding() {
    setSaving(true);
    setSaveMsg('');
    try {
      const res = await api('/api/admin?action=driver-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ driver_id: driverId, ...onboarding }),
      });
      if (res.ok) {
        setSaveMsg('Saved');
        setTimeout(() => setSaveMsg(''), 2000);
      } else {
        const err = await res.json();
        setSaveMsg(err.error || 'Error saving');
      }
    } catch {
      setSaveMsg('Error saving');
    } finally {
      setSaving(false);
    }
  }

  async function resetAccount() {
    if (!confirm('Reset this driver\'s account? This will clear their setup code and set them offline. You can then generate a new setup code.')) return;
    setResetting(true);
    try {
      await api('/api/admin?action=driver-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ driver_id: driverId }),
      });
      setSetupCode(null);
    } catch {} finally {
      setResetting(false);
    }
  }

  async function sendInvite() {
    setInviteMsg('');
    let code = setupCode;
    if (!code) {
      setGenerating(true);
      try {
        const res = await api('/api/admin?action=driver-setup-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ driver_id: driverId }),
        });
        const d = await res.json();
        if (res.ok) { code = d.code; setSetupCode(d.code); }
      } catch {} finally {
        setGenerating(false);
      }
    }
    if (!code) { setInviteMsg('Failed to generate code'); return; }

    const landingUrl = `${APP_ORIGIN}/driver/get-started`;
    const message = `You've been invited to drive with us! Get the app: ${landingUrl}\n\nYour name: ${data.driver.name}\nYour login code: ${code}\n(Code expires in 48h, one-time use)`;

    try {
      await navigator.clipboard.writeText(message);
      setInviteMsg('Invite copied to clipboard!');
    } catch {
      setInviteMsg('Could not copy — share manually');
    }
    setTimeout(() => setInviteMsg(''), 3000);
  }

  async function saveInfo() {
    setSavingInfo(true);
    setInfoMsg('');
    try {
      const res = await api('/api/admin?action=driver-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ driver_id: driverId, ...info }),
      });
      if (res.ok) {
        setInfoMsg('Saved');
        setTimeout(() => setInfoMsg(''), 2000);
      } else {
        const err = await res.json();
        setInfoMsg(err.error || 'Error saving');
      }
    } catch {
      setInfoMsg('Error saving');
    } finally {
      setSavingInfo(false);
    }
  }

  function setField(key, val) {
    setOnboarding(prev => ({ ...prev, [key]: val }));
  }

  if (loading) return <p style={{ color: colors.muted, padding: '40px', textAlign: 'center' }}>Loading...</p>;
  if (!data) return <p style={{ color: colors.error, padding: '40px', textAlign: 'center' }}>Driver not found</p>;

  const d = data.driver;
  const approvalColor = statusColors[onboarding.approval_status] || '#555';

  return (
    <div>
      <button style={s.backLink} onClick={() => navigate('/admin/drivers')}>← Back to drivers</button>

      {/* Header */}
      <div style={{ ...s.card, marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: 0, color: colors.white, fontSize: '1.2rem' }}>
            <span style={{
              display: 'inline-block',
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: d.online ? '#4ade80' : '#555',
              marginRight: '8px',
            }} />
            {d.name}
          </h2>
          <p style={{ margin: '4px 0 0', color: colors.muted, fontSize: '0.85rem' }}>
            {getVanLabel(d.van_size)} &middot; {d.depot_postcode} &middot; {d.phone || 'No phone'} &middot; {d.email || 'No email'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            style={{ ...s.btnOutline, opacity: generating ? 0.6 : 1 }}
            onClick={sendInvite}
            disabled={generating}
          >
            Send invite
          </button>
          <button
            style={{ ...s.btn, opacity: generating ? 0.6 : 1 }}
            onClick={generateCode}
            disabled={generating}
          >
            {generating ? 'Generating...' : 'Generate setup code'}
          </button>
        </div>
      </div>

      {/* Invite feedback */}
      {inviteMsg && (
        <p style={{ color: colors.accent, fontSize: '0.85rem', margin: '0 0 8px', textAlign: 'center' }}>{inviteMsg}</p>
      )}

      {/* Setup code display */}
      {setupCode && (
        <div style={{ ...s.card, background: '#1e1e1e', textAlign: 'center' }}>
          <p style={{ color: colors.muted, fontSize: '0.8rem', margin: '0 0 8px' }}>
            Setup code (expires in 48h, one-time use)
          </p>
          <p style={{
            fontFamily: 'monospace',
            fontSize: '2rem',
            fontWeight: 700,
            color: colors.accent,
            margin: 0,
            letterSpacing: '0.15em',
            userSelect: 'all',
          }}>
            {setupCode}
          </p>
        </div>
      )}

      {/* Driver Info */}
      <div style={s.card}>
        <p style={s.sectionTitle}>Driver Info</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div>
            <label style={{ ...s.label, display: 'block', marginBottom: '4px' }}>Name</label>
            <input
              value={info.name}
              onChange={e => setInfo(p => ({ ...p, name: e.target.value }))}
              style={{ ...s.input, padding: '8px 10px', fontSize: '0.85rem' }}
            />
          </div>
          <div>
            <label style={{ ...s.label, display: 'block', marginBottom: '4px' }}>Phone</label>
            <input
              type="tel"
              value={info.phone}
              onChange={e => setInfo(p => ({ ...p, phone: e.target.value }))}
              style={{ ...s.input, padding: '8px 10px', fontSize: '0.85rem' }}
            />
          </div>
          <div>
            <label style={{ ...s.label, display: 'block', marginBottom: '4px' }}>Email</label>
            <input
              type="email"
              value={info.email}
              onChange={e => setInfo(p => ({ ...p, email: e.target.value }))}
              style={{ ...s.input, padding: '8px 10px', fontSize: '0.85rem' }}
            />
          </div>
          <div>
            <label style={{ ...s.label, display: 'block', marginBottom: '4px' }}>Depot postcode</label>
            <input
              value={info.depot_postcode}
              onChange={e => setInfo(p => ({ ...p, depot_postcode: e.target.value }))}
              style={{ ...s.input, padding: '8px 10px', fontSize: '0.85rem' }}
            />
          </div>
          <div>
            <label style={{ ...s.label, display: 'block', marginBottom: '4px' }}>Van size</label>
            <select
              value={info.van_size}
              onChange={e => setInfo(p => ({ ...p, van_size: e.target.value }))}
              style={{ ...s.input, padding: '8px 10px', fontSize: '0.85rem' }}
            >
              {VAN_DB_VALUES.map(v => <option key={v} value={v}>{VAN_CONFIG[v].adminLabel}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            style={{ ...s.btn, opacity: savingInfo ? 0.6 : 1 }}
            onClick={saveInfo}
            disabled={savingInfo}
          >
            {savingInfo ? 'Saving...' : 'Save info'}
          </button>
          {infoMsg && (
            <span style={{ fontSize: '0.85rem', color: infoMsg === 'Saved' ? '#4ade80' : colors.error }}>{infoMsg}</span>
          )}
        </div>
      </div>

      {/* Onboarding */}
      <div style={s.card}>
        <p style={s.sectionTitle}>Onboarding</p>

        {/* Approval status */}
        <div style={{ marginBottom: '16px' }}>
          <label style={s.label}>Approval status</label>
          <div style={{ marginTop: '6px', display: 'flex', gap: '8px' }}>
            {['pending', 'approved', 'suspended'].map(status => (
              <button
                key={status}
                onClick={() => setField('approval_status', status)}
                style={{
                  ...s.filterTab,
                  ...(onboarding.approval_status === status ? {
                    background: (statusColors[status] || '#555') + '22',
                    borderColor: statusColors[status] || '#555',
                    color: statusColors[status] || '#555',
                  } : {}),
                  textTransform: 'capitalize',
                }}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Document checks */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: colors.white, fontSize: '0.9rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={onboarding.insurance_verified}
              onChange={e => setField('insurance_verified', e.target.checked)}
              style={{ accentColor: colors.accent, width: '16px', height: '16px' }}
            />
            Insurance verified
          </label>
          <div>
            <label style={{ ...s.label, display: 'block', marginBottom: '4px' }}>Insurance expiry</label>
            <input
              type="date"
              value={onboarding.insurance_expiry}
              onChange={e => setField('insurance_expiry', e.target.value)}
              style={{ ...s.input, padding: '8px 10px', fontSize: '0.85rem' }}
            />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: colors.white, fontSize: '0.9rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={onboarding.license_verified}
              onChange={e => setField('license_verified', e.target.checked)}
              style={{ accentColor: colors.accent, width: '16px', height: '16px' }}
            />
            Driving licence verified
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: colors.white, fontSize: '0.9rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={onboarding.dbs_verified}
              onChange={e => setField('dbs_verified', e.target.checked)}
              style={{ accentColor: colors.accent, width: '16px', height: '16px' }}
            />
            DBS check verified
          </label>
        </div>

        {/* Notes */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ ...s.label, display: 'block', marginBottom: '4px' }}>Notes</label>
          <textarea
            value={onboarding.notes}
            onChange={e => setField('notes', e.target.value)}
            rows={3}
            style={{ ...s.input, resize: 'vertical', fontFamily: 'inherit' }}
            placeholder="Internal notes about this driver..."
          />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            style={{ ...s.btn, opacity: saving ? 0.6 : 1 }}
            onClick={saveOnboarding}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save changes'}
          </button>
          <button
            style={{ ...s.btnOutline, color: colors.error, borderColor: colors.error, opacity: resetting ? 0.6 : 1 }}
            onClick={resetAccount}
            disabled={resetting}
          >
            {resetting ? 'Resetting...' : 'Reset account'}
          </button>
          {saveMsg && (
            <span style={{ fontSize: '0.85rem', color: saveMsg === 'Saved' ? '#4ade80' : colors.error }}>{saveMsg}</span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
        <div style={s.statCard}>
          <p style={s.statValue}>{data.stats?.job_count || 0}</p>
          <p style={s.statLabel}>Jobs completed</p>
        </div>
        <div style={s.statCard}>
          <p style={s.statValue}>£{Number(data.stats?.total_net || 0).toFixed(2)}</p>
          <p style={s.statLabel}>Total earned</p>
        </div>
        <div style={s.statCard}>
          <p style={s.statValue}>£{Number(data.stats?.avg_payout || 0).toFixed(2)}</p>
          <p style={s.statLabel}>Avg per job</p>
        </div>
        <div style={s.statCard}>
          <p style={s.statValue}>
            {d.rating ? `${Number(d.rating).toFixed(1)} ★` : '—'}
          </p>
          <p style={s.statLabel}>{d.rating_count || 0} reviews</p>
        </div>
      </div>

      {/* Job history */}
      <div style={s.card}>
        <p style={s.sectionTitle}>Job History</p>
        {data.jobs?.length > 0 ? (
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Date</th>
                <th style={s.th}>Route</th>
                <th style={s.th}>Quote</th>
                <th style={s.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.jobs.map(job => (
                <tr
                  key={job.id}
                  style={s.trClickable}
                  onClick={() => navigate(`/admin/jobs/${job.id}`)}
                  onMouseEnter={e => e.currentTarget.style.background = '#1e1e1e'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={s.td}>{job.move_date || '-'}</td>
                  <td style={{ ...s.td, fontSize: '0.8rem', color: colors.muted }}>
                    {job.pickup_postcode} → {job.destination_postcode}
                  </td>
                  <td style={s.td}>£{Number(job.customer_quote_gbp).toFixed(2)}</td>
                  <td style={s.td}><StatusBadge status={job.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ color: colors.muted, fontSize: '0.85rem' }}>No jobs yet</p>
        )}
      </div>
    </div>
  );
}
