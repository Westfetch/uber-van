import { useState } from 'react';
import api from '../../lib/api.js';
import { setToken } from '../../lib/tokenStore.js';
import { enableBiometric } from '../../lib/nativeBiometric.js';
import { colors } from './styles.js';
import AdminIcon from '../icons/AdminIcon.jsx';

export default function AdminLogin({ onLogin }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api('/api/admin-auth', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      await setToken('admin_token', data.token);
      enableBiometric();
      onLogin(data.admin);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>
          <AdminIcon size={48} />
          <h1 style={styles.logoText}>Admin Portal</h1>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>Email</label>
          <input
            style={styles.input}
            type="email"
            placeholder="admin@ubervan.co.uk"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
            required
          />

          <label style={styles.label}>Password</label>
          <input
            style={styles.input}
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />

          {error && <p style={styles.error}>{error}</p>}

          <button style={{ ...styles.btn, opacity: loading ? 0.6 : 1 }} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100dvh',
    background: colors.bg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
  },
  card: {
    background: colors.card,
    borderRadius: '16px',
    padding: '32px 24px',
    width: '100%',
    maxWidth: '380px',
  },
  logo: {
    textAlign: 'center',
    marginBottom: '28px',
  },
  logoText: {
    margin: '8px 0 0',
    fontSize: '1.3rem',
    fontWeight: 700,
    color: colors.white,
  },
  form: { display: 'flex', flexDirection: 'column', gap: '8px' },
  label: {
    color: colors.muted,
    fontSize: '0.8rem',
    fontWeight: 600,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
  input: {
    background: colors.input,
    border: `1px solid ${colors.border}`,
    borderRadius: '10px',
    color: colors.white,
    fontSize: '1rem',
    padding: '12px 14px',
    marginBottom: '12px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  error: { color: colors.error, fontSize: '0.85rem', margin: '0 0 8px' },
  btn: {
    background: colors.accent,
    border: 'none',
    borderRadius: '10px',
    color: colors.white,
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: 700,
    marginTop: '4px',
    padding: '14px',
    transition: 'opacity 0.15s',
  },
};
