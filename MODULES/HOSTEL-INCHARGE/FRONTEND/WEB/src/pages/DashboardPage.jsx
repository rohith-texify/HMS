import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../hooks/useAuth';

export default function DashboardPage() {
  const { user } = useAuth();
  const [hostels, setHostels] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [hostRes, compRes, allocRes] = await Promise.allSettled([
          api.get('/college/hostels'),
          api.get('/college/complaints'),
          api.get('/college/bed-allocations/current'),
        ]);

        if (hostRes.status === 'fulfilled') {
          const d = hostRes.value.data || hostRes.value;
          setHostels(Array.isArray(d) ? d : d?.hostels || []);
        }
        if (compRes.status === 'fulfilled') {
          const d = compRes.value.data || compRes.value;
          setComplaints(Array.isArray(d) ? d : d?.complaints || []);
        }
        if (allocRes.status === 'fulfilled') {
          const d = allocRes.value.data || allocRes.value;
          setAllocations(Array.isArray(d) ? d : d?.allocations || []);
        }
      } catch (err) {
        console.error('Failed to load incharge data:', err);
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
          <h1 className="page-title">Hostel Operations Dashboard</h1>
          <p className="page-subtitle">Track room occupancy, handle maintenance requests, and oversee student welfare.</p>
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Assigned Role: <strong>{user?.roleName || user?.role || 'Hostel Incharge'}</strong>
        </div>
      </div>

      <div className="grid-3">
        <div className="stat-card">
          <div className="stat-icon">🏢</div>
          <div>
            <div className="stat-value">{loading ? '...' : hostels.length}</div>
            <div className="stat-label">Assigned Hostels</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🛏️</div>
          <div>
            <div className="stat-value">{loading ? '...' : allocations.length}</div>
            <div className="stat-label">Current Bed Allocations</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🔧</div>
          <div>
            <div className="stat-value">{loading ? '...' : complaints.length}</div>
            <div className="stat-label">Open Complaints</div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '16px' }}>Recent Student Complaints & Issues</h2>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Category</th>
                <th>Severity</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {complaints.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    {loading ? 'Loading issues...' : 'No complaints reported.'}
                  </td>
                </tr>
              ) : (
                complaints.slice(0, 5).map((c, i) => (
                  <tr key={c.id || i}>
                    <td><strong>{c.title || c.description?.substring(0, 30) || 'Complaint'}</strong></td>
                    <td>{c.category || 'Maintenance'}</td>
                    <td>{c.severity || 'Normal'}</td>
                    <td><span className="badge badge-pending">{c.status || 'PENDING'}</span></td>
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
