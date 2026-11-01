import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Wrench,
  Shield,
  Search,
  Key,
  Unlock,
  AlertTriangle,
  CheckCircle2,
  FileText,
  UserCheck,
  Building2,
  RefreshCw,
  Clock,
  Eye,
  ShieldAlert,
  X,
  Info,
  Lock,
  ShieldCheck,
  ArrowRight,
  RotateCw,
  Ban,
  Check,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import {
  fetchSupportGrants,
  createSupportGrant,
  revokeSupportGrant,
  diagnoseEntitlement,
  performMaskedStudentLookup,
} from '../services/operationsService';
import { fetchCollegesList } from '../services/collegeService';

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

const COMMON_MODULES = [
  'ACADEMIC',
  'HOSTEL',
  'MEALS',
  'PEOPLE',
  'SECURITY',
  'COMMUNICATION',
  'MOVEMENT',
  'RESOURCES',
];

export default function SupportTroubleshootingPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('GRANTS'); // 'GRANTS' | 'ENTITLEMENTS' | 'STUDENT_LOOKUP'

  // Data & State
  const [colleges, setColleges] = useState([]);
  const [grants, setGrants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null);

  // Search & Filter for Grants
  const [grantSearch, setGrantSearch] = useState('');
  const [grantStatusFilter, setGrantStatusFilter] = useState('ALL');

  // New Grant Modal State
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [grantForm, setGrantForm] = useState({
    college_id: '',
    duration_minutes: 60,
    reason: '',
    ticket_ref: '',
  });

  // Revoke Modal State
  const [revokeModal, setRevokeModal] = useState({
    isOpen: false,
    grant: null,
    reason: '',
    submitting: false,
    error: null,
  });

  // Entitlement Diagnosis Form
  const [entitlementForm, setEntitlementForm] = useState({
    college_id: '',
    module_code: 'HOSTEL',
  });
  const [diagnosticReport, setDiagnosticReport] = useState(null);
  const [diagnosing, setDiagnosing] = useState(false);

  // Student Lookup Form
  const [studentForm, setStudentForm] = useState({
    college_id: '',
    admission_number: '',
    reason: '',
  });
  const [studentResult, setStudentResult] = useState(null);
  const [lookingUp, setLookingUp] = useState(false);

  useEffect(() => {
    fetchCollegesList({ limit: 100 })
      .then((res) => {
        const list = res?.colleges || res || [];
        setColleges(list);
        if (list.length > 0) {
          setGrantForm((f) => ({ ...f, college_id: list[0].college_id }));
          setEntitlementForm((f) => ({ ...f, college_id: list[0].college_id }));
          setStudentForm((f) => ({ ...f, college_id: list[0].college_id }));
        }
      })
      .catch(() => {});
    loadGrants();
  }, []);

  const loadGrants = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchSupportGrants();
      setGrants(res?.data || []);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to load support grants');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGrant = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      await createSupportGrant({
        ...grantForm,
        grantee_id: user?.user_id,
        duration_minutes: Number(grantForm.duration_minutes),
      });
      setFeedback('Scoped support access grant created and audited successfully.');
      setShowGrantModal(false);
      setGrantForm((f) => ({ ...f, reason: '', ticket_ref: '' }));
      loadGrants();
      setTimeout(() => setFeedback(null), 5000);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to issue support grant');
    } finally {
      setLoading(false);
    }
  };

  const openRevokeModal = (grant) => {
    setRevokeModal({
      isOpen: true,
      grant,
      reason: '',
      submitting: false,
      error: null,
    });
  };

  const handleConfirmRevoke = async (e) => {
    e.preventDefault();
    if (!revokeModal.grant || !revokeModal.reason.trim()) return;
    try {
      setRevokeModal((m) => ({ ...m, submitting: true, error: null }));
      await revokeSupportGrant(revokeModal.grant.grant_id, revokeModal.reason);
      setRevokeModal({ isOpen: false, grant: null, reason: '', submitting: false, error: null });
      setFeedback('Support grant revoked immediately and recorded to platform audit log.');
      loadGrants();
      setTimeout(() => setFeedback(null), 5000);
    } catch (err) {
      setRevokeModal((m) => ({
        ...m,
        submitting: false,
        error: err?.response?.data?.error || err.message || 'Failed to revoke grant',
      }));
    }
  };

  const handleDiagnoseEntitlement = async (e) => {
    e.preventDefault();
    try {
      setDiagnosing(true);
      setError(null);
      setDiagnosticReport(null);
      const res = await diagnoseEntitlement(entitlementForm.college_id, entitlementForm.module_code);
      setDiagnosticReport(res?.data || null);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Entitlement diagnosis failed');
    } finally {
      setDiagnosing(false);
    }
  };

  const handleStudentLookup = async (e) => {
    e.preventDefault();
    try {
      setLookingUp(true);
      setError(null);
      setStudentResult(null);
      const res = await performMaskedStudentLookup(
        studentForm.college_id,
        studentForm.admission_number,
        studentForm.reason
      );
      setStudentResult(res?.data || null);
      setFeedback('Student record retrieved with privacy redactions; access audited.');
      setTimeout(() => setFeedback(null), 5000);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Student lookup failed');
    } finally {
      setLookingUp(false);
    }
  };

  // KPI Calculations
  const activeGrantsCount = useMemo(() => grants.filter((g) => g.is_active).length, [grants]);
  const revokedGrantsCount = useMemo(() => grants.filter((g) => g.revoked_at).length, [grants]);

  // Filtered Grants List
  const filteredGrants = useMemo(() => {
    return grants.filter((g) => {
      // Status filter
      if (grantStatusFilter === 'ACTIVE' && !g.is_active) return false;
      if (grantStatusFilter === 'REVOKED' && !g.revoked_at) return false;
      if (grantStatusFilter === 'EXPIRED' && (g.is_active || g.revoked_at)) return false;

      // Text search
      if (grantSearch.trim()) {
        const q = grantSearch.toLowerCase();
        return (
          (g.college_name && g.college_name.toLowerCase().includes(q)) ||
          (g.college_code && g.college_code.toLowerCase().includes(q)) ||
          (g.ticket_ref && g.ticket_ref.toLowerCase().includes(q)) ||
          (g.grantee_email && g.grantee_email.toLowerCase().includes(q)) ||
          (g.reason && g.reason.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [grants, grantStatusFilter, grantSearch]);

  return (
    <div className="support-page-container">
      {/* Header */}
      <div className="support-header-section">
        <div className="support-header-left">
          <div className="support-breadcrumb-nav">
            <Link to="/dashboard" className="support-breadcrumb-link">Dashboard</Link>
            <span className="support-breadcrumb-sep">/</span>
            <span className="support-breadcrumb-current">Support Console</span>
          </div>
          <h1 className="support-title">
            <Wrench size={24} className="text-blue-600" />
            <span>Support & Diagnostic Troubleshooting Console</span>
          </h1>
          <p className="support-subtitle">
            Time-boxed support grants, entitlement diagnosis, and audited privacy-masked student verification.
          </p>
        </div>

        <div className="support-header-actions">
          <button
            type="button"
            onClick={loadGrants}
            className={`btn-enterprise btn-outline-soft ${loading ? 'is-loading' : ''}`}
            title="Refresh grants list"
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>{loading ? 'Refreshing...' : 'Refresh Telemetry'}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowGrantModal(true)}
            className="btn-enterprise btn-primary"
            id="btn-request-support-grant"
          >
            <Shield size={14} />
            <span>+ Request Support Grant</span>
          </button>
        </div>
      </div>

      {/* Global Feedback Banner */}
      {feedback && (
        <div className="approvals-feedback-banner success animate-slide-up" style={{ marginBottom: '20px' }}>
          <div className="feedback-content">
            <CheckCircle2 size={16} />
            <span>{feedback}</span>
          </div>
          <button type="button" className="feedback-close-btn" onClick={() => setFeedback(null)}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Global Error Banner */}
      {error && (
        <div className="approvals-feedback-banner danger animate-slide-up" style={{ marginBottom: '20px' }}>
          <div className="feedback-content">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
          <button type="button" className="feedback-close-btn" onClick={() => setError(null)}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Top 4 Shopeers KPI Cards */}
      <div className="support-kpi-grid">
        {/* Card 1: Active Support Grants */}
        <div className="support-stat-card card-stagger-1">
          <div className="support-stat-header">
            <span className="support-stat-label">Active Support Grants</span>
            <div className="support-stat-icon-wrap emerald">
              <Shield size={18} />
            </div>
          </div>
          <div className="support-stat-value text-emerald-600">
            <CountUpNumber value={activeGrantsCount} />
          </div>
          <div className="support-stat-subtext">Time-boxed tenant diagnostic access</div>
          <div className="support-stat-accent-bar emerald" />
        </div>

        {/* Card 2: Historical Grants */}
        <div className="support-stat-card card-stagger-2">
          <div className="support-stat-header">
            <span className="support-stat-label">Historical Grants</span>
            <div className="support-stat-icon-wrap blue">
              <FileText size={18} />
            </div>
          </div>
          <div className="support-stat-value text-blue-600">
            <CountUpNumber value={grants.length} />
          </div>
          <div className="support-stat-subtext">
            {revokedGrantsCount} revoked by supervisor | audited
          </div>
          <div className="support-stat-accent-bar blue" />
        </div>

        {/* Card 3: Entitlement Resolver */}
        <div className="support-stat-card card-stagger-3">
          <div className="support-stat-header">
            <span className="support-stat-label">Entitlement Resolver</span>
            <div className="support-stat-icon-wrap purple">
              <Key size={18} />
            </div>
          </div>
          <div className="support-stat-value text-purple-600" style={{ fontSize: '1.45rem', paddingTop: '4px' }}>
            READY
          </div>
          <div className="support-stat-subtext">Multi-stage policy & catalog gates</div>
          <div className="support-stat-accent-bar purple" />
        </div>

        {/* Card 4: Student Privacy Gate */}
        <div className="support-stat-card card-stagger-4">
          <div className="support-stat-header">
            <span className="support-stat-label">Student Privacy Gate</span>
            <div className="support-stat-icon-wrap amber">
              <Eye size={18} />
            </div>
          </div>
          <div className="support-stat-value text-amber-600" style={{ fontSize: '1.45rem', paddingTop: '4px' }}>
            ENFORCED
          </div>
          <div className="support-stat-subtext">Zero raw PII / FERPA privacy mask</div>
          <div className="support-stat-accent-bar amber" />
        </div>
      </div>

      {/* Main Card with Navigation Tabs */}
      <div className="support-main-card card-stagger-3">
        {/* Navigation Toolbar */}
        <div className="support-toolbar">
          <div className="support-nav-tabs">
            <button
              type="button"
              onClick={() => setActiveTab('GRANTS')}
              className={`support-tab-pill ${activeTab === 'GRANTS' ? 'active' : ''}`}
            >
              <Shield size={13} />
              <span>Time-Boxed Support Grants ({grants.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ENTITLEMENTS')}
              className={`support-tab-pill ${activeTab === 'ENTITLEMENTS' ? 'active' : ''}`}
            >
              <Search size={13} />
              <span>Entitlement Diagnosis</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('STUDENT_LOOKUP')}
              className={`support-tab-pill ${activeTab === 'STUDENT_LOOKUP' ? 'active' : ''}`}
            >
              <Eye size={13} />
              <span>Masked Student Lookup</span>
            </button>
          </div>

          {activeTab === 'GRANTS' && (
            <div className="support-controls-cluster">
              <div className="filter-select-item">
                <span className="filter-item-label">Status:</span>
                <select
                  value={grantStatusFilter}
                  onChange={(e) => setGrantStatusFilter(e.target.value)}
                  className="permissions-select-input"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">Active Grants</option>
                  <option value="REVOKED">Revoked Grants</option>
                  <option value="EXPIRED">Expired Grants</option>
                </select>
              </div>

              <div className="support-search-box">
                <Search size={15} className="text-slate-400" />
                <input
                  type="text"
                  placeholder="Search college, ticket, or grantee..."
                  value={grantSearch}
                  onChange={(e) => setGrantSearch(e.target.value)}
                  className="support-search-input"
                />
                {grantSearch && (
                  <button
                    type="button"
                    className="search-clear-btn"
                    onClick={() => setGrantSearch('')}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Tab 1: Support Grants Table */}
        {activeTab === 'GRANTS' && (
          <div>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '48px 20px' }}>
                <div className="loading-spinner-blue" style={{ margin: '0 auto 8px auto' }} />
                <div className="text-xs text-slate-500">Loading support access grants...</div>
              </div>
            ) : filteredGrants.length === 0 ? (
              <div className="approvals-empty-state" style={{ padding: '48px 20px' }}>
                <div className="empty-state-badge-stage">
                  <div className="empty-state-badge-pulse" />
                  <div className="empty-state-icon-badge">
                    <Shield size={32} className="text-blue-600" />
                  </div>
                </div>
                <h3 className="empty-state-heading">Zero Support Grants Active</h3>
                <p className="empty-state-description">
                  {grantSearch
                    ? 'No support grants match your search criteria.'
                    : 'Issue a time-boxed grant to perform regulated diagnostic operations for tenant institutions.'}
                </p>
                {!grantSearch && (
                  <button
                    type="button"
                    onClick={() => setShowGrantModal(true)}
                    className="btn-enterprise btn-primary"
                    style={{ marginTop: '16px' }}
                  >
                    + Request Support Grant
                  </button>
                )}
              </div>
            ) : (
              <div className="approvals-table-responsive">
                <table className="approvals-table">
                  <thead>
                    <tr>
                      <th>College Tenant</th>
                      <th>Ticket Reference</th>
                      <th>Authorized Grantee</th>
                      <th>Diagnostic Reason</th>
                      <th>Validity Window</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredGrants.map((g) => (
                      <tr key={g.grant_id} className="approvals-table-row">
                        <td>
                          <div className="font-semibold text-slate-900">{g.college_name}</div>
                          <span className="code-pill font-mono text-xs">{g.college_code}</span>
                        </td>
                        <td>
                          <span className="code-pill font-mono font-bold text-blue-600">
                            {g.ticket_ref}
                          </span>
                        </td>
                        <td>
                          <span className="text-xs text-slate-600">{g.grantee_email}</span>
                        </td>
                        <td style={{ maxWidth: '260px' }}>
                          <div className="text-xs text-slate-700 truncate" title={g.reason}>
                            {g.reason}
                          </div>
                        </td>
                        <td>
                          <div className="text-xs text-slate-600 font-mono">
                            <div>Start: {new Date(g.starts_at).toLocaleTimeString()}</div>
                            <div>Exp: {new Date(g.expires_at).toLocaleTimeString()}</div>
                          </div>
                        </td>
                        <td>
                          <span
                            className={`status-pill ${
                              g.is_active ? 'approved' : g.revoked_at ? 'rejected' : 'cancelled'
                            }`}
                          >
                            {g.is_active ? 'ACTIVE' : g.revoked_at ? 'REVOKED' : 'EXPIRED'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {g.is_active ? (
                            <button
                              type="button"
                              onClick={() => openRevokeModal(g)}
                              className="btn-card-action suspend"
                              title="Revoke access immediately"
                            >
                              <Ban size={13} />
                              <span>Revoke</span>
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400 font-mono">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Entitlement Diagnosis */}
        {activeTab === 'ENTITLEMENTS' && (
          <div className="support-dual-grid">
            {/* Left: Diagnosis Form */}
            <div className="support-side-panel">
              <div className="support-panel-title-wrap">
                <Search size={18} className="text-blue-600" />
                <h3 className="support-panel-title">Diagnose Module Access</h3>
              </div>
              <form onSubmit={handleDiagnoseEntitlement}>
                <div className="form-group-custom">
                  <label className="form-label-custom">Target College Institution</label>
                  <select
                    value={entitlementForm.college_id}
                    onChange={(e) => setEntitlementForm({ ...entitlementForm, college_id: e.target.value })}
                    className="form-input-custom select"
                  >
                    {colleges.map((col) => (
                      <option key={col.college_id} value={col.college_id}>
                        {col.name} ({col.college_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group-custom">
                  <label className="form-label-custom">Catalog Module Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. HOSTEL, MESS, SECURITY"
                    value={entitlementForm.module_code}
                    onChange={(e) => setEntitlementForm({ ...entitlementForm, module_code: e.target.value.toUpperCase() })}
                    className="form-input-custom font-mono"
                  />
                  <div className="support-quick-tags">
                    {COMMON_MODULES.map((code) => (
                      <button
                        key={code}
                        type="button"
                        className="support-quick-tag"
                        onClick={() => setEntitlementForm((f) => ({ ...f, module_code: code }))}
                      >
                        {code}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={diagnosing}
                  className="btn-enterprise btn-primary"
                  style={{ width: '100%', marginTop: '16px' }}
                >
                  <Key size={14} className={diagnosing ? 'animate-spin' : ''} />
                  <span>{diagnosing ? 'Evaluating Decision Trees...' : 'Run Access Diagnosis'}</span>
                </button>
              </form>
            </div>

            {/* Right: Diagnosis Result */}
            <div className="support-verdict-card">
              {!diagnosticReport ? (
                <div className="approvals-empty-state" style={{ padding: '40px 20px' }}>
                  <div className="empty-state-badge-stage" style={{ width: '56px', height: '56px', margin: '0 auto 14px auto' }}>
                    <div className="empty-state-icon-badge" style={{ width: '48px', height: '48px' }}>
                      <Search size={22} className="text-blue-600" />
                    </div>
                  </div>
                  <h3 className="empty-state-heading" style={{ fontSize: '1.05rem' }}>Awaiting Diagnostic Request</h3>
                  <p className="empty-state-description" style={{ fontSize: '0.82rem' }}>
                    Select a college institution and enter a module code to evaluate multi-stage gate decisions.
                  </p>
                </div>
              ) : (
                <>
                  <div
                    className={`support-verdict-banner ${
                      diagnosticReport.is_access_permitted ? 'permitted' : 'denied'
                    }`}
                  >
                    <div>
                      <h4 className="support-verdict-title">{diagnosticReport.evaluation_verdict}</h4>
                      <div className="support-verdict-time font-mono">
                        Evaluated at: {new Date(diagnosticReport.evaluated_at).toLocaleString()}
                      </div>
                    </div>
                    {diagnosticReport.is_access_permitted ? (
                      <CheckCircle2 size={24} className="text-emerald-600" />
                    ) : (
                      <AlertTriangle size={24} className="text-rose-600" />
                    )}
                  </div>

                  <div className="support-checks-grid">
                    <div className="support-check-item">
                      <span className="support-check-item-label">Module in Catalog</span>
                      <div className="support-check-item-val">
                        {diagnosticReport.module_found ? (
                          <span className="text-emerald-600">✓ PRESENT</span>
                        ) : (
                          <span className="text-rose-600">✕ NOT FOUND</span>
                        )}
                      </div>
                    </div>

                    <div className="support-check-item">
                      <span className="support-check-item-label">Catalog Status</span>
                      <div className="support-check-item-val">
                        {diagnosticReport.module_active_in_catalog ? (
                          <span className="text-emerald-600">ACTIVE</span>
                        ) : (
                          <span className="text-slate-400">INACTIVE</span>
                        )}
                      </div>
                    </div>

                    <div className="support-check-item">
                      <span className="support-check-item-label">College Lifecycle</span>
                      <div className="support-check-item-val font-mono">
                        {diagnosticReport.college_status}
                      </div>
                    </div>

                    <div className="support-check-item">
                      <span className="support-check-item-label">Tenant Entitlement</span>
                      <div className="support-check-item-val font-mono">
                        {diagnosticReport.entitlement_status}
                      </div>
                    </div>
                  </div>

                  {diagnosticReport.blockers?.length > 0 && (
                    <div className="support-blockers-box">
                      <div className="support-blockers-title">
                        <AlertTriangle size={15} />
                        <span>Identified Access Blockers:</span>
                      </div>
                      <ul className="support-blockers-list">
                        {diagnosticReport.blockers.map((b, idx) => (
                          <li key={idx}>{b}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Masked Student Lookup */}
        {activeTab === 'STUDENT_LOOKUP' && (
          <div className="support-dual-grid">
            {/* Left: Lookup Form */}
            <div className="support-side-panel">
              <div className="support-panel-title-wrap">
                <Eye size={18} className="text-blue-600" />
                <h3 className="support-panel-title">Audited Student Status Verification</h3>
              </div>
              <form onSubmit={handleStudentLookup}>
                <div className="form-group-custom">
                  <label className="form-label-custom">Target College Institution</label>
                  <select
                    value={studentForm.college_id}
                    onChange={(e) => setStudentForm({ ...studentForm, college_id: e.target.value })}
                    className="form-input-custom select"
                  >
                    {colleges.map((col) => (
                      <option key={col.college_id} value={col.college_id}>
                        {col.name} ({col.college_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group-custom">
                  <label className="form-label-custom">Admission / Roll Number</label>
                  <input
                    type="text"
                    required
                    placeholder="Exact admission / roll no."
                    value={studentForm.admission_number}
                    onChange={(e) => setStudentForm({ ...studentForm, admission_number: e.target.value })}
                    className="form-input-custom font-mono"
                  />
                </div>

                <div className="form-group-custom">
                  <label className="form-label-custom">Troubleshooting Justification (Mandatory)</label>
                  <input
                    type="text"
                    required
                    placeholder="Support ticket reference or justification..."
                    value={studentForm.reason}
                    onChange={(e) => setStudentForm({ ...studentForm, reason: e.target.value })}
                    className="form-input-custom"
                  />
                </div>

                <button
                  type="submit"
                  disabled={lookingUp}
                  className="btn-enterprise btn-primary"
                  style={{ width: '100%', marginTop: '16px' }}
                >
                  <Search size={14} className={lookingUp ? 'animate-spin' : ''} />
                  <span>{lookingUp ? 'Querying Privacy Layer...' : 'Search Masked Record'}</span>
                </button>
              </form>
            </div>

            {/* Right: Masked Result */}
            <div className="support-verdict-card">
              {!studentResult ? (
                <div className="approvals-empty-state" style={{ padding: '40px 20px' }}>
                  <div className="empty-state-badge-stage" style={{ width: '56px', height: '56px', margin: '0 auto 14px auto' }}>
                    <div className="empty-state-icon-badge" style={{ width: '48px', height: '48px' }}>
                      <Eye size={22} className="text-blue-600" />
                    </div>
                  </div>
                  <h3 className="empty-state-heading" style={{ fontSize: '1.05rem' }}>No Search Executed</h3>
                  <p className="empty-state-description" style={{ fontSize: '0.82rem' }}>
                    Enter an exact admission number and valid support justification to perform a privacy-redacted status lookup.
                  </p>
                </div>
              ) : (
                <>
                  <div className="support-verdict-banner permitted">
                    <div>
                      <h4 className="support-verdict-title">Student Found: {studentResult.college_code}</h4>
                      <div className="support-verdict-time font-mono">
                        Audited privacy query executed
                      </div>
                    </div>
                    <span className="status-pill approved">AUDITED ACCESS</span>
                  </div>

                  <div className="support-lookup-result-card">
                    <div className="support-lookup-field">
                      <span className="support-lookup-field-label">Admission Number</span>
                      <div className="support-lookup-field-val font-mono">
                        {studentResult.admission_number}
                      </div>
                    </div>

                    <div className="support-lookup-field">
                      <span className="support-lookup-field-label">Masked Student Name</span>
                      <div className="support-lookup-field-val">
                        {studentResult.masked_name}
                      </div>
                    </div>

                    <div className="support-lookup-field">
                      <span className="support-lookup-field-label">Academic Status</span>
                      <div className="support-lookup-field-val font-semibold text-emerald-600">
                        {studentResult.student_status}
                      </div>
                    </div>

                    <div className="support-lookup-field">
                      <span className="support-lookup-field-label">Hostel Bed Status</span>
                      <div className="support-lookup-field-val font-semibold text-blue-600">
                        {studentResult.hostel_status}
                      </div>
                    </div>
                  </div>

                  <div className="reports-architecture-notice" style={{ marginTop: '4px' }}>
                    <div className="reports-privacy-icon-wrap" style={{ width: '28px', height: '28px', background: '#ECFDF5', color: '#059669' }}>
                      <ShieldCheck size={16} />
                    </div>
                    <div className="reports-notice-text">
                      <strong>Privacy Assurance:</strong> Direct PII is permanently masked at the data-access layer. This query was logged to the tamper-evident audit stream with operator signature.
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: Request Support Grant Dialog */}
      {showGrantModal && (
        <div className="modal-backdrop-blur">
          <div className="modal-dialog-card animate-badge-pop" style={{ maxWidth: '520px' }}>
            <div className="modal-dialog-header">
              <div className="modal-header-icon-wrap blue">
                <Shield size={20} />
              </div>
              <div className="modal-header-text">
                <h3 className="modal-header-title">Issue Scoped Support Grant</h3>
                <p className="modal-header-subtitle">Time-boxed access for tenant troubleshooting.</p>
              </div>
              <button
                type="button"
                className="modal-close-icon-btn"
                onClick={() => setShowGrantModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateGrant}>
              <div className="modal-dialog-body">
                <div className="form-group-custom">
                  <label className="form-label-custom">Target College Institution</label>
                  <select
                    value={grantForm.college_id}
                    onChange={(e) => setGrantForm({ ...grantForm, college_id: e.target.value })}
                    className="form-input-custom select"
                  >
                    {colleges.map((col) => (
                      <option key={col.college_id} value={col.college_id}>
                        {col.name} ({col.college_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group-custom">
                  <label className="form-label-custom">Validity Duration (Minutes, Max 480)</label>
                  <select
                    value={grantForm.duration_minutes}
                    onChange={(e) => setGrantForm({ ...grantForm, duration_minutes: Number(e.target.value) })}
                    className="form-input-custom select"
                  >
                    <option value={30}>30 Minutes (Quick Diagnosis)</option>
                    <option value={60}>1 Hour (Standard Resolution)</option>
                    <option value={120}>2 Hours (Complex Issue)</option>
                    <option value={240}>4 Hours (Deep Investigation)</option>
                  </select>
                </div>

                <div className="form-group-custom">
                  <label className="form-label-custom">Support Ticket Reference *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. TICKET-9821 or ISSUE-404"
                    value={grantForm.ticket_ref}
                    onChange={(e) => setGrantForm({ ...grantForm, ticket_ref: e.target.value })}
                    className="form-input-custom font-mono"
                  />
                </div>

                <div className="form-group-custom">
                  <label className="form-label-custom">Support Justification Reason *</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Explain why tenant diagnosis access is required..."
                    value={grantForm.reason}
                    onChange={(e) => setGrantForm({ ...grantForm, reason: e.target.value })}
                    className="form-input-custom textarea"
                  />
                </div>
              </div>

              <div className="modal-dialog-footer">
                <button
                  type="button"
                  onClick={() => setShowGrantModal(false)}
                  className="btn-enterprise btn-outline-soft"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-enterprise btn-primary"
                >
                  {loading ? 'Issuing Grant...' : 'Issue Scoped Grant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Revoke Grant Dialog */}
      {revokeModal.isOpen && revokeModal.grant && (
        <div className="modal-backdrop-blur">
          <div className="modal-dialog-card animate-badge-pop" style={{ maxWidth: '480px' }}>
            <div className="modal-dialog-header">
              <div className="modal-header-icon-wrap rose">
                <Ban size={20} />
              </div>
              <div className="modal-header-text">
                <h3 className="modal-header-title">Revoke Support Grant</h3>
                <p className="modal-header-subtitle">Immediately terminate diagnostic session.</p>
              </div>
              <button
                type="button"
                className="modal-close-icon-btn"
                onClick={() => setRevokeModal((m) => ({ ...m, isOpen: false }))}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleConfirmRevoke}>
              <div className="modal-dialog-body">
                {revokeModal.error && (
                  <div className="approvals-feedback-banner danger animate-slide-up" style={{ marginBottom: '16px' }}>
                    <div className="feedback-content">
                      <AlertTriangle size={15} />
                      <span>{revokeModal.error}</span>
                    </div>
                  </div>
                )}

                <p className="modal-instruction-text">
                  Are you sure you want to revoke support grant for{' '}
                  <strong>{revokeModal.grant.college_name}</strong> (Ticket:{' '}
                  <span className="code-pill font-mono">{revokeModal.grant.ticket_ref}</span>)?
                  This operation is immediately recorded to the audit trail.
                </p>

                <div className="form-group-custom">
                  <label className="form-label-custom">Revocation Reason *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Investigation completed or ticket closed..."
                    value={revokeModal.reason}
                    onChange={(e) => setRevokeModal((m) => ({ ...m, reason: e.target.value }))}
                    className="form-input-custom"
                  />
                </div>
              </div>

              <div className="modal-dialog-footer">
                <button
                  type="button"
                  className="btn-enterprise btn-outline-soft"
                  onClick={() => setRevokeModal((m) => ({ ...m, isOpen: false }))}
                  disabled={revokeModal.submitting}
                >
                  Keep Grant
                </button>
                <button
                  type="submit"
                  className="btn-enterprise btn-danger"
                  disabled={revokeModal.submitting || !revokeModal.reason.trim()}
                >
                  {revokeModal.submitting ? 'Revoking...' : 'Confirm Revocation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
