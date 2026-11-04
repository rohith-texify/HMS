import React, { useEffect, useState } from 'react';
import api from '../services/api';
import PortalState from '../components/PortalState';
import useAuth from '../hooks/useAuth';

function getNotificationRecords(response) {
  if (Array.isArray(response?.data)) {
    return response.data;
  }

  if (response?.success === true && response.data == null) {
    return [];
  }

  throw new Error('The notifications response did not contain a valid record list.');
}

function formatTimestamp(value) {
  if (typeof value !== 'string') return null;

  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return null;

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(timestamp);
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [notificationsError, setNotificationsError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    const loadNotifications = async () => {
      setNotificationsLoading(true);
      setNotificationsError(null);

      try {
        const response = await api.get('/college/notifications', {
          params: { unread: 'true' },
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;

        const records = getNotificationRecords(response);
        const validRecords = records.filter(
          (record) =>
            record &&
            typeof record === 'object' &&
            typeof record.id === 'string' &&
            typeof record.title === 'string' &&
            typeof record.message === 'string'
        );

        if (validRecords.length !== records.length) {
          throw new Error('The notifications response contained invalid records.');
        }

        setNotifications(validRecords);
      } catch (error) {
        if (controller.signal.aborted) return;

        setNotificationsError({
          message: error?.message || 'Unable to load notifications.',
          unauthorized: error?.status === 401 || error?.status === 403,
        });
      } finally {
        if (!controller.signal.aborted) {
          setNotificationsLoading(false);
        }
      }
    };

    loadNotifications();

    return () => controller.abort();
  }, [refreshKey]);

  return (
    <div className="portal-container">
      <div className="page-header">
        <div>
          <h2 className="page-title">Welcome</h2>
          <p className="page-description">
            Your Parent portal overview.
            {typeof user?.email === 'string' && user.email.trim() && (
              <> Signed in as {user.email.trim()}.</>
            )}
          </p>
        </div>
      </div>

      <section className="dashboard-section" aria-labelledby="notifications-heading">
        <div className="dashboard-section-header">
          <div>
            <h2 id="notifications-heading" className="dashboard-section-title">
              Unread notifications
            </h2>
            <p className="dashboard-section-description">
              Notifications addressed to your authenticated account.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setRefreshKey((key) => key + 1)}
            disabled={notificationsLoading}
          >
            {notificationsLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {notificationsLoading ? (
          <PortalState variant="loading" title="Loading notifications..." />
        ) : notificationsError ? (
          <PortalState
            variant={notificationsError.unauthorized ? 'unauthorized' : 'error'}
            title={notificationsError.unauthorized ? 'Notifications unavailable' : 'Could not load notifications'}
            message={notificationsError.message}
            action={
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setRefreshKey((key) => key + 1)}
              >
                Try again
              </button>
            }
          />
        ) : notifications.length === 0 ? (
          <PortalState
            variant="empty"
            title="No unread notifications"
            message="There are no unread notifications for this account."
          />
        ) : (
          <ul className="notification-list">
            {notifications.slice(0, 5).map((notification) => {
              const timestamp = formatTimestamp(notification.created_at);

              return (
                <li className="notification-item" key={notification.id}>
                  <article>
                    <h3 className="notification-title">{notification.title}</h3>
                    <p className="notification-message">{notification.message}</p>
                    {timestamp && (
                      <time
                        className="notification-timestamp"
                        dateTime={notification.created_at}
                      >
                        {timestamp}
                      </time>
                    )}
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="dashboard-section" aria-labelledby="unavailable-heading">
        <div className="dashboard-section-header">
          <div>
            <h2 id="unavailable-heading" className="dashboard-section-title">
              Parent-linked information
            </h2>
            <p className="dashboard-section-description">
              These sections require server-side authorization for your parent-student relationship.
            </p>
          </div>
        </div>
        <div className="dashboard-blocked-grid">
          <PortalState
            variant="blocked"
            title="Linked students and profiles"
            message="Blocked: the available student endpoints are college-scoped and do not verify parent-student ownership. The checked-in Parent permissions also do not include people.view."
          />
          <PortalState
            variant="blocked"
            title="Attendance, leave, outing & gate-pass data"
            message="Attendance BLOCKED: GET /college/attendance/students and GET /college/attendance/reports/summary require people.view, which is not included in the checked-in Parent permissions; both are college-scoped and do not verify Parent ownership. Leave listings and summaries are also blocked because they do not establish Parent-student ownership; submission and cancellation additionally require requests.manage, which Parent does not have. No outing or gate-pass endpoints were found. No attendance or request data or counts are fetched."
          />
          <PortalState
            variant="blocked"
            title="Recent activity"
            message="Blocked: no Parent-authorized, parent-scoped recent-activity endpoint was found."
          />
        </div>
      </section>
    </div>
  );
}
