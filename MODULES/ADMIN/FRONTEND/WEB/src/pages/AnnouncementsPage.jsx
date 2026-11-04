import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../../shared/auth/useAuth';
import adminService from '../services/adminService';
import {
  Megaphone,
  Bell,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  Plus,
  RefreshCw,
  Eye,
  Check,
  Send,
  Users,
  Building2,
  Shield,
  FileText,
  ChevronRight,
  Info,
  Sparkles,
  LayoutGrid,
  List,
  CheckCheck,
} from 'lucide-react';
import {
  Modal,
  LoadingState,
  EmptyState,
} from '../../../shared/components';

export default function AdminAnnouncementsPage() {
  const { user } = useAuth();

  // Permission checks
  const canBroadcast = useMemo(() => {
    if (!user) return true;
    if (['COLLEGE_ADMIN', 'ADMIN', 'HOSTEL_ADMIN'].includes(user?.role)) return true;
    if (Array.isArray(user?.permissions)) {
      return (
        user.permissions.includes('hostel.manage') ||
        user.permissions.includes('*')
      );
    }
    return true;
  }, [user]);

  // Master Data State
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [students, setStudents] = useState([]);
  const [staffList, setStaffList] = useState([]);

  // UI & Loading States
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successBanner, setSuccessBanner] = useState(null);

  // Search, Filters & View Mode
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [readFilter, setReadFilter] = useState('ALL'); // 'ALL' | 'UNREAD' | 'READ'
  const [displayMode, setDisplayMode] = useState('CARDS'); // 'CARDS' | 'TABLE'

  // Modals Visibility
  const [composeModalOpen, setComposeModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Broadcast Composer Form State
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    type: 'ANNOUNCEMENT',
    priority: 'NORMAL',
    target_audience: 'ALL_STUDENTS', // 'ALL_STUDENTS' | 'ALL_STAFF' | 'EVERYONE' | 'CUSTOM'
    custom_recipient_ids: [],
  });

  // Load Notifications & Recipients Directory
  const loadData = useCallback(async (isManual = false) => {
    try {
      if (isManual) setIsRefreshing(true);
      else setLoading(true);
      setErrorMessage(null);

      const [notifsRes, unreadRes, studentsRes, staffRes] = await Promise.allSettled([
        adminService.getNotifications(),
        adminService.getUnreadNotificationCount(),
        adminService.getStudents({ limit: 100 }),
        adminService.getStaff(),
      ]);

      const notifList = notifsRes.status === 'fulfilled'
        ? (Array.isArray(notifsRes.value) ? notifsRes.value : notifsRes.value?.notifications || notifsRes.value?.data || [])
        : [];
      setNotifications(notifList);

      const uCount = unreadRes.status === 'fulfilled'
        ? (typeof unreadRes.value === 'number' ? unreadRes.value : unreadRes.value?.count || unreadRes.value?.data?.count || 0)
        : 0;
      setUnreadCount(uCount);

      const sList = studentsRes.status === 'fulfilled'
        ? (Array.isArray(studentsRes.value) ? studentsRes.value : studentsRes.value?.students || studentsRes.value?.data || [])
        : [];
      setStudents(sList);

      const staffArray = staffRes.status === 'fulfilled'
        ? (Array.isArray(staffRes.value) ? staffRes.value : staffRes.value?.staff || staffRes.value?.data || [])
        : [];
      setStaffList(staffArray);
    } catch (err) {
      console.error('Failed to load announcements:', err);
      setErrorMessage(err?.response?.data?.error?.message || err.message || 'Unable to load announcements.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Mark Single Notification as Read
  const handleMarkAsRead = async (notifId) => {
    try {
      await adminService.markNotificationRead(notifId);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notifId ? { ...n, delivery_status: 'READ', read_at: new Date().toISOString() } : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      if (selectedNotification && selectedNotification.id === notifId) {
        setSelectedNotification((prev) => ({
          ...prev,
          delivery_status: 'READ',
          read_at: new Date().toISOString(),
        }));
      }
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  // Handle Mark All as Read
  const handleMarkAllAsRead = async () => {
    try {
      setIsRefreshing(true);
      await adminService.markAllNotificationsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, delivery_status: 'READ', read_at: new Date().toISOString() }))
      );
      setUnreadCount(0);
      setSuccessBanner('All notifications have been marked as read.');
    } catch (err) {
      console.error('Failed to mark all read:', err);
      setErrorMessage('Could not mark all notifications as read.');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Handle Broadcast Submission
  const handleBroadcastSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.message.trim()) {
      setErrorMessage('Title and announcement message body are required.');
      return;
    }

    // Determine recipient IDs based on audience
    let resolvedRecipientIds = [];
    if (formData.target_audience === 'ALL_STUDENTS') {
      resolvedRecipientIds = students.map((s) => s.user_id || s.id).filter(Boolean);
    } else if (formData.target_audience === 'ALL_STAFF') {
      resolvedRecipientIds = staffList.map((st) => st.user_id || st.id).filter(Boolean);
    } else if (formData.target_audience === 'EVERYONE') {
      const studentIds = students.map((s) => s.user_id || s.id).filter(Boolean);
      const staffIds = staffList.map((st) => st.user_id || st.id).filter(Boolean);
      resolvedRecipientIds = Array.from(new Set([...studentIds, ...staffIds]));
    } else if (formData.target_audience === 'CUSTOM') {
      resolvedRecipientIds = formData.custom_recipient_ids;
    }

    // If no recipients resolved (e.g. empty test directory), fall back to current user's ID
    if (resolvedRecipientIds.length === 0 && user?.id) {
      resolvedRecipientIds = [user.id];
    }

    if (resolvedRecipientIds.length === 0) {
      setErrorMessage('At least one recipient is required for dispatch.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);

      await adminService.createNotification({
        title: formData.title.trim(),
        message: formData.message.trim(),
        type: formData.type,
        priority: formData.priority,
        recipient_ids: resolvedRecipientIds,
      });

      setSuccessBanner(`Announcement "${formData.title}" broadcast to ${resolvedRecipientIds.length} recipient(s)!`);
      setComposeModalOpen(false);
      setFormData({
        title: '',
        message: '',
        type: 'ANNOUNCEMENT',
        priority: 'NORMAL',
        target_audience: 'ALL_STUDENTS',
        custom_recipient_ids: [],
      });

      // Reload
      await loadData();
    } catch (err) {
      console.error('Failed to broadcast announcement:', err);
      setErrorMessage(err?.response?.data?.error?.message || err.message || 'Could not send announcement.');
    } finally {
      setSubmitting(false);
    }
  };

  // Badge helpers
  const getPriorityBadgeClass = (priority) => {
    switch (priority) {
      case 'URGENT':
        return 'badge-enterprise badge-rose';
      case 'HIGH':
        return 'badge-enterprise badge-orange';
      default:
        return 'badge-enterprise badge-blue';
    }
  };

  const getTypeBadgeClass = (type) => {
    switch (type) {
      case 'EMERGENCY':
        return 'badge-enterprise badge-rose';
      case 'ALERT':
        return 'badge-enterprise badge-amber';
      case 'NOTICE':
        return 'badge-enterprise badge-purple';
      default:
        return 'badge-enterprise badge-blue';
    }
  };

  // Filtered Notifications List
  const filteredNotifications = useMemo(() => {
    return notifications.filter((notif) => {
      const matchesSearch =
        !searchTerm ||
        (notif.title && notif.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (notif.message && notif.message.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesType = typeFilter === 'ALL' || notif.type === typeFilter;
      const matchesPriority = priorityFilter === 'ALL' || notif.priority === priorityFilter;

      const isRead = notif.delivery_status === 'READ';
      const matchesRead =
        readFilter === 'ALL' ||
        (readFilter === 'READ' && isRead) ||
        (readFilter === 'UNREAD' && !isRead);

      return matchesSearch && matchesType && matchesPriority && matchesRead;
    });
  }, [notifications, searchTerm, typeFilter, priorityFilter, readFilter]);

  const urgentCount = useMemo(() => {
    return notifications.filter((n) => n.priority === 'HIGH' || n.priority === 'URGENT').length;
  }, [notifications]);

  if (loading && notifications.length === 0) {
    return (
      <div className="fade-in-up" style={{ padding: '32px' }}>
        <LoadingState message="Connecting to institutional broadcast network..." />
      </div>
    );
  }

  return (
    <div className="fade-in-up">
      {/* Enterprise Hero Header */}
      <div className="enterprise-hero-header">
        <div className="hero-header-titles">
          <div className="hero-category-pill">
            <Megaphone size={13} />
            <span>Campus Living &amp; Welfare</span>
          </div>
          <h1 className="hero-main-title">Notice &amp; Broadcasts</h1>
          <p className="hero-subtitle">
            Publish campus notices, emergency bulletins, resident broadcasts, and monitor notification delivery across facilities.
          </p>
        </div>

        <div className="hero-action-buttons">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllAsRead}
              className="btn-enterprise-secondary"
              title="Mark all notifications as read"
            >
              <CheckCheck size={14} />
              <span>Mark All Read</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={isRefreshing}
            className="btn-enterprise-secondary"
          >
            <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} />
            <span>{isRefreshing ? 'Syncing...' : 'Sync Data'}</span>
          </button>

          {canBroadcast && (
            <button
              type="button"
              onClick={() => setComposeModalOpen(true)}
              className="btn-enterprise-primary"
            >
              <Plus size={15} />
              <span>Compose Broadcast</span>
            </button>
          )}
        </div>
      </div>

      {/* Success Notification Banner */}
      {successBanner && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            color: '#065f46',
            padding: '12px 18px',
            borderRadius: '10px',
            marginBottom: '20px',
            fontSize: '13.5px',
            fontWeight: 500,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={16} style={{ color: '#10b981' }} />
            <span>{successBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessBanner(null)}
            style={{ background: 'none', border: 'none', color: '#047857', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error Notification Banner */}
      {errorMessage && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            padding: '12px 18px',
            borderRadius: '10px',
            marginBottom: '20px',
            fontSize: '13.5px',
            fontWeight: 500,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={16} style={{ color: '#ef4444' }} />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            style={{ background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top Level KPI Cards */}
      <div className="kpi-cards-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Total Broadcasts</span>
            <div className="stat-kpi-icon-wrap blue">
              <Megaphone size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-blue-600">{notifications.length}</div>
          <div className="stat-kpi-footnote">
            <span className="status-dot blue" />
            <span>Published notices &amp; alerts</span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Unread Alerts</span>
            <div className="stat-kpi-icon-wrap amber">
              <Bell size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-amber-600">{unreadCount}</div>
          <div className="stat-kpi-footnote">
            <span className="status-dot amber" />
            <span>Pending resident attention</span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">High / Urgent Notices</span>
            <div className="stat-kpi-icon-wrap rose">
              <AlertTriangle size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-rose-600">{urgentCount}</div>
          <div className="stat-kpi-footnote">
            <span>High-priority campus notices</span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Recipient Directory</span>
            <div className="stat-kpi-icon-wrap emerald">
              <Users size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-emerald-600">{students.length + staffList.length}</div>
          <div className="stat-kpi-footnote">
            <span>Enrolled students &amp; staff</span>
          </div>
        </div>
      </div>

      {/* Main Broadcasts Card */}
      <div className="enterprise-card">
        <div className="card-topbar">
          <div className="card-title-group">
            <div className="card-title-icon-wrap">
              <Megaphone size={16} />
            </div>
            <h2 className="card-title-text">Broadcast Announcements &amp; Bulletins</h2>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="stats-tally-pill" style={{ color: '#1d4ed8', background: '#dbeafe', borderColor: '#bfdbfe' }}>
              <Bell size={12} />
              <span>{filteredNotifications.length} Bulletins Listed</span>
            </span>

            <div className="view-mode-toggle">
              <button
                type="button"
                className={`view-mode-btn ${displayMode === 'CARDS' ? 'active' : ''}`}
                onClick={() => setDisplayMode('CARDS')}
                title="Card Grid View"
              >
                <LayoutGrid size={13} />
                <span>Cards</span>
              </button>
              <button
                type="button"
                className={`view-mode-btn ${displayMode === 'TABLE' ? 'active' : ''}`}
                onClick={() => setDisplayMode('TABLE')}
                title="Table View"
              >
                <List size={13} />
                <span>Table</span>
              </button>
            </div>
          </div>
        </div>

        {/* Enterprise Filter Bar */}
        <div className="enterprise-filter-bar">
          <div className="filter-search-field">
            <Search size={14} className="filter-search-icon" />
            <input
              type="text"
              className="filter-search-input"
              placeholder="Search by title, keywords, or announcement body..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <select
              className="filter-select"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="ALL">All Bulletin Types</option>
              <option value="ANNOUNCEMENT">ANNOUNCEMENT</option>
              <option value="NOTICE">NOTICE</option>
              <option value="ALERT">ALERT</option>
              <option value="EMERGENCY">EMERGENCY</option>
            </select>

            <select
              className="filter-select"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
            >
              <option value="ALL">All Priorities</option>
              <option value="NORMAL">NORMAL</option>
              <option value="HIGH">HIGH</option>
              <option value="URGENT">URGENT</option>
            </select>

            <select
              className="filter-select"
              value={readFilter}
              onChange={(e) => setReadFilter(e.target.value)}
            >
              <option value="ALL">All Read States</option>
              <option value="UNREAD">Unread Only</option>
              <option value="READ">Read Only</option>
            </select>
          </div>
        </div>

        {/* Notifications Content */}
        {filteredNotifications.length === 0 ? (
          <div style={{ padding: '36px', textAlign: 'center' }}>
            <EmptyState
              title="No announcements found"
              message="No notices match the selected search or filter criteria."
            />
          </div>
        ) : displayMode === 'CARDS' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px', marginTop: '12px' }}>
            {filteredNotifications.map((notif) => {
              const isUnread = notif.delivery_status !== 'READ';

              return (
                <div
                  key={notif.id}
                  style={{
                    border: isUnread ? '1.5px solid #818cf8' : '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '16px',
                    background: isUnread ? '#faf5ff' : '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    position: 'relative',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {isUnread && (
                          <span
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: '#6366f1',
                              display: 'inline-block',
                            }}
                          />
                        )}
                        <span className={getTypeBadgeClass(notif.type)}>
                          {notif.type || 'ANNOUNCEMENT'}
                        </span>
                        <span className={getPriorityBadgeClass(notif.priority)}>
                          {notif.priority || 'NORMAL'}
                        </span>
                      </div>

                      <span style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Clock size={11} />
                        <span>{notif.created_at ? new Date(notif.created_at).toLocaleDateString() : 'Recent'}</span>
                      </span>
                    </div>

                    <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginBottom: '6px', lineHeight: '1.4' }}>
                      {notif.title}
                    </h3>

                    <p style={{ fontSize: '12.5px', color: '#475569', lineHeight: '1.5', minHeight: '44px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                      {notif.message}
                    </p>
                  </div>

                  <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: isUnread ? '#6366f1' : '#059669' }}>
                      {isUnread ? '• Unread' : '✓ Read'}
                    </span>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      {isUnread && (
                        <button
                          type="button"
                          onClick={() => handleMarkAsRead(notif.id)}
                          className="btn-enterprise-secondary"
                          style={{ padding: '3px 8px', fontSize: '11px' }}
                          title="Mark as read"
                        >
                          <Check size={11} />
                          <span>Mark Read</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedNotification(notif);
                          setDetailsModalOpen(true);
                        }}
                        className="btn-enterprise-primary"
                        style={{ padding: '3px 10px', fontSize: '11px' }}
                      >
                        <Eye size={11} />
                        <span>View</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ overflowX: 'auto', marginTop: '12px' }}>
            <table className="enterprise-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', fontSize: '12px', color: '#64748b' }}>
                  <th style={{ padding: '10px 14px' }}>Title &amp; Notice Summary</th>
                  <th style={{ padding: '10px 14px' }}>Type</th>
                  <th style={{ padding: '10px 14px' }}>Priority</th>
                  <th style={{ padding: '10px 14px' }}>Date</th>
                  <th style={{ padding: '10px 14px' }}>Status</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredNotifications.map((notif) => {
                  const isUnread = notif.delivery_status !== 'READ';

                  return (
                    <tr key={notif.id} style={{ borderBottom: '1px solid #f1f5f9', fontSize: '13px', background: isUnread ? '#faf5ff' : 'transparent' }}>
                      <td style={{ padding: '12px 14px', maxWidth: '340px' }}>
                        <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: '2px' }}>
                          {notif.title}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {notif.message}
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span className={getTypeBadgeClass(notif.type)}>
                          {notif.type || 'ANNOUNCEMENT'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span className={getPriorityBadgeClass(notif.priority)}>
                          {notif.priority || 'NORMAL'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: '12px', color: '#475569' }}>
                        {notif.created_at ? new Date(notif.created_at).toLocaleDateString() : 'Recent'}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span className={isUnread ? 'badge-enterprise badge-purple' : 'badge-enterprise badge-green'} style={{ fontSize: '10px' }}>
                          {isUnread ? 'UNREAD' : 'READ'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          {isUnread && (
                            <button
                              type="button"
                              onClick={() => handleMarkAsRead(notif.id)}
                              className="btn-enterprise-secondary"
                              style={{ padding: '3px 8px', fontSize: '11px' }}
                              title="Mark as read"
                            >
                              <Check size={11} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedNotification(notif);
                              setDetailsModalOpen(true);
                            }}
                            className="btn-enterprise-primary"
                            style={{ padding: '3px 10px', fontSize: '11px' }}
                          >
                            <Eye size={11} />
                            <span>View</span>
                          </button>
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

      {/* =================================================================== */}
      {/* MODAL: Compose Institutional Broadcast                              */}
      {/* =================================================================== */}
      {composeModalOpen && (
        <Modal
          isOpen={composeModalOpen}
          onClose={() => setComposeModalOpen(false)}
          title="Compose Institutional Broadcast"
        >
          <form onSubmit={handleBroadcastSubmit}>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Broadcast Title *
              </label>
              <input
                type="text"
                className="filter-search-input"
                style={{ width: '100%', fontSize: '13px' }}
                placeholder="e.g. Scheduled Power Outage & Maintenance Notice"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Target Audience *
                </label>
                <select
                  className="filter-select"
                  style={{ width: '100%', fontSize: '13px' }}
                  value={formData.target_audience}
                  onChange={(e) => setFormData({ ...formData, target_audience: e.target.value })}
                >
                  <option value="ALL_STUDENTS">All Resident Students ({students.length})</option>
                  <option value="ALL_STAFF">All Hostel Staff ({staffList.length})</option>
                  <option value="EVERYONE">Everyone (All Campus)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Bulletin Category *
                </label>
                <select
                  className="filter-select"
                  style={{ width: '100%', fontSize: '13px' }}
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                >
                  <option value="ANNOUNCEMENT">ANNOUNCEMENT</option>
                  <option value="NOTICE">NOTICE</option>
                  <option value="ALERT">ALERT</option>
                  <option value="EMERGENCY">EMERGENCY</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Priority Level *
              </label>
              <select
                className="filter-select"
                style={{ width: '100%', fontSize: '13px' }}
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              >
                <option value="NORMAL">NORMAL (Standard Information)</option>
                <option value="HIGH">HIGH (Important Campus Update)</option>
                <option value="URGENT">URGENT (Immediate Alert)</option>
              </select>
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Announcement Message Body *
              </label>
              <textarea
                className="filter-search-input"
                style={{ width: '100%', minHeight: '120px', fontSize: '13px', padding: '10px', lineHeight: '1.5' }}
                placeholder="Write the full broadcast message content for recipients..."
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                required
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn-enterprise-secondary"
                onClick={() => setComposeModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-enterprise-primary"
                disabled={submitting}
              >
                <Send size={14} />
                <span>{submitting ? 'Dispatching...' : 'Dispatch Broadcast'}</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* =================================================================== */}
      {/* MODAL: View Bulletin Details                                        */}
      {/* =================================================================== */}
      {detailsModalOpen && selectedNotification && (
        <Modal
          isOpen={detailsModalOpen}
          onClose={() => setDetailsModalOpen(false)}
          title="Bulletin Details"
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span className={getTypeBadgeClass(selectedNotification.type)}>
                {selectedNotification.type || 'ANNOUNCEMENT'}
              </span>
              <span className={getPriorityBadgeClass(selectedNotification.priority)}>
                {selectedNotification.priority || 'NORMAL'}
              </span>
              <span style={{ fontSize: '11.5px', color: '#64748b', marginLeft: 'auto' }}>
                {selectedNotification.created_at ? new Date(selectedNotification.created_at).toLocaleString() : 'Recent'}
              </span>
            </div>

            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', marginBottom: '12px' }}>
              {selectedNotification.title}
            </h2>

            <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13.5px', color: '#334155', lineHeight: '1.6', whiteSpace: 'pre-line', marginBottom: '18px' }}>
              {selectedNotification.message}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              {selectedNotification.delivery_status !== 'READ' && (
                <button
                  type="button"
                  className="btn-enterprise-secondary"
                  onClick={() => handleMarkAsRead(selectedNotification.id)}
                >
                  <Check size={14} />
                  <span>Mark as Read</span>
                </button>
              )}
              <button
                type="button"
                className="btn-enterprise-primary"
                onClick={() => setDetailsModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
