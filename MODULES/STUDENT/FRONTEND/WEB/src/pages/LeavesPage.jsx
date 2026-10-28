import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function LeavesPage() {
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
          <h1 className="page-title">My Leave Applications</h1>
          <p className="page-subtitle">Track status of home visits, night-outs, and gate pass approvals.</p>
        </div>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Reason</th>
                <th>From Date</th>
                <th>To Date</th>
                <th>Approval Status</th>
              </tr>
            </thead>
            <tbody>
              {leaves.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    {loading ? 'Loading leave applications...' : 'No leave applications submitted.'}
                  </td>
                </tr>
              ) : (
                leaves.map((l, i) => (
                  <tr key={l.id || i}>
                    <td><strong>{l.reason || 'Leave request'}</strong></td>
                    <td>{l.from_date || '—'}</td>
                    <td>{l.to_date || '—'}</td>
                    <td><span className="badge badge-active">{l.status || 'PENDING'}</span></td>
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
