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
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="w-7 h-7 text-indigo-600" />
            System Monitoring & Telemetry
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Real-time platform service health, PostgreSQL pool status, and sanitized operational error tracking.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-medium text-gray-600 cursor-pointer bg-white px-3 py-2 border border-gray-300 rounded-lg shadow-sm">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded text-indigo-600"
            />
            Auto-refresh (15s)
          </label>
          <button
            onClick={() => loadMetrics()}
            disabled={loading}
            className="flex items-center gap-1.5 p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium shadow-sm transition-colors text-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg flex items-center gap-2">
          <AlertOctagon className="w-5 h-5 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Primary Health Banners */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Overall Status */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div
            className={`p-3 rounded-xl ${
              serviceHealth?.overall_status === 'HEALTHY'
                ? 'bg-green-100 text-green-700'
                : serviceHealth?.overall_status === 'DEGRADED'
                ? 'bg-amber-100 text-amber-700'
                : 'bg-red-100 text-red-700'
            }`}
          >
            {serviceHealth?.overall_status === 'HEALTHY' && <CheckCircle className="w-6 h-6" />}
            {serviceHealth?.overall_status === 'DEGRADED' && <AlertTriangle className="w-6 h-6" />}
            {serviceHealth?.overall_status !== 'HEALTHY' && serviceHealth?.overall_status !== 'DEGRADED' && (
              <XCircle className="w-6 h-6" />
            )}
          </div>
          <div>
            <div className="text-xs text-gray-500 font-medium">Platform Status</div>
            <div className="text-xl font-bold text-gray-900 mt-0.5">
              {serviceHealth?.overall_status || 'UNKNOWN'}
            </div>
          </div>
        </div>

        {/* Database Total Connections */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-100 text-indigo-700 rounded-xl">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-gray-500 font-medium">DB Total Connections</div>
            <div className="text-xl font-bold text-gray-900 mt-0.5">
              {(dbStats?.platform_pool_total_conns || 0) + (dbStats?.college_pool_total_conns || 0)}
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5">
              Platform: {dbStats?.platform_pool_total_conns || 0} | College: {dbStats?.college_pool_total_conns || 0}
            </div>
          </div>
        </div>

        {/* Active Tenants */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-100 text-blue-700 rounded-xl">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-gray-500 font-medium">Active Tenants</div>
            <div className="text-xl font-bold text-gray-900 mt-0.5">
              {tenantStats?.active || 0} / {tenantStats?.total_colleges || 0}
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5">
              Onboarding: {tenantStats?.onboarding || 0} | Suspended: {tenantStats?.suspended || 0}
            </div>
          </div>
        </div>

        {/* Auth Telemetry */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-purple-100 text-purple-700 rounded-xl">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-gray-500 font-medium">Auth Service</div>
            <div className="text-xl font-bold text-gray-900 mt-0.5">
              {telemetry?.auth_service_status || 'OPERATIONAL'}
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5">Stateless JWT + DB Audit</div>
          </div>
        </div>
      </div>

      {/* Probes & Integrations Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Service Probes */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Server className="w-5 h-5 text-indigo-600" />
            Service Health Probes
          </h2>
          <div className="space-y-3">
            {serviceHealth?.checks?.map((probe, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl border border-gray-100 bg-gray-50 flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold text-sm text-gray-800 capitalize">
                    {probe.service_name.replace(/_/g, ' ')}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">{probe.message}</div>
                </div>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    probe.status === 'HEALTHY'
                      ? 'bg-green-100 text-green-800'
                      : probe.status === 'DEGRADED'
                      ? 'bg-amber-100 text-amber-800'
                      : probe.status === 'NOT_CONFIGURED'
                      ? 'bg-gray-200 text-gray-700'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {probe.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Telemetry & Infrastructure Architecture Signals */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-indigo-600" />
            Infrastructure Telemetry Signals
          </h2>
          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-xl border border-gray-100 bg-gray-50 flex justify-between items-center">
              <div>
                <span className="font-semibold text-gray-800">PostgreSQL Platform Pool</span>
                <p className="text-gray-500 mt-0.5">Control-plane metadata & audit connection pool</p>
              </div>
              <div className="text-right">
                <span className="font-bold text-gray-900">{dbStats?.platform_pool_idle_conns || 0} idle</span> /{' '}
                <span>{dbStats?.platform_pool_acquired_conns || 0} active</span>
              </div>
            </div>

            <div className="p-3 rounded-xl border border-gray-100 bg-gray-50 flex justify-between items-center">
              <div>
                <span className="font-semibold text-gray-800">PostgreSQL College Pool</span>
                <p className="text-gray-500 mt-0.5">Tenant operational data pool (RLS scoped)</p>
              </div>
              <div className="text-right">
                <span className="font-bold text-gray-900">{dbStats?.college_pool_idle_conns || 0} idle</span> /{' '}
                <span>{dbStats?.college_pool_acquired_conns || 0} active</span>
              </div>
            </div>

            <div className="p-3 rounded-xl border border-gray-100 bg-gray-50 flex justify-between items-center">
              <div>
                <span className="font-semibold text-gray-800">Persistent Job Scheduler</span>
                <p className="text-gray-500 mt-0.5">Background cron/queue provider</p>
              </div>
              <span className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded font-semibold">
                {telemetry?.background_scheduler_status || 'NOT_CONFIGURED'}
              </span>
            </div>

            <div className="p-3 rounded-xl border border-gray-100 bg-gray-50 flex justify-between items-center">
              <div>
                <span className="font-semibold text-gray-800">Outbound Notification Gateway</span>
                <p className="text-gray-500 mt-0.5">SMTP/SMS/Push delivery provider</p>
              </div>
              <span className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded font-semibold">
                {telemetry?.notification_provider_status || 'NOT_CONFIGURED'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Operational Error Stream */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <AlertOctagon className="w-4 h-4 text-amber-600" />
            Recent Operational Errors (Sanitized Audit Log Stream)
          </h2>
          <span className="text-xs text-gray-500">Last 15 failures</span>
        </div>
        {recentErrors.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            No operational error records found in recent audit events.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {recentErrors.map((err) => (
              <div key={err.id} className="p-4 hover:bg-gray-50 transition-colors flex items-start justify-between gap-4 text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{err.action}</span>
                    <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[11px]">{err.module}</span>
                    {err.college_code && (
                      <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[11px] font-medium">
                        {err.college_code}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-600 mt-1 font-mono text-[11px]">{err.error_message}</p>
                </div>
                <div className="text-right text-gray-400 whitespace-nowrap">
                  <div className="flex items-center gap-1 justify-end">
                    <Clock className="w-3 h-3" />
                    {new Date(err.occurred_at).toLocaleTimeString()}
                  </div>
                  <span className="text-[10px] text-red-600 font-bold">{err.severity}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
