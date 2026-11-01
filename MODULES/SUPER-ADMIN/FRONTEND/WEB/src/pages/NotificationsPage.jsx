import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  Send,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  XCircle,
  Eye,
  Building2,
  RotateCw,
  Search,
  X,
  ChevronRight,
  Sparkles,
  Radio,
  Megaphone,
  Check,
  AlertCircle,
  Calendar,
  Users,
  FileText,
  Layers,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import {
  fetchPlatformNotifications,
  previewNotificationAudience,
  createPlatformNotification,
  cancelPlatformNotification,
} from '../services/operationsService';
import { fetchCollegesList } from '../services/collegeService';

/**
 * Animated number count-up effect
 */
function CountUpNumber({ value, duration = 800 }) {
  const [displayValue, setDisplayValue] = useState(value);
  const prevValueRef = useRef(value);

  useEffect(() => {
    if (typeof value !== 'number') {
      setDisplayValue(value);
      return;
    }

    const start = prevValueRef.current || 0;
    const end = value;
    const range = end - start;
    if (range === 0) {
      setDisplayValue(end);
      return;
    }

    const startTime = performance.now();
    let frameId;

    const updateCount = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + range * easeProgress);

      setDisplayValue(current);

      if (progress < 1) {
        frameId = requestAnimationFrame(updateCount);
      } else {
        prevValueRef.current = end;
      }
    };

    frameId = requestAnimationFrame(updateCount);
    return () => cancelAnimationFrame(frameId);
  }, [value, duration]);

  return <span>{displayValue}</span>;
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Active Tab: 'ALL' | 'PUBLISHED' | 'DRAFT' | 'CANCELLED'
  const [activeTab, setActiveTab] = useState('ALL');

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [search, setSearch] = useState('');

  // Composition Modal
  const [showModal, setShowModal] = useState(false);
  const [colleges, setColleges] = useState([]);
  const [collegeSearch, setCollegeSearch] = useState('');
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

  // Cancel Confirmation Modal (Replaces window.prompt)
  const [cancelModal, setCancelModal] = useState({
    isOpen: false,
    notification: null,
    reason: '',
    submitting: false,
    error: null,
  });

  // View Details Modal
  const [detailModal, setDetailModal] = useState({
    isOpen: false,
    notification: null,
  });

  // Load Notifications
  const loadNotifications = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      setIsRefreshing(true);
      setError(null);

      let effectiveStatus = statusFilter;
      if (activeTab === 'PUBLISHED') effectiveStatus = 'PUBLISHED';
      else if (activeTab === 'DRAFT') effectiveStatus = 'DRAFT';
      else if (activeTab === 'CANCELLED') effectiveStatus = 'CANCELLED';

      const res = await fetchPlatformNotifications({
        status: effectiveStatus,
        notification_type: typeFilter,
        search,
        limit: 50,
        offset: 0,
      });

      setNotifications(res?.data || []);
      setTotal(res?.total || (res?.data || []).length);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to load announcements');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [activeTab, statusFilter, typeFilter, search]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Load Colleges List
  useEffect(() => {
    fetchCollegesList({ limit: 100 })
      .then((res) => setColleges(res?.colleges || res || []))
      .catch(() => {});
  }, []);

  // Audience Preview Handler
  const handleAudiencePreview = async (targetType, collegeIds) => {
    try {
      const res = await previewNotificationAudience(targetType, collegeIds);
      setAudiencePreview(res?.data || null);
    } catch (err) {
      console.error('Audience preview error:', err);
    }
  };

  // Submit New Broadcast
  const handleCreateNotification = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);
      const res = await createPlatformNotification(formData);
      setSubmitSuccess(
        res?.approval_request
          ? 'System-wide broadcast proposal submitted to Approval Workflow queue (Maker-Checker gate).'
          : 'Announcement broadcast published successfully to target institutional portals.'
      );
      setTimeout(() => setSubmitSuccess(null), 6000);
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
      loadNotifications(true);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to compose announcement');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Cancellation
  const handleConfirmCancel = async (e) => {
    e.preventDefault();
    if (!cancelModal.notification) return;
    if (!cancelModal.reason.trim()) {
      setCancelModal((p) => ({ ...p, error: 'A cancellation reason is required.' }));
      return;
    }

    setCancelModal((p) => ({ ...p, submitting: true, error: null }));
    try {
      await cancelPlatformNotification(cancelModal.notification.id, cancelModal.reason.trim());
      setSubmitSuccess(`Broadcast "${cancelModal.notification.title}" cancelled successfully.`);
      setTimeout(() => setSubmitSuccess(null), 6000);
      setCancelModal({ isOpen: false, notification: null, reason: '', submitting: false, error: null });
      loadNotifications(true);
    } catch (err) {
      setCancelModal((p) => ({
        ...p,
        submitting: false,
        error: err?.response?.data?.error || err.message || 'Failed to cancel notification',
      }));
    }
  };

  // KPI Statistics
  const stats = useMemo(() => {
    const totalCount = total;
    let publishedCount = 0;
    let urgentCount = 0;
    let allCollegesCount = 0;

    notifications.forEach((n) => {
      if (n.status === 'PUBLISHED') publishedCount++;
      if (n.priority === 'URGENT' || n.priority === 'HIGH') urgentCount++;
      if (n.target_type === 'ALL_COLLEGES') allCollegesCount++;
    });

    return { totalCount, publishedCount, urgentCount, allCollegesCount };
  }, [total, notifications]);

  // Filtered Notifications
  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      if (priorityFilter && n.priority !== priorityFilter) return false;
      return true;
    });
  }, [notifications, priorityFilter]);

  // Filtered Colleges in Modal
  const filteredColleges = useMemo(() => {
    if (!collegeSearch.trim()) return colleges;
    const q = collegeSearch.toLowerCase().trim();
    return colleges.filter((c) =>
      (c.name || '').toLowerCase().includes(q) || (c.college_code || c.code || '').toLowerCase().includes(q)
    );
  }, [colleges, collegeSearch]);

  const activeFiltersCount = (typeFilter ? 1 : 0) + (priorityFilter ? 1 : 0) + (search ? 1 : 0);

  return (
    <div className="notifications-page-container">
      {/* Breadcrumbs & Header Section */}
      <div className="notifications-header-section">
        <div className="notifications-header-left">
          <div className="breadcrumb-trail" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: '#64748B', marginBottom: '6px' }}>
            <Link to="/dashboard" style={{ color: '#64748B', textDecoration: 'none' }}>Dashboard</Link>
            <ChevronRight size={14} />
            <span style={{ color: '#0F172A', fontWeight: 600 }}>Platform Announcements</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <h1 className="page-title" style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
              Notification &amp; Broadcast Management
            </h1>
            <span className="audit-severity-pill info">
              <Radio size={11} />
              <span>LIVE BROADCAST CHANNEL</span>
            </span>
          </div>
          <p className="page-subtitle" style={{ fontSize: '0.86rem', color: '#64748B', margin: '4px 0 0 0' }}>
            Publish official platform announcements, system advisories, and targeted maintenance broadcasts to College Administrator portals.
          </p>
        </div>

        {/* Header Actions */}
        <div className="notifications-header-right">
          <button
            type="button"
            className="btn-enterprise btn-primary"
            onClick={() => {
              setShowModal(true);
              handleAudiencePreview('SELECTED_COLLEGES', []);
            }}
          >
            <Send size={14} />
            <span>Compose Announcement</span>
          </button>

          <button
            type="button"
            className={`btn-enterprise btn-outline-soft ${isRefreshing ? 'is-loading' : ''}`}
            onClick={() => loadNotifications(false)}
            disabled={isRefreshing}
          >
            <RotateCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Top 4 KPI Metric Cards */}
      <div className="notifications-kpi-grid">
        {/* Card 1: Total Announcements */}
        <div className="notifications-stat-card card-stagger-1">
          <div className="notifications-stat-header">
            <span className="notifications-stat-label">Total Broadcasts</span>
            <div className="notifications-stat-icon-wrap blue">
              <Megaphone size={18} />
            </div>
          </div>
          <div className="notifications-stat-value text-slate-900">
            <CountUpNumber value={stats.totalCount} />
          </div>
          <div className="notifications-stat-subtext">Registered platform notifications</div>
          <div className="notifications-stat-accent-bar blue" />
        </div>

        {/* Card 2: Active Published */}
        <div className="notifications-stat-card card-stagger-2">
          <div className="notifications-stat-header">
            <span className="notifications-stat-label">Active Published</span>
            <div className="notifications-stat-icon-wrap green">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="notifications-stat-value text-emerald-600">
            <CountUpNumber value={stats.publishedCount} />
          </div>
          <div className="notifications-stat-subtext">Live on college administrator portals</div>
          <div className="notifications-stat-accent-bar green" />
        </div>

        {/* Card 3: Urgent / High Priority */}
        <div className="notifications-stat-card card-stagger-3">
          <div className="notifications-stat-header">
            <span className="notifications-stat-label">Urgent Advisories</span>
            <div className="notifications-stat-icon-wrap amber">
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="notifications-stat-value text-amber-600">
            <CountUpNumber value={stats.urgentCount} />
          </div>
          <div className="notifications-stat-subtext">High priority alerts &amp; notices</div>
          <div className="notifications-stat-accent-bar amber" />
        </div>

        {/* Card 4: Company-wide Broadcasts */}
        <div className="notifications-stat-card card-stagger-4">
          <div className="notifications-stat-header">
            <span className="notifications-stat-label">System-Wide Broadcasts</span>
            <div className="notifications-stat-icon-wrap purple">
              <Radio size={18} />
            </div>
          </div>
          <div className="notifications-stat-value text-purple-600">
            <CountUpNumber value={stats.allCollegesCount} />
          </div>
          <div className="notifications-stat-subtext">Enforced four-eyes approval gate</div>
          <div className="notifications-stat-accent-bar purple" />
        </div>
      </div>

      {/* Dismissible Feedback Banner */}
      {submitSuccess && (
        <div className="alert alert-success" style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', animation: 'fadeIn 0.3s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={16} />
            <span>{submitSuccess}</span>
          </div>
          <button
            onClick={() => setSubmitSuccess(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 'bold' }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Global Error Banner */}
      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>
            <X size={15} />
          </button>
        </div>
      )}

      {/* Main Card Container */}
      <div className="notifications-main-card">
        {/* Navigation Toolbar */}
        <div className="notifications-toolbar">
          {/* Segmented Pill Tabs */}
          <div className="notifications-tabs-pillbox">
            <button
              type="button"
              className={`notifications-tab-pill ${activeTab === 'ALL' ? 'active' : ''}`}
              onClick={() => setActiveTab('ALL')}
            >
              <Megaphone size={14} />
              <span>All Announcements</span>
              <span className="pill-counter">{total}</span>
            </button>

            <button
              type="button"
              className={`notifications-tab-pill ${activeTab === 'PUBLISHED' ? 'active' : ''}`}
              onClick={() => setActiveTab('PUBLISHED')}
            >
              <CheckCircle2 size={14} />
              <span>Active Published</span>
              <span className="pill-counter">{stats.publishedCount}</span>
            </button>

            <button
              type="button"
              className={`notifications-tab-pill ${activeTab === 'DRAFT' ? 'active' : ''}`}
              onClick={() => setActiveTab('DRAFT')}
            >
              <Clock size={14} />
              <span>Drafts &amp; Queued</span>
            </button>

            <button
              type="button"
              className={`notifications-tab-pill ${activeTab === 'CANCELLED' ? 'active' : ''}`}
              onClick={() => setActiveTab('CANCELLED')}
            >
              <XCircle size={14} />
              <span>Cancelled / Expired</span>
            </button>
          </div>

          {/* Search & Filter Group */}
          <div className="notifications-filters-group">
            <div className="notifications-search-box">
              <Search size={15} style={{ color: '#94A3B8' }} />
              <input
                type="text"
                placeholder="Search title, message, author..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadNotifications(false)}
                className="notifications-search-input"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    loadNotifications(false);
                  }}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#94A3B8' }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Category Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="notifications-select-dropdown"
            >
              <option value="">All Categories</option>
              <option value="SYSTEM">System Announcement</option>
              <option value="MAINTENANCE">Maintenance Advisory</option>
              <option value="SECURITY">Security Notice</option>
              <option value="FEATURE">Feature Release</option>
              <option value="GENERAL">General Notice</option>
            </select>

            {/* Priority Filter */}
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="notifications-select-dropdown"
            >
              <option value="">All Priorities</option>
              <option value="LOW">Low Priority</option>
              <option value="NORMAL">Normal Priority</option>
              <option value="HIGH">High Priority</option>
              <option value="URGENT">Urgent Priority</option>
            </select>

            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setTypeFilter('');
                  setPriorityFilter('');
                }}
                className="btn-enterprise btn-outline-soft"
                style={{ fontSize: '0.78rem', padding: '6px 10px' }}
              >
                Reset ({activeFiltersCount})
              </button>
            )}
          </div>
        </div>

        {/* Content Body */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div className="spinner" style={{ margin: '0 auto 14px' }}></div>
            <p style={{ color: '#64748B', fontSize: '0.88rem' }}>Loading platform broadcast announcements...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="modules-empty-state">
            <Megaphone size={42} style={{ color: '#CBD5E1', marginBottom: '12px' }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1E293B', margin: '0 0 6px 0' }}>
              No Announcements Found
            </h3>
            <p style={{ fontSize: '0.82rem', color: '#64748B', maxWidth: '380px', margin: '0 0 16px 0' }}>
              {search || typeFilter || priorityFilter
                ? 'No announcements match your search or filter criteria.'
                : 'No platform broadcast announcements created yet.'}
            </p>
            <button
              type="button"
              className="btn-enterprise btn-primary"
              onClick={() => {
                setShowModal(true);
                handleAudiencePreview('SELECTED_COLLEGES', []);
              }}
            >
              Compose Announcement
            </button>
          </div>
        ) : (
          <div className="modules-table-container">
            <table className="modules-table">
              <thead>
                <tr>
                  <th style={{ width: '28%' }}>Announcement Title &amp; Details</th>
                  <th style={{ width: '13%' }}>Category</th>
                  <th style={{ width: '11%' }}>Priority</th>
                  <th style={{ width: '16%' }}>Target Audience</th>
                  <th style={{ width: '10%' }}>Status</th>
                  <th style={{ width: '12%' }}>Created Date</th>
                  <th style={{ width: '10%', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredNotifications.map((n) => {
                  const prio = (n.priority || 'NORMAL').toUpperCase();
                  const status = (n.status || 'PUBLISHED').toUpperCase();

                  return (
                    <tr key={n.id}>
                      {/* Title & Preview */}
                      <td>
                        <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '0.88rem' }}>
                          {n.title}
                        </div>
                        <div
                          style={{
                            fontSize: '0.78rem',
                            color: '#64748B',
                            marginTop: '2px',
                            maxWidth: '360px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {n.message}
                        </div>
                      </td>

                      {/* Category */}
                      <td>
                        <span className="badge badge-outline" style={{ fontSize: '0.72rem', fontWeight: 600 }}>
                          {n.notification_type || 'SYSTEM'}
                        </span>
                      </td>

                      {/* Priority */}
                      <td>
                        <span
                          className={`badge ${
                            prio === 'URGENT'
                              ? 'badge-danger'
                              : prio === 'HIGH'
                              ? 'badge-warning'
                              : prio === 'LOW'
                              ? 'badge-outline'
                              : 'badge-primary'
                          }`}
                          style={{ fontSize: '0.72rem', fontWeight: 700 }}
                        >
                          {prio}
                        </span>
                      </td>

                      {/* Target Audience */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: '#1E293B', fontWeight: 500 }}>
                          <Building2 size={13} style={{ color: n.target_type === 'ALL_COLLEGES' ? '#2563EB' : '#64748B' }} />
                          <span>
                            {n.target_type === 'ALL_COLLEGES' ? 'All Active Colleges' : 'Selected Tenants'}
                          </span>
                        </div>
                        {n.target_type === 'SELECTED_COLLEGES' && n.college_count > 0 && (
                          <div style={{ fontSize: '0.71rem', color: '#64748B', marginTop: '2px' }}>
                            {n.college_count} college portal(s) targeted
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td>
                        <span
                          className={`module-state-pill ${
                            status === 'PUBLISHED'
                              ? 'active'
                              : status === 'DRAFT'
                              ? 'frozen'
                              : 'disabled'
                          }`}
                        >
                          {status}
                        </span>
                      </td>

                      {/* Created By & Date */}
                      <td>
                        <div style={{ fontSize: '0.8rem', color: '#0F172A', fontWeight: 500 }}>
                          {new Date(n.created_at).toLocaleDateString()}
                        </div>
                        <div style={{ fontSize: '0.71rem', color: '#64748B' }}>
                          by {n.created_by_name || 'Super Admin'}
                        </div>
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn-module-action"
                            onClick={() => setDetailModal({ isOpen: true, notification: n })}
                            title="Inspect Announcement Details"
                          >
                            <Eye size={12} />
                          </button>
                          {n.status !== 'CANCELLED' && (
                            <button
                              type="button"
                              className="btn-module-action danger"
                              onClick={() => setCancelModal({
                                isOpen: true,
                                notification: n,
                                reason: '',
                                submitting: false,
                                error: null,
                              })}
                              title="Cancel Broadcast"
                            >
                              <XCircle size={12} />
                              <span>Cancel</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: COMPOSE ANNOUNCEMENT MODAL */}
      {showModal && (
        <div className="modal-backdrop" style={{ zIndex: 1050 }}>
          <div className="modal-card" style={{ maxWidth: '640px', borderRadius: '16px', overflow: 'hidden' }}>
            <div className="modal-header" style={{ padding: '18px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Send size={18} style={{ color: '#2563EB' }} />
                <h2 className="modal-title" style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#0F172A' }}>
                  Compose Platform Announcement
                </h2>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateNotification} style={{ padding: '24px' }}>
              {/* Category & Priority Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                <div>
                  <label className="label" style={{ fontWeight: 700, fontSize: '0.82rem', color: '#334155', marginBottom: '6px' }}>
                    Category
                  </label>
                  <select
                    value={formData.notification_type}
                    onChange={(e) => setFormData({ ...formData, notification_type: e.target.value })}
                    className="notifications-select-dropdown"
                    style={{ width: '100%' }}
                  >
                    <option value="SYSTEM">System Announcement</option>
                    <option value="MAINTENANCE">Scheduled Maintenance</option>
                    <option value="SECURITY">Security Notice</option>
                    <option value="FEATURE">Feature Release</option>
                    <option value="GENERAL">General Notice</option>
                  </select>
                </div>

                <div>
                  <label className="label" style={{ fontWeight: 700, fontSize: '0.82rem', color: '#334155', marginBottom: '6px' }}>
                    Priority Level
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="notifications-select-dropdown"
                    style={{ width: '100%' }}
                  >
                    <option value="LOW">Low (Informational)</option>
                    <option value="NORMAL">Normal (Standard)</option>
                    <option value="HIGH">High (Important Banner)</option>
                    <option value="URGENT">Urgent (Immediate Attention)</option>
                  </select>
                </div>
              </div>

              {/* Target Audience Selector Cards */}
              <div style={{ marginBottom: '16px' }}>
                <label className="label" style={{ fontWeight: 700, fontSize: '0.82rem', color: '#334155', marginBottom: '8px' }}>
                  Target Audience
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div
                    className={`audience-selection-card ${formData.target_type === 'SELECTED_COLLEGES' ? 'selected' : ''}`}
                    onClick={() => {
                      setFormData({ ...formData, target_type: 'SELECTED_COLLEGES' });
                      handleAudiencePreview('SELECTED_COLLEGES', formData.college_ids);
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Building2 size={15} style={{ color: '#2563EB' }} />
                      <span>Selected Colleges</span>
                    </div>
                    <div style={{ fontSize: '0.76rem', color: '#64748B', marginTop: '3px' }}>
                      Target specific institutional tenants
                    </div>
                  </div>

                  <div
                    className={`audience-selection-card ${formData.target_type === 'ALL_COLLEGES' ? 'selected' : ''}`}
                    onClick={() => {
                      setFormData({ ...formData, target_type: 'ALL_COLLEGES' });
                      handleAudiencePreview('ALL_COLLEGES', []);
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Radio size={15} style={{ color: '#7C3AED' }} />
                      <span>Company-Wide Broadcast</span>
                    </div>
                    <div style={{ fontSize: '0.76rem', color: '#64748B', marginTop: '3px' }}>
                      Enforces Maker-Checker approval gate
                    </div>
                  </div>
                </div>

                {/* Tenant Checkboxes for Selected Colleges */}
                {formData.target_type === 'SELECTED_COLLEGES' && (
                  <div style={{ border: '1px solid #E2E8F0', borderRadius: '10px', padding: '12px', background: '#F8FAFC' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>
                        Select Target Tenants ({formData.college_ids.length} selected):
                      </span>
                      <input
                        type="text"
                        placeholder="Search colleges..."
                        value={collegeSearch}
                        onChange={(e) => setCollegeSearch(e.target.value)}
                        style={{ fontSize: '0.76rem', padding: '3px 8px', border: '1px solid #CBD5E1', borderRadius: '6px', background: '#FFFFFF' }}
                      />
                    </div>
                    <div style={{ maxHeight: '140px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {filteredColleges.map((col) => {
                        const isChecked = formData.college_ids.includes(col.college_id);
                        return (
                          <label key={col.college_id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 6px', fontSize: '0.8rem', cursor: 'pointer', borderRadius: '4px', background: isChecked ? '#EFF6FF' : 'transparent' }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                const updated = e.target.checked
                                  ? [...formData.college_ids, col.college_id]
                                  : formData.college_ids.filter((id) => id !== col.college_id);
                                setFormData({ ...formData, college_ids: updated });
                                handleAudiencePreview('SELECTED_COLLEGES', updated);
                              }}
                            />
                            <span style={{ fontWeight: isChecked ? 600 : 400, color: '#1E293B' }}>
                              {col.name} ({col.college_code || col.code})
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Audience Preview Alert */}
              {audiencePreview && (
                <div className={`alert alert-${audiencePreview.RequiresReview ? 'warning' : 'info'}`} style={{ padding: '10px 14px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '0.82rem' }}>
                    <strong>Eligible Audience:</strong> {audiencePreview.EligibleCount} college tenant portals eligible
                    {audiencePreview.ApprovalNote && <div style={{ marginTop: '2px' }}>{audiencePreview.ApprovalNote}</div>}
                  </div>
                </div>
              )}

              {/* Title Input */}
              <div style={{ marginBottom: '16px' }}>
                <label className="label" style={{ fontWeight: 700, fontSize: '0.82rem', color: '#334155', marginBottom: '6px' }}>
                  Announcement Title <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Scheduled Network Infrastructure Maintenance Advisory"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="input-text"
                  style={{ width: '100%', fontSize: '0.84rem' }}
                />
              </div>

              {/* Message Content */}
              <div style={{ marginBottom: '22px' }}>
                <label className="label" style={{ fontWeight: 700, fontSize: '0.82rem', color: '#334155', marginBottom: '6px' }}>
                  Broadcast Message Body <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Enter detailed broadcast body visible on College Administrator dashboards..."
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="input-textarea"
                  style={{ width: '100%', fontSize: '0.84rem' }}
                />
              </div>

              {/* Modal Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn-enterprise btn-outline-soft"
                  onClick={() => setShowModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-enterprise btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Publishing...' : formData.target_type === 'ALL_COLLEGES' ? 'Submit for Approval' : 'Publish Announcement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CANCEL ANNOUNCEMENT MODAL (Replaces window.prompt) */}
      {cancelModal.isOpen && cancelModal.notification && (
        <div className="modal-backdrop" style={{ zIndex: 1050 }}>
          <div className="modal-card" style={{ maxWidth: '520px', borderRadius: '16px', overflow: 'hidden' }}>
            <div className="modal-header" style={{ padding: '18px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <XCircle size={18} style={{ color: '#DC2626' }} />
                <h2 className="modal-title" style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#0F172A' }}>
                  Cancel Broadcast Announcement
                </h2>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setCancelModal((p) => ({ ...p, isOpen: false }))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmCancel} style={{ padding: '24px' }}>
              {cancelModal.error && (
                <div className="alert alert-danger" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={15} />
                  <span>{cancelModal.error}</span>
                </div>
              )}

              <p style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '16px', lineHeight: 1.5 }}>
                Are you sure you want to cancel the announcement <strong style={{ color: '#0F172A' }}>&ldquo;{cancelModal.notification.title}&rdquo;</strong>? It will immediately be withdrawn from College Administrator portals.
              </p>

              <div style={{ marginBottom: '20px' }}>
                <label className="label" style={{ fontWeight: 700, fontSize: '0.82rem', color: '#334155', marginBottom: '6px' }}>
                  Cancellation Justification <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Advisory superseded or maintenance rescheduled"
                  value={cancelModal.reason}
                  onChange={(e) => setCancelModal((p) => ({ ...p, reason: e.target.value }))}
                  className="input-text"
                  style={{ width: '100%', fontSize: '0.84rem' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn-enterprise btn-outline-soft"
                  onClick={() => setCancelModal((p) => ({ ...p, isOpen: false }))}
                >
                  Keep Active
                </button>
                <button
                  type="submit"
                  className="btn-enterprise btn-danger"
                  disabled={cancelModal.submitting}
                >
                  {cancelModal.submitting ? 'Cancelling...' : 'Confirm Cancellation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: VIEW ANNOUNCEMENT DETAIL MODAL */}
      {detailModal.isOpen && detailModal.notification && (
        <div className="modal-backdrop" style={{ zIndex: 1050 }}>
          <div className="modal-card" style={{ maxWidth: '600px', borderRadius: '16px', overflow: 'hidden' }}>
            <div className="modal-header" style={{ padding: '18px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Megaphone size={18} style={{ color: '#2563EB' }} />
                <h2 className="modal-title" style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#0F172A' }}>
                  Announcement Details
                </h2>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setDetailModal({ isOpen: false, notification: null })}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '24px' }}>
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span className={`badge ${detailModal.notification.priority === 'URGENT' ? 'badge-danger' : 'badge-primary'}`}>
                    {detailModal.notification.priority}
                  </span>
                  <span className="badge badge-outline">
                    {detailModal.notification.notification_type}
                  </span>
                  <span className={`module-state-pill ${detailModal.notification.status === 'PUBLISHED' ? 'active' : 'disabled'}`}>
                    {detailModal.notification.status}
                  </span>
                </div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0F172A', margin: '8px 0 4px 0' }}>
                  {detailModal.notification.title}
                </h3>
                <div style={{ fontSize: '0.78rem', color: '#64748B' }}>
                  Created on {new Date(detailModal.notification.created_at).toLocaleString()} by {detailModal.notification.created_by_name || 'Super Admin'}
                </div>
              </div>

              {/* Message Content Box */}
              <div
                style={{
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '10px',
                  padding: '16px',
                  fontSize: '0.88rem',
                  lineHeight: 1.6,
                  color: '#1E293B',
                  marginBottom: '20px',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {detailModal.notification.message}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn-enterprise btn-outline-soft"
                  onClick={() => setDetailModal({ isOpen: false, notification: null })}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
