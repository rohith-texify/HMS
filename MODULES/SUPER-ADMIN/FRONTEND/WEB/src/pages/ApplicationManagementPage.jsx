import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  fetchCollegeApplications,
  enableApplication,
  disableApplication,
  suspendApplication,
  updateApplicationVersion,
  fetchApplicationHistory,
  fetchCollegeMetadata,
  fetchCollegesList,
} from '../services/applicationManagementService';

const APP_ICONS = {
  student_app: '🎓',
  parent_app: '👨‍👩‍👧',
  security_app: '🛡️',
  hostel_incharge_app: '📋',
  admin_portal: '🏛️',
};

const APP_PLATFORM_LABELS = {
  student_app: 'Mobile (iOS & Android)',
  parent_app: 'Mobile (iOS & Android)',
  security_app: 'Mobile & Gate Terminal',
  hostel_incharge_app: 'Hybrid (Mobile & Web)',
  admin_portal: 'Web Portal',
};

export default function ApplicationManagementPage() {
  const { id: routeCollegeId } = useParams();
  const navigate = useNavigate();

  const [colleges, setColleges] = useState([]);
  const [selectedCollegeId, setSelectedCollegeId] = useState(routeCollegeId || '');
  const [college, setCollege] = useState(null);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  // Modals state
  const [statusModal, setStatusModal] = useState({
    isOpen: false,
    app: null,
    targetStatus: '',
    reason: '',
    submitting: false,
    error: null,
  });

  const [versionModal, setVersionModal] = useState({
    isOpen: false,
    app: null,
    minVersion: '',
    forceUpdate: false,
    reason: '',
    submitting: false,
    error: null,
    fieldErrors: {},
  });

  const [historyModal, setHistoryModal] = useState({
    isOpen: false,
    app: null,
    loading: false,
    records: [],
    error: null,
  });

  const abortControllerRef = useRef(null);

  // Load available colleges for the switcher
  useEffect(() => {
    let isMounted = true;
    async function loadColleges() {
      try {
        const list = await fetchCollegesList();
        if (isMounted) {
          setColleges(list || []);
          if (!routeCollegeId && list && list.length > 0) {
            setSelectedCollegeId(list[0].college_id);
          }
        }
      } catch (err) {
        console.error('Failed to load colleges list:', err);
      }
    }
    loadColleges();
    return () => {
      isMounted = false;
    };
  }, [routeCollegeId]);

  // Synchronize when route param changes
  useEffect(() => {
    if (routeCollegeId) {
      setSelectedCollegeId(routeCollegeId);
    }
  }, [routeCollegeId]);

  // Fetch applications whenever selectedCollegeId changes
  useEffect(() => {
    if (!selectedCollegeId) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        const [collegeData, appsData] = await Promise.all([
          fetchCollegeMetadata(selectedCollegeId, abortController.signal),
          fetchCollegeApplications(selectedCollegeId, abortController.signal),
        ]);

        setCollege(collegeData);
        setApplications(appsData || []);
      } catch (err) {
        if (err.isCanceled || err.name === 'CanceledError') return;
        console.error('Failed to load application management data:', err);
        setError(err.message || 'Failed to load college application settings');
      } finally {
        setLoading(false);
      }
    }

    loadData();

    return () => {
      abortController.abort();
    };
  }, [selectedCollegeId]);

  function handleCollegeSwitch(e) {
    const newId = e.target.value;
    setSelectedCollegeId(newId);
    if (routeCollegeId) {
      navigate(`/colleges/${newId}/applications`);
    }
  }

  // Action: Open Status Transition Confirmation Dialog
  function openStatusModal(app, targetStatus) {
    setStatusModal({
      isOpen: true,
      app,
      targetStatus,
      reason: '',
      submitting: false,
      error: null,
    });
  }

  async function handleStatusSubmit(e) {
    e.preventDefault();
    const { app, targetStatus, reason } = statusModal;
    if (!app || !targetStatus) return;

    setStatusModal((prev) => ({ ...prev, submitting: true, error: null }));

    try {
      let updatedApp;
      if (targetStatus === 'ENABLED') {
        updatedApp = await enableApplication(selectedCollegeId, app.app_id, reason);
      } else if (targetStatus === 'DISABLED') {
        updatedApp = await disableApplication(selectedCollegeId, app.app_id, reason);
      } else if (targetStatus === 'SUSPENDED') {
        updatedApp = await suspendApplication(selectedCollegeId, app.app_id, reason);
      }

      setApplications((prev) =>
        prev.map((item) => (item.app_id === app.app_id ? { ...item, ...updatedApp } : item))
      );

      setStatusModal({ isOpen: false, app: null, targetStatus: '', reason: '', submitting: false, error: null });
      setNotice({
        type: 'success',
        text: `Application "${app.name}" status updated to ${targetStatus} successfully.`,
      });
      setTimeout(() => setNotice(null), 5000);
    } catch (err) {
      setStatusModal((prev) => ({
        ...prev,
        submitting: false,
        error: err.message || `Failed to update status to ${targetStatus}`,
      }));
    }
  }

  // Action: Open Version & Policy Modal
  function openVersionModal(app) {
    setVersionModal({
      isOpen: true,
      app,
      minVersion: app.min_version || '1.0.0',
      forceUpdate: !!app.force_update,
      reason: '',
      submitting: false,
      error: null,
      fieldErrors: {},
    });
  }

  function validateVersionForm() {
    const errors = {};
    const v = versionModal.minVersion.trim();
    if (!v) {
      errors.minVersion = 'Minimum supported version is required.';
    } else if (!/^v?\d+\.\d+(\.\d+)?$/.test(v)) {
      errors.minVersion = 'Must follow semantic version format (e.g. 1.0.0 or 2.1).';
    }
    return errors;
  }

  async function handleVersionSubmit(e) {
    e.preventDefault();
    const { app, minVersion, forceUpdate, reason } = versionModal;
    if (!app) return;

    const validationErrors = validateVersionForm();
    if (Object.keys(validationErrors).length > 0) {
      setVersionModal((prev) => ({ ...prev, fieldErrors: validationErrors }));
      return;
    }

    setVersionModal((prev) => ({ ...prev, submitting: true, error: null, fieldErrors: {} }));

    try {
      const updatedApp = await updateApplicationVersion(selectedCollegeId, app.app_id, {
        minVersion: minVersion.trim(),
        forceUpdate,
        reason,
      });

      setApplications((prev) =>
        prev.map((item) => (item.app_id === app.app_id ? { ...item, ...updatedApp } : item))
      );

      setVersionModal({
        isOpen: false,
        app: null,
        minVersion: '',
        forceUpdate: false,
        reason: '',
        submitting: false,
        error: null,
        fieldErrors: {},
      });

      setNotice({
        type: 'success',
        text: `Version policy for "${app.name}" updated: Min Version ${minVersion}, Force Update: ${forceUpdate ? 'Mandatory' : 'Optional'}.`,
      });
      setTimeout(() => setNotice(null), 5000);
    } catch (err) {
      setVersionModal((prev) => ({
        ...prev,
        submitting: false,
        error: err.message || 'Failed to update version policy.',
      }));
    }
  }

  // Action: Open History / Audit Modal
  async function openHistoryModal(app) {
    setHistoryModal({
      isOpen: true,
      app,
      loading: true,
      records: [],
      error: null,
    });

    try {
      const res = await fetchApplicationHistory(selectedCollegeId, app.app_id, { limit: 20 });
      setHistoryModal((prev) => ({
        ...prev,
        loading: false,
        records: res.history || [],
      }));
    } catch (err) {
      setHistoryModal((prev) => ({
        ...prev,
        loading: false,
        error: err.message || 'Failed to load change history',
      }));
    }
  }

  return (
    <div className="application-management-page" style={{ padding: '24px', maxWidth: '1280px', margin: '0 auto' }}>
      {/* Breadcrumb Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#64748b', marginBottom: '16px' }}>
        <Link to="/dashboard" style={{ color: '#38bdf8', textDecoration: 'none' }}>Super Admin</Link>
        <span>›</span>
        <Link to="/colleges" style={{ color: '#38bdf8', textDecoration: 'none' }}>Colleges</Link>
        {college && (
          <>
            <span>›</span>
            <Link to={`/colleges/${college.college_id}`} style={{ color: '#38bdf8', textDecoration: 'none' }}>
              {college.name}
            </Link>
          </>
        )}
        <span>›</span>
        <span style={{ color: '#94a3b8', fontWeight: 600 }}>Application Management</span>
      </div>

      {/* Header Container */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
              📱 Application Management
            </h1>
            {college && (
              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontWeight: 600,
                  backgroundColor: college.status === 'ACTIVE' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                  color: college.status === 'ACTIVE' ? '#10b981' : '#f59e0b',
                  border: `1px solid ${college.status === 'ACTIVE' ? '#10b981' : '#f59e0b'}`,
                }}
              >
                {college.status}
              </span>
            )}
          </div>
          <p style={{ margin: '6px 0 0', color: '#94a3b8', fontSize: '0.9rem' }}>
            Configure client application availability, SemVer floors, and forced upgrade requirements for institution portals.
          </p>
        </div>

        {/* Quick Actions & College Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {colleges.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label htmlFor="college-select" style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Institution:</label>
              <select
                id="college-select"
                value={selectedCollegeId}
                onChange={handleCollegeSwitch}
                style={{
                  backgroundColor: '#1e293b',
                  color: '#f8fafc',
                  border: '1px solid #334155',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                }}
              >
                {colleges.map((c) => (
                  <option key={c.college_id} value={c.college_id}>
                    {c.name} ({c.college_code})
                  </option>
                ))}
              </select>
            </div>
          )}

          {college && (
            <>
              <Link
                to={`/colleges/${college.college_id}`}
                className="btn btn-outline"
                style={{ fontSize: '0.85rem', padding: '6px 12px' }}
              >
                ← College Details
              </Link>
              <Link
                to={`/colleges/${college.college_id}/configuration`}
                className="btn btn-outline"
                style={{ fontSize: '0.85rem', padding: '6px 12px' }}
              >
                ⚙️ Configuration
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Global Notice Alert */}
      {notice && (
        <div
          style={{
            backgroundColor: notice.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${notice.type === 'success' ? '#10b981' : '#ef4444'}`,
            color: notice.type === 'success' ? '#10b981' : '#ef4444',
            padding: '12px 16px',
            borderRadius: '6px',
            marginBottom: '20px',
            fontSize: '0.9rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{notice.text}</span>
          <button
            onClick={() => setNotice(null)}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1rem' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid #ef4444',
            color: '#ef4444',
            padding: '16px',
            borderRadius: '6px',
            marginBottom: '24px',
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: '4px' }}>⚠️ Unable to load applications</div>
          <div style={{ fontSize: '0.85rem' }}>{error}</div>
        </div>
      )}

      {/* Architecture Guidance Banner */}
      <div
        style={{
          backgroundColor: '#0b1329',
          border: '1px solid #1e3a8a',
          borderRadius: '8px',
          padding: '16px 20px',
          marginBottom: '28px',
          display: 'flex',
          gap: '16px',
          alignItems: 'flex-start',
        }}
      >
        <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>ℹ️</span>
        <div style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.5' }}>
          <strong style={{ color: '#38bdf8' }}>Application Access Control & Module Preservation Boundary:</strong>
          <br />
          Application Management governs whether an entire client platform (Student App, Parent App, Security App, Hostel Incharge App, or Admin Portal) is authorized to connect and authenticate for this institution.
          <strong> Disabling or suspending an application immediately halts client access, but preserves all individual module configurations in Module Management.</strong>
          When an application is re-enabled, only previously enabled module entitlements become accessible.
        </div>
      </div>

      {/* Main Applications Catalogue Section */}
      {loading ? (
        <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>
          <div style={{ fontSize: '2rem', marginBottom: '12px' }}>⏳</div>
          <div>Loading institution applications & configuration policies...</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
          {applications.map((app) => {
            const isProtected = app.is_protected || app.app_id === 'admin_portal';
            const icon = APP_ICONS[app.app_id] || '📱';
            const platformLabel = APP_PLATFORM_LABELS[app.app_id] || 'Mobile / Web';

            let statusColor = '#10b981'; // Green for ENABLED
            let statusBg = 'rgba(16, 185, 129, 0.15)';
            if (app.status === 'DISABLED') {
              statusColor = '#94a3b8';
              statusBg = 'rgba(148, 163, 184, 0.15)';
            } else if (app.status === 'SUSPENDED') {
              statusColor = '#f59e0b';
              statusBg = 'rgba(245, 158, 11, 0.15)';
            }

            return (
              <div
                key={app.app_id}
                style={{
                  backgroundColor: '#1e293b',
                  borderRadius: '10px',
                  border: isProtected ? '1px solid #3b82f6' : '1px solid #334155',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1.75rem' }}>{icon}</span>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#f8fafc', fontWeight: 600 }}>{app.name}</h3>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>{platformLabel}</div>
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '4px 8px',
                      borderRadius: '4px',
                      backgroundColor: statusBg,
                      color: statusColor,
                      border: `1px solid ${statusColor}`,
                      letterSpacing: '0.03em',
                    }}
                  >
                    {app.status}
                  </span>
                </div>

                {/* Protected Portal Tag */}
                {isProtected && (
                  <div
                    style={{
                      backgroundColor: 'rgba(59, 130, 246, 0.15)',
                      border: '1px solid #3b82f6',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      marginBottom: '12px',
                      fontSize: '0.75rem',
                      color: '#60a5fa',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span>🛡️</span>
                    <span>System Protected — Essential Control Plane</span>
                  </div>
                )}

                {/* Description */}
                <p style={{ fontSize: '0.825rem', color: '#cbd5e1', lineHeight: '1.45', margin: '0 0 16px' }}>
                  {app.description}
                </p>

                {/* Configuration Metrics Box */}
                <div
                  style={{
                    backgroundColor: '#0f172a',
                    borderRadius: '6px',
                    padding: '12px',
                    marginBottom: '16px',
                    fontSize: '0.8rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    border: '1px solid #334155',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8' }}>Effective Access:</span>
                    <span style={{ fontWeight: 600, color: app.effective_access ? '#10b981' : '#ef4444' }}>
                      {app.effective_access ? '● Authorized & Active' : '✕ Access Blocked'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8' }}>Min Supported Version:</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#f8fafc' }}>
                      {app.min_version || '1.0.0'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8' }}>Force Upgrade Policy:</span>
                    <span
                      style={{
                        fontWeight: 600,
                        color: app.force_update ? '#ef4444' : '#94a3b8',
                      }}
                    >
                      {app.force_update ? 'Mandatory Upgrade (Enforced)' : 'Optional (Standard)'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8' }}>Active Module Entitlements:</span>
                    <span style={{ fontWeight: 600, color: '#38bdf8' }}>
                      {app.active_modules_count} of {app.total_modules_count} Active
                    </span>
                  </div>

                  {/* Associated Modules Tags */}
                  {app.associated_modules && app.associated_modules.length > 0 && (
                    <div style={{ marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {app.associated_modules.map((m) => (
                        <span
                          key={m}
                          style={{
                            fontSize: '0.65rem',
                            padding: '2px 6px',
                            backgroundColor: '#1e293b',
                            borderRadius: '3px',
                            color: '#94a3b8',
                            border: '1px solid #334155',
                          }}
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                  )}

                  {app.updated_at && (
                    <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '4px' }}>
                      Last configured: {new Date(app.updated_at).toLocaleString()}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {app.status === 'ENABLED' ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-outline"
                          disabled={isProtected}
                          onClick={() => openStatusModal(app, 'DISABLED')}
                          style={{
                            flex: 1,
                            fontSize: '0.8rem',
                            padding: '6px 8px',
                            color: isProtected ? '#475569' : '#f87171',
                            borderColor: isProtected ? '#334155' : 'rgba(239, 68, 68, 0.4)',
                            cursor: isProtected ? 'not-allowed' : 'pointer',
                          }}
                          title={isProtected ? 'Admin Portal cannot be disabled' : 'Disable application access'}
                        >
                          Disable
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline"
                          disabled={isProtected}
                          onClick={() => openStatusModal(app, 'SUSPENDED')}
                          style={{
                            flex: 1,
                            fontSize: '0.8rem',
                            padding: '6px 8px',
                            color: isProtected ? '#475569' : '#fbbf24',
                            borderColor: isProtected ? '#334155' : 'rgba(245, 158, 11, 0.4)',
                            cursor: isProtected ? 'not-allowed' : 'pointer',
                          }}
                          title={isProtected ? 'Admin Portal cannot be suspended' : 'Suspend application access'}
                        >
                          Suspend
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => openStatusModal(app, 'ENABLED')}
                        style={{
                          flex: 1,
                          fontSize: '0.8rem',
                          padding: '6px 8px',
                          backgroundColor: '#059669',
                          borderColor: '#059669',
                        }}
                      >
                        ✓ Enable Application
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => openVersionModal(app)}
                      style={{ flex: 1, fontSize: '0.8rem', padding: '6px 8px', color: '#38bdf8', borderColor: '#38bdf8' }}
                    >
                      ⚙️ Policy & Version
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => openHistoryModal(app)}
                      style={{ flex: 1, fontSize: '0.8rem', padding: '6px 8px' }}
                    >
                      📜 History
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* --- MODAL 1: STATUS CHANGE CONFIRMATION --- */}
      {statusModal.isOpen && statusModal.app && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '10px',
              maxWidth: '500px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#f8fafc' }}>
                Confirm {statusModal.targetStatus === 'ENABLED' ? 'Activation' : statusModal.targetStatus === 'DISABLED' ? 'Disablement' : 'Suspension'}
              </h3>
              <button
                type="button"
                onClick={() => setStatusModal({ isOpen: false, app: null, targetStatus: '', reason: '', submitting: false, error: null })}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.25rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {statusModal.error && (
              <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#ef4444', padding: '10px 14px', borderRadius: '6px', marginBottom: '16px', fontSize: '0.85rem' }}>
                {statusModal.error}
              </div>
            )}

            <div style={{ fontSize: '0.9rem', color: '#cbd5e1', marginBottom: '16px', lineHeight: '1.5' }}>
              Are you sure you want to transition <strong>{statusModal.app.name}</strong> to{' '}
              <strong style={{ color: statusModal.targetStatus === 'ENABLED' ? '#10b981' : '#ef4444' }}>
                {statusModal.targetStatus}
              </strong>{' '}
              for <strong>{college?.name}</strong>?
              {statusModal.targetStatus !== 'ENABLED' && (
                <div style={{ marginTop: '8px', padding: '8px 12px', backgroundColor: '#0f172a', borderRadius: '6px', borderLeft: '3px solid #f59e0b', fontSize: '0.8rem', color: '#f59e0b' }}>
                  ⚠️ Client applications will be immediately rejected upon connection. Individual module configurations and historical records remain fully preserved.
                </div>
              )}
            </div>

            <form onSubmit={handleStatusSubmit}>
              <div style={{ marginBottom: '20px' }}>
                <label htmlFor="status-reason" style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>
                  Reason for Change (Recorded in Audit Trail):
                </label>
                <textarea
                  id="status-reason"
                  rows={3}
                  value={statusModal.reason}
                  onChange={(e) => setStatusModal((prev) => ({ ...prev, reason: e.target.value }))}
                  placeholder="e.g. Scheduled institution maintenance, emergency gatepass policy, etc."
                  style={{
                    width: '100%',
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    color: '#f8fafc',
                    fontSize: '0.85rem',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={statusModal.submitting}
                  onClick={() => setStatusModal({ isOpen: false, app: null, targetStatus: '', reason: '', submitting: false, error: null })}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={statusModal.submitting}
                  style={{
                    backgroundColor: statusModal.targetStatus === 'ENABLED' ? '#059669' : '#dc2626',
                    borderColor: statusModal.targetStatus === 'ENABLED' ? '#059669' : '#dc2626',
                  }}
                >
                  {statusModal.submitting ? 'Applying Changes...' : `Confirm ${statusModal.targetStatus}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 2: VERSION & FORCE UPGRADE POLICY --- */}
      {versionModal.isOpen && versionModal.app && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '10px',
              maxWidth: '540px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#f8fafc' }}>
                Configure Version & Policy: {versionModal.app.name}
              </h3>
              <button
                type="button"
                onClick={() => setVersionModal({ isOpen: false, app: null, minVersion: '', forceUpdate: false, reason: '', submitting: false, error: null, fieldErrors: {} })}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.25rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {versionModal.error && (
              <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#ef4444', padding: '10px 14px', borderRadius: '6px', marginBottom: '16px', fontSize: '0.85rem' }}>
                {versionModal.error}
              </div>
            )}

            <form onSubmit={handleVersionSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label htmlFor="min-version-input" style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>
                  Minimum Supported Version (SemVer):
                </label>
                <input
                  id="min-version-input"
                  type="text"
                  value={versionModal.minVersion}
                  onChange={(e) => setVersionModal((prev) => ({ ...prev, minVersion: e.target.value }))}
                  placeholder="e.g. 1.0.0 or 2.1.0"
                  style={{
                    width: '100%',
                    backgroundColor: '#0f172a',
                    border: `1px solid ${versionModal.fieldErrors.minVersion ? '#ef4444' : '#334155'}`,
                    borderRadius: '6px',
                    padding: '8px 12px',
                    color: '#f8fafc',
                    fontFamily: 'monospace',
                    fontSize: '0.9rem',
                  }}
                />
                {versionModal.fieldErrors.minVersion ? (
                  <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px' }}>
                    {versionModal.fieldErrors.minVersion}
                  </div>
                ) : (
                  <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '4px' }}>
                    Clients presenting versions lower than this floor will be evaluated for upgrade restrictions.
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#0f172a', borderRadius: '6px', border: '1px solid #334155' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={versionModal.forceUpdate}
                    onChange={(e) => setVersionModal((prev) => ({ ...prev, forceUpdate: e.target.checked }))}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <div>
                    <span style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.85rem' }}>
                      Enforce Mandatory Force-Update
                    </span>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
                      When enabled, outdated clients will receive a mandatory HTTP 426 (Upgrade Required) response and will be blocked from accessing student, parent, or security operations until upgraded.
                    </div>
                  </div>
                </label>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label htmlFor="version-reason" style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>
                  Update Reason (Recorded in Audit Trail):
                </label>
                <input
                  id="version-reason"
                  type="text"
                  value={versionModal.reason}
                  onChange={(e) => setVersionModal((prev) => ({ ...prev, reason: e.target.value }))}
                  placeholder="e.g. Security patch v1.2 release, mandatory gatepass barcode upgrade"
                  style={{
                    width: '100%',
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    color: '#f8fafc',
                    fontSize: '0.85rem',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={versionModal.submitting}
                  onClick={() => setVersionModal({ isOpen: false, app: null, minVersion: '', forceUpdate: false, reason: '', submitting: false, error: null, fieldErrors: {} })}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={versionModal.submitting}
                >
                  {versionModal.submitting ? 'Saving Policy...' : 'Save Configuration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 3: AUDIT HISTORY --- */}
      {historyModal.isOpen && historyModal.app && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '10px',
              maxWidth: '750px',
              width: '100%',
              padding: '24px',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#f8fafc' }}>
                📜 Audit History: {historyModal.app.name}
              </h3>
              <button
                type="button"
                onClick={() => setHistoryModal({ isOpen: false, app: null, loading: false, records: [], error: null })}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.25rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {historyModal.loading ? (
              <div style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}>
                Loading audit trail from platform.audit_logs...
              </div>
            ) : historyModal.error ? (
              <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#ef4444', padding: '12px', borderRadius: '6px' }}>
                {historyModal.error}
              </div>
            ) : historyModal.records.length === 0 ? (
              <div style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}>
                No historical configuration changes recorded yet for this application.
              </div>
            ) : (
              <div style={{ overflowY: 'auto', flex: 1 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #334155', textAlign: 'left', color: '#94a3b8' }}>
                      <th style={{ padding: '8px' }}>Timestamp</th>
                      <th style={{ padding: '8px' }}>Action</th>
                      <th style={{ padding: '8px' }}>Actor</th>
                      <th style={{ padding: '8px' }}>Summary / Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyModal.records.map((rec) => (
                      <tr key={rec.audit_id} style={{ borderBottom: '1px solid rgba(51, 65, 85, 0.5)' }}>
                        <td style={{ padding: '10px 8px', color: '#94a3b8', fontSize: '0.75rem' }}>
                          {new Date(rec.timestamp).toLocaleString()}
                        </td>
                        <td style={{ padding: '10px 8px' }}>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: rec.action.includes('ENABLE') ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                              color: rec.action.includes('ENABLE') ? '#10b981' : '#f87171',
                            }}
                          >
                            {rec.action}
                          </span>
                        </td>
                        <td style={{ padding: '10px 8px', color: '#f8fafc' }}>
                          {rec.actor_role}
                        </td>
                        <td style={{ padding: '10px 8px', color: '#cbd5e1' }}>
                          <div>{rec.reason || 'Standard configuration update'}</div>
                          {rec.new_state && (
                            <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px', fontFamily: 'monospace' }}>
                              Status: {rec.new_state.status || 'N/A'} | MinVersion: {rec.new_state.min_version || 'N/A'}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setHistoryModal({ isOpen: false, app: null, loading: false, records: [], error: null })}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
