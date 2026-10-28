import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../hooks/useAuth';

export default function DashboardPage() {
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
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          College Context: <strong>{user?.collegeId ? user.collegeId.substring(0, 8) + '...' : 'Active Tenant'}</strong>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px', background: '#fef2f2', color: '#b91c1c', borderRadius: '8px', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid-3">
        <div className="stat-card">
          <div className="stat-icon">🎓</div>
          <div>
            <div className="stat-value">{loading ? '...' : students.length}</div>
            <div className="stat-label">Enrolled Students</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🏢</div>
          <div>
            <div className="stat-value">{loading ? '...' : hostels.length}</div>
            <div className="stat-label">Active Hostels</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <div>
            <div className="stat-value">{loading ? '...' : staff.length}</div>
            <div className="stat-label">Administrative Staff</div>
          </div>
        </div>
      </div>

      {/* Hostels Table */}
      <div className="card">
        <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '16px' }}>Hostel Infrastructure Overview</h2>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Hostel Name</th>
                <th>Code</th>
                <th>Gender Type</th>
                <th>Capacity</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {hostels.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    {loading ? 'Loading hostels...' : 'No hostels registered yet.'}
                  </td>
                </tr>
              ) : (
                hostels.map((h, i) => (
                  <tr key={h.id || i}>
                    <td><strong>{h.name || 'Unnamed Hostel'}</strong></td>
                    <td>{h.code || '—'}</td>
                    <td>{h.gender_type || 'CO-ED'}</td>
                    <td>{h.capacity || '0'} beds</td>
                    <td><span className="badge badge-active">{h.status || 'ACTIVE'}</span></td>
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
