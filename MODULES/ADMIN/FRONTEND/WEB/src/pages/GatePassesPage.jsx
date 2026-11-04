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
  Sparkles,
  LayoutGrid,
  List,
  Printer,
  Radio,
  CheckCheck,
  AlertTriangle,
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

  // Display Mode: Cards vs Table
  const [displayMode, setDisplayMode] = useState(() => {
    return localStorage.getItem('hms_gate_passes_view_mode') || 'cards';
  });

  const handleSetDisplayMode = (mode) => {
    setDisplayMode(mode);
    localStorage.setItem('hms_gate_passes_view_mode', mode);
  };

  // Master Data State
  const [approvedClearances, setApprovedClearances] = useState([]);
  const [gates, setGates] = useState([]);
  const [students, setStudents] = useState([]);
  const [hostels, setHostels] = useState([]);

  // UI & Loading States
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successBanner, setSuccessBanner] = useState(null);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
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

  // Quick lookup dictionary for hostels
  const hostelMap = useMemo(() => {
    const map = new Map();
    hostels.forEach((h) => map.set(h.id, h));
    return map;
  }, [hostels]);

  // =========================================================================
  // Master Data Fetching
  // =========================================================================
  const loadClearanceData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    else setLoading(true);
    setErrorMessage(null);

    try {
      const [leavesRes, gatesRes, studentsRes, hostelsRes] = await Promise.allSettled([
        adminService.getLeaveRequests({ status: 'APPROVED' }),
        adminService.getGates(),
        adminService.getStudents(),
        adminService.getHostels(),
      ]);

      if (leavesRes.status === 'fulfilled') {
        const raw = leavesRes.value;
        const allLeaves = Array.isArray(raw) ? raw : raw?.leaves || raw?.requests || [];
        // Only keep approved clearances
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

      if (hostelsRes.status === 'fulfilled') {
        const rawH = hostelsRes.value;
        setHostels(Array.isArray(rawH) ? rawH : rawH?.hostels || []);
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

  // Toast banner auto-dismiss
  useEffect(() => {
    if (successBanner) {
      const timer = setTimeout(() => setSuccessBanner(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successBanner]);

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
      const token = `GP-${(clearance.id || '').slice(0, 6).toUpperCase()}`;
      const term = searchTerm.toLowerCase().trim();

      const matchesSearch =
        !term ||
        studentName.toLowerCase().includes(term) ||
        regNo.toLowerCase().includes(term) ||
        dest.toLowerCase().includes(term) ||
        token.toLowerCase().includes(term) ||
        (clearance.id && clearance.id.toLowerCase().includes(term));

      const matchesType =
        typeFilter === 'ALL' ||
        String(clearance.leave_type || '').toUpperCase() === typeFilter.toUpperCase();

      return matchesSearch && matchesType;
    });
  }, [approvedClearances, studentMap, searchTerm, typeFilter]);

  const hasActiveFilters = searchTerm !== '' || typeFilter !== 'ALL';

  const handleResetFilters = () => {
    setSearchTerm('');
    setTypeFilter('ALL');
  };

  // Open Dossier
  const handleOpenDossier = (clearance) => {
    setSelectedClearance(clearance);
    setDossierOpen(true);
  };

  // Helper for Leave Type Badges
  const getLeaveTypeBadge = (type) => {
    switch (type) {
      case 'DAY_LEAVE':
        return <span className="badge-enterprise badge-blue">Day Outpass</span>;
      case 'OVERNIGHT':
        return <span className="badge-enterprise badge-purple">Overnight</span>;
      case 'WEEKEND':
        return <span className="badge-enterprise badge-teal">Weekend</span>;
      case 'EMERGENCY':
        return <span className="badge-enterprise badge-rose">Emergency</span>;
      case 'MEDICAL':
        return <span className="badge-enterprise badge-amber">Medical</span>;
      default:
        return <span className="badge-enterprise badge-emerald">{type || 'OUTPASS'}</span>;
    }
  };

  // Helper for Duration Calculation
  const getDurationText = (from, to) => {
    if (!from || !to) return null;
    const diff = new Date(to) - new Date(from);
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days <= 1) return '1 Day';
    return `${days} Days`;
  };

  return (
    <div className="fade-in-up">
      {/* Enterprise Hero Header */}
      <div className="enterprise-hero-header">
        <div className="hero-header-titles">
          <div className="hero-category-pill">
            <Ticket size={13} className="hero-category-icon" />
            <span>Operations &amp; Movement</span>
          </div>
          <h1 className="hero-main-title">Gate Clearance & Exit Passes</h1>
          <p className="hero-subtitle">
            Approved resident departures, perimeter gate clearance verification, active student outpass inspection, and digital token audit.
          </p>
        </div>

        <div className="hero-action-buttons">
          <button
            type="button"
            className="btn-enterprise-secondary"
            onClick={() => loadClearanceData(true)}
            disabled={isRefreshing || loading}
            title="Refresh Gate Clearances"
          >
            <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Sync Passes</span>
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successBanner && (
        <div
          style={{
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            color: '#065f46',
            padding: '12px 18px',
            borderRadius: '10px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '13.5px',
            fontWeight: 500,
          }}
        >
          <CheckCircle2 size={16} style={{ color: '#059669', flexShrink: 0 }} />
          <span>{successBanner}</span>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            padding: '12px 18px',
            borderRadius: '10px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '13.5px',
            fontWeight: 500,
          }}
        >
          <AlertTriangle size={16} style={{ color: '#dc2626', flexShrink: 0 }} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Modern Clearance Protocol Notice Banner */}
      <div className="clearance-protocol-banner">
        <div className="clearance-banner-icon">
          <Radio size={20} />
        </div>
        <div className="clearance-banner-content">
          <div className="clearance-banner-title">
            <span className="clearance-banner-pulse" />
            <span>Gate Clearance Protocol & Live Exit Authorization</span>
          </div>
          <p className="clearance-banner-text">
            Formal campus gate passes are governed authoritatively by <strong>Approved Student Leave Applications</strong>. Checkpoint security officers inspect real-time digital pass tokens and verify resident identity against active student records prior to logging perimeter departures.
          </p>
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
            <span>Authorized for departure</span>
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
            <span className="stat-kpi-label">Clearance Verification</span>
            <div className="stat-kpi-icon-wrap purple">
              <ShieldCheck size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-purple-600">BIOMETRIC</div>
          <div className="stat-kpi-footnote">
            <span>ID roll & photo check</span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Curfew Protocol</span>
            <div className="stat-kpi-icon-wrap orange">
              <Clock size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-orange-600">22:00 ROLL</div>
          <div className="stat-kpi-footnote">
            <span className="status-dot orange" />
            <span>Strict late log enforcement</span>
          </div>
        </div>
      </div>

      {/* Main Clearances Section */}
      <div className="enterprise-card">
        <div className="card-topbar">
          <div className="card-title-group">
            <div className="card-title-icon-wrap">
              <Ticket size={16} />
            </div>
            <h2 className="card-title-text">Authorized Gate Departure Registry</h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className="badge-enterprise badge-emerald">
              {filteredClearances.length} of {approvedClearances.length} Clearances Active
            </span>

            {/* View Mode Switcher */}
            <div className="view-toggle-group">
              <button
                type="button"
                className={`view-toggle-btn ${displayMode === 'cards' ? 'active' : ''}`}
                onClick={() => handleSetDisplayMode('cards')}
                title="Card Grid View"
              >
                <LayoutGrid size={15} />
                <span>Cards</span>
              </button>
              <button
                type="button"
                className={`view-toggle-btn ${displayMode === 'table' ? 'active' : ''}`}
                onClick={() => handleSetDisplayMode('table')}
                title="Table View"
              >
                <List size={15} />
                <span>Table</span>
              </button>
            </div>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="enterprise-filter-bar">
          <div className="filter-search-field">
            <Search size={14} className="filter-search-icon" />
            <input
              type="text"
              className="filter-search-input"
              placeholder="Search by student name, registration number, destination, token..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <select
              className="filter-select"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="ALL">All Outpass Types</option>
              <option value="DAY_LEAVE">Day Outpass</option>
              <option value="OVERNIGHT">Overnight</option>
              <option value="WEEKEND">Weekend</option>
              <option value="EMERGENCY">Emergency</option>
              <option value="MEDICAL">Medical</option>
            </select>

            {hasActiveFilters && (
              <button
                type="button"
                className="btn-enterprise-secondary"
                style={{ padding: '6px 12px', fontSize: '12px' }}
                onClick={handleResetFilters}
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <LoadingState message="Loading gate clearance records from backend..." />
          </div>
        ) : filteredClearances.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <EmptyState
              icon={Ticket}
              title="No active gate clearances found"
              description={
                hasActiveFilters
                  ? 'No approved student leaves match your search criteria.'
                  : 'There are currently no approved student leaves awaiting departure at campus gates.'
              }
            />
          </div>
        ) : displayMode === 'cards' ? (
          /* ========================================================================= */
          /* CARDS VIEW MODE                                                           */
          /* ========================================================================= */
          <div style={{ padding: '18px 20px' }}>
            <div className="clearances-grid-cards">
              {filteredClearances.map((clearance) => {
                const student = studentMap.get(clearance.student_id);
                const studentName = student
                  ? `${student.first_name || ''} ${student.last_name || ''}`.trim()
                  : 'Resident Student';
                const initials = student
                  ? `${student.first_name?.[0] || 'S'}${student.last_name?.[0] || 'R'}`.toUpperCase()
                  : 'ST';
                const regNo =
                  student?.registration_number ||
                  student?.admission_number ||
                  (clearance.student_id ? clearance.student_id.slice(0, 8) + '...' : 'N/A');
                const hostel = student?.hostel_id ? hostelMap.get(student.hostel_id) : null;
                const hostelName = hostel?.name || 'Resident Hostel';
                const token = `GP-${(clearance.id || '').slice(0, 6).toUpperCase()}`;

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
                const duration = getDurationText(clearance.from_date, clearance.to_date);

                return (
                  <div key={clearance.id} className="clearance-card-v2">
                    {/* Card Top Strip */}
                    <div className="clearance-card-top">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                        <div className="clearance-avatar-box">{initials}</div>
                        <div style={{ minWidth: 0 }}>
                          <h3 className="clearance-name-title" title={studentName}>
                            {studentName}
                          </h3>
                          <div className="clearance-code-sub">
                            <code
                              style={{
                                background: '#f1f5f9',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontWeight: 700,
                                fontSize: '11px',
                                color: '#0f172a',
                              }}
                            >
                              {regNo}
                            </code>
                            <span>•</span>
                            {getLeaveTypeBadge(clearance.leave_type)}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span className="badge-enterprise badge-emerald">
                          <CheckCircle2 size={11} style={{ marginRight: '3px' }} />
                          AUTHORIZED
                        </span>
                      </div>
                    </div>

                    {/* Card Body Info Stack */}
                    <div className="clearance-card-body">
                      <div className="clearance-info-stack">
                        {/* Period & Duration */}
                        <div className="clearance-info-row">
                          <Calendar size={13} style={{ color: '#059669', flexShrink: 0 }} />
                          <span style={{ fontWeight: 600, color: '#334155' }}>Window:</span>
                          <span style={{ color: '#0f172a', fontWeight: 600 }}>
                            {fromDate} &rarr; {toDate}
                          </span>
                          {duration && (
                            <span
                              style={{
                                marginLeft: 'auto',
                                background: '#e0f2fe',
                                color: '#0369a1',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 600,
                              }}
                            >
                              {duration}
                            </span>
                          )}
                        </div>

                        {/* Destination */}
                        <div className="clearance-info-row" title={clearance.destination || 'Home Address'}>
                          <MapPin size={13} style={{ color: '#64748b', flexShrink: 0 }} />
                          <span style={{ fontWeight: 600, color: '#334155' }}>Destination:</span>
                          <span style={{ color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {clearance.destination || 'Home Address'}
                          </span>
                        </div>

                        {/* Facility */}
                        <div className="clearance-info-row">
                          <Building2 size={13} style={{ color: '#64748b', flexShrink: 0 }} />
                          <span style={{ fontWeight: 600, color: '#334155' }}>Hostel:</span>
                          <span style={{ color: '#475569' }}>{hostelName}</span>
                        </div>

                        {/* Emergency Contact */}
                        <div className="clearance-info-row">
                          <Phone size={13} style={{ color: '#64748b', flexShrink: 0 }} />
                          <span style={{ fontWeight: 600, color: '#334155' }}>Contact:</span>
                          <span style={{ color: '#475569' }}>
                            {clearance.contact_phone || student?.phone || 'Campus Emergency'}
                          </span>
                        </div>
                      </div>

                      {/* Pass Token & Checkpoint Pill */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 10px',
                          background: '#f8fafc',
                          border: '1px solid #f1f5f9',
                          borderRadius: '8px',
                          fontSize: '11.5px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <QrCode size={14} style={{ color: '#059669' }} />
                          <span style={{ fontWeight: 700, color: '#0f172a' }}>{token}</span>
                        </div>
                        <span style={{ color: '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCheck size={13} />
                          Ready for Exit
                        </span>
                      </div>
                    </div>

                    {/* Card Footer */}
                    <div className="clearance-card-footer">
                      <button
                        type="button"
                        className="btn-enterprise-secondary"
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                        onClick={() => handleOpenDossier(clearance)}
                      >
                        <Eye size={13} />
                        <span>Dossier & Credentials</span>
                      </button>

                      <div style={{ fontSize: '11px', color: '#64748b' }}>
                        ID Roll Matched
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* TABLE VIEW MODE                                                           */
          /* ========================================================================= */
          <div className="enterprise-table-container">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Resident Student</th>
                  <th>Pass Token & Type</th>
                  <th>Authorized Period</th>
                  <th>Destination</th>
                  <th>Contact Phone</th>
                  <th>Verification State</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredClearances.map((clearance) => {
                  const student = studentMap.get(clearance.student_id);
                  const studentName = student
                    ? `${student.first_name || ''} ${student.last_name || ''}`.trim()
                    : 'Resident Student';
                  const initials = student
                    ? `${student.first_name?.[0] || 'S'}${student.last_name?.[0] || 'R'}`.toUpperCase()
                    : 'ST';
                  const regNo =
                    student?.registration_number ||
                    student?.admission_number ||
                    (clearance.student_id ? clearance.student_id.slice(0, 8) + '...' : 'N/A');
                  const token = `GP-${(clearance.id || '').slice(0, 6).toUpperCase()}`;

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
                            className="clearance-avatar-box"
                            style={{ width: '32px', height: '32px', fontSize: '0.8rem', borderRadius: '8px' }}
                          >
                            {initials}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '13.5px' }}>
                              {studentName}
                            </div>
                            <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                              Reg: <code style={{ fontSize: '11px' }}>{regNo}</code>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Token & Type */}
                      <td>
                        <div>
                          <code
                            style={{
                              background: '#f1f5f9',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontWeight: 700,
                              fontSize: '11.5px',
                              color: '#0f172a',
                            }}
                          >
                            {token}
                          </code>
                          <div style={{ marginTop: '3px' }}>
                            {getLeaveTypeBadge(clearance.leave_type)}
                          </div>
                        </div>
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
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* =================================================================== */}
      {/* MODAL / DRAWER: Gate Clearance Digital Credentials                  */}
      {/* =================================================================== */}
      {dossierOpen && selectedClearance && (
        <Modal
          isOpen={dossierOpen}
          onClose={() => setDossierOpen(false)}
          title="Campus Gate Clearance Pass"
          size="md"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Boarding-Pass Style Digital Ticket */}
            <div className="digital-pass-ticket">
              <div className="ticket-header-strip">
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    HMS Digital Gate Clearance Pass
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                    GP-{(selectedClearance.id || '').slice(0, 6).toUpperCase()}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span className="badge-enterprise badge-emerald">
                    <CheckCircle2 size={12} style={{ marginRight: '4px' }} />
                    CLEARED FOR EXIT
                  </span>
                </div>
              </div>

              {/* Student Profile Info */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                <div
                  className="clearance-avatar-box"
                  style={{ width: '48px', height: '48px', fontSize: '1.1rem' }}
                >
                  {(studentMap.get(selectedClearance.student_id)?.first_name?.[0] || 'S') +
                    (studentMap.get(selectedClearance.student_id)?.last_name?.[0] || 'T')}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                    {studentMap.get(selectedClearance.student_id)?.first_name || 'Resident'}{' '}
                    {studentMap.get(selectedClearance.student_id)?.last_name || ''}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px', fontSize: '12px', color: '#64748b' }}>
                    <span>
                      Reg:{' '}
                      <code style={{ fontWeight: 700, color: '#0f172a' }}>
                        {studentMap.get(selectedClearance.student_id)?.registration_number ||
                          studentMap.get(selectedClearance.student_id)?.admission_number ||
                          'N/A'}
                      </code>
                    </span>
                    <span>•</span>
                    {getLeaveTypeBadge(selectedClearance.leave_type)}
                  </div>
                </div>
              </div>

              {/* Travel Details Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px',
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '12px',
                  fontSize: '12.5px',
                }}
              >
                <div>
                  <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 600 }}>DEPARTURE DATE</div>
                  <div style={{ fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                    {new Date(selectedClearance.from_date).toLocaleDateString(undefined, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </div>
                </div>

                <div>
                  <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 600 }}>EXPECTED RETURN</div>
                  <div style={{ fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                    {new Date(selectedClearance.to_date).toLocaleDateString(undefined, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </div>
                </div>

                <div>
                  <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 600 }}>DESTINATION</div>
                  <div style={{ fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>
                    {selectedClearance.destination || 'Home Address'}
                  </div>
                </div>

                <div>
                  <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 600 }}>EMERGENCY CONTACT</div>
                  <div style={{ fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>
                    {selectedClearance.contact_phone ||
                      studentMap.get(selectedClearance.student_id)?.phone ||
                      'Campus Extension'}
                  </div>
                </div>
              </div>

              {/* Reason Snippet */}
              <div style={{ marginTop: '14px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                  DECLARED REASON
                </div>
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    fontSize: '13px',
                    color: '#334155',
                  }}
                >
                  {selectedClearance.reason || 'Personal visit.'}
                </div>
              </div>

              {/* Simulated Barcode / QR Box */}
              <div className="ticket-barcode-box">
                <QrCode size={38} style={{ color: '#0f172a' }} />
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', letterSpacing: '0.1em' }}>
                  SCAN AT PERIMETER GATE BARRIER
                </span>
              </div>
            </div>

            {/* Checkpoint Instructions */}
            <div
              style={{
                padding: '12px 14px',
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                borderRadius: '8px',
                color: '#065f46',
                fontSize: '12.5px',
                lineHeight: 1.4,
              }}
            >
              <strong>Security Guard Protocol:</strong> Verify student photo ID and ensure registration number matches institutional record before allowing perimeter egress.
            </div>

            {/* Modal Actions */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: '16px',
                borderTop: '1px solid #f1f5f9',
              }}
            >
              <button
                type="button"
                className="btn-enterprise-secondary"
                onClick={() => window.print()}
                title="Print Gate Pass Voucher"
              >
                <Printer size={14} />
                <span>Print Voucher</span>
              </button>

              <button
                type="button"
                className="btn-enterprise-primary"
                onClick={() => setDossierOpen(false)}
              >
                Close Dossier
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
