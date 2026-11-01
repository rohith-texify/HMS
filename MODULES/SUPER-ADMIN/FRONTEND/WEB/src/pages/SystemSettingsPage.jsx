import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Sliders,
  ShieldCheck,
  AlertTriangle,
  Building2,
  History,
  Search,
  X,
  RotateCw,
  ChevronRight,
  CheckCircle2,
  Lock,
  Unlock,
  Sparkles,
  Copy,
  Check,
  FileCode,
  RefreshCcw,
  Clock,
  ShieldAlert,
  Layers,
  ExternalLink,
  Info,
  AlertCircle,
} from 'lucide-react';
import {
  fetchSystemSettings,
  updateSystemSetting,
  resetSystemSetting,
  revertSystemSetting,
  fetchSystemSettingsHistory,
  fetchTenantInheritanceOverview,
  DEFAULT_SYSTEM_SETTINGS,
} from '../services/systemSettingsService';

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

// Case-tolerant normalizers
const getSettingKey = (s) => s?.setting_key || s?.key || '';
const getDisplayName = (s) => {
  if (s?.display_name) return s.display_name;
  if (s?.name) return s.name;
  const raw = getSettingKey(s);
  return raw
    .replace(/^[a-z_]+\./, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
};
const getCategory = (s) => (s?.category || 'system').toLowerCase();
const getSettingValue = (s) => s?.setting_value ?? s?.value ?? {};
const getAllowOverride = (s) => !!(s?.allow_override ?? s?.allow_tenant_override ?? true);

export default function SystemSettingsPage() {
  // Navigation tabs: 'security' | 'system' | 'maintenance' | 'inheritance' | 'history'
  const [activeTab, setActiveTab] = useState('security');
  const [settings, setSettings] = useState(DEFAULT_SYSTEM_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [overrideFilter, setOverrideFilter] = useState('ALL'); // 'ALL' | 'PERMITTED' | 'LOCKED'

  // Edit Modal State
  const [editModal, setEditModal] = useState({
    isOpen: false,
    setting: null,
    jsonString: '',
    reason: '',
    submitting: false,
    error: null,
  });

  // Reset Modal State (Replaces window.confirm/prompt)
  const [resetModal, setResetModal] = useState({
    isOpen: false,
    setting: null,
    reason: 'Reset to company platform default baseline',
    submitting: false,
    error: null,
  });

  // Rollback Modal State (Replaces window.confirm/prompt)
  const [rollbackModal, setRollbackModal] = useState({
    isOpen: false,
    historyItem: null,
    reason: 'Reverting to stable previous version',
    submitting: false,
    error: null,
  });

  // History State
  const [historyList, setHistoryList] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyKeyFilter, setHistoryKeyFilter] = useState('');

  // Inheritance Overview State
  const [inheritanceList, setInheritanceList] = useState([]);
  const [inheritanceLoading, setInheritanceLoading] = useState(false);

  // Copied Key Feedback
  const [copiedKey, setCopiedKey] = useState(null);

  // Load Settings
  const loadSettings = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      setIsRefreshing(true);
      setError(null);
      const res = await fetchSystemSettings();
      setSettings(res.settings || DEFAULT_SYSTEM_SETTINGS);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to load system settings');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Load History
  const loadHistory = useCallback(async (key = '') => {
    try {
      setHistoryLoading(true);
      const res = await fetchSystemSettingsHistory(key);
      setHistoryList(res.history || []);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  // Load Tenant Inheritance Overview
  const loadInheritance = useCallback(async () => {
    try {
      setInheritanceLoading(true);
      const res = await fetchTenantInheritanceOverview();
      setInheritanceList(res.inheritance || []);
    } catch (err) {
      console.error('Failed to load inheritance overview:', err);
    } finally {
      setInheritanceLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory(historyKeyFilter);
    } else if (activeTab === 'inheritance') {
      loadInheritance();
    }
  }, [activeTab, historyKeyFilter, loadHistory, loadInheritance]);

  // Open Edit Modal
  const openEditModal = (st) => {
    setEditModal({
      isOpen: true,
      setting: st,
      jsonString: JSON.stringify(getSettingValue(st), null, 2),
      reason: '',
      submitting: false,
      error: null,
    });
  };

  // Prettify JSON in Edit Modal
  const handlePrettifyJson = () => {
    try {
      const parsed = JSON.parse(editModal.jsonString);
      setEditModal((prev) => ({
        ...prev,
        jsonString: JSON.stringify(parsed, null, 2),
        error: null,
      }));
    } catch (err) {
      setEditModal((prev) => ({
        ...prev,
        error: 'Cannot format: Invalid JSON syntax (' + err.message + ')',
      }));
    }
  };

  // Submit Edit
  const handleSaveSetting = async (e) => {
    e.preventDefault();
    if (!editModal.setting) return;

    let parsedValue;
    try {
      parsedValue = JSON.parse(editModal.jsonString);
    } catch (err) {
      setEditModal((prev) => ({
        ...prev,
        error: 'Invalid JSON format: ' + err.message,
      }));
      return;
    }

    if (!editModal.reason.trim() || editModal.reason.trim().length < 3) {
      setEditModal((prev) => ({
        ...prev,
        error: 'An authoritative change justification is required (minimum 3 characters).',
      }));
      return;
    }

    setEditModal((prev) => ({ ...prev, submitting: true, error: null }));

    try {
      const key = getSettingKey(editModal.setting);
      await updateSystemSetting(key, {
        setting_value: parsedValue,
        reason: editModal.reason.trim(),
      });

      setFeedback({
        type: 'success',
        text: `Policy "${getDisplayName(editModal.setting)}" updated successfully.`,
      });
      setTimeout(() => setFeedback(null), 6000);
      setEditModal({ isOpen: false, setting: null, jsonString: '', reason: '', submitting: false, error: null });
      await loadSettings(true);
    } catch (err) {
      setEditModal((prev) => ({
        ...prev,
        submitting: false,
        error: err.response?.data?.error?.message || err.message || 'Failed to update setting',
      }));
    }
  };

  // Submit Factory Reset
  const handleConfirmReset = async (e) => {
    e.preventDefault();
    if (!resetModal.setting) return;

    setResetModal((prev) => ({ ...prev, submitting: true, error: null }));
    try {
      const key = getSettingKey(resetModal.setting);
      await resetSystemSetting(key, resetModal.reason.trim());
      setFeedback({
        type: 'success',
        text: `Setting "${getDisplayName(resetModal.setting)}" reset to company factory baseline.`,
      });
      setTimeout(() => setFeedback(null), 6000);
      setResetModal({ isOpen: false, setting: null, reason: '', submitting: false, error: null });
      await loadSettings(true);
    } catch (err) {
      setResetModal((prev) => ({
        ...prev,
        submitting: false,
        error: err.response?.data?.error?.message || err.message || 'Failed to reset setting',
      }));
    }
  };

  // Submit Rollback
  const handleConfirmRollback = async (e) => {
    e.preventDefault();
    if (!rollbackModal.historyItem) return;

    setRollbackModal((prev) => ({ ...prev, submitting: true, error: null }));
    try {
      const h = rollbackModal.historyItem;
      await revertSystemSetting(h.setting_key, h.history_id, rollbackModal.reason.trim());
      setFeedback({
        type: 'success',
        text: `Successfully rolled back policy "${h.setting_key}" to version from ${new Date(h.created_at).toLocaleDateString()}.`,
      });
      setTimeout(() => setFeedback(null), 6000);
      setRollbackModal({ isOpen: false, historyItem: null, reason: '', submitting: false, error: null });
      await loadSettings(true);
      if (activeTab === 'history') await loadHistory(historyKeyFilter);
    } catch (err) {
      setRollbackModal((prev) => ({
        ...prev,
        submitting: false,
        error: err.response?.data?.error?.message || err.message || 'Failed to revert version',
      }));
    }
  };

  // Copy JSON Code Snippet
  const handleCopyJson = (key, value) => {
    navigator.clipboard.writeText(JSON.stringify(value, null, 2));
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Maintenance Setting Selector
  const maintenanceSetting = useMemo(() => {
    return settings.find((s) => getSettingKey(s).includes('maintenance_mode'));
  }, [settings]);

  const isMaintenanceActive = useMemo(() => {
    const val = getSettingValue(maintenanceSetting);
    return !!val.enabled;
  }, [maintenanceSetting]);

  // KPI Statistics
  const stats = useMemo(() => {
    const total = settings.length;
    let securityCount = 0;
    let allowOverrideCount = 0;

    settings.forEach((s) => {
      if (getCategory(s) === 'security') securityCount++;
      if (getAllowOverride(s)) allowOverrideCount++;
    });

    return { total, securityCount, allowOverrideCount };
  }, [settings]);

  // Filtered Settings List
  const filteredSettings = useMemo(() => {
    return settings.filter((s) => {
      const key = getSettingKey(s);
      const cat = getCategory(s);
      const name = getDisplayName(s).toLowerCase();
      const desc = (s.description || '').toLowerCase();
      const allowOverride = getAllowOverride(s);

      // Category matching
      if (activeTab === 'security' && cat !== 'security') return false;
      if (activeTab === 'system' && (cat !== 'system' || key.includes('maintenance_mode'))) return false;
      if (activeTab === 'maintenance' && !key.includes('maintenance_mode')) return false;

      // Override filter
      if (overrideFilter === 'PERMITTED' && !allowOverride) return false;
      if (overrideFilter === 'LOCKED' && allowOverride) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return name.includes(q) || key.toLowerCase().includes(q) || desc.includes(q);
      }

      return true;
    });
  }, [settings, activeTab, overrideFilter, searchQuery]);

  // Active filters count
  const activeFiltersCount = (overrideFilter !== 'ALL' ? 1 : 0) + (searchQuery.trim() ? 1 : 0);

  return (
    <div className="settings-page-container">
      {/* Breadcrumbs & Header Section */}
      <div className="settings-header-section">
        <div className="settings-header-left">
          <div className="breadcrumb-trail" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: '#64748B', marginBottom: '6px' }}>
            <Link to="/dashboard" style={{ color: '#64748B', textDecoration: 'none' }}>Dashboard</Link>
            <ChevronRight size={14} />
            <span style={{ color: '#0F172A', fontWeight: 600 }}>System Settings</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <h1 className="page-title" style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
              System Configuration & Platform Defaults
            </h1>
            <span
              className={`setting-override-badge ${isMaintenanceActive ? 'strict' : 'permitted'}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
            >
              {isMaintenanceActive ? (
                <>
                  <AlertTriangle size={12} />
                  <span>MAINTENANCE ACTIVE</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={12} />
                  <span>PLATFORM OPERATIONAL</span>
                </>
              )}
            </span>
          </div>
          <p className="page-subtitle" style={{ fontSize: '0.86rem', color: '#64748B', margin: '4px 0 0 0' }}>
            Manage authoritative company-wide settings, security baselines, maintenance mode, and tenant override policies.
          </p>
        </div>

        {/* Header Actions */}
        <div className="settings-header-right">
          <Link to="/audit-logs" className="btn-enterprise btn-outline-soft" style={{ textDecoration: 'none' }}>
            <History size={14} />
            <span>Audit Trail</span>
          </Link>

          <button
            type="button"
            className={`btn-enterprise btn-outline-soft ${isRefreshing ? 'is-loading' : ''}`}
            onClick={() => loadSettings(false)}
            disabled={isRefreshing}
          >
            <RotateCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Top 4 KPI Stat Cards */}
      <div className="settings-kpi-grid">
        {/* Card 1: Total Policies */}
        <div className="settings-stat-card card-stagger-1">
          <div className="settings-stat-header">
            <span className="settings-stat-label">Platform Policies</span>
            <div className="settings-stat-icon-wrap blue">
              <Sliders size={18} />
            </div>
          </div>
          <div className="settings-stat-value text-slate-900">
            <CountUpNumber value={stats.total} />
          </div>
          <div className="settings-stat-subtext">Active system policy configurations</div>
          <div className="settings-stat-accent-bar blue" />
        </div>

        {/* Card 2: Security Baselines */}
        <div className="settings-stat-card card-stagger-2">
          <div className="settings-stat-header">
            <span className="settings-stat-label">Security Baselines</span>
            <div className="settings-stat-icon-wrap green">
              <ShieldCheck size={18} />
            </div>
          </div>
          <div className="settings-stat-value text-emerald-600">
            <CountUpNumber value={stats.securityCount} />
          </div>
          <div className="settings-stat-subtext">Mandatory encryption & auth floors</div>
          <div className="settings-stat-accent-bar green" />
        </div>

        {/* Card 3: Tenant Overrides Permitted */}
        <div className="settings-stat-card card-stagger-3">
          <div className="settings-stat-header">
            <span className="settings-stat-label">Overrides Allowed</span>
            <div className="settings-stat-icon-wrap amber">
              <Building2 size={18} />
            </div>
          </div>
          <div className="settings-stat-value text-amber-600">
            <CountUpNumber value={stats.allowOverrideCount} />
          </div>
          <div className="settings-stat-subtext">Customizable by institutional tenants</div>
          <div className="settings-stat-accent-bar amber" />
        </div>

        {/* Card 4: Global Health & Maintenance */}
        <div className="settings-stat-card card-stagger-4">
          <div className="settings-stat-header">
            <span className="settings-stat-label">Global Killswitch</span>
            <div className={`settings-stat-icon-wrap ${isMaintenanceActive ? 'rose' : 'purple'}`}>
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className={`settings-stat-value ${isMaintenanceActive ? 'text-rose-600' : 'text-purple-600'}`} style={{ fontSize: '1.25rem', paddingTop: '6px' }}>
            {isMaintenanceActive ? 'MAINTENANCE' : 'OPERATIONAL'}
          </div>
          <div className="settings-stat-subtext">
            {isMaintenanceActive ? 'Non-superadmin writes disabled' : 'All tenant services nominal'}
          </div>
          <div className={`settings-stat-accent-bar ${isMaintenanceActive ? 'rose' : 'purple'}`} />
        </div>
      </div>

      {/* Dismissible Feedback Banner */}
      {feedback && (
        <div className={`alert alert-${feedback.type}`} style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', animation: 'fadeIn 0.3s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={16} />
            <span>{feedback.text}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 'bold' }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Global Error Banner */}
      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>
            <X size={15} />
          </button>
        </div>
      )}

      {/* Main Card Container */}
      <div className="settings-main-card">
        {/* Navigation Toolbar */}
        <div className="settings-toolbar">
          {/* Segmented Pill Tabs */}
          <div className="settings-tabs-pillbox">
            <button
              type="button"
              className={`settings-tab-pill ${activeTab === 'security' ? 'active' : ''}`}
              onClick={() => setActiveTab('security')}
            >
              <ShieldCheck size={14} />
              <span>Security Policies</span>
              <span className="pill-counter">{stats.securityCount}</span>
            </button>

            <button
              type="button"
              className={`settings-tab-pill ${activeTab === 'system' ? 'active' : ''}`}
              onClick={() => setActiveTab('system')}
            >
              <Sliders size={14} />
              <span>Platform Flags</span>
              <span className="pill-counter">{stats.total - stats.securityCount}</span>
            </button>

            <button
              type="button"
              className={`settings-tab-pill ${activeTab === 'maintenance' ? 'active' : ''}`}
              onClick={() => setActiveTab('maintenance')}
            >
              <AlertTriangle size={14} />
              <span>Maintenance Mode</span>
            </button>

            <button
              type="button"
              className={`settings-tab-pill ${activeTab === 'inheritance' ? 'active' : ''}`}
              onClick={() => setActiveTab('inheritance')}
            >
              <Building2 size={14} />
              <span>Tenant Inheritance</span>
              <span className="pill-counter">{inheritanceList.length || '•'}</span>
            </button>

            <button
              type="button"
              className={`settings-tab-pill ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              <History size={14} />
              <span>Version Audit</span>
              <span className="pill-counter">{historyList.length || '•'}</span>
            </button>
          </div>

          {/* Search & Filter Group */}
          {(activeTab === 'security' || activeTab === 'system') && (
            <div className="settings-filters-group">
              <div className="settings-search-box">
                <Search size={15} style={{ color: '#94A3B8' }} />
                <input
                  type="text"
                  placeholder="Search policies or keys..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="settings-search-input"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#94A3B8' }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <select
                value={overrideFilter}
                onChange={(e) => setOverrideFilter(e.target.value)}
                className="settings-select-dropdown"
              >
                <option value="ALL">All Overrides</option>
                <option value="PERMITTED">Tenant Overrides Allowed</option>
                <option value="LOCKED">Strict Platform Baseline</option>
              </select>

              {activeFiltersCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setOverrideFilter('ALL');
                  }}
                  className="btn-enterprise btn-outline-soft"
                  style={{ fontSize: '0.78rem', padding: '6px 10px' }}
                >
                  Reset ({activeFiltersCount})
                </button>
              )}
            </div>
          )}
        </div>

        {/* TAB 1 & 2: SECURITY & SYSTEM POLICIES GRID */}
        {(activeTab === 'security' || activeTab === 'system') && (
          <div>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <div className="spinner" style={{ margin: '0 auto 14px' }}></div>
                <p style={{ color: '#64748B', fontSize: '0.88rem' }}>Loading platform system configurations...</p>
              </div>
            ) : filteredSettings.length === 0 ? (
              <div className="modules-empty-state">
                <Sliders size={42} style={{ color: '#CBD5E1', marginBottom: '12px' }} />
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1E293B', margin: '0 0 6px 0' }}>
                  No Configuration Policies Found
                </h3>
                <p style={{ fontSize: '0.82rem', color: '#64748B', maxWidth: '380px', margin: '0 0 16px 0' }}>
                  No settings match your current search and filter criteria.
                </p>
                {activeFiltersCount > 0 && (
                  <button
                    type="button"
                    className="btn-enterprise btn-primary"
                    onClick={() => {
                      setSearchQuery('');
                      setOverrideFilter('ALL');
                    }}
                  >
                    Clear All Filters
                  </button>
                )}
              </div>
            ) : (
              <div className="settings-policy-grid">
                {filteredSettings.map((st) => {
                  const key = getSettingKey(st);
                  const name = getDisplayName(st);
                  const allowOverride = getAllowOverride(st);
                  const val = getSettingValue(st);
                  const isCopied = copiedKey === key;

                  return (
                    <div key={key} className="setting-policy-card">
                      <div>
                        {/* Header */}
                        <div className="setting-policy-header">
                          <div>
                            <h3 className="setting-policy-title">{name}</h3>
                            <code className="setting-policy-key">{key}</code>
                          </div>
                          <span className={`setting-override-badge ${allowOverride ? 'permitted' : 'strict'}`}>
                            {allowOverride ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                <Unlock size={11} />
                                <span>Tenant Override</span>
                              </span>
                            ) : (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                <Lock size={11} />
                                <span>Strict Baseline</span>
                              </span>
                            )}
                          </span>
                        </div>

                        {/* Description */}
                        <p className="setting-policy-desc">{st.description || 'Global configuration parameter.'}</p>

                        {/* Minimum Baseline Floor Warning */}
                        {st.min_value && (
                          <div className="setting-baseline-floor">
                            <span style={{ fontWeight: 700 }}>Security Baseline Floor: </span>
                            <code>{JSON.stringify(st.min_value)}</code>
                          </div>
                        )}

                        {/* JSON Code Snippet Preview */}
                        <div className="setting-json-preview-container">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: '#94A3B8', fontWeight: 700, letterSpacing: '0.05em' }}>
                              JSON Configuration
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyJson(key, val)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: isCopied ? '#10B981' : '#94A3B8',
                                cursor: 'pointer',
                                fontSize: '0.72rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '2px 4px',
                              }}
                              title="Copy JSON Payload"
                            >
                              {isCopied ? <Check size={12} /> : <Copy size={12} />}
                              <span>{isCopied ? 'Copied' : 'Copy'}</span>
                            </button>
                          </div>
                          <pre className="setting-json-code">
                            {JSON.stringify(val, null, 2)}
                          </pre>
                        </div>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="setting-card-footer">
                        <span style={{ fontSize: '0.73rem', color: '#94A3B8' }}>
                          Updated {st.updated_at ? new Date(st.updated_at).toLocaleDateString() : 'recently'}
                        </span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            type="button"
                            className="btn-module-action"
                            onClick={() => setResetModal({ isOpen: true, setting: st, reason: 'Reset to factory defaults', submitting: false, error: null })}
                            title="Reset this setting to company factory baseline"
                          >
                            <RefreshCcw size={12} />
                            <span>Reset</span>
                          </button>
                          <button
                            type="button"
                            className="btn-module-action primary"
                            onClick={() => openEditModal(st)}
                          >
                            <FileCode size={12} />
                            <span>Edit Policy</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: GLOBAL MAINTENANCE MODE KILLSWITCH */}
        {activeTab === 'maintenance' && maintenanceSetting && (
          <div>
            <div className={`maintenance-killswitch-panel ${isMaintenanceActive ? 'active-state' : ''}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <ShieldAlert size={22} style={{ color: isMaintenanceActive ? '#E11D48' : '#2563EB' }} />
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#0F172A' }}>
                      Global Maintenance Mode Killswitch
                    </h2>
                  </div>
                  <p style={{ margin: 0, color: '#64748B', fontSize: '0.86rem', maxWidth: '680px' }}>
                    When activated, non-superadmin write requests across all tenant portals (Student, Parent, Incharge, Security, Admin) are suspended with an informational maintenance broadcast.
                  </p>
                </div>

                <button
                  type="button"
                  className={`btn-enterprise ${isMaintenanceActive ? 'btn-primary' : 'btn-danger'}`}
                  onClick={() => openEditModal(maintenanceSetting)}
                >
                  <Sliders size={14} />
                  <span>Configure Maintenance Killswitch</span>
                </button>
              </div>

              {/* Maintenance Status Indicators Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                <div style={{ background: '#FFFFFF', padding: '16px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Operational Status
                  </div>
                  <div
                    style={{
                      fontSize: '1.15rem',
                      fontWeight: 800,
                      marginTop: '6px',
                      color: isMaintenanceActive ? '#E11D48' : '#10B981',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    {isMaintenanceActive ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
                    <span>{isMaintenanceActive ? 'MAINTENANCE ACTIVE' : 'PLATFORM OPERATIONAL'}</span>
                  </div>
                </div>

                <div style={{ background: '#FFFFFF', padding: '16px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Broadcast Banner Message
                  </div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, marginTop: '6px', color: '#1E293B' }}>
                    {getSettingValue(maintenanceSetting).banner_message || getSettingValue(maintenanceSetting).message || '(No broadcast message set)'}
                  </div>
                </div>

                <div style={{ background: '#FFFFFF', padding: '16px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Scheduled Maintenance End Time
                  </div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, marginTop: '6px', color: '#1E293B', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={15} style={{ color: '#64748B' }} />
                    <span>
                      {getSettingValue(maintenanceSetting).scheduled_end_time
                        ? new Date(getSettingValue(maintenanceSetting).scheduled_end_time).toLocaleString()
                        : 'Indefinite / Unscheduled'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: TENANT INHERITANCE MATRIX */}
        {activeTab === 'inheritance' && (
          <div>
            <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ color: '#64748B', fontSize: '0.84rem', margin: 0 }}>
                Audits which institutional college tenants inherit company defaults versus those maintaining explicit custom configurations.
              </p>
              <span style={{ fontSize: '0.78rem', color: '#64748B' }}>
                Tracking {inheritanceList.length} global policy definitions
              </span>
            </div>

            {inheritanceLoading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <div className="spinner" style={{ margin: '0 auto 10px' }}></div>
                <p style={{ color: '#64748B', fontSize: '0.85rem' }}>Analyzing tenant configurations...</p>
              </div>
            ) : inheritanceList.length === 0 ? (
              <div className="modules-empty-state">
                <Building2 size={40} style={{ color: '#CBD5E1', marginBottom: '10px' }} />
                <p style={{ color: '#64748B', fontSize: '0.86rem' }}>No tenant inheritance matrix records found.</p>
              </div>
            ) : (
              <div className="modules-table-container">
                <table className="modules-table">
                  <thead>
                    <tr>
                      <th style={{ width: '28%' }}>Policy Definition</th>
                      <th style={{ width: '14%' }}>Category</th>
                      <th style={{ width: '14%' }}>Total Tenants</th>
                      <th style={{ width: '16%' }}>Inherited Defaults</th>
                      <th style={{ width: '14%' }}>Custom Overrides</th>
                      <th style={{ width: '14%', textAlign: 'right' }}>Override Permission</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inheritanceList.map((item) => (
                      <tr key={item.setting_key}>
                        <td>
                          <div style={{ fontWeight: 700, color: '#0F172A' }}>{item.display_name}</div>
                          <code style={{ fontSize: '0.74rem', background: '#F1F5F9', color: '#475569', padding: '1px 5px', borderRadius: '4px' }}>
                            {item.setting_key}
                          </code>
                        </td>
                        <td>
                          <span className={`module-kind-pill ${item.category === 'security' ? 'app' : 'module'}`}>
                            {item.category}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600, color: '#334155' }}>
                          {item.total_tenants} colleges
                        </td>
                        <td>
                          <span style={{ color: '#059669', fontWeight: 700, fontSize: '0.82rem' }}>
                            {item.inherited_tenants} colleges
                          </span>
                        </td>
                        <td>
                          <span style={{ color: item.overridden_tenants > 0 ? '#2563EB' : '#94A3B8', fontWeight: 600, fontSize: '0.82rem' }}>
                            {item.overridden_tenants} colleges
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span className={`setting-override-badge ${item.allow_tenant_override ? 'permitted' : 'strict'}`}>
                            {item.allow_tenant_override ? 'Permitted' : 'Locked Global'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: VERSION HISTORY & ROLLBACK */}
        {activeTab === 'history' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <p style={{ color: '#64748B', fontSize: '0.84rem', margin: 0 }}>
                Timestamped audit records from <code>platform.system_settings_history</code>. Execute one-click rollbacks to restore verified stable baselines.
              </p>

              <select
                value={historyKeyFilter}
                onChange={(e) => setHistoryKeyFilter(e.target.value)}
                className="settings-select-dropdown"
                style={{ minWidth: '220px' }}
              >
                <option value="">All Settings</option>
                {settings.map((s) => (
                  <option key={getSettingKey(s)} value={getSettingKey(s)}>
                    {getDisplayName(s)}
                  </option>
                ))}
              </select>
            </div>

            {historyLoading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <div className="spinner" style={{ margin: '0 auto 10px' }}></div>
                <p style={{ color: '#64748B', fontSize: '0.85rem' }}>Loading configuration audit trail...</p>
              </div>
            ) : historyList.length === 0 ? (
              <div className="modules-empty-state">
                <History size={40} style={{ color: '#CBD5E1', marginBottom: '10px' }} />
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1E293B', margin: '0 0 6px 0' }}>
                  No Configuration History Found
                </h3>
                <p style={{ fontSize: '0.82rem', color: '#64748B', maxWidth: '380px', margin: 0 }}>
                  No configuration revisions recorded yet for the selected policy filter.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {historyList.map((h) => (
                  <div
                    key={h.history_id || Math.random()}
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid #EDF2F7',
                      borderRadius: '12px',
                      padding: '16px 20px',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
                      transition: 'border-color 0.2s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <span
                          className={`badge ${
                            h.action === 'UPDATE' ? 'badge-primary' : h.action === 'REVERT' ? 'badge-warning' : 'badge-outline'
                          }`}
                          style={{ fontSize: '0.72rem', fontWeight: 700 }}
                        >
                          {h.action}
                        </span>
                        <strong style={{ color: '#0F172A', fontSize: '0.9rem' }}>{h.setting_key}</strong>
                        <span style={{ color: '#64748B', fontSize: '0.78rem' }}>
                          by <strong>{h.actor_role || 'SUPER_ADMIN'}</strong> &bull; {new Date(h.created_at).toLocaleString()}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setRollbackModal({ isOpen: true, historyItem: h, reason: 'Reverting to stable previous version', submitting: false, error: null })}
                        className="btn-module-action"
                        style={{ color: '#D97706', borderColor: '#FDE68A', background: '#FFFBEB' }}
                      >
                        <RefreshCcw size={12} />
                        <span>Rollback to this version</span>
                      </button>
                    </div>

                    <div style={{ fontSize: '0.82rem', color: '#334155', marginBottom: '10px' }}>
                      <strong style={{ color: '#475569' }}>Reason: </strong> {h.reason || 'No justification specified'}
                    </div>

                    <div className="setting-json-preview-container" style={{ margin: 0, padding: '10px 12px' }}>
                      <pre className="setting-json-code" style={{ maxHeight: '100px' }}>
                        {JSON.stringify(h.new_value, null, 2)}
                      </pre>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL 1: EDIT CONFIGURATION DRAWER / MODAL */}
      {editModal.isOpen && editModal.setting && (
        <div className="modal-backdrop" style={{ zIndex: 1050 }}>
          <div className="modal-card" style={{ maxWidth: '680px', borderRadius: '16px', overflow: 'hidden' }}>
            <div className="modal-header" style={{ padding: '18px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sliders size={18} style={{ color: '#2563EB' }} />
                <h2 className="modal-title" style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#0F172A' }}>
                  Edit Policy: {getDisplayName(editModal.setting)}
                </h2>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setEditModal((p) => ({ ...p, isOpen: false }))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveSetting} style={{ padding: '24px' }}>
              {editModal.error && (
                <div className="alert alert-danger" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={15} />
                  <span>{editModal.error}</span>
                </div>
              )}

              <p style={{ margin: '0 0 16px 0', fontSize: '0.84rem', color: '#64748B' }}>
                Authoritative Key: <code>{getSettingKey(editModal.setting)}</code>
              </p>

              {/* JSON Editor with Prettify Tool */}
              <div style={{ marginBottom: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label className="label" style={{ fontWeight: 700, fontSize: '0.82rem', color: '#334155', margin: 0 }}>
                    Configuration JSON Payload
                  </label>
                  <button
                    type="button"
                    onClick={handlePrettifyJson}
                    className="btn-module-action"
                    style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                  >
                    <Sparkles size={11} />
                    <span>Auto-Format JSON</span>
                  </button>
                </div>
                <textarea
                  value={editModal.jsonString}
                  onChange={(e) => setEditModal((p) => ({ ...p, jsonString: e.target.value }))}
                  rows={10}
                  className="input-textarea"
                  style={{
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                    fontSize: '0.82rem',
                    background: '#0F172A',
                    color: '#6EE7B7',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    width: '100%',
                    padding: '12px',
                    lineHeight: 1.45,
                  }}
                  required
                />
              </div>

              {/* Mandatory Reason Input */}
              <div style={{ marginBottom: '22px' }}>
                <label className="label" style={{ fontWeight: 700, fontSize: '0.82rem', color: '#334155', marginBottom: '6px' }}>
                  Authoritative Change Justification <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <input
                  type="text"
                  value={editModal.reason}
                  onChange={(e) => setEditModal((p) => ({ ...p, reason: e.target.value }))}
                  placeholder="e.g. Updating platform password floor per Q4 compliance audit"
                  className="input-text"
                  style={{ width: '100%', fontSize: '0.84rem', borderRadius: '8px', border: '1px solid #CBD5E1' }}
                  required
                />
              </div>

              {/* Modal Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn-enterprise btn-outline-soft"
                  onClick={() => setEditModal((p) => ({ ...p, isOpen: false }))}
                  disabled={editModal.submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-enterprise btn-primary"
                  disabled={editModal.submitting}
                >
                  {editModal.submitting ? 'Applying Policy...' : 'Apply Configuration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CONFIRM FACTORY RESET MODAL (Replaces window.confirm/prompt) */}
      {resetModal.isOpen && resetModal.setting && (
        <div className="modal-backdrop" style={{ zIndex: 1050 }}>
          <div className="modal-card" style={{ maxWidth: '520px', borderRadius: '16px', overflow: 'hidden' }}>
            <div className="modal-header" style={{ padding: '18px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <RefreshCcw size={18} style={{ color: '#DC2626' }} />
                <h2 className="modal-title" style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#0F172A' }}>
                  Reset to Company Defaults
                </h2>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setResetModal((p) => ({ ...p, isOpen: false }))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmReset} style={{ padding: '24px' }}>
              {resetModal.error && (
                <div className="alert alert-danger" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={15} />
                  <span>{resetModal.error}</span>
                </div>
              )}

              <p style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '16px', lineHeight: 1.5 }}>
                Are you sure you want to reset <strong style={{ color: '#0F172A' }}>{getDisplayName(resetModal.setting)}</strong> to the company factory baseline? Any tenant institutions inheriting this policy will immediately receive default values.
              </p>

              <div style={{ marginBottom: '20px' }}>
                <label className="label" style={{ fontWeight: 700, fontSize: '0.82rem', color: '#334155', marginBottom: '6px' }}>
                  Audit Reset Reason
                </label>
                <input
                  type="text"
                  value={resetModal.reason}
                  onChange={(e) => setResetModal((p) => ({ ...p, reason: e.target.value }))}
                  className="input-text"
                  style={{ width: '100%', fontSize: '0.84rem' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn-enterprise btn-outline-soft"
                  onClick={() => setResetModal((p) => ({ ...p, isOpen: false }))}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-enterprise btn-danger"
                  disabled={resetModal.submitting}
                >
                  {resetModal.submitting ? 'Resetting...' : 'Confirm Factory Reset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: CONFIRM ROLLBACK MODAL (Replaces window.confirm/prompt) */}
      {rollbackModal.isOpen && rollbackModal.historyItem && (
        <div className="modal-backdrop" style={{ zIndex: 1050 }}>
          <div className="modal-card" style={{ maxWidth: '540px', borderRadius: '16px', overflow: 'hidden' }}>
            <div className="modal-header" style={{ padding: '18px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <History size={18} style={{ color: '#D97706' }} />
                <h2 className="modal-title" style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#0F172A' }}>
                  Rollback Version Revision
                </h2>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setRollbackModal((p) => ({ ...p, isOpen: false }))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmRollback} style={{ padding: '24px' }}>
              {rollbackModal.error && (
                <div className="alert alert-danger" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={15} />
                  <span>{rollbackModal.error}</span>
                </div>
              )}

              <p style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '14px', lineHeight: 1.5 }}>
                Roll back policy <strong style={{ color: '#0F172A' }}>{rollbackModal.historyItem.setting_key}</strong> to the version created on{' '}
                <strong>{new Date(rollbackModal.historyItem.created_at).toLocaleString()}</strong> by {rollbackModal.historyItem.actor_role}?
              </p>

              {/* Version Value Preview */}
              <div className="setting-json-preview-container" style={{ marginBottom: '16px' }}>
                <pre className="setting-json-code" style={{ maxHeight: '110px' }}>
                  {JSON.stringify(rollbackModal.historyItem.new_value, null, 2)}
                </pre>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label className="label" style={{ fontWeight: 700, fontSize: '0.82rem', color: '#334155', marginBottom: '6px' }}>
                  Audit Rollback Justification
                </label>
                <input
                  type="text"
                  value={rollbackModal.reason}
                  onChange={(e) => setRollbackModal((p) => ({ ...p, reason: e.target.value }))}
                  className="input-text"
                  style={{ width: '100%', fontSize: '0.84rem' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn-enterprise btn-outline-soft"
                  onClick={() => setRollbackModal((p) => ({ ...p, isOpen: false }))}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-enterprise btn-primary"
                  disabled={rollbackModal.submitting}
                >
                  {rollbackModal.submitting ? 'Rolling back...' : 'Confirm Version Rollback'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
