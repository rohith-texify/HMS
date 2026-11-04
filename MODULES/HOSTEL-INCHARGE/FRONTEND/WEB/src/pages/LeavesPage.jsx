import React, { useState, useEffect } from 'react';
import inchargeService from '../services/inchargeService';
import PageHeader from '../components/PageHeader';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import { FileText } from 'lucide-react';

export default function LeavesPage() {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const data = await inchargeService.getLeaves();
        setLeaves(data);
      } catch (err) {
        setError(err.message || 'Failed to load resident leaves.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div>
      <PageHeader
        title="Student Leave Requests"
        description="Review, verify, and approve overnight and vacation leaves for resident students."
        icon={FileText}
      />

      {loading && <LoadingState title="Loading leave records..." rows={4} />}
      {error && <ErrorState title="Error Loading Leaves" message={error} onRetry={() => window.location.reload()} />}

      {!loading && !error && (
        <div className="card">
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Reason</th>
                  <th>From Date</th>
                  <th>To Date</th>
                  <th>Decision Status</th>
                </tr>
              </thead>
              <tbody>
                {leaves.length === 0 ? (
                  <tr>
                    <td colSpan="5">
                      <EmptyState
                        icon={FileText}
                        title="No Leave Applications"
                        description="There are currently no active or pending leave applications from residents."
                      />
                    </td>
                  </tr>
                ) : (
                  leaves.map((l, i) => (
                    <tr key={l.id || i}>
                      <td><strong>{l.student_name || l.student_id ? l.student_id.substring(0, 8) + '...' : 'Resident'}</strong></td>
                      <td>{l.reason || 'General Leave'}</td>
                      <td>{l.from_date || l.start_date || '—'}</td>
                      <td>{l.to_date || l.end_date || '—'}</td>
                      <td><span className="badge badge-pending">{l.status || 'PENDING'}</span></td>
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

