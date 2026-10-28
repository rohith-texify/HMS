import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function LeavesPage() {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchLeaves();
  }, []);

  const fetchLeaves = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/college/leaves');
      const data = res.data || res;
      const list = Array.isArray(data) ? data : data.leaves || data.data || [];
      setLeaves(list);
    } catch (err) {
      setError(err.message || 'Failed to load leave records.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="portal-container">
      <div className="page-header">
        <div>
          <h2 className="page-title">Ward Leave History</h2>
          <p className="page-description">
            Complete list of leave applications, outpass requests, and approval status.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={fetchLeaves} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="alert alert-error">
          <span className="alert-icon">⚠️</span>
          <div className="alert-content">{error}</div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Leave Applications</h3>
          <span className="badge badge-info">{leaves.length} Total</span>
        </div>
        <div className="card-body">
          {loading ? (
            <div className="loading-state">Loading leave history...</div>
          ) : leaves.length === 0 ? (
            <div className="empty-state">
              <p>No leave records found for your ward.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Start Date</th>
                    <th>End Date</th>
                    <th>Reason</th>
                    <th>Status</th>
                    <th>Applied On</th>
                  </tr>
                </thead>
                <tbody>
                  {leaves.map((l) => (
                    <tr key={l.id || l.leave_id}>
                      <td>
                        <strong>{l.leave_type || l.type || 'Standard'}</strong>
                      </td>
                      <td>{l.start_date ? new Date(l.start_date).toLocaleDateString() : '—'}</td>
                      <td>{l.end_date ? new Date(l.end_date).toLocaleDateString() : '—'}</td>
                      <td>{l.reason || '—'}</td>
                      <td>
                        <span
                          className={`badge ${
                            (l.status || '').toUpperCase() === 'APPROVED'
                              ? 'badge-success'
                              : (l.status || '').toUpperCase() === 'REJECTED'
                              ? 'badge-danger'
                              : 'badge-warning'
                          }`}
                        >
                          {l.status || 'PENDING'}
                        </span>
                      </td>
                      <td>
                        {l.created_at ? new Date(l.created_at).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
