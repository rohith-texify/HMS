import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchOnboardingPipeline } from '../services/onboardingService';

export default function OnboardingListPage() {
  const navigate = useNavigate();
  const [pipeline, setPipeline] = useState([]);
  const [loading, setLoading] = useState(false);
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

    // Auto-refresh when returning to the tab/window from the wizard
    const handleWindowFocus = () => {
      loadPipeline();
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
    <div className="onboarding-list-page" style={{ padding: '24px 32px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '0.875rem', marginBottom: '4px' }}>
            <Link to="/dashboard" style={{ color: '#64748b', textDecoration: 'none' }}>Dashboard</Link>
            <span>/</span>
            <span style={{ color: '#0f172a', fontWeight: '500' }}>College Onboarding</span>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '700', color: '#0f172a', margin: 0 }}>
            College Onboarding Pipeline
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '4px 0 0 0' }}>
            Monitor, resume, or complete the 7-stage tenant onboarding lifecycle for institutional colleges.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            className="btn btn-outline"
            onClick={loadPipeline}
            disabled={loading}
            title="Refresh onboarding pipeline"
          >
            🔄 Refresh
          </button>
          <Link to="/colleges/new" className="btn btn-primary" id="btn-start-new-onboarding">
            + Start New Onboarding
          </Link>
        </div>
      </div>

      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '20px', borderLeft: '4px solid #3b82f6' }}>
          <div style={{ fontSize: '0.85rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>
            Active Onboarding Tenants
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: '#0f172a', marginTop: '6px' }}>
            {totalCount}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
            Tenants currently in draft or setup phase
          </div>
        </div>

        <div className="card" style={{ padding: '20px', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ fontSize: '0.85rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>
            In-Progress Drafts
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: '#d97706', marginTop: '6px' }}>
            {inProgressCount}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
            Awaiting profile, admin, or structure configuration
          </div>
        </div>

        <div className="card" style={{ padding: '20px', borderLeft: '4px solid #10b981' }}>
          <div style={{ fontSize: '0.85rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>
            Ready for Go-Live Review
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: '#059669', marginTop: '6px' }}>
            {readyCount}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
            Mandatory gates completed, awaiting activation
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        {/* Controls Toolbar: Filter Tabs & Search */}
        <div style={{
          padding: '14px 20px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#f8fafc',
        }}>
          {/* Tab Selector Buttons */}
          <div style={{ display: 'inline-flex', background: '#e2e8f0', padding: '3px', borderRadius: '8px', gap: '3px' }}>
            <button
              onClick={() => setFilterTab('ALL')}
              style={{
                border: 'none',
                background: filterTab === 'ALL' ? '#ffffff' : 'transparent',
                color: filterTab === 'ALL' ? '#0f172a' : '#64748b',
                fontWeight: filterTab === 'ALL' ? '600' : '500',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '0.85rem',
                cursor: 'pointer',
                boxShadow: filterTab === 'ALL' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.15s ease',
              }}
              id="tab-filter-all"
            >
              All Tenants ({totalCount})
            </button>
            <button
              onClick={() => setFilterTab('READY')}
              style={{
                border: 'none',
                background: filterTab === 'READY' ? '#ffffff' : 'transparent',
                color: filterTab === 'READY' ? '#065f46' : '#64748b',
                fontWeight: filterTab === 'READY' ? '600' : '500',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '0.85rem',
                cursor: 'pointer',
                boxShadow: filterTab === 'READY' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.15s ease',
              }}
              id="tab-filter-ready"
            >
              Ready for Go-Live ({readyCount})
            </button>
            <button
              onClick={() => setFilterTab('IN_PROGRESS')}
              style={{
                border: 'none',
                background: filterTab === 'IN_PROGRESS' ? '#ffffff' : 'transparent',
                color: filterTab === 'IN_PROGRESS' ? '#92400e' : '#64748b',
                fontWeight: filterTab === 'IN_PROGRESS' ? '600' : '500',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '0.85rem',
                cursor: 'pointer',
                boxShadow: filterTab === 'IN_PROGRESS' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.15s ease',
              }}
              id="tab-filter-in-progress"
            >
              In Progress ({inProgressCount})
            </button>
          </div>

          {/* Search bar inside card */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, maxWidth: '360px' }}>
            <span style={{ color: '#94a3b8' }}>🔍</span>
            <input
              type="text"
              placeholder="Search by college name, code, city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 12px',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '0.85rem',
                background: '#ffffff',
              }}
              id="input-search-onboarding"
            />
          </div>
        </div>

        {error && (
          <div style={{ padding: '16px 20px', background: '#fef2f2', borderLeft: '4px solid #ef4444', color: '#991b1b', fontSize: '0.9rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>⚠️ {error}</span>
            <button className="btn btn-outline btn-sm" onClick={loadPipeline}>
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontSize: '2rem', marginBottom: '12px' }}>⏳</div>
            Loading college onboarding pipeline...
          </div>
        ) : filteredColleges.length === 0 ? (
          <div style={{ padding: '64px', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🏫</div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '600', color: '#1e293b', marginBottom: '6px' }}>
              {pipeline.length === 0 ? 'No Colleges in Onboarding' : 'No Colleges Match Search or Filter'}
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem', maxWidth: '440px', margin: '0 auto 20px auto' }}>
              {pipeline.length === 0
                ? 'All colleges are either active or no onboarding drafts are currently open. You can start onboarding a new institution anytime.'
                : 'No onboarding drafts match your query. Try resetting your search or filter tab.'}
            </p>
            {pipeline.length === 0 ? (
              <Link to="/colleges/new" className="btn btn-primary" id="btn-register-new-college-empty">
                + Register New College
              </Link>
            ) : (
              <button
                className="btn btn-outline"
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
          <div className="table-responsive">
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                  <th style={{ padding: '12px 20px', fontSize: '0.75rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>
                    College / Tenant
                  </th>
                  <th style={{ padding: '12px 16px', fontSize: '0.75rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>
                    Code
                  </th>
                  <th style={{ padding: '12px 16px', fontSize: '0.75rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>
                    Location
                  </th>
                  <th style={{ padding: '12px 16px', fontSize: '0.75rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>
                    Onboarding Progress
                  </th>
                  <th style={{ padding: '12px 16px', fontSize: '0.75rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>
                    Readiness
                  </th>
                  <th style={{ padding: '12px 20px', fontSize: '0.75rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', textAlign: 'right' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedColleges.map((col) => {
                  const progressPct = col.progress_percentage || 0;
                  const isReady = col.is_ready_for_go_live;

                  return (
                    <tr
                      key={col.college_id}
                      style={{ borderBottom: '1px solid #f1f5f9' }}
                    >
                      <td style={{ padding: '16px 20px' }}>
                        {col.college_id ? (
                          <Link
                            to={`/colleges/${col.college_id}/onboarding`}
                            style={{ fontWeight: '600', color: '#2563eb', textDecoration: 'none', fontSize: '0.95rem' }}
                          >
                            {col.name}
                          </Link>
                        ) : (
                          <span style={{ fontWeight: '600', color: '#0f172a', fontSize: '0.95rem' }}>
                            {col.name}
                          </span>
                        )}
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                          Registered {col.created_at ? new Date(col.created_at).toLocaleDateString() : '—'}
                        </div>
                      </td>

                      <td style={{ padding: '16px' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 'bold', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontSize: '0.85rem' }}>
                          {col.college_code}
                        </span>
                      </td>

                      <td style={{ padding: '16px', fontSize: '0.85rem', color: '#475569' }}>
                        {col.city || col.state
                          ? [col.city, col.state].filter(Boolean).join(', ')
                          : '—'}
                      </td>

                      <td style={{ padding: '16px', minWidth: '200px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#475569' }}>
                            {col.completed_steps || 0} of {col.total_steps || 6} Steps
                          </span>
                          <span style={{ fontSize: '0.8rem', fontWeight: '700', color: progressPct === 100 ? '#059669' : '#2563eb' }}>
                            {progressPct}%
                          </span>
                        </div>
                        <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                          <div
                            style={{
                              height: '100%',
                              width: `${progressPct}%`,
                              background: progressPct === 100 ? '#10b981' : '#3b82f6',
                              transition: 'width 0.3s ease',
                            }}
                          />
                        </div>
                      </td>

                      <td style={{ padding: '16px' }}>
                        {isReady ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: '#ecfdf5',
                            color: '#065f46',
                            padding: '4px 8px',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                          }}>
                            ● Ready for Go-Live
                          </span>
                        ) : (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: '#fffbeb',
                            color: '#92400e',
                            padding: '4px 8px',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                          }}>
                            ○ In Progress
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                          {col.college_id && (
                            <button
                              className="btn btn-outline btn-sm"
                              onClick={() => navigate(`/colleges/${col.college_id}`)}
                              title="View college profile"
                              id={`btn-profile-${col.college_id}`}
                            >
                              Profile
                            </button>
                          )}
                          <button
                            className="btn btn-primary btn-sm"
                            disabled={!col.college_id}
                            onClick={() => col.college_id && navigate(`/colleges/${col.college_id}/onboarding`)}
                            title={col.college_id ? 'Open onboarding workspace' : 'Missing persistent ID'}
                            id={`btn-resume-onboarding-${col.college_id}`}
                          >
                            Resume Wizard →
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Bounded Pagination Controls */}
            {totalPages > 1 && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 20px',
                borderTop: '1px solid #e2e8f0',
                background: '#f8fafc',
              }}>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Page {currentPage} of {totalPages} ({filteredColleges.length} colleges total)
                </span>
                <div style={{ display: 'inline-flex', gap: '8px' }}>
                  <button
                    className="btn btn-outline btn-sm"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                    ← Previous
                  </button>
                  <button
                    className="btn btn-outline btn-sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next →
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

