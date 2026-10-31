import React, { useState, useEffect } from 'react';
import api from '../../../shared/api/api';

export default function ParentLeavesPage() {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get('/college/leaves');
        const d = res.data || res;
        setLeaves(Array.isArray(d) ? d : d?.leaves || []);
      } catch (err) {
        console.error('Failed to load parent leaves:', err);
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
          <h1 className="page-title">Ward Leave History</h1>
          <p className="page-subtitle">Historical records of home leaves, outings, and warden clearances.</p>
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
                <th>Clearance Status</th>
              </tr>
            </thead>
            <tbody>
              {leaves.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', color: '#64748b', padding: '32px' }}>
                    {loading ? 'Loading leave history...' : 'No historical leave records found.'}
                  </td>
                </tr>
              ) : (
                leaves.map((l, i) => (
                  <tr key={l.id || i}>
                    <td><strong>{l.reason || 'Leave Permission'}</strong></td>
                    <td>{l.start_date || '—'}</td>
                    <td>{l.end_date || '—'}</td>
                    <td><span className="badge badge-success">{l.status || 'APPROVED'}</span></td>
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

