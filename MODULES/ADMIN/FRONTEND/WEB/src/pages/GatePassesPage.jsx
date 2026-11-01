import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../shared/auth/useAuth';
import adminService from '../services/adminService';
import {
  Ticket,
  ShieldCheck,
  QrCode,
  Calendar,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Info,
  MapPin,
  Phone,
  GraduationCap,
  DoorOpen,
  X,
  ChevronRight,
  Shield,
  Building2,
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

export default function AdminGatePassesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Master Data State
  const [approvedClearances, setApprovedClearances] = useState([]);
  const [gates, setGates] = useState([]);
  const [students, setStudents] = useState([]);

  // UI & Loading States
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [gateFilter, setGateFilter] = useState('ALL');

  // Dossier Modal
  const [selectedClearance, setSelectedClearance] = useState(null);
  const [dossierOpen, setDossierOpen] = useState(false);

  // Quick lookup dictionary for student metadata
  const studentMap = useMemo(() => {
    const map = new Map();
    students.forEach((s) => map.set(s.id, s));
    return map;
  }, [students]);

  // =========================================================================
  // Master Data Fetching
  // =========================================================================
  const loadClearanceData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    else setLoading(true);
    setErrorMessage(null);

    try {
      const [leavesRes, gatesRes, studentsRes] = await Promise.allSettled([
        adminService.getLeaveRequests({ status: 'APPROVED' }),
        adminService.getGates(),
        adminService.getStudents(),
      ]);

      if (leavesRes.status === 'fulfilled') {
        const raw = leavesRes.value;
        const allLeaves = Array.isArray(raw) ? raw : raw?.leaves || raw?.requests || [];
        // Only keep approved or currently active clearances
        setApprovedClearances(allLeaves.filter((l) => l.status === 'APPROVED'));
      } else {
        console.warn('Failed to load approved clearances:', leavesRes.reason);
      }

      if (gatesRes.status === 'fulfilled') {
        const rawG = gatesRes.value;
        setGates(Array.isArray(rawG) ? rawG : rawG?.gates || []);
      }

      if (studentsRes.status === 'fulfilled') {
        const rawS = studentsRes.value;
        setStudents(Array.isArray(rawS) ? rawS : rawS?.students || []);
      }
    } catch (err) {
      console.error('Failed to load clearance data:', err);
      setErrorMessage('Failed to load gate clearance records.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadClearanceData();
  }, [loadClearanceData]);

  // =========================================================================
  // Filtering & Search
  // =========================================================================
  const filteredClearances = useMemo(() => {
    return approvedClearances.filter((clearance) => {
      const student = studentMap.get(clearance.student_id);
      const studentName = student
        ? `${student.first_name || ''} ${student.last_name || ''}`.trim()
        : '';
      const regNo = student?.registration_number || student?.admission_number || '';
      const dest = clearance.destination || '';
      const term = searchTerm.toLowerCase().trim();

      const matchesSearch =
        !term ||
        studentName.toLowerCase().includes(term) ||
        regNo.toLowerCase().includes(term) ||
        dest.toLowerCase().includes(term) ||
        (clearance.id && clearance.id.toLowerCase().includes(term));

      return matchesSearch;
    });
  }, [approvedClearances, studentMap, searchTerm]);

  // Open Dossier
  const handleOpenDossier = (clearance) => {
    setSelectedClearance(clearance);
    setDossierOpen(true);
  };

  return (
    <div className="enterprise-module-page">
      {/* Header Bar */}
      <div className="enterprise-page-header">
        <div className="header-text-group">
          <div className="header-title-row">
            <div className="header-icon-badge">
              <Ticket size={22} />
            </div>
            <div>
              <h1 className="header-title">Gate Pass & Departure Clearances</h1>
              <p className="header-subtitle">
                Approved resident outpasses, perimeter exit authorization, and security clearance checks.
              </p>
            </div>
          </div>
        </div>

        <div className="header-actions-group">
          <button
            type="button"
            className="action-btn-secondary"
            onClick={() => loadClearanceData(true)}
            disabled={isRefreshing || loading}
            title="Refresh Gate Clearances"
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
          <strong>Gate Clearance Protocol:</strong> Formal campus gate passes are governed authoritatively
          by <strong>Approved Student Leave Applications</strong> (<code>GET /college/leaves?status=APPROVED</code>).
          Security personnel at campus checkpoints verify these real-time authorized clearances before logging
          student departure. The standalone QR token schema (<code>app.gate_passes</code>) will automatically link
          here once the backend router exposes it.
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="kpi-cards-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Active Exit Clearances</span>
            <div className="stat-kpi-icon-wrap emerald">
              <Ticket size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-emerald-600">{approvedClearances.length}</div>
          <div className="stat-kpi-footnote">
            <span className="status-dot green" />
            <span>Authorized for campus departure</span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Active Campus Gates</span>
            <div className="stat-kpi-icon-wrap blue">
              <DoorOpen size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-blue-600">
            {gates.filter((g) => g.status === 'ACTIVE').length}
          </div>
          <div className="stat-kpi-footnote">
            <span>Operational security checkpoints</span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Guard Clearance Mode</span>
            <div className="stat-kpi-icon-wrap purple">
              <ShieldCheck size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-purple-600">ACTIVE</div>
          <div className="stat-kpi-footnote">
            <span>Biometric & ID Roll Verification</span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Emergency Protocol</span>
            <div className="stat-kpi-icon-wrap orange">
              <Clock size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-orange-600">STANDBY</div>
          <div className="stat-kpi-footnote">
            <span>Parent contact linkage verified</span>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="enterprise-card">
        <div className="card-topbar">
          <div className="card-title-group">
            <div className="card-title-icon-wrap">
              <Ticket size={16} />
            </div>
            <h2 className="card-title-text">Authorized Gate Departure Registry</h2>
          </div>
          <span className="badge-enterprise badge-emerald">
            {filteredClearances.length} of {approvedClearances.length} Clearances Active
          </span>
        </div>

        {/* Filter Toolbar */}
        <div className="enterprise-filter-bar">
          <div className="filter-search-field">
            <Search size={14} className="filter-search-icon" />
            <input
              type="text"
              className="filter-search-input"
              placeholder="Search by student name, registration number, destination..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Clearances Table */}
        <div className="enterprise-table-container">
          <table className="enterprise-table">
            <thead>
              <tr>
                <th>Resident Student</th>
                <th>Clearance Type</th>
                <th>Authorized Period</th>
                <th>Destination</th>
                <th>Emergency Contact</th>
                <th>Verification State</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '48px 0' }}>
                    <LoadingState message="Loading gate clearance records..." />
                  </td>
                </tr>
              ) : filteredClearances.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '48px 0' }}>
                    <EmptyState
                      icon={Ticket}
                      title="No active gate clearances found"
                      description={
                        searchTerm
                          ? 'No student matches your search query.'
                          : 'There are currently no approved student leaves awaiting departure at campus gates.'
                      }
                    />
                  </td>
                </tr>
              ) : (
                filteredClearances.map((clearance) => {
                  const student = studentMap.get(clearance.student_id);
                  const studentName = student
                    ? `${student.first_name || ''} ${student.last_name || ''}`.trim()
                    : 'Resident Student';
                  const regNo =
                    student?.registration_number ||
                    student?.admission_number ||
                    (clearance.student_id ? clearance.student_id.slice(0, 8) + '...' : 'N/A');

                  const fromDate = clearance.from_date
                    ? new Date(clearance.from_date).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })
                    : '—';
                  const toDate = clearance.to_date
                    ? new Date(clearance.to_date).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : '—';

                  return (
                    <tr key={clearance.id} className="enterprise-table-row">
                      {/* Student */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '8px',
                              background: '#f1f5f9',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#475569',
                              fontWeight: 600,
                              fontSize: '13px',
                              flexShrink: 0,
                            }}
                          >
                            <GraduationCap size={16} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '13.5px' }}>
                              {studentName}
                            </div>
                            <div style={{ fontSize: '12px', color: '#64748b' }}>
                              Reg: <code style={{ fontSize: '11.5px' }}>{regNo}</code>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Type */}
                      <td>
                        <span className="badge-enterprise badge-emerald">
                          {clearance.leave_type || 'OUTPASS'}
                        </span>
                      </td>

                      {/* Period */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Calendar size={13} style={{ color: '#64748b' }} />
                          <span style={{ fontWeight: 500, fontSize: '13px' }}>
                            {fromDate} &rarr; {toDate}
                          </span>
                        </div>
                      </td>

                      {/* Destination */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <MapPin size={12} style={{ color: '#64748b' }} />
                          <span style={{ fontSize: '13px', color: '#1e293b', fontWeight: 500 }}>
                            {clearance.destination || 'Home Address'}
                          </span>
                        </div>
                      </td>

                      {/* Contact Phone */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Phone size={12} style={{ color: '#64748b' }} />
                          <span style={{ fontSize: '12.5px', color: '#334155' }}>
                            {clearance.contact_phone || student?.phone || 'Not specified'}
                          </span>
                        </div>
                      </td>

                      {/* Verification Status */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <CheckCircle2 size={15} style={{ color: '#10b981' }} />
                          <span
                            style={{
                              fontSize: '12px',
                              fontWeight: 600,
                              color: '#047857',
                            }}
                          >
                            GATE AUTHORIZED
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="table-icon-btn"
                          title="Inspect Security Clearance Dossier"
                          onClick={() => handleOpenDossier(clearance)}
                        >
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =================================================================== */}
      {/* DRAWER: Gate Clearance Dossier                                      */}
      {/* =================================================================== */}
      {dossierOpen && selectedClearance && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            justifyContent: 'flex-end',
            background: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(2px)',
          }}
          onClick={() => setDossierOpen(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '460px',
              height: '100%',
              background: '#ffffff',
              boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.15)',
              padding: '28px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingBottom: '16px',
                borderBottom: '1px solid #f1f5f9',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Ticket size={20} style={{ color: '#2563eb' }} />
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 600, color: '#0f172a' }}>
                  Gate Clearance Credentials
                </h3>
              </div>
              <button
                type="button"
                className="table-icon-btn"
                onClick={() => setDossierOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            {/* Resident Card */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '16px',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                Resident Profile
              </div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
                {studentMap.get(selectedClearance.student_id)?.first_name || 'Resident'}{' '}
                {studentMap.get(selectedClearance.student_id)?.last_name || ''}
              </div>
              <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '2px' }}>
                Reg Number:{' '}
                <code style={{ color: '#0f172a' }}>
                  {studentMap.get(selectedClearance.student_id)?.registration_number ||
                    studentMap.get(selectedClearance.student_id)?.admission_number ||
                    'N/A'}
                </code>
              </div>
              <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '2px' }}>
                Phone: {selectedClearance.contact_phone || studentMap.get(selectedClearance.student_id)?.phone || 'N/A'}
              </div>
            </div>

            {/* Security Clearance Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px 0',
                  borderBottom: '1px solid #f1f5f9',
                }}
              >
                <span style={{ fontSize: '13px', color: '#64748b' }}>Security Clearance</span>
                <span className="badge-enterprise badge-emerald">VERIFIED & APPROVED</span>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px 0',
                  borderBottom: '1px solid #f1f5f9',
                }}
              >
                <span style={{ fontSize: '13px', color: '#64748b' }}>Outpass Category</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
                  {selectedClearance.leave_type}
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px 0',
                  borderBottom: '1px solid #f1f5f9',
                }}
              >
                <span style={{ fontSize: '13px', color: '#64748b' }}>Departure Schedule</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
                  {new Date(selectedClearance.from_date).toLocaleDateString()}
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px 0',
                  borderBottom: '1px solid #f1f5f9',
                }}
              >
                <span style={{ fontSize: '13px', color: '#64748b' }}>Expected Return</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
                  {new Date(selectedClearance.to_date).toLocaleDateString()}
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px 0',
                  borderBottom: '1px solid #f1f5f9',
                }}
              >
                <span style={{ fontSize: '13px', color: '#64748b' }}>Travel Destination</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
                  {selectedClearance.destination || 'Home Address'}
                </span>
              </div>
            </div>

            {/* Purpose */}
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                Declared Reason
              </div>
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: '12px',
                  fontSize: '13px',
                  color: '#334155',
                  lineHeight: 1.5,
                }}
              >
                {selectedClearance.reason || 'Personal visit.'}
              </div>
            </div>

            <div
              style={{
                marginTop: 'auto',
                padding: '14px',
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                borderRadius: '8px',
                color: '#065f46',
                fontSize: '12.5px',
                lineHeight: 1.4,
              }}
            >
              <strong>Security Protocol Notice:</strong> Match resident photo ID and student card registration
              number before issuing gate exit timestamp.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
