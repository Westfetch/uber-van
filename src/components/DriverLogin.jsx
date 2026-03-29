import { useState } from 'react';
import api from '../lib/api.js';

export default function DriverLogin({ onLogin }) {
  const [name, setName]           = useState('');
  const [setupCode, setSetupCode] = useState('');
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api('/api/driver-auth', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: name.trim(), setupCode: setupCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      localStorage.setItem('driver_token', data.token);
      onLogin(data.driver);
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
          <span style={styles.logoIcon}>🚐</span>
          <h1 style={styles.logoText}>Driver Portal</h1>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>Your name</label>
          <input
            style={styles.input}
            type="text"
            placeholder="Joe"
            value={name}
            onChange={e => setName(e.target.value)}
            autoCapitalize="words"
            required
          />

          <label style={styles.label}>Setup code</label>
          <input
            style={styles.input}
            type="text"
            placeholder="ABC123XYZ"
            value={setupCode}
            onChange={e => setSetupCode(e.target.value.toUpperCase())}
            autoCapitalize="characters"
            autoComplete="off"
            required
          />

          {error && <p style={styles.error}>{error}</p>}

          <button style={{ ...styles.btn, opacity: loading ? 0.6 : 1 }} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p style={styles.hint}>Your setup code is sent to you by the platform. One-time use.</p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100dvh',
    background: '#0a0a0a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
  },
  card: {
    background: '#1a1a1a',
    borderRadius: '16px',
    padding: '32px 24px',
    width: '100%',
    maxWidth: '380px',
  },
  logo: {
    textAlign: 'center',
    marginBottom: '28px',
  },
  logoIcon: { fontSize: '2.5rem' },
  logoText: {
    margin: '8px 0 0',
    fontSize: '1.3rem',
    fontWeight: 700,
    color: '#fff',
  },
  form: { display: 'flex', flexDirection: 'column', gap: '8px' },
  label: { color: '#aaa', fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' },
  input: {
    background: '#252525',
    border: '1px solid #333',
    borderRadius: '10px',
    color: '#fff',
    fontSize: '1rem',
    padding: '12px 14px',
    marginBottom: '12px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  error: { color: '#f87171', fontSize: '0.85rem', margin: '0 0 8px' },
  btn: {
    background: '#d946ef',
    border: 'none',
    borderRadius: '10px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: 700,
    marginTop: '4px',
    padding: '14px',
    transition: 'opacity 0.15s',
  },
  hint: { color: '#555', fontSize: '0.75rem', textAlign: 'center', marginTop: '20px' },
};
