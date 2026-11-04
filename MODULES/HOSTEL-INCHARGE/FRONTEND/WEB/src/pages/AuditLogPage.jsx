import React, { useState, useEffect } from 'react';
import inchargeService from '../services/inchargeService';
import PageHeader from '../components/PageHeader';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import { History, Activity } from 'lucide-react';

export default function AuditLogPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadStream() {
      try {
        setLoading(true);
        setError(null);

        const [allocRes, leaveRes, compRes] = await Promise.allSettled([
          inchargeService.getAllocations(),
          inchargeService.getLeaves(),
          inchargeService.getComplaints(),
        ]);

        const stream = [];

        if (allocRes.status === 'fulfilled') {
          allocRes.value.slice(0, 10).forEach((a) => {
            stream.push({
              id: `ALLOC-${a.id || Math.random().toString(36).substr(2, 6)}`,
              timestamp: a.start_date || a.created_at || new Date().toISOString(),
              module: 'HOSTEL_ALLOCATION',
              action: 'BED_ALLOCATION',
              summary: `Room ${a.room_number || '—'} bed ${a.bed_label || '—'} allocated to ${a.student_name || 'resident'}`,
              status: a.status || 'ALLOCATED',
            });
          });
        }

        if (leaveRes.status === 'fulfilled') {
          leaveRes.value.slice(0, 10).forEach((l) => {
            stream.push({
              id: `LEAVE-${l.id || Math.random().toString(36).substr(2, 6)}`,
              timestamp: l.created_at || l.from_date || new Date().toISOString(),
              module: 'LEAVE_MANAGEMENT',
              action: 'LEAVE_APPLICATION',
              summary: `Leave request for "${l.reason || 'Personal'}" logged with status ${l.status || 'PENDING'}`,
              status: l.status || 'PENDING',
            });
          });
        }

        if (compRes.status === 'fulfilled') {
          compRes.value.slice(0, 10).forEach((c) => {
            stream.push({
              id: `COMP-${c.id || Math.random().toString(36).substr(2, 6)}`,
              timestamp: c.created_at || new Date().toISOString(),
              module: 'COMPLAINTS',
              action: 'STUDENT_COMPLAINT',
              summary: `Issue reported: ${c.title || c.category || 'Maintenance'}`,
              status: c.status || 'PENDING',
            });
          });
        }

        // Sort descending by timestamp
        stream.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        setEvents(stream);
      } catch (err) {
        setError(err.message || 'Failed to aggregate activity stream.');
      } finally {
        setLoading(false);
      }
    }
    loadStream();
  }, []);

  return (
    <div>
      <PageHeader
        title="Hostel Activity Stream"
        description="Chronological log of room assignments, resident leaves, and hostel grievances."
        icon={History}
      />

      {loading && <LoadingState title="Aggregating operational logs..." rows={5} />}
      {error && <ErrorState title="Error Loading Stream" message={error} onRetry={() => window.location.reload()} />}

      {!loading && !error && (
        <div className="card">
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Module</th>
                  <th>Action</th>
                  <th>Summary</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {events.length === 0 ? (
                  <tr>
                    <td colSpan="5">
                      <EmptyState
                        icon={Activity}
                        title="No Operational Events"
                        description="There are currently no recorded operational events for this hostel."
                      />
                    </td>
                  </tr>
                ) : (
                  events.map((e) => (
                    <tr key={e.id}>
                      <td>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                          {new Date(e.timestamp).toLocaleString()}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, fontSize: '0.82rem' }}>{e.module}</span>
                      </td>
                      <td>
                        <span className="badge badge-info">{e.action}</span>
                      </td>
                      <td>{e.summary}</td>
                      <td>
                        <span className="badge badge-resolved">{e.status}</span>
                      </td>
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

