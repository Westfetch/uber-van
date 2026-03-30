import { useState } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import api from '../lib/api.js';
import { getTokenSync, removeToken } from '../lib/tokenStore.js';

export default function BiometricSetup({ onComplete, onFail }) {
  const [status, setStatus] = useState('idle'); // idle | registering | error
  const [error, setError]   = useState('');

  async function handleRegister() {
    setStatus('registering');
    setError('');
    const token = getTokenSync('driver_token');

    try {
      // Phase 1: get registration options
      const optRes = await api('/api/driver-auth?action=webauthn-register&phase=options', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!optRes.ok) throw new Error('Failed to start registration');
      const options = await optRes.json();

      // Phase 2: prompt device biometric
      const credential = await startRegistration({ optionsJSON: options });

      // Phase 3: verify with server
      const verRes = await api('/api/driver-auth?action=webauthn-register&phase=verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(credential),
      });
      if (!verRes.ok) throw new Error('Registration verification failed');

      onComplete();
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        // User cancelled the biometric prompt
        setStatus('error');
        setError('Device authentication is required to use this app.');
      } else {
        setStatus('error');
        setError(err.message || 'Registration failed. Please try again.');
      }
    }
  }

  function handleBack() {
    removeToken('driver_token');
    localStorage.removeItem('driver_name');
    onFail();
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.iconWrap}>
          <span style={styles.icon}>🔐</span>
        </div>
        <h1 style={styles.heading}>Set up device unlock</h1>
        <p style={styles.sub}>
          Use your fingerprint, face, or screen lock to sign in securely in the future.
        </p>

        {error && <p style={styles.error}>{error}</p>}

        <button
          style={{ ...styles.btn, opacity: status === 'registering' ? 0.6 : 1 }}
          disabled={status === 'registering'}
          onClick={handleRegister}
        >
          {status === 'registering' ? 'Waiting for device...' : status === 'error' ? 'Try again' : 'Continue'}
        </button>

        {status === 'error' && (
          <button style={styles.backBtn} onClick={handleBack}>
            Back to login
          </button>
        )}
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
    padding: '40px 24px',
    width: '100%',
    maxWidth: '380px',
    textAlign: 'center',
  },
  iconWrap: { marginBottom: '16px' },
  icon: { fontSize: '3rem' },
  heading: {
    margin: '0 0 12px',
    fontSize: '1.3rem',
    fontWeight: 700,
    color: '#fff',
  },
  sub: {
    color: '#888',
    fontSize: '0.9rem',
    lineHeight: 1.5,
    margin: '0 0 28px',
  },
  error: {
    color: '#f87171',
    fontSize: '0.85rem',
    margin: '0 0 16px',
  },
  btn: {
    background: '#d946ef',
    border: 'none',
    borderRadius: '10px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: 700,
    padding: '14px',
    width: '100%',
    transition: 'opacity 0.15s',
  },
  backBtn: {
    background: 'transparent',
    border: '1px solid #333',
    borderRadius: '10px',
    color: '#888',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: 600,
    marginTop: '12px',
    padding: '12px',
    width: '100%',
  },
};
