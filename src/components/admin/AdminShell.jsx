import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
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
  const [admin, setAdmin]       = useState(null);
  const [checking, setChecking] = useState(true);
  const navigate                = useNavigate();
  const location                = useLocation();

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) { setChecking(false); return; }

    fetch('/api/admin-auth', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.admin) setAdmin(data.admin);
        else localStorage.removeItem('admin_token');
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
