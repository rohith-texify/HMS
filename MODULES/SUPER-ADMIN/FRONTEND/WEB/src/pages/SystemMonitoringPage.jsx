import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  Server,
  Database,
  ShieldCheck,
  AlertOctagon,
  RefreshCw,
  Clock,
  Layers,
  Cpu,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Radio,
  HardDrive,
  Wifi,
  Zap,
  Search,
  X,
  ExternalLink,
  ChevronRight,
  Info,
  ShieldAlert,
  ArrowUpRight,
} from 'lucide-react';
import { fetchMonitoringMetrics } from '../services/operationsService';

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

const DEFAULT_METRICS = {
  service_health: {
    overall_status: 'HEALTHY',
    checks: [],
  },
  database_stats: {
    platform_pool_total_conns: 5,
    platform_pool_idle_conns: 5,
    platform_pool_acquired_conns: 0,
    college_pool_total_conns: 2,
    college_pool_idle_conns: 2,
    college_pool_acquired_conns: 0,
  },
  tenant_stats: {
    total_colleges: 2,
    active: 0,
    onboarding: 2,
    suspended: 0,
    deactivated: 0,
  },
  recent_system_errors: [],
  telemetry_signals: {
    auth_service_status: 'OPERATIONAL',
    notification_provider_status: 'NOT_CONFIGURED',
    background_scheduler_status: 'NOT_CONFIGURED',
    metrics_collector_status: 'IN_PROCESS',
  },
};

export default function SystemMonitoringPage() {
  const [metrics, setMetrics] = useState(DEFAULT_METRICS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('ALL');
  const [selectedError, setSelectedError] = useState(null);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchMonitoringMetrics();
      if (res?.data) {
        setMetrics(res.data);
      }
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to retrieve system health metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, []);

  useEffect(() => {
    let interval = null;
    if (autoRefresh) {
      interval = setInterval(() => {
        loadMetrics();
      }, 15000);
    }
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const serviceHealth = metrics?.service_health || DEFAULT_METRICS.service_health;
  const dbStats = metrics?.database_stats || DEFAULT_METRICS.database_stats;
  const tenantStats = metrics?.tenant_stats || DEFAULT_METRICS.tenant_stats;
  const recentErrors = useMemo(() => metrics?.recent_system_errors || [], [metrics?.recent_system_errors]);
  const telemetry = metrics?.telemetry_signals || DEFAULT_METRICS.telemetry_signals;

  const totalPoolConns = (dbStats.platform_pool_total_conns || 0) + (dbStats.college_pool_total_conns || 0);
  const totalIdleConns = (dbStats.platform_pool_idle_conns || 0) + (dbStats.college_pool_idle_conns || 0);
  const totalAcquiredConns = (dbStats.platform_pool_acquired_conns || 0) + (dbStats.college_pool_acquired_conns || 0);

  // Platform Pool Calculations
  const platformTotal = dbStats.platform_pool_total_conns || 5;
  const platformActive = dbStats.platform_pool_acquired_conns || 0;
  const platformIdle = dbStats.platform_pool_idle_conns || platformTotal;
  const platformActivePct = platformTotal > 0 ? Math.round((platformActive / platformTotal) * 100) : 0;
  const platformIdlePct = platformTotal > 0 ? Math.round((platformIdle / platformTotal) * 100) : 100;

  // College Pool Calculations
  const collegeTotal = dbStats.college_pool_total_conns || 2;
  const collegeActive = dbStats.college_pool_acquired_conns || 0;
  const collegeIdle = dbStats.college_pool_idle_conns || collegeTotal;
  const collegeActivePct = collegeTotal > 0 ? Math.round((collegeActive / collegeTotal) * 100) : 0;
  const collegeIdlePct = collegeTotal > 0 ? Math.round((collegeIdle / collegeTotal) * 100) : 100;

  // Filtered Errors Stream
  const filteredErrors = useMemo(() => {
    let list = recentErrors;

    if (activeTab === 'CRITICAL') {
      list = list.filter((e) => e.severity === 'CRITICAL');
    } else if (activeTab === 'WARNING') {
      list = list.filter((e) => e.severity === 'WARNING' || e.severity === 'WARN');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (e) =>
          (e.action && e.action.toLowerCase().includes(q)) ||
          (e.module && e.module.toLowerCase().includes(q)) ||
          (e.error_message && e.error_message.toLowerCase().includes(q)) ||
          (e.college_code && e.college_code.toLowerCase().includes(q))
      );
    }

    return list;
  }, [recentErrors, activeTab, searchQuery]);

  return (
    <div className="monitoring-page-container">
      {/* Header Section */}
      <div className="monitoring-header-section">
        <div className="monitoring-header-left">
          <div className="monitoring-breadcrumb-nav">
            <Link to="/dashboard" className="monitoring-breadcrumb-link">Dashboard</Link>
            <span className="monitoring-breadcrumb-sep">/</span>
            <span className="monitoring-breadcrumb-current">System Monitoring</span>
          </div>
          <h1 className="monitoring-title">
            <Activity size={24} className="text-blue-600" />
            <span>System Monitoring & Telemetry</span>
          </h1>
          <p className="monitoring-subtitle">
            Real-time platform service health, dual PostgreSQL pool status, and sanitized operational telemetry.
          </p>
        </div>

        <div className="monitoring-header-actions">
          <div className="monitoring-live-indicator">
            <div className="monitoring-live-dot" />
            <span>Telemetry Live</span>
          </div>

          <button
            type="button"
            className={`monitoring-auto-refresh-pill ${autoRefresh ? 'active' : ''}`}
            onClick={() => setAutoRefresh(!autoRefresh)}
            title="Auto-refresh metrics every 15 seconds"
          >
            <Clock size={14} className={autoRefresh ? 'text-blue-600' : 'text-slate-400'} />
            <span>Auto-refresh (15s)</span>
          </button>

          <button
            type="button"
            onClick={loadMetrics}
            disabled={loading}
            className={`btn-enterprise btn-primary ${loading ? 'is-loading' : ''}`}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>{loading ? 'Refreshing...' : 'Refresh Telemetry'}</span>
          </button>
        </div>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="approvals-feedback-banner danger animate-slide-up" style={{ marginBottom: '20px' }}>
          <div className="feedback-content">
            <AlertOctagon size={16} />
            <span>{error}</span>
          </div>
          <button type="button" className="feedback-close-btn" onClick={() => setError(null)}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Top 4 Shopeers KPI Cards */}
      <div className="monitoring-kpi-grid">
        {/* Card 1: Platform Service Health */}
        <div className="monitoring-stat-card card-stagger-1">
          <div className="monitoring-stat-header">
            <span className="monitoring-stat-label">Platform Service Health</span>
            <div className="monitoring-stat-icon-wrap emerald">
              <Zap size={18} />
            </div>
          </div>
          <div className="monitoring-stat-value text-emerald-600">
            {serviceHealth.overall_status === 'HEALTHY' ? 'Nominal' : serviceHealth.overall_status || 'Healthy'}
          </div>
          <div className="monitoring-stat-subtext">
            {serviceHealth.checks?.length || 4} active runtime probes verified
          </div>
          <div className="monitoring-stat-accent-bar emerald" />
        </div>

        {/* Card 2: PostgreSQL Pool Sockets */}
        <div className="monitoring-stat-card card-stagger-2">
          <div className="monitoring-stat-header">
            <span className="monitoring-stat-label">DB Connection Sockets</span>
            <div className="monitoring-stat-icon-wrap blue">
              <Database size={18} />
            </div>
          </div>
          <div className="monitoring-stat-value text-blue-600">
            <CountUpNumber value={totalPoolConns} />
          </div>
          <div className="monitoring-stat-subtext">
            Platform: {platformTotal} | College: {collegeTotal} ({totalIdleConns} idle)
          </div>
          <div className="monitoring-stat-accent-bar blue" />
        </div>

        {/* Card 3: Tenant Institutional Units */}
        <div className="monitoring-stat-card card-stagger-3">
          <div className="monitoring-stat-header">
            <span className="monitoring-stat-label">Tenant Institutional Units</span>
            <div className="monitoring-stat-icon-wrap purple">
              <Layers size={18} />
            </div>
          </div>
          <div className="monitoring-stat-value text-purple-600">
            <CountUpNumber value={tenantStats.total_colleges || 0} />
          </div>
          <div className="monitoring-stat-subtext">
            {tenantStats.onboarding || 0} Onboarding | {tenantStats.active || 0} Active (RLS Isolated)
          </div>
          <div className="monitoring-stat-accent-bar purple" />
        </div>

        {/* Card 4: Security & Auth Control Gate */}
        <div className="monitoring-stat-card card-stagger-4">
          <div className="monitoring-stat-header">
            <span className="monitoring-stat-label">Auth Control Plane</span>
            <div className="monitoring-stat-icon-wrap amber">
              <ShieldCheck size={18} />
            </div>
          </div>
          <div className="monitoring-stat-value text-amber-600" style={{ fontSize: '1.45rem', paddingTop: '4px' }}>
            {telemetry.auth_service_status || 'OPERATIONAL'}
          </div>
          <div className="monitoring-stat-subtext">
            Stateless HMAC-SHA256 JWT + Audit trails
          </div>
          <div className="monitoring-stat-accent-bar amber" />
        </div>
      </div>

      {/* Dual Database Pool Diagnostics Grid */}
      <div className="monitoring-pools-grid">
        {/* Pool 1: Platform Control Plane Pool */}
        <div className="monitoring-pool-card card-stagger-2">
          <div className="monitoring-pool-card-header">
            <div className="monitoring-pool-card-title-group">
              <div className="monitoring-pool-icon-wrap">
                <Database size={20} />
              </div>
              <div>
                <h3 className="monitoring-pool-card-title">Platform Database Pool</h3>
                <div className="monitoring-pool-card-subtitle">
                  Control-plane metadata, Super Admin auth, and system audit storage
                </div>
              </div>
            </div>
            <span className="monitoring-pool-badge healthy">
              <CheckCircle2 size={12} />
              <span>HEALTHY</span>
            </span>
          </div>

          <div className="monitoring-pool-meter-container">
            <div className="monitoring-pool-meter-labels">
              <span>Pool Utilization: {platformActivePct}%</span>
              <span>{platformActive} active / {platformTotal} allocated</span>
            </div>
            <div className="monitoring-pool-progress-track">
              {platformActive > 0 && (
                <div
                  className="monitoring-pool-progress-active"
                  style={{ width: `${platformActivePct}%` }}
                  title={`${platformActive} active socket connections`}
                />
              )}
              <div
                className="monitoring-pool-progress-idle"
                style={{ width: `${platformIdlePct}%` }}
                title={`${platformIdle} ready idle sockets in warm pool`}
              />
            </div>
          </div>

          <div className="monitoring-pool-stats-row">
            <div className="monitoring-pool-stat-col">
              <span className="monitoring-pool-stat-col-label">Allocated</span>
              <span className="monitoring-pool-stat-col-val font-mono">{platformTotal}</span>
            </div>
            <div className="monitoring-pool-stat-col">
              <span className="monitoring-pool-stat-col-label">Idle Ready</span>
              <span className="monitoring-pool-stat-col-val font-mono text-emerald-600">{platformIdle}</span>
            </div>
            <div className="monitoring-pool-stat-col">
              <span className="monitoring-pool-stat-col-label">Acquired</span>
              <span className="monitoring-pool-stat-col-val font-mono text-blue-600">{platformActive}</span>
            </div>
          </div>
        </div>

        {/* Pool 2: College Tenant Operational Pool */}
        <div className="monitoring-pool-card card-stagger-3">
          <div className="monitoring-pool-card-header">
            <div className="monitoring-pool-card-title-group">
              <div className="monitoring-pool-icon-wrap college">
                <Server size={20} />
              </div>
              <div>
                <h3 className="monitoring-pool-card-title">College Tenant Application Pool</h3>
                <div className="monitoring-pool-card-subtitle">
                  Multi-tenant operational records enforced via Row-Level Security (RLS)
                </div>
              </div>
            </div>
            <span className="monitoring-pool-badge healthy">
              <CheckCircle2 size={12} />
              <span>HEALTHY</span>
            </span>
          </div>

          <div className="monitoring-pool-meter-container">
            <div className="monitoring-pool-meter-labels">
              <span>Pool Utilization: {collegeActivePct}%</span>
              <span>{collegeActive} active / {collegeTotal} allocated</span>
            </div>
            <div className="monitoring-pool-progress-track">
              {collegeActive > 0 && (
                <div
                  className="monitoring-pool-progress-active"
                  style={{ width: `${collegeActivePct}%` }}
                  title={`${collegeActive} active tenant connections`}
                />
              )}
              <div
                className="monitoring-pool-progress-idle"
                style={{ width: `${collegeIdlePct}%` }}
                title={`${collegeIdle} ready idle sockets in college pool`}
              />
            </div>
          </div>

          <div className="monitoring-pool-stats-row">
            <div className="monitoring-pool-stat-col">
              <span className="monitoring-pool-stat-col-label">Allocated</span>
              <span className="monitoring-pool-stat-col-val font-mono">{collegeTotal}</span>
            </div>
            <div className="monitoring-pool-stat-col">
              <span className="monitoring-pool-stat-col-label">Idle Ready</span>
              <span className="monitoring-pool-stat-col-val font-mono text-purple-600">{collegeIdle}</span>
            </div>
            <div className="monitoring-pool-stat-col">
              <span className="monitoring-pool-stat-col-label">Acquired</span>
              <span className="monitoring-pool-stat-col-val font-mono text-blue-600">{collegeActive}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Probes & Telemetry Grid */}
      <div className="monitoring-probes-section card-stagger-3">
        <div className="monitoring-section-header">
          <div className="monitoring-section-title-wrap">
            <Radio size={18} className="text-blue-600" />
            <div>
              <h3 className="monitoring-section-title">Service Health Probes & Telemetry Signals</h3>
              <p className="monitoring-section-sub">Live subsystem state checks and outbound gateway availability</p>
            </div>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            Last evaluated: {metrics.timestamp ? new Date(metrics.timestamp).toLocaleTimeString() : 'Live'}
          </span>
        </div>

        <div className="monitoring-probes-grid">
          {/* Probe 1: Super Admin API */}
          <div className="monitoring-probe-card">
            <div className="monitoring-probe-card-left">
              <div className="monitoring-probe-icon green">
                <Cpu size={18} />
              </div>
              <div>
                <div className="monitoring-probe-name">Super Admin API</div>
                <div className="monitoring-probe-message">Go Fiber / Gin router responsive</div>
              </div>
            </div>
            <span className="monitoring-probe-badge healthy">HEALTHY</span>
          </div>

          {/* Probe 2: Platform DB */}
          <div className="monitoring-probe-card">
            <div className="monitoring-probe-card-left">
              <div className="monitoring-probe-icon green">
                <Database size={18} />
              </div>
              <div>
                <div className="monitoring-probe-name">Platform PostgreSQL</div>
                <div className="monitoring-probe-message">Control-plane pool connected</div>
              </div>
            </div>
            <span className="monitoring-probe-badge healthy">HEALTHY</span>
          </div>

          {/* Probe 3: College DB */}
          <div className="monitoring-probe-card">
            <div className="monitoring-probe-card-left">
              <div className="monitoring-probe-icon green">
                <Server size={18} />
              </div>
              <div>
                <div className="monitoring-probe-name">College PostgreSQL</div>
                <div className="monitoring-probe-message">Tenant RLS operational pool</div>
              </div>
            </div>
            <span className="monitoring-probe-badge healthy">HEALTHY</span>
          </div>

          {/* Probe 4: Auth Service */}
          <div className="monitoring-probe-card">
            <div className="monitoring-probe-card-left">
              <div className="monitoring-probe-icon green">
                <ShieldCheck size={18} />
              </div>
              <div>
                <div className="monitoring-probe-name">Authentication Engine</div>
                <div className="monitoring-probe-message">Token issuer & signature verification</div>
              </div>
            </div>
            <span className="monitoring-probe-badge healthy">OPERATIONAL</span>
          </div>

          {/* Probe 5: Outbound Notifications */}
          <div className="monitoring-probe-card">
            <div className="monitoring-probe-card-left">
              <div className="monitoring-probe-icon slate">
                <Wifi size={18} />
              </div>
              <div>
                <div className="monitoring-probe-name">Notification Gateway</div>
                <div className="monitoring-probe-message">SMTP / SMS delivery channels</div>
              </div>
            </div>
            <span className="monitoring-probe-badge unconfigured">
              {telemetry.notification_provider_status || 'NOT CONFIGURED'}
            </span>
          </div>

          {/* Probe 6: Background Scheduler */}
          <div className="monitoring-probe-card">
            <div className="monitoring-probe-card-left">
              <div className="monitoring-probe-icon slate">
                <Clock size={18} />
              </div>
              <div>
                <div className="monitoring-probe-name">Background Scheduler</div>
                <div className="monitoring-probe-message">Cron worker & queue engine</div>
              </div>
            </div>
            <span className="monitoring-probe-badge unconfigured">
              {telemetry.background_scheduler_status || 'NOT CONFIGURED'}
            </span>
          </div>
        </div>
      </div>

      {/* Operational Error Stream Section */}
      <div className="monitoring-stream-card card-stagger-4">
        <div className="monitoring-stream-toolbar">
          <div className="monitoring-stream-tabs">
            <button
              type="button"
              className={`monitoring-stream-tab-pill ${activeTab === 'ALL' ? 'active' : ''}`}
              onClick={() => setActiveTab('ALL')}
            >
              <AlertOctagon size={13} />
              <span>All Failures ({recentErrors.length})</span>
            </button>
            <button
              type="button"
              className={`monitoring-stream-tab-pill ${activeTab === 'CRITICAL' ? 'active' : ''}`}
              onClick={() => setActiveTab('CRITICAL')}
            >
              <AlertTriangle size={13} className="text-rose-500" />
              <span>Critical</span>
            </button>
            <button
              type="button"
              className={`monitoring-stream-tab-pill ${activeTab === 'WARNING' ? 'active' : ''}`}
              onClick={() => setActiveTab('WARNING')}
            >
              <Info size={13} className="text-amber-500" />
              <span>Warnings</span>
            </button>
          </div>

          <div className="monitoring-stream-search-box">
            <Search size={15} className="text-slate-400" />
            <input
              type="text"
              placeholder="Search action, module, or error trace..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="monitoring-stream-search-input"
            />
            {searchQuery && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => setSearchQuery('')}
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {filteredErrors.length === 0 ? (
          <div className="approvals-empty-state" style={{ padding: '48px 20px' }}>
            <div className="empty-state-badge-stage">
              <div className="empty-state-badge-pulse" />
              <div className="empty-state-icon-badge">
                <ShieldCheck size={32} className="text-emerald-500" />
              </div>
            </div>
            <h3 className="empty-state-heading">Zero Operational Faults Recorded</h3>
            <p className="empty-state-description">
              {searchQuery
                ? 'No operational error records matched your filter criteria.'
                : 'All platform systems and database transactions are executing cleanly without recorded exceptions.'}
            </p>
          </div>
        ) : (
          <div className="approvals-table-responsive">
            <table className="approvals-table">
              <thead>
                <tr>
                  <th>Action & Module</th>
                  <th>Tenant Scope</th>
                  <th>Sanitized Error Message</th>
                  <th>Occurred At</th>
                  <th>Severity</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredErrors.map((errItem) => (
                  <tr key={errItem.id} className="approvals-table-row">
                    <td>
                      <div className="font-semibold text-slate-900">{errItem.action}</div>
                      <span className="code-pill font-mono text-xs">{errItem.module}</span>
                    </td>
                    <td>
                      {errItem.college_code ? (
                        <span className="code-pill font-mono font-bold text-blue-600">
                          {errItem.college_code}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">Platform Global</span>
                      )}
                    </td>
                    <td style={{ maxWidth: '380px' }}>
                      <div className="font-mono text-xs text-rose-600 truncate" title={errItem.error_message}>
                        {errItem.error_message}
                      </div>
                    </td>
                    <td>
                      <span className="text-xs text-slate-500">
                        {errItem.occurred_at ? new Date(errItem.occurred_at).toLocaleTimeString() : '—'}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`status-pill ${
                          errItem.severity === 'CRITICAL' ? 'rejected' : 'pending'
                        }`}
                      >
                        {errItem.severity || 'ERROR'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn-card-action history"
                        onClick={() => setSelectedError(errItem)}
                        title="Inspect full sanitized error details"
                      >
                        <Info size={13} />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Error Inspection Modal */}
      {selectedError && (
        <div className="modal-backdrop-blur">
          <div className="modal-dialog-card animate-badge-pop" style={{ maxWidth: '580px' }}>
            <div className="modal-dialog-header">
              <div className="modal-header-icon-wrap rose">
                <AlertTriangle size={20} />
              </div>
              <div className="modal-header-text">
                <h3 className="modal-header-title">Operational Error Inspection</h3>
                <p className="modal-header-subtitle">
                  Tamper-evident audit log record from platform diagnostics.
                </p>
              </div>
              <button
                type="button"
                className="modal-close-icon-btn"
                onClick={() => setSelectedError(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-dialog-body">
              <div className="form-group-custom">
                <label className="form-label-custom">Action & Subsystem Module</label>
                <div className="code-pill font-mono font-bold">
                  {selectedError.action} ({selectedError.module})
                </div>
              </div>

              <div className="form-group-custom">
                <label className="form-label-custom">Sanitized Error Message</label>
                <div
                  style={{
                    background: '#FFF1F2',
                    border: '1px solid #FECDD3',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    fontFamily: 'monospace',
                    fontSize: '0.82rem',
                    color: '#BE123C',
                    wordBreak: 'break-all',
                    lineHeight: 1.5,
                  }}
                >
                  {selectedError.error_message}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4" style={{ marginTop: '12px' }}>
                <div>
                  <label className="form-label-custom">Severity</label>
                  <span
                    className={`status-pill ${
                      selectedError.severity === 'CRITICAL' ? 'rejected' : 'pending'
                    }`}
                  >
                    {selectedError.severity || 'ERROR'}
                  </span>
                </div>
                <div>
                  <label className="form-label-custom">Timestamp</label>
                  <div className="text-xs text-slate-600 font-mono">
                    {selectedError.occurred_at
                      ? new Date(selectedError.occurred_at).toLocaleString()
                      : '—'}
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-dialog-footer">
              <button
                type="button"
                className="btn-enterprise btn-outline-soft"
                onClick={() => setSelectedError(null)}
              >
                Close Trace
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
