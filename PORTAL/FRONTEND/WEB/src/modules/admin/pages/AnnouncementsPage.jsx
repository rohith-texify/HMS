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
} from 'lucide-react';
import {
  PageHeader,
  DataTable,
  SearchInput,
  FilterControls,
  Modal,
  FormField,
  LoadingState,
  EmptyState,
  ErrorState,
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

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [readFilter, setReadFilter] = useState('ALL'); // 'ALL' | 'UNREAD' | 'READ'

  // Modals Visibility
  const [composeModalOpen, setComposeModalOpen] = useState(false);
  const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(false);
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
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage(null);

      const [notifsRes, unreadRes, studentsRes, staffRes] = await Promise.allSettled([
        adminService.getNotifications(),
        adminService.getUnreadNotificationCount(),
        adminService.getStudents({ limit: 100 }),
        adminService.getStaffList(),
      ]);

      const notifList = notifsRes.status === 'fulfilled'
        ? (Array.isArray(notifsRes.value) ? notifsRes.value : notifsRes.value?.data || [])
        : [];
      setNotifications(notifList);

      const count = unreadRes.status === 'fulfilled'
        ? (unreadRes.value?.unread_count ?? unreadRes.value?.count ?? 0)
        : 0;
      setUnreadCount(count);

      const studList = studentsRes.status === 'fulfilled'
        ? (Array.isArray(studentsRes.value) ? studentsRes.value : studentsRes.value?.students || studentsRes.value?.data || [])
        : [];
      setStudents(studList);

      const stList = staffRes.status === 'fulfilled'
        ? (Array.isArray(staffRes.value) ? staffRes.value : staffRes.value?.staff || staffRes.value?.data || [])
        : [];
      setStaffList(stList);
    } catch (err) {
      console.error('Failed to load notifications:', err);
      setErrorMessage(err?.response?.data?.error?.message || err.message || 'Unable to load announcements.');
    } finally {
      setLoading(false);
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
  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'URGENT':
        return 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300';
      case 'HIGH':
        return 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300';
      case 'NORMAL':
        return 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300';
      case 'LOW':
        return 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-300';
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    }
  };

  const getTypeBadge = (type) => {
    switch (type) {
      case 'ANNOUNCEMENT':
        return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950 dark:text-purple-300';
      case 'SYSTEM':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300';
      case 'LEAVE':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300';
      case 'COMPLAINT':
        return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300';
    }
  };

  // Filtered Notifications
  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      const matchesSearch =
        !searchTerm ||
        (n.title && n.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (n.message && n.message.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesType = typeFilter === 'ALL' || n.notification_type === typeFilter;
      const matchesPriority = priorityFilter === 'ALL' || n.priority === priorityFilter;
      const isUnread = n.delivery_status !== 'READ' && !n.read_at;
      const matchesRead =
        readFilter === 'ALL' ||
        (readFilter === 'UNREAD' && isUnread) ||
        (readFilter === 'READ' && !isUnread);

      return matchesSearch && matchesType && matchesPriority && matchesRead;
    });
  }, [notifications, searchTerm, typeFilter, priorityFilter, readFilter]);

  // Table Columns
  const columns = [
    {
      key: 'title',
      title: 'Announcement & Details',
      render: (row) => {
        const isUnread = row.delivery_status !== 'READ' && !row.read_at;
        return (
          <div className="flex items-start gap-3 max-w-lg">
            <div className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${isUnread ? 'bg-indigo-600' : 'bg-transparent'}`} />
            <div>
              <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>{row.title}</span>
                {isUnread && (
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 uppercase">
                    New
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 line-clamp-1 mt-0.5 font-normal">
                {row.message}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      key: 'notification_type',
      title: 'Category',
      render: (row) => (
        <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${getTypeBadge(row.notification_type)}`}>
          {row.notification_type}
        </span>
      ),
    },
    {
      key: 'priority',
      title: 'Priority',
      render: (row) => (
        <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${getPriorityBadge(row.priority)}`}>
          {row.priority}
        </span>
      ),
    },
    {
      key: 'status',
      title: 'Delivery',
      render: (row) => {
        const isRead = row.delivery_status === 'READ' || !!row.read_at;
        return (
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
              isRead
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                : 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
            }`}
          >
            {isRead ? <Check className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
            {isRead ? 'Read' : 'Delivered'}
          </span>
        );
      },
    },
    {
      key: 'created_at',
      title: 'Broadcast Time',
      render: (row) => (
        <span className="text-xs text-slate-500 whitespace-nowrap">
          {row.created_at ? new Date(row.created_at).toLocaleString() : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      title: 'Actions',
      render: (row) => {
        const isUnread = row.delivery_status !== 'READ' && !row.read_at;
        return (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setSelectedNotification(row);
                setDetailsDrawerOpen(true);
                if (isUnread) {
                  handleMarkAsRead(row.id);
                }
              }}
              className="p-1.5 text-slate-500 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="View full announcement"
            >
              <Eye className="w-4 h-4" />
            </button>
            {isUnread && (
              <button
                onClick={() => handleMarkAsRead(row.id)}
                className="p-1.5 text-slate-500 hover:text-emerald-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                title="Mark as read"
              >
                <Check className="w-4 h-4" />
              </button>
            )}
          </div>
        );
      },
    },
  ];

  if (loading && notifications.length === 0) {
    return <LoadingState message="Connecting to institutional broadcast channels..." />;
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <PageHeader
        title="Notice & Broadcast Announcements"
        subtitle="Broadcast administrative circulars, hostel bulletins, maintenance notices, and emergency alerts."
        icon={Megaphone}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={loadData}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-750 transition"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                disabled={isRefreshing}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-750 transition"
              >
                <Check className="w-4 h-4 text-emerald-600" />
                Mark All Read
              </button>
            )}

            {canBroadcast && (
              <button
                onClick={() => setComposeModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition shadow-sm"
              >
                <Plus className="w-4 h-4" />
                New Broadcast
              </button>
            )}
          </div>
        }
      />

      {/* Success Banner */}
      {successBanner && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-emerald-800 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="text-sm font-medium">{successBanner}</span>
          </div>
          <button
            onClick={() => setSuccessBanner(null)}
            className="text-xs font-semibold uppercase hover:underline ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg flex items-center justify-between text-rose-800 dark:bg-rose-950 dark:border-rose-800 dark:text-rose-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
            <span className="text-sm font-medium">{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-xs font-semibold uppercase hover:underline ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-lg">
            <Megaphone className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {notifications.length}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Total Bulletins & Notices
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 rounded-lg">
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {unreadCount}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Unread Bulletins
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 rounded-lg">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {notifications.filter((n) => n.priority === 'URGENT' || n.priority === 'HIGH').length}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              High / Urgent Bulletins
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-lg">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {students.length + staffList.length}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Connected Campus Recipients
            </div>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex-1 min-w-[240px] max-w-md">
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search announcement titles or content..."
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
          >
            <option value="ALL">All Categories</option>
            <option value="ANNOUNCEMENT">Announcement</option>
            <option value="GENERAL">General</option>
            <option value="SYSTEM">System</option>
            <option value="LEAVE">Leave</option>
            <option value="COMPLAINT">Complaint</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
          >
            <option value="ALL">All Priorities</option>
            <option value="URGENT">Urgent</option>
            <option value="HIGH">High</option>
            <option value="NORMAL">Normal</option>
            <option value="LOW">Low</option>
          </select>

          <select
            value={readFilter}
            onChange={(e) => setReadFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
          >
            <option value="ALL">All Read States</option>
            <option value="UNREAD">Unread Only</option>
            <option value="READ">Read Only</option>
          </select>
        </div>
      </div>

      {/* Notifications Table */}
      <DataTable
        columns={columns}
        data={filteredNotifications}
        loading={isRefreshing}
        emptyMessage={
          <EmptyState
            icon={Megaphone}
            title="No Announcements Found"
            message="No bulletins match your current filter parameters or no broadcasts have been transmitted yet."
            action={
              canBroadcast && (
                <button
                  onClick={() => setComposeModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
                >
                  <Plus className="w-4 h-4" />
                  Compose Broadcast
                </button>
              )
            }
          />
        }
      />

      {/* MODAL: BROADCAST COMPOSER */}
      <Modal
        isOpen={composeModalOpen}
        onClose={() => !submitting && setComposeModalOpen(false)}
        title="Compose Official Campus Broadcast"
      >
        <form onSubmit={handleBroadcastSubmit} className="space-y-4">
          <FormField label="Announcement Title" required>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g. Scheduled Power Outage & Water Supply Maintenance"
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Category Type" required>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
                required
              >
                <option value="ANNOUNCEMENT">Official Announcement</option>
                <option value="GENERAL">General Notice</option>
                <option value="SYSTEM">System Broadcast</option>
                <option value="LEAVE">Leave Notice</option>
                <option value="COMPLAINT">Complaint Update</option>
              </select>
            </FormField>

            <FormField label="Priority Level" required>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
                required
              >
                <option value="LOW">Low</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High Priority</option>
                <option value="URGENT">Urgent Action Required</option>
              </select>
            </FormField>
          </div>

          <FormField
            label="Target Audience"
            required
            helper="Select community groups who will receive this broadcast."
          >
            <select
              value={formData.target_audience}
              onChange={(e) => setFormData({ ...formData, target_audience: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 font-medium"
              required
            >
              <option value="ALL_STUDENTS">All Enrolled Students ({students.length} recipients)</option>
              <option value="ALL_STAFF">All Hostel & Institutional Staff ({staffList.length} recipients)</option>
              <option value="EVERYONE">Complete Campus Community ({students.length + staffList.length} recipients)</option>
            </select>
          </FormField>

          <FormField label="Message Body" required>
            <textarea
              rows={5}
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              placeholder="Provide complete instructions, schedules, affected wings, and contact details..."
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed"
              required
            />
          </FormField>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setComposeModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow flex items-center gap-2"
            >
              {submitting && <RefreshCw className="w-4 h-4 animate-spin" />}
              <Send className="w-4 h-4" />
              Broadcast Now
            </button>
          </div>
        </form>
      </Modal>

      {/* DRAWER / MODAL: VIEW DETAILS */}
      {detailsDrawerOpen && selectedNotification && (
        <Modal
          isOpen={detailsDrawerOpen}
          onClose={() => setDetailsDrawerOpen(false)}
          title="Announcement Details"
        >
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getTypeBadge(selectedNotification.notification_type)}`}>
                {selectedNotification.notification_type}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getPriorityBadge(selectedNotification.priority)}`}>
                {selectedNotification.priority} Priority
              </span>
            </div>

            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {selectedNotification.title}
            </h3>

            <div className="p-4 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed">
              {selectedNotification.message}
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs text-slate-500 pt-2 border-t border-slate-200 dark:border-slate-700">
              <div>
                <span className="font-semibold text-slate-700 dark:text-slate-300 block">
                  Broadcast Date:
                </span>
                {selectedNotification.created_at
                  ? new Date(selectedNotification.created_at).toLocaleString()
                  : '—'}
              </div>
              <div>
                <span className="font-semibold text-slate-700 dark:text-slate-300 block">
                  Channel:
                </span>
                {selectedNotification.channel || 'IN_APP'}
              </div>
            </div>

            <div className="flex justify-end pt-3">
              <button
                type="button"
                onClick={() => setDetailsDrawerOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 rounded-lg"
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

