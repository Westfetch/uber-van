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
  const [filter, setFilter] = useState('unread');
  const [sort, setSort] = useState('newest');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  // Reply state
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);
  const [replyMsg, setReplyMsg] = useState('');
  const [replies, setReplies] = useState({});

  useEffect(() => { load(); }, [page, filter, sort, search]);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({ action: 'messages', page, limit: '20', sort });
    if (filter === 'unread') params.set('read', 'false');
    if (filter === 'read') params.set('read', 'true');
    if (search) params.set('search', search);

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

  async function loadReplies(messageId) {
    const res = await api(`/api/admin?action=message-replies&message_id=${messageId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setReplies(prev => ({ ...prev, [messageId]: data.replies || [] }));
  }

  function toggleExpand(msg) {
    if (expanded === msg.id) {
      setExpanded(null);
      setReplyText('');
      setReplyMsg('');
    } else {
      setExpanded(msg.id);
      setReplyText('');
      setReplyMsg('');
      if (!msg.read) markRead(msg.id);
      loadReplies(msg.id);
    }
  }

  async function sendReply(msg, via) {
    setReplying(true);
    setReplyMsg('');
    try {
      const res = await api('/api/admin?action=message-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message_id: msg.id, reply_text: replyText, via }),
      });
      const data = await res.json();
      if (res.ok) {
        setReplyMsg(data.errors ? `Sent with issues: ${data.errors.join(', ')}` : 'Reply sent!');
        setReplyText('');
        loadReplies(msg.id);
        setTimeout(() => setReplyMsg(''), 3000);
      } else {
        setReplyMsg(data.error || 'Failed to send');
      }
    } catch {
      setReplyMsg('Failed to send');
    } finally {
      setReplying(false);
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

      <div style={{ ...s.filterBar, marginBottom: '16px' }}>
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => { setFilter(f.key); setPage(1); }}
            style={{ ...s.filterTab, ...(filter === f.key ? s.filterTabActive : {}) }}
          >
            {f.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setSort(sort === 'newest' ? 'oldest' : 'newest')}
          style={s.btnOutline}
        >
          {sort === 'newest' ? 'Newest first' : 'Oldest first'}
        </button>
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          style={{ ...s.input, width: '180px', padding: '6px 12px', fontSize: '0.85rem' }}
        />
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
                <div style={{ marginTop: 8 }} onClick={e => e.stopPropagation()}>
                  <p style={{ color: colors.white, fontSize: '0.9rem', lineHeight: 1.6, margin: '0 0 12px', whiteSpace: 'pre-wrap' }}>
                    {msg.message}
                  </p>
                  <div style={{ display: 'flex', gap: 16, fontSize: '0.8rem', color: colors.muted, marginBottom: 12 }}>
                    {msg.email && <span>Email: {msg.email}</span>}
                    {msg.phone && <span>Phone: {msg.phone}</span>}
                  </div>

                  {/* Previous replies */}
                  {replies[msg.id]?.length > 0 && (
                    <div style={{ marginBottom: 12, borderTop: `1px solid ${colors.border}`, paddingTop: 8 }}>
                      <p style={{ ...s.label, margin: '0 0 8px' }}>Previous replies</p>
                      {replies[msg.id].map(r => (
                        <div key={r.id} style={{ marginBottom: 8, padding: '8px 12px', background: colors.input, borderRadius: '8px' }}>
                          <p style={{ color: colors.white, fontSize: '0.85rem', margin: '0 0 4px', whiteSpace: 'pre-wrap' }}>{r.reply_text}</p>
                          <span style={{ color: colors.dim, fontSize: '0.7rem' }}>
                            via {r.sent_via} — {new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Reply form */}
                  {(msg.email || msg.phone) && (
                    <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: 12 }}>
                      <textarea
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        rows={3}
                        placeholder="Type your reply..."
                        style={{ ...s.input, resize: 'vertical', fontFamily: 'inherit', marginBottom: 8 }}
                      />
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        {msg.email && (
                          <button
                            style={{ ...s.btnSmall, opacity: replying || !replyText ? 0.5 : 1 }}
                            disabled={replying || !replyText}
                            onClick={() => sendReply(msg, 'email')}
                          >
                            Reply via Email
                          </button>
                        )}
                        {msg.phone && (
                          <button
                            style={{ ...s.btnSmall, opacity: replying || !replyText ? 0.5 : 1 }}
                            disabled={replying || !replyText}
                            onClick={() => sendReply(msg, 'sms')}
                          >
                            Reply via SMS
                          </button>
                        )}
                        {msg.email && msg.phone && (
                          <button
                            style={{ ...s.btnSmall, opacity: replying || !replyText ? 0.5 : 1 }}
                            disabled={replying || !replyText}
                            onClick={() => sendReply(msg, 'both')}
                          >
                            Reply via Both
                          </button>
                        )}
                        {replyMsg && (
                          <span style={{ fontSize: '0.8rem', color: replyMsg.includes('sent') ? '#4ade80' : colors.error }}>{replyMsg}</span>
                        )}
                      </div>
                    </div>
                  )}
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
