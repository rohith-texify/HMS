import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function LeavesPage() {
  const [leaves, setLeaves] = useState([]);
  const [filter, setFilter] = useState('APPROVED');
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
      setLeaves(Array.isArray(data) ? data : data.leaves || data.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load leave records.');
    } finally {
      setLoading(false);
    }
  };

  const filteredLeaves = leaves.filter((l) => {
    if (!filter) return true;
    return (l.status || '').toUpperCase() === filter.toUpperCase();
  });

  return (
    <div className="portal-container">
      <div className="page-header">
        <div>
          <h2 className="page-title">Student Leave & Outpass Verification</h2>
          <p className="page-description">
            Inspect approved gate-passes to authenticate student departures and returns.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <select
            className="form-control"
            style={{ width: 'auto' }}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="APPROVED">Approved Only (Gate Clearance)</option>
            <option value="PENDING">Pending (Not Cleared)</option>
            <option value="REJECTED">Rejected</option>
          </select>
          <button className="btn btn-secondary" onClick={fetchLeaves} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          <span className="alert-icon">⚠️</span>
          <div className="alert-content">{error}</div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Leave & Outpass Directory</h3>
          <span className="badge badge-info">{filteredLeaves.length} Records</span>
        </div>
        <div className="card-body">
          {loading ? (
            <div className="loading-state">Loading gate clearance passes...</div>
          ) : filteredLeaves.length === 0 ? (
            <div className="empty-state">
              <p>No outpasses matching current filter criteria.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Student ID / Reg</th>
                    <th>Type</th>
                    <th>Start Date</th>
                    <th>Expected Return</th>
                    <th>Reason</th>
                    <th>Gate Clearance</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeaves.map((l) => {
                    const isApproved = (l.status || '').toUpperCase() === 'APPROVED';
                    return (
                      <tr key={l.id || l.leave_id}>
                        <td>
                          <strong>{l.student_id || l.reg_number || 'Student'}</strong>
                        </td>
                        <td>{l.leave_type || l.type || 'Standard'}</td>
                        <td>{l.start_date ? new Date(l.start_date).toLocaleDateString() : '—'}</td>
                        <td>{l.end_date ? new Date(l.end_date).toLocaleDateString() : '—'}</td>
                        <td>{l.reason || '—'}</td>
                        <td>
                          <span
                            className={`badge ${
                              isApproved
                                ? 'badge-success'
                                : (l.status || '').toUpperCase() === 'REJECTED'
                                ? 'badge-danger'
                                : 'badge-warning'
                            }`}
                          >
                            {isApproved ? 'CLEARED FOR GATE' : l.status || 'PENDING'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
