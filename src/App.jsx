import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import DriverLogin from './components/DriverLogin.jsx';
import DriverShell from './components/DriverShell.jsx';
import JobOffer from './components/JobOffer.jsx';
import JobView from './components/JobView.jsx';
import AdminShell from './components/admin/AdminShell.jsx';
import BookingPortal from './components/booking/BookingPortal.jsx';
import DriverLanding from './components/DriverLanding.jsx';
import api from './lib/api.js';
import { getToken, removeToken } from './lib/tokenStore.js';
import { setupPush } from './lib/push.js';
import { disableBiometric } from './lib/nativeBiometric.js';
import VanIcon from './components/icons/VanIcon.jsx';

const IS_ADMIN_APP = import.meta.env.VITE_APP_MODE === 'admin';

export default function App() {
  const [driver, setDriver]             = useState(null);
  const [checking, setChecking]         = useState(true);

  // On mount: verify stored token (secure storage on APK, localStorage on web)
  // Skip driver auth check if we're on /admin — AdminShell handles its own auth
  useEffect(() => {
    if (window.location.pathname.startsWith('/admin')) {
      setChecking(false);
      return;
    }

    getToken('driver_token').then(token => {
      if (!token) { setChecking(false); return; }

      api('/api/driver-auth', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.driver) {
            setDriver(data.driver);
            setupPush();
          } else {
            removeToken('driver_token');
          }
        })
        .catch(() => removeToken('driver_token'))
        .finally(() => setChecking(false));
    });
  }, []);

  function handleLogin(d) {
    setDriver(d);
    setupPush();
  }

  if (checking) return (
    <div style={{ background: '#0a0a0a', minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <VanIcon size={40} />
    </div>
  );

  return (
    <BrowserRouter>
      <Routes>
        {/* Customer booking portal — public, token auth via query param */}
        <Route path="/booking/:id" element={<BookingPortal />} />

        {/* Driver onboarding landing page — public */}
        <Route path="/driver/get-started" element={<DriverLanding />} />

        {/* Admin dashboard — own auth, independent of driver state */}
        <Route path="/admin/*" element={<AdminShell />} />

        {/* Driver routes */}
        <Route path="/offer/:offerId" element={
          driver ? <JobOffer /> : <Navigate to="/login" replace />
        } />
        <Route path="/job/:jobId" element={
          driver ? <JobView /> : <Navigate to="/login" replace />
        } />
        <Route path="/login" element={
          driver ? <Navigate to="/" replace /> : <DriverLogin onLogin={handleLogin} />
        } />
        <Route path="/" element={
          IS_ADMIN_APP
            ? <Navigate to="/admin" replace />
            : driver
              ? <DriverShell driver={driver} onLogout={() => { disableBiometric(); setDriver(null); }} onDriverUpdate={u => setDriver(d => ({ ...d, ...u }))} />
              : <Navigate to="/login" replace />
        } />
        <Route path="*" element={<Navigate to={IS_ADMIN_APP ? "/admin" : "/"} replace />} />
      </Routes>
    </BrowserRouter>
  );
}
