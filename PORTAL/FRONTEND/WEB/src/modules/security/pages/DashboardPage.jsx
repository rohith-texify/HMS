import React, { useState, useEffect, useCallback } from 'react';
import api from '../../../shared/api/api';
import { useAuth } from '../../../shared/auth/useAuth';
import {
  ShieldCheck,
  DoorOpen,
  Send,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  GraduationCap,
} from 'lucide-react';
import { LoadingState, EmptyState } from '../../../shared/components';

export default function SecurityDashboardPage() {
  const { user } = useAuth();
  const [gates, setGates] = useState([]);
  const [activeLeaves, setActiveLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const fetchDashboardData = useCallback(async (manual = false) => {
    try {
      if (manual) setIsRefreshing(true);
      else setLoading(true);

      const [gatesRes, leavesRes] = await Promise.allSettled([
        api.get('/college/gates'),
        api.get('/college/leaves'),
      ]);

      if (gatesRes.status === 'fulfilled') {
        const data = gatesRes.value.data || gatesRes.value;
        setGates(Array.isArray(data) ? data : data.gates || data.data || []);
      }

      if (leavesRes.status === 'fulfilled') {
        const data = leavesRes.value.data || leavesRes.value;
        const allLeaves = Array.isArray(data) ? data : data.leaves || data.data || [];
        setActiveLeaves(
          allLeaves.filter((l) => (l.status || '').toUpperCase() === 'APPROVED')
        );
      }
    } catch (err) {
      console.error('Failed to load security dashboard:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const filteredLeaves = activeLeaves.filter((l) => {
    const q = search.toLowerCase();
    return (
      !search ||
      (l.reason || '').toLowerCase().includes(q) ||
      (l.student_id || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="fade-in-up">
      {/* Enterprise Hero Header */}
      <div className="enterprise-hero-header">
        <div className="hero-header-titles">
          <div className="hero-category-pill">
            <ShieldCheck size={13} />
            <span>Campus Perimeter Operations</span>
          </div>
          <h1 className="hero-main-title">Campus Security &amp; Gate Operations</h1>
          <p className="hero-subtitle">
            Verify student entry/exit passes, monitor perimeter security, and oversee gate checkpoint clearance in real-time.
          </p>
        </div>

        <div className="hero-action-buttons">
          <button
            type="button"
            className="btn-enterprise-secondary"
            onClick={() => fetchDashboardData(true)}
            disabled={isRefreshing}
          >
            <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} />
            <span>{isRefreshing ? 'Syncing...' : 'Sync Checkpoints'}</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="kpi-cards-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Active Gate Passes</span>
            <div className="stat-kpi-icon-wrap green">
              <Send size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-green-600">{activeLeaves.length}</div>
          <div className="stat-kpi-footnote">
            <span className="status-dot green" />
            <span>Approved for campus exit/entry</span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Operational Gates</span>
            <div className="stat-kpi-icon-wrap blue">
              <DoorOpen size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-blue-600">{gates.length}</div>
          <div className="stat-kpi-footnote">
            <span>Active perimeter checkpoints</span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Security Protocol</span>
            <div className="stat-kpi-icon-wrap orange">
              <ShieldCheck size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-orange-600">24 / 7</div>
          <div className="stat-kpi-footnote">
            <span>Continuous patrol &amp; logging</span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Curfew Clearance</span>
            <div className="stat-kpi-icon-wrap purple">
              <Clock size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-purple-600">Enforced</div>
          <div className="stat-kpi-footnote">
            <span>Roll-call verification active</span>
          </div>
        </div>
      </div>

      {/* Checkpoint Gates Overview */}
      <div className="enterprise-card" style={{ marginBottom: '24px' }}>
        <div className="card-topbar">
          <div className="card-title-group">
            <div className="card-title-icon-wrap">
              <DoorOpen size={16} />
            </div>
            <h2 className="card-title-text">Campus Gate Checkpoints ({gates.length})</h2>
          </div>
        </div>

        <div style={{ padding: '16px' }}>
          {loading ? (
            <div style={{ padding: '36px', textAlign: 'center' }}>
              <LoadingState message="Loading gate checkpoints..." />
            </div>
          ) : gates.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center' }}>
              <EmptyState
                title="No checkpoints configured"
                message="No campus gates are currently registered in the security directory."
              />
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: '14px',
              }}
            >
              {gates.map((g, idx) => (
                <div
                  key={g.id || idx}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '8px',
                          background: '#fff7ed',
                          color: '#ea580c',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <DoorOpen size={18} />
                      </div>
                      <div>
                        <strong style={{ color: '#0f172a', fontSize: '0.94rem', display: 'block' }}>
                          {g.name}
                        </strong>
                        <span className="code-pill" style={{ fontSize: '10.5px' }}>
                          {g.code || `GATE-0${idx + 1}`}
                        </span>
                      </div>
                    </div>
                    <span className="badge-enterprise badge-green" style={{ fontSize: '10px' }}>
                      OPERATIONAL
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#64748b', borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
                    <span>Type: <strong>{g.gate_type || 'ENTRY_EXIT'}</strong></span>
                    <span style={{ color: '#059669', fontWeight: 600 }}>Active Post</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Approved Passes Clearance Table */}
      <div className="enterprise-card">
        <div className="card-topbar">
          <div className="card-title-group">
            <div className="card-title-icon-wrap">
              <Send size={16} />
            </div>
            <h2 className="card-title-text">Approved Student Gate Passes &amp; Clearances</h2>
          </div>

          <span className="badge-enterprise badge-green">
            {activeLeaves.length} Valid Passes
          </span>
        </div>

        {/* Search Bar */}
        <div className="enterprise-filter-bar">
          <div className="filter-search-field">
            <Search size={14} className="filter-search-icon" />
            <input
              type="text"
              className="filter-search-input"
              placeholder="Search active passes by purpose, student ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="enterprise-table-container">
          <table className="enterprise-table">
            <thead>
              <tr>
                <th>Purpose / Reason</th>
                <th>Exit Authorized</th>
                <th>Expected Return</th>
                <th>Security Verification</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '36px' }}>
                    <LoadingState message="Scanning checkpoint passes..." />
                  </td>
                </tr>
              ) : filteredLeaves.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '36px' }}>
                    <EmptyState
                      title="No active gate passes"
                      message="No resident students currently have approved departure passes awaiting gate clearance."
                    />
                  </td>
                </tr>
              ) : (
                filteredLeaves.map((l, i) => (
                  <tr key={l.id || i}>
                    <td>
                      <strong style={{ color: '#0f172a', display: 'block', fontSize: '13.5px' }}>
                        {l.reason || 'Official Outing'}
                      </strong>
                      {l.student_id && (
                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                          Student: {l.student_id}
                        </span>
                      )}
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
                      <span className="badge-enterprise badge-green">
                        VALID PASS
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
