import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../shared/auth/useAuth';
import EmptyState from '../../../shared/components/EmptyState';
import ErrorState from '../../../shared/components/ErrorState';
import LoadingState from '../../../shared/components/LoadingState';
import parentService from '../services/parentService';
import './parent.css';

const initialState = { status: 'loading', value: null, error: null };
const recentLimit = 5;

function isNotification(record) {
  return record &&
    typeof record.id === 'string' &&
    typeof record.title === 'string' &&
    typeof record.message === 'string' &&
    typeof record.notification_type === 'string' &&
    ['DELIVERED', 'READ'].includes(record.delivery_status);
}

function isMenuRecord(record) {
  return record &&
    typeof record.meal_menu_id === 'string' &&
    typeof record.meal_type === 'string' &&
    typeof record.items === 'string';
}

function getErrorState(error, fallback) {
  return {
    status: error?.status === 401 || error?.status === 403 ? 'unauthorized' : 'error',
    value: null,
    error: error?.message || fallback,
  };
}

function formatTimestamp(value) {
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function CardState({ state, emptyTitle, emptyMessage, retry }) {
  if (state.status === 'loading') return <LoadingState message="Loading..." minHeight="120px" />;
  if (state.status === 'unauthorized') {
    return <ErrorState title="Access unavailable" message={state.error} onRetry={retry} />;
  }
  if (state.status === 'error') {
    return <ErrorState title="Could not load this information" message={state.error} onRetry={retry} />;
  }
  if (state.status === 'empty') {
    return <EmptyState title={emptyTitle} description={emptyMessage} />;
  }
  return null;
}

export default function ParentDashboardPage() {
  const { user } = useAuth();
  const [unread, setUnread] = useState(initialState);
  const [notifications, setNotifications] = useState(initialState);
  const [menu, setMenu] = useState(initialState);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const options = { signal: controller.signal };
    setUnread(initialState);
    setNotifications(initialState);
    setMenu(initialState);

    Promise.allSettled([
      parentService.getUnreadNotificationCount(options),
      parentService.getNotifications(options),
      parentService.getTodayMessMenu(options),
    ]).then(([unreadResult, notificationsResult, menuResult]) => {
      if (controller.signal.aborted) return;

      if (unreadResult.status === 'fulfilled') {
        setUnread({
          status: unreadResult.value === 0 ? 'empty' : 'success',
          value: unreadResult.value,
          error: null,
        });
      } else {
        setUnread(getErrorState(unreadResult.reason, 'Unable to load the unread notification count.'));
      }

      if (notificationsResult.status === 'fulfilled') {
        const records = notificationsResult.value;
        setNotifications(records.every(isNotification)
          ? {
            status: records.length === 0 ? 'empty' : 'success',
            value: records.slice(0, recentLimit),
            error: null,
          }
          : getErrorState(null, 'The notifications response contained invalid records.'));
      } else {
        setNotifications(getErrorState(notificationsResult.reason, 'Unable to load recent notifications.'));
      }

      if (menuResult.status === 'fulfilled') {
        const records = menuResult.value;
        setMenu(records.every(isMenuRecord)
          ? { status: records.length === 0 ? 'empty' : 'success', value: records, error: null }
          : getErrorState(null, "The mess menu response contained invalid records."));
      } else {
        setMenu(getErrorState(menuResult.reason, "Unable to load today's mess menu."));
      }
    });

    return () => controller.abort();
  }, [refreshKey]);

  const retry = () => setRefreshKey((key) => key + 1);

  return (
    <div className="parent-page">
      <header className="parent-page-header">
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
        <button type="button" className="parent-button" onClick={retry}>Refresh</button>
      </header>

      <div className="parent-dashboard-grid">
        <section className="parent-overview-card" aria-labelledby="unread-heading">
          <div className="parent-card-heading">
            <div>
              <p className="eyebrow">Account updates</p>
              <h2 id="unread-heading">Unread notifications</h2>
            </div>
            <Link to="/parent/notifications" className="parent-text-link">View notifications</Link>
          </div>
          <CardState
            state={unread}
            emptyTitle="No unread notifications"
            emptyMessage="There are no unread notifications for this account."
            retry={retry}
          />
          {unread.status === 'success' && (
            <Link to="/parent/notifications" className="parent-count-link">
              <strong>{unread.value}</strong>
              <span>{unread.value === 1 ? 'unread notification' : 'unread notifications'}</span>
            </Link>
          )}
        </section>

        <section className="parent-overview-card" aria-labelledby="notifications-heading">
          <div className="parent-card-heading">
            <div>
              <p className="eyebrow">Latest updates</p>
              <h2 id="notifications-heading">Recent notifications</h2>
            </div>
            <Link to="/parent/notifications" className="parent-text-link">See all</Link>
          </div>
          <CardState
            state={notifications}
            emptyTitle="No notifications yet"
            emptyMessage="There are no notifications for this account."
            retry={retry}
          />
          {notifications.status === 'success' && (
            <ul className="parent-notification-list">
              {notifications.value.map((record) => {
                const timestamp = formatTimestamp(record.created_at);
                return (
                  <li key={record.id}>
                    <div>
                      <h3>{record.title}</h3>
                      <p>{record.message}</p>
                      {timestamp && <time dateTime={record.created_at}>{timestamp}</time>}
                    </div>
                    {record.delivery_status !== 'READ' && (
                      <span className="parent-unread-indicator" aria-label="Unread" />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="parent-overview-card" aria-labelledby="menu-heading">
          <div className="parent-card-heading">
            <div>
              <p className="eyebrow">College-wide menu</p>
              <h2 id="menu-heading">Today&apos;s mess menu</h2>
            </div>
            <Link to="/parent/mess" className="parent-text-link">View menu</Link>
          </div>
          <p className="parent-scope-note">
            Menu information is college-wide and is not linked to an individual student.
          </p>
          <CardState
            state={menu}
            emptyTitle="No menu published"
            emptyMessage="No menu records are available for today."
            retry={retry}
          />
          {menu.status === 'success' && (
            <ul className="parent-menu-list">
              {menu.value.slice(0, 3).map((record) => (
                <li key={record.meal_menu_id}>
                  <strong>{record.meal_type}</strong>
                  <span>{record.items}</span>
                  {record.hostel_name && <small>{record.hostel_name}</small>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="parent-availability" aria-labelledby="availability-heading">
        <p className="eyebrow">Service availability</p>
        <h2 id="availability-heading">More services are not available yet</h2>
        <p>
          Linked-student profiles, attendance, leave history, outings, visitors, complaints,
          maintenance, and documents require Parent-scoped backend endpoints before they can be shown.
        </p>
      </section>
    </div>
  );
}
