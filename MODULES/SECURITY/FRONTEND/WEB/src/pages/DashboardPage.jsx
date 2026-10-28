import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import useAuth from '../hooks/useAuth';

export default function DashboardPage() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState([]);
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

      const [assignRes, gatesRes, leavesRes] = await Promise.allSettled([
        api.get('/college/security-assignments'),
        api.get('/college/gates'),
        api.get('/college/leaves'),
      ]);

      if (assignRes.status === 'fulfilled') {
        const data = assignRes.value.data || assignRes.value;
        setAssignments(Array.isArray(data) ? data : data.assignments || data.data || []);
      }

      if (gatesRes.status === 'fulfilled') {
        const data = gatesRes.value.data || gatesRes.value;
        setGates(Array.isArray(data) ? data : data.gates || data.data || []);
      }

      if (leavesRes.status === 'fulfilled') {
        const data = leavesRes.value.data || leavesRes.value;
        const allLeaves = Array.isArray(data) ? data : data.leaves || data.data || [];
        // Filter approved leaves for gate verification
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

  const activeGatesCount = gates.filter((g) => g.is_active !== false).length;

  return (
    <div className="portal-container">
      <div className="page-header">
        <div>
          <h2 className="page-title">Campus Security Command</h2>
          <p className="page-description">
            Gate station checkpoint assignments, status overview, and approved student outpasses.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={fetchDashboardData} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh Records'}
        </button>
      </div>

      {error && (
        <div className="alert alert-error">
          <span className="alert-icon">⚠️</span>
          <div className="alert-content">{error}</div>
        </div>
      )}

      {/* KPI Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Security Gates</div>
          <div className="stat-value">{gates.length}</div>
          <div className="stat-subtext">{activeGatesCount} operational checkpoints</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active Assignments</div>
          <div className="stat-value">{assignments.length}</div>
          <div className="stat-subtext">Security staff on duty</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Approved Outpasses</div>
          <div className="stat-value">{activeLeaves.length}</div>
          <div className="stat-subtext">Authorized departures/leaves</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Station Operator</div>
          <div className="stat-value" style={{ fontSize: '1.2rem', padding: '0.4rem 0' }}>
            {user?.roleName || 'Security'}
          </div>
          <div className="stat-subtext">College ID: {user?.collegeId || 'Active'}</div>
        </div>
      </div>

      {/* Active Duty Assignments */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Current Security Assignments</h3>
          <span className="badge badge-info">{assignments.length} Total</span>
        </div>
        <div className="card-body">
          {loading ? (
            <div className="loading-state">Loading staff assignments...</div>
          ) : assignments.length === 0 ? (
            <div className="empty-state">
              <p>No active security gate assignments found in the system.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Gate Name / Checkpoint</th>
                    <th>Staff Name / ID</th>
                    <th>Shift</th>
                    <th>Assigned From</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((asgn) => (
                    <tr key={asgn.id || asgn.assignment_id}>
                      <td>
                        <strong>{asgn.gate_name || asgn.gate_id || 'Gate Station'}</strong>
                      </td>
                      <td>{asgn.staff_name || asgn.staff_id || '—'}</td>
                      <td>{asgn.shift_name || `${asgn.shift_start || ''} - ${asgn.shift_end || ''}` || 'Standard'}</td>
                      <td>{asgn.assigned_from ? new Date(asgn.assigned_from).toLocaleDateString() : '—'}</td>
                      <td>
                        <span
                          className={`badge ${
                            asgn.is_active !== false ? 'badge-success' : 'badge-neutral'
                          }`}
                        >
                          {asgn.is_active !== false ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Authorized Outpasses for Verification */}
      <div className="card" style={{ marginTop: '2rem' }}>
        <div className="card-header">
          <h3 className="card-title">Approved Student Leaves & Gate Outpasses</h3>
          <Link to="/leaves" className="btn btn-link btn-sm">
            View All Approved Outpasses →
          </Link>
        </div>
        <div className="card-body">
          {loading ? (
            <div className="loading-state">Loading authorized leave records...</div>
          ) : activeLeaves.length === 0 ? (
            <div className="empty-state">
              <p>No active approved leave records awaiting gate clearance.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Student ID / Reg</th>
                    <th>Leave Type</th>
                    <th>Valid From</th>
                    <th>Valid Until</th>
                    <th>Reason</th>
                    <th>Verification Status</th>
                  </tr>
                </thead>
                <tbody>
                  {activeLeaves.slice(0, 5).map((l) => (
                    <tr key={l.id || l.leave_id}>
                      <td>
                        <strong>{l.student_id || l.reg_number || 'Student'}</strong>
                      </td>
                      <td>{l.leave_type || l.type || 'General'}</td>
                      <td>{l.start_date ? new Date(l.start_date).toLocaleDateString() : '—'}</td>
                      <td>{l.end_date ? new Date(l.end_date).toLocaleDateString() : '—'}</td>
                      <td>{l.reason || '—'}</td>
                      <td>
                        <span className="badge badge-success">APPROVED FOR EXIT</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
