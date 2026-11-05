import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import inchargeService from '../services/inchargeService';
import { PERMISSIONS } from '../constants/permissions';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import SearchInput from '../components/SearchInput';
import Modal from '../components/Modal';
import FormField from '../components/FormField';
import LoadingState from '../components/LoadingState';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import {
  Bell,
  Megaphone,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  RefreshCw,
  Eye,
  Check,
  Users,
  LayoutGrid,
  List,
  CheckCheck,
  Mail
} from 'lucide-react';

export default function AnnouncementsPage() {
  const { user, assignedHostel } = useAuth();
  const { hasPermission } = usePermissions();

  const canManage = hasPermission(PERMISSIONS.HOSTEL_MANAGE);

  // Display Mode: Cards vs Table
  const [displayMode, setDisplayMode] = useState('CARDS');

  // Master Data State
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [residents, setResidents] = useState([]);
  const [staffList, setStaffList] = useState([]);

  // UI & Loading States
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successBanner, setSuccessBanner] = useState(null);

  // Search & Filters (Evaluated Client-Side)
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [readFilter, setReadFilter] = useState('ALL'); // 'ALL' | 'UNREAD' | 'READ'

  // Modals Visibility
  const [composeModalOpen, setComposeModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState(null);

  // Broadcast Composer Form State
  const [formTitle, setFormTitle] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [formType, setFormType] = useState('ANNOUNCEMENT');
  const [formPriority, setFormPriority] = useState('NORMAL');
  const [targetAudience, setTargetAudience] = useState('HOSTEL_RESIDENTS'); // 'HOSTEL_RESIDENTS' | 'SPECIFIC_RESIDENTS' | 'ALL_STAFF'
  const [selectedRecipientIds, setSelectedRecipientIds] = useState([]);
  const [isSubmittingBroadcast, setIsSubmittingBroadcast] = useState(false);
  const [composeError, setComposeError] = useState(null);

  // Debounce search input by 300ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Auto-dismiss success notification
  useEffect(() => {
    if (successBanner) {
      const t = setTimeout(() => setSuccessBanner(null), 5000);
      return () => clearTimeout(t);
    }
  }, [successBanner]);

  // Request sequence ref to prevent stale response overwrites
  const reqSeqRef = useRef(0);

  // Master Data Loader
  const loadData = useCallback(async (isManual = false) => {
    const seq = ++reqSeqRef.current;
    if (isManual) setIsRefreshing(true);
    else setLoading(true);
    setErrorMessage(null);

    const hostelId = assignedHostel?.id || assignedHostel?.hostel_id;

    try {
      const [notifsRes, unreadRes, residentsRes, staffRes] = await Promise.allSettled([
        inchargeService.getNotifications(),
        inchargeService.getUnreadNotificationCount(),
        hostelId ? inchargeService.getHostelResidents(hostelId) : Promise.resolve([]),
        inchargeService.getStaff(),
      ]);

      if (seq !== reqSeqRef.current) return;

      // 1. Notifications
      if (notifsRes.status === 'fulfilled') {
        const val = notifsRes.value;
        const list = Array.isArray(val) ? val : val?.notifications || val?.data || [];
        setNotifications(list);
      }

      // 2. Unread Count
      if (unreadRes.status === 'fulfilled') {
        const count = typeof unreadRes.value === 'number' ? unreadRes.value : 0;
        setUnreadCount(count);
      }

      // 3. Hostel Residents
      if (residentsRes.status === 'fulfilled') {
        const val = residentsRes.value;
        const list = Array.isArray(val) ? val : val?.residents || val?.data || [];
        setResidents(list);
      }

      // 4. Staff
      if (staffRes.status === 'fulfilled') {
        const val = staffRes.value;
        const list = Array.isArray(val) ? val : val?.staff || val?.data || [];
        setStaffList(list);
      }
    } catch (err) {
      if (seq !== reqSeqRef.current) return;
      console.error('Failed to load notifications data:', err);
      setErrorMessage(err.message || 'Unable to retrieve notifications.');
    } finally {
      if (seq === reqSeqRef.current) {
        setLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [assignedHostel]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Format Date helper
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  // Notification Type Badge
  const getTypeBadge = (type) => {
    const t = (type || '').toUpperCase();
    const colors = {
      ANNOUNCEMENT: { bg: 'rgba(59, 130, 246, 0.15)', text: '#2563eb', border: '#3b82f6' },
      GENERAL: { bg: 'rgba(100, 116, 139, 0.15)', text: '#475569', border: '#94a3b8' },
      SYSTEM: { bg: 'rgba(168, 85, 247, 0.15)', text: '#9333ea', border: '#a855f7' },
      LEAVE: { bg: 'rgba(234, 179, 8, 0.15)', text: '#ca8a04', border: '#eab308' },
      COMPLAINT: { bg: 'rgba(239, 68, 68, 0.15)', text: '#dc2626', border: '#ef4444' },
    };
    const c = colors[t] || colors.GENERAL;

    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 8px',
          borderRadius: '4px',
          fontSize: '0.72rem',
          fontWeight: 700,
          background: c.bg,
          color: c.text,
          border: `1px solid ${c.border}`,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        <Megaphone size={11} /> {t}
      </span>
    );
  };

  // Notification Priority Badge
  const getPriorityBadge = (priority) => {
    const p = (priority || '').toUpperCase();
    switch (p) {
      case 'URGENT':
        return (
          <span style={{ padding: '2px 8px', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: '4px', fontWeight: 700, fontSize: '0.72rem' }}>
            URGENT
          </span>
        );
      case 'HIGH':
        return (
          <span style={{ padding: '2px 8px', backgroundColor: '#ffedd5', color: '#c2410c', borderRadius: '4px', fontWeight: 600, fontSize: '0.72rem' }}>
            HIGH
          </span>
        );
      case 'LOW':
        return (
          <span style={{ padding: '2px 8px', backgroundColor: '#f1f5f9', color: '#64748b', borderRadius: '4px', fontWeight: 500, fontSize: '0.72rem' }}>
            LOW
          </span>
        );
      case 'NORMAL':
      default:
        return (
          <span style={{ padding: '2px 8px', backgroundColor: '#eff6ff', color: '#1d4ed8', borderRadius: '4px', fontWeight: 500, fontSize: '0.72rem' }}>
            NORMAL
          </span>
        );
    }
  };

  // Filtered Notifications List
  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      // 1. Type Filter
      if (typeFilter !== 'ALL' && (n.notification_type || '').toUpperCase() !== typeFilter) {
        return false;
      }

      // 2. Priority Filter
      if (priorityFilter !== 'ALL' && (n.priority || '').toUpperCase() !== priorityFilter) {
        return false;
      }

      // 3. Read Status Filter
      if (readFilter === 'UNREAD' && n.delivery_status === 'READ') return false;
      if (readFilter === 'READ' && n.delivery_status !== 'READ') return false;

      // 4. Debounced Search
      if (debouncedSearch.trim()) {
        const q = debouncedSearch.toLowerCase().trim();
        const title = (n.title || '').toLowerCase();
        const message = (n.message || '').toLowerCase();
        const type = (n.notification_type || '').toLowerCase();
        return title.includes(q) || message.includes(q) || type.includes(q);
      }

      return true;
    });
  }, [notifications, typeFilter, priorityFilter, readFilter, debouncedSearch]);

  // Handle Mark Single Notification as Read
  const handleMarkAsRead = async (notifId) => {
    try {
      await inchargeService.markNotificationRead(notifId);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notifId ? { ...n, delivery_status: 'READ', read_at: new Date().toISOString() } : n
        )
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      if (selectedNotification?.id === notifId) {
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
      await inchargeService.markAllNotificationsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, delivery_status: 'READ', read_at: new Date().toISOString() }))
      );
      setUnreadCount(0);
      setSuccessBanner('All notifications have been marked as read.');
    } catch (err) {
      console.error('Failed to mark all as read:', err);
      setErrorMessage('Could not mark all notifications as read.');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Handle Broadcast Submission
  const handleBroadcastSubmit = async (e) => {
    e.preventDefault();
    setComposeError(null);

    if (!formTitle.trim() || !formMessage.trim()) {
      setComposeError('Title and message content are required.');
      return;
    }

    // Resolve Recipient User IDs
    let resolvedRecipientIds = [];
    if (targetAudience === 'HOSTEL_RESIDENTS') {
      // Extract user_id from assigned hostel residents
      resolvedRecipientIds = residents
        .map((r) => r.user_id || r.id)
        .filter(Boolean);
    } else if (targetAudience === 'ALL_STAFF') {
      resolvedRecipientIds = staffList
        .map((st) => st.user_id || st.id)
        .filter(Boolean);
    } else if (targetAudience === 'SPECIFIC_RESIDENTS') {
      resolvedRecipientIds = selectedRecipientIds;
    }

    // Fallback if directory has no user_id (e.g., test session)
    if (resolvedRecipientIds.length === 0 && user?.id) {
      resolvedRecipientIds = [user.id];
    }

    if (resolvedRecipientIds.length === 0) {
      setComposeError('At least one recipient is required for broadcast dispatch.');
      return;
    }

    try {
      setIsSubmittingBroadcast(true);
      const payload = {
        title: formTitle.trim(),
        message: formMessage.trim(),
        type: formType,
        priority: formPriority,
        recipient_ids: resolvedRecipientIds,
      };

      await inchargeService.createNotification(payload);
      setSuccessBanner(`Broadcast "${formTitle}" dispatched to ${resolvedRecipientIds.length} recipient(s).`);
      setComposeModalOpen(false);
      setFormTitle('');
      setFormMessage('');
      setSelectedRecipientIds([]);
      loadData(true);
    } catch (err) {
      console.error('Failed to dispatch broadcast:', err);
      setComposeError(err.response?.data?.error?.message || err.message || 'Failed to dispatch broadcast notice.');
    } finally {
      setIsSubmittingBroadcast(false);
    }
  };

  // Table Columns Definition
  const columns = [
    {
      header: 'Notice Title',
      key: 'title',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.88rem' }}>
            {row.title}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
            ID: #{row.id.substring(0, 8)} • Dispatched: {formatDate(row.created_at)}
          </div>
        </div>
      ),
    },
    {
      header: 'Category',
      key: 'notification_type',
      width: '140px',
      render: (row) => getTypeBadge(row.notification_type),
    },
    {
      header: 'Priority',
      key: 'priority',
      width: '110px',
      render: (row) => getPriorityBadge(row.priority),
    },
    {
      header: 'Delivery Status',
      key: 'delivery_status',
      width: '120px',
      render: (row) => (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '0.75rem',
            color: row.delivery_status === 'READ' ? '#059669' : '#d97706',
            fontWeight: 600,
          }}
        >
          {row.delivery_status === 'READ' ? <CheckCheck size={14} /> : <Clock size={14} />}
          {row.delivery_status || 'DELIVERED'}
        </span>
      ),
    },
    {
      header: 'Actions',
      key: 'actions',
      width: '150px',
      align: 'right',
      render: (row) => (
        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn btn-outline"
            style={{ padding: '3px 8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
            onClick={() => {
              setSelectedNotification(row);
              setDetailModalOpen(true);
            }}
          >
            <Eye size={12} /> View
          </button>
          {row.delivery_status !== 'READ' && (
            <button
              type="button"
              className="btn btn-text"
              style={{ padding: '3px 6px', fontSize: '0.75rem' }}
              title="Mark as Read"
              onClick={() => handleMarkAsRead(row.id)}
            >
              <Check size={14} color="#059669" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="announcements-page">
      {/* Page Header */}
      <PageHeader
        title="Announcements & Notices"
        description={`Official hostel broadcasts, circulars, and notifications for ${assignedHostel?.name || 'Assigned Hostel'}.`}
        icon={Bell}
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => loadData(true)}
              disabled={isRefreshing || loading}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} />
              <span>Refresh</span>
            </button>

            {unreadCount > 0 && (
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleMarkAllAsRead}
                disabled={isRefreshing}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <CheckCheck size={14} />
                <span>Mark All Read</span>
              </button>
            )}

            {canManage && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setComposeError(null);
                  setComposeModalOpen(true);
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={14} />
                <span>New Broadcast</span>
              </button>
            )}
          </div>
        }
      />

      {/* Success Notification Banner */}
      {successBanner && (
        <div
          style={{
            margin: '0 0 16px 0',
            padding: '12px 16px',
            backgroundColor: '#ecfdf5',
            color: '#065f46',
            borderRadius: '6px',
            border: '1px solid #a7f3d0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.88rem',
            fontWeight: 500,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={18} color="#059669" />
            <span>{successBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessBanner(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#065f46' }}
          >
            ×
          </button>
        </div>
      )}

      {/* KPI Stats Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '14px',
          marginBottom: '20px',
        }}
      >
        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '8px',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#3b82f6',
            }}
          >
            <Bell size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
              Received Notices
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {notifications.length}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Total user notifications
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '8px',
              backgroundColor: 'rgba(234, 179, 8, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#eab308',
            }}
          >
            <Mail size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
              Unread Notices
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 700, color: '#d97706' }}>
              {unreadCount}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Awaiting review
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '8px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ef4444',
            }}
          >
            <AlertTriangle size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
              Urgent / High Priority
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {notifications.filter((n) => n.priority === 'HIGH' || n.priority === 'URGENT').length}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              High-priority alerts
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '8px',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#10b981',
            }}
          >
            <Users size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
              Hostel Residents
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {residents.length}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Target broadcast audience
            </div>
          </div>
        </div>
      </div>

      {/* Control Bar: Search, Filters & View Toggle */}
      <div
        className="card"
        style={{
          padding: '14px 18px',
          marginBottom: '20px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', flex: 1 }}>
          <div style={{ minWidth: '240px', flex: 1, maxWidth: '360px' }}>
            <SearchInput
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search notices by title or content..."
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Type:</span>
            <select
              className="form-control"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              style={{ fontSize: '0.82rem', padding: '6px 10px', width: 'auto' }}
            >
              <option value="ALL">All Categories</option>
              <option value="ANNOUNCEMENT">Announcement</option>
              <option value="GENERAL">General</option>
              <option value="SYSTEM">System</option>
              <option value="LEAVE">Leave</option>
              <option value="COMPLAINT">Complaint</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Priority:</span>
            <select
              className="form-control"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              style={{ fontSize: '0.82rem', padding: '6px 10px', width: 'auto' }}
            >
              <option value="ALL">All Priorities</option>
              <option value="LOW">Low</option>
              <option value="NORMAL">Normal</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Status:</span>
            <select
              className="form-control"
              value={readFilter}
              onChange={(e) => setReadFilter(e.target.value)}
              style={{ fontSize: '0.82rem', padding: '6px 10px', width: 'auto' }}
            >
              <option value="ALL">All Notices</option>
              <option value="UNREAD">Unread Only</option>
              <option value="READ">Read Only</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '4px', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '2px' }}>
          <button
            type="button"
            className={`btn ${displayMode === 'CARDS' ? 'btn-primary' : 'btn-text'}`}
            onClick={() => setDisplayMode('CARDS')}
            style={{ padding: '5px 10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <LayoutGrid size={14} /> Cards
          </button>
          <button
            type="button"
            className={`btn ${displayMode === 'TABLE' ? 'btn-primary' : 'btn-text'}`}
            onClick={() => setDisplayMode('TABLE')}
            style={{ padding: '5px 10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <List size={14} /> Table
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {loading && <LoadingState title="Loading official notices..." rows={4} />}

      {errorMessage && !loading && (
        <ErrorState
          title="Error Loading Notices"
          message={errorMessage}
          onRetry={() => loadData(false)}
        />
      )}

      {!loading && !errorMessage && (
        <>
          {filteredNotifications.length === 0 ? (
            <div className="card" style={{ padding: '40px 20px' }}>
              <EmptyState
                icon={Bell}
                title="No Announcements Found"
                description={
                  searchTerm || typeFilter !== 'ALL' || priorityFilter !== 'ALL' || readFilter !== 'ALL'
                    ? 'No notices match your selected filters. Try clearing your search parameters.'
                    : 'There are currently no active announcements or broadcasts recorded.'
                }
              />
            </div>
          ) : displayMode === 'TABLE' ? (
            <div className="card" style={{ overflow: 'hidden' }}>
              <DataTable
                columns={columns}
                data={filteredNotifications}
                rowKey="id"
                emptyTitle="No notices found"
              />
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: '16px',
              }}
            >
              {filteredNotifications.map((n) => (
                <div
                  key={n.id}
                  className="card"
                  style={{
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '12px',
                    backgroundColor: n.delivery_status === 'READ' ? '#ffffff' : '#f8fafc',
                    borderLeft: `4px solid ${
                      n.priority === 'URGENT'
                        ? '#ef4444'
                        : n.priority === 'HIGH'
                        ? '#f97316'
                        : '#3b82f6'
                    }`,
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        {getTypeBadge(n.notification_type)}
                        {getPriorityBadge(n.priority)}
                      </div>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          color: n.delivery_status === 'READ' ? '#059669' : '#d97706',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                        }}
                      >
                        {n.delivery_status === 'READ' ? <CheckCheck size={13} /> : <Clock size={13} />}
                        {n.delivery_status || 'DELIVERED'}
                      </span>
                    </div>

                    <h4 style={{ margin: '0 0 6px 0', fontSize: '0.98rem', color: 'var(--text-primary)' }}>
                      {n.title}
                    </h4>

                    <div
                      style={{
                        fontSize: '0.84rem',
                        color: 'var(--text-secondary)',
                        lineHeight: 1.45,
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        marginBottom: '10px',
                      }}
                    >
                      {n.message}
                    </div>

                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                      Dispatched: {formatDate(n.created_at)}
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderTop: '1px solid var(--border-color)',
                      paddingTop: '10px',
                      marginTop: '4px',
                    }}
                  >
                    <button
                      type="button"
                      className="btn btn-outline"
                      style={{ padding: '3px 8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                      onClick={() => {
                        setSelectedNotification(n);
                        setDetailModalOpen(true);
                      }}
                    >
                      <Eye size={12} /> Inspect Dossier
                    </button>

                    {n.delivery_status !== 'READ' && (
                      <button
                        type="button"
                        className="btn btn-outline"
                        style={{ padding: '3px 8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', color: '#059669' }}
                        onClick={() => handleMarkAsRead(n.id)}
                      >
                        <Check size={13} /> Mark Read
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: COMPOSE NEW BROADCAST                                            */}
      {/* ========================================================================= */}
      <Modal
        isOpen={composeModalOpen}
        onClose={() => !isSubmittingBroadcast && setComposeModalOpen(false)}
        title="Broadcast Announcement"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setComposeModalOpen(false)}
              disabled={isSubmittingBroadcast}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleBroadcastSubmit}
              disabled={isSubmittingBroadcast}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {isSubmittingBroadcast && <RefreshCw size={14} className="spin" />}
              <span>{isSubmittingBroadcast ? 'Dispatching...' : 'Dispatch Notice'}</span>
            </button>
          </div>
        }
      >
        <form onSubmit={handleBroadcastSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {composeError && (
            <div
              style={{
                padding: '10px 14px',
                backgroundColor: '#fef2f2',
                color: '#991b1b',
                borderRadius: '6px',
                fontSize: '0.84rem',
              }}
            >
              {composeError}
            </div>
          )}

          <FormField label="Notice Title" required>
            <input
              type="text"
              className="form-control"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="e.g. Mandatory Hostel Floor Meeting this Saturday"
              required
            />
          </FormField>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <FormField label="Category Type" required>
              <select
                className="form-control"
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
                required
              >
                <option value="ANNOUNCEMENT">Announcement</option>
                <option value="GENERAL">General Notice</option>
                <option value="SYSTEM">System Alert</option>
                <option value="LEAVE">Leave Advisory</option>
                <option value="COMPLAINT">Complaint Followup</option>
              </select>
            </FormField>

            <FormField label="Priority Level" required>
              <select
                className="form-control"
                value={formPriority}
                onChange={(e) => setFormPriority(e.target.value)}
                required
              >
                <option value="NORMAL">Normal</option>
                <option value="LOW">Low</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </FormField>
          </div>

          <FormField label="Target Audience" required helpText="Select who should receive this notification dispatch.">
            <select
              className="form-control"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              required
            >
              <option value="HOSTEL_RESIDENTS">
                All Assigned Hostel Residents ({residents.length} residents)
              </option>
              <option value="ALL_STAFF">
                Institutional Staff Members ({staffList.length} staff)
              </option>
              <option value="SPECIFIC_RESIDENTS">Custom Resident Selection</option>
            </select>
          </FormField>

          {targetAudience === 'SPECIFIC_RESIDENTS' && (
            <FormField label="Select Target Resident(s)" required helpText="Choose residents who will receive this message.">
              <select
                multiple
                className="form-control"
                style={{ height: '110px' }}
                value={selectedRecipientIds}
                onChange={(e) => {
                  const opts = Array.from(e.target.selectedOptions, (option) => option.value);
                  setSelectedRecipientIds(opts);
                }}
              >
                {residents.map((r) => {
                  const rId = r.user_id || r.id;
                  return (
                    <option key={rId} value={rId}>
                      {r.full_name || `${r.first_name || ''} ${r.last_name || ''}`} ({r.room_name || 'Room'} • {r.admission_number || ''})
                    </option>
                  );
                })}
              </select>
            </FormField>
          )}

          <FormField label="Notice Content / Message Body" required helpText="Full announcement text to be delivered to recipient inboxes.">
            <textarea
              className="form-control"
              rows={4}
              value={formMessage}
              onChange={(e) => setFormMessage(e.target.value)}
              placeholder="State the purpose, requirements, schedule, or instructions clearly..."
              required
            />
          </FormField>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 2: NOTICE DOSSIER                                                   */}
      {/* ========================================================================= */}
      <Modal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title="Official Notice Dossier"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <div>
              {selectedNotification && selectedNotification.delivery_status !== 'READ' && (
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#059669', fontSize: '0.8rem' }}
                  onClick={() => handleMarkAsRead(selectedNotification.id)}
                >
                  <Check size={14} /> Mark Read
                </button>
              )}
            </div>
            <button type="button" className="btn btn-primary" onClick={() => setDetailModalOpen(false)}>
              Close
            </button>
          </div>
        }
      >
        {selectedNotification && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div
              style={{
                padding: '14px',
                backgroundColor: '#f8fafc',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                    {selectedNotification.title}
                  </h3>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Notice ID: #{selectedNotification.id}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {getTypeBadge(selectedNotification.notification_type)}
                  {getPriorityBadge(selectedNotification.priority)}
                </div>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '6px' }}>
                Message Text
              </div>
              <div
                style={{
                  padding: '14px',
                  backgroundColor: '#ffffff',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.88rem',
                  lineHeight: 1.6,
                  color: 'var(--text-primary)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {selectedNotification.message}
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '12px',
                backgroundColor: '#f8fafc',
                padding: '12px',
                borderRadius: '6px',
                fontSize: '0.82rem',
              }}
            >
              <div>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem' }}>Delivery Status</span>
                <div>
                  <strong>{selectedNotification.delivery_status || 'DELIVERED'}</strong>
                </div>
              </div>

              <div>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem' }}>Dispatched At</span>
                <div>
                  <span>{formatDate(selectedNotification.created_at)}</span>
                </div>
              </div>

              {selectedNotification.read_at && (
                <div>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem' }}>Read At</span>
                  <div style={{ color: '#059669' }}>
                    <strong>{formatDate(selectedNotification.read_at)}</strong>
                  </div>
                </div>
              )}
            </div>

            {/* Lifecycle Notice */}
            <div
              style={{
                padding: '10px 12px',
                backgroundColor: 'rgba(100, 116, 139, 0.08)',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
              }}
            >
              <strong>Notice Lifecycle:</strong> Dispatched in-app notification (<code style={{ fontSize: '0.72rem' }}>app.notifications</code>). Stored directly in status <code style={{ fontSize: '0.72rem' }}>SENT</code>; server-side draft and scheduling lifecycles are unsupported by current API.
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
