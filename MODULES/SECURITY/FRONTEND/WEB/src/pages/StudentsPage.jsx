import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function StudentsPage() {
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/college/students');
      const data = res.data || res;
      setStudents(Array.isArray(data) ? data : data.students || data.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load student directory.');
    } finally {
      setLoading(false);
    }
  };

  const filtered = students.filter((s) => {
    const q = search.toLowerCase();
    const name = `${s.first_name || ''} ${s.last_name || ''} ${s.full_name || ''}`.toLowerCase();
    const reg = (s.reg_number || s.admission_number || '').toLowerCase();
    return name.includes(q) || reg.includes(q);
  });

  return (
    <div className="portal-container">
      <div className="page-header">
        <div>
          <h2 className="page-title">Campus Student Directory</h2>
          <p className="page-description">
            Search student identification and enrollment details for gate verification.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={fetchStudents} disabled={loading}>
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
        <div className="card-header" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <h3 className="card-title">Enrolled Students</h3>
          <div style={{ marginLeft: 'auto', minWidth: '240px' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Search by name or reg #..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="card-body">
          {loading ? (
            <div className="loading-state">Loading students...</div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <p>No matching student records found.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Reg / ID</th>
                    <th>Full Name</th>
                    <th>Room / Bed</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((st) => (
                    <tr key={st.id || st.student_id}>
                      <td>
                        <strong>{st.reg_number || st.admission_number || '—'}</strong>
                      </td>
                      <td>
                        {st.full_name ||
                          `${st.first_name || ''} ${st.last_name || ''}`.trim() ||
                          '—'}
                      </td>
                      <td>
                        {st.room_number ? `Room ${st.room_number}` : 'Unassigned'}
                        {st.bed_label ? ` (Bed ${st.bed_label})` : ''}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            st.status === 'ACTIVE' ? 'badge-success' : 'badge-neutral'
                          }`}
                        >
                          {st.status || 'Active'}
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
