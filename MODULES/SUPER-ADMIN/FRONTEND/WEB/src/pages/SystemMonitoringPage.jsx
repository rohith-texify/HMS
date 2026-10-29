import React, { useState, useEffect } from 'react';
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
  CheckCircle,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { fetchMonitoringMetrics } from '../services/operationsService';

export default function SystemMonitoringPage() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchMonitoringMetrics();
      setMetrics(res?.data || null);
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

  const serviceHealth = metrics?.service_health;
  const dbStats = metrics?.database_stats;
  const tenantStats = metrics?.tenant_stats;
  const recentErrors = metrics?.recent_system_errors || [];
  const telemetry = metrics?.telemetry_signals;

  return (
    <div className="page-container">
      {/* Header */}
      <div className="header-container">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>📈</span>
            <span>System Monitoring & Telemetry</span>
          </h1>
          <p className="page-subtitle">
            Real-time platform service health, PostgreSQL pool status, and sanitized operational error tracking.
          </p>
        </div>
        <div className="quick-actions">
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-secondary)', cursor: 'pointer', backgroundColor: '#ffffff', padding: '6px 12px', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh (15s)
          </label>
          <button
            onClick={() => loadMetrics()}
            disabled={loading}
            className="btn btn-primary"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="alert-banner error">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertOctagon size={18} />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Primary Health Banners */}
      <div className="stat-grid-4">
        {/* Overall Status */}
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-title">Platform Status</span>
            <span
              className={`badge ${
                serviceHealth?.overall_status === 'HEALTHY'
                  ? 'badge-success'
                  : serviceHealth?.overall_status === 'DEGRADED'
                  ? 'badge-warning'
                  : 'badge-danger'
              }`}
            >
              {serviceHealth?.overall_status || 'UNKNOWN'}
            </span>
          </div>
          <div className="stat-card-value">
            {serviceHealth?.overall_status === 'HEALTHY' ? 'All Systems Nominal' : serviceHealth?.overall_status || 'UNKNOWN'}
          </div>
          <div className="stat-card-subtitle">Active multi-tenant routing</div>
        </div>

        {/* Database Total Connections */}
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-title">DB Total Pool</span>
            <span className="badge badge-info">PostgreSQL</span>
          </div>
          <div className="stat-card-value">
            {(dbStats?.platform_pool_total_conns || 0) + (dbStats?.college_pool_total_conns || 0)} conns
          </div>
          <div className="stat-card-subtitle">
            Platform: {dbStats?.platform_pool_total_conns || 0} | College: {dbStats?.college_pool_total_conns || 0}
          </div>
        </div>

        {/* Active Tenants */}
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-title">Tenant Instances</span>
            <span className="badge badge-success">RLS Isolated</span>
          </div>
          <div className="stat-card-value">
            {tenantStats?.active || 0} / {tenantStats?.total_colleges || 0}
          </div>
          <div className="stat-card-subtitle">
            Onboarding: {tenantStats?.onboarding || 0} | Suspended: {tenantStats?.suspended || 0}
          </div>
        </div>

        {/* Auth Telemetry */}
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-title">Auth Control Plane</span>
            <span className="badge badge-success">Operational</span>
          </div>
          <div className="stat-card-value">
            {telemetry?.auth_service_status || 'OPERATIONAL'}
          </div>
          <div className="stat-card-subtitle">Stateless JWT + DB Audit</div>
        </div>
      </div>

      {/* Probes & Integrations Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        {/* Service Probes */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <span>⚡</span>
              <span>Service Health Probes</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {serviceHealth?.checks?.map((probe, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 14px',
                  backgroundColor: 'var(--bg-primary)',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem', textTransform: 'capitalize' }}>
                    {probe.service_name.replace(/_/g, ' ')}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {probe.message}
                  </div>
                </div>
                <span
                  className={`badge ${
                    probe.status === 'HEALTHY'
                      ? 'badge-success'
                      : probe.status === 'DEGRADED'
                      ? 'badge-warning'
                      : 'badge-muted'
                  }`}
                >
                  {probe.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Telemetry & Infrastructure Architecture Signals */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <span>🖥️</span>
              <span>Infrastructure Telemetry Signals</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', backgroundColor: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>PostgreSQL Platform Pool</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Control-plane metadata & audit connection pool</div>
              </div>
              <div style={{ textAlign: 'right', fontSize: '0.85rem' }}>
                <strong>{dbStats?.platform_pool_idle_conns || 0} idle</strong> / {dbStats?.platform_pool_acquired_conns || 0} active
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', backgroundColor: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>PostgreSQL College Pool</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Tenant operational data pool (RLS scoped)</div>
              </div>
              <div style={{ textAlign: 'right', fontSize: '0.85rem' }}>
                <strong>{dbStats?.college_pool_idle_conns || 0} idle</strong> / {dbStats?.college_pool_acquired_conns || 0} active
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', backgroundColor: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Persistent Job Scheduler</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Background cron/queue provider</div>
              </div>
              <span className="badge badge-muted">
                {telemetry?.background_scheduler_status || 'NOT_CONFIGURED'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', backgroundColor: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Outbound Notification Gateway</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>SMTP/SMS/Push delivery provider</div>
              </div>
              <span className="badge badge-muted">
                {telemetry?.notification_provider_status || 'NOT_CONFIGURED'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Operational Error Stream */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc' }}>
          <div style={{ fontWeight: 600, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>⚠️</span>
            <span>Recent Operational Errors (Sanitized Audit Log Stream)</span>
          </div>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Last 15 failures</span>
        </div>
        {recentErrors.length === 0 ? (
          <div className="empty-box" style={{ border: 'none', padding: '36px' }}>
            <div className="empty-text">✓ No operational error records found in recent audit events.</div>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Action & Module</th>
                  <th>College Tenant</th>
                  <th>Sanitized Error Message</th>
                  <th>Occurred At</th>
                  <th style={{ textAlign: 'right' }}>Severity</th>
                </tr>
              </thead>
              <tbody>
                {recentErrors.map((err) => (
                  <tr key={err.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{err.action}</div>
                      <span className="badge badge-muted" style={{ fontSize: '0.72rem', marginTop: '2px' }}>{err.module}</span>
                    </td>
                    <td>
                      {err.college_code ? (
                        <span className="badge badge-info">{err.college_code}</span>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>Platform Wide</span>
                      )}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#b91c1c' }}>
                      {err.error_message}
                    </td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      {new Date(err.occurred_at).toLocaleTimeString()}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className={`badge ${err.severity === 'CRITICAL' ? 'badge-danger' : 'badge-warning'}`}>
                        {err.severity}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
