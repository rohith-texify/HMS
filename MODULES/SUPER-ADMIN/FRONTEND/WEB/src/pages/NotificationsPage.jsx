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
  const [loading, setLoading] = useState(true);
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
    <div className="page-container space-y-6">
      {/* Header */}
      <div className="header-container border-b border-gray-200 pb-5">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Bell className="w-6 h-6 text-indigo-600" />
            Notification & Broadcast Management
          </h1>
          <p className="page-subtitle">
            Publish official company announcements, advisories, and targeted maintenance broadcasts to College Admin portals.
          </p>
        </div>
        <div className="quick-actions">
          <button
            onClick={() => loadNotifications()}
            className="btn btn-outline"
            title="Refresh"
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => {
              setShowModal(true);
              handleAudiencePreview('SELECTED_COLLEGES', []);
            }}
            className="btn btn-primary"
          >
            <Send className="w-4 h-4" />
            Compose Announcement
          </button>
        </div>
      </div>


      {submitSuccess && (
        <div className="p-4 bg-green-50 border border-green-200 text-green-800 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span>{submitSuccess}</span>
          </div>
          <button onClick={() => setSubmitSuccess(null)} className="text-green-600 hover:text-green-800 font-semibold">✕</button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800 font-semibold">✕</button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
          <Filter className="w-3.5 h-3.5 text-indigo-600" />
          Filters:
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-xs font-medium border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Statuses</option>
          <option value="PUBLISHED">Published</option>
          <option value="DRAFT">Draft</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="EXPIRED">Expired</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="text-xs font-medium border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Categories</option>
          <option value="SYSTEM">System Notice</option>
          <option value="MAINTENANCE">Maintenance</option>
          <option value="SECURITY">Security Alert</option>
          <option value="FEATURE">Feature Release</option>
          <option value="GENERAL">General</option>
        </select>
        <div className="flex-1 min-w-[220px]">
          <input
            type="text"
            placeholder="Search by title, message or creator..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadNotifications()}
            className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Directory Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-base font-medium text-gray-900">No notifications found</p>
            <p className="text-sm text-gray-500 mt-1">Compose a new notification to reach College Administrators.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200">
                <tr>
                  <th className="py-3 px-4">Title & Details</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Target Audience</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Created By</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {notifications.map((n) => (
                  <tr key={n.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-900">{n.title}</div>
                      <div className="text-xs text-gray-500 line-clamp-1 mt-0.5">{n.message}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                        {n.notification_type}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          n.priority === 'URGENT'
                            ? 'bg-red-100 text-red-800'
                            : n.priority === 'HIGH'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {n.priority}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-gray-700">
                        <Building className="w-3.5 h-3.5 text-gray-400" />
                        {n.target_type === 'ALL_COLLEGES' ? 'All Active Colleges' : 'Selected Tenants'}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          n.status === 'PUBLISHED'
                            ? 'bg-green-100 text-green-800'
                            : n.status === 'DRAFT'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {n.status === 'PUBLISHED' && <CheckCircle className="w-3 h-3" />}
                        {n.status === 'DRAFT' && <Clock className="w-3 h-3" />}
                        {n.status === 'CANCELLED' && <XCircle className="w-3 h-3" />}
                        {n.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-500">{n.created_by_name}</td>
                    <td className="py-3 px-4 text-xs text-gray-500">
                      {new Date(n.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {n.status !== 'CANCELLED' && (
                        <button
                          onClick={() => handleCancelNotification(n.id)}
                          className="text-xs text-red-600 hover:text-red-800 font-medium"
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
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 max-w-2xl w-full p-6 space-y-5 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Send className="w-5 h-5 text-indigo-600" />
                Compose Company Announcement
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateNotification} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Category</label>
                  <select
                    value={formData.notification_type}
                    onChange={(e) => setFormData({ ...formData, notification_type: e.target.value })}
                    className="w-full text-sm border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="SYSTEM">System Announcement</option>
                    <option value="MAINTENANCE">Scheduled Maintenance</option>
                    <option value="SECURITY">Security Notice</option>
                    <option value="FEATURE">Feature Release</option>
                    <option value="GENERAL">General Notice</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full text-sm border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="LOW">Low</option>
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Target Audience</label>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, target_type: 'SELECTED_COLLEGES' });
                      handleAudiencePreview('SELECTED_COLLEGES', formData.college_ids);
                    }}
                    className={`p-3 text-left border rounded-xl transition-all ${
                      formData.target_type === 'SELECTED_COLLEGES'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-semibold'
                        : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <div className="text-sm font-semibold">Selected Colleges</div>
                    <div className="text-xs text-gray-500 mt-0.5">Target specific tenants</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, target_type: 'ALL_COLLEGES' });
                      handleAudiencePreview('ALL_COLLEGES', []);
                    }}
                    className={`p-3 text-left border rounded-xl transition-all ${
                      formData.target_type === 'ALL_COLLEGES'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-semibold'
                        : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <div className="text-sm font-semibold">Company-Wide Broadcast</div>
                    <div className="text-xs text-gray-500 mt-0.5">Requires Approval Workflow</div>
                  </button>
                </div>

                {formData.target_type === 'SELECTED_COLLEGES' && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Select Target Colleges</label>
                    <div className="max-h-36 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
                      {colleges.map((col) => (
                        <label key={col.college_id} className="flex items-center gap-2 text-xs text-gray-700 hover:bg-gray-50 p-1 rounded">
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
                            className="rounded text-indigo-600"
                          />
                          <span>
                            {col.name} ({col.college_code})
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Audience Preview Info */}
              {audiencePreview && (
                <div className={`p-3 rounded-lg text-xs ${audiencePreview.RequiresReview ? 'bg-amber-50 border border-amber-200 text-amber-900' : 'bg-blue-50 border border-blue-200 text-blue-900'}`}>
                  <div className="font-semibold flex items-center gap-1.5 mb-1">
                    <Eye className="w-3.5 h-3.5" />
                    Target Audience Preview: {audiencePreview.EligibleCount} Colleges
                  </div>
                  {audiencePreview.ApprovalNote && (
                    <p className="mt-1 font-medium">{audiencePreview.ApprovalNote}</p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Scheduled Maintenance Notification"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full text-sm border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Message Body</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Enter detailed announcement message..."
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full text-sm border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium shadow-sm transition-colors disabled:opacity-50"
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
