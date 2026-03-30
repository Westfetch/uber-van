import { useState, useEffect } from 'react';
import { startAuthentication } from '@simplewebauthn/browser';
import api from '../lib/api.js';
import { setToken } from '../lib/tokenStore.js';
import VanIcon from './icons/VanIcon.jsx';

export default function DriverLogin({ onLogin }) {
  const [name, setName]           = useState('');
  const [setupCode, setSetupCode] = useState('');
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);

  // Biometric state
  const [bioChecking, setBioChecking] = useState(true);
  const [hasBiometric, setHasBiometric] = useState(false);
  const [bioError, setBioError]   = useState('');

  // "Locked out?" support form
  const [showSupport, setShowSupport] = useState(false);
  const [supportName, setSupportName] = useState('');
  const [supportMsg, setSupportMsg]   = useState("I'm locked out and need a new setup code.");
  const [supportSent, setSupportSent] = useState(false);
  const [supportLoading, setSupportLoading] = useState(false);

  // On mount: check if this device has a stored driver name with biometric
  useEffect(() => {
    const storedName = localStorage.getItem('driver_name');
    if (!storedName) { setBioChecking(false); return; }

    setSupportName(storedName);
    api(`/api/driver-auth?action=webauthn-auth-options&name=${encodeURIComponent(storedName)}`)
      .then(r => {
        if (r.ok) {
          setHasBiometric(true);
          return r.json().then(opts => tryBiometricLogin(opts));
        }
        setBioChecking(false);
      })
      .catch(() => setBioChecking(false));
  }, []);

  async function tryBiometricLogin(options) {
    try {
      const driverId = options.driverId;
      const credential = await startAuthentication({ optionsJSON: options });

      const res = await api('/api/driver-auth?action=webauthn-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...credential, driverId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Biometric login failed');

      await setToken('driver_token', data.token);
      onLogin(data.driver, { needsBioSetup: false });
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        // User cancelled — fall through to show login form
        setBioError('');
      } else {
        setBioError(err.message);
      }
      setBioChecking(false);
    }
  }

  async function retryBiometric() {
    setBioError('');
    setBioChecking(true);
    const storedName = localStorage.getItem('driver_name');
    try {
      const r = await api(`/api/driver-auth?action=webauthn-auth-options&name=${encodeURIComponent(storedName)}`);
      if (!r.ok) throw new Error('Failed to get challenge');
      const opts = await r.json();
      await tryBiometricLogin(opts);
    } catch (err) {
      setBioError(err.message);
      setBioChecking(false);
    }
  }

  // Setup code login
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
      await setToken('driver_token', data.token);
      localStorage.setItem('driver_name', name.trim());
      onLogin(data.driver, { needsBioSetup: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Support message
  async function handleSupportSubmit(e) {
    e.preventDefault();
    setSupportLoading(true);
    try {
      const res = await api('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'driver-support',
          name: supportName.trim(),
          message: supportMsg.trim(),
        }),
      });
      if (!res.ok) throw new Error('Failed to send');
      setSupportSent(true);
    } catch {
      setSupportSent(false);
    } finally {
      setSupportLoading(false);
    }
  }

  // Loading / checking biometric
  if (bioChecking) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.logo}>
            <VanIcon size={48} />
            <h1 style={styles.logoText}>Driver Portal</h1>
          </div>
          <p style={{ color: '#888', textAlign: 'center', fontSize: '0.9rem' }}>Checking device authentication...</p>
        </div>
      </div>
    );
  }

  // Biometric login screen (driver has registered biometric, token expired)
  if (hasBiometric) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.logo}>
            <VanIcon size={48} />
            <h1 style={styles.logoText}>Driver Portal</h1>
          </div>

          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '3rem' }}>🔐</span>
            <p style={{ color: '#888', fontSize: '0.9rem', margin: '16px 0 24px' }}>
              Tap below to sign in with your device unlock.
            </p>

            {bioError && <p style={styles.error}>{bioError}</p>}

            <button style={styles.btn} onClick={retryBiometric}>
              Sign in with device unlock
            </button>

            <button
              style={{ ...styles.linkBtn, marginTop: '20px' }}
              onClick={() => { setHasBiometric(false); }}
            >
              Use setup code instead
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Setup code login form (first-time or fallback)
  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>
          <VanIcon size={48} />
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

        {/* Locked out? Support message */}
        <div style={styles.supportSection}>
          {!showSupport ? (
            <button style={styles.linkBtn} onClick={() => setShowSupport(true)}>
              Locked out? Message support
            </button>
          ) : supportSent ? (
            <p style={{ color: '#4ade80', fontSize: '0.85rem', textAlign: 'center', margin: 0 }}>
              Message sent — we'll get back to you with a new setup code.
            </p>
          ) : (
            <form onSubmit={handleSupportSubmit} style={styles.form}>
              <label style={styles.label}>Your name</label>
              <input
                style={styles.input}
                type="text"
                placeholder="Your name"
                value={supportName}
                onChange={e => setSupportName(e.target.value)}
                required
              />
              <label style={styles.label}>Message</label>
              <textarea
                style={{ ...styles.input, minHeight: '60px', resize: 'vertical', fontFamily: 'inherit' }}
                value={supportMsg}
                onChange={e => setSupportMsg(e.target.value)}
                required
              />
              <button
                style={{ ...styles.btn, background: '#555', opacity: supportLoading ? 0.6 : 1 }}
                disabled={supportLoading}
              >
                {supportLoading ? 'Sending...' : 'Send message'}
              </button>
            </form>
          )}
        </div>
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
  linkBtn: {
    background: 'transparent',
    border: 'none',
    color: '#d946ef',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 600,
    padding: '8px',
    textDecoration: 'underline',
    width: '100%',
  },
  supportSection: {
    marginTop: '16px',
    paddingTop: '16px',
    borderTop: '1px solid #252525',
    textAlign: 'center',
  },
};
