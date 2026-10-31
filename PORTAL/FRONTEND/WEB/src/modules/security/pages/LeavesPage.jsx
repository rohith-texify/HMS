import React, { useState, useEffect } from 'react';
import api from '../../../shared/api/api';

export default function SecurityLeavesPage() {
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
          <h1 className="page-title">Student Gate Passes & Outings</h1>
          <p className="page-subtitle">Verify QR tokens and approve physical campus entry/exit.</p>
        </div>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Reason</th>
                <th>Out Time</th>
                <th>Expected In</th>
                <th>Gate Verification</th>
              </tr>
            </thead>
            <tbody>
              {leaves.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', color: '#64748b', padding: '32px' }}>
                    {loading ? 'Scanning active gate passes...' : 'No active gate passes found.'}
                  </td>
                </tr>
              ) : (
                leaves.map((l, i) => (
                  <tr key={l.id || i}>
                    <td><strong>{l.reason || 'Weekend Outing'}</strong></td>
                    <td>{l.start_date || 'Today'}</td>
                    <td>{l.end_date || 'Tonight'}</td>
                    <td><span className="badge badge-success">{l.status || 'CLEARED'}</span></td>
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

