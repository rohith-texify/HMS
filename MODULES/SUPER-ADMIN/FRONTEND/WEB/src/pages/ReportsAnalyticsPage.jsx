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
      setCollegeUsage(usageRes?.data || usageRes || []);
      setModuleAdoption(adoptRes?.data || adoptRes || []);
      setLoginSecurity(secRes?.data || secRes || []);
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

  const filteredColleges = collegeUsage.filter((c) => {
    if (!searchFilter) return true;
    const term = searchFilter.toLowerCase();
    return (
      (c.college_name && c.college_name.toLowerCase().includes(term)) ||
      (c.college_code && c.college_code.toLowerCase().includes(term))
    );
  });

  return (
    <div className="page-container space-y-6">
      {/* Page Header */}
      <div className="header-container border-b border-gray-200 pb-5">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-indigo-600" />
            Platform Reports & Analytics
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
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleExportCsv}
            disabled={exporting || loading}
            className="btn btn-primary"
          >
            <Download className="w-4 h-4" />
            {exporting ? 'Generating CSV...' : 'Export Audited CSV'}
          </button>
        </div>
      </div>


      {/* Small-Count Suppression & Privacy Notice */}
      <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-lg shadow-sm flex items-start gap-3">
        <Info className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
        <div className="text-xs sm:text-sm text-amber-800">
          <span className="font-semibold">Privacy & Small-Count Suppression Active:</span>
          {' '}Cohort aggregates with counts between 1 and 4 are suppressed to protect individual user privacy (displayed as{' '}
          <span className="font-semibold underline">&lt; 5</span>). Student-level operational data (attendance, grievances, room leaves) remains strictly isolated in College Portals.
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3 text-red-700 text-sm">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Colleges */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:border-indigo-200 transition">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500">Total Institutions</span>
            <span className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Building2 className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-gray-900">
              {loading ? '...' : summary?.total_colleges ?? 0}
            </div>
            <div className="text-xs text-emerald-600 mt-1 font-medium flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" />
              {summary?.active_colleges ?? 0} active in production
            </div>
          </div>
        </div>

        {/* 30-Day Active Users */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:border-indigo-200 transition">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500">30-Day Active Users</span>
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <Users className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-gray-900">
              {loading ? (
                '...'
              ) : summary?.active_users_30d === -1 ? (
                '< 5'
              ) : (
                summary?.active_users_30d ?? 0
              )}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Exact unique auth logins in last 30d
            </div>
          </div>
        </div>

        {/* Total Platform Users */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:border-indigo-200 transition">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500">Platform Identities</span>
            <span className="p-2 bg-purple-50 text-purple-600 rounded-lg">
              <Lock className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-gray-900">
              {loading ? '...' : summary?.total_platform_users ?? 0}
            </div>
            <div className="text-xs text-gray-500 mt-1">Super Admin & Platform staff</div>
          </div>
        </div>

        {/* Catalog Modules */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:border-indigo-200 transition">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500">System Modules</span>
            <span className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <Layers className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-gray-900">
              {loading ? '...' : summary?.total_modules ?? 0}
            </div>
            <div className="text-xs text-gray-500 mt-1">Catalogue modules available</div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-200 space-x-6 text-sm font-medium">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 border-b-2 transition ${
            activeTab === 'overview'
              ? 'border-indigo-600 text-indigo-600 font-semibold'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          College Usage & Adoption
        </button>
        <button
          onClick={() => setActiveTab('modules')}
          className={`pb-3 border-b-2 transition ${
            activeTab === 'modules'
              ? 'border-indigo-600 text-indigo-600 font-semibold'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Module Adoption Rates
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`pb-3 border-b-2 transition ${
            activeTab === 'security'
              ? 'border-indigo-600 text-indigo-600 font-semibold'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Authentication Security Trends
        </button>
      </div>

      {/* Tab 1: College Usage Table */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div className="w-full sm:w-72">
              <input
                type="text"
                placeholder="Search college name or code..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <span className="text-xs font-medium text-gray-500 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Lifecycle:
              </span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="ONBOARDING">ONBOARDING</option>
                <option value="SUSPENDED">SUSPENDED</option>
                <option value="DEACTIVATED">DEACTIVATED</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                <thead className="bg-gray-50 text-gray-600 font-medium">
                  <tr>
                    <th className="px-5 py-3.5">College Identifier</th>
                    <th className="px-5 py-3.5">Lifecycle Status</th>
                    <th className="px-5 py-3.5">Active Users (30d)</th>
                    <th className="px-5 py-3.5">Campus Staff</th>
                    <th className="px-5 py-3.5">Admins</th>
                    <th className="px-5 py-3.5">Enabled Modules</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr>
                      <td colSpan="6" className="text-center py-10 text-gray-500">
                        Loading aggregate college data...
                      </td>
                    </tr>
                  ) : filteredColleges.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-10 text-gray-400">
                        No colleges found matching the selected filters.
                      </td>
                    </tr>
                  ) : (
                    filteredColleges.map((c) => {
                      const renderSuppressed = (val) => {
                        if (val === -1) {
                          return (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
                              &lt; 5
                            </span>
                          );
                        }
                        return <span className="font-semibold text-gray-900">{val ?? 0}</span>;
                      };

                      return (
                        <tr key={c.college_id} className="hover:bg-gray-50/60 transition">
                          <td className="px-5 py-4">
                            <div className="font-semibold text-gray-900">{c.college_name}</div>
                            <div className="text-xs text-gray-400 font-mono">{c.college_code}</div>
                          </td>
                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                c.status === 'ACTIVE'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : c.status === 'SUSPENDED'
                                  ? 'bg-red-50 text-red-700 border border-red-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {c.status}
                            </span>
                          </td>
                          <td className="px-5 py-4">{renderSuppressed(c.active_users_30d)}</td>
                          <td className="px-5 py-4">{renderSuppressed(c.total_staff)}</td>
                          <td className="px-5 py-4">{renderSuppressed(c.total_admins)}</td>
                          <td className="px-5 py-4">
                            <span className="font-semibold text-indigo-600">
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {loading ? (
            <div className="col-span-2 text-center py-10 text-gray-500">
              Loading module adoption figures...
            </div>
          ) : moduleAdoption.length === 0 ? (
            <div className="col-span-2 text-center py-10 text-gray-400">
              No module adoption data recorded yet.
            </div>
          ) : (
            moduleAdoption.map((m) => (
              <div
                key={m.module_id}
                className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-gray-900">{m.module_name}</h3>
                    <span className="text-xs font-mono text-gray-400">{m.module_code}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-extrabold text-indigo-600">
                      {m.adoption_pct}%
                    </span>
                    <div className="text-xs text-gray-400">Adoption Rate</div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, m.adoption_pct))}%` }}
                  ></div>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
                  <span>
                    Enabled: <strong className="text-gray-900">{m.enabled_colleges}</strong> institutions
                  </span>
                  <span>
                    Total Active Target: <strong className="text-gray-900">{m.total_colleges}</strong>
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 3: Security & Login Activity */}
      {activeTab === 'security' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <span className="text-sm font-medium text-gray-700">Time Window:</span>
            <div className="flex gap-2">
              {[7, 14, 30].map((d) => (
                <button
                  key={d}
                  onClick={() => setSecurityDays(d)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    securityDays === d
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Last {d} Days
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50 text-gray-600 font-medium">
                <tr>
                  <th className="px-5 py-3.5">Date</th>
                  <th className="px-5 py-3.5 text-emerald-600">Successful Logins</th>
                  <th className="px-5 py-3.5 text-red-600">Failed Attempts</th>
                  <th className="px-5 py-3.5 text-amber-600">Locked Events</th>
                  <th className="px-5 py-3.5 text-gray-600">Blocked Attempts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan="5" className="text-center py-10 text-gray-500">
                      Loading authentication security logs...
                    </td>
                  </tr>
                ) : loginSecurity.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-10 text-gray-400">
                      No authentication events recorded for the last {securityDays} days.
                    </td>
                  </tr>
                ) : (
                  loginSecurity.map((l) => (
                    <tr key={l.day} className="hover:bg-gray-50/60 transition">
                      <td className="px-5 py-3.5 font-medium text-gray-900">{l.day}</td>
                      <td className="px-5 py-3.5 font-semibold text-emerald-600">
                        {l.success_count}
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-red-600">
                        {l.failed_count}
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-amber-600">
                        {l.locked_count}
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-gray-600">
                        {l.blocked_count}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Blocked Features Clarification */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-500 space-y-1">
        <div className="font-semibold text-gray-700 flex items-center gap-1.5">
          <HelpCircle className="w-4 h-4 text-gray-400" />
          Infrastructure Availability Notes:
        </div>
        <div>
          • <strong>Saved Reports:</strong> Blocked — Schema change required (<code className="bg-gray-200 px-1 rounded">platform.saved_reports</code> does not exist).
        </div>
        <div>
          • <strong>Scheduled Email Reports:</strong> Blocked — Persistent task queue and cron daemon infrastructure not configured (in-memory timers forbidden by architectural constraints).
        </div>
      </div>
    </div>
  );
}
