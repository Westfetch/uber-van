import { useNavigate } from 'react-router-dom';

const bg = '#0a0a0a';
const card = '#1a1a1a';
const accent = '#d946ef';
const muted = '#aaa';
const border = '#333';

export default function DriverLanding() {
  const navigate = useNavigate();

  return (
    <div style={{ background: bg, minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ maxWidth: '480px', width: '100%' }}>
        {/* Logo / brand */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <span style={{ fontSize: '3rem' }}>🚐</span>
          <h1 style={{ color: '#fff', margin: '12px 0 4px', fontSize: '1.6rem', fontWeight: 700 }}>
            Drive with us
          </h1>
          <p style={{ color: muted, fontSize: '0.95rem', margin: 0 }}>
            Get set up in minutes and start earning
          </p>
        </div>

        {/* Steps card */}
        <div style={{ background: card, borderRadius: '16px', padding: '24px', marginBottom: '16px', border: `1px solid ${border}` }}>
          <h2 style={{ color: '#fff', fontSize: '1.1rem', margin: '0 0 16px' }}>Getting started</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Step n={1} title="Install the app">
              Download and install the APK file sent to you. On Android, you may need to allow installs from unknown sources in your settings.
            </Step>
            <Step n={2} title="Enable notifications">
              When prompted, allow push notifications — this is how you'll receive job offers in real-time.
            </Step>
            <Step n={3} title="Log in with your code">
              Enter your name and the setup code provided by the team. The code is single-use and expires in 48 hours.
            </Step>
            <Step n={4} title="Start earning">
              Once your account is approved, you'll start receiving job offers based on your location and van size.
            </Step>
          </div>
        </div>

        {/* Download placeholder */}
        <div style={{ background: card, borderRadius: '16px', padding: '20px', marginBottom: '16px', border: `1px solid ${border}`, textAlign: 'center' }}>
          <p style={{ color: muted, fontSize: '0.85rem', margin: '0 0 12px' }}>
            APK download link will be available here soon
          </p>
          <button
            disabled
            style={{
              background: accent,
              opacity: 0.5,
              border: 'none',
              borderRadius: '10px',
              color: '#fff',
              cursor: 'not-allowed',
              fontSize: '0.95rem',
              fontWeight: 700,
              padding: '12px 32px',
              width: '100%',
            }}
          >
            Download APK (coming soon)
          </button>
        </div>

        {/* Already have the app */}
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={() => navigate('/login')}
            style={{
              background: 'none',
              border: 'none',
              color: accent,
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: 600,
              textDecoration: 'underline',
            }}
          >
            Already have the app? Log in here
          </button>
        </div>
      </div>
    </div>
  );
}

function Step({ n, title, children }) {
  return (
    <div style={{ display: 'flex', gap: '12px' }}>
      <div style={{
        width: '28px',
        height: '28px',
        borderRadius: '50%',
        background: accent + '22',
        color: accent,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.85rem',
        fontWeight: 700,
        flexShrink: 0,
      }}>
        {n}
      </div>
      <div>
        <p style={{ color: '#fff', margin: '0 0 4px', fontSize: '0.95rem', fontWeight: 600 }}>{title}</p>
        <p style={{ color: muted, margin: 0, fontSize: '0.85rem', lineHeight: 1.5 }}>{children}</p>
      </div>
    </div>
  );
}
