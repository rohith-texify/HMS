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
  QrCode,
  Plus,
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Calendar,
} from 'lucide-react';

export default function GatePassPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [passes, setPasses] = useState([]);

  // Apply Modal state
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [formData, setFormData] = useState({
    pass_type: 'DAY',
    reason: '',
    destination: '',
    valid_from: new Date().toISOString().slice(0, 16),
    valid_until: new Date(Date.now() + 4 * 3600 * 1000).toISOString().slice(0, 16),
  });

  // QR Modal state
  const [selectedPass, setSelectedPass] = useState(null);

  const fetchPasses = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await studentService.listGatePasses();
      setPasses(data);
    } catch (err) {
      setError(err.message || 'Failed to retrieve gate passes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPasses();
  }, []);

  const handleApply = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.reason.trim()) {
      setFormError('Please describe the reason for campus exit.');
      return;
    }

    try {
      setSubmitting(true);
      await studentService.requestGatePass({
        pass_type: formData.pass_type,
        reason: formData.reason.trim(),
        destination: formData.destination ? formData.destination.trim() : undefined,
        valid_from: new Date(formData.valid_from).toISOString(),
        valid_until: new Date(formData.valid_until).toISOString(),
      });
      setShowApplyModal(false);
      setFormData({
        pass_type: 'DAY',
        reason: '',
        destination: '',
        valid_from: new Date().toISOString().slice(0, 16),
        valid_until: new Date(Date.now() + 4 * 3600 * 1000).toISOString().slice(0, 16),
      });
      fetchPasses();
    } catch (err) {
      setFormError(err.message || 'Failed to submit gate pass request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Gate Passes & Digital QR Verification"
        subtitle="Manage daily campus exit passes, overnight permissions, and security digital slips"
        icon={QrCode}
        actions={
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => setShowApplyModal(true)}
          >
            Apply Gate Pass
          </Button>
        }
      />

      {loading ? (
        <LoadingState message="Loading your gate pass history..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchPasses} />
      ) : passes.length === 0 ? (
        <EmptyState
          title="No gate passes requested"
          description="You do not have any active or past gate pass applications."
          icon={QrCode}
          action={
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => setShowApplyModal(true)}
            >
              Request First Pass
            </Button>
          }
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {passes.map((pass) => (
            <Card key={pass.id} style={{ padding: '20px' }}>
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
                      {pass.pass_number}
                    </span>
                    <Badge variant={pass.status}>{pass.status}</Badge>
                    <Badge variant="info">{pass.pass_type}</Badge>
                  </div>
                  <div style={{ fontSize: '0.88rem', color: '#334155', marginBottom: '8px' }}>
                    <strong>Reason:</strong> {pass.reason}
                    {pass.destination && <span> • <strong>Destination:</strong> {pass.destination}</span>}
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
                      <Clock size={13} />
                      <span>Valid: {new Date(pass.valid_from).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} - {new Date(pass.valid_until).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Calendar size={13} />
                      <span>Requested: {new Date(pass.created_at).toLocaleDateString()}</span>
                    </span>
                  </div>
                </div>

                <div>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={QrCode}
                    onClick={() => setSelectedPass(pass)}
                  >
                    View Digital Pass
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Apply Gate Pass Modal */}
      <Modal
        isOpen={showApplyModal}
        onClose={() => setShowApplyModal(false)}
        title="Apply for Campus Gate Pass"
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
              Pass Type
            </label>
            <select
              value={formData.pass_type}
              onChange={(e) => setFormData({ ...formData, pass_type: e.target.value })}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.9rem',
                outline: 'none',
              }}
            >
              <option value="DAY">Day Out Pass (Same Day Return)</option>
              <option value="OVERNIGHT">Overnight Pass (Night Exit)</option>
              <option value="EMERGENCY">Emergency Exit Pass</option>
            </select>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Destination / Address
            </label>
            <input
              type="text"
              placeholder="e.g. City Market, Hospital, Home"
              value={formData.destination}
              onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.9rem',
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Exit Date & Time
              </label>
              <input
                type="datetime-local"
                value={formData.valid_from}
                onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
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
                Return Expected Time
              </label>
              <input
                type="datetime-local"
                value={formData.valid_until}
                onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
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

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Reason for Exit *
            </label>
            <textarea
              required
              rows={3}
              placeholder="Please provide explicit reason for campus exit..."
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

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <Button variant="secondary" onClick={() => setShowApplyModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              Submit Request
            </Button>
          </div>
        </form>
      </Modal>

      {/* Digital QR Pass Modal */}
      {selectedPass && (
        <Modal
          isOpen={Boolean(selectedPass)}
          onClose={() => setSelectedPass(null)}
          title="Digital Gate Pass Slip"
          maxWidth="440px"
        >
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            {/* Visual Digital QR Container */}
            <div
              style={{
                width: '180px',
                height: '180px',
                margin: '0 auto 18px auto',
                padding: '16px',
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                border: '2px dashed #2563eb',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 16px -4px rgba(37, 99, 235, 0.15)',
              }}
            >
              <QrCode size={110} color="#0f172a" />
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#2563eb', marginTop: '8px', letterSpacing: '0.04em' }}>
                SCAN AT SECURITY GATE
              </span>
            </div>

            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>
              {selectedPass.pass_number}
            </div>
            <div style={{ marginBottom: '16px' }}>
              <Badge variant={selectedPass.status}>{selectedPass.status}</Badge>
            </div>

            <div
              style={{
                backgroundColor: '#f8fafc',
                borderRadius: '12px',
                padding: '14px',
                textAlign: 'left',
                fontSize: '0.84rem',
                color: '#334155',
                lineHeight: 1.6,
                marginBottom: '18px',
              }}
            >
              <div><strong>Pass Type:</strong> {selectedPass.pass_type}</div>
              <div><strong>Destination:</strong> {selectedPass.destination || 'Campus Vicinity'}</div>
              <div><strong>Valid Until:</strong> {new Date(selectedPass.valid_until).toLocaleString()}</div>
              <div><strong>Reason:</strong> {selectedPass.reason}</div>
            </div>

            <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
              Present this pass at campus security turnstile or perimeter checkpoint.
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

