import React, { useEffect, useMemo, useState } from 'react';
import parentService from '../services/parentService';
import useToast from '../hooks/useToast';
import { EmptyState, ErrorState, LoadingState } from '../components/PageStates';

const FILTERS = [
  { value: 'ALL', label: 'All' },
  { value: 'UNREAD', label: 'Unread' },
  { value: 'ANNOUNCEMENT', label: 'Announcements' },
];

function isNotification(record) {
  return record &&
    typeof record.id === 'string' &&
    typeof record.title === 'string' &&
    typeof record.message === 'string' &&
    typeof record.notification_type === 'string' &&
    ['DELIVERED', 'READ'].includes(record.delivery_status);
}

function formatTimestamp(value) {
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export default function NotificationsPage() {
  const { notify } = useToast();
  const [records, setRecords] = useState([]);
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pendingIds, setPendingIds] = useState(() => new Set());
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    parentService.getNotifications({ signal: controller.signal })
      .then((items) => {
        if (controller.signal.aborted) return;
        if (!items.every(isNotification)) {
          throw new Error('The notifications response contained invalid records.');
        }
        setRecords(items);
      })
      .catch((requestError) => {
        if (!controller.signal.aborted) {
          setError(requestError?.message || 'Unable to load notifications.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [refreshKey]);

  const visibleRecords = useMemo(() => records.filter((record) => {
    if (filter === 'UNREAD') return record.delivery_status !== 'READ';
    if (filter === 'ANNOUNCEMENT') return record.notification_type === 'ANNOUNCEMENT';
    return true;
  }), [filter, records]);

  const markAsRead = async (record) => {
    setPendingIds((current) => new Set(current).add(record.id));
    try {
      await parentService.markNotificationRead(record.id);
      setRecords((current) => current.map((item) => (
        item.id === record.id ? { ...item, delivery_status: 'READ' } : item
      )));
      notify('Notification marked as read.', 'success');
    } catch (requestError) {
      notify(requestError?.message || 'Unable to update this notification.', 'error');
    } finally {
      setPendingIds((current) => {
        const next = new Set(current);
        next.delete(record.id);
        return next;
      });
    }
  };

  return (
    <div className="page-container">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Account updates</p>
          <h1>Notifications</h1>
          <p>Notifications addressed to your authenticated account.</p>
        </div>
        <button
          type="button"
          className="button button-secondary"
          onClick={() => setRefreshKey((key) => key + 1)}
          disabled={loading}
        >
          Refresh
        </button>
      </header>

      <div className="filter-row" role="group" aria-label="Filter notifications">
        {FILTERS.map((item) => (
          <button
            type="button"
            key={item.value}
            className={`filter-button${filter === item.value ? ' selected' : ''}`}
            aria-pressed={filter === item.value}
            onClick={() => setFilter(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingState title="Loading notifications..." />
      ) : error ? (
        <ErrorState
          title="Notifications could not be loaded"
          message={error}
          action={
            <button type="button" className="button button-secondary" onClick={() => setRefreshKey((key) => key + 1)}>
              Try again
            </button>
          }
        />
      ) : visibleRecords.length === 0 ? (
        <EmptyState
          title={filter === 'ANNOUNCEMENT' ? 'No announcements' : 'No notifications'}
          message="There are no matching notifications for this account."
        />
      ) : (
        <ul className="notification-list">
          {visibleRecords.map((record) => {
            const timestamp = formatTimestamp(record.created_at);
            return (
              <li className="notification-card" key={record.id}>
                <div className="notification-card-top">
                  <div>
                    <span className="notification-type">{record.notification_type.replaceAll('_', ' ')}</span>
                    <h2>{record.title}</h2>
                  </div>
                  {record.delivery_status !== 'READ' && (
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() => markAsRead(record)}
                      disabled={pendingIds.has(record.id)}
                    >
                      {pendingIds.has(record.id) ? 'Updating...' : 'Mark as read'}
                    </button>
                  )}
                </div>
                <p>{record.message}</p>
                {timestamp && <time dateTime={record.created_at}>{timestamp}</time>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
