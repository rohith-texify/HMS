import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Rocket,
  Clock,
  CheckCircle2,
  RotateCw,
  Plus,
  Search,
  Building2,
  MapPin,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Sparkles,
  AlertCircle,
  X,
  ExternalLink,
} from 'lucide-react';
import { fetchOnboardingPipeline } from '../services/onboardingService';

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

export default function OnboardingListPage() {
  const navigate = useNavigate();
  const [pipeline, setPipeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState('ALL'); // 'ALL' | 'READY' | 'IN_PROGRESS'
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const reqCounterRef = useRef(0);
  const abortCtrlRef = useRef(null);

  const loadPipeline = useCallback(async () => {
    const currentReq = ++reqCounterRef.current;
    setIsRefreshing(true);
    setError(null);

    if (abortCtrlRef.current) {
      abortCtrlRef.current.abort();
    }
    const controller = new AbortController();
    abortCtrlRef.current = controller;

    try {
      const data = await fetchOnboardingPipeline({ signal: controller.signal });
      if (currentReq === reqCounterRef.current) {
        setPipeline(data || []);
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
      if (currentReq === reqCounterRef.current) {
        setError(err.message || 'Failed to load onboarding colleges');
      }
    } finally {
      if (currentReq === reqCounterRef.current) {
        setLoading(false);
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    loadPipeline();

    // Auto-refresh when returning to the tab/window from the wizard (throttled to 30s)
    let lastFocusTime = Date.now();
    const handleWindowFocus = () => {
      const now = Date.now();
      if (now - lastFocusTime > 30000) {
        lastFocusTime = now;
        loadPipeline();
      }
    };
    window.addEventListener('focus', handleWindowFocus);
    return () => {
      window.removeEventListener('focus', handleWindowFocus);
      if (abortCtrlRef.current) {
        abortCtrlRef.current.abort();
      }
    };
  }, [loadPipeline]);

  // Reset page when filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filterTab, searchQuery]);

  const totalCount = pipeline.length;
  const readyCount = pipeline.filter((c) => c.is_ready_for_go_live || c.progress_percentage === 100).length;
  const inProgressCount = totalCount - readyCount;

  const filteredColleges = pipeline.filter((c) => {
    if (filterTab === 'READY' && !(c.is_ready_for_go_live || c.progress_percentage === 100)) {
      return false;
    }
    if (filterTab === 'IN_PROGRESS' && (c.is_ready_for_go_live || c.progress_percentage === 100)) {
      return false;
    }
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.college_code && c.college_code.toLowerCase().includes(q)) ||
      (c.city && typeof c.city === 'string' && c.city.toLowerCase().includes(q))
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredColleges.length / pageSize));
  const paginatedColleges = filteredColleges.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="onboarding-page-container animate-fade-in">
      {/* Top Header & Breadcrumbs */}
      <div className="onboarding-hero-header">
        <div className="onboarding-hero-text">
          <div className="onboarding-breadcrumbs">
            <Link to="/dashboard" className="breadcrumb-link">Dashboard</Link>
            <span className="breadcrumb-sep">/</span>
            <span className="breadcrumb-current">College Onboarding</span>
          </div>
          <h1 className="onboarding-title">College Onboarding Pipeline</h1>
          <p className="onboarding-subtitle">
            Monitor, resume, or complete the 7-stage tenant onboarding lifecycle for institutional colleges.
          </p>
        </div>

        <div className="onboarding-actions-cluster">
          <button
            type="button"
            className={`btn-enterprise btn-outline-soft ${isRefreshing ? 'is-loading' : ''}`}
            onClick={loadPipeline}
            disabled={isRefreshing}
            title="Refresh onboarding pipeline"
          >
            <RotateCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <Link to="/colleges/new" className="btn-enterprise btn-primary-blue" id="btn-start-new-onboarding">
            <Plus size={15} />
            <span>Start New Onboarding</span>
          </Link>
        </div>
      </div>

      {/* Top 3 KPI Stat Cards */}
      <div className="onboarding-kpi-grid">
        {/* Card 1: Active Onboarding Tenants */}
        <div className="onboarding-stat-card card-stagger-1">
          <div className="onboarding-stat-header">
            <span className="onboarding-stat-label">Active Onboarding Tenants</span>
            <div className="onboarding-stat-icon-wrap blue">
              <Rocket size={17} />
            </div>
          </div>
          <div className="onboarding-stat-value text-slate-900">
            <CountUpNumber value={totalCount} />
          </div>
          <div className="onboarding-stat-subtext">
            Tenants currently in draft or setup phase
          </div>
          <div className="onboarding-stat-accent-bar blue" />
        </div>

        {/* Card 2: In-Progress Drafts */}
        <div className="onboarding-stat-card card-stagger-2">
          <div className="onboarding-stat-header">
            <span className="onboarding-stat-label">In-Progress Drafts</span>
            <div className="onboarding-stat-icon-wrap amber">
              <Clock size={17} />
            </div>
          </div>
          <div className="onboarding-stat-value text-amber-600">
            <CountUpNumber value={inProgressCount} />
          </div>
          <div className="onboarding-stat-subtext">
            Awaiting profile, admin, or structure configuration
          </div>
          <div className="onboarding-stat-accent-bar amber" />
        </div>

        {/* Card 3: Ready for Go-Live Review */}
        <div className="onboarding-stat-card card-stagger-3">
          <div className="onboarding-stat-header">
            <span className="onboarding-stat-label">Ready for Go-Live Review</span>
            <div className="onboarding-stat-icon-wrap green">
              <CheckCircle2 size={17} />
            </div>
          </div>
          <div className="onboarding-stat-value text-emerald-600">
            <CountUpNumber value={readyCount} />
          </div>
          <div className="onboarding-stat-subtext">
            Mandatory gates completed, awaiting activation
          </div>
          <div className="onboarding-stat-accent-bar green" />
        </div>
      </div>

      {/* Main Content Card: Tabs, Search & Table / Empty State */}
      <div className="onboarding-main-card card-stagger-4">
        {/* Controls Toolbar: Segmented Tabs & Search Bar */}
        <div className="onboarding-toolbar">
          {/* Segmented Filter Tabs */}
          <div className="onboarding-tabs-pillbox">
            <button
              type="button"
              onClick={() => setFilterTab('ALL')}
              className={`onboarding-tab-pill ${filterTab === 'ALL' ? 'active' : ''}`}
              id="tab-filter-all"
            >
              All Tenants ({totalCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('READY')}
              className={`onboarding-tab-pill ${filterTab === 'READY' ? 'active' : ''}`}
              id="tab-filter-ready"
            >
              Ready for Go-Live ({readyCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('IN_PROGRESS')}
              className={`onboarding-tab-pill ${filterTab === 'IN_PROGRESS' ? 'active' : ''}`}
              id="tab-filter-in-progress"
            >
              In Progress ({inProgressCount})
            </button>
          </div>

          {/* Search Box */}
          <div className="onboarding-search-box">
            <Search size={15} className="search-icon" />
            <input
              type="text"
              placeholder="Search by college name, code, city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="onboarding-search-input"
              id="input-search-onboarding"
            />
            {searchQuery && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => setSearchQuery('')}
                title="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="onboarding-error-banner">
            <div className="error-text-wrap">
              <AlertCircle size={16} className="text-rose-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              className="btn-enterprise btn-outline-soft"
              onClick={loadPipeline}
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading Spinner */}
        {loading ? (
          <div className="onboarding-loading-state">
            <div className="loading-spinner-blue" />
            <div className="loading-state-title">Loading Onboarding Pipeline...</div>
            <div className="loading-state-sub">Fetching active tenant configuration steps and readiness checklists.</div>
          </div>
        ) : filteredColleges.length === 0 ? (
          /* High-Fidelity Empty State */
          <div className="onboarding-empty-state">
            <div className="empty-state-badge-stage">
              <div className="empty-state-badge-pulse" />
              <div className="empty-state-icon-badge">
                <GraduationCap size={32} className="text-blue-600" />
              </div>
            </div>

            <h3 className="empty-state-heading">
              {pipeline.length === 0 ? 'No Colleges in Onboarding' : 'No Colleges Match Search or Filter'}
            </h3>
            <p className="empty-state-description">
              {pipeline.length === 0
                ? 'All institutions are currently active or no onboarding drafts are open. You can initialize a new college onboarding workflow anytime.'
                : 'No onboarding drafts match your query. Try clearing your search keyword or switching filter tabs.'}
            </p>

            {pipeline.length === 0 ? (
              <Link to="/colleges/new" className="btn-enterprise btn-primary-blue empty-state-btn" id="btn-register-new-college-empty">
                <Plus size={15} />
                <span>Register New College</span>
              </Link>
            ) : (
              <button
                type="button"
                className="btn-enterprise btn-outline-soft empty-state-btn"
                onClick={() => {
                  setFilterTab('ALL');
                  setSearchQuery('');
                }}
              >
                Clear Search & Filters
              </button>
            )}
          </div>
        ) : (
          /* Table View when Colleges are in Onboarding */
          <div className="onboarding-table-responsive">
            <table className="onboarding-table">
              <thead>
                <tr>
                  <th>College / Tenant</th>
                  <th>Code</th>
                  <th>Location</th>
                  <th>Onboarding Progress</th>
                  <th>Readiness</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedColleges.map((col) => {
                  const progressPct = col.progress_percentage || 0;
                  const isReady = col.is_ready_for_go_live;

                  return (
                    <tr key={col.college_id} className="onboarding-table-row">
                      <td>
                        <div className="college-cell-wrap">
                          <div className="college-avatar-box">
                            <Building2 size={16} />
                          </div>
                          <div>
                            {col.college_id ? (
                              <Link
                                to={`/colleges/${col.college_id}/onboarding`}
                                className="college-title-link"
                              >
                                {col.name}
                              </Link>
                            ) : (
                              <span className="college-title-static">{col.name}</span>
                            )}
                            <div className="college-meta-sub">
                              Registered {col.created_at ? new Date(col.created_at).toLocaleDateString() : '—'}
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
                        <div className="location-cell">
                          <MapPin size={13} className="text-slate-400" />
                          <span>
                            {col.city || col.state
                              ? [col.city, col.state].filter(Boolean).join(', ')
                              : '—'}
                          </span>
                        </div>
                      </td>

                      <td style={{ minWidth: '200px' }}>
                        <div className="progress-cell-header">
                          <span className="steps-count">
                            {col.completed_steps || 0} of {col.total_steps || 6} Steps
                          </span>
                          <span className={`progress-pct ${progressPct === 100 ? 'complete' : ''}`}>
                            {progressPct}%
                          </span>
                        </div>
                        <div className="progress-bar-track">
                          <div
                            className={`progress-bar-fill ${progressPct === 100 ? 'complete' : ''}`}
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </td>

                      <td>
                        {isReady ? (
                          <span className="badge-readiness ready">
                            <span className="readiness-dot" />
                            Ready for Go-Live
                          </span>
                        ) : (
                          <span className="badge-readiness in-progress">
                            <span className="readiness-dot" />
                            In Progress
                          </span>
                        )}
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <div className="action-buttons-wrap">
                          {col.college_id && (
                            <button
                              type="button"
                              className="btn-enterprise btn-outline-soft btn-sm"
                              onClick={() => navigate(`/colleges/${col.college_id}`)}
                              title="View college profile"
                              id={`btn-profile-${col.college_id}`}
                            >
                              Profile
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn-enterprise btn-primary-blue btn-sm"
                            disabled={!col.college_id}
                            onClick={() => col.college_id && navigate(`/colleges/${col.college_id}/onboarding`)}
                            title={col.college_id ? 'Open onboarding workspace' : 'Missing persistent ID'}
                            id={`btn-resume-onboarding-${col.college_id}`}
                          >
                            <span>Resume Wizard</span>
                            <ArrowRight size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="onboarding-pagination-bar">
                <span className="pagination-info">
                  Page {currentPage} of {totalPages} ({filteredColleges.length} colleges total)
                </span>
                <div className="pagination-actions">
                  <button
                    type="button"
                    className="btn-enterprise btn-outline-soft btn-sm"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft size={13} />
                    <span>Previous</span>
                  </button>
                  <button
                    type="button"
                    className="btn-enterprise btn-outline-soft btn-sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  >
                    <span>Next</span>
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
