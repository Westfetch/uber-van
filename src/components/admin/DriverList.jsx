import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from './AdminContext.jsx';
import api from '../../lib/api.js';
import { exportCSV } from './exportCSV.js';
import { s, colors, statusColors } from './styles.js';
import { getVanLabel } from '../../lib/vanConfig.js';

export default function DriverList() {
  const { token }  = useAdmin();
  const navigate    = useNavigate();
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/api/admin?action=drivers', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : { drivers: [] })
      .then(data => setDrivers(data.drivers))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div>
      <div style={s.header}>
        <h1 style={s.h1}>Drivers</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button style={s.btnOutline} onClick={() => exportCSV('drivers', token)}>Export CSV</button>
          <button style={s.btn} onClick={() => navigate('/admin/drivers/new')}>Add driver</button>
        </div>
      </div>

      <div style={s.card}>
        {loading ? (
          <p style={{ color: colors.muted, textAlign: 'center', padding: '20px' }}>Loading...</p>
        ) : drivers.length === 0 ? (
          <p style={{ color: colors.muted, textAlign: 'center', padding: '20px' }}>No drivers</p>
        ) : (
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Name</th>
                <th style={s.th}>Phone</th>
                <th style={s.th}>Van</th>
                <th style={s.th}>Depot</th>
                <th style={s.th}>Status</th>
                <th style={s.th}>Approval</th>
                <th style={s.th}>Rating</th>
                <th style={s.th}>Jobs</th>
                <th style={s.th}>Earned</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map(d => (
                <tr
                  key={d.id}
                  style={s.trClickable}
                  onClick={() => navigate(`/admin/drivers/${d.id}`)}
                  onMouseEnter={e => e.currentTarget.style.background = '#1e1e1e'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={s.td}>{d.name}</td>
                  <td style={{ ...s.td, color: colors.muted }}>{d.phone || '-'}</td>
                  <td style={s.td}>{getVanLabel(d.van_size)}</td>
                  <td style={{ ...s.td, color: colors.muted }}>{d.depot_postcode}</td>
                  <td style={s.td}>
                    <span style={{
                      display: 'inline-block',
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: d.online ? '#4ade80' : '#555',
                      marginRight: '6px',
                    }} />
                    {d.online ? 'Online' : 'Offline'}
                  </td>
                  <td style={s.td}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 10px',
                      borderRadius: '999px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      background: (statusColors[d.approval_status] || '#555') + '22',
                      color: statusColors[d.approval_status] || '#555',
                      textTransform: 'capitalize',
                    }}>
                      {d.approval_status || 'pending'}
                    </span>
                  </td>
                  <td style={{ ...s.td, color: d.rating ? colors.white : colors.muted }}>
                    {d.rating ? `${Number(d.rating).toFixed(1)} (${d.rating_count})` : '-'}
                  </td>
                  <td style={s.td}>{d.job_count || 0}</td>
                  <td style={s.td}>£{Number(d.total_earned || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
