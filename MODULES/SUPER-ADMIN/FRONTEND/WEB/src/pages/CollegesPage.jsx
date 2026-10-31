import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchCollegesList } from '../services/collegeService';
import { loginSuperAdmin } from '../services/dashboardService';

export default function CollegesPage() {
  const navigate = useNavigate();
  const [colleges, setColleges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Filters & Pagination State
  const [searchTerm, setSearchTerm] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [limit, setLimit] = useState(20);
  const [offset, setOffset] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // Stale request prevention
  const requestCounter = useRef(0);
  const abortControllerRef = useRef(null);

  const loadColleges = async (search, status, pageLimit, pageOffset) => {
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
        setColleges(result.colleges || []);
        setTotalCount(result.meta?.total || 0);
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
  };

  useEffect(() => {
    loadColleges(appliedSearch, statusFilter, limit, offset);
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [appliedSearch, statusFilter, limit, offset]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setOffset(0);
    setAppliedSearch(searchTerm);
  };

  const handleStatusChange = (e) => {
    setStatusFilter(e.target.value);
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

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'ACTIVE':
        return 'badge-success';
      case 'ONBOARDING':
        return 'badge-warning';
      case 'SUSPENDED':
        return 'badge-danger';
      case 'DEACTIVATED':
        return 'badge-deactivated';
      default:
        return 'badge-muted';
    }
  };

  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  return (
    <div>
      {/* Header & Navigation */}
      <div className="header-container">
        <div>
          <h1 className="page-title">College / Tenant Directory</h1>
          <p className="page-subtitle">
            Manage participating institutions, monitor onboarding progress, and inspect operational statuses.
          </p>
        </div>

        <div className="quick-actions">
          <Link to="/dashboard" className="btn btn-outline" id="btn-back-dashboard">
            ← Dashboard
          </Link>
          <Link to="/onboarding" className="btn btn-outline" id="btn-onboarding-pipeline">
            🚀 Onboarding Pipeline
          </Link>
          <button
            className="btn btn-outline"
            onClick={() => loadColleges(searchTerm, statusFilter, limit, offset)}
            disabled={loading}
            title="Refresh directory list"
          >
            {loading ? 'Refreshing...' : '↻ Refresh'}
          </button>
          <Link to="/colleges/new" className="btn btn-primary" id="btn-create-college-page">
            + Create College
          </Link>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="filter-card">
        <form onSubmit={handleSearchSubmit} className="filter-grid">
          <div className="filter-group" style={{ flex: '1 1 250px' }}>
            <label className="filter-label" htmlFor="college-search-input">
              Search Colleges
            </label>
            <input
              id="college-search-input"
              type="text"
              className="form-input"
              style={{ width: '100%' }}
              placeholder="Search by college name or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label className="filter-label" htmlFor="college-status-select">
              Lifecycle Status
            </label>
            <select
              id="college-status-select"
              className="form-select"
              value={statusFilter}
              onChange={handleStatusChange}
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="ONBOARDING">ONBOARDING</option>
              <option value="SUSPENDED">SUSPENDED</option>
              <option value="DEACTIVATED">DEACTIVATED</option>
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label" htmlFor="college-page-size-select">
              Page Size
            </label>
            <select
              id="college-page-size-select"
              className="form-select"
              style={{ minWidth: '90px' }}
              value={limit}
              onChange={handleLimitChange}
            >
              <option value="10">10 / page</option>
              <option value="20">20 / page</option>
              <option value="50">50 / page</option>
            </select>
          </div>

          <div className="filter-group">
            <button type="submit" className="btn btn-primary" id="btn-submit-search">
              Search
            </button>
          </div>
        </form>
      </div>

      {/* Error State */}
      {error && (
        <div className="error-box" style={{ marginBottom: '20px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
            ⚠️ Error Loading Colleges
          </div>
          <div>{error}</div>
          <div style={{ marginTop: '16px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button className="btn btn-outline" onClick={() => loadColleges(searchTerm, statusFilter, limit, offset)}>
              Retry Request
            </button>
            <button className="btn btn-primary" onClick={handleConnectSession}>
              Connect Super Admin Session
            </button>
          </div>
        </div>
      )}

      {/* Directory Table */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <span>Institutions</span>
            {!loading && (
              <span className="badge badge-info">
                {totalCount} Total Registered
              </span>
            )}
          </div>
          {statusFilter !== 'ALL' && (
            <span className="badge badge-muted">
              Filter: {statusFilter}
            </span>
          )}
        </div>

        {loading ? (
          <div className="loading-box">
            <p>Loading college directory...</p>
          </div>
        ) : colleges.length === 0 ? (
          <div className="empty-box">
            <p className="empty-text">
              No colleges found matching the selected search query or lifecycle status filter.
            </p>
            <button
              className="btn btn-outline btn-sm"
              style={{ marginTop: '12px' }}
              onClick={() => {
                setSearchTerm('');
                setAppliedSearch('');
                setStatusFilter('ALL');
                setOffset(0);
              }}
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="data-table" id="colleges-directory-table">
                <thead>
                  <tr>
                    <th>College Name</th>
                    <th>Code</th>
                    <th>Status</th>
                    <th>Timezone</th>
                    <th>Location</th>
                    <th>Contact</th>
                    <th>Created</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {colleges.map((col) => (
                    <tr key={col.college_id} id={`college-row-${col.college_id}`}>
                      <td>
                        <Link
                          to={`/colleges/${col.college_id}`}
                          style={{ fontWeight: '600', color: 'var(--primary-color)', textDecoration: 'none' }}
                        >
                          {col.name}
                        </Link>
                      </td>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                          {col.college_code}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${getStatusBadgeClass(col.status)}`}>
                          {col.status}
                        </span>
                      </td>
                      <td>{col.timezone === 'Asia/Kolkata' ? 'IST' : (col.timezone || 'IST')}</td>
                      <td>
                        {col.city || col.state
                          ? [col.city, col.state].filter(Boolean).join(', ')
                          : '—'}
                      </td>
                      <td>{col.contact_email || '—'}</td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {col.created_at ? new Date(col.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          {col.status === 'ONBOARDING' && (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => navigate(`/colleges/${col.college_id}/onboarding`)}
                              title="Resume college onboarding wizard"
                            >
                              Resume 🚀
                            </button>
                          )}
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => navigate(`/colleges/${col.college_id}`)}
                            title="View college profile and lifecycle actions"
                          >
                            View Details →
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="pagination-toolbar">
              <div style={{ color: 'var(--text-secondary)' }}>
                Showing {Math.min(offset + 1, totalCount)} to {Math.min(offset + limit, totalCount)} of {totalCount} records
              </div>

              <div className="pagination-controls">
                <button
                  className="btn btn-outline btn-sm"
                  onClick={handlePrevPage}
                  disabled={offset === 0 || loading}
                  id="btn-prev-page"
                >
                  ← Previous
                </button>
                <span style={{ padding: '0 8px', fontWeight: '600' }}>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={handleNextPage}
                  disabled={offset + limit >= totalCount || loading}
                  id="btn-next-page"
                >
                  Next →
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
