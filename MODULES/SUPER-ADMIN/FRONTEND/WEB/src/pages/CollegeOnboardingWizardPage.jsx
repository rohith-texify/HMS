import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  fetchCollegeById,
  updateCollege,
  updateCollegeStatus,
  fetchCollegeAdmin,
  updateCollegeAdminPassword,
} from '../services/collegeService';
import {
  fetchCollegeReadiness,
  updateOnboardingStep,
} from '../services/onboardingService';
import HostelStructureSetup from '../components/HostelStructureSetup';

// Canonical step mapping to 4 conceptual stages
const STAGES = [
  { id: 1, key: 'COLLEGE_PROFILE', title: '1. College Profile', icon: '🏫', canonicalCode: 'COLLEGE_PROFILE' },
  { id: 2, key: 'HOSTEL_STRUCTURE', title: '2. Hostel Structure', icon: '🏢', canonicalCode: null },
  { id: 3, key: 'COLLEGE_ADMIN', title: '3. College Admin', icon: '👤', canonicalCode: 'COLLEGE_ADMIN' },
  { id: 4, key: 'GO_LIVE', title: '4. Go-Live Review', icon: '🚀', canonicalCode: 'GO_LIVE' },
];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Derive the initial active stage from authoritative persisted step statuses and readiness blockers
function deriveInitialActiveStage(readiness, adminAccount) {
  if (!readiness) return 1;
  const gates = readiness.gates || [];

  // Stage 1: COLLEGE_PROFILE gate
  const profileGate = gates.find((g) => g.gate_code === 'COLLEGE_PROFILE');
  if (!profileGate || profileGate.status !== 'PASSED') {
    return 1;
  }

  // Stage 2: HOSTEL_STRUCTURE gate
  const hostelGate = gates.find((g) => g.gate_code === 'HOSTEL_STRUCTURE');
  if (!hostelGate || hostelGate.status !== 'PASSED') {
    return 2;
  }

  // Stage 3: FIRST_ADMIN gate
  const adminGate = gates.find((g) => g.gate_code === 'FIRST_ADMIN');
  if (!adminGate || adminGate.status !== 'PASSED' || !adminAccount?.has_password) {
    return 3;
  }

  // If all mandatory gates are satisfied or college is ready, land on Go-Live Review (Stage 4)
  return 4;
}

export default function CollegeOnboardingWizardPage() {
  const { id: collegeId } = useParams();
  const navigate = useNavigate();

  const [activeStage, setActiveStage] = useState(1);
  const [college, setCollege] = useState(null);
  const [readiness, setReadiness] = useState(null);
  const [adminAccount, setAdminAccount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [actionNotice, setActionNotice] = useState(null);
  const [actionError, setActionError] = useState(null);

  // Stale request prevention & stage navigation tracking
  const activeReqRef = useRef(0);
  const hasUserSelectedStageRef = useRef(false);
  const isValidId = Boolean(collegeId && UUID_REGEX.test(collegeId));

  // Profile Edit Modal State
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileForm, setProfileForm] = useState({});
  const [profileSaving, setProfileSaving] = useState(false);

  // Admin Provisioning State
  const [adminPassword, setAdminPassword] = useState('');
  const [adminConfirmPassword, setAdminConfirmPassword] = useState('');
  const [adminEmailInput, setAdminEmailInput] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [adminSaving, setAdminSaving] = useState(false);
  const [adminError, setAdminError] = useState(null);
  const [adminSuccess, setAdminSuccess] = useState(false);

  // Cancel Draft Modal
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('Onboarding abandoned by administrator');
  const [cancelling, setCancelling] = useState(false);

  // Go-Live Modal
  const [showGoLiveModal, setShowGoLiveModal] = useState(false);
  const [goLiveReason, setGoLiveReason] = useState('College onboarding prerequisites satisfied and verified');
  const [activating, setActivating] = useState(false);
  const [activationSuccess, setActivationSuccess] = useState(false);

  // Load authoritative college and readiness state
  const loadWorkspaceData = useCallback(async () => {
    if (!isValidId) {
      setLoading(false);
      return;
    }
    const reqId = ++activeReqRef.current;
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch authoritative college tenant record first
      const colData = await fetchCollegeById(collegeId);
      if (activeReqRef.current !== reqId) return;

      if (!colData) {
        throw { status: 404, code: 'NOT_FOUND', message: `College record not found (ID: ${collegeId})` };
      }
      setCollege(colData);

      // Populate profile form from existing college record
      setProfileForm({
        college_code: colData.college_code || '',
        name: colData.name || '',
        city: colData.city || '',
        state: colData.state || '',
        timezone: colData.timezone || 'Asia/Kolkata',
        contact_email: colData.contact_email || '',
        contact_phone: colData.contact_phone || '',
        address: colData.address || '',
      });

      // 2. Concurrently fetch auxiliary states with Promise.allSettled so that partial issues don't block the wizard
      const [readyResult, adminResult] = await Promise.allSettled([
        fetchCollegeReadiness(collegeId),
        fetchCollegeAdmin(collegeId),
      ]);

      if (activeReqRef.current !== reqId) return;

      const readyData = readyResult.status === 'fulfilled' ? readyResult.value : null;
      const adminData = adminResult.status === 'fulfilled' ? adminResult.value : null;

      setReadiness(readyData);
      setAdminAccount(adminData);

      setAdminEmailInput(adminData?.email || colData.contact_email || '');

      // Derive initial active stage from authoritative backend state if user has not explicitly navigated
      if (!hasUserSelectedStageRef.current) {
        const initialStage = deriveInitialActiveStage(readyData, adminData);
        setActiveStage(initialStage);
      }
    } catch (err) {
      if (activeReqRef.current !== reqId) return;
      if (
        err?.name === 'CanceledError' ||
        err?.name === 'AbortError' ||
        err?.isCanceled ||
        err?.message === 'canceled' ||
        err?.code === 'ERR_CANCELED'
      ) {
        return;
      }
      let errorMsg = 'Failed to load college onboarding data';
      if (err.status === 404 || err.code === 'NOT_FOUND') {
        errorMsg = `College record not found (ID: ${collegeId}). The college may have been removed or does not exist.`;
      } else if (err.status === 401 || err.code === 'UNAUTHORIZED') {
        errorMsg = 'Your session has expired. Please sign in again to access the onboarding wizard.';
      } else if (err.status === 403 || err.code === 'FORBIDDEN') {
        errorMsg = 'Access denied. Super Admin platform-scope authorization required to access onboarding.';
      } else if (err.message) {
        errorMsg = err.message;
      }
      setError(errorMsg);
    } finally {
      if (activeReqRef.current === reqId) {
        setLoading(false);
      }
    }
  }, [collegeId, isValidId]);

  useEffect(() => {
    if (isValidId) {
      loadWorkspaceData();
    } else {
      setLoading(false);
    }
  }, [isValidId, loadWorkspaceData]);

  // Stage 1: Save Profile
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    setActionNotice(null);
    setActionError(null);
    try {
      const updated = await updateCollege(collegeId, profileForm);
      setCollege(updated);
      setShowProfileModal(false);
      setActionNotice('College profile saved successfully.');
      // Refresh readiness
      const refreshedReady = await fetchCollegeReadiness(collegeId);
      setReadiness(refreshedReady);
    } catch (err) {
      setActionError(err.message || 'Failed to update profile');
    } finally {
      setProfileSaving(false);
    }
  };

  // Generic canonical step completion
  const handleMarkStepComplete = async (stepCode, defaultNotes) => {
    setActionNotice(null);
    setActionError(null);
    try {
      await updateOnboardingStep(collegeId, stepCode, {
        status: 'COMPLETED',
        notes: defaultNotes || `Step ${stepCode} completed and verified in onboarding wizard`,
      });
      setActionNotice(`Step ${stepCode} marked as completed.`);
      await loadWorkspaceData();
    } catch (err) {
      setActionError(err.message || `Failed to update step ${stepCode}`);
    }
  };

  // Stage 5: Provision College Admin Credentials
  const handleProvisionAdmin = async (e) => {
    e.preventDefault();
    setAdminError(null);
    setAdminSuccess(false);

    if (!adminPassword || adminPassword.length < 8) {
      setAdminError('Password must be at least 8 characters long');
      return;
    }
    if (adminPassword !== adminConfirmPassword) {
      setAdminError('Passwords do not match');
      return;
    }

    setAdminSaving(true);
    try {
      const updated = await updateCollegeAdminPassword(collegeId, {
        password: adminPassword,
        admin_email: adminEmailInput.trim() || undefined,
      });
      setAdminAccount(updated);
      setAdminSuccess(true);
      setAdminPassword('');
      setAdminConfirmPassword('');
      setActionNotice('College Administrator credentials initialized successfully.');
      // Reload readiness
      await loadWorkspaceData();
    } catch (err) {
      setAdminError(err.message || 'Failed to provision administrator');
    } finally {
      setAdminSaving(false);
    }
  };

  // Cancel Draft Action
  const handleCancelDraft = async () => {
    setCancelling(true);
    try {
      await updateCollegeStatus(collegeId, {
        status: 'DEACTIVATED',
        reason: cancelReason || 'Onboarding draft cancelled',
      });
      setShowCancelModal(false);
      navigate('/colleges');
    } catch (err) {
      alert(err.message || 'Failed to cancel onboarding draft');
      setCancelling(false);
    }
  };

  // Go-Live Activation Action
  const handleGoLiveActivation = async () => {
    if (!goLiveReason || goLiveReason.trim().length < 5) {
      alert('Please provide a mandatory audit reason (minimum 5 characters) for activation.');
      return;
    }
    setActivating(true);
    setActionError(null);
    try {
      const updated = await updateCollegeStatus(collegeId, {
        status: 'ACTIVE',
        reason: goLiveReason.trim(),
      });
      setCollege(updated);
      setShowGoLiveModal(false);
      setActivationSuccess(true);
      setActionNotice('College onboarding completed and institution successfully activated!');
      await loadWorkspaceData();
    } catch (err) {
      setActionError(err.message || 'Activation failed: backend revalidation check rejected go-live');
    } finally {
      setActivating(false);
    }
  };

  // Helper to determine stage status badge
  const getStageStatus = (stage) => {
    if (!readiness) return 'PENDING';

    if (stage.key === 'COLLEGE_PROFILE') {
      const gate = readiness.gates?.find((g) => g.gate_code === 'COLLEGE_PROFILE');
      return gate?.status || 'PENDING';
    }
    if (stage.key === 'HOSTEL_STRUCTURE') {
      const gate = readiness.gates?.find((g) => g.gate_code === 'HOSTEL_STRUCTURE');
      return gate?.status || 'FAILED';
    }
    if (stage.key === 'COLLEGE_ADMIN') {
      const gate = readiness.gates?.find((g) => g.gate_code === 'FIRST_ADMIN');
      return gate?.status || 'FAILED';
    }
    if (stage.key === 'GO_LIVE') {
      return readiness.is_ready ? 'PASSED' : 'PENDING';
    }
    return 'PENDING';
  };

  // Authoritative check if hostel structure gate is passed
  const isHostelGatePassed = () => {
    const gate = readiness?.gates?.find((g) => g.gate_code === 'HOSTEL_STRUCTURE');
    return gate?.status === 'PASSED';
  };

  // Gated stage navigation with live backend revalidation
  const handleStageNavigation = async (targetStageId) => {
    setActionError(null);
    if (targetStageId > 2) {
      try {
        const refreshed = await fetchCollegeReadiness(collegeId);
        setReadiness(refreshed);
        const hostelGate = refreshed?.gates?.find((g) => g.gate_code === 'HOSTEL_STRUCTURE');
        if (!hostelGate || hostelGate.status !== 'PASSED') {
          setActionError('Cannot proceed to Stage 3: At least one active hostel structure is required by backend onboarding rules.');
          return;
        }
      } catch (err) {
        setActionError('Failed to verify hostel readiness before progression: ' + (err.message || 'Network error'));
        return;
      }
    }
    hasUserSelectedStageRef.current = true;
    setActiveStage(targetStageId);
  };

  if (!isValidId) {
    return (
      <div style={{ padding: '60px 24px', maxWidth: '640px', margin: '40px auto', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⚠️</div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: '700', color: '#991b1b', marginBottom: '8px' }}>
          Invalid College Identifier
        </h2>
        <p style={{ color: '#475569', fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '24px' }}>
          The route identifier <code>{collegeId || '(empty)'}</code> is not a valid standard UUID format. The onboarding wizard requires a real persisted backend college ID.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
          <Link to="/onboarding" className="btn btn-primary" id="btn-return-pipeline">
            ← Return to Onboarding Pipeline
          </Link>
          <Link to="/colleges" className="btn btn-outline">
            Colleges Directory
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: '64px', textAlign: 'center', color: '#64748b' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>⏳</div>
        <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1e293b' }}>
          Loading College Onboarding Workspace...
        </h3>
        <p style={{ fontSize: '0.9rem', color: '#64748b' }}>
          Verifying canonical database state and go-live gates
        </p>
      </div>
    );
  }

  if (error || !college) {
    return (
      <div style={{ padding: '48px', maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>⚠️</div>
        <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#991b1b' }}>
          Onboarding Workspace Unavailable
        </h3>
        <p style={{ color: '#475569', margin: '8px 0 24px 0' }}>{error || 'College record not found.'}</p>
        <Link to="/onboarding" className="btn btn-primary">
          ← Back to Onboarding Pipeline
        </Link>
      </div>
    );
  }

  const progressPct = readiness?.progress_percentage || 0;
  const isAlreadyActive = college.status === 'ACTIVE';

  return (
    <div className="onboarding-wizard-page" style={{ padding: '24px 32px' }}>
      {/* Top Banner Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '0.875rem', marginBottom: '6px' }}>
            <Link to="/onboarding" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: '500' }}>← Onboarding Pipeline</Link>
            <span>/</span>
            <Link to={`/colleges/${college.college_id}`} style={{ color: '#64748b', textDecoration: 'none' }}>{college.name}</Link>
            <span>/</span>
            <span style={{ color: '#0f172a', fontWeight: '500' }}>Setup Wizard</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: '700', color: '#0f172a', margin: 0 }}>
              {college.name}
            </h1>
            <span style={{ fontFamily: 'monospace', fontWeight: 'bold', background: '#f1f5f9', padding: '3px 8px', borderRadius: '4px', fontSize: '0.9rem' }}>
              {college.college_code}
            </span>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '3px 10px',
              borderRadius: '12px',
              fontSize: '0.8rem',
              fontWeight: '600',
              background: isAlreadyActive ? '#ecfdf5' : '#eff6ff',
              color: isAlreadyActive ? '#065f46' : '#1d4ed8',
            }}>
              ● {college.status}
            </span>
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                color: '#64748b',
                background: '#f8fafc',
                padding: '2px 8px',
                borderRadius: '4px',
                border: '1px solid #e2e8f0',
              }}
              title="Authoritative Backend College UUID"
            >
              ID: {college.college_id}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Link to="/onboarding" className="btn btn-outline btn-sm" id="btn-back-to-pipeline">
            ← Back to Pipeline
          </Link>
          <button
            className="btn btn-outline btn-sm"
            onClick={loadWorkspaceData}
            title="Refresh onboarding status"
            id="btn-refresh-wizard"
          >
            🔄 Refresh
          </button>

          {!isAlreadyActive && (
            <button
              className="btn btn-outline btn-sm"
              style={{ color: '#dc2626', borderColor: '#fca5a5' }}
              onClick={() => setShowCancelModal(true)}
              id="btn-cancel-draft"
            >
              Cancel Draft
            </button>
          )}

          <Link to={`/colleges/${college.college_id}`} className="btn btn-outline btn-sm">
            College Profile →
          </Link>
          <Link to={`/colleges/${college.college_id}/configuration`} className="btn btn-outline btn-sm">
            Configuration ⚙️
          </Link>
        </div>
      </div>

      {actionNotice && (
        <div style={{ padding: '12px 16px', background: '#ecfdf5', borderLeft: '4px solid #10b981', color: '#065f46', fontSize: '0.875rem', marginBottom: '20px', borderRadius: '4px' }}>
          ✓ {actionNotice}
        </div>
      )}

      {actionError && (
        <div style={{ padding: '12px 16px', background: '#fef2f2', borderLeft: '4px solid #ef4444', color: '#991b1b', fontSize: '0.875rem', marginBottom: '20px', borderRadius: '4px' }}>
          ✕ {actionError}
        </div>
      )}

      {/* Progress & Readiness Banner */}
      <div className="card" style={{ padding: '20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div>
            <div style={{ fontSize: '0.95rem', fontWeight: '600', color: '#1e293b' }}>
              Tenant Onboarding Progress: {progressPct}%
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
              {readiness?.summary?.mandatory_passed || 0} of {readiness?.summary?.total_mandatory || 5} mandatory gates satisfied
            </div>
          </div>
          <div>
            {readiness?.is_ready ? (
              <span style={{ background: '#ecfdf5', color: '#065f46', padding: '6px 12px', borderRadius: '16px', fontSize: '0.85rem', fontWeight: '700' }}>
                ✓ Ready for Go-Live Activation
              </span>
            ) : (
              <span style={{ background: '#fffbeb', color: '#92400e', padding: '6px 12px', borderRadius: '16px', fontSize: '0.85rem', fontWeight: '600' }}>
                ⏳ Prerequisites Incomplete
              </span>
            )}
          </div>
        </div>

        <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${progressPct}%`,
              background: progressPct === 100 ? '#10b981' : '#3b82f6',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>

      {/* 4-Stage Horizontal Stepper */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '8px',
        marginBottom: '24px',
        background: '#f8fafc',
        padding: '8px',
        borderRadius: '8px',
        border: '1px solid #e2e8f0',
      }}>
        {STAGES.map((s) => {
          const status = getStageStatus(s);
          const isSelected = activeStage === s.id;

          let statusColor = '#94a3b8';
          let statusText = 'Pending';
          if (status === 'PASSED') {
            statusColor = '#10b981';
            statusText = 'Passed';
          } else if (status === 'FAILED') {
            statusColor = '#ef4444';
            statusText = 'Action Needed';
          } else if (status === 'BLOCKED') {
            statusColor = '#f59e0b';
            statusText = 'Blocked';
          } else if (status === 'UNAVAILABLE') {
            statusColor = '#f59e0b';
            statusText = 'Advisory';
          }

          return (
            <button
              key={s.id}
              onClick={() => handleStageNavigation(s.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '12px 6px',
                background: isSelected ? '#ffffff' : 'transparent',
                border: isSelected ? '1px solid #cbd5e1' : '1px solid transparent',
                borderRadius: '6px',
                cursor: 'pointer',
                textAlign: 'center',
                boxShadow: isSelected ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.2s ease',
              }}
              id={`stage-tab-${s.id}`}
            >
              <div style={{ fontSize: '1.25rem', marginBottom: '4px' }}>{s.icon}</div>
              <div style={{ fontSize: '0.8rem', fontWeight: isSelected ? '700' : '500', color: isSelected ? '#0f172a' : '#475569' }}>
                {s.title}
              </div>
              <div style={{ fontSize: '0.7rem', color: statusColor, fontWeight: '600', marginTop: '2px' }}>
                {statusText}
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Stage Content Card */}
      <div className="card" style={{ padding: '28px', minHeight: '380px' }}>
        {/* STAGE 1: COLLEGE PROFILE */}
        {activeStage === 1 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                  Stage 1: College Profile Identity
                </h2>
                <p style={{ fontSize: '0.875rem', color: '#64748b', margin: '4px 0 0 0' }}>
                  Establish a valid tenant identity. Required fields: College Code, Official Display Name, Timezone, and Contact Email.
                </p>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => setShowProfileModal(true)}>
                ✏️ Edit Profile Fields
              </button>
            </div>

            {!college.contact_email && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: '#fffbeb', border: '1px solid #fde68a', borderLeft: '4px solid #f59e0b',
                padding: '12px 16px', borderRadius: '6px', marginBottom: '16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#92400e', fontSize: '0.875rem' }}>
                  <span>⚠️</span>
                  <span><strong>Contact Email Required:</strong> An administrative contact email is missing and required for institutional verification.</span>
                </div>
                <button className="btn btn-outline btn-sm" onClick={() => setShowProfileModal(true)} style={{ background: '#fff' }}>
                  Set Email Now →
                </button>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', background: '#f8fafc', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>College Code</span>
                <div style={{ fontSize: '1rem', fontWeight: '600', color: '#0f172a', fontFamily: 'monospace' }}>{college.college_code}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>College Display Name</span>
                <div style={{ fontSize: '1rem', fontWeight: '600', color: '#0f172a' }}>{college.name}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>Administrative Contact Email</span>
                <div style={{ fontSize: '0.9rem', color: '#0f172a' }}>{college.contact_email || '— (Missing required email)'}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>Timezone</span>
                <div style={{ fontSize: '0.9rem', color: '#0f172a' }}>{college.timezone === 'Asia/Kolkata' ? 'Indian Standard Time (IST, UTC+05:30)' : college.timezone}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>Location / State</span>
                <div style={{ fontSize: '0.9rem', color: '#0f172a' }}>{[college.city, college.state].filter(Boolean).join(', ') || '—'}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>Address</span>
                <div style={{ fontSize: '0.9rem', color: '#0f172a' }}>{college.address || '—'}</div>
              </div>
            </div>

            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                Status: {getStageStatus(STAGES[0]) === 'PASSED' ? '✓ Profile requirements satisfied' : '⚠️ Missing required profile information'}
              </div>
              <button
                className="btn btn-primary"
                onClick={() => handleMarkStepComplete('COLLEGE_PROFILE', 'Profile data reviewed and validated')}
              >
                Mark Profile Step Complete ✓
              </button>
            </div>
          </div>
        )}

        {/* STAGE 2: HOSTEL PHYSICAL STRUCTURE */}
        {activeStage === 2 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                  Stage 2: Hostel Physical Structure
                </h2>
                <p style={{ fontSize: '0.875rem', color: '#64748b', margin: '4px 0 0 0' }}>
                  A college tenant must have at least one valid hostel before activation.
                </p>
              </div>
              <button
                className="btn btn-outline btn-sm"
                onClick={loadWorkspaceData}
                title="Authoritative backend verification of hostel physical structure readiness"
                id="btn-refresh-hostel-readiness"
              >
                🔄 Refresh Hostel Readiness Check
              </button>
            </div>

            {/* Embedded Live Hostel Structure Creation & Management */}
            <HostelStructureSetup
              collegeId={college.college_id}
              onStructureChanged={loadWorkspaceData}
            />
          </div>
        )}

        {/* STAGE 3: FIRST COLLEGE ADMIN */}
        {activeStage === 3 && (
          <div>
            <div style={{ marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                Stage 3: First College Administrator Account
              </h2>
              <p style={{ fontSize: '0.875rem', color: '#64748b', margin: '4px 0 0 0' }}>
                Ensure that the college has an active College Admin account with initialized password credentials.
              </p>
            </div>

            {/* Current Admin Card */}
            <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: '600', color: '#1e293b', marginBottom: '12px' }}>
                Current Administrator Status
              </h3>
              {adminAccount ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>Admin Email</span>
                    <div style={{ fontSize: '0.95rem', fontWeight: '600', color: '#0f172a' }}>{adminAccount.email}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>Assigned Role</span>
                    <div style={{ fontSize: '0.95rem', fontWeight: '600', color: '#2563eb' }}>{adminAccount.role_code || 'COLLEGE_ADMIN'}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>Password Initialized</span>
                    <div style={{ fontSize: '0.95rem', fontWeight: '600', color: adminAccount.has_password ? '#10b981' : '#ef4444' }}>
                      {adminAccount.has_password ? '✓ Credentials Set' : '⚠️ Password Not Set'}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ color: '#d97706', fontSize: '0.9rem' }}>
                  ⚠️ No administrator account is currently provisioned for this tenant.
                </div>
              )}
            </div>

            {/* Provisioning Form */}
            <form onSubmit={handleProvisionAdmin} style={{ maxWidth: '500px' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: '600', color: '#1e293b', marginBottom: '12px' }}>
                Initialize / Reset Administrator Credentials
              </h3>

              {adminError && (
                <div style={{ padding: '10px 14px', background: '#fef2f2', borderLeft: '4px solid #ef4444', color: '#991b1b', fontSize: '0.85rem', marginBottom: '12px' }}>
                  {adminError}
                </div>
              )}

              {adminSuccess && (
                <div style={{ padding: '10px 14px', background: '#ecfdf5', borderLeft: '4px solid #10b981', color: '#065f46', fontSize: '0.85rem', marginBottom: '12px' }}>
                  ✓ Administrator password updated and COLLEGE_ADMIN step completed.
                </div>
              )}

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>
                  Administrator Login Email *
                </label>
                <input
                  type="email"
                  value={adminEmailInput}
                  onChange={(e) => setAdminEmailInput(e.target.value)}
                  required
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>
                  New Password * (minimum 8 characters)
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showAdminPassword ? 'text' : 'password'}
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Enter strong password..."
                    required
                    minLength={8}
                    style={{ width: '100%', padding: '8px 40px 8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPassword(!showAdminPassword)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '1rem',
                      color: '#64748b',
                    }}
                    title={showAdminPassword ? 'Hide password' : 'Show password'}
                  >
                    {showAdminPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>
                  Confirm Password *
                </label>
                <input
                  type={showAdminPassword ? 'text' : 'password'}
                  value={adminConfirmPassword}
                  onChange={(e) => setAdminConfirmPassword(e.target.value)}
                  placeholder="Re-enter password..."
                  required
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={adminSaving}
                id="btn-save-admin-credentials"
              >
                {adminSaving ? 'Saving Credentials...' : 'Save Administrator Credentials'}
              </button>
            </form>
          </div>
        )}

        {/* STAGE 4: GO-LIVE REVIEW */}
        {activeStage === 4 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                  Stage 4: Go-Live Readiness Review & Activation
                </h2>
                <p style={{ fontSize: '0.875rem', color: '#64748b', margin: '4px 0 0 0' }}>
                  Server-side evaluation of all mandatory onboarding gates prior to institutional activation.
                </p>
              </div>

              {!isAlreadyActive && (
                <button
                  className="btn btn-primary"
                  style={{
                    background: readiness?.is_ready ? '#10b981' : '#94a3b8',
                    borderColor: readiness?.is_ready ? '#059669' : '#94a3b8',
                    cursor: readiness?.is_ready ? 'pointer' : 'not-allowed',
                  }}
                  disabled={!readiness?.is_ready}
                  onClick={() => setShowGoLiveModal(true)}
                  id="btn-go-live-activate"
                  title={readiness?.is_ready ? 'Activate institution for production use' : 'Activation disabled until all mandatory gates pass'}
                >
                  🚀 Activate College (Go-Live)
                </button>
              )}
            </div>

            {isAlreadyActive && (
              <div style={{ padding: '16px 20px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', color: '#065f46', marginBottom: '20px' }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', fontWeight: '700' }}>
                  ✓ This College Tenant is ACTIVE
                </h3>
                <p style={{ margin: 0, fontSize: '0.9rem' }}>
                  {college.name} is currently live and operational in the HMS platform.
                </p>
              </div>
            )}

            {activationSuccess && (
              <div style={{ padding: '16px 20px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', color: '#065f46', marginBottom: '20px' }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', fontWeight: '700' }}>
                  🎉 College Successfully Activated!
                </h3>
                <p style={{ margin: 0, fontSize: '0.9rem' }}>
                  {college.name} is now LIVE in the HMS ecosystem. Tenant administrators and students can access authorized modules.
                </p>
              </div>
            )}

            {!readiness?.is_ready && !isAlreadyActive && (
              <div style={{
                padding: '16px 20px',
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderLeft: '4px solid #f59e0b',
                borderRadius: '8px',
                marginBottom: '20px',
              }}>
                <div style={{ fontWeight: '700', color: '#92400e', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span>⏳</span>
                  <span>Go-Live Activation Blocked by Incomplete Prerequisites</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#78350f', lineHeight: '1.5' }}>
                  All mandatory gates listed below must show a <strong>PASSED</strong> evaluation from the server before activation can be authorized. Review the gate evaluations in the table below and address any blocked requirements.
                </p>
              </div>
            )}

            {/* Readiness Gates Table */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', marginBottom: '24px' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '12px 16px', fontSize: '0.75rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>
                      Prerequisite Gate
                    </th>
                    <th style={{ padding: '12px 16px', fontSize: '0.75rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>
                      Gate Type
                    </th>
                    <th style={{ padding: '12px 16px', fontSize: '0.75rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>
                      Server Evaluation Result
                    </th>
                    <th style={{ padding: '12px 16px', fontSize: '0.75rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {readiness?.gates?.map((gate) => {
                    const isPassed = gate.status === 'PASSED';
                    const isBlocked = gate.status === 'BLOCKED' || gate.status === 'FAILED';

                    let badgeBg = '#f1f5f9';
                    let badgeColor = '#475569';
                    if (isPassed) {
                      badgeBg = '#ecfdf5';
                      badgeColor = '#065f46';
                    } else if (isBlocked) {
                      badgeBg = '#fef2f2';
                      badgeColor = '#991b1b';
                    }

                    return (
                      <tr key={gate.gate_code} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '14px 16px', fontWeight: '600', color: '#0f172a' }}>
                          <div>{gate.name}</div>
                          <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#64748b' }}>{gate.gate_code}</div>
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: '0.8rem', color: '#64748b' }}>
                          {gate.is_mandatory ? (
                            <span style={{ color: '#b91c1c', fontWeight: '600', background: '#fef2f2', padding: '2px 6px', borderRadius: '4px' }}>
                              Mandatory
                            </span>
                          ) : (
                            <span style={{ color: '#64748b', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                              Advisory
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: '0.85rem', color: '#334155' }}>
                          <div>{gate.message}</div>
                          {isBlocked && (
                            <div style={{ color: '#b91c1c', fontSize: '0.78rem', marginTop: '4px', fontWeight: '500' }}>
                              ⚠️ Blocker: This prerequisite must be satisfied before activation.
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '3px 8px',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: '700',
                            background: badgeBg,
                            color: badgeColor,
                          }}>
                            {isPassed ? '✓ ' : isBlocked ? '✕ ' : ''}{gate.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                className="btn btn-outline"
                onClick={() => handleMarkStepComplete('READINESS_REVIEW', 'All readiness review gates verified')}
              >
                Mark Readiness Review Complete ✓
              </button>
            </div>
          </div>
        )}

        {/* Stepper Bottom Navigation */}
        <div style={{ marginTop: '32px', paddingTop: '20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <button
            className="btn btn-outline"
            disabled={activeStage === 1}
            onClick={() => {
              hasUserSelectedStageRef.current = true;
              setActiveStage((prev) => Math.max(1, prev - 1));
            }}
          >
            ← Previous Stage
          </button>

          {activeStage === 2 && !isHostelGatePassed() && (
            <div style={{ fontSize: '0.825rem', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>⚠️</span>
              <span>At least one active hostel structure is required before proceeding to Stage 3.</span>
            </div>
          )}

          <button
            className="btn btn-primary"
            disabled={activeStage === 4 || (activeStage === 2 && !isHostelGatePassed())}
            onClick={() => handleStageNavigation(activeStage + 1)}
            id="btn-next-stage"
          >
            Next Stage →
          </button>
        </div>
      </div>

      {/* Profile Edit Modal */}
      {showProfileModal && (
        <div className="modal-backdrop" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div className="card" style={{ width: '540px', padding: '24px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.2rem', color: '#0f172a' }}>
              Edit College Profile Information
            </h3>
            <form onSubmit={handleSaveProfile}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>
                  College Code *
                </label>
                <input
                  type="text"
                  value={profileForm.college_code}
                  onChange={(e) => setProfileForm({ ...profileForm, college_code: e.target.value })}
                  required
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>
                  College Display Name *
                </label>
                <input
                  type="text"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  required
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>
                  Contact Email *
                </label>
                <input
                  type="email"
                  value={profileForm.contact_email}
                  onChange={(e) => setProfileForm({ ...profileForm, contact_email: e.target.value })}
                  required
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>
                  Address
                </label>
                <textarea
                  value={profileForm.address}
                  onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                  rows={3}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowProfileModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={profileSaving}>
                  {profileSaving ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Draft Confirmation Modal */}
      {showCancelModal && (
        <div className="modal-backdrop" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div className="card" style={{ width: '480px', padding: '24px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '1.2rem', color: '#991b1b' }}>
              Confirm Cancel Onboarding Draft
            </h3>
            <p style={{ fontSize: '0.9rem', color: '#475569', lineHeight: '1.5', margin: '0 0 16px 0' }}>
              Cancelling will transition <strong>{college.name}</strong> from <code>ONBOARDING</code> to <code>DEACTIVATED</code> status. Historical audit events and records are safely preserved.
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>
                Cancellation Reason *
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                required
                rows={3}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn btn-outline" onClick={() => setShowCancelModal(false)} disabled={cancelling}>
                Keep Draft
              </button>
              <button
                className="btn btn-danger"
                style={{ background: '#dc2626', color: '#fff', borderColor: '#dc2626' }}
                onClick={handleCancelDraft}
                disabled={cancelling}
              >
                {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Go-Live Activation Modal */}
      {showGoLiveModal && (
        <div className="modal-backdrop" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div className="card" style={{ width: '500px', padding: '24px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '1.25rem', color: '#065f46' }}>
              🚀 Confirm Go-Live Activation
            </h3>
            <p style={{ fontSize: '0.9rem', color: '#334155', lineHeight: '1.5', margin: '0 0 16px 0' }}>
              You are about to transition <strong>{college.name}</strong> to <code>ACTIVE</code> status. The backend will revalidate all mandatory gates immediately prior to commit.
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>
                Activation Audit Reason * (Mandatory for Compliance)
              </label>
              <textarea
                value={goLiveReason}
                onChange={(e) => setGoLiveReason(e.target.value)}
                required
                minLength={5}
                placeholder="Enter formal justification for activating this tenant (minimum 5 characters)..."
                rows={3}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                id="input-go-live-reason"
              />
              {(!goLiveReason || goLiveReason.trim().length < 5) && (
                <div style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '4px' }}>
                  Audit reason must be at least 5 characters.
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn btn-outline" onClick={() => setShowGoLiveModal(false)} disabled={activating}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                style={{ background: '#10b981', borderColor: '#059669' }}
                onClick={handleGoLiveActivation}
                disabled={activating || !goLiveReason || goLiveReason.trim().length < 5}
                id="btn-confirm-go-live"
              >
                {activating ? 'Validating & Activating...' : 'Confirm Go-Live'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
