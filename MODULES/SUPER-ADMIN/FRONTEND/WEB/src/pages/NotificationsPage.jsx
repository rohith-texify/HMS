import React, { useState, useEffect } from 'react';
import {
  Bell,
  Send,
  AlertTriangle,
  CheckCircle,
  Clock,
  Filter,
  XCircle,
  Eye,
  Building,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import {
  fetchPlatformNotifications,
  previewNotificationAudience,
  createPlatformNotification,
  cancelPlatformNotification,
} from '../services/operationsService';
import { fetchCollegesList } from '../services/collegeService';

export default function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');

  // Composition Modal
  const [showModal, setShowModal] = useState(false);
  const [colleges, setColleges] = useState([]);
  const [formData, setFormData] = useState({
    notification_type: 'SYSTEM',
    title: '',
    message: '',
    priority: 'NORMAL',
    target_type: 'SELECTED_COLLEGES',
    college_ids: [],
  });
  const [audiencePreview, setAudiencePreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(null);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchPlatformNotifications({
        status: statusFilter,
        notification_type: typeFilter,
        search,
        limit: 25,
        offset: 0,
      });
      setNotifications(res?.data || []);
      setTotal(res?.total || 0);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [statusFilter, typeFilter]);

  useEffect(() => {
    fetchCollegesList({ limit: 100 })
      .then((res) => setColleges(res?.colleges || res || []))
      .catch(() => {});
  }, []);

  const handleAudiencePreview = async (targetType, collegeIds) => {
    try {
      const res = await previewNotificationAudience(targetType, collegeIds);
      setAudiencePreview(res?.data || null);
    } catch (err) {
      console.error('Audience preview error:', err);
    }
  };

  const handleCreateNotification = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);
      const res = await createPlatformNotification(formData);
      setSubmitSuccess(
        res?.approval_request
          ? 'System-wide broadcast proposal submitted to Approval Workflow (Module 16).'
          : 'Notification published successfully to targeted college portals.'
      );
      setShowModal(false);
      setFormData({
        notification_type: 'SYSTEM',
        title: '',
        message: '',
        priority: 'NORMAL',
        target_type: 'SELECTED_COLLEGES',
        college_ids: [],
      });
      setAudiencePreview(null);
      loadNotifications();
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to compose notification');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelNotification = async (id) => {
    const reason = window.prompt('Enter reason for cancellation:');
    if (!reason) return;
    try {
      await cancelPlatformNotification(id, reason);
      loadNotifications();
    } catch (err) {
      alert(err?.response?.data?.error || err.message || 'Failed to cancel notification');
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="header-container">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>📢</span>
            <span>Notification & Broadcast Management</span>
          </h1>
          <p className="page-subtitle">
            Publish official platform announcements, advisories, and targeted maintenance broadcasts to College Admin portals.
          </p>
        </div>
        <div className="quick-actions">
          <button
            onClick={() => loadNotifications()}
            className="btn btn-outline"
            title="Refresh announcements list"
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => {
              setShowModal(true);
              handleAudiencePreview('SELECTED_COLLEGES', []);
            }}
            className="btn btn-primary"
            id="btn-compose-announcement"
          >
            <Send size={14} />
            <span>+ Compose Announcement</span>
          </button>
        </div>
      </div>

      {submitSuccess && (
        <div className="alert-banner success">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle size={18} />
            <span>{submitSuccess}</span>
          </div>
          <button
            onClick={() => setSubmitSuccess(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold', color: 'inherit' }}
          >
            ✕
          </button>
        </div>
      )}

      {error && (
        <div className="alert-banner error">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold', color: 'inherit' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Filter Card */}
      <div className="filter-card">
        <div className="filter-grid">
          <div className="filter-group">
            <label className="filter-label" htmlFor="filter-status">Lifecycle Status</label>
            <select
              id="filter-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="form-select"
            >
              <option value="">All Statuses</option>
              <option value="PUBLISHED">Published</option>
              <option value="DRAFT">Draft</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="EXPIRED">Expired</option>
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label" htmlFor="filter-type">Category</label>
            <select
              id="filter-type"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="form-select"
            >
              <option value="">All Categories</option>
              <option value="SYSTEM">System Notice</option>
              <option value="MAINTENANCE">Maintenance</option>
              <option value="SECURITY">Security Alert</option>
              <option value="FEATURE">Feature Release</option>
              <option value="GENERAL">General</option>
            </select>
          </div>

          <div className="filter-group" style={{ flex: '1 1 280px' }}>
            <label className="filter-label" htmlFor="filter-search">Search Announcements</label>
            <input
              id="filter-search"
              type="text"
              placeholder="Search by title, message or creator..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadNotifications()}
              className="form-input"
              style={{ width: '100%' }}
            />
          </div>

          <button
            type="button"
            onClick={() => loadNotifications()}
            className="btn btn-outline"
            style={{ height: '36px', alignSelf: 'flex-end' }}
          >
            Apply Filters
          </button>
        </div>
      </div>

      {/* Announcements Directory Table Card */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="loading-box" style={{ border: 'none' }}>
            <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Loading announcements...</div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="empty-box" style={{ border: 'none', padding: '56px 20px' }}>
            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>📢</div>
            <div style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '6px' }}>
              No notifications found
            </div>
            <div className="empty-text" style={{ marginBottom: '20px' }}>
              Compose an official broadcast announcement to reach all or selected College Administrators.
            </div>
            <button
              onClick={() => {
                setShowModal(true);
                handleAudiencePreview('SELECTED_COLLEGES', []);
              }}
              className="btn btn-primary"
            >
              + Compose Announcement
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Title & Details</th>
                  <th>Category</th>
                  <th>Priority</th>
                  <th>Target Audience</th>
                  <th>Status</th>
                  <th>Created By</th>
                  <th>Date</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {notifications.map((n) => (
                  <tr key={n.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{n.title}</div>
                      <div
                        style={{
                          fontSize: '0.78rem',
                          color: 'var(--text-secondary)',
                          marginTop: '2px',
                          maxWidth: '380px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {n.message}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-muted">{n.notification_type}</span>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          n.priority === 'URGENT'
                            ? 'badge-danger'
                            : n.priority === 'HIGH'
                            ? 'badge-warning'
                            : 'badge-info'
                        }`}
                      >
                        {n.priority}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}>
                        <span>🏫</span>
                        <span>{n.target_type === 'ALL_COLLEGES' ? 'All Active Colleges' : 'Selected Tenants'}</span>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          n.status === 'PUBLISHED'
                            ? 'badge-success'
                            : n.status === 'DRAFT'
                            ? 'badge-warning'
                            : 'badge-muted'
                        }`}
                      >
                        {n.status}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      {n.created_by_name || 'Super Admin'}
                    </td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      {new Date(n.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {n.status !== 'CANCELLED' && (
                        <button
                          onClick={() => handleCancelNotification(n.id)}
                          className="btn btn-outline btn-sm"
                          style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Composition Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-dialog" style={{ maxWidth: '620px' }}>
            <div className="modal-header">
              <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Send size={18} color="var(--primary-color)" />
                <span>Compose Platform Announcement</span>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateNotification}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select
                      value={formData.notification_type}
                      onChange={(e) => setFormData({ ...formData, notification_type: e.target.value })}
                      className="form-select"
                      style={{ width: '100%' }}
                    >
                      <option value="SYSTEM">System Announcement</option>
                      <option value="MAINTENANCE">Scheduled Maintenance</option>
                      <option value="SECURITY">Security Notice</option>
                      <option value="FEATURE">Feature Release</option>
                      <option value="GENERAL">General Notice</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Priority Level</label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                      className="form-select"
                      style={{ width: '100%' }}
                    >
                      <option value="LOW">Low</option>
                      <option value="NORMAL">Normal</option>
                      <option value="HIGH">High</option>
                      <option value="URGENT">Urgent</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Target Audience</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                    <div
                      onClick={() => {
                        setFormData({ ...formData, target_type: 'SELECTED_COLLEGES' });
                        handleAudiencePreview('SELECTED_COLLEGES', formData.college_ids);
                      }}
                      style={{
                        padding: '12px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        border: formData.target_type === 'SELECTED_COLLEGES' ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                        backgroundColor: formData.target_type === 'SELECTED_COLLEGES' ? 'rgba(37, 99, 235, 0.05)' : 'var(--bg-card)',
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Selected Colleges</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Target specific institutions</div>
                    </div>

                    <div
                      onClick={() => {
                        setFormData({ ...formData, target_type: 'ALL_COLLEGES' });
                        handleAudiencePreview('ALL_COLLEGES', []);
                      }}
                      style={{
                        padding: '12px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        border: formData.target_type === 'ALL_COLLEGES' ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                        backgroundColor: formData.target_type === 'ALL_COLLEGES' ? 'rgba(37, 99, 235, 0.05)' : 'var(--bg-card)',
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Company-Wide Broadcast</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Requires Approval Workflow</div>
                    </div>
                  </div>

                  {formData.target_type === 'SELECTED_COLLEGES' && (
                    <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '10px', maxHeight: '140px', overflowY: 'auto' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Select Target Colleges:</div>
                      {colleges.map((col) => (
                        <label key={col.college_id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', fontSize: '0.82rem', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={formData.college_ids.includes(col.college_id)}
                            onChange={(e) => {
                              const updated = e.target.checked
                                ? [...formData.college_ids, col.college_id]
                                : formData.college_ids.filter((id) => id !== col.college_id);
                              setFormData({ ...formData, college_ids: updated });
                              handleAudiencePreview('SELECTED_COLLEGES', updated);
                            }}
                          />
                          <span>{col.name} ({col.college_code})</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {audiencePreview && (
                  <div className={`alert-banner ${audiencePreview.RequiresReview ? 'warning' : 'info'}`} style={{ padding: '10px 14px', marginBottom: '14px' }}>
                    <div style={{ fontSize: '0.82rem' }}>
                      <strong>Target Audience:</strong> {audiencePreview.EligibleCount} Colleges eligible
                      {audiencePreview.ApprovalNote && <div>{audiencePreview.ApprovalNote}</div>}
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Announcement Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Scheduled Network Upgrade Advisory"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="form-input"
                    style={{ width: '100%' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Message Content</label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Enter detailed broadcast body..."
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="form-textarea"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary"
                >
                  {submitting ? 'Submitting...' : formData.target_type === 'ALL_COLLEGES' ? 'Submit for Approval' : 'Publish Announcement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
