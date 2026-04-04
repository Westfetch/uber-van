import { useState, useEffect } from 'react';
import { useAdmin } from './AdminContext.jsx';
import api from '../../lib/api.js';
import { s, colors } from './styles.js';

const ESCALATION_COLORS = {
  manual_review: '#f59e0b',
  tbc_item: '#fb923c',
  packing_request: '#60a5fa',
  unhappy_customer: '#f87171',
  large_job: '#f59e0b',
  payment_failure: '#f87171',
  general: colors.muted,
};

const ESCALATION_LABELS = {
  manual_review: 'Manual review',
  tbc_item: 'TBC item',
  packing_request: 'Packing',
  unhappy_customer: 'Unhappy',
  large_job: 'Large job',
  payment_failure: 'Payment fail',
};

const JOB_TYPE_LABELS = {
  house_move: 'House move',
  small_item: 'Small delivery',
  house_clearance: 'Clearance',
  storage_run: 'Storage',
  packing_service: 'Packing',
  office_move: 'Office',
};

const STATUS_COLORS = {
  open: '#4ade80',
  in_progress: '#f59e0b',
  resolved: '#888',
};

const STATUS_LABELS = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
};

export default function MessageList() {
  const { token } = useAdmin();
  const [messages, setMessages] = useState([]);
  const [unread, setUnread] = useState(0);
  const [escalationUnread, setEscalationUnread] = useState(0);
  const [openCount, setOpenCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [filter, setFilter] = useState('unread');
  const [source, setSource] = useState('all');
  const [statusFilter, setStatusFilter] = useState('');
  const [escTypeFilter, setEscTypeFilter] = useState('');
  const [jobTypeFilter, setJobTypeFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [sort, setSort] = useState('newest');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  // Reply state
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);
  const [replyMsg, setReplyMsg] = useState('');
  const [replies, setReplies] = useState({});

  // Chatlog state
  const [chatLogs, setChatLogs] = useState({});
  const [chatLogLoading, setChatLogLoading] = useState({});
  const [chatLogOpen, setChatLogOpen] = useState({});

  useEffect(() => { load(); }, [page, filter, source, statusFilter, escTypeFilter, jobTypeFilter, brandFilter, sort, search]);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({ action: 'messages', page, limit: '20', sort });
    if (filter === 'unread') params.set('read', 'false');
    if (filter === 'read') params.set('read', 'true');
    if (source !== 'all') params.set('source', source);
    if (statusFilter) params.set('status', statusFilter);
    if (escTypeFilter) params.set('escalation_type', escTypeFilter);
    if (jobTypeFilter) params.set('job_type', jobTypeFilter);
    if (brandFilter) params.set('brand', brandFilter);
    if (search) params.set('search', search);

    const res = await api(`/api/admin?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setMessages(data.messages || []);
    setUnread(data.unread || 0);
    setEscalationUnread(data.escalationUnread || 0);
    setOpenCount(data.openCount || 0);
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

  async function setStatus(id, status) {
    await api('/api/admin?action=message-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, status }),
    });
    setMessages(prev => prev.map(m => m.id === id ? { ...m, status, read: true } : m));
    if (status !== 'open') setUnread(prev => Math.max(0, prev - 1));
  }

  async function loadReplies(messageId) {
    const res = await api(`/api/admin?action=message-replies&message_id=${messageId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setReplies(prev => ({ ...prev, [messageId]: data.replies || [] }));
  }

  async function loadChatLog(sessionId) {
    if (chatLogs[sessionId]) {
      setChatLogOpen(prev => ({ ...prev, [sessionId]: !prev[sessionId] }));
      return;
    }
    setChatLogLoading(prev => ({ ...prev, [sessionId]: true }));
    try {
      const res = await api(`/api/admin?action=chat-log&session_id=${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setChatLogs(prev => ({ ...prev, [sessionId]: data }));
      setChatLogOpen(prev => ({ ...prev, [sessionId]: true }));
    } catch {
      setChatLogs(prev => ({ ...prev, [sessionId]: { error: true } }));
    } finally {
      setChatLogLoading(prev => ({ ...prev, [sessionId]: false }));
    }
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

  const isEscalation = (msg) => msg.source?.endsWith('-escalation');
  const getMeta = (msg) => msg.metadata || {};

  function stripDataBlocks(text) {
    return (text || '').replace(/<data>[\s\S]*?<\/data>/g, '').trim();
  }

  const sourceFilters = [
    { key: 'all', label: 'All messages' },
    { key: 'escalation', label: `Escalations${escalationUnread ? ` (${escalationUnread})` : ''}` },
    { key: 'contact', label: 'Contact forms' },
  ];

  const statusFilters = [
    { key: '', label: 'Any status' },
    { key: 'open', label: `Open${openCount ? ` (${openCount})` : ''}` },
    { key: 'in_progress', label: 'In progress' },
    { key: 'resolved', label: 'Resolved' },
  ];

  const readFilters = [
    { key: 'unread', label: `Unread${unread ? ` (${unread})` : ''}` },
    { key: 'all', label: 'All' },
    { key: 'read', label: 'Read' },
  ];

  function resetFilters() {
    setSource('all');
    setFilter('unread');
    setStatusFilter('');
    setEscTypeFilter('');
    setJobTypeFilter('');
    setBrandFilter('');
    setSearch('');
    setPage(1);
  }

  const hasActiveFilters = source !== 'all' || statusFilter || escTypeFilter || jobTypeFilter || brandFilter;

  return (
    <div>
      <div style={s.header}>
        <h1 style={s.h1}>Inbox</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {hasActiveFilters && (
            <button onClick={resetFilters} style={{ ...s.btnOutline, fontSize: '0.75rem', color: colors.error, borderColor: colors.error }}>
              Clear filters
            </button>
          )}
          <span style={{ color: colors.muted, fontSize: '0.85rem' }}>{total} result{total !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Row 1: Source tabs */}
      <div style={{ ...s.filterBar, marginBottom: '8px' }}>
        {sourceFilters.map(f => (
          <button
            key={f.key}
            onClick={() => { setSource(f.key); setPage(1); }}
            style={{
              ...s.filterTab,
              ...(source === f.key ? s.filterTabActive : {}),
              ...(f.key === 'escalation' && escalationUnread && source !== 'escalation' ? { borderColor: '#f59e0b', color: '#f59e0b' } : {}),
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Row 2: Status + read + metadata filters */}
      <div style={{ ...s.filterBar, marginBottom: '16px' }}>
        {statusFilters.map(f => (
          <button
            key={f.key}
            onClick={() => { setStatusFilter(f.key); setPage(1); }}
            style={{ ...s.filterTab, ...(statusFilter === f.key ? s.filterTabActive : {}), fontSize: '0.75rem', padding: '6px 10px', minHeight: '36px' }}
          >
            {f.label}
          </button>
        ))}

        <span style={{ width: 1, height: 24, background: colors.border, margin: '0 4px' }} />

        {readFilters.map(f => (
          <button
            key={f.key}
            onClick={() => { setFilter(f.key); setPage(1); }}
            style={{ ...s.filterTab, ...(filter === f.key ? s.filterTabActive : {}), fontSize: '0.75rem', padding: '6px 10px', minHeight: '36px' }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Row 3: Dropdowns + search + sort */}
      <div style={{ ...s.filterBar, marginBottom: '16px' }}>
        <select value={escTypeFilter} onChange={e => { setEscTypeFilter(e.target.value); setPage(1); }} style={selectStyle}>
          <option value="">All types</option>
          {Object.entries(ESCALATION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={jobTypeFilter} onChange={e => { setJobTypeFilter(e.target.value); setPage(1); }} style={selectStyle}>
          <option value="">All jobs</option>
          {Object.entries(JOB_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={brandFilter} onChange={e => { setBrandFilter(e.target.value); setPage(1); }} style={selectStyle}>
          <option value="">All brands</option>
          <option value="vdm">VDM</option>
          <option value="par">PAR</option>
        </select>
        <div style={{ flex: 1 }} />
        <button onClick={() => setSort(sort === 'newest' ? 'oldest' : 'newest')} style={s.btnOutline}>
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

      {/* Message list */}
      {loading ? (
        <p style={{ color: colors.muted }}>Loading...</p>
      ) : messages.length === 0 ? (
        <p style={{ color: colors.muted }}>No messages</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {messages.map(msg => {
            const esc = isEscalation(msg);
            const meta = getMeta(msg);
            const escType = meta.escalation_type;
            const escColor = ESCALATION_COLORS[escType] || colors.muted;
            const msgStatus = msg.status || 'open';
            const statusColor = STATUS_COLORS[msgStatus];

            return (
              <div
                key={msg.id}
                onClick={() => toggleExpand(msg)}
                style={{
                  ...s.card,
                  cursor: 'pointer',
                  borderLeft: msg.read
                    ? `3px solid ${statusColor}33`
                    : `3px solid ${esc ? escColor : colors.accent}`,
                  opacity: msgStatus === 'resolved' ? 0.5 : msg.read ? 0.7 : 1,
                }}
              >
                {/* Header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: expanded === msg.id ? 12 : 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    {!msg.read && <span style={{ ...dot, background: esc ? escColor : colors.accent }} />}
                    <span style={{ color: colors.white, fontWeight: 600, fontSize: '0.9rem' }}>
                      {msg.name || 'Anonymous'}
                    </span>

                    {/* Status badge */}
                    {esc && (
                      <span style={{ ...badge, background: statusColor + '22', color: statusColor, borderColor: statusColor + '44', fontSize: '0.65rem' }}>
                        {STATUS_LABELS[msgStatus]}
                      </span>
                    )}

                    {/* Escalation type badge */}
                    {esc && escType && (
                      <span style={{ ...badge, background: escColor + '22', color: escColor, borderColor: escColor + '44' }}>
                        {ESCALATION_LABELS[escType] || escType}
                      </span>
                    )}

                    {/* Job type badge */}
                    {meta.job_type && (
                      <span style={{ ...badge, background: colors.input, color: colors.muted, borderColor: colors.border }}>
                        {JOB_TYPE_LABELS[meta.job_type] || meta.job_type.replace(/_/g, ' ')}
                      </span>
                    )}

                    {/* Brand badge */}
                    {meta.brand && (
                      <span style={{ ...badge, background: 'transparent', color: colors.dim, borderColor: colors.border, fontSize: '0.65rem' }}>
                        {meta.brand === 'par' ? 'PAR' : 'VDM'}
                      </span>
                    )}

                    {/* Source for non-escalation */}
                    {!esc && (
                      <span style={{ color: colors.dim, fontSize: '0.75rem' }}>{msg.source}</span>
                    )}
                  </div>
                  <span style={{ color: colors.dim, fontSize: '0.75rem', whiteSpace: 'nowrap', marginLeft: 8 }}>
                    {new Date(msg.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {expanded === msg.id ? (
                  <ExpandedMessage
                    msg={msg}
                    esc={esc}
                    meta={meta}
                    replies={replies}
                    replyText={replyText}
                    setReplyText={setReplyText}
                    replying={replying}
                    replyMsg={replyMsg}
                    sendReply={sendReply}
                    setStatus={setStatus}
                    loadChatLog={loadChatLog}
                    chatLogs={chatLogs}
                    chatLogLoading={chatLogLoading}
                    chatLogOpen={chatLogOpen}
                    stripDataBlocks={stripDataBlocks}
                  />
                ) : (
                  <p style={{ color: colors.muted, fontSize: '0.85rem', margin: '4px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {msg.message}
                  </p>
                )}
              </div>
            );
          })}
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

// ── Expanded message card ──────────────────────────────────────────────────
function ExpandedMessage({ msg, esc, meta, replies, replyText, setReplyText, replying, replyMsg, sendReply, setStatus, loadChatLog, chatLogs, chatLogLoading, chatLogOpen, stripDataBlocks }) {
  const sessionId = meta.session_id;
  const msgStatus = msg.status || 'open';

  return (
    <div style={{ marginTop: 8 }} onClick={e => e.stopPropagation()}>
      {/* Status controls for escalations */}
      {esc && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, alignItems: 'center' }}>
          <span style={{ color: colors.dim, fontSize: '0.75rem', marginRight: 4 }}>Status:</span>
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setStatus(msg.id, key)}
              style={{
                ...s.btnOutline,
                fontSize: '0.7rem',
                padding: '4px 10px',
                minHeight: '28px',
                ...(msgStatus === key ? { background: STATUS_COLORS[key] + '22', borderColor: STATUS_COLORS[key], color: STATUS_COLORS[key] } : {}),
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Message body */}
      <p style={{ color: colors.white, fontSize: '0.9rem', lineHeight: 1.6, margin: '0 0 12px', whiteSpace: 'pre-wrap' }}>
        {msg.message}
      </p>

      {/* Escalation metadata */}
      {esc && (meta.postcodes || meta.move_date || meta.session_id) && (
        <div style={{ ...metaRow, marginBottom: 12 }}>
          {meta.postcodes && <span>Route: {meta.postcodes}</span>}
          {meta.move_date && <span>Date: {meta.move_date}</span>}
          {meta.session_id && <span style={{ fontSize: '0.7rem', color: colors.dim }}>Session: {meta.session_id.slice(0, 8)}</span>}
        </div>
      )}

      {/* Chatlog viewer */}
      {sessionId && (
        <div style={{ marginBottom: 12 }}>
          <button
            onClick={() => loadChatLog(sessionId)}
            style={{ ...s.btnOutline, fontSize: '0.75rem', marginBottom: 8 }}
            disabled={chatLogLoading[sessionId]}
          >
            {chatLogLoading[sessionId] ? 'Loading...' : chatLogOpen[sessionId] ? 'Hide chatlog' : 'View chatlog'}
          </button>

          {chatLogOpen[sessionId] && chatLogs[sessionId] && (
            <ChatLogViewer log={chatLogs[sessionId]} stripDataBlocks={stripDataBlocks} />
          )}
        </div>
      )}

      {/* Contact details */}
      <div style={metaRow}>
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
  );
}

// ── Inline chatlog viewer ──────────────────────────────────────────────────
function ChatLogViewer({ log, stripDataBlocks }) {
  if (log.error) return <p style={{ color: colors.error, fontSize: '0.8rem' }}>Failed to load chatlog</p>;

  const msgs = log.messages || [];
  if (!msgs.length) return <p style={{ color: colors.muted, fontSize: '0.8rem' }}>No messages in this session</p>;

  return (
    <div style={{ background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: '10px', padding: '12px', maxHeight: '400px', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ color: colors.dim, fontSize: '0.7rem' }}>
          Session started {new Date(log.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </span>
        <span style={{ color: colors.dim, fontSize: '0.7rem' }}>
          {msgs.length} message{msgs.length !== 1 ? 's' : ''}
        </span>
      </div>
      {msgs.map((m, i) => {
        const isUser = m.role === 'user';
        const text = stripDataBlocks(m.content);
        if (!text) return null;
        return (
          <div key={i} style={{ marginBottom: 8, display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '85%',
              padding: '8px 12px',
              borderRadius: '10px',
              background: isUser ? colors.accent + '22' : colors.card,
              border: `1px solid ${isUser ? colors.accent + '44' : colors.border}`,
            }}>
              <span style={{ color: colors.dim, fontSize: '0.65rem', display: 'block', marginBottom: 2 }}>
                {isUser ? 'Customer' : 'Wizard'}
              </span>
              <p style={{ color: colors.white, fontSize: '0.8rem', lineHeight: 1.5, margin: 0, whiteSpace: 'pre-wrap' }}>
                {text}
              </p>
              {m.timestamp && (
                <span style={{ color: colors.dim, fontSize: '0.6rem', marginTop: 4, display: 'block' }}>
                  {new Date(m.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Shared styles ──────────────────────────────────────────────────────────
const dot = {
  width: 8,
  height: 8,
  borderRadius: '50%',
  background: colors.accent,
  flexShrink: 0,
};

const badge = {
  display: 'inline-block',
  fontSize: '0.7rem',
  fontWeight: 600,
  padding: '2px 8px',
  borderRadius: '6px',
  border: '1px solid',
  lineHeight: 1.4,
  whiteSpace: 'nowrap',
};

const metaRow = {
  display: 'flex',
  gap: 16,
  fontSize: '0.8rem',
  color: colors.muted,
  marginBottom: 8,
};

const selectStyle = {
  background: colors.input,
  border: `1px solid ${colors.border}`,
  borderRadius: '8px',
  color: colors.muted,
  fontSize: '0.8rem',
  padding: '6px 10px',
  outline: 'none',
  cursor: 'pointer',
  colorScheme: 'dark',
};
