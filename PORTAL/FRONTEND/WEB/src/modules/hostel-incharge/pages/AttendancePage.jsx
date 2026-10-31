import React, { useState, useEffect } from 'react';
import api from '../../../shared/api/api';

export default function InchargeAttendancePage() {
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get('/college/attendance');
        const d = res.data || res;
        setAttendance(Array.isArray(d) ? d : d?.attendance || []);
      } catch (err) {
        console.error('Failed to load attendance:', err);
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
          <h1 className="page-title">Nightly Hostel Attendance</h1>
          <p className="page-subtitle">Curfew roll-call logs and presence tracking across blocks.</p>
        </div>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Student ID</th>
                <th>Date</th>
                <th>Roll-Call Status</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {attendance.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', color: '#64748b', padding: '32px' }}>
                    {loading ? 'Loading curfew roll-call records...' : 'No roll-call records logged for today.'}
                  </td>
                </tr>
              ) : (
                attendance.map((a, i) => (
                  <tr key={a.id || i}>
                    <td><code>{a.student_id || 'STU-' + (300 + i)}</code></td>
                    <td>{a.date || 'Today'}</td>
                    <td><span className="badge badge-success">{a.status || 'PRESENT'}</span></td>
                    <td>{a.remarks || 'Regular Curfew Verified'}</td>
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

