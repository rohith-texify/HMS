import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../hooks/useAuth';

export default function DashboardPage() {
  const { user } = useAuth();
  const [allocation, setAllocation] = useState(null);
  const [complaints, setComplaints] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [allocRes, compRes, leaveRes] = await Promise.allSettled([
          api.get('/college/bed-allocations/current'),
          api.get('/college/complaints'),
          api.get('/college/leaves'),
        ]);

        if (allocRes.status === 'fulfilled') {
          const d = allocRes.value.data || allocRes.value;
          const list = Array.isArray(d) ? d : d?.allocations || [];
          setAllocation(list[0] || null);
        }
        if (compRes.status === 'fulfilled') {
          const d = compRes.value.data || compRes.value;
          setComplaints(Array.isArray(d) ? d : d?.complaints || []);
        }
        if (leaveRes.status === 'fulfilled') {
          const d = leaveRes.value.data || leaveRes.value;
          setLeaves(Array.isArray(d) ? d : d?.leaves || []);
        }
      } catch (err) {
        console.error('Failed to load student dashboard:', err);
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
          <h1 className="page-title">Welcome, Student</h1>
          <p className="page-subtitle">Your hostel residency status, active requests, and room allocation.</p>
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Profile: <strong>{user?.email}</strong>
        </div>
      </div>

      <div className="grid-3">
        <div className="stat-card">
          <div className="stat-icon">🛏️</div>
          <div>
            <div className="stat-value">{allocation ? 'Allocated' : 'Not Assigned'}</div>
            <div className="stat-label">Room & Bed Allocation</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">✈️</div>
          <div>
            <div className="stat-value">{loading ? '...' : leaves.length}</div>
            <div className="stat-label">My Leave Requests</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🔧</div>
          <div>
            <div className="stat-value">{loading ? '...' : complaints.length}</div>
            <div className="stat-label">Logged Complaints</div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '16px' }}>My Active Bed Allocation Details</h2>
        {allocation ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Allocation ID</div>
              <div style={{ fontWeight: 600 }}>{allocation.id}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Bed Reference</div>
              <div style={{ fontWeight: 600 }}>{allocation.bed_id || 'Assigned'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Allocated Date</div>
              <div style={{ fontWeight: 600 }}>{allocation.from_date || allocation.created_at || 'Current'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Status</div>
              <div style={{ fontWeight: 600 }}><span className="badge badge-active">{allocation.status || 'ACTIVE'}</span></div>
            </div>
          </div>
        ) : (
          <div style={{ color: 'var(--text-muted)' }}>
            {loading ? 'Checking allocation records...' : 'No active bed allocation assigned. Please contact your hostel warden.'}
          </div>
        )}
      </div>
    </div>
  );
}
