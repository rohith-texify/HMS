import React, { useState, useEffect } from 'react';
import api from '../../../shared/api/api';

export default function AdminStaffPage() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get('/college/staff');
        const d = res.data || res;
        setStaff(Array.isArray(d) ? d : d?.staff || []);
      } catch (err) {
        console.error('Failed to load staff:', err);
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
          <h1 className="page-title">College Staff & In-Charges</h1>
          <p className="page-subtitle">Authorized personnel managing institutional hostels.</p>
        </div>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Staff Name</th>
                <th>Staff Code</th>
                <th>Designation</th>
                <th>Email</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {staff.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', color: '#64748b', padding: '32px' }}>
                    {loading ? 'Loading staff records...' : 'No staff records found.'}
                  </td>
                </tr>
              ) : (
                staff.map((st, idx) => (
                  <tr key={st.id || idx}>
                    <td><strong>{st.name || st.first_name || 'Staff Member #' + (idx + 1)}</strong></td>
                    <td><code>{st.code || 'STF-' + (200 + idx)}</code></td>
                    <td>{st.designation || 'Warden'}</td>
                    <td>{st.email || '—'}</td>
                    <td><span className="badge badge-success">{st.status || 'ACTIVE'}</span></td>
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

