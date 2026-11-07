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
  AlertCircle,
  Plus,
  Wrench,
  Clock,
  CheckCircle2,
  Calendar,
} from 'lucide-react';

export default function ComplaintsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [complaints, setComplaints] = useState([]);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [formData, setFormData] = useState({
    category: 'ELECTRICAL',
    priority: 'MEDIUM',
    title: '',
    description: '',
  });

  const fetchComplaints = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await studentService.listComplaints();
      setComplaints(data);
    } catch (err) {
      setError(err.message || 'Failed to retrieve maintenance complaints.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComplaints();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.title.trim() || !formData.description.trim()) {
      setFormError('Please provide both a title and description of the issue.');
      return;
    }

    try {
      setSubmitting(true);
      await studentService.fileComplaint({
        category: formData.category,
        priority: formData.priority,
        title: formData.title.trim(),
        description: formData.description.trim(),
      });
      setShowModal(false);
      setFormData({
        category: 'ELECTRICAL',
        priority: 'MEDIUM',
        title: '',
        description: '',
      });
      fetchComplaints();
    } catch (err) {
      setFormError(err.message || 'Failed to file grievance.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Hostel Maintenance & Grievances"
        subtitle="Log electrical, plumbing, sanitation or internet issues and track resolution"
        icon={AlertCircle}
        actions={
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => setShowModal(true)}
          >
            File Grievance
          </Button>
        }
      />

      {loading ? (
        <LoadingState message="Loading your maintenance complaints..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchComplaints} />
      ) : complaints.length === 0 ? (
        <EmptyState
          title="No grievances reported"
          description="Everything in your room and hostel is in good order. You have no active maintenance complaints."
          icon={Wrench}
          action={
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => setShowModal(true)}
            >
              Report an Issue
            </Button>
          }
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {complaints.map((item) => (
            <Card key={item.id} style={{ padding: '20px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div style={{ flex: 1, minWidth: '280px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a' }}>
                      {item.title}
                    </span>
                    <Badge variant={item.status}>{item.status}</Badge>
                    <Badge variant="info">{item.category}</Badge>
                    <Badge variant={item.priority === 'URGENT' || item.priority === 'HIGH' ? 'danger' : 'warning'}>
                      {item.priority}
                    </Badge>
                  </div>
                  <p style={{ margin: '0 0 10px 0', fontSize: '0.86rem', color: '#334155' }}>
                    {item.description}
                  </p>
                  {item.resolution_notes && (
                    <div
                      style={{
                        padding: '10px 12px',
                        backgroundColor: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                        borderRadius: '8px',
                        fontSize: '0.82rem',
                        color: '#166534',
                        marginBottom: '8px',
                      }}
                    >
                      <strong>Resolution Notes:</strong> {item.resolution_notes}
                    </div>
                  )}
                  <div style={{ fontSize: '0.78rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Calendar size={13} />
                    <span>Reported: {new Date(item.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* File Complaint Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Report Hostel Grievance / Maintenance"
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

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Category
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                style={{
                  width: '100%',
                  padding: '9px 10px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.88rem',
                  outline: 'none',
                }}
              >
                <option value="ELECTRICAL">Electrical (Fan/Light/Switch)</option>
                <option value="PLUMBING">Plumbing (Tap/Drain/Toilet)</option>
                <option value="CARPENTRY">Carpentry (Bed/Door/Cupboard)</option>
                <option value="CLEANLINESS">Sanitation / Housekeeping</option>
                <option value="INTERNET">Wi-Fi / LAN Connection</option>
                <option value="OTHER">Other Grievance</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Urgency Priority
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                style={{
                  width: '100%',
                  padding: '9px 10px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.88rem',
                  outline: 'none',
                }}
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High Priority</option>
                <option value="URGENT">Urgent / Emergency</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Summary Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Ceiling fan not working in Room 204"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
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

          <div style={{ marginBottom: '22px' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Detailed Description *
            </label>
            <textarea
              required
              rows={4}
              placeholder="Provide exact details of the defect, location, and severity..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              Submit Grievance
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
