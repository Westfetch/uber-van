// DriverDashboard — driver home screen with stats, next job, online toggle, activity feed.

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

function smartDate(dateStr, timeStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.floor((d - today) / 86400000);
  const time = timeStr || '08:00';
  if (diff === 0) return `Today at ${time}`;
  if (diff === 1) return `Tomorrow at ${time}`;
  return `${formatDate(dateStr)} at ${time}`;
}

function relativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return formatDate(iso);
}

function eventText(e) {
  const route = e.job_pickup && e.job_destination
    ? `${e.job_pickup} → ${e.job_destination}`
    : '';
  switch (e.event_type) {
    case 'offer_accepted':      return `Job accepted${route ? ': ' + route : ''}`;
    case 'customer_signed_off': return `Job signed off${route ? ': ' + route : ''}`;
    case 'balance_charged':     return 'Payment collected';
    case 'item_added':          return `Item added${route ? ' on ' + route : ''}`;
    case 'item_removed':        return `Item removed${route ? ' on ' + route : ''}`;
    default:                    return e.event_type.replace(/_/g, ' ');
  }
}

function eventIcon(type) {
  switch (type) {
    case 'offer_accepted':      return '🤝';
    case 'customer_signed_off': return '✅';
    case 'balance_charged':     return '💷';
    case 'item_added':          return '➕';
    case 'item_removed':        return '➖';
    default:                    return '•';
  }
}

// ── Sub-components ──────────────────────────────────────────────────────────

function StatCard({ value, label }) {
  return (
    <div style={s.statCard}>
      <div style={s.statValue}>{value}</div>
      <div style={s.statLabel}>{label}</div>
    </div>
  );
}

function StatsRow({ stats }) {
  return (
    <div style={s.statsRow}>
      <StatCard
        value={stats.total_earned_month ? `£${Math.round(stats.total_earned_month).toLocaleString()}` : '—'}
        label="THIS MONTH"
      />
      <StatCard
        value={stats.job_count || '0'}
        label="JOBS DONE"
      />
      <StatCard
        value={stats.avg_payout ? `£${Math.round(stats.avg_payout)}` : '—'}
        label="AVG PAYOUT"
      />
    </div>
  );
}

function NextJobHero({ job, onClick }) {
  return (
    <button style={s.heroCard} onClick={onClick}>
      <div style={s.sectionTitle}>NEXT JOB</div>
      <div style={s.heroRoute}>
        {job.pickup_postcode} → {job.destination_postcode}
      </div>
      <div style={s.heroMeta}>
        {smartDate(job.move_date, job.start_time)}
        <span style={s.heroPayout}>
          £{Number(job.customer_quote_gbp).toFixed(0)}
        </span>
      </div>
    </button>
  );
}

function OnlineToggle({ online, onToggle, toggling }) {
  return (
    <div style={s.toggleCard}>
      <div style={{ flex: 1 }}>
        <div style={{ color: '#fff', fontSize: '0.95rem', fontWeight: 600 }}>
          {online ? "You're online" : "You're offline"}
        </div>
        <div style={{ color: '#888', fontSize: '0.8rem', marginTop: '2px' }}>
          {online ? 'Job offers will be sent to you' : 'Go online to receive job offers'}
        </div>
      </div>
      <button
        style={{
          ...s.toggle,
          background: online ? '#4ade80' : '#333',
          opacity: toggling ? 0.6 : 1,
        }}
        onClick={onToggle}
        disabled={toggling}
      >
        <div style={{
          ...s.toggleKnob,
          transform: online ? 'translateX(24px)' : 'translateX(0)',
        }} />
      </button>
    </div>
  );
}

function JobCard({ job, onClick }) {
  const color = {
    accepted: '#4ade80', in_progress: '#60a5fa', completed: '#888',
  }[job.status] || '#888';

  return (
    <button style={s.jobCard} onClick={onClick}>
      <div style={s.jobCardTop}>
        <span style={s.jobCardRoute}>{job.pickup_postcode} → {job.destination_postcode}</span>
        <span style={{ ...s.jobCardStatus, color }}>{job.status.replace('_', ' ')}</span>
      </div>
      <div style={s.jobCardMeta}>
        {formatDate(job.move_date)}{job.start_time ? ` · ${job.start_time}` : ''} · £{Number(job.customer_quote_gbp).toFixed(0)}
      </div>
    </button>
  );
}

function ActivityFeed({ activity }) {
  if (!activity.length) return null;
  return (
    <section style={{ padding: '0 20px 20px' }}>
      <div style={s.sectionTitle}>RECENT ACTIVITY</div>
      <div style={s.activityList}>
        {activity.map((e, i) => (
          <div key={i} style={s.activityRow}>
            <span style={s.activityIcon}>{eventIcon(e.event_type)}</span>
            <span style={s.activityText}>{eventText(e)}</span>
            <span style={s.activityTime}>{relativeTime(e.created_at)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function WelcomeBanner({ driver }) {
  const approved = !driver?.approval_status || driver?.approval_status === 'approved';
  return (
    <div style={s.welcomeCard}>
      <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>👋</div>
      <div style={{ color: '#fff', fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px' }}>
        Welcome to the team, {driver?.name?.split(' ')[0]}!
      </div>
      <div style={s.checklist}>
        <CheckItem done label="Account created" />
        <CheckItem done={approved} label={approved ? 'Profile approved' : 'Awaiting approval'} />
        <CheckItem done={false} label="First job — waiting for your first offer" />
      </div>
    </div>
  );
}

function CheckItem({ done, label }) {
  return (
    <div style={s.checkRow}>
      <div style={{
        ...s.checkCircle,
        background: done ? '#d946ef' : 'transparent',
        border: done ? '2px solid #d946ef' : '2px solid #555',
      }}>
        {done && <span style={{ fontSize: '0.65rem', color: '#fff' }}>✓</span>}
      </div>
      <span style={{ color: done ? '#fff' : '#888', fontSize: '0.85rem' }}>{label}</span>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export default function DriverDashboard({ driver, onLogout, onDriverUpdate }) {
  const navigate = useNavigate();
  const [stats, setStats]       = useState(null);
  const [jobs, setJobs]         = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [online, setOnline]     = useState(driver?.online || false);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    async function load() {
      const token = localStorage.getItem('driver_token');
      const res = await api('/api/driver-data?type=dashboard', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
        setJobs(data.jobs || []);
        setActivity(data.activity || []);
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleToggle() {
    setToggling(true);
    const prev = online;
    setOnline(!prev);
    try {
      const token = localStorage.getItem('driver_token');
      const res = await api('/api/driver-data?type=toggle-online', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setOnline(data.online);
        onDriverUpdate?.({ online: data.online });
      } else {
        setOnline(prev);
      }
    } catch {
      setOnline(prev);
    } finally {
      setToggling(false);
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const activeJobs = jobs.filter(j => ['accepted', 'in_progress'].includes(j.status));
  const nextJob = activeJobs.find(j => j.move_date >= today) || activeJobs[0];
  const pastJobs = jobs.filter(j => j.status === 'completed');
  const isNewDriver = !stats || (stats.job_count === 0 && activity.length === 0);

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <div style={s.greeting}>Hey, {driver?.name?.split(' ')[0]} 👋</div>
          <div style={s.subtitle}>
            <span style={{ ...s.onlineDot, background: online ? '#4ade80' : '#666' }} />
            {online ? 'Online' : 'Offline'}
          </div>
        </div>
        <button style={s.logoutBtn} onClick={() => { localStorage.removeItem('driver_token'); onLogout(); }}>
          Sign out
        </button>
      </div>

      {loading ? (
        <p style={s.muted}>Loading...</p>
      ) : (
        <>
          {/* Stats */}
          <StatsRow stats={stats || { total_earned_month: 0, job_count: 0, avg_payout: 0 }} />

          {/* New driver welcome */}
          {isNewDriver && (
            <div style={{ padding: '0 20px 12px' }}>
              <WelcomeBanner driver={driver} />
            </div>
          )}

          {/* Online toggle — prominent when offline to nudge them online */}
          {!online && (
            <div style={{ padding: '0 20px 12px' }}>
              <OnlineToggle online={online} onToggle={handleToggle} toggling={toggling} />
            </div>
          )}

          {/* Empty state for idle/new drivers */}
          {activeJobs.length === 0 && !nextJob && isNewDriver && (
            <div style={{ padding: '0 20px 12px' }}>
              <div style={s.emptyState}>
                <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🚛</div>
                <div style={{ color: '#fff', fontSize: '1rem', fontWeight: 600, marginBottom: '6px' }}>
                  No jobs yet
                </div>
                <div style={{ color: '#888', fontSize: '0.85rem', lineHeight: 1.5 }}>
                  {online
                    ? "You're online and ready. Job offers will land here and in your email as soon as one comes in."
                    : 'Go online above to start receiving job offers.'}
                </div>
              </div>
            </div>
          )}

          {/* Next job hero */}
          {nextJob && (
            <div style={{ padding: '0 20px 12px' }}>
              <NextJobHero job={nextJob} onClick={() => navigate(`/job/${nextJob.id}`)} />
            </div>
          )}

          {/* Active jobs */}
          {activeJobs.length > 1 && (
            <section style={{ padding: '0 20px 12px' }}>
              <div style={s.sectionTitle}>ACTIVE JOBS</div>
              {activeJobs.filter(j => j.id !== nextJob?.id).map(job => (
                <JobCard key={job.id} job={job} onClick={() => navigate(`/job/${job.id}`)} />
              ))}
            </section>
          )}

          {/* Activity feed */}
          <ActivityFeed activity={activity} />

          {/* Recent completed */}
          {pastJobs.length > 0 && (
            <section style={{ padding: '0 20px 20px' }}>
              <div style={s.sectionTitle}>RECENT</div>
              {pastJobs.slice(0, 3).map(job => (
                <JobCard key={job.id} job={job} onClick={() => navigate(`/job/${job.id}`)} />
              ))}
            </section>
          )}

          {/* Settings — toggle buried here once online */}
          {online && (
            <section style={{ padding: '0 20px 32px' }}>
              <div style={s.sectionTitle}>SETTINGS</div>
              <OnlineToggle online={online} onToggle={handleToggle} toggling={toggling} />
            </section>
          )}
        </>
      )}
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const s = {
  page: { background: '#0a0a0a', minHeight: '100dvh', color: '#fff', fontFamily: 'system-ui, sans-serif' },

  // Header
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '24px 20px 16px', borderBottom: '1px solid #1e1e1e' },
  greeting: { color: '#fff', fontSize: '1.2rem', fontWeight: 700 },
  subtitle: { color: '#888', fontSize: '0.85rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' },
  onlineDot: { width: '8px', height: '8px', borderRadius: '50%', display: 'inline-block' },
  logoutBtn: { background: 'none', border: '1px solid #333', borderRadius: '8px', color: '#888', cursor: 'pointer', fontSize: '0.8rem', padding: '6px 12px' },

  // Stats row
  statsRow: { display: 'flex', gap: '10px', padding: '16px 20px 12px', overflowX: 'auto', scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' },
  statCard: { background: '#1a1a1a', borderRadius: '12px', padding: '16px', minWidth: '130px', flex: '1 0 auto', scrollSnapAlign: 'start' },
  statValue: { color: '#fff', fontSize: '1.3rem', fontWeight: 700 },
  statLabel: { color: '#666', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: '4px' },

  // Section
  sectionTitle: { color: '#666', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' },

  // Next job hero
  heroCard: { background: '#1a1a1a', border: 'none', borderLeft: '4px solid #d946ef', borderRadius: '12px', cursor: 'pointer', display: 'block', padding: '16px 16px 16px 20px', textAlign: 'left', width: '100%' },
  heroRoute: { color: '#fff', fontSize: '1.05rem', fontWeight: 700, margin: '8px 0 6px' },
  heroMeta: { color: '#888', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  heroPayout: { color: '#d946ef', fontWeight: 700, fontSize: '1rem' },

  // Online toggle
  toggleCard: { background: '#1a1a1a', borderRadius: '12px', padding: '16px', display: 'flex', alignItems: 'center', gap: '16px' },
  toggle: { width: '52px', height: '28px', borderRadius: '14px', border: 'none', cursor: 'pointer', position: 'relative', padding: '3px', transition: 'background 0.2s', flexShrink: 0 },
  toggleKnob: { width: '22px', height: '22px', borderRadius: '50%', background: '#fff', transition: 'transform 0.2s' },

  // Job cards
  jobCard: { background: '#1a1a1a', border: 'none', borderRadius: '12px', cursor: 'pointer', display: 'block', marginBottom: '8px', padding: '14px 16px', textAlign: 'left', width: '100%' },
  jobCardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' },
  jobCardRoute: { color: '#fff', fontWeight: 600, fontSize: '0.95rem' },
  jobCardStatus: { fontSize: '0.8rem', fontWeight: 600 },
  jobCardMeta: { color: '#888', fontSize: '0.8rem' },

  // Activity feed
  activityList: { background: '#1a1a1a', borderRadius: '12px', overflow: 'hidden' },
  activityRow: { display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', borderBottom: '1px solid #252525' },
  activityIcon: { fontSize: '0.85rem', flexShrink: 0, width: '20px', textAlign: 'center' },
  activityText: { color: '#ccc', fontSize: '0.82rem', flex: 1 },
  activityTime: { color: '#666', fontSize: '0.72rem', flexShrink: 0 },

  // Welcome banner
  welcomeCard: { background: '#1a1a1a', borderRadius: '12px', padding: '24px', textAlign: 'center' },
  checklist: { display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left', maxWidth: '280px', margin: '0 auto' },
  checkRow: { display: 'flex', alignItems: 'center', gap: '10px' },
  checkCircle: { width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },

  // Empty state
  emptyState: { background: '#1a1a1a', borderRadius: '12px', padding: '32px 24px', textAlign: 'center' },

  // Misc
  muted: { color: '#666', textAlign: 'center', paddingTop: '40px' },
};
