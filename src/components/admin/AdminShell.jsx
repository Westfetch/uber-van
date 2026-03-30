import { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import api from '../../lib/api.js';
import { getToken, removeToken, getTokenSync } from '../../lib/tokenStore.js';
import { disableBiometric } from '../../lib/nativeBiometric.js';
import AdminIcon from '../icons/AdminIcon.jsx';
import { AdminProvider } from './AdminContext.jsx';
import AdminLogin from './AdminLogin.jsx';
import JobPipeline from './JobPipeline.jsx';
import JobDetail from './JobDetail.jsx';
import DriverList from './DriverList.jsx';
import DriverForm from './DriverForm.jsx';
import DriverDetail from './DriverDetail.jsx';
import PayoutList from './PayoutList.jsx';
import InvoiceList from './InvoiceList.jsx';
import MessageList from './MessageList.jsx';
import ConfigPage from './ConfigPage.jsx';
import { s, colors } from './styles.js';

const NAV = [
  { path: '/admin/jobs',    label: 'Jobs' },
  { path: '/admin/drivers', label: 'Drivers' },
  { path: '/admin/payouts',   label: 'Payouts' },
  { path: '/admin/invoices',  label: 'Invoices' },
  { path: '/admin/messages',  label: 'Messages' },
  { path: '/admin/config',   label: 'Config' },
];

function useIsMobile() {
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = e => setMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return mobile;
}

export default function AdminShell() {
  const [admin, setAdmin]         = useState(null);
  const [checking, setChecking]   = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate                  = useNavigate();
  const location                  = useLocation();
  const isMobile                  = useIsMobile();

  // Close sidebar on navigation (mobile)
  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [location.pathname, isMobile]);

  useEffect(() => {
    getToken('admin_token').then(token => {
      if (!token) { setChecking(false); return; }

      api('/api/admin-auth', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.admin) {
            setAdmin(data.admin);
          } else {
            removeToken('admin_token');
          }
        })
        .catch(() => removeToken('admin_token'))
        .finally(() => setChecking(false));
    });
  }, []);

  function logout() {
    disableBiometric();
    removeToken('admin_token');
    setAdmin(null);
  }

  if (checking) return (
    <div style={{ background: colors.bg, minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <AdminIcon size={40} />
    </div>
  );

  if (!admin) {
    if (location.pathname !== '/admin/login') return <Navigate to="/admin/login" replace />;
    return <AdminLogin onLogin={setAdmin} />;
  }

  if (location.pathname === '/admin/login') return <Navigate to="/admin/jobs" replace />;

  const sidebarStyle = isMobile
    ? { ...s.sidebar, transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)' }
    : s.sidebar;

  return (
    <AdminProvider value={{ admin, token: getTokenSync('admin_token'), logout }}>
      <div style={s.page}>
        {/* Mobile top bar */}
        {isMobile && (
          <div style={s.mobileTopBar}>
            <button style={s.hamburger} onClick={() => setSidebarOpen(true)}>
              &#9776;
            </button>
            <AdminIcon size={20} />
            <span style={{ color: colors.white, fontWeight: 700, fontSize: '0.9rem' }}>Admin</span>
          </div>
        )}

        {/* Backdrop (mobile only) */}
        {isMobile && sidebarOpen && (
          <div style={s.sidebarBackdrop} onClick={() => setSidebarOpen(false)} />
        )}

        {/* Sidebar */}
        <nav style={sidebarStyle}>
          <div style={s.sidebarLogo}>
            <AdminIcon size={28} />
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
        <main style={isMobile ? s.contentMobile : s.content}>
          <Routes>
            <Route index element={<Navigate to="/admin/jobs" replace />} />
            <Route path="login" element={<Navigate to="/admin/jobs" replace />} />
            <Route path="jobs" element={<JobPipeline />} />
            <Route path="jobs/:jobId" element={<JobDetail />} />
            <Route path="drivers" element={<DriverList />} />
            <Route path="drivers/new" element={<DriverForm />} />
            <Route path="drivers/:driverId" element={<DriverDetail />} />
            <Route path="payouts" element={<PayoutList />} />
            <Route path="invoices" element={<InvoiceList />} />
            <Route path="messages" element={<MessageList />} />
            <Route path="config" element={<ConfigPage />} />
            <Route path="*" element={<Navigate to="/admin/jobs" replace />} />
          </Routes>
        </main>
      </div>
    </AdminProvider>
  );
}
