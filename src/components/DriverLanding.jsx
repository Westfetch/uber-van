import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import VanIcon from './icons/VanIcon.jsx';

const bg = '#0a0a0a';
const card = '#1a1a1a';
const accent = '#d946ef';
const muted = '#aaa';
const border = '#333';

const APK_URL = import.meta.env.VITE_APK_URL || null;

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export default function DriverLanding() {
  const navigate = useNavigate();
  const [ios] = useState(isIOS);

  return (
    <div style={{ background: bg, minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ maxWidth: '480px', width: '100%' }}>
        {/* Logo / brand */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <VanIcon size={56} />
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
            {ios ? (
              <>
                <Step n={1} title="Add to Home Screen">
                  Open this page in Safari, tap the Share button, then "Add to Home Screen". This gives you an app-like experience.
                </Step>
                <Step n={2} title="Log in with your code">
                  Enter your name and the setup code provided by the team. The code is single-use and expires in 48 hours.
                </Step>
                <Step n={3} title="Check for offers regularly">
                  iPhone doesn't support push notifications for web apps yet, so check the app when you get an email or SMS about a new job.
                </Step>
                <Step n={4} title="Start earning">
                  Once your account is approved, you'll start receiving job offers based on your location and van size.
                </Step>
              </>
            ) : (
              <>
                <Step n={1} title="Install the app">
                  Download and install the APK file below. On Android, you may need to allow installs from unknown sources in your settings.
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
              </>
            )}
          </div>
        </div>

        {/* Download / Install section */}
        <div style={{ background: card, borderRadius: '16px', padding: '20px', marginBottom: '16px', border: `1px solid ${border}`, textAlign: 'center' }}>
          {ios ? (
            <>
              <p style={{ color: '#fff', fontSize: '0.9rem', margin: '0 0 8px', fontWeight: 600 }}>
                iPhone / iPad
              </p>
              <p style={{ color: muted, fontSize: '0.85rem', margin: '0 0 12px', lineHeight: 1.5 }}>
                Tap the <strong style={{ color: '#fff' }}>Share</strong> button in Safari, then <strong style={{ color: '#fff' }}>"Add to Home Screen"</strong> to install as a web app.
              </p>
              <button
                onClick={() => navigate('/login')}
                style={{
                  background: accent,
                  border: 'none',
                  borderRadius: '10px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  padding: '12px 32px',
                  width: '100%',
                }}
              >
                Open app
              </button>
            </>
          ) : APK_URL ? (
            <>
              <a
                href={APK_URL}
                style={{
                  display: 'block',
                  background: accent,
                  borderRadius: '10px',
                  color: '#fff',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  padding: '12px 32px',
                  textDecoration: 'none',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              >
                Download APK
              </a>
              <p style={{ color: muted, fontSize: '0.8rem', margin: '8px 0 0', lineHeight: 1.4 }}>
                After downloading, open the file to install. You may need to allow "Install from unknown sources" in your Android settings.
              </p>
            </>
          ) : (
            <>
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
            </>
          )}
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
