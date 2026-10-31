import React, { useState, useEffect } from 'react';
import api from '../../../shared/api/api';
import { useAuth } from '../../../shared/auth/useAuth';

export default function InchargeDashboardPage() {
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
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '20px', borderLeft: '4px solid #38bdf8' }}>
          <div style={{ fontSize: '0.85rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Active Allocations</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#f8fafc', marginTop: '6px' }}>{allocations.length}</div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>Beds currently occupied</div>
        </div>

        <div className="card" style={{ padding: '20px', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ fontSize: '0.85rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Open Complaints</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#f8fafc', marginTop: '6px' }}>{complaints.length}</div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>Maintenance tickets pending</div>
        </div>

        <div className="card" style={{ padding: '20px', borderLeft: '4px solid #10b981' }}>
          <div style={{ fontSize: '0.85rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Managed Blocks</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#f8fafc', marginTop: '6px' }}>{hostels.length}</div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>Hostel buildings assigned</div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '16px', color: '#f8fafc' }}>
          Recent Resident Complaints
        </h3>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Issue</th>
                <th>Category</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {complaints.length === 0 ? (
                <tr>
                  <td colSpan="3" style={{ textAlign: 'center', color: '#64748b', padding: '32px' }}>
                    {loading ? 'Loading operational complaints...' : 'No open maintenance issues.'}
                  </td>
                </tr>
              ) : (
                complaints.slice(0, 5).map((c, i) => (
                  <tr key={c.id || i}>
                    <td><strong>{c.title}</strong></td>
                    <td>{c.category}</td>
                    <td><span className="badge badge-warning">{c.status}</span></td>
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

