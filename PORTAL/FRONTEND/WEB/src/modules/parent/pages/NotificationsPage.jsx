import React, { useEffect, useMemo, useState } from 'react';
import EmptyState from '../../../shared/components/EmptyState';
import ErrorState from '../../../shared/components/ErrorState';
import LoadingState from '../../../shared/components/LoadingState';
import parentService from '../services/parentService';
import './parent.css';

const filters = [
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

export default function ParentNotificationsPage() {
  const [records, setRecords] = useState([]);
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [pendingIds, setPendingIds] = useState(() => new Set());

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setRecords([]);
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
    setError(null);
    try {
      await parentService.markNotificationRead(record.id);
      setRecords((current) => current.map((item) => (
        item.id === record.id ? { ...item, delivery_status: 'READ' } : item
      )));
    } catch (requestError) {
      setError(requestError?.message || 'Unable to update this notification.');
    } finally {
      setPendingIds((current) => {
        const next = new Set(current);
        next.delete(record.id);
        return next;
      });
    }
  };

  return (
    <div className="parent-page">
      <header className="parent-page-header">
        <div>
          <p className="eyebrow">Account updates</p>
          <h1>Notifications</h1>
          <p>Notifications addressed to your authenticated account.</p>
        </div>
        <button
          type="button"
          className="parent-button"
          onClick={() => setRefreshKey((key) => key + 1)}
          disabled={loading}
        >
          Refresh
        </button>
      </header>

      <div className="parent-filter-row" role="group" aria-label="Filter notifications">
        {filters.map((item) => (
          <button
            type="button"
            key={item.value}
            className={filter === item.value ? 'selected' : ''}
            aria-pressed={filter === item.value}
            onClick={() => setFilter(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error && <ErrorState title="Notifications could not be loaded or updated" message={error} />}
      {loading ? (
        <LoadingState message="Loading notifications..." />
      ) : !error && visibleRecords.length === 0 ? (
        <EmptyState
          title={filter === 'ANNOUNCEMENT' ? 'No announcements' : 'No notifications'}
          description="There are no matching notifications for this account."
        />
      ) : (
        <ul className="parent-record-list">
          {visibleRecords.map((record) => {
            const timestamp = formatTimestamp(record.created_at);
            return (
              <li className="parent-record-card" key={record.id}>
                <div className="parent-record-heading">
                  <div>
                    <span className="parent-record-type">{record.notification_type.replaceAll('_', ' ')}</span>
                    <h2>{record.title}</h2>
                  </div>
                  {record.delivery_status !== 'READ' && (
                    <button
                      type="button"
                      className="parent-button"
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
