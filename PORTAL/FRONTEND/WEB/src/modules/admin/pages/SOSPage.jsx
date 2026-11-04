import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../shared/auth/useAuth';
import adminService from '../services/adminService';
import {
  AlertTriangle,
  ShieldAlert,
  PhoneCall,
  ShieldCheck,
  Clock,
  Info,
  Search,
  RefreshCw,
  Phone,
  GraduationCap,
  Users,
  Building2,
  CheckCircle2,
  MapPin,
  HeartPulse,
} from 'lucide-react';
import {
  PageHeader,
  DataTable,
  SearchInput,
  FilterControls,
  Modal,
  FormField,
  LoadingState,
  EmptyState,
  ErrorState,
} from '../../../shared/components';

export default function AdminSOSPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Master Data State
  const [students, setStudents] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [securityAssignments, setSecurityAssignments] = useState([]);
  const [gates, setGates] = useState([]);

  // Student Emergency Contacts Lookup State
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [studentContacts, setStudentContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);

  // UI & Loading States
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // =========================================================================
  // Master Data Fetching
  // =========================================================================
  const loadEmergencyContext = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    else setLoading(true);
    setErrorMessage(null);

    try {
      const [studentsRes, staffRes, secRes, gatesRes] = await Promise.allSettled([
        adminService.getStudents(),
        adminService.getStaff(),
        adminService.getSecurityAssignments(),
        adminService.getGates(),
      ]);

      if (studentsRes.status === 'fulfilled') {
        const raw = studentsRes.value;
        const list = Array.isArray(raw) ? raw : raw?.students || [];
        setStudents(list);
        if (list.length > 0 && !selectedStudentId) {
          setSelectedStudentId(list[0].id);
        }
      }

      if (staffRes.status === 'fulfilled') {
        const raw = staffRes.value;
        setStaffList(Array.isArray(raw) ? raw : raw?.staff || []);
      }

      if (secRes.status === 'fulfilled') {
        const raw = secRes.value;
        setSecurityAssignments(Array.isArray(raw) ? raw : raw?.assignments || []);
      }

      if (gatesRes.status === 'fulfilled') {
        const raw = gatesRes.value;
        setGates(Array.isArray(raw) ? raw : raw?.gates || []);
      }
    } catch (err) {
      console.error('Failed to load emergency response context:', err);
      setErrorMessage('Failed to load emergency command center records.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedStudentId]);

  useEffect(() => {
    loadEmergencyContext();
  }, [loadEmergencyContext]);

  // Load student emergency contacts when selectedStudentId changes
  useEffect(() => {
    if (!selectedStudentId) return;

    let isMounted = true;
    setLoadingContacts(true);

    adminService
      .getEmergencyContacts(selectedStudentId)
      .then((res) => {
        if (!isMounted) return;
        const contacts = Array.isArray(res) ? res : res?.contacts || res?.data || [];
        setStudentContacts(contacts);
      })
      .catch((err) => {
        console.warn('Could not load student emergency contacts:', err);
        if (isMounted) setStudentContacts([]);
      })
      .finally(() => {
        if (isMounted) setLoadingContacts(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedStudentId]);

  // Selected student object
  const activeStudent = useMemo(() => {
    return students.find((s) => s.id === selectedStudentId);
  }, [students, selectedStudentId]);

  return (
    <div className="fade-in-up">
      {/* Header Bar */}
      <div className="enterprise-page-header">
        <div className="header-text-group">
          <div className="header-title-row">
            <div className="header-icon-badge" style={{ background: '#fef2f2', color: '#dc2626' }}>
              <ShieldAlert size={22} />
            </div>
            <div>
              <h1 className="header-title">Emergency Response & SOS Command Center</h1>
              <p className="header-subtitle">
                Institutional crisis coordination, security dispatch, and resident emergency contacts.
              </p>
            </div>
          </div>
        </div>

        <div className="header-actions-group">
          <button
            type="button"
            className="action-btn-secondary"
            onClick={() => loadEmergencyContext(true)}
            disabled={isRefreshing || loading}
            title="Refresh Command Center Data"
          >
            <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Architecture Honesty Banner */}
      <div
        style={{
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '10px',
          padding: '14px 18px',
          marginBottom: '24px',
          display: 'flex',
          gap: '12px',
          alignItems: 'flex-start',
        }}
      >
        <Info size={18} style={{ color: '#2563eb', flexShrink: 0, marginTop: '2px' }} />
        <div style={{ fontSize: '13px', color: '#1e40af', lineHeight: 1.5 }}>
          <strong>Emergency Dispatcher Notice:</strong> While the PostgreSQL incident and alert tables (
          <code>app.sos_alerts</code> and <code>app.security_incidents</code>) exist in migration <code>007_support.sql</code>,
          the corresponding Go router real-time telemetry streaming endpoint (<code>/college/sos</code>) is
          awaiting deployment. Per strict HMS data integrity guidelines, zero fabricated SOS events or mock incidents
          are simulated. Verified resident emergency contacts (<code>/college/students/:id/emergency-contacts</code>)
          and on-duty crisis personnel are accessible below.
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="kpi-cards-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Emergency Hotlines</span>
            <div className="stat-kpi-icon-wrap red">
              <PhoneCall size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-rose-600">24 / 7</div>
          <div className="stat-kpi-footnote">
            <span className="status-dot red" />
            <span>Campus security line: Ext #100</span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">First Responders on Duty</span>
            <div className="stat-kpi-icon-wrap purple">
              <ShieldCheck size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-purple-600">
            {securityAssignments.filter((s) => s.status === 'ACTIVE').length}
          </div>
          <div className="stat-kpi-footnote">
            <span>Stationed gate security guards</span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Hostel Wardens on Call</span>
            <div className="stat-kpi-icon-wrap blue">
              <Users size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-blue-600">{staffList.length}</div>
          <div className="stat-kpi-footnote">
            <span>Emergency residential contacts</span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Perimeter Gate Coverage</span>
            <div className="stat-kpi-icon-wrap emerald">
              <Building2 size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-emerald-600">
            {gates.filter((g) => g.status === 'ACTIVE').length}
          </div>
          <div className="stat-kpi-footnote">
            <span className="status-dot green" />
            <span>Operational security checkpoints</span>
          </div>
        </div>
      </div>

      {/* Interactive Section: Student Emergency Contacts Lookup */}
      <div className="enterprise-card" style={{ marginBottom: '24px' }}>
        <div className="card-topbar">
          <div className="card-title-group">
            <div className="card-title-icon-wrap">
              <PhoneCall size={16} />
            </div>
            <h2 className="card-title-text">Resident Emergency Contacts Directory</h2>
          </div>
          <span className="badge-enterprise badge-rose">Crisis Lookup Tool</span>
        </div>

        <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
            Select Student to Retrieve Verified Emergency Contacts:
          </label>
          <select
            className="filter-select"
            style={{ width: '100%', maxWidth: '480px', height: '40px' }}
            value={selectedStudentId}
            onChange={(e) => setSelectedStudentId(e.target.value)}
          >
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.first_name} {s.last_name} (Reg: {s.registration_number || s.admission_number || s.id.slice(0, 8)})
              </option>
            ))}
          </select>
        </div>

        <div className="enterprise-table-container">
          <table className="enterprise-table">
            <thead>
              <tr>
                <th>Emergency Contact Name</th>
                <th>Relationship</th>
                <th>Primary Contact Phone</th>
                <th>Secondary Phone</th>
                <th>Priority / Primary Flag</th>
              </tr>
            </thead>
            <tbody>
              {loadingContacts ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '32px 0' }}>
                    <LoadingState message="Querying student emergency contacts..." />
                  </td>
                </tr>
              ) : studentContacts.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '32px 0', color: '#64748b' }}>
                    No emergency contact records on file for this student.
                  </td>
                </tr>
              ) : (
                studentContacts.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{c.name}</div>
                    </td>
                    <td>
                      <span className="badge-enterprise badge-blue">{c.relationship || 'Guardian'}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Phone size={13} style={{ color: '#059669' }} />
                        <strong style={{ color: '#0f172a' }}>{c.phone_primary || c.phone || 'N/A'}</strong>
                      </div>
                    </td>
                    <td>{c.phone_secondary || '—'}</td>
                    <td>
                      {c.is_primary ? (
                        <span className="badge-enterprise badge-emerald">PRIMARY GUARDIAN</span>
                      ) : (
                        <span className="badge-enterprise badge-slate">SECONDARY</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Emergency Crisis Response Protocols */}
      <div className="enterprise-card">
        <div className="card-topbar">
          <div className="card-title-group">
            <div className="card-title-icon-wrap">
              <HeartPulse size={16} />
            </div>
            <h2 className="card-title-text">Emergency Medical & Security Escalation Protocols</h2>
          </div>
        </div>

        <div style={{ padding: '20px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          <div style={{ background: '#fef2f2', padding: '16px', borderRadius: '8px', border: '1px solid #fecaca' }}>
            <div style={{ fontWeight: 700, color: '#991b1b', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <HeartPulse size={16} />
              <span>Medical Emergencies & Ambulance</span>
            </div>
            <div style={{ fontSize: '13px', color: '#7f1d1d', lineHeight: 1.5 }}>
              In case of severe resident illness or trauma, call Campus Health Center (Ext 108) and emergency dispatch 108.
              The duty warden must be dispatched to accompany the student to the nearest affiliated hospital.
            </div>
          </div>

          <div style={{ background: '#fffbeb', padding: '16px', borderRadius: '8px', border: '1px solid #fde68a' }}>
            <div style={{ fontWeight: 700, color: '#92400e', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertTriangle size={16} />
              <span>Fire & Facility Hazards</span>
            </div>
            <div style={{ fontSize: '13px', color: '#78350f', lineHeight: 1.5 }}>
              Activate the nearest manual fire call point. Evacuate through designated emergency stairwells. Security guards
              at Main Gate must immediately clear access lanes for emergency fire tenders.
            </div>
          </div>

          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={16} />
              <span>Perimeter Breach & Unauthorized Entry</span>
            </div>
            <div style={{ fontSize: '13px', color: '#334155', lineHeight: 1.5 }}>
              Security control room initiates immediate lockdown of turnstile gates. Quick response team is dispatched to the
              specified block and local law enforcement is notified if safety is compromised.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

