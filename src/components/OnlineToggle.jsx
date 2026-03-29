// OnlineToggle — reusable online/offline toggle for driver app.

export default function OnlineToggle({ online, onToggle, toggling }) {
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

const s = {
  toggleCard: { background: '#1a1a1a', borderRadius: '12px', padding: '16px', display: 'flex', alignItems: 'center', gap: '16px' },
  toggle: { width: '52px', height: '28px', borderRadius: '14px', border: 'none', cursor: 'pointer', position: 'relative', padding: '3px', transition: 'background 0.2s', flexShrink: 0 },
  toggleKnob: { width: '22px', height: '22px', borderRadius: '50%', background: '#fff', transition: 'transform 0.2s' },
};
