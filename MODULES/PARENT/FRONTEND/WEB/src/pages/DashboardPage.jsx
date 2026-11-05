import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import parentService from '../services/parentService';
import { ErrorState, LoadingState } from '../components/PageStates';
import useAuth from '../hooks/useAuth';

export default function DashboardPage() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setError(null);
    parentService.getUnreadNotificationCount({ signal: controller.signal })
      .then((count) => {
        if (!controller.signal.aborted) setUnreadCount(count);
      })
      .catch((requestError) => {
        if (!controller.signal.aborted) {
          setError(requestError?.message || 'Unable to load the unread notification count.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [refreshKey]);

  return (
    <div className="page-container">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Parent &amp; guardian</p>
          <h1>Overview</h1>
          <p>
            Available account services.
            {typeof user?.email === 'string' && user.email.trim() && (
              <> Signed in as {user.email.trim()}.</>
            )}
          </p>
        </div>
      </header>

      <section className="overview-card" aria-labelledby="unread-heading">
        <div className="overview-card-heading">
          <div>
            <p className="eyebrow">Notifications</p>
            <h2 id="unread-heading">Unread notifications</h2>
          </div>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => setRefreshKey((key) => key + 1)}
            disabled={loading}
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <LoadingState title="Loading unread count..." />
        ) : error ? (
          <ErrorState
            title="Unread count unavailable"
            message={error}
            action={
              <button type="button" className="button button-secondary" onClick={() => setRefreshKey((key) => key + 1)}>
                Try again
              </button>
            }
          />
        ) : (
          <div className="unread-count">
            <strong>{unreadCount}</strong>
            <span>{unreadCount === 1 ? 'unread notification' : 'unread notifications'}</span>
          </div>
        )}
        <Link to="/notifications" className="text-link">View notifications</Link>
      </section>

      <section className="overview-card">
        <p className="eyebrow">College services</p>
        <h2>Today&apos;s mess menu</h2>
        <p>View the published menu for hostels in your college.</p>
        <Link to="/mess" className="text-link">View today&apos;s menu</Link>
        <p className="data-scope-note">Menu information is college-wide and is not linked to an individual student.</p>
      </section>
    </div>
  );
}
