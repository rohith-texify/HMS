import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  Building2,
  Users,
  ShieldCheck,
  Download,
  Filter,
  RefreshCw,
  AlertTriangle,
  Lock,
  Layers,
  CheckCircle,
  HelpCircle,
  Info,
} from 'lucide-react';
import reportService from '../services/reportService';

export default function ReportsAnalyticsPage() {
  const [summary, setSummary] = useState(null);
  const [collegeUsage, setCollegeUsage] = useState([]);
  const [moduleAdoption, setModuleAdoption] = useState([]);
  const [loginSecurity, setLoginSecurity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [securityDays, setSecurityDays] = useState(7);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'colleges' | 'modules' | 'security'

  const loadAllData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [sumRes, usageRes, adoptRes, secRes] = await Promise.all([
        reportService.getSummary(),
        reportService.getCollegeUsage({ status: statusFilter, limit: 50 }),
        reportService.getModuleAdoption(),
        reportService.getLoginSecurity(securityDays),
      ]);

      setSummary(sumRes?.data || sumRes || null);
      setCollegeUsage(Array.isArray(usageRes?.data) ? usageRes.data : Array.isArray(usageRes) ? usageRes : []);
      setModuleAdoption(Array.isArray(adoptRes?.data) ? adoptRes.data : Array.isArray(adoptRes) ? adoptRes : []);
      setLoginSecurity(Array.isArray(secRes?.data) ? secRes.data : Array.isArray(secRes) ? secRes : []);
    } catch (err) {
      console.error('Failed to load reports:', err);
      setError(err?.response?.data?.error || err.message || 'Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [statusFilter, securityDays]);

  const handleExportCsv = async () => {
    try {
      setExporting(true);
      const res = await reportService.exportCollegeUsageCsv({ status: statusFilter });
      const blob = new Blob([res.data || res], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `college_usage_report_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed: ' + (err?.response?.data?.error || err.message));
    } finally {
      setExporting(false);
    }
  };

  const filteredColleges = Array.isArray(collegeUsage) 
    ? collegeUsage.filter((c) => {
        if (!searchFilter) return true;
        const term = searchFilter.toLowerCase();
        return (
          (c.college_name && c.college_name.toLowerCase().includes(term)) ||
          (c.college_code && c.college_code.toLowerCase().includes(term))
        );
      })
    : [];

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="header-container">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>📊</span>
            <span>Platform Reports & Analytics</span>
          </h1>
          <p className="page-subtitle">
            Company-wide aggregate telemetry, verified 30-day active user counts, module adoption, and audited exports.
          </p>
        </div>
        <div className="quick-actions">
          <button
            onClick={loadAllData}
            disabled={loading}
            className="btn btn-outline"
            title="Refresh reports data"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <button
            onClick={handleExportCsv}
            disabled={exporting || loading}
            className="btn btn-primary"
          >
            <Download size={14} />
            <span>{exporting ? 'Generating CSV...' : 'Export Audited CSV'}</span>
          </button>
        </div>
      </div>

      {/* Small-Count Suppression & Privacy Notice */}
      <div className="alert-banner warning" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Info size={18} />
          <div>
            <strong>Privacy & Small-Count Suppression Active:</strong> Cohort aggregates with counts between 1 and 4 are suppressed to protect individual user privacy (displayed as <strong>&lt; 5</strong>).
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="alert-banner error">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="stat-grid-4">
        {/* Total Colleges */}
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-title">Total Institutions</span>
            <span className="badge badge-info">Tenants</span>
          </div>
          <div className="stat-card-value">
            {loading ? '...' : summary?.total_colleges ?? 0}
          </div>
          <div className="stat-card-subtitle" style={{ color: 'var(--success-text)', fontWeight: 600 }}>
            ✓ {summary?.active_colleges ?? 0} active in production
          </div>
        </div>

        {/* 30-Day Active Users */}
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-title">30-Day Active Users</span>
            <span className="badge badge-success">Unique Logins</span>
          </div>
          <div className="stat-card-value">
            {loading ? (
              '...'
            ) : summary?.active_users_30d === -1 ? (
              '< 5'
            ) : (
              summary?.active_users_30d ?? 0
            )}
          </div>
          <div className="stat-card-subtitle">Exact verified logins last 30d</div>
        </div>

        {/* Total Platform Users */}
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-title">Platform Identities</span>
            <span className="badge badge-primary">Control Plane</span>
          </div>
          <div className="stat-card-value">
            {loading ? '...' : summary?.total_platform_users ?? 0}
          </div>
          <div className="stat-card-subtitle">Super Admin & Platform staff</div>
        </div>

        {/* Catalog Modules */}
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-title">System Modules</span>
            <span className="badge badge-warning">Capabilities</span>
          </div>
          <div className="stat-card-value">
            {loading ? '...' : summary?.total_modules ?? 0}
          </div>
          <div className="stat-card-subtitle">Catalogue modules available</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="tab-group">
        <button
          onClick={() => setActiveTab('overview')}
          className={`tab-pill ${activeTab === 'overview' ? 'active' : ''}`}
        >
          <span>🏛️</span>
          <span>College Usage & Adoption</span>
        </button>
        <button
          onClick={() => setActiveTab('modules')}
          className={`tab-pill ${activeTab === 'modules' ? 'active' : ''}`}
        >
          <span>📦</span>
          <span>Module Adoption Rates</span>
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`tab-pill ${activeTab === 'security' ? 'active' : ''}`}
        >
          <span>🔒</span>
          <span>Authentication Security Trends</span>
        </button>
      </div>

      {/* Tab 1: College Usage Table */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Filters Bar */}
          <div className="filter-card" style={{ marginBottom: 0 }}>
            <div className="filter-grid">
              <div className="filter-group" style={{ flex: '1 1 280px' }}>
                <label className="filter-label" htmlFor="filter-college-search">Search Institutions</label>
                <input
                  id="filter-college-search"
                  type="text"
                  placeholder="Search college name or code..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="form-input"
                  style={{ width: '100%' }}
                />
              </div>

              <div className="filter-group">
                <label className="filter-label" htmlFor="filter-college-status">Lifecycle Status</label>
                <select
                  id="filter-college-status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="form-select"
                >
                  <option value="">All Statuses</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="ONBOARDING">ONBOARDING</option>
                  <option value="SUSPENDED">SUSPENDED</option>
                  <option value="DEACTIVATED">DEACTIVATED</option>
                </select>
              </div>
            </div>
          </div>

          {/* Table Card */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>College Identifier</th>
                    <th>Lifecycle Status</th>
                    <th>Active Users (30d)</th>
                    <th>Campus Staff</th>
                    <th>Admins</th>
                    <th>Enabled Modules</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                        Loading aggregate college data...
                      </td>
                    </tr>
                  ) : filteredColleges.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                        No colleges found matching the selected filters.
                      </td>
                    </tr>
                  ) : (
                    filteredColleges.map((c) => {
                      const renderSuppressed = (val) => {
                        if (val === -1) {
                          return (
                            <span className="badge badge-muted">&lt; 5</span>
                          );
                        }
                        return <strong>{val ?? 0}</strong>;
                      };

                      return (
                        <tr key={c.college_id}>
                          <td>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.college_name}</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                              {c.college_code}
                            </div>
                          </td>
                          <td>
                            <span
                              className={`badge ${
                                c.status === 'ACTIVE'
                                  ? 'badge-success'
                                  : c.status === 'SUSPENDED'
                                  ? 'badge-danger'
                                  : 'badge-warning'
                              }`}
                            >
                              {c.status}
                            </span>
                          </td>
                          <td>{renderSuppressed(c.active_users_30d)}</td>
                          <td>{renderSuppressed(c.total_staff)}</td>
                          <td>{renderSuppressed(c.total_admins)}</td>
                          <td>
                            <span style={{ fontWeight: 600, color: 'var(--primary-color)' }}>
                              {c.enabled_modules ?? 0}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Module Adoption */}
      {activeTab === 'modules' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
          {loading ? (
            <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '32px' }}>
              Loading module adoption figures...
            </div>
          ) : moduleAdoption.length === 0 ? (
            <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '32px' }}>
              No module adoption data recorded yet.
            </div>
          ) : (
            moduleAdoption.map((m) => (
              <div key={m.module_id} className="card" style={{ gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{m.module_name}</div>
                    <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                      {m.module_code}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--primary-color)' }}>
                      {m.adoption_pct}%
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Adoption Rate</div>
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-primary)', borderRadius: '9999px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                  <div
                    style={{
                      height: '100%',
                      backgroundColor: 'var(--primary-color)',
                      borderRadius: '9999px',
                      width: `${Math.min(100, Math.max(0, m.adoption_pct))}%`,
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  <span>Enabled: <strong>{m.enabled_colleges}</strong> institutions</span>
                  <span>Active Target: <strong>{m.total_colleges}</strong></span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 3: Security & Login Activity */}
      {activeTab === 'security' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="card" style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px' }}>
            <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Analysis Time Window:
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[7, 14, 30].map((d) => (
                <button
                  key={d}
                  onClick={() => setSecurityDays(d)}
                  className={`btn ${securityDays === d ? 'btn-primary' : 'btn-outline'} btn-sm`}
                >
                  Last {d} Days
                </button>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th style={{ color: 'var(--success-text)' }}>Successful Logins</th>
                    <th style={{ color: 'var(--danger-text)' }}>Failed Attempts</th>
                    <th style={{ color: 'var(--warning-text)' }}>Locked Events</th>
                    <th>Blocked Attempts</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '32px' }}>
                        Loading authentication security logs...
                      </td>
                    </tr>
                  ) : loginSecurity.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                        No authentication events recorded for the last {securityDays} days.
                      </td>
                    </tr>
                  ) : (
                    loginSecurity.map((l) => (
                      <tr key={l.day}>
                        <td style={{ fontWeight: 600 }}>{l.day}</td>
                        <td style={{ color: 'var(--success-text)', fontWeight: 600 }}>{l.success_count}</td>
                        <td style={{ color: 'var(--danger-text)', fontWeight: 600 }}>{l.failed_count}</td>
                        <td style={{ color: 'var(--warning-text)', fontWeight: 600 }}>{l.locked_count}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{l.blocked_count}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Blocked Features Clarification Notice */}
      <div className="notice-box" style={{ marginTop: '24px' }}>
        <div style={{ fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)' }}>
          ℹ️ Infrastructure Availability Notes:
        </div>
        <div>• <strong>Saved Reports:</strong> Blocked — Schema change required (<code style={{ backgroundColor: '#e2e8f0', padding: '1px 4px', borderRadius: '4px' }}>platform.saved_reports</code> does not exist).</div>
        <div>• <strong>Scheduled Email Reports:</strong> Blocked — Persistent task queue and cron daemon infrastructure not configured (in-memory timers forbidden by architectural constraints).</div>
      </div>
    </div>
  );
}
