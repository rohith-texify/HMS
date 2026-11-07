import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import parentService from '../services/parentService';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  UnauthorizedState,
} from '../components/PageStates';
import useAuth from '../hooks/useAuth';

const RECENT_NOTIFICATION_LIMIT = 5;

const initialCardState = {
  status: 'loading',
  value: null,
  error: null,
};

function isNotification(record) {
  return record &&
    typeof record.id === 'string' &&
    typeof record.title === 'string' &&
    typeof record.message === 'string' &&
    typeof record.notification_type === 'string' &&
    ['DELIVERED', 'READ'].includes(record.delivery_status);
}

function isMessMenuItem(item) {
  return item &&
    typeof item.meal_menu_id === 'string' &&
    typeof item.meal_type === 'string' &&
    typeof item.items === 'string';
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

function CardContent({ state, emptyTitle, emptyMessage, retry }) {
  if (state.status === 'loading') {
    return <LoadingState title="Loading..." />;
  }

  if (state.status === 'unauthorized') {
    return (
      <UnauthorizedState
        title="Access unavailable"
        message={state.error}
        action={
          <button type="button" className="button button-secondary" onClick={retry}>
            Try again
          </button>
        }
      />
    );
  }

  if (state.status === 'error') {
    return (
      <ErrorState
        title="Could not load this information"
        message={state.error}
        action={
          <button type="button" className="button button-secondary" onClick={retry}>
            Try again
          </button>
        }
      />
    );
  }

  if (state.status === 'empty') {
    return <EmptyState title={emptyTitle} message={emptyMessage} />;
  }

  return null;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [unread, setUnread] = useState(initialCardState);
  const [recent, setRecent] = useState(initialCardState);
  const [mess, setMess] = useState(initialCardState);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const options = { signal: controller.signal };

    setUnread(initialCardState);
    setRecent(initialCardState);
    setMess(initialCardState);

    Promise.allSettled([
      parentService.getUnreadNotificationCount(options),
      parentService.getNotifications(options),
      parentService.getTodayMessMenu(options),
    ]).then(([unreadResult, notificationsResult, messResult]) => {
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
        const notifications = notificationsResult.value;
        if (!notifications.every(isNotification)) {
          setRecent(getErrorState(null, 'The notifications response contained invalid records.'));
        } else {
          setRecent({
            status: notifications.length === 0 ? 'empty' : 'success',
            value: notifications.slice(0, RECENT_NOTIFICATION_LIMIT),
            error: null,
          });
        }
      } else {
        setRecent(getErrorState(notificationsResult.reason, 'Unable to load recent notifications.'));
      }

      if (messResult.status === 'fulfilled') {
        const menu = messResult.value;
        if (!menu.every(isMessMenuItem)) {
          setMess(getErrorState(null, "The mess menu response contained invalid records."));
        } else {
          setMess({
            status: menu.length === 0 ? 'empty' : 'success',
            value: menu,
            error: null,
          });
        }
      } else {
        setMess(getErrorState(messResult.reason, "Unable to load today's mess menu."));
      }
    });

    return () => controller.abort();
  }, [refreshKey]);

  const retry = () => setRefreshKey((key) => key + 1);

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
        <button type="button" className="button button-secondary" onClick={retry}>
          Refresh
        </button>
      </header>

      <div className="dashboard-grid">
        <section className="overview-card dashboard-card" aria-labelledby="unread-heading">
          <div className="dashboard-card-heading">
            <div>
              <p className="eyebrow">Account updates</p>
              <h2 id="unread-heading">Unread notifications</h2>
            </div>
            <Link to="/notifications" className="text-link">View notifications</Link>
          </div>
          <CardContent
            state={unread}
            emptyTitle="No unread notifications"
            emptyMessage="There are no unread notifications for this account."
            retry={retry}
          />
          {unread.status === 'success' && (
            <Link to="/notifications" className="dashboard-count-link" aria-label="View unread notifications">
              <strong>{unread.value}</strong>
              <span>{unread.value === 1 ? 'unread notification' : 'unread notifications'}</span>
            </Link>
          )}
        </section>

        <section className="overview-card dashboard-card" aria-labelledby="recent-heading">
          <div className="dashboard-card-heading">
            <div>
              <p className="eyebrow">Latest updates</p>
              <h2 id="recent-heading">Recent notifications</h2>
            </div>
            <Link to="/notifications" className="text-link">See all</Link>
          </div>
          <CardContent
            state={recent}
            emptyTitle="No notifications yet"
            emptyMessage="There are no notifications for this account."
            retry={retry}
          />
          {recent.status === 'success' && (
            <>
              <ul className="dashboard-notification-list">
                {recent.value.map((notification) => {
                  const timestamp = formatTimestamp(notification.created_at);
                  return (
                    <li key={notification.id}>
                      <div>
                        <h3>{notification.title}</h3>
                        <p>{notification.message}</p>
                        {timestamp && <time dateTime={notification.created_at}>{timestamp}</time>}
                      </div>
                      {notification.delivery_status !== 'READ' && (
                        <span className="unread-indicator" aria-label="Unread" />
                      )}
                    </li>
                  );
                })}
              </ul>
              <Link to="/notifications" className="text-link">View notifications</Link>
            </>
          )}
        </section>

        <section className="overview-card dashboard-card" aria-labelledby="mess-heading">
          <div className="dashboard-card-heading">
            <div>
              <p className="eyebrow">College-wide menu</p>
              <h2 id="mess-heading">Today&apos;s mess menu</h2>
            </div>
            <Link to="/mess" className="text-link">View menu</Link>
          </div>
          <p className="data-scope-note">
            Menu information is college-wide and is not linked to an individual student.
          </p>
          <CardContent
            state={mess}
            emptyTitle="No menu published"
            emptyMessage="No menu records are available for today."
            retry={retry}
          />
          {mess.status === 'success' && (
            <>
              <ul className="dashboard-menu-list">
                {mess.value.slice(0, 3).map((item) => (
                  <li key={item.meal_menu_id}>
                    <strong>{item.meal_type}</strong>
                    <span>{item.items}</span>
                    {item.hostel_name && <small>{item.hostel_name}</small>}
                  </li>
                ))}
              </ul>
              {mess.value.length > 3 && (
                <p className="data-scope-note">
                  Showing 3 of {mess.value.length} menu items. View the menu for the rest.
                </p>
              )}
              <Link to="/mess" className="text-link">View today&apos;s menu</Link>
            </>
          )}
        </section>
      </div>

      <section className="availability-notice" aria-labelledby="availability-heading">
        <p className="eyebrow">Service availability</p>
        <h2 id="availability-heading">Not available yet</h2>
        <p>
          Linked student summary, attendance, leave, outing and gate-pass, visitors and parcels,
          complaints and maintenance, and documents are not available in the current Parent API.
        </p>
      </section>
    </div>
  );
}
