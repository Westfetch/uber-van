import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { startRegistration } from '@simplewebauthn/browser';
import { AdminProvider } from './AdminContext.jsx';
import AdminLogin from './AdminLogin.jsx';
import JobPipeline from './JobPipeline.jsx';
import JobDetail from './JobDetail.jsx';
import DriverList from './DriverList.jsx';
import DriverForm from './DriverForm.jsx';
import DriverDetail from './DriverDetail.jsx';
import PayoutList from './PayoutList.jsx';
import { s, colors } from './styles.js';

const NAV = [
  { path: '/admin/jobs',    label: 'Jobs' },
  { path: '/admin/drivers', label: 'Drivers' },
  { path: '/admin/payouts', label: 'Payouts' },
];

export default function AdminShell() {
  const [admin, setAdmin]         = useState(null);
  const [checking, setChecking]   = useState(true);
  const [hasWebAuthn, setHasWebAuthn] = useState(false);
  const [bioStatus, setBioStatus] = useState(''); // '', 'registering', 'done', 'error'
  const navigate                  = useNavigate();
  const location                  = useLocation();

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) { setChecking(false); return; }

    fetch('/api/admin-auth', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.admin) {
          setAdmin(data.admin);
          setHasWebAuthn(!!data.hasWebAuthn);
        } else {
          localStorage.removeItem('admin_token');
        }
      })
      .catch(() => localStorage.removeItem('admin_token'))
      .finally(() => setChecking(false));
  }, []);

  function logout() {
    localStorage.removeItem('admin_token');
    setAdmin(null);
  }

  if (checking) return (
    <div style={{ background: colors.bg, minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: '2rem' }}>⚙️</span>
    </div>
  );

  if (!admin) {
    if (location.pathname !== '/admin/login') return <Navigate to="/admin/login" replace />;
    return <AdminLogin onLogin={setAdmin} />;
  }

  if (location.pathname === '/admin/login') return <Navigate to="/admin/jobs" replace />;

  return (
    <AdminProvider value={{ admin, token: localStorage.getItem('admin_token'), logout }}>
      <div style={s.page}>
        {/* Sidebar */}
        <nav style={s.sidebar}>
          <div style={s.sidebarLogo}>
            <span style={{ fontSize: '1.5rem' }}>⚙️</span>
            <p style={s.sidebarLogoText}>Admin</p>
          </div>
          {NAV.map(n => {
            const active = location.pathname.startsWith(n.path);
            return (
              <button
                key={n.path}
                onClick={() => navigate(n.path)}
                style={{
                  ...s.navLink,
                  ...(active ? s.navLinkActive : {}),
                }}
              >
                {n.label}
              </button>
            );
          })}
          <div style={{ flex: 1 }} />
          <div style={{ padding: '0 20px' }}>
            <p style={{ color: colors.muted, fontSize: '0.75rem', margin: '0 0 6px' }}>{admin.name}</p>
            {!hasWebAuthn && (
              <button
                onClick={async () => {
                  setBioStatus('registering');
                  try {
                    const token = localStorage.getItem('admin_token');
                    // Get registration options
                    const optRes = await fetch('/api/admin-auth?action=webauthn-register&phase=options', {
                      method: 'POST',
                      headers: { Authorization: `Bearer ${token}` },
                    });
                    if (!optRes.ok) throw new Error('Failed to get options');
                    const options = await optRes.json();

                    // Prompt biometric
                    const credential = await startRegistration({ optionsJSON: options });

                    // Send to server
                    const verRes = await fetch('/api/admin-auth?action=webauthn-register&phase=verify', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                      body: JSON.stringify(credential),
                    });
                    if (!verRes.ok) throw new Error('Registration failed');

                    setHasWebAuthn(true);
                    setBioStatus('done');
                  } catch (err) {
                    setBioStatus('error');
                    setTimeout(() => setBioStatus(''), 3000);
                  }
                }}
                disabled={bioStatus === 'registering'}
                style={{
                  ...s.btnSmall,
                  width: '100%',
                  marginBottom: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  opacity: bioStatus === 'registering' ? 0.6 : 1,
                }}
              >
                🔐 {bioStatus === 'registering' ? 'Setting up...' : 'Set up biometric'}
              </button>
            )}
            {hasWebAuthn && bioStatus !== 'done' && (
              <p style={{ color: '#4ade80', fontSize: '0.7rem', margin: '0 0 6px', textAlign: 'center' }}>🔐 Biometric active</p>
            )}
            {bioStatus === 'done' && (
              <p style={{ color: '#4ade80', fontSize: '0.7rem', margin: '0 0 6px', textAlign: 'center' }}>🔐 Biometric registered!</p>
            )}
            {bioStatus === 'error' && (
              <p style={{ color: colors.error, fontSize: '0.7rem', margin: '0 0 6px', textAlign: 'center' }}>Setup failed — try again</p>
            )}
            <button onClick={logout} style={{ ...s.btnSmall, background: 'transparent', border: `1px solid ${colors.border}`, color: colors.muted, width: '100%' }}>
              Log out
            </button>
          </div>
        </nav>

        {/* Content */}
        <main style={s.content}>
          <Routes>
            <Route index element={<Navigate to="/admin/jobs" replace />} />
            <Route path="login" element={<Navigate to="/admin/jobs" replace />} />
            <Route path="jobs" element={<JobPipeline />} />
            <Route path="jobs/:jobId" element={<JobDetail />} />
            <Route path="drivers" element={<DriverList />} />
            <Route path="drivers/new" element={<DriverForm />} />
            <Route path="drivers/:driverId" element={<DriverDetail />} />
            <Route path="payouts" element={<PayoutList />} />
            <Route path="*" element={<Navigate to="/admin/jobs" replace />} />
          </Routes>
        </main>
      </div>
    </AdminProvider>
  );
}
