import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import PortalState from '../components/PortalState';

const notificationFilters = [
  { value: 'ALL', label: 'All' },
  { value: 'UNREAD', label: 'Unread' },
  { value: 'READ', label: 'Read' },
  { value: 'ANNOUNCEMENT', label: 'Announcements' },
];

function getNotificationRecords(response) {
  if (response?.success !== true) {
    throw new Error('The notifications response was not successful.');
  }

  if (response.data == null) return [];
  if (!Array.isArray(response.data)) {
    throw new Error('The notifications response did not contain a valid record list.');
  }

  const validRecords = response.data.filter(
    (record) =>
      record &&
      typeof record === 'object' &&
      typeof record.id === 'string' &&
      typeof record.title === 'string' &&
      typeof record.message === 'string' &&
      typeof record.notification_type === 'string' &&
      ['DELIVERED', 'READ'].includes(record.delivery_status)
  );

  if (validRecords.length !== response.data.length) {
    throw new Error('The notifications response contained invalid records.');
  }

  return validRecords;
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

export default function UpdatesPage() {
  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [pendingIds, setPendingIds] = useState(() => new Set());
  const [refreshKey, setRefreshKey] = useState(0);
  const activeControllers = useRef(new Set());

  useEffect(() => {
    const controllers = activeControllers.current;
    const controller = new AbortController();
    controllers.add(controller);
    setLoading(true);
    setLoadError(null);
    setActionError(null);

    const loadNotifications = async () => {
      try {
        const response = await api.get('/college/notifications', {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setNotifications(getNotificationRecords(response));
      } catch (error) {
        if (controller.signal.aborted) return;
        setLoadError({
          message: error?.message || 'Unable to load notifications.',
          unauthorized: error?.status === 401 || error?.status === 403,
        });
      } finally {
        controllers.delete(controller);
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    loadNotifications();

    return () => {
      controller.abort();
      controllers.delete(controller);
    };
  }, [refreshKey]);

  useEffect(() => {
    const controllers = activeControllers.current;
    return () => {
      controllers.forEach((controller) => controller.abort());
      controllers.clear();
    };
  }, []);

  const visibleNotifications = useMemo(() => {
    if (filter === 'ANNOUNCEMENT') {
      return notifications.filter(
        (notification) => notification.notification_type === 'ANNOUNCEMENT'
      );
    }
    if (filter === 'UNREAD') {
      return notifications.filter(
        (notification) => notification.delivery_status !== 'READ'
      );
    }
    if (filter === 'READ') {
      return notifications.filter(
        (notification) => notification.delivery_status === 'READ'
      );
    }
    return notifications;
  }, [filter, notifications]);

  const markAsRead = useCallback(async (notificationId) => {
    const controller = new AbortController();
    activeControllers.current.add(controller);
    setPendingIds((current) => new Set(current).add(notificationId));
    setActionError(null);
    setSuccessMessage(null);

    try {
      const response = await api.patch(
        `/college/notifications/${notificationId}/read`,
        null,
        { signal: controller.signal }
      );
      if (controller.signal.aborted) return;
      if (response?.success !== true) {
        throw new Error('The notification could not be marked as read.');
      }

      setNotifications((current) =>
        current.map((notification) =>
          notification.id === notificationId
            ? { ...notification, delivery_status: 'READ' }
            : notification
        )
      );
      setSuccessMessage('Notification marked as read.');
    } catch (error) {
      if (!controller.signal.aborted) {
        setActionError(error?.message || 'Unable to mark the notification as read.');
      }
    } finally {
      activeControllers.current.delete(controller);
      if (!controller.signal.aborted) {
        setPendingIds((current) => {
          const next = new Set(current);
          next.delete(notificationId);
          return next;
        });
      }
    }
  }, []);

  return (
    <div className="portal-container">
      <div className="page-header">
        <div>
          <h2 className="page-title">Visitors, parcels &amp; notifications</h2>
          <p className="page-description">
            Notifications and announcements addressed to your authenticated account.
          </p>
        </div>
      </div>

      <section className="dashboard-blocked-grid updates-blocked-grid" aria-label="Unavailable services">
        <PortalState
          variant="blocked"
          title="BLOCKED — Visitor records"
          message="No visitor listing or detail endpoint with authenticated Parent-to-Student ownership was found. Visitor records cannot be requested or displayed."
        />
        <PortalState
          variant="blocked"
          title="BLOCKED — Parcel records"
          message="No parcel listing or detail endpoint with authenticated Parent-to-Student ownership was found. Parcel records and collection information cannot be requested or displayed."
        />
      </section>

      <section className="dashboard-section" aria-labelledby="updates-heading">
        <div className="dashboard-section-header updates-section-header">
          <div>
            <h2 id="updates-heading" className="dashboard-section-title">
              Notifications &amp; announcements
            </h2>
            <p className="dashboard-section-description">
              The API returns notifications addressed to this account, newest first. It does not provide pagination.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setRefreshKey((key) => key + 1)}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        <div className="notification-filters" role="group" aria-label="Filter notifications">
          {notificationFilters.map((item) => (
            <button
              key={item.value}
              type="button"
              className={`notification-filter${filter === item.value ? ' active' : ''}`}
              aria-pressed={filter === item.value}
              onClick={() => setFilter(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {actionError && (
          <PortalState
            variant="error"
            title="Notification update failed"
            message={actionError}
          />
        )}
        {successMessage && (
          <PortalState
            variant="success"
            title="Notification updated"
            message={successMessage}
          />
        )}

        {loading ? (
          <PortalState variant="loading" title="Loading notifications..." />
        ) : loadError ? (
          <PortalState
            variant={loadError.unauthorized ? 'unauthorized' : 'error'}
            title={loadError.unauthorized ? 'Notifications unavailable' : 'Could not load notifications'}
            message={loadError.message}
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
        ) : visibleNotifications.length === 0 ? (
          <PortalState
            variant="empty"
            title={filter === 'ANNOUNCEMENT' ? 'No announcements' : 'No notifications'}
            message="There are no matching notifications for this account."
          />
        ) : (
          <ul className="notification-list">
            {visibleNotifications.map((notification) => {
              const timestamp = formatTimestamp(notification.created_at);
              const isRead = notification.delivery_status === 'READ';

              return (
                <li className="notification-item" key={notification.id}>
                  <article>
                    <div className="notification-card-header">
                      <div>
                        <h3 className="notification-title">{notification.title}</h3>
                        <p className="notification-meta">
                          {notification.notification_type.replaceAll('_', ' ')}
                          {' · '}
                          {isRead ? 'Read' : 'Unread'}
                          {timestamp && (
                            <>
                              {' · '}
                              <time dateTime={notification.created_at}>{timestamp}</time>
                            </>
                          )}
                        </p>
                      </div>
                      {!isRead && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => markAsRead(notification.id)}
                          disabled={pendingIds.has(notification.id)}
                        >
                          {pendingIds.has(notification.id) ? 'Updating...' : 'Mark as read'}
                        </button>
                      )}
                    </div>
                    <p className="notification-message">{notification.message}</p>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="profile-access-return">
        <Link to="/dashboard" className="btn btn-secondary">
          Return to overview
        </Link>
      </div>
    </div>
  );
}
