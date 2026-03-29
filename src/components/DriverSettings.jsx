// DriverSettings — Settings tab with bank details, invoices, online toggle, account info.

import { useState, useEffect } from 'react';
import api from '../lib/api.js';
import OnlineToggle from './OnlineToggle.jsx';

function formatWeek(start, end) {
  const fmt = d => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return `${fmt(start)} – ${fmt(end)}`;
}

function StatusBadge({ status }) {
  const colors = { issued: '#f59e0b', paid: '#4ade80', failed: '#ef4444', draft: '#888' };
  return (
    <span style={{
      color: colors[status] || '#888',
      fontSize: '0.75rem',
      fontWeight: 600,
      textTransform: 'uppercase',
    }}>
      {status}
    </span>
  );
}

export default function DriverSettings({ driver, onLogout, onDriverUpdate }) {
  const [settings, setSettings]   = useState(null);
  const [invoices, setInvoices]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [online, setOnline]       = useState(driver?.online || false);
  const [toggling, setToggling]   = useState(false);

  // Bank details form
  const [accountName, setAccountName] = useState('');
  const [sortCode, setSortCode]       = useState('');
  const [accountNo, setAccountNo]     = useState('');
  const [bankSaved, setBankSaved]     = useState(false);
  const [bankError, setBankError]     = useState('');
  const [saving, setSaving]           = useState(false);

  // Invoice detail expansion
  const [expanded, setExpanded] = useState(null);
  const [lines, setLines]      = useState([]);

  useEffect(() => {
    async function load() {
      const token = localStorage.getItem('driver_token');
      const headers = { Authorization: `Bearer ${token}` };

      const [settingsRes, invoicesRes] = await Promise.all([
        api('/api/driver-data?type=settings', { headers }),
        api('/api/driver-data?type=invoices', { headers }),
      ]);

      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setSettings(data.driver);
        setOnline(data.driver.online);
        if (data.driver.bank_account_name) setAccountName(data.driver.bank_account_name);
        if (data.driver.bank_sort_code) setSortCode(data.driver.bank_sort_code);
        if (data.driver.bank_account_no) setAccountNo(data.driver.bank_account_no);
      }

      if (invoicesRes.ok) {
        const data = await invoicesRes.json();
        setInvoices(data.invoices || []);
      }

      setLoading(false);
    }
    load();
  }, []);

  async function handleToggle() {
    setToggling(true);
    const prev = online;
    setOnline(!prev);
    try {
      const token = localStorage.getItem('driver_token');
      const res = await api('/api/driver-data?type=toggle-online', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setOnline(data.online);
        onDriverUpdate?.({ online: data.online });
      } else {
        setOnline(prev);
      }
    } catch {
      setOnline(prev);
    } finally {
      setToggling(false);
    }
  }

  async function handleSaveBank(e) {
    e.preventDefault();
    setSaving(true);
    setBankError('');
    setBankSaved(false);

    try {
      const token = localStorage.getItem('driver_token');
      const res = await api('/api/driver-data?type=bank-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          sort_code: sortCode,
          account_no: accountNo,
          account_name: accountName,
        }),
      });

      if (res.ok) {
        setBankSaved(true);
        setTimeout(() => setBankSaved(false), 3000);
      } else {
        const data = await res.json();
        setBankError(data.error || 'Failed to save');
      }
    } catch {
      setBankError('Network error');
    } finally {
      setSaving(false);
    }
  }

  async function toggleInvoice(inv) {
    if (expanded === inv.id) {
      setExpanded(null);
      setLines([]);
      return;
    }
    setExpanded(inv.id);
    setLines([]);
    const token = localStorage.getItem('driver_token');
    const res = await api(`/api/driver-data?type=invoice-detail&id=${inv.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setLines(data.lines || []);
    }
  }

  if (loading) return <p style={s.muted}>Loading...</p>;

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerTitle}>Settings</div>
      </div>

      {/* Payments card */}
      <section style={s.section}>
        <div style={s.sectionTitle}>PAYMENTS</div>
        <div style={s.card}>
          <form onSubmit={handleSaveBank}>
            <label style={s.label}>Account name</label>
            <input
              style={s.input}
              type="text"
              value={accountName}
              onChange={e => setAccountName(e.target.value)}
              placeholder="J Smith"
            />

            <label style={s.label}>Sort code</label>
            <input
              style={s.input}
              type="text"
              value={sortCode}
              onChange={e => setSortCode(e.target.value)}
              placeholder="00-00-00"
              maxLength={8}
            />

            <label style={s.label}>Account number</label>
            <input
              style={s.input}
              type="text"
              value={accountNo}
              onChange={e => setAccountNo(e.target.value)}
              placeholder="12345678"
              maxLength={8}
            />

            <button
              type="submit"
              disabled={saving}
              style={{ ...s.btn, opacity: saving ? 0.6 : 1 }}
            >
              {saving ? 'Saving...' : 'Save bank details'}
            </button>

            {bankSaved && <p style={s.success}>Bank details saved</p>}
            {bankError && <p style={s.error}>{bankError}</p>}
          </form>
        </div>
      </section>

      {/* Invoices */}
      <section style={s.section}>
        <div style={s.sectionTitle}>INVOICES</div>
        {invoices.length === 0 ? (
          <div style={s.card}>
            <p style={{ color: '#888', fontSize: '0.85rem', margin: 0 }}>
              No invoices yet. Invoices are generated weekly for completed jobs.
            </p>
          </div>
        ) : (
          <div style={s.invoiceList}>
            {invoices.map(inv => (
              <div key={inv.id}>
                <button style={s.invoiceRow} onClick={() => toggleInvoice(inv)}>
                  <div style={{ flex: 1 }}>
                    <div style={s.invoiceWeek}>{formatWeek(inv.week_start, inv.week_end)}</div>
                    <div style={s.invoiceMeta}>
                      {inv.job_count} job{inv.job_count !== 1 ? 's' : ''} · {inv.invoice_number}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={s.invoiceAmount}>£{Number(inv.net_gbp).toFixed(2)}</div>
                    <StatusBadge status={inv.status} />
                  </div>
                </button>
                {expanded === inv.id && lines.length > 0 && (
                  <div style={s.invoiceDetail}>
                    {lines.map(l => (
                      <div key={l.id} style={s.lineRow}>
                        <span style={{ color: '#ccc', fontSize: '0.8rem', flex: 1 }}>{l.description}</span>
                        <span style={{ color: '#fff', fontSize: '0.8rem', fontWeight: 600 }}>£{Number(l.net_gbp).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Online toggle */}
      <section style={s.section}>
        <div style={s.sectionTitle}>AVAILABILITY</div>
        <OnlineToggle online={online} onToggle={handleToggle} toggling={toggling} />
      </section>

      {/* Account */}
      <section style={s.section}>
        <div style={s.sectionTitle}>ACCOUNT</div>
        <div style={s.card}>
          {settings?.name && <p style={s.accountRow}><span style={s.accountLabel}>Name</span> {settings.name}</p>}
          {settings?.email && <p style={s.accountRow}><span style={s.accountLabel}>Email</span> {settings.email}</p>}
          {settings?.phone && <p style={s.accountRow}><span style={s.accountLabel}>Phone</span> {settings.phone}</p>}
          <button
            style={{ ...s.btn, background: 'transparent', border: '1px solid #333', color: '#888', marginTop: '12px' }}
            onClick={() => { localStorage.removeItem('driver_token'); onLogout(); }}
          >
            Sign out
          </button>
        </div>
      </section>

      {/* Bottom spacer for tab bar */}
      <div style={{ height: '80px' }} />
    </div>
  );
}

const s = {
  page: { background: '#0a0a0a', minHeight: '100dvh', color: '#fff', fontFamily: 'system-ui, sans-serif', paddingBottom: '20px' },

  header: { padding: '24px 20px 16px', borderBottom: '1px solid #1e1e1e' },
  headerTitle: { color: '#fff', fontSize: '1.2rem', fontWeight: 700 },

  section: { padding: '16px 20px 0' },
  sectionTitle: { color: '#666', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' },

  card: { background: '#1a1a1a', borderRadius: '12px', padding: '16px' },

  label: { display: 'block', color: '#888', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px', marginTop: '12px' },
  input: {
    width: '100%', background: '#111', border: '1px solid #333', borderRadius: '8px',
    color: '#fff', fontSize: '0.95rem', padding: '10px 12px', outline: 'none',
    boxSizing: 'border-box',
  },
  btn: {
    width: '100%', background: '#d946ef', border: 'none', borderRadius: '8px',
    color: '#fff', fontSize: '0.9rem', fontWeight: 600, padding: '12px',
    cursor: 'pointer', marginTop: '16px',
  },
  success: { color: '#4ade80', fontSize: '0.8rem', marginTop: '8px', textAlign: 'center' },
  error: { color: '#ef4444', fontSize: '0.8rem', marginTop: '8px', textAlign: 'center' },

  invoiceList: { background: '#1a1a1a', borderRadius: '12px', overflow: 'hidden' },
  invoiceRow: {
    display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px',
    borderBottom: '1px solid #252525', background: 'none', border: 'none',
    borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: '#252525',
    cursor: 'pointer', width: '100%', textAlign: 'left',
  },
  invoiceWeek: { color: '#fff', fontSize: '0.9rem', fontWeight: 600 },
  invoiceMeta: { color: '#888', fontSize: '0.75rem', marginTop: '2px' },
  invoiceAmount: { color: '#fff', fontSize: '0.95rem', fontWeight: 700, marginBottom: '2px' },
  invoiceDetail: { background: '#111', padding: '8px 16px' },
  lineRow: { display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #1e1e1e' },

  accountRow: { color: '#ccc', fontSize: '0.85rem', margin: '0 0 8px' },
  accountLabel: { color: '#666', display: 'inline-block', width: '60px', fontSize: '0.75rem', fontWeight: 600 },

  muted: { color: '#666', textAlign: 'center', paddingTop: '40px' },
};
