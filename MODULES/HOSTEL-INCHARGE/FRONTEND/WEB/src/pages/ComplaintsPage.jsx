import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function ComplaintsPage() {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get('/college/complaints');
        const d = res.data || res;
        setComplaints(Array.isArray(d) ? d : d?.complaints || []);
      } catch (err) {
        console.error('Failed to load complaints:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div>
      <div className="header-container">
        <div>
          <h1 className="page-title">Complaints & Maintenance Requests</h1>
          <p className="page-subtitle">Inspect, assign, and resolve student complaints.</p>
        </div>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Title / Issue</th>
                <th>Category</th>
                <th>Severity</th>
                <th>Date Logged</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {complaints.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    {loading ? 'Loading complaints...' : 'No complaints logged.'}
                  </td>
                </tr>
              ) : (
                complaints.map((c, i) => (
                  <tr key={c.id || i}>
                    <td><strong>{c.title || c.description?.substring(0, 40) || 'Complaint'}</strong></td>
                    <td>{c.category || 'Maintenance'}</td>
                    <td>{c.severity || 'Normal'}</td>
                    <td>{c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}</td>
                    <td><span className="badge badge-pending">{c.status || 'PENDING'}</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
