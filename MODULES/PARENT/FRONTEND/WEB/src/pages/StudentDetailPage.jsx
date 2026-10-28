import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';

export default function StudentDetailPage() {
  const { studentId } = useParams();
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStudentDetail = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/college/students/${studentId}`);
      const data = res.data || res;
      setStudent(data.student || data);
    } catch (err) {
      setError(
        err.response?.status === 403
          ? 'Access forbidden. You are not authorized to view details for this student.'
          : err.message || 'Failed to load student details.'
      );
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    if (studentId) {
      fetchStudentDetail();
    }
  }, [studentId, fetchStudentDetail]);

  return (
    <div className="portal-container">
      <div className="page-header">
        <div>
          <h2 className="page-title">Ward Profile Details</h2>
          <p className="page-description">
            Detailed information verified by college hostel records.
          </p>
        </div>
        <Link to="/dashboard" className="btn btn-secondary">
          ← Back to Dashboard
        </Link>
      </div>

      {error && (
        <div className="alert alert-error">
          <span className="alert-icon">⚠️</span>
          <div className="alert-content">{error}</div>
        </div>
      )}

      {loading ? (
        <div className="card">
          <div className="card-body">
            <div className="loading-state">Loading student profile...</div>
          </div>
        </div>
      ) : student ? (
        <div className="profile-grid">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Academic & Personal Details</h3>
              <span
                className={`badge ${
                  student.status === 'ACTIVE' ? 'badge-success' : 'badge-neutral'
                }`}
              >
                {student.status || 'Active'}
              </span>
            </div>
            <div className="card-body">
              <div className="detail-list">
                <div className="detail-item">
                  <span className="detail-label">Full Name:</span>
                  <span className="detail-val">
                    {student.full_name ||
                      `${student.first_name || ''} ${student.last_name || ''}`.trim() ||
                      '—'}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Registration Number:</span>
                  <span className="detail-val">{student.reg_number || '—'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Email Address:</span>
                  <span className="detail-val">{student.email || '—'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Department / Branch:</span>
                  <span className="detail-val">{student.department || '—'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Year of Study:</span>
                  <span className="detail-val">{student.year_of_study || '—'}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Hostel & Accommodation</h3>
            </div>
            <div className="card-body">
              <div className="detail-list">
                <div className="detail-item">
                  <span className="detail-label">Hostel Name:</span>
                  <span className="detail-val">{student.hostel_name || 'Assigned Block'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Room Number:</span>
                  <span className="detail-val">{student.room_number || 'Pending'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Bed Assignment:</span>
                  <span className="detail-val">{student.bed_label || 'Pending'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Admission Date:</span>
                  <span className="detail-val">
                    {student.created_at
                      ? new Date(student.created_at).toLocaleDateString()
                      : '—'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
