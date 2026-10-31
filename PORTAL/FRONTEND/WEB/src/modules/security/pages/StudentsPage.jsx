import React, { useState, useEffect } from 'react';
import api from '../../../shared/api/api';

export default function SecurityStudentsPage() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get('/college/students');
        const d = res.data || res;
        setStudents(Array.isArray(d) ? d : d?.students || []);
      } catch (err) {
        console.error('Failed to load students:', err);
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
          <h1 className="page-title">Resident Student Verification</h1>
          <p className="page-subtitle">Verify student biometric and photo records at physical gates.</p>
        </div>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Student Name</th>
                <th>Admission No</th>
                <th>Hostel Block</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {students.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', color: '#64748b', padding: '32px' }}>
                    {loading ? 'Loading student records...' : 'No student records found.'}
                  </td>
                </tr>
              ) : (
                students.map((s, idx) => (
                  <tr key={s.id || idx}>
                    <td><strong>{s.first_name ? `${s.first_name} ${s.last_name || ''}` : s.name || 'Student #' + (idx + 1)}</strong></td>
                    <td><code>{s.admission_number || 'ADM-' + (1000 + idx)}</code></td>
                    <td>{s.hostel_name || 'Block A'}</td>
                    <td><span className="badge badge-success">{s.status || 'ACTIVE'}</span></td>
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

