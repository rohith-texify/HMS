import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../../shared/api/api';
import adminService from '../../admin/services/adminService';
import {
  Wrench,
  Search,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  Filter,
  Building2,
  Check,
  Edit2,
} from 'lucide-react';
import { LoadingState, EmptyState, Modal } from '../../../shared/components';

export default function InchargeComplaintsPage() {
  const [myHostel, setMyHostel] = useState(null);
  const [complaints, setComplaints] = useState([]);
  const [residents, setResidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  // Status Update Modal
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [newStatus, setNewStatus] = useState('IN_PROGRESS');
  const [resolutionMessage, setResolutionMessage] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const loadComplaints = useCallback(async (manual = false) => {
    try {
      if (manual) setIsRefreshing(true);
      else setLoading(true);

      const hostelRes = await adminService.getMyHostel();
      const hostel = hostelRes.data || hostelRes;
      setMyHostel(hostel);

      if (hostel?.hostel_id) {
        const [resRes, compRes] = await Promise.allSettled([
          adminService.getHostelResidents(hostel.hostel_id),
          api.get('/college/complaints'),
        ]);

        let residentList = [];
        if (resRes.status === 'fulfilled') {
          const d = resRes.value.data || resRes.value;
          residentList = Array.isArray(d) ? d : [];
          setResidents(residentList);
        }

        if (compRes.status === 'fulfilled') {
          const d = compRes.value.data || compRes.value;
          const allComplaints = Array.isArray(d) ? d : d?.complaints || [];

          // Scope complaints strictly to this hostel or students residing in this hostel
          const residentIds = new Set(residentList.map((r) => r.student_id));
          const scoped = allComplaints.filter(
            (c) =>
              c.hostel_id === hostel.hostel_id ||
              (c.student_id && residentIds.has(c.student_id))
          );
          setComplaints(scoped);
        }
      }
    } catch (err) {
      console.error('Failed to load complaints:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadComplaints();
  }, [loadComplaints]);

  const uniqueCategories = useMemo(() => {
    return Array.from(new Set(complaints.map((c) => c.category).filter(Boolean)));
  }, [complaints]);

  const filtered = useMemo(() => {
    return complaints.filter((c) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !search ||
        (c.title || '').toLowerCase().includes(q) ||
        (c.description || '').toLowerCase().includes(q) ||
        (c.category || '').toLowerCase().includes(q) ||
        (c.complaint_number || '').toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === 'ALL' || (c.status || '').toUpperCase() === statusFilter;
      const matchesCategory =
        categoryFilter === 'ALL' || c.category === categoryFilter;

      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [complaints, search, statusFilter, categoryFilter]);

  const pendingCount = complaints.filter(
    (c) => (c.status || '').toUpperCase() === 'PENDING'
  ).length;

  const handleOpenStatusModal = (complaint) => {
    setSelectedComplaint(complaint);
    setNewStatus(complaint.status || 'IN_PROGRESS');
    setResolutionMessage(complaint.resolution || '');
    setStatusModalOpen(true);
  };

  const handleSaveStatus = async (e) => {
    e.preventDefault();
    if (!selectedComplaint) return;

    try {
      setIsUpdating(true);
      await api.patch(`/college/complaints/${selectedComplaint.id}/status`, {
        status: newStatus,
        message: resolutionMessage || `Status changed to ${newStatus}`,
      });

      setStatusModalOpen(false);
      setSelectedComplaint(null);
      await loadComplaints(true);
    } catch (err) {
      console.error('Failed to update complaint status:', err);
      alert(err.response?.data?.message || 'Failed to update complaint status.');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="fade-in-up">
      {/* Supervisory Facility Scope Banner */}
      {myHostel && (
        <div
          style={{
            background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
            borderRadius: '12px',
            padding: '14px 20px',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Building2 size={20} style={{ color: '#a5b4fc' }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <strong style={{ fontSize: '1.05rem' }}>{myHostel.hostel_name}</strong>
                <span className="code-pill" style={{ background: '#4338ca', color: '#e0e7ff' }}>
                  {myHostel.hostel_code || 'HOSTEL'}
                </span>
                <span className="badge-enterprise badge-purple">
                  {myHostel.hostel_type || 'RESIDENTIAL'}
                </span>
              </div>
              <span style={{ fontSize: '11.5px', color: '#c7d2fe', marginTop: '2px', display: 'block' }}>
                Supervised by: <strong>{myHostel.staff_name}</strong> &bull; Facility Maintenance &amp; Resident Grievance Management
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                fontSize: '12px',
                color: '#e0e7ff',
                background: 'rgba(255, 255, 255, 0.1)',
                padding: '6px 12px',
                borderRadius: '8px',
              }}
            >
              Pending Tickets: <strong>{pendingCount}</strong>
            </span>
          </div>
        </div>
      )}

      {/* Enterprise Hero Header */}
      <div className="enterprise-hero-header">
        <div className="hero-header-titles">
          <div className="hero-category-pill">
            <Wrench size={13} />
            <span>Service Resolution</span>
          </div>
          <h1 className="hero-main-title">Hostel Complaints &amp; Service Requests</h1>
          <p className="hero-subtitle">
            Track and resolve resident maintenance tickets, room repairs, electrical, plumbing, and housekeeping issues strictly within {myHostel?.hostel_name || 'this facility'}.
          </p>
        </div>

        <div className="hero-action-buttons">
          <button
            type="button"
            className="btn-enterprise-secondary"
            onClick={() => loadComplaints(true)}
            disabled={isRefreshing}
          >
            <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} />
            <span>{isRefreshing ? 'Syncing...' : 'Sync Requests'}</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="kpi-cards-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Total Facility Tickets</span>
            <div className="stat-kpi-icon-wrap purple">
              <Wrench size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-purple-600">{complaints.length}</div>
          <div className="stat-kpi-footnote">
            <span>Maintenance requests logged</span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Pending Action</span>
            <div className="stat-kpi-icon-wrap orange">
              <Clock size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-orange-600">{pendingCount}</div>
          <div className="stat-kpi-footnote">
            <span>Awaiting incharge resolution</span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">In Progress</span>
            <div className="stat-kpi-icon-wrap blue">
              <AlertCircle size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-blue-600">
            {complaints.filter((c) => (c.status || '').toUpperCase() === 'IN_PROGRESS').length}
          </div>
          <div className="stat-kpi-footnote">
            <span>Technician assigned / active work</span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Resolved</span>
            <div className="stat-kpi-icon-wrap green">
              <CheckCircle2 size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-green-600">
            {complaints.filter((c) => (c.status || '').toUpperCase() === 'RESOLVED').length}
          </div>
          <div className="stat-kpi-footnote">
            <span>Completed resolutions</span>
          </div>
        </div>
      </div>

      {/* Main Container Card */}
      <div className="enterprise-card">
        <div className="card-topbar">
          <div className="card-title-group">
            <div className="card-title-icon-wrap">
              <Wrench size={16} />
            </div>
            <h2 className="card-title-text">
              Maintenance Tickets for {myHostel?.hostel_name || 'Hostel'} ({filtered.length})
            </h2>
          </div>

          <span className="badge-enterprise badge-purple">
            {filtered.length} of {complaints.length} Shown
          </span>
        </div>

        {/* Filter Toolbar */}
        <div className="enterprise-filter-bar">
          <div className="filter-search-field">
            <Search size={14} className="filter-search-icon" />
            <input
              type="text"
              className="filter-search-input"
              placeholder="Search by ticket #, title, description, category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <select
              className="filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">PENDING</option>
              <option value="IN_PROGRESS">IN_PROGRESS</option>
              <option value="RESOLVED">RESOLVED</option>
            </select>

            <select
              className="filter-select"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="ALL">All Categories</option>
              {uniqueCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="enterprise-table-container">
          <table className="enterprise-table">
            <thead>
              <tr>
                <th>Ticket Info</th>
                <th>Category</th>
                <th>Logged At</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '36px' }}>
                    <LoadingState message="Loading facility complaints..." />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '36px' }}>
                    <EmptyState
                      title="No complaints found"
                      message="No maintenance requests match your search criteria for this facility."
                    />
                  </td>
                </tr>
              ) : (
                filtered.map((c) => {
                  const status = (c.status || 'PENDING').toUpperCase();
                  const isResolved = status === 'RESOLVED';
                  const isInProgress = status === 'IN_PROGRESS';

                  return (
                    <tr key={c.id}>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <strong style={{ color: '#0f172a', fontSize: '13.5px' }}>
                              {c.title}
                            </strong>
                            {c.complaint_number && (
                              <span className="code-pill">{c.complaint_number}</span>
                            )}
                          </div>
                          {c.description && (
                            <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                              {c.description.slice(0, 100)}...
                            </span>
                          )}
                        </div>
                      </td>

                      <td>
                        <span className="badge-enterprise badge-purple">
                          {c.category || 'GENERAL'}
                        </span>
                      </td>

                      <td>
                        <span style={{ fontSize: '12px', color: '#475569' }}>
                          {c.created_at ? new Date(c.created_at).toLocaleDateString() : 'Recent'}
                        </span>
                      </td>

                      <td>
                        {isResolved ? (
                          <span className="badge-enterprise badge-green">RESOLVED</span>
                        ) : isInProgress ? (
                          <span className="badge-enterprise badge-blue">IN PROGRESS</span>
                        ) : (
                          <span className="badge-enterprise badge-orange">PENDING</span>
                        )}
                      </td>

                      <td>
                        <button
                          type="button"
                          className="btn-enterprise-secondary"
                          style={{ padding: '4px 10px', fontSize: '11.5px' }}
                          onClick={() => handleOpenStatusModal(c)}
                        >
                          <Edit2 size={12} />
                          <span>Update</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =================================================================== */}
      {/* MODAL: Update Complaint Status                                      */}
      {/* =================================================================== */}
      {statusModalOpen && (
        <Modal
          isOpen={statusModalOpen}
          onClose={() => setStatusModalOpen(false)}
          title={`Update Complaint #${selectedComplaint?.complaint_number || 'Ticket'}`}
        >
          <form onSubmit={handleSaveStatus}>
            <div style={{ marginBottom: '14px' }}>
              <strong style={{ fontSize: '14px', color: '#0f172a', display: 'block' }}>
                {selectedComplaint?.title}
              </strong>
              <p style={{ fontSize: '12.5px', color: '#64748b', marginTop: '4px' }}>
                {selectedComplaint?.description}
              </p>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Resolution Status *
              </label>
              <select
                className="filter-select"
                style={{ width: '100%' }}
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                required
              >
                <option value="PENDING">PENDING</option>
                <option value="IN_PROGRESS">IN_PROGRESS (Technician Dispatched)</option>
                <option value="RESOLVED">RESOLVED (Completed)</option>
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Resolution / Progress Notes
              </label>
              <textarea
                className="filter-search-input"
                style={{ width: '100%', minHeight: '80px', padding: '8px' }}
                placeholder="Describe resolution actions or technician update..."
                value={resolutionMessage}
                onChange={(e) => setResolutionMessage(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn-enterprise-secondary"
                onClick={() => setStatusModalOpen(false)}
                disabled={isUpdating}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-enterprise-primary"
                disabled={isUpdating}
              >
                {isUpdating ? 'Saving...' : 'Save Update'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
