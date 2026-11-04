import React, { useState, useEffect, useMemo } from 'react';
import api from '../../../shared/api/api';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  RefreshCw,
  Search,
  Wrench,
  XCircle,
  Zap,
  Droplets,
  Home,
  Utensils,
  Sparkles,
  ShieldAlert,
  HelpCircle,
  ChevronRight,
  Eye,
  LayoutGrid,
  List,
  Flame,
  Plus,
  X,
  Calendar,
  Check,
  AlertCircle,
  Info,
  UserCheck,
  MessageSquare,
  Building2,
  ArrowRight
} from 'lucide-react';

const CATEGORIES = [
  { id: 'ELECTRICITY', label: 'Electricity', icon: Zap, color: '#f59e0b', bg: '#fef3c7' },
  { id: 'WATER', label: 'Plumbing & Water', icon: Droplets, color: '#06b6d4', bg: '#cffafe' },
  { id: 'ROOM', label: 'Room & Furniture', icon: Home, color: '#6366f1', bg: '#e0e7ff' },
  { id: 'CLEANLINESS', label: 'Cleanliness', icon: Sparkles, color: '#10b981', bg: '#d1fae5' },
  { id: 'FOOD', label: 'Mess & Food', icon: Utensils, color: '#ec4899', bg: '#fce7f3' },
  { id: 'SECURITY', label: 'Security & Safety', icon: ShieldAlert, color: '#8b5cf6', bg: '#ede9fe' },
  { id: 'MAINTENANCE', label: 'General Repairs', icon: Wrench, color: '#2563eb', bg: '#dbeafe' },
  { id: 'OTHER', label: 'Other Inquiries', icon: HelpCircle, color: '#64748b', bg: '#f1f5f9' },
];

export default function StudentComplaintsPage() {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters & Views
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);

  // Form State
  const [newCategory, setNewCategory] = useState('ELECTRICITY');
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState('NORMAL');
  const [newRoom, setNewRoom] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Fetch Complaints
  const fetchComplaints = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);

      const res = await api.get('/college/complaints');
      const d = res.data || res;
      const list = Array.isArray(d) ? d : d?.complaints || [];
      setComplaints(list);
    } catch (err) {
      console.error('Failed to load complaints:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchComplaints();
  }, []);

  // Compute Metrics
  const metrics = useMemo(() => {
    const total = complaints.length;
    let pending = 0;
    let inProgress = 0;
    let resolved = 0;

    complaints.forEach((c) => {
      const s = (c.status || '').toUpperCase();
      if (s === 'RESOLVED' || s === 'CLOSED') {
        resolved++;
      } else if (s === 'IN_PROGRESS' || s === 'ASSIGNED') {
        inProgress++;
      } else {
        pending++;
      }
    });

    const rate = total > 0 ? Math.round((resolved / total) * 100) : 0;
    return { total, pending, inProgress, resolved, rate };
  }, [complaints]);

  // Filtered List
  const filteredComplaints = useMemo(() => {
    return complaints.filter((item) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = (item.title || '').toLowerCase().includes(q);
        const matchDesc = (item.description || '').toLowerCase().includes(q);
        const matchId = (item.id || '').toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchId) return false;
      }

      // Status
      if (statusFilter !== 'ALL') {
        const s = (item.status || '').toUpperCase();
        if (statusFilter === 'OPEN' && s !== 'OPEN' && s !== 'PENDING') return false;
        if (statusFilter === 'IN_PROGRESS' && s !== 'IN_PROGRESS' && s !== 'ASSIGNED') return false;
        if (statusFilter === 'RESOLVED' && s !== 'RESOLVED' && s !== 'CLOSED') return false;
      }

      // Category
      if (categoryFilter !== 'ALL') {
        if ((item.category || '').toUpperCase() !== categoryFilter) return false;
      }

      // Priority
      if (priorityFilter !== 'ALL') {
        if ((item.priority || '').toUpperCase() !== priorityFilter) return false;
      }

      return true;
    });
  }, [complaints, searchQuery, statusFilter, categoryFilter, priorityFilter]);

  // Submit Complaint
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!newTitle.trim()) {
      setFormError('Please enter a short title for your service request.');
      return;
    }
    if (!newDescription.trim()) {
      setFormError('Please describe the issue or maintenance requirement.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        category: newCategory,
        title: newTitle.trim(),
        description: newRoom.trim() ? `[Room/Location: ${newRoom.trim()}] ${newDescription.trim()}` : newDescription.trim(),
        priority: newPriority,
      };

      const res = await api.post('/college/complaints', payload);
      const created = res.data || res;

      // Optimistically prepend or reload
      if (created && created.id) {
        setComplaints((prev) => [created, ...prev]);
      } else {
        await fetchComplaints();
      }

      setFormSuccess('Service request submitted successfully! A warden or technician will inspect it shortly.');
      setTimeout(() => {
        setShowCreateModal(false);
        setNewTitle('');
        setNewDescription('');
        setNewRoom('');
        setNewPriority('NORMAL');
        setNewCategory('ELECTRICITY');
        setFormSuccess('');
      }, 1200);
    } catch (err) {
      console.error('Failed to submit complaint:', err);
      setFormError(err?.response?.data?.error?.message || err?.message || 'Failed to submit service request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Helper for Category Metadata
  const getCategoryMeta = (cat) => {
    const norm = (cat || '').toUpperCase();
    const found = CATEGORIES.find((c) => c.id === norm);
    if (found) return found;
    return { id: norm, label: norm || 'General', icon: Wrench, color: '#64748b', bg: '#f1f5f9' };
  };

  // Helper for Status Badge
  const renderStatusBadge = (status) => {
    const s = (status || '').toUpperCase();
    if (s === 'RESOLVED' || s === 'CLOSED') {
      return (
        <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <CheckCircle2 size={12} /> Resolved
        </span>
      );
    }
    if (s === 'IN_PROGRESS' || s === 'ASSIGNED') {
      return (
        <span className="badge badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
          <Clock size={12} /> In Progress
        </span>
      );
    }
    return (
      <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        <AlertTriangle size={12} /> Pending Review
      </span>
    );
  };

  // Helper for Priority Badge
  const renderPriorityBadge = (priority) => {
    const p = (priority || '').toUpperCase();
    if (p === 'URGENT') {
      return (
        <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#ffe4e6', color: '#be123c', border: '1px solid #fecdd3' }}>
          <Flame size={12} /> Urgent
        </span>
      );
    }
    if (p === 'HIGH') {
      return (
        <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <AlertCircle size={12} /> High
        </span>
      );
    }
    if (p === 'LOW') {
      return (
        <span className="badge badge-neutral" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' }}>
          Low
        </span>
      );
    }
    return (
      <span className="badge badge-neutral" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' }}>
        Normal
      </span>
    );
  };

  return (
    <div>
      {/* Page Header */}
      <div className="header-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Wrench className="text-primary" size={26} />
            Service Requests & Complaints
          </h1>
          <p className="page-subtitle">
            Report room maintenance, electrical, plumbing, or facility issues. Track technician dispatch and resolution updates in real time.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => fetchComplaints(true)}
            disabled={refreshing || loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={15} className={refreshing ? 'spin-icon' : ''} />
            Refresh
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setFormError('');
              setFormSuccess('');
              setShowCreateModal(true);
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)' }}
          >
            <Plus size={16} />
            Log Service Request
          </button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '20px', borderLeft: '4px solid #3b82f6' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total Requests
            </span>
            <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Wrench size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 700, color: '#0f172a', marginTop: '8px' }}>
            {loading ? '...' : metrics.total}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
            Lifetime logged tickets
          </div>
        </div>

        <div className="card" style={{ padding: '20px', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Pending Review
            </span>
            <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#fffbeb', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 700, color: '#0f172a', marginTop: '8px' }}>
            {loading ? '...' : metrics.pending}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
            Awaiting warden assessment
          </div>
        </div>

        <div className="card" style={{ padding: '20px', borderLeft: '4px solid #06b6d4' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              In Progress / Dispatched
            </span>
            <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#ecfeff', color: '#0891b2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 700, color: '#0f172a', marginTop: '8px' }}>
            {loading ? '...' : metrics.inProgress}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
            Technicians currently assigned
          </div>
        </div>

        <div className="card" style={{ padding: '20px', borderLeft: '4px solid #10b981' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Resolved Issues
            </span>
            <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '8px' }}>
            <span style={{ fontSize: '1.85rem', fontWeight: 700, color: '#0f172a' }}>
              {loading ? '...' : metrics.resolved}
            </span>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#059669' }}>
              ({metrics.rate}% rate)
            </span>
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
            Successfully closed work orders
          </div>
        </div>
      </div>

      {/* Filter Toolbar & View Toggle */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          {/* Search Box */}
          <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: '420px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search by ticket title, description, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-control"
              style={{ paddingLeft: '38px', height: '38px', fontSize: '0.88rem' }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Status Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f1f5f9', padding: '4px', borderRadius: '10px' }}>
            {[
              { id: 'ALL', label: 'All' },
              { id: 'OPEN', label: 'Pending' },
              { id: 'IN_PROGRESS', label: 'In Progress' },
              { id: 'RESOLVED', label: 'Resolved' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                style={{
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '7px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  background: statusFilter === tab.id ? '#ffffff' : 'transparent',
                  color: statusFilter === tab.id ? '#0f172a' : '#64748b',
                  boxShadow: statusFilter === tab.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* View Mode Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '2px' }}>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              title="Cards Grid View"
              style={{
                border: 'none',
                background: viewMode === 'cards' ? '#e0e7ff' : 'transparent',
                color: viewMode === 'cards' ? '#3730a3' : '#64748b',
                padding: '6px 10px',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <LayoutGrid size={16} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              title="Table View"
              style={{
                border: 'none',
                background: viewMode === 'table' ? '#e0e7ff' : 'transparent',
                color: viewMode === 'table' ? '#3730a3' : '#64748b',
                padding: '6px 10px',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <List size={16} />
            </button>
          </div>
        </div>

        {/* Category Filter Chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
          <span style={{ fontSize: '0.76rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', flexShrink: 0, marginRight: '4px' }}>
            Category:
          </span>
          <button
            type="button"
            className={`complaint-filter-chip ${categoryFilter === 'ALL' ? 'active' : ''}`}
            onClick={() => setCategoryFilter('ALL')}
          >
            All Categories
          </button>
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const active = categoryFilter === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                className={`complaint-filter-chip ${active ? 'active' : ''}`}
                onClick={() => setCategoryFilter(active ? 'ALL' : cat.id)}
              >
                <Icon size={12} />
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Area: Cards or Table */}
      {loading ? (
        <div className="card" style={{ padding: '60px 20px', textAlign: 'center' }}>
          <RefreshCw size={32} className="spin-icon" style={{ color: '#3b82f6', margin: '0 auto 12px auto' }} />
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#0f172a' }}>Loading Service Requests...</h3>
          <p style={{ fontSize: '0.84rem', color: '#64748b', margin: '4px 0 0 0' }}>Syncing ticket status with maintenance desk</p>
        </div>
      ) : filteredComplaints.length === 0 ? (
        <div className="card" style={{ padding: '60px 20px', textAlign: 'center' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' }}>
            <Wrench size={28} />
          </div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>No Service Requests Found</h3>
          <p style={{ fontSize: '0.88rem', color: '#64748b', maxWidth: '440px', margin: '8px auto 20px auto', lineHeight: 1.5 }}>
            {searchQuery || statusFilter !== 'ALL' || categoryFilter !== 'ALL'
              ? 'No complaints matched your active search or filters. Try adjusting your parameters.'
              : 'You have not submitted any maintenance complaints or service requests yet.'}
          </p>
          {(searchQuery || statusFilter !== 'ALL' || categoryFilter !== 'ALL') ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('ALL');
                setCategoryFilter('ALL');
                setPriorityFilter('ALL');
              }}
            >
              Reset Filters
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowCreateModal(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              <Plus size={16} /> Log Your First Service Request
            </button>
          )}
        </div>
      ) : viewMode === 'cards' ? (
        /* Cards Grid View */
        <div className="complaints-grid-cards">
          {filteredComplaints.map((item, idx) => {
            const catMeta = getCategoryMeta(item.category);
            const CatIcon = catMeta.icon;
            const priorityClass = `priority-${(item.priority || 'normal').toLowerCase()}`;
            const isResolved = (item.status || '').toUpperCase() === 'RESOLVED' || (item.status || '').toUpperCase() === 'CLOSED';

            return (
              <div
                key={item.id || idx}
                className={`complaint-card-v2 ${priorityClass} ${isResolved ? 'status-resolved' : ''}`}
                style={{ cursor: 'pointer' }}
                onClick={() => setSelectedTicket(item)}
              >
                <div className="complaint-card-top">
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', minWidth: 0 }}>
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '12px',
                        background: catMeta.bg,
                        color: catMeta.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <CatIcon size={20} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div className="complaint-title-text" title={item.title}>
                        {item.title || 'Untitled Request'}
                      </div>
                      <div className="complaint-meta-sub">
                        <span>{catMeta.label}</span>
                        <span>•</span>
                        <span>Ref #{item.id ? item.id.substring(0, 8) : `T-${idx + 1}`}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    {renderStatusBadge(item.status)}
                  </div>
                </div>

                <div className="complaint-card-body">
                  <p className="complaint-desc-clamp">
                    {item.description || 'No description provided.'}
                  </p>

                  <div className="complaint-info-stack">
                    <div className="complaint-info-row">
                      <Calendar size={13} style={{ color: '#94a3b8' }} />
                      <span>Submitted: {item.created_at ? new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently'}</span>
                    </div>

                    <div className="complaint-info-row">
                      <Flame size={13} style={{ color: '#94a3b8' }} />
                      <span>Priority: </span>
                      {renderPriorityBadge(item.priority)}
                    </div>

                    {item.assigned_to_name && (
                      <div className="complaint-info-row">
                        <UserCheck size={13} style={{ color: '#059669' }} />
                        <span style={{ color: '#059669', fontWeight: 600 }}>Assigned: {item.assigned_to_name}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="complaint-card-footer">
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Click card to track progress
                  </span>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedTicket(item);
                    }}
                  >
                    <Eye size={13} /> View Dossier
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* High-Density Table View */
        <div className="card">
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Request Title & Description</th>
                  <th>Category</th>
                  <th>Priority</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredComplaints.map((item, idx) => {
                  const catMeta = getCategoryMeta(item.category);
                  const CatIcon = catMeta.icon;

                  return (
                    <tr
                      key={item.id || idx}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSelectedTicket(item)}
                    >
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '8px',
                              background: catMeta.bg,
                              color: catMeta.color,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <CatIcon size={16} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: '#0f172a' }}>{item.title}</div>
                            <div style={{ fontSize: '0.76rem', color: '#64748b', maxWidth: '380px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {item.description}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>
                          {catMeta.label}
                        </span>
                      </td>
                      <td>{renderPriorityBadge(item.priority)}</td>
                      <td>
                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                          {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Recent'}
                        </span>
                      </td>
                      <td>{renderStatusBadge(item.status)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '4px 10px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTicket(item);
                          }}
                        >
                          <Eye size={13} /> View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE COMPLAINT MODAL */}
      {showCreateModal && (
        <div className="student-modal-overlay" onClick={() => !submitting && setShowCreateModal(false)}>
          <div className="student-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="student-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Wrench size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                    Log Service Request
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '2px 0 0 0' }}>
                    Submit room or hostel maintenance issue to the warden desk
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => !submitting && setShowCreateModal(false)}
                style={{ border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit}>
              <div className="student-modal-body">
                {formError && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px', color: '#b91c1c', fontSize: '0.84rem' }}>
                    <AlertCircle size={16} style={{ flexShrink: 0 }} />
                    <span>{formError}</span>
                  </div>
                )}

                {formSuccess && (
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px', color: '#15803d', fontSize: '0.84rem' }}>
                    <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
                    <span>{formSuccess}</span>
                  </div>
                )}

                {/* Category Selection */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                    Issue Category <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <div className="category-selection-grid">
                    {CATEGORIES.map((cat) => {
                      const Icon = cat.icon;
                      const isSel = newCategory === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          className={`category-select-btn ${isSel ? 'selected' : ''}`}
                          onClick={() => setNewCategory(cat.id)}
                        >
                          <Icon size={20} style={{ color: isSel ? '#2563eb' : cat.color }} />
                          <span>{cat.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Priority Selector */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                    Urgency & Priority <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <div className="priority-selector-row">
                    {[
                      { id: 'LOW', label: 'Low', classKey: 'selected-low' },
                      { id: 'NORMAL', label: 'Normal', classKey: 'selected-normal' },
                      { id: 'HIGH', label: 'High', classKey: 'selected-high' },
                      { id: 'URGENT', label: 'Urgent', classKey: 'selected-urgent' },
                    ].map((p) => {
                      const isSel = newPriority === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          className={`priority-select-btn ${isSel ? p.classKey : ''}`}
                          onClick={() => setNewPriority(p.id)}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                  {newPriority === 'URGENT' && (
                    <div style={{ fontSize: '0.74rem', color: '#be123c', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Flame size={12} /> Please reserve Urgent for active leaks, electrical sparks, or safety hazards.
                    </div>
                  )}
                </div>

                {/* Room / Location */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Room / Specific Location (Optional)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Building2 size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Block B, Room 304 (or Common Washroom 2nd Floor)"
                      value={newRoom}
                      onChange={(e) => setNewRoom(e.target.value)}
                      style={{ paddingLeft: '38px' }}
                    />
                  </div>
                </div>

                {/* Issue Title */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Brief Summary / Title <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g., Geyser not heating water, ceiling fan regulator stuck..."
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    maxLength={100}
                    required
                  />
                </div>

                {/* Detailed Description */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Problem Description <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <textarea
                    className="form-control"
                    rows={4}
                    placeholder="Please explain what is happening, when it started, and any symptoms so the technician brings the correct tools..."
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    required
                  />
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', textAlign: 'right', marginTop: '4px' }}>
                    {newDescription.length} characters
                  </div>
                </div>
              </div>

              <div className="student-modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                >
                  {submitting ? (
                    <>
                      <RefreshCw size={14} className="spin-icon" /> Submitting Request...
                    </>
                  ) : (
                    <>
                      <Check size={16} /> Submit Ticket
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TICKET TRACKING DOSSIER MODAL */}
      {selectedTicket && (
        <div className="student-modal-overlay" onClick={() => setSelectedTicket(null)}>
          <div className="student-modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            <div className="student-modal-header">
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Work Order Tracking Dossier
                </span>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', margin: '2px 0 0 0' }}>
                  {selectedTicket.title}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setSelectedTicket(null)}
                style={{ border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="student-modal-body">
              {/* Status Header Strip */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Current Status:</span>
                  <div style={{ marginTop: '2px' }}>{renderStatusBadge(selectedTicket.status)}</div>
                </div>

                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Priority Level:</span>
                  <div style={{ marginTop: '2px' }}>{renderPriorityBadge(selectedTicket.priority)}</div>
                </div>

                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Ticket Reference:</span>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginTop: '2px' }}>
                    #{selectedTicket.id ? selectedTicket.id.substring(0, 8) : 'HMS-TKT'}
                  </div>
                </div>
              </div>

              {/* Step Tracker Visual */}
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>
                  Redressal Lifecycle Track
                </div>
                {(() => {
                  const s = (selectedTicket.status || '').toUpperCase();
                  const isResolved = s === 'RESOLVED' || s === 'CLOSED';
                  const isInProgress = s === 'IN_PROGRESS';
                  const isAssigned = s === 'ASSIGNED';

                  return (
                    <div className="service-step-tracker">
                      <div className="service-step-item completed">
                        <div className="service-step-icon">
                          <Check size={16} />
                        </div>
                        <span className="service-step-label">Submitted</span>
                      </div>

                      <div className={`service-step-item ${isAssigned || isInProgress || isResolved ? 'completed' : 'active'}`}>
                        <div className="service-step-icon">
                          {isAssigned || isInProgress || isResolved ? <Check size={16} /> : <Clock size={16} />}
                        </div>
                        <span className="service-step-label">Warden Review</span>
                      </div>

                      <div className={`service-step-item ${isResolved ? 'completed' : (isAssigned || isInProgress) ? 'active' : ''}`}>
                        <div className="service-step-icon">
                          {isResolved ? <Check size={16} /> : <Wrench size={16} />}
                        </div>
                        <span className="service-step-label">Dispatched</span>
                      </div>

                      <div className={`service-step-item ${isResolved ? 'completed' : ''}`}>
                        <div className="service-step-icon">
                          <CheckCircle2 size={16} />
                        </div>
                        <span className="service-step-label">Resolved</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Full Description */}
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '6px' }}>
                  Issue Description
                </label>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', fontSize: '0.88rem', color: '#334155', lineHeight: 1.5 }}>
                  {selectedTicket.description}
                </div>
              </div>

              {/* Technician / Assignment Details */}
              {selectedTicket.assigned_to_name && (
                <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '10px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <UserCheck size={20} style={{ color: '#059669', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#065f46' }}>
                      Assigned Technician: {selectedTicket.assigned_to_name}
                    </div>
                    <div style={{ fontSize: '0.76rem', color: '#047857' }}>
                      Maintenance personnel has been alerted and will arrive during working hours.
                    </div>
                  </div>
                </div>
              )}

              {/* Resolution Remarks */}
              {selectedTicket.resolution && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '14px', marginTop: '4px' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#166534', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <CheckCircle2 size={16} /> Resolution Confirmation & Notes
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#15803d' }}>
                    {selectedTicket.resolution}
                  </div>
                </div>
              )}
            </div>

            <div className="student-modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedTicket(null)}
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
