import React, { useState, useEffect, useCallback } from 'react';
import api from '../../../shared/api/api';
import {
  Send,
  Search,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileCheck,
} from 'lucide-react';
import { LoadingState, EmptyState } from '../../../shared/components';

export default function SecurityLeavesPage() {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const loadLeaves = useCallback(async (manual = false) => {
    try {
      if (manual) setIsRefreshing(true);
      else setLoading(true);

      const res = await api.get('/college/leaves');
      const d = res.data || res;
      setLeaves(Array.isArray(d) ? d : d?.leaves || []);
    } catch (err) {
      console.error('Failed to load leaves:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadLeaves();
  }, [loadLeaves]);

  const filtered = leaves.filter((l) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !search ||
      (l.reason || '').toLowerCase().includes(q) ||
      (l.student_id || '').toLowerCase().includes(q);
    const matchesStatus =
      statusFilter === 'ALL' || (l.status || '').toUpperCase() === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="fade-in-up">
      {/* Enterprise Hero Header */}
      <div className="enterprise-hero-header">
        <div className="hero-header-titles">
          <div className="hero-category-pill">
            <Send size={13} />
            <span>Gate Clearance Authorization</span>
          </div>
          <h1 className="hero-main-title">Student Gate Passes &amp; Outings</h1>
          <p className="hero-subtitle">
            Verify official student departure passes, scan physical gate QR clearances, and log arrival timestamps.
          </p>
        </div>

        <div className="hero-action-buttons">
          <button
            type="button"
            className="btn-enterprise-secondary"
            onClick={() => loadLeaves(true)}
            disabled={isRefreshing}
          >
            <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} />
            <span>{isRefreshing ? 'Syncing...' : 'Sync Passes'}</span>
          </button>
        </div>
      </div>

      {/* Main Container Card */}
      <div className="enterprise-card">
        <div className="card-topbar">
          <div className="card-title-group">
            <div className="card-title-icon-wrap">
              <Send size={16} />
            </div>
            <h2 className="card-title-text">Clearance &amp; Outing Passes Log</h2>
          </div>

          <span className="badge-enterprise badge-purple">
            {filtered.length} Recorded Passes
          </span>
        </div>

        {/* Filter Toolbar */}
        <div className="enterprise-filter-bar">
          <div className="filter-search-field">
            <Search size={14} className="filter-search-icon" />
            <input
              type="text"
              className="filter-search-input"
              placeholder="Search passes by student reference, purpose..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <select
              className="filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              <option value="APPROVED">APPROVED</option>
              <option value="PENDING">PENDING</option>
              <option value="REJECTED">REJECTED</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '36px', textAlign: 'center' }}>
            <LoadingState message="Loading gate passes..." />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '36px', textAlign: 'center' }}>
            <EmptyState
              title="No gate passes found"
              message="No student outing passes match your selected filter criteria."
            />
          </div>
        ) : (
          <div className="enterprise-table-container">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Outing Purpose / Reason</th>
                  <th>Student Reference</th>
                  <th>Authorized Departure</th>
                  <th>Expected Return</th>
                  <th>Gate Verification Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l, i) => {
                  const status = (l.status || 'APPROVED').toUpperCase();
                  const isApproved = status === 'APPROVED';

                  return (
                    <tr key={l.id || i}>
                      <td>
                        <strong style={{ color: '#0f172a', display: 'block', fontSize: '13.5px' }}>
                          {l.reason || 'Personal / Academic Outing'}
                        </strong>
                      </td>
                      <td>
                        <span className="code-pill">
                          {l.student_id ? `${l.student_id.slice(0, 10)}...` : `STU-${500 + i}`}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '12px', color: '#475569' }}>
                          {l.start_date || (l.from_date ? String(l.from_date).split('T')[0] : 'Today')}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '12px', color: '#475569' }}>
                          {l.end_date || (l.to_date ? String(l.to_date).split('T')[0] : 'Tonight')}
                        </span>
                      </td>
                      <td>
                        {isApproved ? (
                          <span className="badge-enterprise badge-green">AUTHORIZED</span>
                        ) : (
                          <span className="badge-enterprise badge-orange">{status}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
