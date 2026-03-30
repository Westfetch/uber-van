// DriverShell — bottom tab bar wrapper for driver app.
// Tabs: Home, Jobs (board), Referrals (owner only), Settings.

import { useState } from 'react';
import DriverDashboard from './DriverDashboard.jsx';
import DriverSettings from './DriverSettings.jsx';
import JobBoard from './JobBoard.jsx';
import ReferralDashboard from './ReferralDashboard.jsx';

export default function DriverShell({ driver, onLogout, onDriverUpdate }) {
  const [tab, setTab] = useState('home');
  const isOwner = driver?.driver_type === 'owner';

  function renderTab() {
    switch (tab) {
      case 'home':      return <DriverDashboard driver={driver} onLogout={onLogout} onDriverUpdate={onDriverUpdate} />;
      case 'jobs':      return <JobBoard driver={driver} />;
      case 'referrals': return <ReferralDashboard driver={driver} />;
      case 'settings':  return <DriverSettings driver={driver} onLogout={onLogout} onDriverUpdate={onDriverUpdate} />;
      default:          return null;
    }
  }

  return (
    <div style={{ position: 'relative', minHeight: '100dvh' }}>
      {renderTab()}

      {/* Bottom tab bar */}
      <nav style={s.tabBar}>
        <button
          style={{ ...s.tab, color: tab === 'home' ? '#d946ef' : '#666' }}
          onClick={() => setTab('home')}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <span style={s.tabLabel}>Home</span>
        </button>

        <button
          style={{ ...s.tab, color: tab === 'jobs' ? '#d946ef' : '#666' }}
          onClick={() => setTab('jobs')}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
            <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
          </svg>
          <span style={s.tabLabel}>Jobs</span>
        </button>

        {isOwner && (
          <button
            style={{ ...s.tab, color: tab === 'referrals' ? '#d946ef' : '#666' }}
            onClick={() => setTab('referrals')}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
            </svg>
            <span style={s.tabLabel}>Referrals</span>
          </button>
        )}

        <button
          style={{ ...s.tab, color: tab === 'settings' ? '#d946ef' : '#666' }}
          onClick={() => setTab('settings')}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
          <span style={s.tabLabel}>Settings</span>
        </button>
      </nav>
    </div>
  );
}

const s = {
  tabBar: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    background: '#111',
    borderTop: '1px solid #1e1e1e',
    display: 'flex',
    justifyContent: 'space-around',
    padding: '8px 0 env(safe-area-inset-bottom, 8px)',
    zIndex: 100,
  },
  tab: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2px',
    padding: '4px 24px',
    transition: 'color 0.15s',
  },
  tabLabel: {
    fontSize: '0.65rem',
    fontWeight: 600,
    letterSpacing: '0.03em',
  },
};
