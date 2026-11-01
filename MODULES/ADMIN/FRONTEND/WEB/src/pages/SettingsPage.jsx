import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../../shared/auth/useAuth';
import adminService from '../services/adminService';
import {
  Sliders,
  Building2,
  ShieldCheck,
  Globe,
  Clock,
  Layers,
  Palette,
  CheckCircle2,
  AlertTriangle,
  Info,
  RefreshCw,
  Lock,
  ExternalLink,
  ChevronRight,
  Sparkles,
  FileCode,
  Tag,
  Key,
} from 'lucide-react';
import {
  PageHeader,
  DataTable,
  LoadingState,
  EmptyState,
} from '../../../shared/components';

export default function AdminSettingsPage() {
  const { user } = useAuth();

  // Master Data State
  const [bootstrapConfig, setBootstrapConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [activeTab, setActiveTab] = useState('PROFILE'); // 'PROFILE' | 'MODULES' | 'BRANDING' | 'PREFERENCES'

  // Load College Bootstrap Data (Tenant Metadata, Modules, Settings)
  const loadSettingsData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage(null);

      const res = await adminService.getCollegeBootstrap();
      setBootstrapConfig(res?.data || res);
    } catch (err) {
      console.error('Failed to load institution settings:', err);
      setErrorMessage(err?.response?.data?.error?.message || err.message || 'Unable to retrieve college settings.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadSettingsData();
  }, [loadSettingsData]);

  const tenant = bootstrapConfig?.tenant || {};
  const modules = bootstrapConfig?.enabled_modules || [];
  const safeSettings = bootstrapConfig?.settings || {};

  // Columns for Enabled Modules Table
  const moduleColumns = [
    {
      key: 'module_name',
      title: 'Module Name',
      render: (row) => (
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-500" />
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            {row.module_name || row.module_code}
          </span>
        </div>
      ),
    },
    {
      key: 'module_code',
      title: 'Module Code',
      render: (row) => (
        <span className="font-mono text-xs text-slate-500 uppercase bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
          {row.module_code}
        </span>
      ),
    },
    {
      key: 'kind',
      title: 'Category',
      render: (row) => (
        <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
          {row.kind || 'APP'}
        </span>
      ),
    },
    {
      key: 'mode',
      title: 'Operational Mode',
      render: (row) => (
        <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
          {row.mode || 'STANDARD'}
        </span>
      ),
    },
    {
      key: 'status',
      title: 'Status',
      render: (row) => (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${
            row.status === 'ACTIVE'
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
          }`}
        >
          <CheckCircle2 className="w-3 h-3" />
          {row.status || 'ACTIVE'}
        </span>
      ),
    },
    {
      key: 'effective_from',
      title: 'Effective Since',
      render: (row) => (
        <span className="text-xs text-slate-500">
          {row.effective_from ? new Date(row.effective_from).toLocaleDateString() : '—'}
        </span>
      ),
    },
  ];

  if (loading && !bootstrapConfig) {
    return <LoadingState message="Resolving college administrative configuration..." />;
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <PageHeader
        title="Institution Settings & College Branding"
        subtitle="Manage college tenant identity, licensed platform modules, regional timezone, and visual branding."
        icon={Sliders}
        actions={
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setIsRefreshing(true);
                loadSettingsData();
              }}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-750 transition"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        }
      />

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg flex items-center justify-between text-rose-800 dark:bg-rose-950 dark:border-rose-800 dark:text-rose-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
            <span className="text-sm font-medium">{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-xs font-semibold uppercase hover:underline ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top Level Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-lg">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-lg font-bold text-slate-900 dark:text-white truncate max-w-[180px]">
              {tenant.name || 'Institution'}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              Code: {tenant.college_code || '—'}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-lg">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-lg font-bold text-slate-900 dark:text-white">
              {tenant.status || 'ACTIVE'}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Institution Tenant Status
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 rounded-lg">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <div className="text-lg font-bold text-slate-900 dark:text-white">
              {tenant.timezone || 'Asia/Kolkata'}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Evaluated Timezone
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 rounded-lg">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {modules.length}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Licensed Modules
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-700 gap-4">
        <button
          onClick={() => setActiveTab('PROFILE')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'PROFILE'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Institution Profile
        </button>

        <button
          onClick={() => setActiveTab('MODULES')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'MODULES'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Layers className="w-4 h-4" />
          Licensed Modules
          <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
            {modules.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('BRANDING')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'BRANDING'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Palette className="w-4 h-4" />
          College Branding & Identity
        </button>

        <button
          onClick={() => setActiveTab('PREFERENCES')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'PREFERENCES'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Sliders className="w-4 h-4" />
          Operational Preferences
        </button>
      </div>

      {/* TAB 1: INSTITUTION PROFILE */}
      {activeTab === 'PROFILE' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-700">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Institutional Tenant Metadata
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Authoritative institution registration details evaluated from the platform tier.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Verified Tenant
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                College / Institution Name
              </label>
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 p-3 bg-slate-50 dark:bg-slate-850 rounded-lg border border-slate-200 dark:border-slate-700">
                {tenant.name || 'Aditya College of Engineering & Technology'}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Institutional Identifier Code
              </label>
              <div className="text-sm font-mono font-semibold text-slate-900 dark:text-slate-100 p-3 bg-slate-50 dark:bg-slate-850 rounded-lg border border-slate-200 dark:border-slate-700">
                {tenant.college_code || 'ACET'}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Tenant Database UUID
              </label>
              <div className="text-xs font-mono text-slate-600 dark:text-slate-400 p-3 bg-slate-50 dark:bg-slate-850 rounded-lg border border-slate-200 dark:border-slate-700 truncate">
                {tenant.college_id || user?.college_id || '—'}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Official Timezone
              </label>
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 p-3 bg-slate-50 dark:bg-slate-850 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-500" />
                <span>{tenant.timezone || 'Asia/Kolkata (IST +05:30)'}</span>
              </div>
            </div>
          </div>

          {/* Governance Notice */}
          <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl flex items-start gap-3 text-amber-900 dark:text-amber-200">
            <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed text-amber-800 dark:text-amber-300">
              <span className="font-semibold text-amber-900 dark:text-amber-100">
                Compliance Policy:{' '}
              </span>
              Under institutional security compliance regulations, core organizational identifiers
              (College Code, Legal Name, and Database Partition) are managed through the Platform
              Super Administrator registry to ensure tamper-evident tenancy isolation.
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LICENSED MODULES */}
      {activeTab === 'MODULES' && (
        <div className="space-y-4">
          <div className="p-4 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900 rounded-xl flex items-start gap-3">
            <Info className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-700 dark:text-slate-300">
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                Active Entitlements:{' '}
              </span>
              These modules have been provisioned and authorized for this institution. Permissions and access
              control policies are verified against these active modules at each API gateway boundary.
            </div>
          </div>

          <DataTable
            columns={moduleColumns}
            data={modules}
            emptyMessage={
              <EmptyState
                icon={Layers}
                title="No Modules Retrieved"
                message="No active module entitlements found in the bootstrap response."
              />
            }
          />
        </div>
      )}

      {/* TAB 3: COLLEGE BRANDING & IDENTITY */}
      {activeTab === 'BRANDING' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">
              Visual Identity & College Branding
            </h3>
            <p className="text-xs text-slate-500">
              Assets displayed across resident mobile apps, security checkpoint interfaces, and official notices.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* Logo Badge Preview Card */}
            <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-800 text-white flex items-center justify-center shadow-md">
                <Building2 className="w-10 h-10" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                  {tenant.name || 'Aditya College of Engineering & Technology'}
                </h4>
                <span className="font-mono text-xs text-indigo-600 dark:text-indigo-400 font-semibold">
                  Institutional Portal — {tenant.college_code || 'ACET'}
                </span>
              </div>
              <span className="px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                Official Crest Verified
              </span>
            </div>

            {/* Portal Theme Palette Card */}
            <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 space-y-4">
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Palette className="w-4 h-4 text-indigo-600" />
                Active Theme & Color Palette
              </h4>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Primary Brand Accent:</span>
                  <div className="flex items-center gap-2 font-mono font-medium">
                    <span className="w-4 h-4 rounded bg-indigo-600 inline-block" />
                    #4F46E5 (Indigo 600)
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Success Indicator:</span>
                  <div className="flex items-center gap-2 font-mono font-medium">
                    <span className="w-4 h-4 rounded bg-emerald-600 inline-block" />
                    #059669 (Emerald 600)
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Warning & Urgent Flag:</span>
                  <div className="flex items-center gap-2 font-mono font-medium">
                    <span className="w-4 h-4 rounded bg-rose-600 inline-block" />
                    #E11D48 (Rose 600)
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Interface Layout Mode:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    Unified Institutional Portal
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Read-Only Notice */}
          <div className="p-4 bg-slate-100 dark:bg-slate-750 rounded-xl text-xs text-slate-600 dark:text-slate-400 flex items-start gap-3">
            <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
            <span>
              Branding logos and high-resolution svg emblems are provisioned during institutional onboarding.
              To request a logo asset refresh or color customisation, submit a platform change ticket to your Super Administrator.
            </span>
          </div>
        </div>
      )}

      {/* TAB 4: OPERATIONAL PREFERENCES */}
      {activeTab === 'PREFERENCES' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">
              Campus Operating Parameters & Thresholds
            </h3>
            <p className="text-xs text-slate-500">
              Non-sensitive runtime settings evaluated for daily residential operations.
            </p>
          </div>

          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                <div className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                  Nightly Curfew Attendance Deadline
                </div>
                <div className="text-xs text-slate-500">
                  Standard roll-call closing time enforced at hostel entry gates.
                </div>
              </div>
              <span className="font-mono text-sm font-bold text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                {safeSettings.curfew_hour || '21:30 (09:30 PM)'}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                <div className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                  Emergency SOS Alert Propagation
                </div>
                <div className="text-xs text-slate-500">
                  Direct mobile push notification to active wardens and security personnel.
                </div>
              </div>
              <span className="px-2.5 py-1 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                ENABLED (24/7)
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                <div className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                  Dining Hall Mess Feedback Window
                </div>
                <div className="text-xs text-slate-500">
                  Timeframe during which resident students can rate meals after service.
                </div>
              </div>
              <span className="font-mono text-sm font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                120 Minutes Post-Service
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
