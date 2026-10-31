import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../../shared/api/api';
import { useAuth } from '../../../shared/auth/useAuth';

export default function SecurityDashboardPage() {
  const { user } = useAuth();
  const [gates, setGates] = useState([]);
  const [activeLeaves, setActiveLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [gatesRes, leavesRes] = await Promise.allSettled([
        api.get('/college/gates'),
        api.get('/college/leaves'),
      ]);

      if (gatesRes.status === 'fulfilled') {
        const data = gatesRes.value.data || gatesRes.value;
        setGates(Array.isArray(data) ? data : data.gates || data.data || []);
      }

      if (leavesRes.status === 'fulfilled') {
        const data = leavesRes.value.data || leavesRes.value;
        const allLeaves = Array.isArray(data) ? data : data.leaves || data.data || [];
        setActiveLeaves(
          allLeaves.filter((l) => (l.status || '').toUpperCase() === 'APPROVED')
        );
      }
    } catch (err) {
      setError(err.message || 'Failed to load security dashboard records.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="header-container">
        <div>
          <h1 className="page-title">Campus Security & Gate Operations</h1>
          <p className="page-subtitle">Verify student entry/exit passes and manage campus checkpoint clearance.</p>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: '8px', color: '#fca5a5', marginBottom: '20px' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Security Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '20px', borderLeft: '4px solid #10b981' }}>
          <div style={{ fontSize: '0.85rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Active Gate Passes</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#f8fafc', marginTop: '6px' }}>{activeLeaves.length}</div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>Approved for campus exit/entry</div>
        </div>

        <div className="card" style={{ padding: '20px', borderLeft: '4px solid #38bdf8' }}>
          <div style={{ fontSize: '0.85rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Operational Gates</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#f8fafc', marginTop: '6px' }}>{gates.length}</div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>Active checkpoints</div>
        </div>
      </div>

      {/* Active Passes Table */}
      <div className="card">
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '16px', color: '#f8fafc' }}>
          Approved Student Gate Passes
        </h3>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Reason / Purpose</th>
                <th>Exit Authorized</th>
                <th>Expected Return</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {activeLeaves.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', color: '#64748b', padding: '32px' }}>
                    {loading ? 'Scanning checkpoint passes...' : 'No active gate passes awaiting clearance.'}
                  </td>
                </tr>
              ) : (
                activeLeaves.map((l, i) => (
                  <tr key={l.id || i}>
                    <td><strong>{l.reason || 'Official Outing'}</strong></td>
                    <td>{l.start_date || 'Today'}</td>
                    <td>{l.end_date || 'Tonight'}</td>
                    <td><span className="badge badge-success">VALID PASS</span></td>
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

