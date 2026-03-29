import { useState, useEffect } from 'react';
import { useAdmin } from './AdminContext.jsx';
import api from '../../lib/api.js';
import { s, colors } from './styles.js';

export default function MessageList() {
  const { token } = useAdmin();
  const [messages, setMessages] = useState([]);
  const [unread, setUnread] = useState(0);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [filter, setFilter] = useState('unread'); // 'all', 'unread', 'read'
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => { load(); }, [page, filter]);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({ action: 'messages', page, limit: '20' });
    if (filter === 'unread') params.set('read', 'false');
    if (filter === 'read') params.set('read', 'true');

    const res = await api(`/api/admin?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setMessages(data.messages || []);
    setUnread(data.unread || 0);
    setTotal(data.total || 0);
    setPage(data.page || 1);
    setPages(data.pages || 1);
    setLoading(false);
  }

  async function markRead(id) {
    await api('/api/admin?action=message-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id }),
    });
    setMessages(prev => prev.map(m => m.id === id ? { ...m, read: true } : m));
    setUnread(prev => Math.max(0, prev - 1));
  }

  function toggleExpand(msg) {
    if (expanded === msg.id) {
      setExpanded(null);
    } else {
      setExpanded(msg.id);
      if (!msg.read) markRead(msg.id);
    }
  }

  const filters = [
    { key: 'unread', label: `Unread${unread ? ` (${unread})` : ''}` },
    { key: 'all', label: 'All' },
    { key: 'read', label: 'Read' },
  ];

  return (
    <div>
      <div style={s.header}>
        <h1 style={s.h1}>Messages</h1>
      </div>

      <div style={s.filterBar}>
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => { setFilter(f.key); setPage(1); }}
            style={{ ...s.filterTab, ...(filter === f.key ? s.filterTabActive : {}) }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: colors.muted }}>Loading...</p>
      ) : messages.length === 0 ? (
        <p style={{ color: colors.muted }}>No messages</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {messages.map(msg => (
            <div
              key={msg.id}
              onClick={() => toggleExpand(msg)}
              style={{
                ...s.card,
                cursor: 'pointer',
                borderLeft: msg.read ? '3px solid transparent' : `3px solid ${colors.accent}`,
                opacity: msg.read ? 0.7 : 1,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: expanded === msg.id ? 12 : 0 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  {!msg.read && <span style={dot} />}
                  <div>
                    <span style={{ color: colors.white, fontWeight: 600, fontSize: '0.9rem' }}>
                      {msg.name || 'Anonymous'}
                    </span>
                    <span style={{ color: colors.muted, fontSize: '0.8rem', marginLeft: 8 }}>
                      {msg.source}
                    </span>
                  </div>
                </div>
                <span style={{ color: colors.dim, fontSize: '0.75rem' }}>
                  {new Date(msg.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {expanded === msg.id ? (
                <div style={{ marginTop: 8 }}>
                  <p style={{ color: colors.white, fontSize: '0.9rem', lineHeight: 1.6, margin: '0 0 12px', whiteSpace: 'pre-wrap' }}>
                    {msg.message}
                  </p>
                  <div style={{ display: 'flex', gap: 16, fontSize: '0.8rem', color: colors.muted }}>
                    {msg.email && <span>Email: {msg.email}</span>}
                    {msg.phone && <span>Phone: {msg.phone}</span>}
                  </div>
                </div>
              ) : (
                <p style={{ color: colors.muted, fontSize: '0.85rem', margin: '4px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {msg.message}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div style={s.pagination}>
          <button style={s.btnOutline} onClick={() => setPage(p => p - 1)} disabled={page <= 1}>Prev</button>
          <span style={{ color: colors.muted, fontSize: '0.85rem' }}>{page} / {pages}</span>
          <button style={s.btnOutline} onClick={() => setPage(p => p + 1)} disabled={page >= pages}>Next</button>
        </div>
      )}
    </div>
  );
}

const dot = {
  width: 8,
  height: 8,
  borderRadius: '50%',
  background: colors.accent,
  flexShrink: 0,
};
