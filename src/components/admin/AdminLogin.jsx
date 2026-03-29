import { useState, useEffect } from 'react';
import { startAuthentication } from '@simplewebauthn/browser';
import api from '../../lib/api.js';
import { colors } from './styles.js';

export default function AdminLogin({ onLogin }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [hasBiometric, setHasBiometric] = useState(false);
  const [checkingBio, setCheckingBio]   = useState(true);

  // Check if biometric credentials exist
  useEffect(() => {
    api('/api/admin-auth?action=webauthn-auth-options')
      .then(r => {
        if (r.ok) setHasBiometric(true);
        // 404 = no credentials registered, that's fine
      })
      .catch(() => {})
      .finally(() => setCheckingBio(false));
  }, []);

  // Auto-trigger biometric on load if available
  useEffect(() => {
    if (hasBiometric && !checkingBio) biometricLogin();
  }, [hasBiometric, checkingBio]);

  async function biometricLogin() {
    setError('');
    setLoading(true);
    try {
      // Get fresh challenge options
      const optRes = await api('/api/admin-auth?action=webauthn-auth-options');
      if (!optRes.ok) throw new Error('Biometric not available');
      const options = await optRes.json();

      // Prompt biometric
      const credential = await startAuthentication({ optionsJSON: options });

      // Verify with server
      const verRes = await api('/api/admin-auth?action=webauthn-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credential),
      });
      const data = await verRes.json();
      if (!verRes.ok) throw new Error(data.error || 'Biometric auth failed');

      localStorage.setItem('admin_token', data.token);
      onLogin(data.admin);
    } catch (err) {
      // User cancelled or biometric failed — show password form
      if (err.name !== 'NotAllowedError') {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

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
      localStorage.setItem('admin_token', data.token);
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
          <span style={{ fontSize: '2.5rem' }}>⚙️</span>
          <h1 style={styles.logoText}>Admin Portal</h1>
        </div>

        {/* Biometric button */}
        {hasBiometric && (
          <div style={{ marginBottom: '20px', textAlign: 'center' }}>
            <button
              onClick={biometricLogin}
              disabled={loading}
              style={{
                ...styles.btn,
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                opacity: loading ? 0.6 : 1,
                fontSize: '1.1rem',
                padding: '16px',
              }}
            >
              <span style={{ fontSize: '1.3rem' }}>🔐</span>
              {loading ? 'Authenticating...' : 'Sign in with biometric'}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '16px 0' }}>
              <div style={{ flex: 1, height: '1px', background: colors.border }} />
              <span style={{ color: colors.dim, fontSize: '0.75rem' }}>OR USE PASSWORD</span>
              <div style={{ flex: 1, height: '1px', background: colors.border }} />
            </div>
          </div>
        )}

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
