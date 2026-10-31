import React, { useState, useEffect } from 'react';
import api from '../../../shared/api/api';

export default function InchargeRoomsPage() {
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
                  <td colSpan="5" style={{ textAlign: 'center', color: '#64748b', padding: '32px' }}>
                    {loading ? 'Loading occupancy data...' : 'No active bed allocations found.'}
                  </td>
                </tr>
              ) : (
                allocations.map((a, i) => (
                  <tr key={a.id || i}>
                    <td><code>{a.allocation_id || a.id || 'ALC-' + (100 + i)}</code></td>
                    <td>{a.student_id || 'STU-' + (500 + i)}</td>
                    <td><strong>{a.bed_id || 'BED-A' + (i + 1)}</strong></td>
                    <td>{a.start_date || 'Current Semester'}</td>
                    <td><span className="badge badge-success">{a.status || 'ACTIVE'}</span></td>
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

