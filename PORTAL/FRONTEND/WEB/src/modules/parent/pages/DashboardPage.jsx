import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../../shared/api/api';
import { useAuth } from '../../../shared/auth/useAuth';

export default function ParentDashboardPage() {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchParentData();
  }, []);

  const fetchParentData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [studentsRes, leavesRes] = await Promise.allSettled([
        api.get('/college/students'),
        api.get('/college/leaves'),
      ]);

      if (studentsRes.status === 'fulfilled') {
        const data = studentsRes.value.data || studentsRes.value;
        const list = Array.isArray(data) ? data : data.students || data.data || [];
        setStudents(list);
      }
      if (leavesRes.status === 'fulfilled') {
        const data = leavesRes.value.data || leavesRes.value;
        const list = Array.isArray(data) ? data : data.leaves || data.data || [];
        setLeaves(list);
      }
    } catch (err) {
      setError(err.message || 'Error loading dashboard records.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="header-container">
        <div>
          <h1 className="page-title">Parent / Guardian Portal</h1>
          <p className="page-subtitle">Monitor ward residency, active gate passes, and college communications.</p>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: '8px', color: '#fca5a5', marginBottom: '20px' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '20px', borderLeft: '4px solid #38bdf8' }}>
          <div style={{ fontSize: '0.85rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Enrolled Wards</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#f8fafc', marginTop: '6px' }}>{students.length}</div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>Registered students linked</div>
        </div>

        <div className="card" style={{ padding: '20px', borderLeft: '4px solid #10b981' }}>
          <div style={{ fontSize: '0.85rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Leave Requests</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#f8fafc', marginTop: '6px' }}>{leaves.length}</div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>Approved & pending permissions</div>
        </div>
      </div>

      {/* Ward Cards */}
      <div className="card">
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '16px', color: '#f8fafc' }}>Registered Ward Directory</h3>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Ward Name</th>
                <th>Admission No</th>
                <th>Gender</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', color: '#64748b', padding: '32px' }}>
                    {loading ? 'Loading ward information...' : 'No enrolled wards linked to this account.'}
                  </td>
                </tr>
              ) : (
                students.map((st, i) => (
                  <tr key={st.student_id || st.id || i}>
                    <td><strong>{st.first_name ? `${st.first_name} ${st.last_name || ''}` : st.name || 'Ward #' + (i + 1)}</strong></td>
                    <td><code>{st.admission_number || 'ADM-' + (2000 + i)}</code></td>
                    <td>{st.gender || '—'}</td>
                    <td>
                      <Link
                        to={`/parent/students/${st.student_id || st.id || (i + 1)}`}
                        style={{ color: '#38bdf8', textDecoration: 'none', fontWeight: 600, fontSize: '0.85rem' }}
                      >
                        View Full Profile →
                      </Link>
                    </td>
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

