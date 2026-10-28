import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function GatesPage() {
  const [gates, setGates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchGates();
  }, []);

  const fetchGates = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/college/gates');
      const data = res.data || res;
      setGates(Array.isArray(data) ? data : data.gates || data.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load gate checkpoints.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="portal-container">
      <div className="page-header">
        <div>
          <h2 className="page-title">Campus Gate Checkpoints</h2>
          <p className="page-description">
            Configured campus gates, entry/exit operational points, and status.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={fetchGates} disabled={loading}>
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
          <h3 className="card-title">Configured Gate Checkpoints</h3>
          <span className="badge badge-info">{gates.length} Gates</span>
        </div>
        <div className="card-body">
          {loading ? (
            <div className="loading-state">Loading gate directory...</div>
          ) : gates.length === 0 ? (
            <div className="empty-state">
              <p>No campus gates currently registered in the database.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Gate Name</th>
                    <th>Gate Code / ID</th>
                    <th>Location / Landmark</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {gates.map((g) => (
                    <tr key={g.id || g.gate_id}>
                      <td>
                        <strong>{g.name || g.gate_name || 'Main Gate'}</strong>
                      </td>
                      <td>{g.gate_code || g.id || g.gate_id || '—'}</td>
                      <td>{g.location || g.description || 'Campus Perimeter'}</td>
                      <td>
                        <span
                          className={`badge ${
                            g.is_active !== false ? 'badge-success' : 'badge-danger'
                          }`}
                        >
                          {g.is_active !== false ? 'OPERATIONAL' : 'CLOSED'}
                        </span>
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
