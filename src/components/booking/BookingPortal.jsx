// BookingPortal — customer-facing booking status page
// Public route at /booking/:id — token auth via query param, no password needed.
// Polls /api/booking every 30s for status updates.

import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import BookingHeader from './BookingHeader.jsx';
import StatusPending from './StatusPending.jsx';
import StatusAccepted from './StatusAccepted.jsx';
import StatusInProgress from './StatusInProgress.jsx';
import StatusCompleted from './StatusCompleted.jsx';
import StatusCancelled from './StatusCancelled.jsx';
import BookingTimeline from './BookingTimeline.jsx';

const POLL_INTERVAL = 30_000;

export default function BookingPortal() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const [booking, setBooking] = useState(null);
  const [error, setError]     = useState(null);
  const [loading, setLoading] = useState(true);
  const tokenRef = useRef(null);

  // Persist token: query param on first visit, sessionStorage thereafter
  useEffect(() => {
    const paramToken = searchParams.get('token');
    if (paramToken) {
      sessionStorage.setItem(`booking_token_${id}`, paramToken);
      tokenRef.current = paramToken;
    } else {
      tokenRef.current = sessionStorage.getItem(`booking_token_${id}`);
    }
  }, [id, searchParams]);

  // Fetch booking data
  const fetchBooking = async () => {
    const token = tokenRef.current;
    if (!token) { setError('No booking token'); setLoading(false); return; }

    try {
      const res = await fetch(`/api/booking?id=${id}&token=${token}`);
      if (!res.ok) {
        setError(res.status === 401 ? 'Invalid booking link' : 'Booking not found');
        setLoading(false);
        return;
      }
      const data = await res.json();
      setBooking(data);
      setError(null);
    } catch {
      setError('Unable to load booking');
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch + polling
  useEffect(() => {
    // Small delay to let token ref populate
    const init = setTimeout(() => fetchBooking(), 50);
    const poll = setInterval(() => fetchBooking(), POLL_INTERVAL);
    return () => { clearTimeout(init); clearInterval(poll); };
  }, [id]);

  // Prevent token leaking via referrer
  useEffect(() => {
    let meta = document.querySelector('meta[name="referrer"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'referrer';
      document.head.appendChild(meta);
    }
    meta.content = 'no-referrer';
    return () => { meta.content = ''; };
  }, []);

  if (loading) return (
    <div style={styles.page}>
      <div style={styles.center}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Loading your booking...</p>
      </div>
    </div>
  );

  if (error) return (
    <div style={styles.page}>
      <div style={styles.center}>
        <div style={styles.errorIcon}>!</div>
        <p style={styles.errorText}>{error}</p>
        <p style={styles.errorHint}>
          Check your booking link or contact us if you need help.
        </p>
      </div>
    </div>
  );

  const StatusComponent = {
    pending_payment:    StatusPending,
    pending_acceptance: StatusPending,
    accepted:           StatusAccepted,
    in_progress:        StatusInProgress,
    completed:          StatusCompleted,
    cancelled:          StatusCancelled,
    refunded:           StatusCancelled,
  }[booking.status] || StatusPending;

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <BookingHeader booking={booking} />
        <StatusComponent booking={booking} />
        {booking.events?.length > 0 && (
          <BookingTimeline events={booking.events} />
        )}
      </div>
    </div>
  );
}

const styles = {
  page: {
    background: '#0a0a0a',
    minHeight: '100dvh',
    color: '#fff',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  container: {
    maxWidth: '480px',
    margin: '0 auto',
    padding: '16px 16px 48px',
  },
  center: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100dvh',
    padding: '24px',
    textAlign: 'center',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid #333',
    borderTopColor: '#d946ef',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: { color: '#888', fontSize: '0.9rem', marginTop: '16px' },
  errorIcon: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    background: '#f87171',
    color: '#fff',
    fontSize: '1.5rem',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '16px',
  },
  errorText: { color: '#fff', fontSize: '1.1rem', fontWeight: 600, margin: '0 0 8px' },
  errorHint: { color: '#888', fontSize: '0.85rem', margin: 0 },
};
