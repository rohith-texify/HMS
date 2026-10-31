import React, { useState, useEffect } from 'react';
import api from '../../../shared/api/api';
import { useAuth } from '../../../shared/auth/useAuth';

export default function StudentDashboardPage() {
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
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '20px', borderLeft: '4px solid #38bdf8' }}>
          <div style={{ fontSize: '0.85rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Room Status</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', marginTop: '6px' }}>
            {allocation ? `Room ${allocation.room_number || '101'}` : 'Allocated'}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>Active Semester Residency</div>
        </div>

        <div className="card" style={{ padding: '20px', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ fontSize: '0.85rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Active Complaints</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#f8fafc', marginTop: '6px' }}>{complaints.length}</div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>Maintenance tickets</div>
        </div>

        <div className="card" style={{ padding: '20px', borderLeft: '4px solid #10b981' }}>
          <div style={{ fontSize: '0.85rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Approved Leaves</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#f8fafc', marginTop: '6px' }}>{leaves.length}</div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>Gate passes on file</div>
        </div>
      </div>

      {/* Recent Leaves Table */}
      <div className="card">
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '16px', color: '#f8fafc' }}>Recent Gate Passes & Leaves</h3>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Reason</th>
                <th>From Date</th>
                <th>To Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {leaves.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', color: '#64748b', padding: '32px' }}>
                    {loading ? 'Loading leave status...' : 'No active leaves submitted.'}
                  </td>
                </tr>
              ) : (
                leaves.map((l, i) => (
                  <tr key={l.id || i}>
                    <td><strong>{l.reason || 'Home Visit'}</strong></td>
                    <td>{l.start_date || 'Today'}</td>
                    <td>{l.end_date || 'Tomorrow'}</td>
                    <td><span className="badge badge-success">{l.status || 'APPROVED'}</span></td>
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

