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
import { setupPush } from './lib/push.js';

const IS_ADMIN_APP = import.meta.env.VITE_APP_MODE === 'admin';

export default function App() {
  const [driver, setDriver]   = useState(null);
  const [checking, setChecking] = useState(true);

  // On mount: verify stored token
  useEffect(() => {
    const token = localStorage.getItem('driver_token');
    if (!token) { setChecking(false); return; }

    api('/api/driver-auth', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.driver) { setDriver(data.driver); setupPush(); }
        else localStorage.removeItem('driver_token');
      })
      .catch(() => localStorage.removeItem('driver_token'))
      .finally(() => setChecking(false));
  }, []);

  if (checking) return (
    <div style={{ background: '#0a0a0a', minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: '2rem' }}>🚐</span>
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
          driver ? <Navigate to="/" replace /> : <DriverLogin onLogin={d => { setDriver(d); setupPush(); }} />
        } />
        <Route path="/" element={
          IS_ADMIN_APP
            ? <Navigate to="/admin" replace />
            : driver
              ? <DriverShell driver={driver} onLogout={() => setDriver(null)} onDriverUpdate={u => setDriver(d => ({ ...d, ...u }))} />
              : <Navigate to="/login" replace />
        } />
        <Route path="*" element={<Navigate to={IS_ADMIN_APP ? "/admin" : "/"} replace />} />
      </Routes>
    </BrowserRouter>
  );
}
