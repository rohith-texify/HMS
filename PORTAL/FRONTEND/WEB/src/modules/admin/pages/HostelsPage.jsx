import React, { useState, useEffect } from 'react';
import api from '../../../shared/api/api';

export default function AdminHostelsPage() {
  const [hostels, setHostels] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get('/college/hostels');
        const d = res.data || res;
        setHostels(Array.isArray(d) ? d : d?.hostels || []);
      } catch (err) {
        console.error('Failed to load hostels:', err);
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
          <h1 className="page-title">Hostels & Facility Master</h1>
          <p className="page-subtitle">Configure buildings, blocks, floors, and room inventory.</p>
        </div>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Hostel Name</th>
                <th>Building Code</th>
                <th>Gender Type</th>
                <th>Capacity</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {hostels.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', color: '#64748b', padding: '32px' }}>
                    {loading ? 'Loading hostel structures...' : 'No hostels registered.'}
                  </td>
                </tr>
              ) : (
                hostels.map((h, idx) => (
                  <tr key={h.id || idx}>
                    <td><strong>{h.name || 'Hostel Block ' + (idx + 1)}</strong></td>
                    <td><code>{h.code || 'B-' + (idx + 1)}</code></td>
                    <td>{h.type || 'CO-ED'}</td>
                    <td>{h.capacity || '100 Beds'}</td>
                    <td><span className="badge badge-success">{h.status || 'ACTIVE'}</span></td>
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

