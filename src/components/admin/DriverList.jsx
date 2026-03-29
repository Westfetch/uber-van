import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from './AdminContext.jsx';
import { s, colors } from './styles.js';

export default function DriverList() {
  const { token }  = useAdmin();
  const navigate    = useNavigate();
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin-drivers', {
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
        <button style={s.btn} onClick={() => navigate('/admin/drivers/new')}>Add driver</button>
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
                  <td style={s.td}>{d.van_size}</td>
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
