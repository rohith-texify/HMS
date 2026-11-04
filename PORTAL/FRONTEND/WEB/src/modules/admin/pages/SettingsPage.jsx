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
  Search,
  Check,
  Copy,
  X,
} from 'lucide-react';
import {
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
  const [copiedUUID, setCopiedUUID] = useState(false);
  const [moduleSearch, setModuleSearch] = useState('');

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

  const handleCopyUUID = (uuid) => {
    if (!uuid) return;
    navigator.clipboard.writeText(uuid);
    setCopiedUUID(true);
    setTimeout(() => setCopiedUUID(false), 3000);
  };

  const filteredModules = useMemo(() => {
    if (!moduleSearch.trim()) return modules;
    const q = moduleSearch.toLowerCase();
    return modules.filter((m) =>
      (m.module_name && m.module_name.toLowerCase().includes(q)) ||
      (m.module_code && m.module_code.toLowerCase().includes(q)) ||
      (m.kind && m.kind.toLowerCase().includes(q))
    );
  }, [modules, moduleSearch]);

  if (loading && !bootstrapConfig) {
    return (
      <div className="fade-in-up" style={{ padding: '32px' }}>
        <LoadingState message="Resolving college administrative configuration..." />
      </div>
    );
  }

  return (
    <div className="fade-in-up">
      {/* Enterprise Hero Header */}
      <div className="enterprise-hero-header">
        <div className="hero-header-titles">
          <div className="hero-category-pill">
            <Sliders size={13} />
            <span>Administration &amp; Governance</span>
          </div>
          <h1 className="hero-main-title">Institution Settings &amp; College Branding</h1>
          <p className="hero-subtitle">
            Manage college tenant identity, licensed platform modules, regional timezone, and visual branding.
          </p>
        </div>

        <div className="hero-action-buttons">
          <button
            type="button"
            onClick={() => {
              setIsRefreshing(true);
              loadSettingsData();
            }}
            disabled={isRefreshing}
            className="btn-enterprise-secondary"
          >
            <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} />
            <span>{isRefreshing ? 'Syncing...' : 'Sync Data'}</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            padding: '12px 18px',
            borderRadius: '10px',
            marginBottom: '20px',
            fontSize: '13.5px',
            fontWeight: 500,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={16} style={{ color: '#ef4444' }} />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            style={{ background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top Level Summary Cards */}
      <div className="kpi-cards-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Institution Identity</span>
            <div className="stat-kpi-icon-wrap blue">
              <Building2 size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-blue-600">{tenant.college_code || 'ACET'}</div>
          <div className="stat-kpi-footnote">
            <span className="status-dot green" />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {tenant.name || 'Institution Campus'}
            </span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Tenant Status</span>
            <div className="stat-kpi-icon-wrap emerald">
              <ShieldCheck size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-emerald-600">{tenant.status || 'ACTIVE'}</div>
          <div className="stat-kpi-footnote">
            <span className="status-dot green" />
            <span>Multi-tenant partition active</span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Evaluated Timezone</span>
            <div className="stat-kpi-icon-wrap amber">
              <Globe size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-amber-600">
            {tenant.timezone ? 'IST' : 'Asia/Kolkata'}
          </div>
          <div className="stat-kpi-footnote">
            <span>{tenant.timezone || 'Asia/Kolkata (UTC+05:30)'}</span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Licensed Modules</span>
            <div className="stat-kpi-icon-wrap purple">
              <Layers size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-purple-600">{modules.length}</div>
          <div className="stat-kpi-footnote">
            <span>Authorized enterprise capabilities</span>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="staff-tabs-container" style={{ marginBottom: '20px' }}>
        <button
          type="button"
          onClick={() => setActiveTab('PROFILE')}
          className={`staff-tab-pill ${activeTab === 'PROFILE' ? 'active' : ''}`}
        >
          <Building2 size={15} />
          <span>Institution Profile</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('MODULES')}
          className={`staff-tab-pill ${activeTab === 'MODULES' ? 'active' : ''}`}
        >
          <Layers size={15} />
          <span>Licensed Modules</span>
          <span className="staff-tab-counter">{modules.length}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('BRANDING')}
          className={`staff-tab-pill ${activeTab === 'BRANDING' ? 'active' : ''}`}
        >
          <Palette size={15} />
          <span>College Branding &amp; Identity</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('PREFERENCES')}
          className={`staff-tab-pill ${activeTab === 'PREFERENCES' ? 'active' : ''}`}
        >
          <Sliders size={15} />
          <span>Operational Preferences</span>
        </button>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: INSTITUTION PROFILE                                            */}
      {/* ===================================================================== */}
      {activeTab === 'PROFILE' && (
        <div className="enterprise-card" style={{ padding: '24px' }}>
          <div className="card-topbar">
            <div className="card-title-group">
              <div className="card-title-icon-wrap">
                <Building2 size={16} />
              </div>
              <div>
                <h2 className="card-title-text" style={{ margin: 0 }}>Institutional Tenant Metadata</h2>
                <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '2px 0 0 0' }}>
                  Authoritative institution registration details evaluated from the platform tier.
                </p>
              </div>
            </div>
            <span className="badge-enterprise badge-green">
              <CheckCircle2 size={12} />
              <span>Verified Active Tenant</span>
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px', marginBottom: '24px' }}>
            <div style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '16px' }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>
                College / Institution Name
              </div>
              <div style={{ fontSize: '0.98rem', fontWeight: 700, color: '#0f172a' }}>
                {tenant.name || 'Aditya College of Engineering & Technology'}
              </div>
              <div style={{ fontSize: '0.74rem', color: '#059669', marginTop: '4px', fontWeight: 600 }}>
                Autonomous Higher Education Institution
              </div>
            </div>

            <div style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '16px' }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>
                Institutional Identifier Code
              </div>
              <div style={{ fontSize: '0.98rem', fontWeight: 700, fontFamily: 'monospace', color: '#2563eb' }}>
                {tenant.college_code || 'ACET'}
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '4px' }}>
                Unique prefix across system namespaces
              </div>
            </div>

            <div style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                  Tenant Database Partition UUID
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyUUID(tenant.college_id || user?.college_id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.72rem',
                    color: copiedUUID ? '#059669' : '#2563eb',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  {copiedUUID ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copiedUUID ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
              <div style={{ fontSize: '0.84rem', fontFamily: 'monospace', color: '#334155', wordBreak: 'break-all' }}>
                {tenant.college_id || user?.college_id || '—'}
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '4px' }}>
                Postgres RLS tenant schema boundary
              </div>
            </div>

            <div style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '16px' }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>
                Official Regional Timezone
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.98rem', fontWeight: 700, color: '#0f172a' }}>
                <Clock size={16} style={{ color: '#6366f1' }} />
                <span>{tenant.timezone || 'Asia/Kolkata (IST +05:30)'}</span>
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '4px' }}>
                Enforced for all curfew and gate logs
              </div>
            </div>
          </div>

          {/* Governance Notice Banner */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '14px',
              padding: '16px 18px',
              borderRadius: '10px',
              background: '#fffbeb',
              border: '1px solid #fde68a',
            }}
          >
            <Lock size={18} style={{ color: '#d97706', flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '0.8rem', color: '#92400e', lineHeight: 1.5 }}>
              <strong style={{ color: '#78350f' }}>Institutional Compliance Policy: </strong>
              Under institutional security compliance regulations, core organizational identifiers (College Code, Legal Name, and Database Partition)
              are managed through the Platform Super Administrator registry to ensure tamper-evident tenancy isolation.
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: LICENSED MODULES                                               */}
      {/* ===================================================================== */}
      {activeTab === 'MODULES' && (
        <div className="enterprise-card" style={{ padding: '24px' }}>
          <div className="card-topbar">
            <div className="card-title-group">
              <div className="card-title-icon-wrap">
                <Layers size={16} />
              </div>
              <div>
                <h2 className="card-title-text" style={{ margin: 0 }}>Provisioned Platform Entitlements</h2>
                <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '2px 0 0 0' }}>
                  These enterprise modules have been provisioned and authorized for this institution.
                </p>
              </div>
            </div>
            <span className="badge-enterprise badge-purple">
              {modules.length} Active Entitlements
            </span>
          </div>

          {/* Filter Bar */}
          <div className="enterprise-filter-bar" style={{ marginBottom: '16px' }}>
            <div className="filter-search-field" style={{ flex: '1 1 280px', maxWidth: '380px' }}>
              <Search size={14} className="filter-search-icon" />
              <input
                type="text"
                className="filter-search-input"
                placeholder="Search modules by name or code..."
                value={moduleSearch}
                onChange={(e) => setModuleSearch(e.target.value)}
              />
              {moduleSearch && (
                <button
                  type="button"
                  onClick={() => setModuleSearch('')}
                  style={{ position: 'absolute', right: '8px', border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer' }}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {filteredModules.length === 0 ? (
            <EmptyState
              icon={Layers}
              title="No Modules Found"
              message="No licensed modules match your search filter."
            />
          ) : (
            <div className="enterprise-table-container">
              <table className="enterprise-table">
                <thead>
                  <tr>
                    <th>Module Name</th>
                    <th>Module Code</th>
                    <th>Category</th>
                    <th>Operational Mode</th>
                    <th>Status</th>
                    <th>Effective Since</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredModules.map((row, idx) => (
                    <tr key={row.module_code || idx}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                          <Layers size={14} style={{ color: '#6366f1' }} />
                          <span>{row.module_name || row.module_code}</span>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.76rem', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', color: '#475569' }}>
                          {row.module_code}
                        </span>
                      </td>
                      <td>
                        <span className="badge-enterprise badge-blue">
                          {row.kind || 'APP'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#4f46e5' }}>
                          {row.mode || 'STANDARD'}
                        </span>
                      </td>
                      <td>
                        <span className="badge-enterprise badge-green">
                          <CheckCircle2 size={12} />
                          <span>{row.status || 'ACTIVE'}</span>
                        </span>
                      </td>
                      <td style={{ color: '#64748b', fontSize: '0.78rem' }}>
                        {row.effective_from ? new Date(row.effective_from).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: COLLEGE BRANDING & IDENTITY                                    */}
      {/* ===================================================================== */}
      {activeTab === 'BRANDING' && (
        <div className="enterprise-card" style={{ padding: '24px' }}>
          <div className="card-topbar">
            <div className="card-title-group">
              <div className="card-title-icon-wrap">
                <Palette size={16} />
              </div>
              <div>
                <h2 className="card-title-text" style={{ margin: 0 }}>Visual Identity &amp; College Branding</h2>
                <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '2px 0 0 0' }}>
                  Assets displayed across resident mobile apps, security checkpoint interfaces, and official notices.
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px', marginBottom: '24px' }}>
            {/* Logo Badge Preview Card */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                gap: '16px',
              }}
            >
              <div
                style={{
                  width: '76px',
                  height: '76px',
                  borderRadius: '18px',
                  background: 'linear-gradient(135deg, #4f46e5 0%, #2563eb 100%)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 8px 20px rgba(37, 99, 235, 0.25)',
                }}
              >
                <Building2 size={38} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: '0 0 4px 0' }}>
                  {tenant.name || 'Aditya College of Engineering & Technology'}
                </h3>
                <span style={{ fontSize: '0.78rem', fontFamily: 'monospace', color: '#4f46e5', fontWeight: 600 }}>
                  Institutional Portal — {tenant.college_code || 'ACET'}
                </span>
              </div>
              <span className="badge-enterprise badge-green">
                <CheckCircle2 size={12} />
                <span>Official Crest Verified</span>
              </span>
            </div>

            {/* Portal Theme Palette Card */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.92rem', fontWeight: 700, color: '#0f172a' }}>
                <Palette size={16} style={{ color: '#4f46e5' }} />
                <span>Active Theme &amp; Color Palette</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Primary Brand Accent:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'monospace', fontWeight: 600 }}>
                    <span style={{ width: '16px', height: '16px', borderRadius: '4px', background: '#2563eb', display: 'inline-block' }} />
                    <span>#2563EB (Royal Blue)</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Success Indicator:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'monospace', fontWeight: 600 }}>
                    <span style={{ width: '16px', height: '16px', borderRadius: '4px', background: '#059669', display: 'inline-block' }} />
                    <span>#059669 (Emerald 600)</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Warning &amp; Urgent Flag:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'monospace', fontWeight: 600 }}>
                    <span style={{ width: '16px', height: '16px', borderRadius: '4px', background: '#e11d48', display: 'inline-block' }} />
                    <span>#E11D48 (Rose 600)</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Interface Layout Mode:</span>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>
                    Unified Institutional Portal
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Read-Only Asset Notice */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              padding: '14px 16px',
              borderRadius: '10px',
              background: '#f8fafc',
              border: '1px solid var(--border-color)',
            }}
          >
            <Info size={16} style={{ color: '#64748b', flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '0.78rem', color: '#64748b', lineHeight: 1.5 }}>
              Branding logos and high-resolution vector emblems are provisioned during institutional onboarding.
              To request a logo asset refresh or theme customization, submit a platform change ticket to your Super Administrator.
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: OPERATIONAL PREFERENCES                                        */}
      {/* ===================================================================== */}
      {activeTab === 'PREFERENCES' && (
        <div className="enterprise-card" style={{ padding: '24px' }}>
          <div className="card-topbar">
            <div className="card-title-group">
              <div className="card-title-icon-wrap">
                <Sliders size={16} />
              </div>
              <div>
                <h2 className="card-title-text" style={{ margin: 0 }}>Campus Operating Parameters &amp; Thresholds</h2>
                <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '2px 0 0 0' }}>
                  Non-sensitive runtime settings evaluated for daily residential operations.
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0f172a' }}>
                  Nightly Curfew Attendance Deadline
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                  Standard roll-call closing time enforced at hostel entry gates.
                </div>
              </div>
              <span style={{ fontFamily: 'monospace', fontSize: '0.88rem', fontWeight: 700, color: '#2563eb', background: '#ffffff', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                {safeSettings.curfew_hour || '21:30 (09:30 PM)'}
              </span>
            </div>

            <div
              style={{
                background: '#f8fafc',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0f172a' }}>
                  Emergency SOS Alert Propagation
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                  Direct mobile push notification to active wardens and security personnel.
                </div>
              </div>
              <span className="badge-enterprise badge-green" style={{ fontSize: '0.78rem', padding: '5px 10px' }}>
                <CheckCircle2 size={13} />
                <span>ENABLED (24/7)</span>
              </span>
            </div>

            <div
              style={{
                background: '#f8fafc',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0f172a' }}>
                  Dining Hall Mess Feedback Window
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                  Timeframe during which resident students can rate meals after service.
                </div>
              </div>
              <span style={{ fontFamily: 'monospace', fontSize: '0.88rem', fontWeight: 700, color: '#334155', background: '#ffffff', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                120 Minutes Post-Service
              </span>
            </div>

            <div
              style={{
                background: '#f8fafc',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0f172a' }}>
                  Student Movement Checkout Grace Window
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                  Allowed buffer timeframe before automatic curfew notification triggers.
                </div>
              </div>
              <span style={{ fontFamily: 'monospace', fontSize: '0.88rem', fontWeight: 700, color: '#334155', background: '#ffffff', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                30 Minutes Grace
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
