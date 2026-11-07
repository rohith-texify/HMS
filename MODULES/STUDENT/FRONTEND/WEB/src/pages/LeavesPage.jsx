import React, { useState, useEffect } from 'react';
import { studentService } from '../services/studentService';
import {
  PageHeader,
  Card,
  Badge,
  Button,
  Modal,
  LoadingState,
  ErrorState,
  EmptyState,
} from '../components';
import {
  Plane,
  Plus,
  Calendar,
  Clock,
  ShieldCheck,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

export default function LeavesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [leaves, setLeaves] = useState([]);

  // Modal State
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [formData, setFormData] = useState({
    leave_type: 'HOME',
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date(Date.now() + 2 * 86400 * 1000).toISOString().slice(0, 10),
    reason: '',
    parent_consent: true,
  });

  const fetchLeaves = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await studentService.listLeaves();
      setLeaves(data);
    } catch (err) {
      setError(err.message || 'Failed to retrieve leave applications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, []);

  const handleApply = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.reason.trim()) {
      setFormError('Please describe the purpose of your leave.');
      return;
    }

    try {
      setSubmitting(true);
      await studentService.applyLeave({
        leave_type: formData.leave_type,
        start_date: new Date(formData.start_date).toISOString(),
        end_date: new Date(formData.end_date).toISOString(),
        reason: formData.reason.trim(),
        parent_consent: formData.parent_consent,
      });
      setShowApplyModal(false);
      setFormData({
        leave_type: 'HOME',
        start_date: new Date().toISOString().slice(0, 10),
        end_date: new Date(Date.now() + 2 * 86400 * 1000).toISOString().slice(0, 10),
        reason: '',
        parent_consent: true,
      });
      fetchLeaves();
    } catch (err) {
      setFormError(err.message || 'Failed to submit leave application.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Hostel Leave Applications"
        subtitle="Submit home visit leaves, medical excuses, and monitor parent approval status"
        icon={Plane}
        actions={
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => setShowApplyModal(true)}
          >
            Apply Leave
          </Button>
        }
      />

      {loading ? (
        <LoadingState message="Loading your leave applications..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchLeaves} />
      ) : leaves.length === 0 ? (
        <EmptyState
          title="No leave requests filed"
          description="You do not have any active or past leave requests."
          icon={Plane}
          action={
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => setShowApplyModal(true)}
            >
              Apply for Leave
            </Button>
          }
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {leaves.map((leave) => (
            <Card key={leave.id} style={{ padding: '20px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a' }}>
                      {leave.leave_type} LEAVE
                    </span>
                    <Badge variant={leave.status}>{leave.status}</Badge>
                    <Badge variant={leave.parent_consent_status === 'APPROVED' ? 'success' : 'warning'}>
                      Parent: {leave.parent_consent_status}
                    </Badge>
                  </div>
                  <div style={{ fontSize: '0.88rem', color: '#334155', marginBottom: '8px' }}>
                    <strong>Reason:</strong> {leave.reason}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      fontSize: '0.8rem',
                      color: '#64748b',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Calendar size={13} />
                      <span>Period: {new Date(leave.start_date).toLocaleDateString()} to {new Date(leave.end_date).toLocaleDateString()}</span>
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Clock size={13} />
                      <span>Applied: {new Date(leave.created_at).toLocaleDateString()}</span>
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Apply Leave Modal */}
      <Modal
        isOpen={showApplyModal}
        onClose={() => setShowApplyModal(false)}
        title="Apply for Hostel Leave"
      >
        {formError && (
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              color: '#991b1b',
              fontSize: '0.84rem',
              marginBottom: '16px',
            }}
          >
            {formError}
          </div>
        )}

        <form onSubmit={handleApply}>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Leave Category
            </label>
            <select
              value={formData.leave_type}
              onChange={(e) => setFormData({ ...formData, leave_type: e.target.value })}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.9rem',
                outline: 'none',
              }}
            >
              <option value="HOME">Home Visit</option>
              <option value="MEDICAL">Medical Treatment / Sick Leave</option>
              <option value="ACADEMIC">Academic / Internship / Project</option>
              <option value="EMERGENCY">Family Emergency</option>
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Start Date
              </label>
              <input
                type="date"
                required
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                style={{
                  width: '100%',
                  padding: '9px 10px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.86rem',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                End Date (Return)
              </label>
              <input
                type="date"
                required
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                style={{
                  width: '100%',
                  padding: '9px 10px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.86rem',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Detailed Reason *
            </label>
            <textarea
              required
              rows={3}
              placeholder="State the reason and travel destination..."
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.9rem',
                boxSizing: 'border-box',
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />
          </div>

          <div style={{ marginBottom: '22px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem', color: '#334155', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.parent_consent}
                onChange={(e) => setFormData({ ...formData, parent_consent: e.target.checked })}
                style={{ accentColor: '#2563eb', width: '16px', height: '16px' }}
              />
              <span>Send digital consent approval notification to registered Parent / Guardian</span>
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <Button variant="secondary" onClick={() => setShowApplyModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              Apply Leave
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
