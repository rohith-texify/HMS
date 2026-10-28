import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function StudentsPage() {
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
          <h1 className="page-title">Student Directory</h1>
          <p className="page-subtitle">Manage enrolled hostel students and parent relationships.</p>
        </div>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Student Name</th>
                <th>Admission No</th>
                <th>Gender</th>
                <th>Contact</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {students.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    {loading ? 'Loading student directory...' : 'No student records found.'}
                  </td>
                </tr>
              ) : (
                students.map((s, i) => (
                  <tr key={s.id || i}>
                    <td><strong>{s.first_name} {s.last_name}</strong></td>
                    <td>{s.admission_number || s.enrollment_no || '—'}</td>
                    <td>{s.gender || '—'}</td>
                    <td>{s.email || s.phone || '—'}</td>
                    <td><span className="badge badge-active">{s.status || 'ACTIVE'}</span></td>
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
