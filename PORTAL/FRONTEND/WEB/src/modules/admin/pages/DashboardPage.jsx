import React, { useState, useEffect } from 'react';
import api from '../../../shared/api/api';
import { useAuth } from '../../../shared/auth/useAuth';

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [hostels, setHostels] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [studRes, hostRes, staffRes] = await Promise.allSettled([
          api.get('/college/students'),
          api.get('/college/hostels'),
          api.get('/college/staff'),
        ]);

        if (studRes.status === 'fulfilled') {
          const d = studRes.value.data || studRes.value;
          setStudents(Array.isArray(d) ? d : d?.students || []);
        }
        if (hostRes.status === 'fulfilled') {
          const d = hostRes.value.data || hostRes.value;
          setHostels(Array.isArray(d) ? d : d?.hostels || []);
        }
        if (staffRes.status === 'fulfilled') {
          const d = staffRes.value.data || staffRes.value;
          setStaff(Array.isArray(d) ? d : d?.staff || []);
        }
      } catch (err) {
        setError(err.message || 'Failed to load college data');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  return (
    <div>
      <div className="header-container">
        <div>
          <h1 className="page-title">College Administration Dashboard</h1>
          <p className="page-subtitle">Overview of registered students, faculty, and hostel facilities.</p>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: '8px', color: '#fca5a5', marginBottom: '20px' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '20px', borderLeft: '4px solid #38bdf8' }}>
          <div style={{ fontSize: '0.85rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Total Students</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#f8fafc', marginTop: '6px' }}>{students.length}</div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>Active residents enrolled</div>
        </div>

        <div className="card" style={{ padding: '20px', borderLeft: '4px solid #10b981' }}>
          <div style={{ fontSize: '0.85rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Hostel Blocks</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#f8fafc', marginTop: '6px' }}>{hostels.length}</div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>Managed facilities</div>
        </div>

        <div className="card" style={{ padding: '20px', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ fontSize: '0.85rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>College Staff</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#f8fafc', marginTop: '6px' }}>{staff.length}</div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>Wardens & in-charges</div>
        </div>
      </div>

      {/* Overview Table */}
      <div className="card">
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '16px', color: '#f8fafc' }}>
          Institutional Facilities Overview
        </h3>
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
                    {loading ? 'Loading hostel structures...' : 'No hostels registered for this college.'}
                  </td>
                </tr>
              ) : (
                hostels.slice(0, 5).map((h, i) => (
                  <tr key={h.id || i}>
                    <td><strong>{h.name || 'Block ' + (i + 1)}</strong></td>
                    <td><code>{h.code || 'B-' + (i + 1)}</code></td>
                    <td>{h.type || 'CO-ED'}</td>
                    <td>{h.capacity || '120 Beds'}</td>
                    <td><span className="badge badge-success">ACTIVE</span></td>
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

