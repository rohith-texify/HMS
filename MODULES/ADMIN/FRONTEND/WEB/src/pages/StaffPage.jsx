import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function StaffPage() {
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
                  <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    {loading ? 'Loading staff records...' : 'No staff records found.'}
                  </td>
                </tr>
              ) : (
                staff.map((st, i) => (
                  <tr key={st.id || i}>
                    <td><strong>{st.first_name} {st.last_name}</strong></td>
                    <td>{st.staff_code || '—'}</td>
                    <td>{st.designation || 'Staff'}</td>
                    <td>{st.email || '—'}</td>
                    <td><span className="badge badge-active">{st.status || 'ACTIVE'}</span></td>
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
