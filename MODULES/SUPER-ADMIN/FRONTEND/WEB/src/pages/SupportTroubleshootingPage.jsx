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
    <div className="page-container space-y-6">
      {/* Header */}
      <div className="header-container border-b border-gray-200 pb-5">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Wrench className="w-6 h-6 text-indigo-600" />
            Support & Diagnostic Troubleshooting Console
          </h1>
          <p className="page-subtitle">
            Time-boxed support grants, entitlement diagnosis, and audited privacy-masked student verification.
          </p>
        </div>
        <div className="quick-actions">
          <button
            onClick={() => loadGrants()}
            className="btn btn-outline"
            title="Refresh"
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowGrantModal(true)}
            className="btn btn-primary"
          >
            <Shield className="w-4 h-4" />
            Request Support Grant
          </button>
        </div>
      </div>


      {success && (
        <div className="p-4 bg-green-50 border border-green-200 text-green-800 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess(null)} className="text-green-600 font-bold">✕</button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-600 font-bold">✕</button>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs-container flex items-center border-b border-gray-200 gap-4 sm:gap-6 overflow-x-auto whitespace-nowrap">
        <button
          onClick={() => setActiveTab('GRANTS')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 flex-shrink-0 ${
            activeTab === 'GRANTS'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Shield className="w-4 h-4" />
          Time-Boxed Support Grants ({grants.length})
        </button>
        <button
          onClick={() => setActiveTab('ENTITLEMENTS')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 flex-shrink-0 ${
            activeTab === 'ENTITLEMENTS'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Search className="w-4 h-4" />
          Entitlement Diagnosis
        </button>
        <button
          onClick={() => setActiveTab('STUDENT_LOOKUP')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 flex-shrink-0 ${
            activeTab === 'STUDENT_LOOKUP'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Eye className="w-4 h-4" />
          Masked Student Lookup
        </button>
      </div>


      {/* Tab 1: Support Grants */}
      {activeTab === 'GRANTS' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-gray-900">Active & Historical Support Access Grants</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Regulated platform grants authorizing restricted diagnostic access into tenant data without account takeover.
              </p>
            </div>
            <button onClick={() => loadGrants()} className="p-2 border rounded-lg hover:bg-gray-100 text-gray-600">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {loading ? (
            <div className="p-12 text-center text-gray-500">Loading grants...</div>
          ) : grants.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <Shield className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p className="font-semibold text-gray-800">No support grants issued</p>
              <p className="text-xs text-gray-500 mt-1">Create a time-boxed grant to perform tenant-scoped support operations.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-600">
                <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200">
                  <tr>
                    <th className="py-3 px-4">College</th>
                    <th className="py-3 px-4">Ticket Ref</th>
                    <th className="py-3 px-4">Grantee</th>
                    <th className="py-3 px-4">Reason</th>
                    <th className="py-3 px-4">Validity Window</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {grants.map((g) => (
                    <tr key={g.grant_id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4 font-semibold text-gray-900">
                        {g.college_name} ({g.college_code})
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-indigo-600">{g.ticket_ref}</td>
                      <td className="py-3 px-4 text-gray-700">{g.grantee_email}</td>
                      <td className="py-3 px-4 text-gray-600 max-w-xs truncate">{g.reason}</td>
                      <td className="py-3 px-4 text-[11px] text-gray-500">
                        <div>Starts: {new Date(g.starts_at).toLocaleTimeString()}</div>
                        <div>Expires: {new Date(g.expires_at).toLocaleTimeString()}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                            g.is_active
                              ? 'bg-green-100 text-green-800'
                              : g.revoked_at
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {g.is_active ? 'ACTIVE' : g.revoked_at ? 'REVOKED' : 'EXPIRED'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {g.is_active && (
                          <button
                            onClick={() => handleRevokeGrant(g.grant_id)}
                            className="text-red-600 hover:text-red-800 font-semibold text-xs"
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Search className="w-4 h-4 text-indigo-600" />
              Diagnose Module Access
            </h2>
            <form onSubmit={handleDiagnoseEntitlement} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Target College</label>
                <select
                  value={entitlementForm.college_id}
                  onChange={(e) => setEntitlementForm({ ...entitlementForm, college_id: e.target.value })}
                  className="w-full text-xs border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500"
                >
                  {colleges.map((col) => (
                    <option key={col.college_id} value={col.college_id}>
                      {col.name} ({col.college_code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Module Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., MESS_MANAGEMENT, SECURITY"
                  value={entitlementForm.module_code}
                  onChange={(e) => setEntitlementForm({ ...entitlementForm, module_code: e.target.value })}
                  className="w-full text-xs border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 font-mono uppercase"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
              >
                {loading ? 'Evaluating...' : 'Run Access Diagnosis'}
              </button>
            </form>
          </div>

          <div className="md:col-span-2 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
            <h2 className="text-sm font-bold text-gray-900 mb-3">Diagnostic Evaluation Verdict</h2>
            {!diagnosticReport ? (
              <div className="p-12 text-center text-gray-400 text-xs">
                Select a college and enter a module code to evaluate access decision trees.
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                <div
                  className={`p-4 rounded-xl border ${
                    diagnosticReport.is_access_permitted
                      ? 'bg-green-50 border-green-200 text-green-900'
                      : 'bg-red-50 border-red-200 text-red-900'
                  }`}
                >
                  <div className="font-bold text-sm mb-1">{diagnosticReport.evaluation_verdict}</div>
                  <div className="text-[11px] opacity-80">
                    Evaluated at: {new Date(diagnosticReport.evaluated_at).toLocaleString()}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <span className="text-gray-500">Module in Catalog:</span>{' '}
                    <span className="font-semibold">{diagnosticReport.module_found ? 'YES' : 'NO'}</span>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <span className="text-gray-500">Catalog Status:</span>{' '}
                    <span className="font-semibold">{diagnosticReport.module_active_in_catalog ? 'ACTIVE' : 'INACTIVE'}</span>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <span className="text-gray-500">College Lifecycle:</span>{' '}
                    <span className="font-semibold">{diagnosticReport.college_status}</span>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <span className="text-gray-500">Tenant Entitlement:</span>{' '}
                    <span className="font-semibold">{diagnosticReport.entitlement_status}</span>
                  </div>
                </div>

                {diagnosticReport.blockers?.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="font-semibold text-red-700">Identified Access Blockers:</span>
                    <ul className="list-disc pl-5 text-gray-600 space-y-0.5">
                      {diagnosticReport.blockers.map((b, idx) => (
                        <li key={idx}>{b}</li>
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Eye className="w-4 h-4 text-indigo-600" />
              Audited Student Status Verification
            </h2>
            <form onSubmit={handleStudentLookup} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Target College</label>
                <select
                  value={studentForm.college_id}
                  onChange={(e) => setStudentForm({ ...studentForm, college_id: e.target.value })}
                  className="w-full text-xs border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500"
                >
                  {colleges.map((col) => (
                    <option key={col.college_id} value={col.college_id}>
                      {col.name} ({col.college_code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Admission Number</label>
                <input
                  type="text"
                  required
                  placeholder="Exact admission / roll no."
                  value={studentForm.admission_number}
                  onChange={(e) => setStudentForm({ ...studentForm, admission_number: e.target.value })}
                  className="w-full text-xs border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Troubleshooting Reason (Mandatory)</label>
                <input
                  type="text"
                  required
                  placeholder="Ticket ref or support justification"
                  value={studentForm.reason}
                  onChange={(e) => setStudentForm({ ...studentForm, reason: e.target.value })}
                  className="w-full text-xs border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
              >
                {loading ? 'Searching...' : 'Search Masked Record'}
              </button>
            </form>
          </div>

          <div className="md:col-span-2 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
            <h2 className="text-sm font-bold text-gray-900 mb-3">Privacy-Preserving Verification Record</h2>
            {!studentResult ? (
              <div className="p-12 text-center text-gray-400 text-xs">
                Enter an exact admission number and support justification to perform a privacy-redacted status lookup.
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-900 font-semibold flex items-center justify-between">
                  <span>Student Found ({studentResult.college_code})</span>
                  <span className="text-[11px] bg-indigo-200 px-2 py-0.5 rounded">Audited Access</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-500 text-[11px]">Admission Number</span>
                    <div className="font-mono font-bold text-gray-900 mt-0.5">{studentResult.admission_number}</div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-500 text-[11px]">Masked Name</span>
                    <div className="font-semibold text-gray-900 mt-0.5">{studentResult.masked_name}</div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-500 text-[11px]">Academic Status</span>
                    <div className="font-semibold text-gray-900 mt-0.5">{studentResult.student_status}</div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-500 text-[11px]">Hostel Bed Status</span>
                    <div className="font-semibold text-gray-900 mt-0.5">{studentResult.hostel_status}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Grant Creation Modal */}
      {showGrantModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 max-w-md w-full p-6 space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-600" />
                Issue Scoped Support Grant
              </h2>
              <button onClick={() => setShowGrantModal(false)} className="text-gray-400 hover:text-gray-600 font-bold">✕</button>
            </div>

            <form onSubmit={handleCreateGrant} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Target College</label>
                <select
                  value={grantForm.college_id}
                  onChange={(e) => setGrantForm({ ...grantForm, college_id: e.target.value })}
                  className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-indigo-500"
                >
                  {colleges.map((col) => (
                    <option key={col.college_id} value={col.college_id}>
                      {col.name} ({col.college_code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Duration (Minutes, Max 480)</label>
                <select
                  value={grantForm.duration_minutes}
                  onChange={(e) => setGrantForm({ ...grantForm, duration_minutes: Number(e.target.value) })}
                  className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={30}>30 Minutes</option>
                  <option value={60}>1 Hour</option>
                  <option value={120}>2 Hours</option>
                  <option value={240}>4 Hours</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Ticket Reference</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., TICKET-9821"
                  value={grantForm.ticket_ref}
                  onChange={(e) => setGrantForm({ ...grantForm, ticket_ref: e.target.value })}
                  className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Support Justification</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Explain why tenant diagnosis access is required..."
                  value={grantForm.reason}
                  onChange={(e) => setGrantForm({ ...grantForm, reason: e.target.value })}
                  className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowGrantModal(false)}
                  className="px-3 py-1.5 border rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold disabled:opacity-50"
                >
                  Issue Grant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
