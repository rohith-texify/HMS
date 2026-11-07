import React, { useState, useEffect } from 'react';
import { studentService } from '../services/studentService';
import {
  PageHeader,
  StatCard,
  Card,
  Badge,
  LoadingState,
  ErrorState,
  EmptyState,
} from '../components';
import {
  CalendarCheck2,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
} from 'lucide-react';

export default function AttendancePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [attendance, setAttendance] = useState(null);

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await studentService.getAttendance();
      setAttendance(data);
    } catch (err) {
      setError(err.message || 'Failed to retrieve attendance history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, []);

  if (loading) {
    return <LoadingState message="Loading your attendance & roll-call records..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={fetchAttendance} />;
  }

  const { total_sessions, present_count, absent_count, on_leave_count, attendance_percentage, recent_records } = attendance || {};

  return (
    <div>
      <PageHeader
        title="Hostel Attendance & Roll-Call Verification"
        subtitle="Daily evening roll-call logs, biometric verification history, and attendance compliance"
        icon={CalendarCheck2}
      />

      {/* Stats Summary */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <StatCard
          label="Attendance Rate"
          value={`${(attendance_percentage || 100).toFixed(1)}%`}
          subtext="Overall Verified Sessions"
          icon={CalendarCheck2}
          color="#059669"
        />
        <StatCard
          label="Present Sessions"
          value={present_count || 0}
          subtext="Verified Roll-Calls"
          icon={CheckCircle2}
          color="#2563eb"
        />
        <StatCard
          label="Absent"
          value={absent_count || 0}
          subtext="Unverified Nights"
          icon={XCircle}
          color="#dc2626"
        />
        <StatCard
          label="Approved Leave"
          value={on_leave_count || 0}
          subtext="Permitted Off-Campus"
          icon={Clock}
          color="#d97706"
        />
      </div>

      {/* Records Table */}
      <Card title="Roll-Call Verification Logs" subtitle="Chronological session logs recorded by hostel in-charge & security post">
        {(!recent_records || recent_records.length === 0) ? (
          <EmptyState
            title="No roll-call logs yet"
            description="Attendance records will populate once evening roll-calls are logged by your hostel warden."
            icon={CalendarCheck2}
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                  <th style={{ padding: '12px 14px', fontWeight: 600 }}>Date</th>
                  <th style={{ padding: '12px 14px', fontWeight: 600 }}>Session Type</th>
                  <th style={{ padding: '12px 14px', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '12px 14px', fontWeight: 600 }}>Verification Method</th>
                  <th style={{ padding: '12px 14px', fontWeight: 600 }}>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {recent_records.map((rec) => (
                  <tr key={rec.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 600, color: '#0f172a' }}>
                      {new Date(rec.attendance_date).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#334155' }}>
                      {rec.session_type}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <Badge variant={rec.status}>{rec.status}</Badge>
                    </td>
                    <td style={{ padding: '12px 14px', color: '#64748b' }}>
                      {rec.verification_method || 'MANUAL_WARDEN'}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#64748b' }}>
                      {rec.remarks || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

