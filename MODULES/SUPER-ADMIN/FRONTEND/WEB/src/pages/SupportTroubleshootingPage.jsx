import React, { useState, useEffect } from 'react';
import {
  Wrench,
  Shield,
  Search,
  Key,
  Unlock,
  AlertTriangle,
  CheckCircle,
  FileText,
  UserCheck,
  Building,
  RefreshCw,
  Clock,
  Eye,
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

export default function SupportTroubleshootingPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('GRANTS'); // 'GRANTS' | 'ENTITLEMENTS' | 'STUDENT_LOOKUP'

  // Data & State
  const [colleges, setColleges] = useState([]);
  const [grants, setGrants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // New Grant Form
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [grantForm, setGrantForm] = useState({
    college_id: '',
    duration_minutes: 60,
    reason: '',
    ticket_ref: '',
  });

  // Entitlement Diagnosis Form
  const [entitlementForm, setEntitlementForm] = useState({
    college_id: '',
    module_code: '',
  });
  const [diagnosticReport, setDiagnosticReport] = useState(null);

  // Student Lookup Form
  const [studentForm, setStudentForm] = useState({
    college_id: '',
    admission_number: '',
    reason: '',
  });
  const [studentResult, setStudentResult] = useState(null);

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
      setSuccess('Scoped support access grant created and audited successfully.');
      setShowGrantModal(false);
      loadGrants();
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to issue support grant');
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeGrant = async (grantId) => {
    const reason = window.prompt('Enter reason for revoking support grant:');
    if (!reason) return;
    try {
      await revokeSupportGrant(grantId, reason);
      setSuccess('Support grant revoked successfully.');
      loadGrants();
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to revoke grant');
    }
  };

  const handleDiagnoseEntitlement = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      setDiagnosticReport(null);
      const res = await diagnoseEntitlement(entitlementForm.college_id, entitlementForm.module_code);
      setDiagnosticReport(res?.data || null);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Entitlement diagnosis failed');
    } finally {
      setLoading(false);
    }
  };

  const handleStudentLookup = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      setStudentResult(null);
      const res = await performMaskedStudentLookup(
        studentForm.college_id,
        studentForm.admission_number,
        studentForm.reason
      );
      setStudentResult(res?.data || null);
      setSuccess('Student record retrieved with privacy redactions; access audited.');
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Student lookup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="header-container">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>🛠️</span>
            <span>Support & Diagnostic Troubleshooting Console</span>
          </h1>
          <p className="page-subtitle">
            Time-boxed support grants, entitlement diagnosis, and audited privacy-masked student verification.
          </p>
        </div>
        <div className="quick-actions">
          <button
            onClick={() => loadGrants()}
            className="btn btn-outline"
            title="Refresh grants list"
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setShowGrantModal(true)}
            className="btn btn-primary"
            id="btn-request-support-grant"
          >
            <Shield size={14} />
            <span>+ Request Support Grant</span>
          </button>
        </div>
      </div>

      {success && (
        <div className="alert-banner success">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle size={18} />
            <span>{success}</span>
          </div>
          <button
            onClick={() => setSuccess(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold', color: 'inherit' }}
          >
            ✕
          </button>
        </div>
      )}

      {error && (
        <div className="alert-banner error">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold', color: 'inherit' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="tab-group">
        <button
          onClick={() => setActiveTab('GRANTS')}
          className={`tab-pill ${activeTab === 'GRANTS' ? 'active' : ''}`}
        >
          <span>🛡️</span>
          <span>Time-Boxed Support Grants ({grants.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('ENTITLEMENTS')}
          className={`tab-pill ${activeTab === 'ENTITLEMENTS' ? 'active' : ''}`}
        >
          <span>🔍</span>
          <span>Entitlement Diagnosis</span>
        </button>
        <button
          onClick={() => setActiveTab('STUDENT_LOOKUP')}
          className={`tab-pill ${activeTab === 'STUDENT_LOOKUP' ? 'active' : ''}`}
        >
          <span>👁️</span>
          <span>Masked Student Lookup</span>
        </button>
      </div>

      {/* Tab 1: Support Grants */}
      {activeTab === 'GRANTS' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Active & Historical Support Access Grants</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Regulated platform grants authorizing restricted diagnostic access into tenant data without account takeover.
              </div>
            </div>
            <button
              onClick={() => loadGrants()}
              className="btn btn-outline btn-sm"
              title="Refresh"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          {loading ? (
            <div className="loading-box" style={{ border: 'none' }}>
              <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Loading grants...</div>
            </div>
          ) : grants.length === 0 ? (
            <div className="empty-box" style={{ border: 'none', padding: '56px 20px' }}>
              <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🛡️</div>
              <div style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '6px' }}>
                No support grants issued
              </div>
              <div className="empty-text" style={{ marginBottom: '20px' }}>
                Create a time-boxed grant to perform tenant-scoped support operations.
              </div>
              <button onClick={() => setShowGrantModal(true)} className="btn btn-primary">
                + Request Support Grant
              </button>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>College Tenant</th>
                    <th>Ticket Ref</th>
                    <th>Grantee</th>
                    <th>Reason</th>
                    <th>Validity Window</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {grants.map((g) => (
                    <tr key={g.grant_id}>
                      <td style={{ fontWeight: 600 }}>
                        {g.college_name} ({g.college_code})
                      </td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--primary-color)' }}>
                        {g.ticket_ref}
                      </td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{g.grantee_email}</td>
                      <td style={{ fontSize: '0.82rem', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {g.reason}
                      </td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        <div>Starts: {new Date(g.starts_at).toLocaleTimeString()}</div>
                        <div>Expires: {new Date(g.expires_at).toLocaleTimeString()}</div>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            g.is_active
                              ? 'badge-success'
                              : g.revoked_at
                              ? 'badge-danger'
                              : 'badge-muted'
                          }`}
                        >
                          {g.is_active ? 'ACTIVE' : g.revoked_at ? 'REVOKED' : 'EXPIRED'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {g.is_active && (
                          <button
                            onClick={() => handleRevokeGrant(g.grant_id)}
                            className="btn btn-outline btn-sm"
                            style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                          >
                            Revoke
                          </button>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <span>🔍</span>
                <span>Diagnose Module Access</span>
              </div>
            </div>
            <form onSubmit={handleDiagnoseEntitlement}>
              <div className="form-group">
                <label className="form-label">Target College</label>
                <select
                  value={entitlementForm.college_id}
                  onChange={(e) => setEntitlementForm({ ...entitlementForm, college_id: e.target.value })}
                  className="form-select"
                  style={{ width: '100%' }}
                >
                  {colleges.map((col) => (
                    <option key={col.college_id} value={col.college_id}>
                      {col.name} ({col.college_code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Module Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MESS_MANAGEMENT, SECURITY"
                  value={entitlementForm.module_code}
                  onChange={(e) => setEntitlementForm({ ...entitlementForm, module_code: e.target.value })}
                  className="form-input"
                  style={{ width: '100%', fontFamily: 'monospace', textTransform: 'uppercase' }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
                style={{ width: '100%', marginTop: '8px' }}
              >
                {loading ? 'Evaluating...' : 'Run Access Diagnosis'}
              </button>
            </form>
          </div>

          <div className="card" style={{ gridColumn: 'span 2' }}>
            <div className="card-header">
              <div className="card-title">Diagnostic Evaluation Verdict</div>
            </div>
            {!diagnosticReport ? (
              <div className="empty-box" style={{ border: 'none', padding: '36px' }}>
                <div className="empty-text">Select a college and enter a module code to evaluate access decision trees.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div
                  className={`alert-banner ${diagnosticReport.is_access_permitted ? 'success' : 'error'}`}
                  style={{ marginBottom: 0 }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.98rem' }}>{diagnosticReport.evaluation_verdict}</div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.85, marginTop: '2px' }}>
                      Evaluated at: {new Date(diagnosticReport.evaluated_at).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                  <div style={{ padding: '12px', backgroundColor: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Module in Catalog:</div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', marginTop: '2px' }}>{diagnosticReport.module_found ? 'YES' : 'NO'}</div>
                  </div>
                  <div style={{ padding: '12px', backgroundColor: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Catalog Status:</div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', marginTop: '2px' }}>{diagnosticReport.module_active_in_catalog ? 'ACTIVE' : 'INACTIVE'}</div>
                  </div>
                  <div style={{ padding: '12px', backgroundColor: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>College Lifecycle:</div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', marginTop: '2px' }}>{diagnosticReport.college_status}</div>
                  </div>
                  <div style={{ padding: '12px', backgroundColor: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Tenant Entitlement:</div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', marginTop: '2px' }}>{diagnosticReport.entitlement_status}</div>
                  </div>
                </div>

                {diagnosticReport.blockers?.length > 0 && (
                  <div style={{ backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: '8px', padding: '14px' }}>
                    <div style={{ fontWeight: 700, color: 'var(--danger-text)', fontSize: '0.88rem', marginBottom: '6px' }}>
                      Identified Access Blockers:
                    </div>
                    <ul style={{ paddingLeft: '20px', fontSize: '0.82rem', color: 'var(--danger-text)' }}>
                      {diagnosticReport.blockers.map((b, idx) => (
                        <li key={idx} style={{ marginTop: '2px' }}>{b}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Masked Student Lookup */}
      {activeTab === 'STUDENT_LOOKUP' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <span>👁️</span>
                <span>Audited Student Status Verification</span>
              </div>
            </div>
            <form onSubmit={handleStudentLookup}>
              <div className="form-group">
                <label className="form-label">Target College</label>
                <select
                  value={studentForm.college_id}
                  onChange={(e) => setStudentForm({ ...studentForm, college_id: e.target.value })}
                  className="form-select"
                  style={{ width: '100%' }}
                >
                  {colleges.map((col) => (
                    <option key={col.college_id} value={col.college_id}>
                      {col.name} ({col.college_code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Admission Number</label>
                <input
                  type="text"
                  required
                  placeholder="Exact admission / roll no."
                  value={studentForm.admission_number}
                  onChange={(e) => setStudentForm({ ...studentForm, admission_number: e.target.value })}
                  className="form-input"
                  style={{ width: '100%', fontFamily: 'monospace' }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Troubleshooting Reason (Mandatory)</label>
                <input
                  type="text"
                  required
                  placeholder="Ticket ref or support justification"
                  value={studentForm.reason}
                  onChange={(e) => setStudentForm({ ...studentForm, reason: e.target.value })}
                  className="form-input"
                  style={{ width: '100%' }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
                style={{ width: '100%', marginTop: '8px' }}
              >
                {loading ? 'Searching...' : 'Search Masked Record'}
              </button>
            </form>
          </div>

          <div className="card" style={{ gridColumn: 'span 2' }}>
            <div className="card-header">
              <div className="card-title">Privacy-Preserving Verification Record</div>
            </div>
            {!studentResult ? (
              <div className="empty-box" style={{ border: 'none', padding: '36px' }}>
                <div className="empty-text">Enter an exact admission number and support justification to perform a privacy-redacted status lookup.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="alert-banner info" style={{ marginBottom: 0 }}>
                  <div style={{ fontWeight: 600 }}>Student Found ({studentResult.college_code})</div>
                  <span className="badge badge-info">Audited Access</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                  <div style={{ padding: '12px', backgroundColor: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Admission Number</div>
                    <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '1rem', marginTop: '2px' }}>{studentResult.admission_number}</div>
                  </div>
                  <div style={{ padding: '12px', backgroundColor: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Masked Name</div>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem', marginTop: '2px' }}>{studentResult.masked_name}</div>
                  </div>
                  <div style={{ padding: '12px', backgroundColor: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Academic Status</div>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem', marginTop: '2px' }}>{studentResult.student_status}</div>
                  </div>
                  <div style={{ padding: '12px', backgroundColor: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Hostel Bed Status</div>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem', marginTop: '2px' }}>{studentResult.hostel_status}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Grant Creation Modal */}
      {showGrantModal && (
        <div className="modal-overlay">
          <div className="modal-dialog" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Shield size={18} color="var(--primary-color)" />
                <span>Issue Scoped Support Grant</span>
              </div>
              <button
                type="button"
                onClick={() => setShowGrantModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateGrant}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Target College</label>
                  <select
                    value={grantForm.college_id}
                    onChange={(e) => setGrantForm({ ...grantForm, college_id: e.target.value })}
                    className="form-select"
                    style={{ width: '100%' }}
                  >
                    {colleges.map((col) => (
                      <option key={col.college_id} value={col.college_id}>
                        {col.name} ({col.college_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Duration (Minutes, Max 480)</label>
                  <select
                    value={grantForm.duration_minutes}
                    onChange={(e) => setGrantForm({ ...grantForm, duration_minutes: Number(e.target.value) })}
                    className="form-select"
                    style={{ width: '100%' }}
                  >
                    <option value={30}>30 Minutes</option>
                    <option value={60}>1 Hour</option>
                    <option value={120}>2 Hours</option>
                    <option value={240}>4 Hours</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Ticket Reference</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. TICKET-9821"
                    value={grantForm.ticket_ref}
                    onChange={(e) => setGrantForm({ ...grantForm, ticket_ref: e.target.value })}
                    className="form-input"
                    style={{ width: '100%', fontFamily: 'monospace' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Support Justification</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Explain why tenant diagnosis access is required..."
                    value={grantForm.reason}
                    onChange={(e) => setGrantForm({ ...grantForm, reason: e.target.value })}
                    className="form-textarea"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setShowGrantModal(false)}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary"
                >
                  {loading ? 'Issuing...' : 'Issue Grant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
