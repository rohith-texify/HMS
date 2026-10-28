import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function RoomsPage() {
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get('/college/bed-allocations/current');
        const d = res.data || res;
        setAllocations(Array.isArray(d) ? d : d?.allocations || []);
      } catch (err) {
        console.error('Failed to load allocations:', err);
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
          <h1 className="page-title">Bed Allocations & Occupancy</h1>
          <p className="page-subtitle">Manage student room allocations and room inventories.</p>
        </div>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Allocation ID</th>
                <th>Student ID</th>
                <th>Bed ID</th>
                <th>Allocated From</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {allocations.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    {loading ? 'Loading occupancy data...' : 'No active bed allocations found.'}
                  </td>
                </tr>
              ) : (
                allocations.map((a, i) => (
                  <tr key={a.id || i}>
                    <td><strong>{a.id?.substring(0, 8)}...</strong></td>
                    <td>{a.student_id ? a.student_id.substring(0, 8) + '...' : '—'}</td>
                    <td>{a.bed_id ? a.bed_id.substring(0, 8) + '...' : '—'}</td>
                    <td>{a.from_date || a.created_at || '—'}</td>
                    <td><span className="badge badge-resolved">{a.status || 'ALLOCATED'}</span></td>
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
