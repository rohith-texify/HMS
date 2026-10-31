import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../../shared/api/api';

export default function ParentStudentDetailPage() {
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
    <div>
      <div className="header-container">
        <div>
          <h1 className="page-title">Ward Profile Details</h1>
          <p className="page-subtitle">Detailed verification information from college hostel records.</p>
        </div>
        <Link
          to="/parent/dashboard"
          style={{
            padding: '8px 16px',
            backgroundColor: '#334155',
            color: '#f8fafc',
            textDecoration: 'none',
            borderRadius: '6px',
            fontSize: '0.875rem',
            fontWeight: 500,
          }}
        >
          ← Back to Dashboard
        </Link>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: '8px', color: '#fca5a5', marginBottom: '20px' }}>
          ⚠️ {error}
        </div>
      )}

      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
          Loading ward profile...
        </div>
      ) : student ? (
        <div className="card">
          <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc', marginBottom: '16px' }}>
            {student.first_name} {student.last_name}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>Admission Number</div>
              <div style={{ fontSize: '1rem', fontWeight: 600, marginTop: '4px' }}>{student.admission_number || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>Department / Batch</div>
              <div style={{ fontSize: '1rem', fontWeight: 600, marginTop: '4px' }}>{student.department || 'Undergraduate'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>Hostel Block</div>
              <div style={{ fontSize: '1rem', fontWeight: 600, marginTop: '4px' }}>{student.hostel_name || 'Block A'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>Status</div>
              <div style={{ marginTop: '4px' }}><span className="badge badge-success">ACTIVE RESIDENT</span></div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
          No profile information found.
        </div>
      )}
    </div>
  );
}

