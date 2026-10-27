import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import {
  fetchCollege,
  fetchEffectiveSettings,
  fetchSettingDefinitions,
  fetchSettingComparisons,
  fetchSettingHistory,
  fetchPendingApprovals,
  updateCollegeSetting,
  resetCollegeSetting,
  revertCollegeSetting,
  submitConfigurationApproval,
} from '../services/collegeConfigurationService';

const SUPPORTED_LOCALES = [
  { value: 'en-IN', label: 'English (India) - en-IN' },
  { value: 'hi-IN', label: 'Hindi (India) - hi-IN' },
  { value: 'ta-IN', label: 'Tamil (India) - ta-IN' },
  { value: 'te-IN', label: 'Telugu (India) - te-IN' },
  { value: 'mr-IN', label: 'Marathi (India) - mr-IN' },
  { value: 'bn-IN', label: 'Bengali (India) - bn-IN' },
  { value: 'gu-IN', label: 'Gujarati (India) - gu-IN' },
  { value: 'kn-IN', label: 'Kannada (India) - kn-IN' },
  { value: 'ml-IN', label: 'Malayalam (India) - ml-IN' },
  { value: 'pa-IN', label: 'Punjabi (India) - pa-IN' },
  { value: 'en-US', label: 'English (United States) - en-US' },
  { value: 'en-GB', label: 'English (United Kingdom) - en-GB' },
];

const MONTHS = [
  { value: '01', label: '01 - January' },
  { value: '02', label: '02 - February' },
  { value: '03', label: '03 - March' },
  { value: '04', label: '04 - April' },
  { value: '05', label: '05 - May' },
  { value: '06', label: '06 - June (Standard Academic Cycle)' },
  { value: '07', label: '07 - July' },
  { value: '08', label: '08 - August' },
  { value: '09', label: '09 - September' },
  { value: '10', label: '10 - October' },
  { value: '11', label: '11 - November' },
  { value: '12', label: '12 - December' },
];

const RETENTION_CLASSIFICATIONS = [
  { value: 'STANDARD', label: 'STANDARD - 7 Years Statutory Regulatory Retention' },
  { value: 'EXTENDED', label: 'EXTENDED - 10 Years Extended Compliance Retention' },
  { value: 'ARCHIVAL', label: 'ARCHIVAL - 15+ Years Historical Permanent Archival' },
  { value: 'LEGAL_HOLD', label: 'LEGAL_HOLD - Indefinite Statutory Legal Hold' },
];

const ALL_NOTIFICATION_CHANNELS = [
  {
    id: 'EMAIL',
    name: 'Email Delivery (SMTP/SES)',
    description: 'Primary administrative alert channel for urgent dispatch and receipts',
    defaultPermitted: true,
    deliveryStatus: 'OPERATIONAL',
    statusNote: 'SES relay connected',
  },
  {
    id: 'SMS',
    name: 'SMS Alerts (Telecom Gateway)',
    description: 'Urgent security broadcasts and student check-in/out notices',
    defaultPermitted: false,
    deliveryStatus: 'CONFIGURED',
    statusNote: 'Gateway provider configured; rate limits applied',
  },
  {
    id: 'WHATSAPP',
    name: 'WhatsApp Business API',
    description: 'Direct guardian emergency notifications and automated hostel alerts',
    defaultPermitted: false,
    deliveryStatus: 'STANDBY',
    statusNote: 'Authorized channel; awaiting webhook verification',
  },
  {
    id: 'IN_APP',
    name: 'In-App Notification Feed',
    description: 'Platform notification center, push broadcasts, and portal alerts',
    defaultPermitted: true,
    deliveryStatus: 'OPERATIONAL',
    statusNote: 'Internal bus operational',
  },
];

export default function CollegeConfigurationPage() {
  const { id, collegeId: routeCollegeId } = useParams();
  const collegeId = id || routeCollegeId;
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = searchParams.get('tab') || 'overview';
  const setActiveTab = (tab) => {
    setSearchParams({ tab });
  };

  // Authoritative server data
  const [college, setCollege] = useState(null);
  const [settings, setSettings] = useState([]);
  const [definitions, setDefinitions] = useState([]);
  const [comparisons, setComparisons] = useState([]);
  const [historyEntries, setHistoryEntries] = useState([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [pendingApprovals, setPendingApprovals] = useState([]);

  // Loading & error state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [actionNotice, setActionNotice] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form states and initial snapshots for dirty tracking
  const [generalForm, setGeneralForm] = useState({
    college_name: '',
    logo_url: '',
    contact_email: '',
    contact_phone: '',
    address: '',
    timezone: 'Asia/Kolkata',
    locale: 'en-IN',
    academic_year_start: '06',
    reason: '',
  });
  const [initialGeneralForm, setInitialGeneralForm] = useState(null);

  const [securityForm, setSecurityForm] = useState({
    password_policy: {
      min_length: 8,
      require_uppercase: true,
      require_lowercase: true,
      require_number: true,
      require_special_char: true,
      max_age_days: 90,
    },
    session_policy: {
      idle_timeout_minutes: 30,
      absolute_timeout_hours: 24,
      max_concurrent_sessions: 2,
    },
    reason: '',
  });
  const [initialSecurityForm, setInitialSecurityForm] = useState(null);

  const [retentionForm, setRetentionForm] = useState({
    classification: 'STANDARD',
    retention_years: 7,
    reason: '',
  });
  const [initialRetentionForm, setInitialRetentionForm] = useState(null);

  const [notificationChannels, setNotificationChannels] = useState(['EMAIL', 'IN_APP']);
  const [initialNotificationChannels, setInitialNotificationChannels] = useState(['EMAIL', 'IN_APP']);
  const [notificationReason, setNotificationReason] = useState('');

  // Modals
  const [resetModal, setResetModal] = useState({ show: false, key: '', displayName: '', reason: '' });
  const [revertModal, setRevertModal] = useState({ show: false, entry: null, reason: '' });
  const [approvalModal, setApprovalModal] = useState({ show: false, key: '', proposedValue: null, reason: '' });

  // Comparison filter states
  const [compareSearch, setCompareSearch] = useState('');
  const [compareOnlyOverrides, setCompareOnlyOverrides] = useState(false);

  // History filtering
  const [historyKeyFilter, setHistoryKeyFilter] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const historyPageSize = 10;

  // Stale request prevention
  const reqCounterRef = useRef(0);
  const abortCtrlRef = useRef(null);

  // Load all configuration datasets
  const loadConfigurationData = useCallback(async () => {
    if (!collegeId) return;
    const reqId = ++reqCounterRef.current;
    setLoading(true);
    setError(null);
    setPermissionDenied(false);

    if (abortCtrlRef.current) {
      abortCtrlRef.current.abort();
    }
    const controller = new AbortController();
    abortCtrlRef.current = controller;

    try {
      // 1. Fetch authoritative college
      const colData = await fetchCollege(collegeId, controller.signal);
      if (reqCounterRef.current !== reqId) return;
      if (!colData) {
        throw { status: 404, message: `College record not found (ID: ${collegeId})` };
      }
      setCollege(colData);

      // 2. Concurrently fetch settings, comparisons, definitions, history, and pending approvals
      const [settingsRes, defsRes, compRes, histRes, appRes] = await Promise.allSettled([
        fetchEffectiveSettings(collegeId, { limit: 100, signal: controller.signal }),
        fetchSettingDefinitions(collegeId, controller.signal),
        fetchSettingComparisons(collegeId, { signal: controller.signal }),
        fetchSettingHistory(collegeId, {
          key: historyKeyFilter,
          limit: historyPageSize,
          offset: (historyPage - 1) * historyPageSize,
          signal: controller.signal,
        }),
        fetchPendingApprovals(collegeId, controller.signal),
      ]);

      if (reqCounterRef.current !== reqId) return;

      const effectiveSettings = settingsRes.status === 'fulfilled' ? settingsRes.value.settings : [];
      const loadedDefs = defsRes.status === 'fulfilled' ? defsRes.value : [];
      const loadedComps = compRes.status === 'fulfilled' ? compRes.value : [];
      const loadedHist = histRes.status === 'fulfilled' ? histRes.value : { history: [], total: 0 };
      const loadedApprovals = appRes.status === 'fulfilled' ? appRes.value : [];

      setSettings(effectiveSettings);
      setDefinitions(loadedDefs);
      setComparisons(loadedComps);
      setHistoryEntries(loadedHist.history || []);
      setHistoryTotal(loadedHist.total || 0);
      setPendingApprovals(loadedApprovals);

      // Populate General Form
      const nameSt = effectiveSettings.find((s) => s.setting_key === 'college_name');
      const logoSt = effectiveSettings.find((s) => s.setting_key === 'logo_url');
      const emailSt = effectiveSettings.find((s) => s.setting_key === 'contact_email');
      const phoneSt = effectiveSettings.find((s) => s.setting_key === 'contact_phone');
      const addrSt = effectiveSettings.find((s) => s.setting_key === 'address');
      const tzSt = effectiveSettings.find((s) => s.setting_key === 'timezone');
      const locSt = effectiveSettings.find((s) => s.setting_key === 'locale');
      const yrSt = effectiveSettings.find((s) => s.setting_key === 'academic_year_start');

      const initialGen = {
        college_name: nameSt ? String(nameSt.value || '') : colData.name || '',
        logo_url: logoSt ? String(logoSt.value || '') : '',
        contact_email: emailSt ? String(emailSt.value || '') : colData.contact_email || '',
        contact_phone: phoneSt ? String(phoneSt.value || '') : '',
        address: addrSt ? String(addrSt.value || '') : '',
        timezone: tzSt ? String(tzSt.value || '') : colData.timezone || 'Asia/Kolkata',
        locale: locSt ? String(locSt.value || 'en-IN') : 'en-IN',
        academic_year_start: yrSt ? String(yrSt.value || '06') : '06',
        reason: '',
      };
      setGeneralForm(initialGen);
      setInitialGeneralForm(initialGen);

      // Populate Security Form
      const pwSt = effectiveSettings.find((s) => s.setting_key === 'password_policy');
      const sessSt = effectiveSettings.find((s) => s.setting_key === 'session_policy');
      const initialSec = {
        password_policy: {
          min_length: (pwSt?.value && Number(pwSt.value.min_length)) || 8,
          require_uppercase: pwSt?.value?.require_uppercase !== false,
          require_lowercase: pwSt?.value?.require_lowercase !== false,
          require_number: pwSt?.value?.require_number !== false,
          require_special_char: pwSt?.value?.require_special_char !== false,
          max_age_days: (pwSt?.value && Number(pwSt.value.max_age_days)) || 90,
        },
        session_policy: {
          idle_timeout_minutes: (sessSt?.value && Number(sessSt.value.idle_timeout_minutes)) || 30,
          absolute_timeout_hours: (sessSt?.value && Number(sessSt.value.absolute_timeout_hours)) || 24,
          max_concurrent_sessions: (sessSt?.value && Number(sessSt.value.max_concurrent_sessions)) || 2,
        },
        reason: '',
      };
      setSecurityForm(initialSec);
      setInitialSecurityForm(initialSec);

      // Populate Retention Form
      const retSt = effectiveSettings.find((s) => s.setting_key === 'data_retention_policy');
      const initialRet = {
        classification: (retSt?.value && retSt.value.classification) || 'STANDARD',
        retention_years: (retSt?.value && Number(retSt.value.retention_years)) || 7,
        reason: '',
      };
      setRetentionForm(initialRet);
      setInitialRetentionForm(initialRet);

      // Populate Notification Channels Form
      const chSt = effectiveSettings.find((s) => s.setting_key === 'allowed_notification_channels');
      const initialChannels = (chSt && Array.isArray(chSt.value) && chSt.value.length > 0) ? chSt.value : ['EMAIL', 'IN_APP'];
      setNotificationChannels(initialChannels);
      setInitialNotificationChannels(initialChannels);
    } catch (err) {
      if (
        err?.name === 'CanceledError' ||
        err?.name === 'AbortError' ||
        err?.isCanceled ||
        err?.message === 'canceled' ||
        err?.code === 'ERR_CANCELED' ||
        controller.signal.aborted
      ) {
        return;
      }
      if (reqCounterRef.current === reqId) {
        if (err.status === 403 || err.code === 'FORBIDDEN') {
          setPermissionDenied(true);
        } else {
          setError(err.message || 'Failed to load college configuration workspace');
        }
      }
    } finally {
      if (reqCounterRef.current === reqId) {
        setLoading(false);
      }
    }
  }, [collegeId, historyKeyFilter, historyPage]);

  // Initial load and collegeId cleanup
  useEffect(() => {
    loadConfigurationData();
    return () => {
      if (abortCtrlRef.current) {
        abortCtrlRef.current.abort();
      }
    };
  }, [loadConfigurationData]);

  // Dirty state computations
  const isGeneralDirty = useMemo(() => {
    if (!initialGeneralForm) return false;
    return (
      generalForm.college_name !== initialGeneralForm.college_name ||
      generalForm.logo_url !== initialGeneralForm.logo_url ||
      generalForm.contact_email !== initialGeneralForm.contact_email ||
      generalForm.contact_phone !== initialGeneralForm.contact_phone ||
      generalForm.address !== initialGeneralForm.address ||
      generalForm.timezone !== initialGeneralForm.timezone ||
      generalForm.locale !== initialGeneralForm.locale ||
      generalForm.academic_year_start !== initialGeneralForm.academic_year_start
    );
  }, [generalForm, initialGeneralForm]);

  const isSecurityDirty = useMemo(() => {
    if (!initialSecurityForm) return false;
    return (
      securityForm.password_policy.min_length !== initialSecurityForm.password_policy.min_length ||
      securityForm.password_policy.max_age_days !== initialSecurityForm.password_policy.max_age_days ||
      securityForm.password_policy.require_lowercase !== initialSecurityForm.password_policy.require_lowercase ||
      securityForm.password_policy.require_special_char !== initialSecurityForm.password_policy.require_special_char ||
      securityForm.session_policy.idle_timeout_minutes !== initialSecurityForm.session_policy.idle_timeout_minutes ||
      securityForm.session_policy.absolute_timeout_hours !== initialSecurityForm.session_policy.absolute_timeout_hours ||
      securityForm.session_policy.max_concurrent_sessions !== initialSecurityForm.session_policy.max_concurrent_sessions
    );
  }, [securityForm, initialSecurityForm]);

  const isRetentionDirty = useMemo(() => {
    if (!initialRetentionForm) return false;
    return (
      retentionForm.classification !== initialRetentionForm.classification ||
      retentionForm.retention_years !== initialRetentionForm.retention_years
    );
  }, [retentionForm, initialRetentionForm]);

  const isNotificationDirty = useMemo(() => {
    if (!initialNotificationChannels) return false;
    const a = [...notificationChannels].sort().join(',');
    const b = [...initialNotificationChannels].sort().join(',');
    return a !== b;
  }, [notificationChannels, initialNotificationChannels]);

  // Save single setting override
  const handleSaveSetting = async (key, value, reasonText) => {
    setActionNotice(null);
    setActionError(null);
    setSubmitting(true);
    try {
      const payload = { setting_value: value };
      if (reasonText && reasonText.trim()) {
        payload.reason = reasonText.trim();
      }
      await updateCollegeSetting(collegeId, key, payload);
      setActionNotice(`Setting '${key}' updated successfully.`);
      await loadConfigurationData();
    } catch (err) {
      setActionError(err.message || `Failed to update setting '${key}'`);
    } finally {
      setSubmitting(false);
    }
  };

  // Confirm reset to global baseline
  const handleConfirmReset = async () => {
    if (!resetModal.key) return;
    if (!resetModal.reason.trim()) {
      setActionError('A valid change reason is required to reset a setting.');
      return;
    }
    setActionNotice(null);
    setActionError(null);
    setSubmitting(true);
    try {
      await resetCollegeSetting(collegeId, resetModal.key, resetModal.reason.trim());
      setActionNotice(`Setting '${resetModal.displayName || resetModal.key}' reset to global baseline successfully.`);
      setResetModal({ show: false, key: '', displayName: '', reason: '' });
      await loadConfigurationData();
    } catch (err) {
      setActionError(err.message || `Failed to reset setting '${resetModal.key}'`);
    } finally {
      setSubmitting(false);
    }
  };

  // Confirm rollback to historical audit version
  const handleConfirmRevert = async () => {
    if (!revertModal.entry) return;
    if (!revertModal.reason.trim()) {
      setActionError('A clear justification reason is required to rollback a setting version.');
      return;
    }
    setActionNotice(null);
    setActionError(null);
    setSubmitting(true);
    try {
      await revertCollegeSetting(collegeId, revertModal.entry.setting_key, {
        auditId: revertModal.entry.audit_id,
        reason: revertModal.reason.trim(),
      });
      setActionNotice(`Setting '${revertModal.entry.setting_key}' reverted to historical version successfully.`);
      setRevertModal({ show: false, entry: null, reason: '' });
      await loadConfigurationData();
    } catch (err) {
      setActionError(err.message || 'Failed to rollback configuration version');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit change for approval
  const handleConfirmApprovalRequest = async () => {
    if (!approvalModal.key) return;
    if (!approvalModal.reason.trim()) {
      setActionError('An explicit business justification is required when submitting changes for approval.');
      return;
    }
    setActionNotice(null);
    setActionError(null);
    setSubmitting(true);
    try {
      await submitConfigurationApproval({
        college_id: collegeId,
        operation_type: 'COLLEGE_SETTING_OVERRIDE',
        payload: {
          setting_key: approvalModal.key,
          setting_value: approvalModal.proposedValue,
        },
        reason: approvalModal.reason.trim(),
      });
      setActionNotice(`Proposed changes for '${approvalModal.key}' submitted to approval workflow successfully.`);
      setApprovalModal({ show: false, key: '', proposedValue: null, reason: '' });
      await loadConfigurationData();
    } catch (err) {
      setActionError(err.message || 'Failed to submit approval request');
    } finally {
      setSubmitting(false);
    }
  };

  // Find setting by key helper
  const findSetting = (key) => settings.find((s) => s.setting_key === key);

  // Statistics
  const totalCount = settings.length;
  const overriddenCount = settings.filter((s) => s.is_overridden).length;
  const inheritedCount = totalCount - overriddenCount;
  const pendingApprovalsCount = pendingApprovals.length;

  // Filtered comparisons
  const filteredComparisons = useMemo(() => {
    return comparisons.filter((c) => {
      if (compareOnlyOverrides && !c.is_overridden) return false;
      if (!compareSearch.trim()) return true;
      const q = compareSearch.toLowerCase();
      return (
        c.setting_key.toLowerCase().includes(q) ||
        (c.display_name && c.display_name.toLowerCase().includes(q)) ||
        c.category.toLowerCase().includes(q)
      );
    });
  }, [comparisons, compareOnlyOverrides, compareSearch]);

  if (loading && !college) {
    return (
      <div style={{ padding: '60px 32px', textAlign: 'center', color: '#64748b' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>⚙️</div>
        <h3 style={{ color: '#0f172a', fontWeight: '600' }}>Loading College Configuration</h3>
        <p style={{ fontSize: '0.875rem' }}>Fetching tenant parameters, baseline defaults, and audit history...</p>
      </div>
    );
  }

  if (permissionDenied) {
    return (
      <div style={{ padding: '40px 32px', maxWidth: '720px', margin: '40px auto' }}>
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '28px', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>🚫</div>
          <h2 style={{ color: '#991b1b', marginBottom: '8px' }}>Permission Denied</h2>
          <p style={{ color: '#7f1d1d', marginBottom: '20px', fontSize: '0.9rem' }}>
            Access to College Configuration requires Super Admin platform-scope authorization. Your account does not have sufficient permissions to view or edit tenant platform configuration.
          </p>
          <Link to="/colleges" className="btn btn-outline">
            ← Return to Colleges Directory
          </Link>
        </div>
      </div>
    );
  }

  if (error && !college) {
    return (
      <div style={{ padding: '40px 32px', maxWidth: '720px', margin: '40px auto' }}>
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '28px', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>⚠️</div>
          <h2 style={{ color: '#991b1b', marginBottom: '8px' }}>College Configuration Unavailable</h2>
          <p style={{ color: '#7f1d1d', marginBottom: '20px', fontSize: '0.9rem' }}>{error}</p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={loadConfigurationData}>
              🔄 Try Again
            </button>
            <Link to="/colleges" className="btn btn-outline">
              ← Return to Directory
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* 1. Header & Breadcrumb */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '0.875rem', marginBottom: '8px' }}>
          <Link to="/dashboard" style={{ color: '#64748b', textDecoration: 'none' }}>Super Admin</Link>
          <span>/</span>
          <Link to="/colleges" style={{ color: '#64748b', textDecoration: 'none' }}>Colleges</Link>
          <span>/</span>
          <Link to={`/colleges/${college.college_id}`} style={{ color: '#64748b', textDecoration: 'none' }}>
            {college.name}
          </Link>
          <span>/</span>
          <span style={{ color: '#0f172a', fontWeight: '600' }}>Configuration</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h1 style={{ fontSize: '1.75rem', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                {college.name}
              </h1>
              <span
                style={{
                  background: college.status === 'ACTIVE' ? '#ecfdf5' : '#eff6ff',
                  color: college.status === 'ACTIVE' ? '#065f46' : '#1e40af',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  letterSpacing: '0.5px',
                }}
              >
                ● {college.status}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '0.85rem', color: '#64748b', alignItems: 'center' }}>
              <span>Tenant Code: <strong style={{ fontFamily: 'monospace', color: '#0f172a' }}>{college.college_code}</strong></span>
              <span>•</span>
              <span>UUID: <span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{college.college_id}</span></span>
              <span>•</span>
              <span>Precedence: <strong style={{ color: '#2563eb' }}>Global Baseline → Tenant Overrides</strong></span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            {college.status === 'ONBOARDING' && (
              <Link to={`/colleges/${college.college_id}/onboarding`} className="btn btn-primary" id="btn-resume-onboarding">
                Resume Onboarding 🚀
              </Link>
            )}
            <Link to={`/colleges/${college.college_id}`} className="btn btn-outline" id="btn-back-to-details">
              ← Back to College Details
            </Link>
            <button className="btn btn-outline" onClick={loadConfigurationData} disabled={loading} id="btn-refresh-config" title="Refresh authoritative configuration">
              🔄 Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Action Notices */}
      {actionNotice && (
        <div style={{ padding: '12px 16px', background: '#ecfdf5', borderLeft: '4px solid #10b981', color: '#065f46', fontSize: '0.875rem', marginBottom: '20px', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>✓ {actionNotice}</span>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#065f46', fontWeight: 'bold' }} onClick={() => setActionNotice(null)}>✕</button>
        </div>
      )}
      {actionError && (
        <div style={{ padding: '12px 16px', background: '#fef2f2', borderLeft: '4px solid #ef4444', color: '#991b1b', fontSize: '0.875rem', marginBottom: '20px', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>✕ {actionError}</span>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b', fontWeight: 'bold' }} onClick={() => setActionError(null)}>✕</button>
        </div>
      )}

      {/* Tab Navigation */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', gap: '4px', marginBottom: '24px' }}>
        {[
          { id: 'overview', label: '1. Overview', icon: '📊', isDirty: false },
          { id: 'general', label: '2. General', icon: '🏛️', isDirty: isGeneralDirty },
          { id: 'security', label: '3. Security & Policy', icon: '🛡️', isDirty: isSecurityDirty },
          { id: 'retention', label: '4. Data Retention', icon: '🗄️', isDirty: isRetentionDirty },
          { id: 'notifications', label: '5. Notification Channels', icon: '📢', isDirty: isNotificationDirty },
          { id: 'compare', label: '6. Defaults & Comparison', icon: '⚖️', isDirty: false },
          { id: 'history', label: '7. History & Rollback', icon: '📜', isDirty: false },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 18px',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === tab.id ? '3px solid #2563eb' : '3px solid transparent',
              color: activeTab === tab.id ? '#2563eb' : '#64748b',
              fontWeight: activeTab === tab.id ? '700' : '500',
              cursor: 'pointer',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              position: 'relative',
            }}
            id={`tab-btn-${tab.id}`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.isDirty && (
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#f59e0b',
                  display: 'inline-block',
                }}
                title="Unsaved changes in this tab"
              />
            )}
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div>
          {/* Key Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
            <div className="card" style={{ padding: '20px', borderLeft: '4px solid #3b82f6' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>
                Platform Settings Catalog
              </div>
              <div style={{ fontSize: '2rem', fontWeight: '700', color: '#0f172a', marginTop: '4px' }}>
                {totalCount}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                Permitted platform tenant keys
              </div>
            </div>

            <div className="card" style={{ padding: '20px', borderLeft: '4px solid #10b981' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>
                Inherited Baseline Defaults
              </div>
              <div style={{ fontSize: '2rem', fontWeight: '700', color: '#059669', marginTop: '4px' }}>
                {inheritedCount}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                Adhering to company standard baseline
              </div>
            </div>

            <div className="card" style={{ padding: '20px', borderLeft: '4px solid #f59e0b' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>
                Explicit Tenant Overrides
              </div>
              <div style={{ fontSize: '2rem', fontWeight: '700', color: '#d97706', marginTop: '4px' }}>
                {overriddenCount}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                Customized institution overrides
              </div>
            </div>

            <div className="card" style={{ padding: '20px', borderLeft: '4px solid #8b5cf6' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>
                Pending Approvals
              </div>
              <div style={{ fontSize: '2rem', fontWeight: '700', color: '#7c3aed', marginTop: '4px' }}>
                {pendingApprovalsCount}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                {pendingApprovalsCount > 0 ? 'Awaiting reviewer decision' : 'All change requests clear'}
              </div>
            </div>
          </div>

          {/* Pending Approval Notice if any */}
          {pendingApprovalsCount > 0 && (
            <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderLeft: '5px solid #d97706', padding: '16px 20px', borderRadius: '6px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: '700', color: '#92400e', fontSize: '0.95rem' }}>
                    ⏳ Pending Configuration Changes in Approval Workflow
                  </div>
                  <div style={{ color: '#78350f', fontSize: '0.85rem', marginTop: '4px' }}>
                    There are {pendingApprovalsCount} pending change requests for this tenant. Pending settings will not become effective until authorized by maker-checker review.
                  </div>
                </div>
                <Link to="/approvals" className="btn btn-outline btn-sm" style={{ background: '#ffffff', borderColor: '#fcd34d' }}>
                  View Approvals Pipeline →
                </Link>
              </div>
            </div>
          )}

          {/* Architecture Precedence Diagram */}
          <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>
              📐 Configuration Precedence & Layering Architecture
            </h3>
            <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '16px' }}>
              Platform configuration enforces strict hierarchical layering. Global company standards establish mandatory security floors; colleges may customize permitted overrides, but security rules can never weaken company minimums.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', alignItems: 'center' }}>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Layer 1</div>
                <div style={{ fontSize: '1rem', fontWeight: '700', color: '#1e293b', marginTop: '4px' }}>Global Defaults</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>Company security floors & default policies</div>
              </div>

              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: '700', textTransform: 'uppercase' }}>Layer 2</div>
                <div style={{ fontSize: '1rem', fontWeight: '700', color: '#1e40af', marginTop: '4px' }}>College Profile</div>
                <div style={{ fontSize: '0.75rem', color: '#1e3a8a', marginTop: '4px' }}>Root college record attributes</div>
              </div>

              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: '#d97706', fontWeight: '700', textTransform: 'uppercase' }}>Layer 3</div>
                <div style={{ fontSize: '1rem', fontWeight: '700', color: '#b45309', marginTop: '4px' }}>Tenant Overrides</div>
                <div style={{ fontSize: '0.75rem', color: '#92400e', marginTop: '4px' }}>Explicit custom overrides per college</div>
              </div>

              <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '6px', padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: '#059669', fontWeight: '700', textTransform: 'uppercase' }}>Layer 4</div>
                <div style={{ fontSize: '1rem', fontWeight: '700', color: '#065f46', marginTop: '4px' }}>Effective Value</div>
                <div style={{ fontSize: '0.75rem', color: '#047857', marginTop: '4px' }}>Authoritative runtime configuration</div>
              </div>
            </div>
          </div>

          {/* Domain Breakdown Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
            <div className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: '#0f172a' }}>
                  🏛️ General Institution Parameters
                </h4>
                <button className="btn btn-outline btn-sm" onClick={() => setActiveTab('general')}>
                  Manage General →
                </button>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.85rem' }}>
                <li style={{ padding: '8px 0', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Timezone:</span>
                  <strong style={{ color: '#0f172a' }}>{findSetting('timezone')?.value || college.timezone || 'Asia/Kolkata'}</strong>
                </li>
                <li style={{ padding: '8px 0', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Default Locale:</span>
                  <strong style={{ color: '#0f172a' }}>{findSetting('locale')?.value || 'en-IN'}</strong>
                </li>
                <li style={{ padding: '8px 0', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Academic Year Start:</span>
                  <strong style={{ color: '#0f172a' }}>Month {findSetting('academic_year_start')?.value || '06'}</strong>
                </li>
              </ul>
            </div>

            <div className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: '#0f172a' }}>
                  🛡️ Security & Session Baseline
                </h4>
                <button className="btn btn-outline btn-sm" onClick={() => setActiveTab('security')}>
                  Manage Security →
                </button>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.85rem' }}>
                <li style={{ padding: '8px 0', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Password Min Length:</span>
                  <strong style={{ color: '#0f172a' }}>{findSetting('password_policy')?.value?.min_length || 8} chars (Floor: ≥ 8)</strong>
                </li>
                <li style={{ padding: '8px 0', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Idle Session Timeout:</span>
                  <strong style={{ color: '#0f172a' }}>{findSetting('session_policy')?.value?.idle_timeout_minutes || 30} mins (Floor: ≤ 30)</strong>
                </li>
                <li style={{ padding: '8px 0', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Absolute Lifetime:</span>
                  <strong style={{ color: '#0f172a' }}>{findSetting('session_policy')?.value?.absolute_timeout_hours || 24} hours (Floor: ≤ 24)</strong>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: GENERAL SETTINGS */}
      {activeTab === 'general' && (
        <div className="card" style={{ padding: '28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                🏛️ General Institution Parameters
              </h3>
              <p style={{ color: '#64748b', fontSize: '0.875rem', margin: '4px 0 0 0' }}>
                Configure permitted platform tenant branding, contact channels, regional localization, and academic cycle.
              </p>
            </div>
            {isGeneralDirty && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: '#d97706', fontWeight: '600' }}>● Unsaved Changes</span>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setGeneralForm({ ...initialGeneralForm })}
                >
                  Discard
                </button>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px' }}>
            {/* College Name */}
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                College Display Name
                {findSetting('college_name')?.is_overridden ? (
                  <span style={{ marginLeft: '8px', color: '#d97706', fontSize: '0.75rem', fontWeight: 'normal' }}>[Explicit Override]</span>
                ) : (
                  <span style={{ marginLeft: '8px', color: '#059669', fontSize: '0.75rem', fontWeight: 'normal' }}>[Inherited from College Record]</span>
                )}
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={generalForm.college_name}
                  onChange={(e) => setGeneralForm({ ...generalForm, college_name: e.target.value })}
                  className="form-control"
                  style={{ flex: 1, padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  placeholder="Official institutional display name"
                />
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={submitting}
                  onClick={() => handleSaveSetting('college_name', generalForm.college_name, generalForm.reason)}
                >
                  Save
                </button>
                {findSetting('college_name')?.is_overridden && (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setResetModal({ show: true, key: 'college_name', displayName: 'College Name', reason: '' })}
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Logo URL */}
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                College Logo URL
                {findSetting('logo_url')?.is_overridden ? (
                  <span style={{ marginLeft: '8px', color: '#d97706', fontSize: '0.75rem', fontWeight: 'normal' }}>[Explicit Override]</span>
                ) : (
                  <span style={{ marginLeft: '8px', color: '#64748b', fontSize: '0.75rem', fontWeight: 'normal' }}>[Default: None]</span>
                )}
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={generalForm.logo_url}
                  onChange={(e) => setGeneralForm({ ...generalForm, logo_url: e.target.value })}
                  className="form-control"
                  style={{ flex: 1, padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  placeholder="https://example.edu/assets/logo.png"
                />
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={submitting}
                  onClick={() => handleSaveSetting('logo_url', generalForm.logo_url, generalForm.reason)}
                >
                  Save
                </button>
                {findSetting('logo_url')?.is_overridden && (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setResetModal({ show: true, key: 'logo_url', displayName: 'Logo URL', reason: '' })}
                  >
                    Reset
                  </button>
                )}
              </div>
              <small style={{ color: '#64748b', display: 'block', marginTop: '4px' }}>
                Note: File upload service is not integrated; enter an authorized HTTPS image asset URL.
              </small>
            </div>

            {/* Contact Email */}
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Primary Administrative Contact Email
                {findSetting('contact_email')?.is_overridden ? (
                  <span style={{ marginLeft: '8px', color: '#d97706', fontSize: '0.75rem', fontWeight: 'normal' }}>[Explicit Override]</span>
                ) : (
                  <span style={{ marginLeft: '8px', color: '#059669', fontSize: '0.75rem', fontWeight: 'normal' }}>[Inherited from College Record]</span>
                )}
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="email"
                  value={generalForm.contact_email}
                  onChange={(e) => setGeneralForm({ ...generalForm, contact_email: e.target.value })}
                  className="form-control"
                  style={{ flex: 1, padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  placeholder="admin@institution.edu"
                />
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={submitting}
                  onClick={() => handleSaveSetting('contact_email', generalForm.contact_email, generalForm.reason)}
                >
                  Save
                </button>
                {findSetting('contact_email')?.is_overridden && (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setResetModal({ show: true, key: 'contact_email', displayName: 'Contact Email', reason: '' })}
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Contact Phone */}
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Administrative Contact Phone
                {findSetting('contact_phone')?.is_overridden ? (
                  <span style={{ marginLeft: '8px', color: '#d97706', fontSize: '0.75rem', fontWeight: 'normal' }}>[Explicit Override]</span>
                ) : (
                  <span style={{ marginLeft: '8px', color: '#64748b', fontSize: '0.75rem', fontWeight: 'normal' }}>[Default: None]</span>
                )}
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={generalForm.contact_phone}
                  onChange={(e) => setGeneralForm({ ...generalForm, contact_phone: e.target.value })}
                  className="form-control"
                  style={{ flex: 1, padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  placeholder="+91-9876543210"
                />
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={submitting}
                  onClick={() => handleSaveSetting('contact_phone', generalForm.contact_phone, generalForm.reason)}
                >
                  Save
                </button>
                {findSetting('contact_phone')?.is_overridden && (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setResetModal({ show: true, key: 'contact_phone', displayName: 'Contact Phone', reason: '' })}
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Campus Physical Address */}
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Campus Physical Address
                {findSetting('address')?.is_overridden ? (
                  <span style={{ marginLeft: '8px', color: '#d97706', fontSize: '0.75rem', fontWeight: 'normal' }}>[Explicit Override]</span>
                ) : (
                  <span style={{ marginLeft: '8px', color: '#64748b', fontSize: '0.75rem', fontWeight: 'normal' }}>[Default: None]</span>
                )}
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={generalForm.address}
                  onChange={(e) => setGeneralForm({ ...generalForm, address: e.target.value })}
                  className="form-control"
                  style={{ flex: 1, padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  placeholder="Official campus street, locality, district"
                />
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={submitting}
                  onClick={() => handleSaveSetting('address', generalForm.address, generalForm.reason)}
                >
                  Save
                </button>
                {findSetting('address')?.is_overridden && (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setResetModal({ show: true, key: 'address', displayName: 'Campus Address', reason: '' })}
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Timezone */}
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Institutional Timezone (IANA)
                {findSetting('timezone')?.is_overridden ? (
                  <span style={{ marginLeft: '8px', color: '#d97706', fontSize: '0.75rem', fontWeight: 'normal' }}>[Explicit Override]</span>
                ) : (
                  <span style={{ marginLeft: '8px', color: '#059669', fontSize: '0.75rem', fontWeight: 'normal' }}>[Inherited: {college.timezone || 'Asia/Kolkata'}]</span>
                )}
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={generalForm.timezone}
                  onChange={(e) => setGeneralForm({ ...generalForm, timezone: e.target.value })}
                  className="form-control"
                  style={{ flex: 1, padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  placeholder="Asia/Kolkata"
                />
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={submitting}
                  onClick={() => handleSaveSetting('timezone', generalForm.timezone, generalForm.reason)}
                >
                  Save
                </button>
                {findSetting('timezone')?.is_overridden && (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setResetModal({ show: true, key: 'timezone', displayName: 'Timezone', reason: '' })}
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Locale */}
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Default UI Locale
                {findSetting('locale')?.is_overridden ? (
                  <span style={{ marginLeft: '8px', color: '#d97706', fontSize: '0.75rem', fontWeight: 'normal' }}>[Explicit Override]</span>
                ) : (
                  <span style={{ marginLeft: '8px', color: '#059669', fontSize: '0.75rem', fontWeight: 'normal' }}>[Default: en-IN]</span>
                )}
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select
                  value={generalForm.locale}
                  onChange={(e) => setGeneralForm({ ...generalForm, locale: e.target.value })}
                  className="form-control"
                  style={{ flex: 1, padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                >
                  {SUPPORTED_LOCALES.map((loc) => (
                    <option key={loc.value} value={loc.value}>{loc.label}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={submitting}
                  onClick={() => handleSaveSetting('locale', generalForm.locale, generalForm.reason)}
                >
                  Save
                </button>
                {findSetting('locale')?.is_overridden && (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setResetModal({ show: true, key: 'locale', displayName: 'Default UI Locale', reason: '' })}
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Academic Year Start Month */}
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Academic Cycle Start Month
                {findSetting('academic_year_start')?.is_overridden ? (
                  <span style={{ marginLeft: '8px', color: '#d97706', fontSize: '0.75rem', fontWeight: 'normal' }}>[Explicit Override]</span>
                ) : (
                  <span style={{ marginLeft: '8px', color: '#059669', fontSize: '0.75rem', fontWeight: 'normal' }}>[Default: 06 (June)]</span>
                )}
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select
                  value={generalForm.academic_year_start}
                  onChange={(e) => setGeneralForm({ ...generalForm, academic_year_start: e.target.value })}
                  className="form-control"
                  style={{ flex: 1, padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                >
                  {MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={submitting}
                  onClick={() => handleSaveSetting('academic_year_start', generalForm.academic_year_start, generalForm.reason)}
                >
                  Save
                </button>
                {findSetting('academic_year_start')?.is_overridden && (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setResetModal({ show: true, key: 'academic_year_start', displayName: 'Academic Year Start Month', reason: '' })}
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Change Reason Note */}
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Audit Justification / Change Reason
              </label>
              <input
                type="text"
                value={generalForm.reason}
                onChange={(e) => setGeneralForm({ ...generalForm, reason: e.target.value })}
                className="form-control"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                placeholder="e.g. Updated institutional contact per administrative request"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SECURITY & SESSION POLICY */}
      {activeTab === 'security' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Security Floors Callout */}
          <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderLeft: '5px solid #2563eb', padding: '16px 20px', borderRadius: '6px' }}>
            <div style={{ fontWeight: '700', color: '#1e3a8a', fontSize: '0.95rem' }}>
              🛡️ Mandatory Company Security Minimum Floors
            </div>
            <p style={{ color: '#334155', fontSize: '0.85rem', margin: '6px 0 0 0' }}>
              Tenant policy overrides can be <strong>stricter</strong> than platform minimums, but can <strong>never weaken company-wide security floors</strong>.
              Attempts to set password minimum length &lt; 8, password maximum age &gt; 90 days, idle session timeout &gt; 30 minutes, or absolute timeout &gt; 24 hours are <strong>strictly rejected by the backend engine</strong>.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px' }}>
            {/* Password Policy */}
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700', color: '#0f172a' }}>
                    🔑 Password Complexity Policy
                  </h4>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    Status: {findSetting('password_policy')?.is_overridden ? (
                      <span style={{ color: '#d97706', fontWeight: '700' }}>Custom Override</span>
                    ) : (
                      <span style={{ color: '#059669', fontWeight: '700' }}>Global Baseline</span>
                    )}
                  </span>
                </div>
                {findSetting('password_policy')?.is_overridden && (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setResetModal({ show: true, key: 'password_policy', displayName: 'Password Policy', reason: '' })}
                  >
                    Reset to Default
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                    Minimum Password Length
                    <span style={{ color: '#dc2626', marginLeft: '4px' }}>* (Floor: ≥ 8)</span>
                  </label>
                  <input
                    type="number"
                    min="8"
                    max="64"
                    value={securityForm.password_policy.min_length}
                    onChange={(e) => setSecurityForm({
                      ...securityForm,
                      password_policy: { ...securityForm.password_policy, min_length: Math.max(8, parseInt(e.target.value) || 8) },
                    })}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  />
                  <small style={{ color: '#64748b' }}>Setting length &lt; 8 will be rejected by platform security.</small>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                    Maximum Password Age (Days)
                    <span style={{ color: '#dc2626', marginLeft: '4px' }}>* (Floor: ≤ 90)</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="90"
                    value={securityForm.password_policy.max_age_days}
                    onChange={(e) => setSecurityForm({
                      ...securityForm,
                      password_policy: { ...securityForm.password_policy, max_age_days: Math.min(90, parseInt(e.target.value) || 90) },
                    })}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  />
                  <small style={{ color: '#64748b' }}>Setting age &gt; 90 days will be rejected by platform security.</small>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginTop: '6px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#1e293b' }}>
                    <input type="checkbox" checked={true} disabled />
                    <span>Require Uppercase (Floor: Mandatory)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#1e293b' }}>
                    <input type="checkbox" checked={true} disabled />
                    <span>Require Number (Floor: Mandatory)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#1e293b' }}>
                    <input
                      type="checkbox"
                      checked={securityForm.password_policy.require_lowercase}
                      onChange={(e) => setSecurityForm({
                        ...securityForm,
                        password_policy: { ...securityForm.password_policy, require_lowercase: e.target.checked },
                      })}
                    />
                    <span>Require Lowercase</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#1e293b' }}>
                    <input
                      type="checkbox"
                      checked={securityForm.password_policy.require_special_char}
                      onChange={(e) => setSecurityForm({
                        ...securityForm,
                        password_policy: { ...securityForm.password_policy, require_special_char: e.target.checked },
                      })}
                    />
                    <span>Require Special Character</span>
                  </label>
                </div>

                <div style={{ marginTop: '12px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                    Change Reason / Justification
                  </label>
                  <input
                    type="text"
                    value={securityForm.reason}
                    onChange={(e) => setSecurityForm({ ...securityForm, reason: e.target.value })}
                    placeholder="e.g. Higher security policy for autonomous institution compliance"
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={submitting}
                    onClick={() => handleSaveSetting('password_policy', securityForm.password_policy, securityForm.reason)}
                  >
                    Save Password Policy
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setApprovalModal({
                      show: true,
                      key: 'password_policy',
                      proposedValue: securityForm.password_policy,
                      reason: securityForm.reason,
                    })}
                  >
                    Submit for Approval
                  </button>
                </div>
              </div>
            </div>

            {/* Session Policy */}
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700', color: '#0f172a' }}>
                    ⏱️ User Session Policy
                  </h4>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    Status: {findSetting('session_policy')?.is_overridden ? (
                      <span style={{ color: '#d97706', fontWeight: '700' }}>Custom Override</span>
                    ) : (
                      <span style={{ color: '#059669', fontWeight: '700' }}>Global Baseline</span>
                    )}
                  </span>
                </div>
                {findSetting('session_policy')?.is_overridden && (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setResetModal({ show: true, key: 'session_policy', displayName: 'Session Policy', reason: '' })}
                  >
                    Reset to Default
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                    Idle Session Timeout (Minutes)
                    <span style={{ color: '#dc2626', marginLeft: '4px' }}>* (Floor: ≤ 30)</span>
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="30"
                    value={securityForm.session_policy.idle_timeout_minutes}
                    onChange={(e) => setSecurityForm({
                      ...securityForm,
                      session_policy: { ...securityForm.session_policy, idle_timeout_minutes: Math.min(30, parseInt(e.target.value) || 30) },
                    })}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  />
                  <small style={{ color: '#64748b' }}>Idle timeout &gt; 30 minutes violates company baseline.</small>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                    Absolute Session Lifetime (Hours)
                    <span style={{ color: '#dc2626', marginLeft: '4px' }}>* (Floor: ≤ 24)</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="24"
                    value={securityForm.session_policy.absolute_timeout_hours}
                    onChange={(e) => setSecurityForm({
                      ...securityForm,
                      session_policy: { ...securityForm.session_policy, absolute_timeout_hours: Math.min(24, parseInt(e.target.value) || 24) },
                    })}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  />
                  <small style={{ color: '#64748b' }}>Absolute session &gt; 24 hours violates security policy.</small>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                    Max Concurrent Sessions Per User
                    <span style={{ color: '#64748b', marginLeft: '4px' }}>(Permitted: 1 - 5)</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={securityForm.session_policy.max_concurrent_sessions}
                    onChange={(e) => setSecurityForm({
                      ...securityForm,
                      session_policy: { ...securityForm.session_policy, max_concurrent_sessions: Math.min(5, Math.max(1, parseInt(e.target.value) || 2)) },
                    })}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  />
                </div>

                <div style={{ marginTop: '12px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                    Change Reason / Justification
                  </label>
                  <input
                    type="text"
                    value={securityForm.reason}
                    onChange={(e) => setSecurityForm({ ...securityForm, reason: e.target.value })}
                    placeholder="e.g. Strict session lifetimes for exam portal"
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={submitting}
                    onClick={() => handleSaveSetting('session_policy', securityForm.session_policy, securityForm.reason)}
                  >
                    Save Session Policy
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setApprovalModal({
                      show: true,
                      key: 'session_policy',
                      proposedValue: securityForm.session_policy,
                      reason: securityForm.reason,
                    })}
                  >
                    Submit for Approval
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: DATA RETENTION */}
      {activeTab === 'retention' && (
        <div className="card" style={{ padding: '28px' }}>
          <div style={{ marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#0f172a', margin: 0 }}>
              🗄️ Statutory Data Retention Classification
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.875rem', margin: '4px 0 0 0' }}>
              Govern statutory retention rules for student records, financial audit ledgers, and operational tenant data.
            </p>
          </div>

          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: '14px 18px', borderRadius: '6px', marginBottom: '24px', fontSize: '0.85rem', color: '#92400e' }}>
            ⚠️ <strong>Legal Preservation Notice:</strong> Data retention classification governs contractual and regulatory storage duration. Changing classification does NOT silently delete historical records, and platform-level audit logs remain append-only and immutable.
          </div>

          <div style={{ maxWidth: '650px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Retention Classification Category
              </label>
              <select
                value={retentionForm.classification}
                onChange={(e) => setRetentionForm({ ...retentionForm, classification: e.target.value })}
                className="form-control"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
              >
                {RETENTION_CLASSIFICATIONS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Preservation Period (Years, Range: 1 - 30)
              </label>
              <input
                type="number"
                min="1"
                max="30"
                value={retentionForm.retention_years}
                onChange={(e) => setRetentionForm({ ...retentionForm, retention_years: Math.min(30, Math.max(1, parseInt(e.target.value) || 7)) })}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Change Reason / Legal Reference
              </label>
              <input
                type="text"
                value={retentionForm.reason}
                onChange={(e) => setRetentionForm({ ...retentionForm, reason: e.target.value })}
                placeholder="e.g. Statutory requirement for autonomous institution compliance"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button
                type="button"
                className="btn btn-primary"
                disabled={submitting}
                onClick={() => handleSaveSetting('data_retention_policy', {
                  classification: retentionForm.classification,
                  retention_years: retentionForm.retention_years,
                }, retentionForm.reason)}
              >
                Save Retention Policy
              </button>
              {findSetting('data_retention_policy')?.is_overridden && (
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setResetModal({ show: true, key: 'data_retention_policy', displayName: 'Data Retention Policy', reason: '' })}
                >
                  Reset to Global Default
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: NOTIFICATION CHANNELS */}
      {activeTab === 'notifications' && (
        <div className="card" style={{ padding: '28px' }}>
          <div style={{ marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#0f172a', margin: 0 }}>
              📢 Permitted Outbound Notification Channels
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.875rem', margin: '4px 0 0 0' }}>
              Configure outbound delivery channels permitted for institutional notifications, gate alerts, and broadcast events.
            </p>
          </div>

          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '14px 18px', borderRadius: '6px', marginBottom: '24px', fontSize: '0.85rem', color: '#1e40af' }}>
            ℹ️ <strong>Channel Permission vs. Delivery Status:</strong> Permitting a channel authorizes this college to trigger broadcasts through that gateway. Delivery status reflects real backend provider operational telemetry.
          </div>

          <div style={{ maxWidth: '750px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {ALL_NOTIFICATION_CHANNELS.map((ch) => {
                const isChecked = notificationChannels.includes(ch.id);
                return (
                  <div
                    key={ch.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '16px 20px',
                      border: isChecked ? '1px solid #2563eb' : '1px solid #e2e8f0',
                      borderRadius: '8px',
                      background: isChecked ? '#f8fafc' : '#ffffff',
                    }}
                  >
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', cursor: 'pointer', flex: 1 }}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        style={{ marginTop: '3px' }}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNotificationChannels([...notificationChannels, ch.id]);
                          } else {
                            if (notificationChannels.length <= 1) {
                              setActionError('At least one notification channel must remain permitted.');
                              return;
                            }
                            setNotificationChannels(notificationChannels.filter((c) => c !== ch.id));
                          }
                        }}
                      />
                      <div>
                        <div style={{ fontWeight: '600', color: '#0f172a', fontSize: '0.95rem' }}>
                          {ch.name}
                        </div>
                        <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '2px' }}>
                          {ch.description}
                        </div>
                      </div>
                    </label>

                    <div style={{ textAlign: 'right', minWidth: '150px' }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: '700',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          background: ch.deliveryStatus === 'OPERATIONAL' ? '#ecfdf5' : ch.deliveryStatus === 'CONFIGURED' ? '#eff6ff' : '#f8fafc',
                          color: ch.deliveryStatus === 'OPERATIONAL' ? '#065f46' : ch.deliveryStatus === 'CONFIGURED' ? '#1e40af' : '#64748b',
                        }}
                      >
                        ● {ch.deliveryStatus}
                      </span>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                        {ch.statusNote}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Change Reason / Authorization Reference
              </label>
              <input
                type="text"
                value={notificationReason}
                onChange={(e) => setNotificationReason(e.target.value)}
                placeholder="e.g. Approved SMS/WhatsApp integration for parent emergency alerts"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button
                type="button"
                className="btn btn-primary"
                disabled={submitting}
                onClick={() => handleSaveSetting('allowed_notification_channels', notificationChannels, notificationReason)}
              >
                Save Permitted Channels
              </button>
              {findSetting('allowed_notification_channels')?.is_overridden && (
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setResetModal({ show: true, key: 'allowed_notification_channels', displayName: 'Permitted Notification Channels', reason: '' })}
                >
                  Reset to Global Default
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: DEFAULTS & COMPARISON */}
      {activeTab === 'compare' && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                ⚖️ Global Baseline Comparison Matrix
              </h3>
              <p style={{ color: '#64748b', fontSize: '0.875rem', margin: '4px 0 0 0' }}>
                Side-by-side comparison of effective college values against company baseline defaults.
              </p>
            </div>
            <button className="btn btn-outline btn-sm" onClick={loadConfigurationData}>
              🔄 Re-evaluate Matrix
            </button>
          </div>

          {/* Search & Difference Filter Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '12px 16px', borderRadius: '6px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flex: 1 }}>
              <input
                type="text"
                value={compareSearch}
                onChange={(e) => setCompareSearch(e.target.value)}
                placeholder="Search settings by key or display name..."
                style={{ padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem', width: '320px' }}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#334155', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={compareOnlyOverrides}
                  onChange={(e) => setCompareOnlyOverrides(e.target.checked)}
                />
                <span>Show only explicit overrides ({overriddenCount})</span>
              </label>
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Showing {filteredComparisons.length} of {comparisons.length} settings
            </div>
          </div>

          <div className="table-responsive">
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                  <th style={{ padding: '12px 14px' }}>Field / Setting Key</th>
                  <th style={{ padding: '12px 14px' }}>Global Default</th>
                  <th style={{ padding: '12px 14px' }}>College Override</th>
                  <th style={{ padding: '12px 14px' }}>Effective Value</th>
                  <th style={{ padding: '12px 14px' }}>Status</th>
                  <th style={{ padding: '12px 14px' }}>Compliance</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredComparisons.map((c) => (
                  <tr key={c.setting_key} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: '600', color: '#0f172a' }}>{c.display_name}</div>
                      <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#64748b' }}>{c.setting_key}</div>
                    </td>
                    <td style={{ padding: '12px 14px', fontFamily: 'monospace', color: '#475569', fontSize: '0.8rem' }}>
                      {typeof c.global_default === 'object' ? JSON.stringify(c.global_default) : String(c.global_default || '""')}
                    </td>
                    <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontSize: '0.8rem', color: c.is_overridden ? '#b45309' : '#94a3b8' }}>
                      {c.is_overridden ? (typeof c.effective_value === 'object' ? JSON.stringify(c.effective_value) : String(c.effective_value)) : '—'}
                    </td>
                    <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontWeight: '700', fontSize: '0.8rem', color: c.is_overridden ? '#b45309' : '#0f172a' }}>
                      {typeof c.effective_value === 'object' ? JSON.stringify(c.effective_value) : String(c.effective_value || '""')}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      {c.is_overridden ? (
                        <span style={{ color: '#d97706', background: '#fffbeb', padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '700' }}>
                          Explicit Override
                        </span>
                      ) : (
                        <span style={{ color: '#059669', background: '#ecfdf5', padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem' }}>
                          Inherited Default
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      {c.is_override_valid ? (
                        <span style={{ color: '#059669', fontSize: '0.8rem', fontWeight: '600' }}>✓ Valid</span>
                      ) : (
                        <span style={{ color: '#dc2626', fontSize: '0.8rem', fontWeight: '600' }} title={c.validation_notice}>⚠️ Floor Warning</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                      {c.is_overridden && (
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => setResetModal({ show: true, key: c.setting_key, displayName: c.display_name, reason: '' })}
                          title="Reset to global baseline default"
                        >
                          Reset
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 7: HISTORY & ROLLBACK */}
      {activeTab === 'history' && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                📜 Configuration Version Audit & Reversion
              </h3>
              <p style={{ color: '#64748b', fontSize: '0.875rem', margin: '4px 0 0 0' }}>
                Immutable historical changelog from platform audit logs. Rollbacks validate against current security floors and append forward records.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <select
                value={historyKeyFilter}
                onChange={(e) => {
                  setHistoryKeyFilter(e.target.value);
                  setHistoryPage(1);
                }}
                className="form-control"
                style={{ padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem' }}
              >
                <option value="">All Configuration Keys</option>
                {definitions.map((d) => (
                  <option key={d.key} value={d.key}>{d.display_name} ({d.key})</option>
                ))}
              </select>
              <button className="btn btn-outline btn-sm" onClick={loadConfigurationData}>
                🔄 Refresh Changelog
              </button>
            </div>
          </div>

          {historyEntries.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>📂</div>
              <div>No configuration audit records found for this selection.</div>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '12px 14px' }}>Timestamp</th>
                    <th style={{ padding: '12px 14px' }}>Action</th>
                    <th style={{ padding: '12px 14px' }}>Setting Key</th>
                    <th style={{ padding: '12px 14px' }}>Previous Value</th>
                    <th style={{ padding: '12px 14px' }}>New Value</th>
                    <th style={{ padding: '12px 14px' }}>Actor</th>
                    <th style={{ padding: '12px 14px' }}>Reason</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right' }}>Rollback</th>
                  </tr>
                </thead>
                <tbody>
                  {historyEntries.map((h) => (
                    <tr key={h.audit_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 14px', color: '#64748b', fontSize: '0.8rem' }}>
                        {new Date(h.created_at).toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: '700',
                          background: h.action === 'UPDATE_COLLEGE_SETTING' ? '#eff6ff' : h.action === 'RESET_COLLEGE_SETTING' ? '#fffbeb' : '#f0fdf4',
                          color: h.action === 'UPDATE_COLLEGE_SETTING' ? '#1e40af' : h.action === 'RESET_COLLEGE_SETTING' ? '#b45309' : '#166534',
                        }}>
                          {h.action}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontWeight: '600' }}>
                        {h.setting_key}
                      </td>
                      <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontSize: '0.75rem', color: '#64748b', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={JSON.stringify(h.old_value)}>
                        {typeof h.old_value === 'object' ? JSON.stringify(h.old_value) : String(h.old_value || '')}
                      </td>
                      <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontSize: '0.75rem', color: '#0f172a', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={JSON.stringify(h.new_value)}>
                        {typeof h.new_value === 'object' ? JSON.stringify(h.new_value) : String(h.new_value || '')}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: '0.8rem', color: '#475569' }}>
                        {h.actor_role}
                      </td>
                      <td style={{ padding: '12px 14px', color: '#475569', fontSize: '0.8rem', maxWidth: '180px' }}>
                        {h.reason || '—'}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => setRevertModal({ show: true, entry: h, reason: '' })}
                          title="Rollback configuration to this version"
                        >
                          ↩ Revert
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* History Pagination */}
              {historyTotal > historyPageSize && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                    Showing {(historyPage - 1) * historyPageSize + 1} to {Math.min(historyPage * historyPageSize, historyTotal)} of {historyTotal} changelog entries
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="btn btn-outline btn-sm"
                      disabled={historyPage <= 1}
                      onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                    >
                      ← Previous
                    </button>
                    <button
                      className="btn btn-outline btn-sm"
                      disabled={historyPage * historyPageSize >= historyTotal}
                      onClick={() => setHistoryPage((p) => p + 1)}
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MODAL: RESET SETTING CONFIRMATION */}
      {resetModal.show && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#ffffff', borderRadius: '8px', padding: '24px', width: '480px', maxWidth: '90%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>
              Confirm Reset to Global Baseline
            </h3>
            <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '16px' }}>
              Are you sure you want to remove the explicit override for <strong>{resetModal.displayName || resetModal.key}</strong>? This setting will immediately resume inheriting the global platform default.
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Reset Justification / Reason <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <textarea
                rows={3}
                value={resetModal.reason}
                onChange={(e) => setResetModal({ ...resetModal, reason: e.target.value })}
                placeholder="State the justification for resetting this setting back to global default"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-outline"
                disabled={submitting}
                onClick={() => setResetModal({ show: false, key: '', displayName: '', reason: '' })}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={submitting || !resetModal.reason.trim()}
                onClick={handleConfirmReset}
              >
                {submitting ? 'Resetting...' : 'Confirm Reset'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ROLLBACK VERSION CONFIRMATION */}
      {revertModal.show && revertModal.entry && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#ffffff', borderRadius: '8px', padding: '24px', width: '520px', maxWidth: '90%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>
              ↩ Rollback Configuration Setting
            </h3>
            <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '12px' }}>
              You are restoring setting <strong>{revertModal.entry.setting_key}</strong> to the historical value recorded on {new Date(revertModal.entry.created_at).toLocaleString()}.
            </p>

            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px', marginBottom: '16px', fontSize: '0.8rem', fontFamily: 'monospace' }}>
              <div style={{ color: '#64748b', marginBottom: '4px' }}>Historical Value to Restore:</div>
              <div style={{ color: '#0f172a', wordBreak: 'break-all' }}>
                {typeof revertModal.entry.new_value === 'object' ? JSON.stringify(revertModal.entry.new_value, null, 2) : String(revertModal.entry.new_value)}
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Rollback Justification / Reason <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <textarea
                rows={3}
                value={revertModal.reason}
                onChange={(e) => setRevertModal({ ...revertModal, reason: e.target.value })}
                placeholder="State why this setting is being reverted to a prior version"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-outline"
                disabled={submitting}
                onClick={() => setRevertModal({ show: false, entry: null, reason: '' })}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={submitting || !revertModal.reason.trim()}
                onClick={handleConfirmRevert}
              >
                {submitting ? 'Reverting...' : 'Confirm Rollback'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SUBMIT FOR APPROVAL */}
      {approvalModal.show && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#ffffff', borderRadius: '8px', padding: '24px', width: '500px', maxWidth: '90%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>
              📋 Submit Configuration For Approval
            </h3>
            <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '16px' }}>
              Submit proposed changes for <strong>{approvalModal.key}</strong> to the Super Admin maker-checker approval pipeline. The setting will not take effect until formally approved.
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Change Reason & Business Justification <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <textarea
                rows={3}
                value={approvalModal.reason}
                onChange={(e) => setApprovalModal({ ...approvalModal, reason: e.target.value })}
                placeholder="State the justification for the approval reviewers"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-outline"
                disabled={submitting}
                onClick={() => setApprovalModal({ show: false, key: '', proposedValue: null, reason: '' })}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={submitting || !approvalModal.reason.trim()}
                onClick={handleConfirmApprovalRequest}
              >
                {submitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
