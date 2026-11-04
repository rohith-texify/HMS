import React, { useState, useEffect } from 'react';
import inchargeService from '../services/inchargeService';
import PageHeader from '../components/PageHeader';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import { Bell, AlertCircle } from 'lucide-react';

export default function AnnouncementsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const data = await inchargeService.getNotifications();
        setNotifications(data);
      } catch (err) {
        setError(err.message || 'Failed to load notifications.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div>
      <PageHeader
        title="Announcements & Notices"
        description="Official campus circulars, hostel broadcasts, and emergency notices."
        icon={Bell}
      />

      {loading && <LoadingState title="Loading announcements..." rows={4} />}
      {error && <ErrorState title="Error Loading Notices" message={error} onRetry={() => window.location.reload()} />}

      {!loading && !error && (
        <div className="card">
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Message / Content</th>
                  <th>Category</th>
                  <th>Published Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {notifications.length === 0 ? (
                  <tr>
                    <td colSpan="5">
                      <EmptyState
                        icon={Bell}
                        title="No Notices Available"
                        description="There are currently no active announcements published for this hostel."
                      />
                    </td>
                  </tr>
                ) : (
                  notifications.map((n, i) => (
                    <tr key={n.id || i}>
                      <td><strong>{n.title || 'Notice'}</strong></td>
                      <td>{n.message || n.content || '—'}</td>
                      <td>{n.type || n.category || 'General'}</td>
                      <td>{n.created_at ? new Date(n.created_at).toLocaleDateString() : '—'}</td>
                      <td><span className="badge badge-resolved">{n.status || 'SENT'}</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

