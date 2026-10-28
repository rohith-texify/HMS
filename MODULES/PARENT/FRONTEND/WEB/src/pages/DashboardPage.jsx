import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import useAuth from '../hooks/useAuth';

export default function DashboardPage() {
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

      // Fetch students and leaves from verified college endpoints
      const [studentsRes, leavesRes] = await Promise.allSettled([
        api.get('/college/students'),
        api.get('/college/leaves'),
      ]);

      if (studentsRes.status === 'fulfilled') {
        const data = studentsRes.value.data || studentsRes.value;
        const list = Array.isArray(data) ? data : data.students || data.data || [];
        setStudents(list);
      } else {
        console.warn('Could not load student information:', studentsRes.reason);
      }

      if (leavesRes.status === 'fulfilled') {
        const data = leavesRes.value.data || leavesRes.value;
        const list = Array.isArray(data) ? data : data.leaves || data.data || [];
        setLeaves(list);
      } else {
        console.warn('Could not load leave requests:', leavesRes.reason);
      }
    } catch (err) {
      setError(err.message || 'Error loading dashboard records.');
    } finally {
      setLoading(false);
    }
  };

  const pendingLeaves = leaves.filter(
    (l) => (l.status || '').toUpperCase() === 'PENDING'
  ).length;

  const approvedLeaves = leaves.filter(
    (l) => (l.status || '').toUpperCase() === 'APPROVED'
  ).length;

  return (
    <div className="portal-container">
      <div className="page-header">
        <div>
          <h2 className="page-title">Parent Dashboard</h2>
          <p className="page-description">
            Overview of your ward&apos;s hostel status, active records, and leave requests.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={fetchParentData} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh Records'}
        </button>
      </div>

      {error && (
        <div className="alert alert-error">
          <span className="alert-icon">⚠️</span>
          <div className="alert-content">{error}</div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Associated Wards</div>
          <div className="stat-value">{students.length}</div>
          <div className="stat-subtext">Registered under your guardian account</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pending Leaves</div>
          <div className="stat-value">{pendingLeaves}</div>
          <div className="stat-subtext">Awaiting administrative decision</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Approved Leaves</div>
          <div className="stat-value">{approvedLeaves}</div>
          <div className="stat-subtext">Processed and authorized</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Guardian Scope</div>
          <div className="stat-value" style={{ fontSize: '1.25rem', padding: '0.4rem 0' }}>
            {user?.roleName || 'Parent'}
          </div>
          <div className="stat-subtext">College ID: {user?.collegeId || 'Active'}</div>
        </div>
      </div>

      {/* Wards Section */}
      <div className="card" style={{ marginTop: '2rem' }}>
        <div className="card-header">
          <h3 className="card-title">Ward Information</h3>
          <span className="badge badge-info">{students.length} Student(s)</span>
        </div>
        <div className="card-body">
          {loading ? (
            <div className="loading-state">Loading ward details...</div>
          ) : students.length === 0 ? (
            <div className="empty-state">
              <p>No student profiles linked directly to this guardian account in the database.</p>
              <small>Contact college hostel administration to associate your email with your ward.</small>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Registration No</th>
                    <th>Name</th>
                    <th>Room / Bed</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((st) => (
                    <tr key={st.id || st.student_id || st.reg_number}>
                      <td>
                        <strong>{st.reg_number || st.admission_number || '—'}</strong>
                      </td>
                      <td>
                        {st.full_name || `${st.first_name || ''} ${st.last_name || ''}`.trim() || '—'}
                      </td>
                      <td>
                        {st.room_number ? `Room ${st.room_number}` : 'Unassigned'}
                        {st.bed_label ? ` (Bed ${st.bed_label})` : ''}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            st.status === 'ACTIVE' ? 'badge-success' : 'badge-neutral'
                          }`}
                        >
                          {st.status || 'Active'}
                        </span>
                      </td>
                      <td>
                        <Link
                          to={`/students/${st.id || st.student_id}`}
                          className="btn btn-secondary btn-sm"
                        >
                          View Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Recent Leaves Section */}
      <div className="card" style={{ marginTop: '2rem' }}>
        <div className="card-header">
          <h3 className="card-title">Recent Leave Applications</h3>
          <Link to="/leaves" className="btn btn-link btn-sm">
            View All Leaves →
          </Link>
        </div>
        <div className="card-body">
          {loading ? (
            <div className="loading-state">Loading leave applications...</div>
          ) : leaves.length === 0 ? (
            <div className="empty-state">
              <p>No leave records found for your ward.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Leave Type</th>
                    <th>Start Date</th>
                    <th>End Date</th>
                    <th>Reason</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {leaves.slice(0, 5).map((leave) => (
                    <tr key={leave.id || leave.leave_id}>
                      <td>{leave.leave_type || leave.type || 'Standard'}</td>
                      <td>{leave.start_date ? new Date(leave.start_date).toLocaleDateString() : '—'}</td>
                      <td>{leave.end_date ? new Date(leave.end_date).toLocaleDateString() : '—'}</td>
                      <td>{leave.reason || '—'}</td>
                      <td>
                        <span
                          className={`badge ${
                            leave.status === 'APPROVED'
                              ? 'badge-success'
                              : leave.status === 'REJECTED'
                              ? 'badge-danger'
                              : 'badge-warning'
                          }`}
                        >
                          {leave.status || 'PENDING'}
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
    </div>
  );
}
