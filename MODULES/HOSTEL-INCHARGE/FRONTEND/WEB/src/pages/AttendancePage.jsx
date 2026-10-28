import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function AttendancePage() {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get('/college/leaves');
        const d = res.data || res;
        setLeaves(Array.isArray(d) ? d : d?.leaves || []);
      } catch (err) {
        console.error('Failed to load leaves:', err);
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
          <h1 className="page-title">Student Leaves & Gate Passes</h1>
          <p className="page-subtitle">Review active night outs and vacation permissions.</p>
        </div>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Leave ID</th>
                <th>Reason</th>
                <th>From Date</th>
                <th>To Date</th>
                <th>Decision Status</th>
              </tr>
            </thead>
            <tbody>
              {leaves.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    {loading ? 'Loading leave applications...' : 'No leave applications logged.'}
                  </td>
                </tr>
              ) : (
                leaves.map((l, i) => (
                  <tr key={l.id || i}>
                    <td><strong>{l.id?.substring(0, 8)}...</strong></td>
                    <td>{l.reason || 'General leave'}</td>
                    <td>{l.from_date || '—'}</td>
                    <td>{l.to_date || '—'}</td>
                    <td><span className="badge badge-pending">{l.status || 'PENDING'}</span></td>
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
