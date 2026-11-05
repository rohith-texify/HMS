import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Building2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCw,
  Plus,
  Search,
  MapPin,
  Mail,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Rocket,
  X,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  SlidersHorizontal,
  Copy,
  Check,
  Edit3,
  Sliders,
  Users,
  Shield,
  Eye,
} from 'lucide-react';
import {
  fetchCollegesList,
  updateCollege,
  updateCollegeStatus,
  updateCollegeQuotas,
} from '../services/collegeService';
import { loginSuperAdmin } from '../services/dashboardService';

/**
 * Animated number count-up effect
 */
function CountUpNumber({ value, duration = 350 }) {
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

export default function CollegesPage() {
  const navigate = useNavigate();
  const [colleges, setColleges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Filters & Pagination State
  const [searchTerm, setSearchTerm] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [limit, setLimit] = useState(20);
  const [offset, setOffset] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // Summary counts for KPI cards
  const [summaryStats, setSummaryStats] = useState({
    activeCount: 0,
    onboardingCount: 0,
    suspendedCount: 0,
  });

  // Action Modals State
  const [copiedTenantId, setCopiedTenantId] = useState(null);

  // 1. Edit College Modal
  const [editingCollege, setEditingCollege] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', timezone: 'Asia/Kolkata', contact_email: '' });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState(null);

  // 2. Configure Limits Modal
  const [limitsCollege, setLimitsCollege] = useState(null);
  const [limitsForm, setLimitsForm] = useState({
    max_students: 500,
    max_parents: 500,
    max_blocks: 5,
    max_incharges: 5,
    max_security: 10,
  });
  const [limitsSubmitting, setLimitsSubmitting] = useState(false);
  const [limitsError, setLimitsError] = useState(null);

  // 3. Lifecycle Transition Modal (Activate / Suspend)
  const [lifecycleCollege, setLifecycleCollege] = useState(null);
  const [targetLifecycleStatus, setTargetLifecycleStatus] = useState('ACTIVE');
  const [lifecycleReason, setLifecycleReason] = useState('');
  const [lifecycleSubmitting, setLifecycleSubmitting] = useState(false);
  const [lifecycleError, setLifecycleError] = useState(null);

  const handleCopyTenantId = (collegeId) => {
    navigator.clipboard.writeText(collegeId);
    setCopiedTenantId(collegeId);
    setTimeout(() => setCopiedTenantId(null), 2000);
  };

  const handleOpenEdit = (col) => {
    setEditError(null);
    setEditingCollege(col);
    setEditForm({
      name: col.name || '',
      timezone: col.timezone || 'Asia/Kolkata',
      contact_email: col.contact_email || '',
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editForm.name.trim()) {
      setEditError('College name is required');
      return;
    }
    setEditSubmitting(true);
    setEditError(null);
    try {
      await updateCollege(editingCollege.college_id, editForm);
      setEditingCollege(null);
      await loadColleges(appliedSearch, statusFilter, limit, offset);
    } catch (err) {
      setEditError(err.response?.data?.error?.message || err.message || 'Failed to update college');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleOpenLimits = (col) => {
    setLimitsError(null);
    setLimitsCollege(col);
    setLimitsForm({
      max_students: col.max_students ?? 500,
      max_parents: col.max_parents ?? 500,
      max_blocks: col.max_blocks ?? 5,
      max_incharges: col.max_incharges ?? 5,
      max_security: col.max_security ?? 10,
    });
  };

  const handleSaveLimits = async (e) => {
    e.preventDefault();
    setLimitsSubmitting(true);
    setLimitsError(null);
    try {
      await updateCollegeQuotas(limitsCollege.college_id, {
        max_students: parseInt(limitsForm.max_students, 10) || 500,
        max_parents: parseInt(limitsForm.max_parents, 10) || 500,
        max_blocks: parseInt(limitsForm.max_blocks, 10) || 5,
        max_incharges: parseInt(limitsForm.max_incharges, 10) || 5,
        max_security: parseInt(limitsForm.max_security, 10) || 10,
      });
      setLimitsCollege(null);
      await loadColleges(appliedSearch, statusFilter, limit, offset);
    } catch (err) {
      setLimitsError(err.response?.data?.error?.message || err.message || 'Failed to update quotas');
    } finally {
      setLimitsSubmitting(false);
    }
  };

  const handleOpenLifecycle = (col, status) => {
    setLifecycleError(null);
    setLifecycleCollege(col);
    setTargetLifecycleStatus(status);
    setLifecycleReason('');
  };

  const handleSaveLifecycle = async (e) => {
    e.preventDefault();
    if (!lifecycleReason.trim()) {
      setLifecycleError('A mandatory justification reason is required for lifecycle transitions.');
      return;
    }
    setLifecycleSubmitting(true);
    setLifecycleError(null);
    try {
      await updateCollegeStatus(lifecycleCollege.college_id, {
        status: targetLifecycleStatus,
        reason: lifecycleReason.trim(),
      });
      setLifecycleCollege(null);
      await loadColleges(appliedSearch, statusFilter, limit, offset);
    } catch (err) {
      setLifecycleError(err.response?.data?.error?.message || err.message || 'Failed to transition college lifecycle status');
    } finally {
      setLifecycleSubmitting(false);
    }
  };

  // Stale request prevention
  const requestCounter = useRef(0);
  const abortControllerRef = useRef(null);

  const loadColleges = useCallback(async (search, status, pageLimit, pageOffset) => {
    const currentRequestId = ++requestCounter.current;
    setIsRefreshing(true);
    setError(null);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const result = await fetchCollegesList({
        search,
        status,
        limit: pageLimit,
        offset: pageOffset,
        signal: controller.signal,
      });

      if (currentRequestId === requestCounter.current) {
        const fetchedColleges = result.colleges || [];
        setColleges(fetchedColleges);
        setTotalCount(result.meta?.total || fetchedColleges.length);

        // Derive status counts
        const active = fetchedColleges.filter((c) => c.status === 'ACTIVE').length;
        const onboarding = fetchedColleges.filter((c) => c.status === 'ONBOARDING').length;
        const suspended = fetchedColleges.filter((c) => c.status === 'SUSPENDED' || c.status === 'DEACTIVATED').length;
        setSummaryStats({
          activeCount: active,
          onboardingCount: onboarding,
          suspendedCount: suspended,
        });

        setLoading(false);
        setIsRefreshing(false);
      }
    } catch (err) {
      if (
        err?.name === 'CanceledError' ||
        err?.name === 'AbortError' ||
        err?.isCanceled ||
        err?.message === 'canceled' ||
        err?.code === 'ERR_CANCELED' ||
        controller.signal.aborted
      ) {
        return;
      }
      if (currentRequestId === requestCounter.current) {
        setError(err.message || 'Failed to load college directory');
        setLoading(false);
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    loadColleges(appliedSearch, statusFilter, limit, offset);
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [appliedSearch, statusFilter, limit, offset, loadColleges]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setOffset(0);
    setAppliedSearch(searchTerm);
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setAppliedSearch('');
    setOffset(0);
  };

  const handleStatusChange = (newStatus) => {
    setStatusFilter(newStatus);
    setOffset(0);
  };

  const handleLimitChange = (e) => {
    const newLimit = parseInt(e.target.value, 10);
    setLimit(newLimit);
    setOffset(0);
  };

  const handlePrevPage = () => {
    setOffset((prev) => Math.max(0, prev - limit));
  };

  const handleNextPage = () => {
    if (offset + limit < totalCount) {
      setOffset((prev) => prev + limit);
    }
  };

  const handleConnectSession = async () => {
    try {
      setLoading(true);
      await loginSuperAdmin();
      await loadColleges(searchTerm, statusFilter, limit, offset);
    } catch (err) {
      setError('Session connection failed: ' + (err.message || 'Unknown error'));
      setLoading(false);
    }
  };

  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  return (
    <div className="colleges-directory-container animate-fade-in">
      {/* Top Header & Breadcrumbs */}
      <div className="colleges-hero-header">
        <div className="colleges-hero-text">
          <div className="colleges-breadcrumbs">
            <Link to="/dashboard" className="breadcrumb-link">Dashboard</Link>
            <span className="breadcrumb-sep">/</span>
            <span className="breadcrumb-current">Colleges</span>
          </div>
          <h1 className="colleges-title">College & Tenant Directory</h1>
          <p className="colleges-subtitle">
            Manage participating institutions, monitor onboarding lifecycle, and inspect active tenant configurations.
          </p>
        </div>

        <div className="colleges-actions-cluster">
          <Link to="/onboarding" className="btn-enterprise btn-outline-soft" id="btn-onboarding-pipeline">
            <Rocket size={14} className="text-blue-600" />
            <span>Onboarding Pipeline</span>
          </Link>

          <button
            type="button"
            className={`btn-enterprise btn-outline-soft ${isRefreshing ? 'is-loading' : ''}`}
            onClick={() => loadColleges(searchTerm, statusFilter, limit, offset)}
            disabled={isRefreshing}
            title="Refresh directory list"
          >
            <RotateCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <Link to="/colleges/new" className="btn-enterprise btn-primary-blue" id="btn-create-college-page">
            <Plus size={15} />
            <span>Create College</span>
          </Link>
        </div>
      </div>

      {/* Top 4 KPI Metric Cards */}
      <div className="colleges-kpi-grid">
        {/* Card 1: Total Registered */}
        <div className="colleges-stat-card card-stagger-1">
          <div className="colleges-stat-header">
            <span className="colleges-stat-label">Total Registered</span>
            <div className="colleges-stat-icon-wrap blue">
              <Building2 size={17} />
            </div>
          </div>
          <div className="colleges-stat-value text-slate-900">
            <CountUpNumber value={totalCount} />
          </div>
          <div className="colleges-stat-subtext">Total tenant institutions on platform</div>
          <div className="colleges-stat-accent-bar blue" />
        </div>

        {/* Card 2: Active Institutions */}
        <div className="colleges-stat-card card-stagger-2">
          <div className="colleges-stat-header">
            <span className="colleges-stat-label">Active Campuses</span>
            <div className="colleges-stat-icon-wrap green">
              <CheckCircle2 size={17} />
            </div>
          </div>
          <div className="colleges-stat-value text-emerald-600">
            <CountUpNumber value={summaryStats.activeCount} />
          </div>
          <div className="colleges-stat-subtext">Live operational college clusters</div>
          <div className="colleges-stat-accent-bar green" />
        </div>

        {/* Card 3: In Onboarding */}
        <div className="colleges-stat-card card-stagger-3">
          <div className="colleges-stat-header">
            <span className="colleges-stat-label">In Onboarding</span>
            <div className="colleges-stat-icon-wrap amber">
              <Clock size={17} />
            </div>
          </div>
          <div className="colleges-stat-value text-amber-600">
            <CountUpNumber value={summaryStats.onboardingCount} />
          </div>
          <div className="colleges-stat-subtext">Tenant setup and readiness drafts</div>
          <div className="colleges-stat-accent-bar amber" />
        </div>

        {/* Card 4: Review / Suspended */}
        <div className="colleges-stat-card card-stagger-4">
          <div className="colleges-stat-header">
            <span className="colleges-stat-label">Suspended / Inactive</span>
            <div className="colleges-stat-icon-wrap purple">
              <AlertTriangle size={17} />
            </div>
          </div>
          <div className="colleges-stat-value text-purple-600">
            <CountUpNumber value={summaryStats.suspendedCount} />
          </div>
          <div className="colleges-stat-subtext">Restricted or archived institutions</div>
          <div className="colleges-stat-accent-bar purple" />
        </div>
      </div>

      {/* Main Table Card */}
      <div className="colleges-main-card card-stagger-5">
        {/* Filter & Search Toolbar */}
        <div className="colleges-toolbar">
          {/* Segmented Lifecycle Status Filter Tabs */}
          <div className="colleges-tabs-pillbox">
            {[
              { label: 'All Statuses', value: 'ALL' },
              { label: 'Active', value: 'ACTIVE' },
              { label: 'Onboarding', value: 'ONBOARDING' },
              { label: 'Suspended', value: 'SUSPENDED' },
            ].map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => handleStatusChange(tab.value)}
                className={`colleges-tab-pill ${statusFilter === tab.value ? 'active' : ''}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Box & Page Size */}
          <div className="colleges-search-group">
            <form onSubmit={handleSearchSubmit} className="colleges-search-form">
              <Search size={15} className="search-icon" />
              <input
                type="text"
                placeholder="Search by college name or code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="colleges-search-input"
                id="college-search-input"
              />
              {searchTerm && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={handleClearSearch}
                  title="Clear search"
                >
                  <X size={13} />
                </button>
              )}
            </form>

            <div className="colleges-page-size-wrap">
              <select
                id="college-page-size-select"
                className="colleges-select-input"
                value={limit}
                onChange={handleLimitChange}
              >
                <option value="10">10 / page</option>
                <option value="20">20 / page</option>
                <option value="50">50 / page</option>
              </select>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="colleges-error-banner">
            <div className="error-text-wrap">
              <ShieldAlert size={16} className="text-rose-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
            <div style={{ display: 'inline-flex', gap: '8px' }}>
              <button
                type="button"
                className="btn-enterprise btn-outline-soft btn-sm"
                onClick={() => loadColleges(searchTerm, statusFilter, limit, offset)}
              >
                Retry
              </button>
              <button
                type="button"
                className="btn-enterprise btn-primary-blue btn-sm"
                onClick={handleConnectSession}
              >
                Connect Session
              </button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="colleges-loading-state">
            <div className="loading-spinner-blue" />
            <div className="loading-state-title">Loading College Directory...</div>
            <div className="loading-state-sub">Fetching verified institution profiles and tenant lifecycle statuses.</div>
          </div>
        ) : colleges.length === 0 ? (
          /* High-Fidelity Empty State */
          <div className="colleges-empty-state">
            <div className="empty-state-badge-stage">
              <div className="empty-state-badge-pulse" />
              <div className="empty-state-icon-badge">
                <Building2 size={32} className="text-blue-600" />
              </div>
            </div>

            <h3 className="empty-state-heading">No Colleges Found</h3>
            <p className="empty-state-description">
              No institution records match your selected search keywords or lifecycle filter.
            </p>

            <button
              type="button"
              className="btn-enterprise btn-outline-soft empty-state-btn"
              onClick={() => {
                setSearchTerm('');
                setAppliedSearch('');
                setStatusFilter('ALL');
                setOffset(0);
              }}
            >
              Clear Filters & Search
            </button>
          </div>
        ) : (
          /* Table View */
          <div className="colleges-table-responsive">
            <table className="colleges-table" id="colleges-directory-table">
              <thead>
                <tr>
                  <th>College Name</th>
                  <th>Code</th>
                  <th>Tenant ID</th>
                  <th>Status</th>
                  <th>Timezone</th>
                  <th>Location</th>
                  <th>Contact Email</th>
                  <th>Registered</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {colleges.map((col) => {
                  const isActive = col.status === 'ACTIVE';
                  const isOnboarding = col.status === 'ONBOARDING';
                  const isSuspended = col.status === 'SUSPENDED';

                  return (
                    <tr key={col.college_id} id={`college-row-${col.college_id}`} className="colleges-table-row">
                      <td>
                        <div className="college-cell-wrap">
                          <div className="college-avatar-box">
                            <Building2 size={16} />
                          </div>
                          <div>
                            <Link
                              to={`/colleges/${col.college_id}`}
                              className="college-title-link"
                            >
                              {col.name}
                            </Link>
                            <div className="college-meta-sub">
                              {col.city ? `${col.city}, ` : ''}{col.state || 'India'}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className="code-pill">
                          {col.college_code}
                        </span>
                      </td>

                      <td>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <code style={{ fontSize: '0.76rem', color: '#1e40af', background: '#eff6ff', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace' }}>
                            {col.college_id ? `${col.college_id.slice(0, 8)}...` : '—'}
                          </code>
                          {col.college_id && (
                            <button
                              type="button"
                              className="btn-icon-action"
                              style={{ width: '22px', height: '22px', padding: 0 }}
                              onClick={() => handleCopyTenantId(col.college_id)}
                              title={copiedTenantId === col.college_id ? 'Copied UUID!' : 'Copy Tenant ID'}
                            >
                              {copiedTenantId === col.college_id ? (
                                <Check size={11} style={{ color: '#059669' }} />
                              ) : (
                                <Copy size={11} />
                              )}
                            </button>
                          )}
                        </div>
                      </td>

                      <td>
                        {isActive && (
                          <span className="badge-status active">
                            <span className="status-dot-inner" />
                            ACTIVE
                          </span>
                        )}
                        {isOnboarding && (
                          <span className="badge-status onboarding">
                            <span className="status-dot-inner" />
                            ONBOARDING
                          </span>
                        )}
                        {isSuspended && (
                          <span className="badge-status suspended">
                            <span className="status-dot-inner" />
                            SUSPENDED
                          </span>
                        )}
                        {!isActive && !isOnboarding && !isSuspended && (
                          <span className="badge-status muted">
                            {col.status || 'UNKNOWN'}
                          </span>
                        )}
                      </td>

                      <td>
                        <span className="timezone-tag">
                          {col.timezone === 'Asia/Kolkata' ? 'IST' : (col.timezone || 'IST')}
                        </span>
                      </td>

                      <td>
                        <div className="location-cell">
                          <MapPin size={13} className="text-slate-400" />
                          <span>
                            {col.city || col.state
                              ? [col.city, col.state].filter(Boolean).join(', ')
                              : '—'}
                          </span>
                        </div>
                      </td>

                      <td>
                        <div className="contact-cell">
                          <Mail size={13} className="text-slate-400" />
                          <span>{col.contact_email || '—'}</span>
                        </div>
                      </td>

                      <td>
                        <span className="date-cell">
                          {col.created_at ? new Date(col.created_at).toLocaleDateString() : '—'}
                        </span>
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <div className="action-buttons-wrap" style={{ display: 'inline-flex', gap: '4px', alignItems: 'center', justifyContent: 'flex-end' }}>
                          {/* 1. View College */}
                          <button
                            type="button"
                            className="btn-enterprise btn-outline-soft btn-sm"
                            style={{ padding: '4px 8px', fontSize: '0.74rem' }}
                            onClick={() => navigate(`/colleges/${col.college_id}`)}
                            title="View College Details & Dashboard"
                          >
                            <Eye size={12} />
                            <span>View</span>
                          </button>

                          {/* 2. Edit College */}
                          <button
                            type="button"
                            className="btn-enterprise btn-outline-soft btn-sm"
                            style={{ padding: '4px 8px', fontSize: '0.74rem' }}
                            onClick={() => handleOpenEdit(col)}
                            title="Edit College Profile"
                          >
                            <Edit3 size={12} />
                            <span>Edit</span>
                          </button>

                          {/* 3. Configure Limits */}
                          <button
                            type="button"
                            className="btn-enterprise btn-outline-soft btn-sm"
                            style={{ padding: '4px 8px', fontSize: '0.74rem' }}
                            onClick={() => handleOpenLimits(col)}
                            title="Configure Account & Resource Limits"
                          >
                            <Sliders size={12} style={{ color: '#2563eb' }} />
                            <span>Limits</span>
                          </button>

                          {/* 4. Manage Account */}
                          <button
                            type="button"
                            className="btn-enterprise btn-outline-soft btn-sm"
                            style={{ padding: '4px 8px', fontSize: '0.74rem' }}
                            onClick={() => navigate(`/colleges/${col.college_id}/admins`)}
                            title="Manage College Administrators"
                          >
                            <Users size={12} />
                            <span>Admins</span>
                          </button>

                          {/* 5. Activate / Suspend */}
                          {col.status === 'ACTIVE' ? (
                            <button
                              type="button"
                              className="btn-enterprise btn-outline-soft btn-sm"
                              style={{ padding: '4px 8px', fontSize: '0.74rem', color: '#d97706', borderColor: '#fde68a' }}
                              onClick={() => handleOpenLifecycle(col, 'SUSPENDED')}
                              title="Suspend this college tenant"
                            >
                              <Shield size={12} />
                              <span>Suspend</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn-enterprise btn-outline-soft btn-sm"
                              style={{ padding: '4px 8px', fontSize: '0.74rem', color: '#059669', borderColor: '#a7f3d0' }}
                              onClick={() => handleOpenLifecycle(col, 'ACTIVE')}
                              title="Activate this college tenant"
                            >
                              <ShieldCheck size={12} />
                              <span>Activate</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination Controls */}
            <div className="colleges-pagination-bar">
              <span className="pagination-info">
                Showing {Math.min(offset + 1, totalCount)} to {Math.min(offset + limit, totalCount)} of {totalCount} institutions
              </span>

              <div className="pagination-actions">
                <button
                  type="button"
                  className="btn-enterprise btn-outline-soft btn-sm"
                  onClick={handlePrevPage}
                  disabled={offset === 0 || loading}
                  id="btn-prev-page"
                >
                  <ChevronLeft size={13} />
                  <span>Previous</span>
                </button>
                <span className="page-indicator">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  className="btn-enterprise btn-outline-soft btn-sm"
                  onClick={handleNextPage}
                  disabled={offset + limit >= totalCount || loading}
                  id="btn-next-page"
                >
                  <span>Next</span>
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Edit College Profile Modal */}
      {editingCollege && (
        <div className="modal-overlay" onClick={() => !editSubmitting && setEditingCollege(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Edit College Profile</h2>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setEditingCollege(null)}
                disabled={editSubmitting}
                style={{ padding: '4px 6px' }}
              >
                <X size={14} />
              </button>
            </div>
            <form onSubmit={handleSaveEdit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {editError && (
                  <div className="alert alert-danger" style={{ padding: '8px 12px', fontSize: '0.82rem' }}>
                    {editError}
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">College Code (Immutable)</label>
                  <input type="text" className="form-control" value={editingCollege.college_code} disabled />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-col-name">College Name *</label>
                  <input
                    id="edit-col-name"
                    type="text"
                    className="form-control"
                    value={editForm.name}
                    onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                    disabled={editSubmitting}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-col-email">Contact Email</label>
                  <input
                    id="edit-col-email"
                    type="email"
                    className="form-control"
                    value={editForm.contact_email}
                    onChange={(e) => setEditForm((p) => ({ ...p, contact_email: e.target.value }))}
                    disabled={editSubmitting}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-col-tz">Timezone</label>
                  <select
                    id="edit-col-tz"
                    className="form-control"
                    value={editForm.timezone}
                    onChange={(e) => setEditForm((p) => ({ ...p, timezone: e.target.value }))}
                    disabled={editSubmitting}
                  >
                    <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                    <option value="UTC">UTC</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '12px 18px', borderTop: '1px solid #e2e8f0' }}>
                <button
                  type="button"
                  className="btn-enterprise btn-outline-soft btn-sm"
                  onClick={() => setEditingCollege(null)}
                  disabled={editSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-enterprise btn-primary-blue btn-sm"
                  disabled={editSubmitting}
                >
                  {editSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Configure Limits Quotas Modal */}
      {limitsCollege && (
        <div className="modal-overlay" onClick={() => !limitsSubmitting && setLimitsCollege(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Configure Account &amp; Resource Limits</h2>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setLimitsCollege(null)}
                disabled={limitsSubmitting}
                style={{ padding: '4px 6px' }}
              >
                <X size={14} />
              </button>
            </div>
            <form onSubmit={handleSaveLimits}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ fontSize: '0.84rem', color: '#475569' }}>
                  Setting capacity limits for <strong>{limitsCollege.name}</strong> ({limitsCollege.college_code}). Quotas apply to active accounts; reducing below current active usage will block new creations but preserves existing accounts.
                </div>
                {limitsError && (
                  <div className="alert alert-danger" style={{ padding: '8px 12px', fontSize: '0.82rem' }}>
                    {limitsError}
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="quota-students">Max Students</label>
                    <input
                      id="quota-students"
                      type="number"
                      min="1"
                      className="form-control"
                      value={limitsForm.max_students}
                      onChange={(e) => setLimitsForm((p) => ({ ...p, max_students: e.target.value }))}
                      disabled={limitsSubmitting}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="quota-parents">Max Parents</label>
                    <input
                      id="quota-parents"
                      type="number"
                      min="1"
                      className="form-control"
                      value={limitsForm.max_parents}
                      onChange={(e) => setLimitsForm((p) => ({ ...p, max_parents: e.target.value }))}
                      disabled={limitsSubmitting}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="quota-blocks">Max Hostel Blocks</label>
                    <input
                      id="quota-blocks"
                      type="number"
                      min="1"
                      className="form-control"
                      value={limitsForm.max_blocks}
                      onChange={(e) => setLimitsForm((p) => ({ ...p, max_blocks: e.target.value }))}
                      disabled={limitsSubmitting}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="quota-incharges">Max Hostel Incharges</label>
                    <input
                      id="quota-incharges"
                      type="number"
                      min="1"
                      className="form-control"
                      value={limitsForm.max_incharges}
                      onChange={(e) => setLimitsForm((p) => ({ ...p, max_incharges: e.target.value }))}
                      disabled={limitsSubmitting}
                      required
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="quota-security">Max Security Personnel</label>
                  <input
                    id="quota-security"
                    type="number"
                    min="1"
                    className="form-control"
                    value={limitsForm.max_security}
                    onChange={(e) => setLimitsForm((p) => ({ ...p, max_security: e.target.value }))}
                    disabled={limitsSubmitting}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '12px 18px', borderTop: '1px solid #e2e8f0' }}>
                <button
                  type="button"
                  className="btn-enterprise btn-outline-soft btn-sm"
                  onClick={() => setLimitsCollege(null)}
                  disabled={limitsSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-enterprise btn-primary-blue btn-sm"
                  disabled={limitsSubmitting}
                >
                  {limitsSubmitting ? 'Updating...' : 'Save Quotas'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lifecycle Status Modal (Activate / Suspend) */}
      {lifecycleCollege && (
        <div className="modal-overlay" onClick={() => !lifecycleSubmitting && setLifecycleCollege(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h2 className="modal-title">
                {targetLifecycleStatus === 'ACTIVE' ? 'Activate College Tenant' : 'Suspend College Tenant'}
              </h2>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setLifecycleCollege(null)}
                disabled={lifecycleSubmitting}
                style={{ padding: '4px 6px' }}
              >
                <X size={14} />
              </button>
            </div>
            <form onSubmit={handleSaveLifecycle}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <p style={{ fontSize: '0.84rem', color: '#334155', margin: 0 }}>
                  You are changing the lifecycle state of <strong>{lifecycleCollege.name}</strong> to{' '}
                  <strong style={{ color: targetLifecycleStatus === 'ACTIVE' ? '#059669' : '#d97706' }}>
                    {targetLifecycleStatus}
                  </strong>.
                </p>
                {lifecycleError && (
                  <div className="alert alert-danger" style={{ padding: '8px 12px', fontSize: '0.82rem' }}>
                    {lifecycleError}
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label" htmlFor="lifecycle-reason-input">
                    Mandatory Authorization Reason <span className="required">*</span>
                  </label>
                  <textarea
                    id="lifecycle-reason-input"
                    className="form-control"
                    rows="3"
                    placeholder="Enter compliance or administrative justification..."
                    value={lifecycleReason}
                    onChange={(e) => setLifecycleReason(e.target.value)}
                    disabled={lifecycleSubmitting}
                    required
                  />
                  <div className="form-hint" style={{ fontSize: '0.74rem', color: '#64748b' }}>
                    This justification will be permanently immutably logged in platform.audit_logs.
                  </div>
                </div>
              </div>
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '12px 18px', borderTop: '1px solid #e2e8f0' }}>
                <button
                  type="button"
                  className="btn-enterprise btn-outline-soft btn-sm"
                  onClick={() => setLifecycleCollege(null)}
                  disabled={lifecycleSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`btn-enterprise ${targetLifecycleStatus === 'ACTIVE' ? 'btn-primary-blue' : 'btn-outline-soft'} btn-sm`}
                  style={targetLifecycleStatus === 'SUSPENDED' ? { color: '#dc2626', borderColor: '#fca5a5' } : {}}
                  disabled={lifecycleSubmitting}
                >
                  {lifecycleSubmitting ? 'Processing...' : `Confirm ${targetLifecycleStatus}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
