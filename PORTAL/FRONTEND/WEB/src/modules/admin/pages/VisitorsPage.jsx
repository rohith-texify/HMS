import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../shared/auth/useAuth';
import adminService from '../services/adminService';
import { exportToCSV } from '../../../shared/utils/exportUtils';
import {
  Users,
  UserCheck,
  ShieldCheck,
  Clock,
  DoorOpen,
  DoorClosed,
  Info,
  Search,
  Filter,
  RefreshCw,
  Building2,
  MapPin,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Phone,
  FileText,
  LayoutGrid,
  List,
  Eye,
  Radio,
  FileCheck,
  Ban,
  Shield,
  Layers,
  Plus,
  X,
  FileSpreadsheet,
  LogOut,
  Printer,
  QrCode,
  Flame,
  UserPlus,
  ChevronRight,
  Sparkles,
  Check,
  AlertCircle
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

export default function AdminVisitorsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Active Main Tab
  const [activeTab, setActiveTab] = useState('LOGS'); // 'LOGS' | 'GATES' | 'GUARDS' | 'PROTOCOLS'

  // Display Mode: Cards vs Table for Visitors and Gates
  const [visitorDisplayMode, setVisitorDisplayMode] = useState(() => {
    return localStorage.getItem('hms_visitor_log_view_mode') || 'cards';
  });

  const [gateDisplayMode, setGateDisplayMode] = useState(() => {
    return localStorage.getItem('hms_visitors_view_mode') || 'cards';
  });

  const handleSetGateDisplayMode = (mode) => {
    setGateDisplayMode(mode);
    localStorage.setItem('hms_visitors_view_mode', mode);
  };

  const handleSetVisitorDisplayMode = (mode) => {
    setVisitorDisplayMode(mode);
    localStorage.setItem('hms_visitor_log_view_mode', mode);
  };

  // Master Data State
  const [gates, setGates] = useState([]);
  const [securityAssignments, setSecurityAssignments] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [hostels, setHostels] = useState([]);

  // Visitor Logs State (with localStorage caching)
  const [visitorLogs, setVisitorLogs] = useState(() => {
    try {
      const saved = localStorage.getItem('hms_visitor_logs');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((v) => !v.id?.startsWith('VP-2026-104'));
        }
      }
    } catch (e) {
      console.warn('Failed to parse visitor logs from cache:', e);
    }
    return [];
  });

  const persistVisitorLogs = (logs) => {
    setVisitorLogs(logs);
    try {
      localStorage.setItem('hms_visitor_logs', JSON.stringify(logs));
    } catch (e) {
      console.warn('Failed to persist visitor logs:', e);
    }
  };

  // UI & Loading States
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Search & Filters for Gates
  const [gateSearchTerm, setGateSearchTerm] = useState('');
  const [gateStatusFilter, setGateStatusFilter] = useState('ALL');
  const [gateTypeFilter, setGateTypeFilter] = useState('ALL');

  // Search & Filters for Visitor Logs
  const [visitorSearchTerm, setVisitorSearchTerm] = useState('');
  const [visitorStatusFilter, setVisitorStatusFilter] = useState('ALL');
  const [visitorTypeFilter, setVisitorTypeFilter] = useState('ALL');

  // Drawers & Modals
  const [selectedGate, setSelectedGate] = useState(null);
  const [gateDrawerOpen, setGateDrawerOpen] = useState(false);

  const [selectedVisitor, setSelectedVisitor] = useState(null);
  const [visitorPassDrawerOpen, setVisitorPassDrawerOpen] = useState(false);

  const [registerModalOpen, setRegisterModalOpen] = useState(false);

  // New Visitor Form State
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formType, setFormType] = useState('PARENT');
  const [formStudent, setFormStudent] = useState('');
  const [formRoom, setFormRoom] = useState('');
  const [formPurpose, setFormPurpose] = useState('');
  const [formIdType, setFormIdType] = useState('Aadhaar Card');
  const [formIdLast4, setFormIdLast4] = useState('');
  const [formGate, setFormGate] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Quick lookup dictionary for staff
  const staffMap = useMemo(() => {
    const map = new Map();
    staffList.forEach((s) => map.set(s.id, s));
    return map;
  }, [staffList]);

  // Quick lookup dictionary for hostels
  const hostelMap = useMemo(() => {
    const map = new Map();
    hostels.forEach((h) => map.set(h.id, h));
    return map;
  }, [hostels]);

  // Map of gateId -> array of active security guards
  const gateGuardsMap = useMemo(() => {
    const map = new Map();
    securityAssignments.forEach((assignment) => {
      if (assignment.gate_id) {
        const existing = map.get(assignment.gate_id) || [];
        existing.push(assignment);
        map.set(assignment.gate_id, existing);
      }
    });
    return map;
  }, [securityAssignments]);

  // =========================================================================
  // Master Data Fetching
  // =========================================================================
  const loadVisitorContext = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    else setLoading(true);
    setErrorMessage(null);

    try {
      const [gatesRes, secRes, staffRes, hostelsRes] = await Promise.allSettled([
        adminService.getGates(),
        adminService.getSecurityAssignments(),
        adminService.getStaff(),
        adminService.getHostels(),
      ]);

      if (gatesRes.status === 'fulfilled') {
        const raw = gatesRes.value;
        const gateItems = Array.isArray(raw) ? raw : raw?.gates || [];
        setGates(gateItems);
        if (gateItems.length > 0 && !formGate) {
          setFormGate(gateItems[0].name);
        }
      } else {
        console.warn('Failed to load campus gates:', gatesRes.reason);
      }

      if (secRes.status === 'fulfilled') {
        const rawSec = secRes.value;
        setSecurityAssignments(Array.isArray(rawSec) ? rawSec : rawSec?.assignments || []);
      }

      if (staffRes.status === 'fulfilled') {
        const rawStaff = staffRes.value;
        setStaffList(Array.isArray(rawStaff) ? rawStaff : rawStaff?.staff || []);
      }

      if (hostelsRes.status === 'fulfilled') {
        const rawH = hostelsRes.value;
        setHostels(Array.isArray(rawH) ? rawH : rawH?.hostels || []);
      }
    } catch (err) {
      console.error('Failed to load visitor checkpoint context:', err);
      setErrorMessage('Failed to load campus gate checkpoints.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [formGate]);

  useEffect(() => {
    loadVisitorContext();
  }, [loadVisitorContext]);

  // =========================================================================
  // Filtering & Search: Gates
  // =========================================================================
  const filteredGates = useMemo(() => {
    return gates.filter((gate) => {
      const name = gate.name || '';
      const code = gate.code || '';
      const loc = gate.location_description || '';
      const term = gateSearchTerm.toLowerCase().trim();

      const matchesSearch =
        !term ||
        name.toLowerCase().includes(term) ||
        code.toLowerCase().includes(term) ||
        loc.toLowerCase().includes(term);

      const matchesStatus =
        gateStatusFilter === 'ALL' ||
        String(gate.status || '').toUpperCase() === gateStatusFilter.toUpperCase();

      const matchesType =
        gateTypeFilter === 'ALL' ||
        String(gate.gate_type || '').toUpperCase() === gateTypeFilter.toUpperCase();

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [gates, gateSearchTerm, gateStatusFilter, gateTypeFilter]);

  // =========================================================================
  // Filtering & Search: Visitor Logs
  // =========================================================================
  const filteredVisitors = useMemo(() => {
    return visitorLogs.filter((v) => {
      const term = visitorSearchTerm.toLowerCase().trim();
      if (term) {
        const matchName = (v.visitor_name || '').toLowerCase().includes(term);
        const matchPhone = (v.phone || '').toLowerCase().includes(term);
        const matchStudent = (v.student_name || '').toLowerCase().includes(term);
        const matchRoom = (v.student_room || '').toLowerCase().includes(term);
        const matchId = (v.id || '').toLowerCase().includes(term);
        if (!matchName && !matchPhone && !matchStudent && !matchRoom && !matchId) return false;
      }

      if (visitorStatusFilter !== 'ALL') {
        if (v.status !== visitorStatusFilter) return false;
      }

      if (visitorTypeFilter !== 'ALL') {
        if (v.visitor_type !== visitorTypeFilter) return false;
      }

      return true;
    });
  }, [visitorLogs, visitorSearchTerm, visitorStatusFilter, visitorTypeFilter]);

  // =========================================================================
  // Metrics Computation
  // =========================================================================
  const metrics = useMemo(() => {
    const totalVisitors = visitorLogs.length;
    const activeVisitors = visitorLogs.filter((v) => v.status === 'ACTIVE').length;
    const checkedOutVisitors = visitorLogs.filter((v) => v.status === 'CHECKED_OUT').length;
    const operationalGates = gates.filter((g) => g.status === 'ACTIVE').length;
    const activeGuards = securityAssignments.filter((s) => s.status === 'ACTIVE').length;

    return {
      totalVisitors,
      activeVisitors,
      checkedOutVisitors,
      operationalGates,
      totalGates: gates.length,
      activeGuards,
    };
  }, [visitorLogs, gates, securityAssignments]);

  // =========================================================================
  // Visitor Actions: Check-Out, Register, Export
  // =========================================================================
  const handleCheckOut = (visitorId) => {
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const updated = visitorLogs.map((v) => {
      if (v.id === visitorId) {
        return {
          ...v,
          status: 'CHECKED_OUT',
          check_out_time: nowTime,
          notes: v.notes ? `${v.notes} • Exited at ${nowTime}` : `Exited at ${nowTime}`,
        };
      }
      return v;
    });
    persistVisitorLogs(updated);
    if (selectedVisitor && selectedVisitor.id === visitorId) {
      setSelectedVisitor({
        ...selectedVisitor,
        status: 'CHECKED_OUT',
        check_out_time: nowTime,
      });
    }
  };

  const handleRegisterSubmit = (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!formName.trim()) {
      setFormError('Please enter the full name of the visitor.');
      return;
    }
    if (!formPhone.trim()) {
      setFormError('Please enter a valid contact phone number.');
      return;
    }
    if (!formStudent.trim()) {
      setFormError('Please enter the name of the resident student / staff.');
      return;
    }
    if (!formPurpose.trim()) {
      setFormError('Please state the purpose of the visit.');
      return;
    }

    setFormSubmitting(true);

    try {
      const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const passNumber = `VP-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      const selectedGateName = formGate || (gates[0]?.name) || 'Main Entrance Security Desk';

      const newEntry = {
        id: passNumber,
        visitor_name: formName.trim(),
        phone: formPhone.trim(),
        visitor_type: formType,
        student_name: formStudent.trim(),
        student_room: formRoom.trim() || 'General Reception Parlor',
        purpose: formPurpose.trim(),
        id_type: formIdType,
        id_number_last4: formIdLast4.trim() || 'Verified',
        gate_name: selectedGateName,
        check_in_time: nowTime,
        check_out_time: null,
        status: 'ACTIVE',
        notes: formNotes.trim() ? formNotes.trim() : 'ID verified at reception checkpoint. Parlor access pass issued.',
      };

      const nextLogs = [newEntry, ...visitorLogs];
      persistVisitorLogs(nextLogs);

      setFormSuccess(`Pass ${passNumber} issued successfully!`);
      setTimeout(() => {
        setRegisterModalOpen(false);
        setFormName('');
        setFormPhone('');
        setFormStudent('');
        setFormRoom('');
        setFormPurpose('');
        setFormIdLast4('');
        setFormNotes('');
        setFormSuccess('');
        setFormSubmitting(false);
      }, 1000);
    } catch (err) {
      console.error('Failed to register visitor:', err);
      setFormError('Failed to register visitor entry. Please try again.');
      setFormSubmitting(false);
    }
  };

  const handleExportManifest = () => {
    const columns = [
      { key: 'id', title: 'Pass / Badge #' },
      { key: 'visitor_name', title: 'Visitor Name' },
      { key: 'phone', title: 'Contact Phone' },
      { key: 'visitor_type', title: 'Visitor Type' },
      { key: 'student_name', title: 'Host Student / Staff' },
      { key: 'student_room', title: 'Host Room / Location' },
      { key: 'purpose', title: 'Purpose of Visit' },
      { key: 'id_type', title: 'ID Verification Type' },
      { key: 'gate_name', title: 'Reception Gate' },
      { key: 'check_in_time', title: 'Check-In Time' },
      { key: 'check_out_time', title: 'Check-Out Time' },
      { key: 'status', title: 'Current Status' },
      { key: 'notes', title: 'Security Notes' },
    ];

    exportToCSV('Campus_Visitor_Access_Manifest', columns, filteredVisitors);
  };

  // Open Gate Dossier Drawer
  const handleOpenGateDossier = (gate) => {
    setSelectedGate(gate);
    setGateDrawerOpen(true);
  };

  // Open Visitor Pass Drawer
  const handleOpenVisitorPass = (visitor) => {
    setSelectedVisitor(visitor);
    setVisitorPassDrawerOpen(true);
  };

  // Gate Type Badge Helper
  const getGateTypeBadge = (type) => {
    switch (type) {
      case 'MAIN_ENTRANCE':
        return <span className="badge-enterprise badge-blue">MAIN RECEPTION</span>;
      case 'PEDESTRIAN':
        return <span className="badge-enterprise badge-emerald">PEDESTRIAN</span>;
      case 'VEHICULAR':
        return <span className="badge-enterprise badge-purple">VEHICULAR</span>;
      case 'EMERGENCY_EXIT':
        return <span className="badge-enterprise badge-rose">EMERGENCY</span>;
      default:
        return <span className="badge-enterprise badge-slate">{type || 'CHECKPOINT'}</span>;
    }
  };

  // Visitor Type Badge Helper
  const getVisitorTypeBadge = (type) => {
    switch (type) {
      case 'PARENT':
        return <span className="badge-enterprise badge-blue">PARENT</span>;
      case 'GUARDIAN':
        return <span className="badge-enterprise badge-purple">GUARDIAN</span>;
      case 'DELIVERY':
        return <span className="badge-enterprise badge-orange">COURIER / DELIVERY</span>;
      case 'MAINTENANCE':
        return <span className="badge-enterprise badge-emerald">MAINTENANCE VENDOR</span>;
      case 'OFFICIAL':
        return <span className="badge-enterprise badge-rose">OFFICIAL INSPECTOR</span>;
      default:
        return <span className="badge-enterprise badge-slate">GUEST VISITOR</span>;
    }
  };

  return (
    <div className="fade-in-up">
      {/* Enterprise Hero Header */}
      <div className="enterprise-hero-header">
        <div className="hero-header-titles">
          <div className="hero-category-pill">
            <Users size={13} className="hero-category-icon" />
            <span>Support &amp; Safety</span>
          </div>
          <h1 className="hero-main-title">Visitor Access & Checkpoint Registry</h1>
          <p className="hero-subtitle">
            Visitor identity verification protocols, designated reception check-in points, active guard duty deployments, and perimeter access compliance.
          </p>
        </div>

        <div className="hero-action-buttons">
          <button
            type="button"
            className="btn-enterprise-secondary"
            onClick={handleExportManifest}
            title="Export Visitor Manifest to RFC 4180 CSV"
          >
            <FileSpreadsheet size={15} />
            <span>Export Manifest</span>
          </button>

          <button
            type="button"
            className="btn-enterprise-secondary"
            onClick={() => loadVisitorContext(true)}
            disabled={isRefreshing || loading}
            title="Refresh Checkpoint & Guard Data"
          >
            <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Sync Telemetry</span>
          </button>

          <button
            type="button"
            className="btn-enterprise-primary"
            onClick={() => {
              setFormError('');
              setFormSuccess('');
              setRegisterModalOpen(true);
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <UserPlus size={16} />
            <span>Issue Visitor Pass</span>
          </button>
        </div>
      </div>

      {/* Modern Telemetry Architecture Notice */}
      <div className="movement-telemetry-banner">
        <div className="telemetry-banner-icon">
          <Radio size={20} />
        </div>
        <div className="telemetry-banner-content">
          <div className="telemetry-banner-title">
            <span className="telemetry-banner-pulse" />
            <span>Institutional Visitor Protocol & Perimeter Gate Telemetry</span>
          </div>
          <p className="telemetry-banner-text">
            Visitor registry is synchronized across all perimeter checkpoints. Active reception gates and stationed security guard deployments operate under verified institutional protocols below. Valid government photo ID surrender is required for entry.
          </p>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div style={{ marginBottom: '20px' }}>
          <ErrorState message={errorMessage} onRetry={() => loadVisitorContext(true)} />
        </div>
      )}

      {/* KPI Stats Bar */}
      <div className="kpi-cards-grid" style={{ marginBottom: '24px' }}>
        {/* Active Visitors On Campus */}
        <div className="stat-kpi-card" style={{ borderLeft: '4px solid #10b981' }}>
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Active On Campus</span>
            <div className="stat-kpi-icon-wrap emerald">
              <Users size={17} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
            <span className="visitor-live-pulse" />
            <div className="stat-kpi-value text-emerald-600">{metrics.activeVisitors}</div>
          </div>
          <div className="stat-kpi-footnote">
            <span>Currently inside perimeter</span>
          </div>
        </div>

        {/* Today's Logged Entries */}
        <div className="stat-kpi-card" style={{ borderLeft: '4px solid #3b82f6' }}>
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Total Passes Issued</span>
            <div className="stat-kpi-icon-wrap blue">
              <FileCheck size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-blue-600">{metrics.totalVisitors}</div>
          <div className="stat-kpi-footnote">
            <span>{metrics.checkedOutVisitors} departed & checked out</span>
          </div>
        </div>

        {/* Visitor Checkpoints */}
        <div className="stat-kpi-card" style={{ borderLeft: '4px solid #8b5cf6' }}>
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Operational Gates</span>
            <div className="stat-kpi-icon-wrap purple">
              <DoorOpen size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-purple-600">
            {metrics.operationalGates} / {metrics.totalGates}
          </div>
          <div className="stat-kpi-footnote">
            <span>Perimeter reception checkpoints</span>
          </div>
        </div>

        {/* On-Duty Guard Postings */}
        <div className="stat-kpi-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">On-Duty Guard Postings</span>
            <div className="stat-kpi-icon-wrap orange">
              <ShieldCheck size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-orange-600">{metrics.activeGuards}</div>
          <div className="stat-kpi-footnote">
            <span className="status-dot green" />
            <span>Active inspection personnel</span>
          </div>
        </div>
      </div>

      {/* Main Tabbed Navigation Strip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '2px solid #e2e8f0', marginBottom: '20px', paddingBottom: '2px' }}>
        <button
          type="button"
          onClick={() => setActiveTab('LOGS')}
          style={{
            border: 'none',
            background: 'transparent',
            padding: '10px 18px',
            fontSize: '0.88rem',
            fontWeight: 700,
            cursor: 'pointer',
            borderBottom: activeTab === 'LOGS' ? '3px solid #2563eb' : '3px solid transparent',
            color: activeTab === 'LOGS' ? '#2563eb' : '#64748b',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
          }}
        >
          <Users size={16} />
          <span>Visitor Registry & Logbook</span>
          <span style={{ fontSize: '0.72rem', background: activeTab === 'LOGS' ? '#eff6ff' : '#f1f5f9', color: activeTab === 'LOGS' ? '#2563eb' : '#64748b', padding: '1px 7px', borderRadius: '10px' }}>
            {visitorLogs.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('GATES')}
          style={{
            border: 'none',
            background: 'transparent',
            padding: '10px 18px',
            fontSize: '0.88rem',
            fontWeight: 700,
            cursor: 'pointer',
            borderBottom: activeTab === 'GATES' ? '3px solid #2563eb' : '3px solid transparent',
            color: activeTab === 'GATES' ? '#2563eb' : '#64748b',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
          }}
        >
          <DoorClosed size={16} />
          <span>Reception Checkpoints & Gates</span>
          <span style={{ fontSize: '0.72rem', background: activeTab === 'GATES' ? '#eff6ff' : '#f1f5f9', color: activeTab === 'GATES' ? '#2563eb' : '#64748b', padding: '1px 7px', borderRadius: '10px' }}>
            {gates.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('GUARDS')}
          style={{
            border: 'none',
            background: 'transparent',
            padding: '10px 18px',
            fontSize: '0.88rem',
            fontWeight: 700,
            cursor: 'pointer',
            borderBottom: activeTab === 'GUARDS' ? '3px solid #2563eb' : '3px solid transparent',
            color: activeTab === 'GUARDS' ? '#2563eb' : '#64748b',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
          }}
        >
          <ShieldCheck size={16} />
          <span>Security Guard Deployments</span>
          <span style={{ fontSize: '0.72rem', background: activeTab === 'GUARDS' ? '#eff6ff' : '#f1f5f9', color: activeTab === 'GUARDS' ? '#2563eb' : '#64748b', padding: '1px 7px', borderRadius: '10px' }}>
            {securityAssignments.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('PROTOCOLS')}
          style={{
            border: 'none',
            background: 'transparent',
            padding: '10px 18px',
            fontSize: '0.88rem',
            fontWeight: 700,
            cursor: 'pointer',
            borderBottom: activeTab === 'PROTOCOLS' ? '3px solid #2563eb' : '3px solid transparent',
            color: activeTab === 'PROTOCOLS' ? '#2563eb' : '#64748b',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
          }}
        >
          <FileCheck size={16} />
          <span>Visiting Codes & Rules</span>
        </button>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: VISITOR REGISTRY & LOGBOOK                                     */}
      {/* ===================================================================== */}
      {activeTab === 'LOGS' && (
        <div className="enterprise-card" style={{ marginBottom: '24px' }}>
          <div className="card-topbar">
            <div className="card-title-group">
              <div className="card-title-icon-wrap">
                <Users size={16} />
              </div>
              <h2 className="card-title-text">Live Campus Visitor Logbook</h2>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span className="badge-enterprise badge-emerald">
                {metrics.activeVisitors} Active on Premises
              </span>

              {/* View Mode Switcher */}
              <div className="view-toggle-group">
                <button
                  type="button"
                  className={`view-toggle-btn ${visitorDisplayMode === 'cards' ? 'active' : ''}`}
                  onClick={() => handleSetVisitorDisplayMode('cards')}
                  title="Card Grid View"
                >
                  <LayoutGrid size={15} />
                  <span>Cards</span>
                </button>
                <button
                  type="button"
                  className={`view-toggle-btn ${visitorDisplayMode === 'table' ? 'active' : ''}`}
                  onClick={() => handleSetVisitorDisplayMode('table')}
                  title="Table View"
                >
                  <List size={15} />
                  <span>Table</span>
                </button>
              </div>
            </div>
          </div>

          {/* Filter Strip for Visitor Logs */}
          <div className="enterprise-filter-bar" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div className="filter-search-field" style={{ flex: '1 1 300px', maxWidth: '460px' }}>
                <Search size={14} className="filter-search-icon" />
                <input
                  type="text"
                  className="filter-search-input"
                  placeholder="Search by visitor name, phone, host student, room, pass #..."
                  value={visitorSearchTerm}
                  onChange={(e) => setVisitorSearchTerm(e.target.value)}
                />
                {visitorSearchTerm && (
                  <button
                    type="button"
                    onClick={() => setVisitorSearchTerm('')}
                    style={{ border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer', paddingRight: '8px' }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Status Chips */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  className={`visitor-filter-chip ${visitorStatusFilter === 'ALL' ? 'active' : ''}`}
                  onClick={() => setVisitorStatusFilter('ALL')}
                >
                  All Statuses <span className="visitor-chip-count">{visitorLogs.length}</span>
                </button>
                <button
                  type="button"
                  className={`visitor-filter-chip chip-emerald ${visitorStatusFilter === 'ACTIVE' ? 'active' : ''}`}
                  onClick={() => setVisitorStatusFilter('ACTIVE')}
                >
                  Active on Campus <span className="visitor-chip-count">{metrics.activeVisitors}</span>
                </button>
                <button
                  type="button"
                  className={`visitor-filter-chip ${visitorStatusFilter === 'CHECKED_OUT' ? 'active' : ''}`}
                  onClick={() => setVisitorStatusFilter('CHECKED_OUT')}
                >
                  Checked Out <span className="visitor-chip-count">{metrics.checkedOutVisitors}</span>
                </button>
              </div>
            </div>

            {/* Visitor Type Chips */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginRight: '4px' }}>
                Type:
              </span>
              {[
                { id: 'ALL', label: 'All Types' },
                { id: 'PARENT', label: 'Parents' },
                { id: 'GUARDIAN', label: 'Guardians' },
                { id: 'DELIVERY', label: 'Logistics / Courier' },
                { id: 'MAINTENANCE', label: 'Maintenance Vendors' },
                { id: 'OFFICIAL', label: 'Officials & Inspectors' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`visitor-filter-chip ${visitorTypeFilter === t.id ? 'active' : ''}`}
                  onClick={() => setVisitorTypeFilter(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Visitor Logs Content: Cards or Table */}
          {filteredVisitors.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <EmptyState
                icon={Users}
                title="No visitor logs match your search"
                description="Try clearing your search terms or filters to view all entries."
              />
            </div>
          ) : visitorDisplayMode === 'cards' ? (
            /* Visitor Cards Grid */
            <div style={{ padding: '18px 20px' }}>
              <div className="visitor-grid-cards">
                {filteredVisitors.map((v) => {
                  const isActive = v.status === 'ACTIVE';

                  return (
                    <div
                      key={v.id}
                      className="visitor-gate-card"
                      style={{ borderLeftColor: isActive ? '#10b981' : '#94a3b8', cursor: 'pointer' }}
                      onClick={() => handleOpenVisitorPass(v)}
                    >
                      {/* Top Row: Visitor Details + Badge */}
                      <div className="visitor-gate-top">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                          <div
                            className="visitor-avatar-box"
                            style={{
                              background: isActive
                                ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                                : 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)',
                            }}
                          >
                            <Users size={20} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <h3
                              style={{
                                fontSize: '0.96rem',
                                fontWeight: 700,
                                color: '#0f172a',
                                margin: 0,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                              title={v.visitor_name}
                            >
                              {v.visitor_name}
                            </h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
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
                                {v.id}
                              </code>
                              <span>•</span>
                              {getVisitorTypeBadge(v.visitor_type)}
                            </div>
                          </div>
                        </div>

                        <div>
                          {isActive ? (
                            <span className="badge-enterprise badge-emerald" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <span className="visitor-live-pulse" /> ON CAMPUS
                            </span>
                          ) : (
                            <span className="badge-enterprise badge-slate">CHECKED OUT</span>
                          )}
                        </div>
                      </div>

                      {/* Card Body Info Stack */}
                      <div className="visitor-gate-body">
                        <div className="visitor-info-stack">
                          <div className="visitor-info-row">
                            <Phone size={13} style={{ color: '#64748b', flexShrink: 0 }} />
                            <span style={{ fontWeight: 600, color: '#334155' }}>Phone:</span>
                            <span style={{ color: '#475569' }}>{v.phone}</span>
                          </div>

                          <div className="visitor-info-row">
                            <UserCheck size={13} style={{ color: '#64748b', flexShrink: 0 }} />
                            <span style={{ fontWeight: 600, color: '#334155' }}>Host Resident:</span>
                            <span style={{ color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {v.student_name} ({v.student_room})
                            </span>
                          </div>

                          <div className="visitor-info-row">
                            <DoorOpen size={13} style={{ color: '#64748b', flexShrink: 0 }} />
                            <span style={{ fontWeight: 600, color: '#334155' }}>Entry Point:</span>
                            <span style={{ color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {v.gate_name}
                            </span>
                          </div>

                          <div className="visitor-info-row">
                            <Clock size={13} style={{ color: '#64748b', flexShrink: 0 }} />
                            <span style={{ fontWeight: 600, color: '#334155' }}>Check-In:</span>
                            <span style={{ color: '#475569' }}>{v.check_in_time}</span>
                            {v.check_out_time && (
                              <span style={{ color: '#64748b' }}>• Out: {v.check_out_time}</span>
                            )}
                          </div>
                        </div>

                        <div style={{ fontSize: '0.78rem', color: '#475569', fontStyle: 'italic', background: '#f8fafc', padding: '6px 10px', borderRadius: '6px', border: '1px dashed #e2e8f0' }}>
                          "{v.purpose}"
                        </div>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="visitor-gate-footer">
                        <button
                          type="button"
                          className="btn-enterprise-secondary"
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenVisitorPass(v);
                          }}
                        >
                          <QrCode size={13} />
                          <span>Digital Pass</span>
                        </button>

                        {isActive && (
                          <button
                            type="button"
                            className="btn-enterprise-secondary"
                            style={{ padding: '6px 12px', fontSize: '12px', borderColor: '#cbd5e1', color: '#b91c1c' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCheckOut(v.id);
                            }}
                          >
                            <LogOut size={13} />
                            <span>Check Out</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Visitor High-Density Table */
            <div className="enterprise-table-container">
              <table className="enterprise-table">
                <thead>
                  <tr>
                    <th>Pass ID</th>
                    <th>Visitor Name & Phone</th>
                    <th>Type</th>
                    <th>Host Resident / Room</th>
                    <th>Purpose & Location</th>
                    <th>Check-In / Out</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVisitors.map((v) => {
                    const isActive = v.status === 'ACTIVE';

                    return (
                      <tr key={v.id} className="enterprise-table-row">
                        <td>
                          <code
                            style={{
                              background: '#f1f5f9',
                              padding: '3px 7px',
                              borderRadius: '4px',
                              fontWeight: 700,
                              fontSize: '11.5px',
                              color: '#0f172a',
                            }}
                          >
                            {v.id}
                          </code>
                        </td>

                        <td>
                          <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '13.5px' }}>
                            {v.visitor_name}
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#64748b' }}>{v.phone}</div>
                        </td>

                        <td>{getVisitorTypeBadge(v.visitor_type)}</td>

                        <td>
                          <div style={{ fontWeight: 600, color: '#334155', fontSize: '13px' }}>
                            {v.student_name}
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#64748b' }}>{v.student_room}</div>
                        </td>

                        <td>
                          <div style={{ fontSize: '12.5px', color: '#334155', maxWidth: '240px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {v.purpose}
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>Gate: {v.gate_name}</div>
                        </td>

                        <td>
                          <div style={{ fontSize: '12px', color: '#0f172a', fontWeight: 600 }}>
                            In: {v.check_in_time}
                          </div>
                          {v.check_out_time ? (
                            <div style={{ fontSize: '11.5px', color: '#64748b' }}>Out: {v.check_out_time}</div>
                          ) : (
                            <div style={{ fontSize: '11px', color: '#059669', fontWeight: 600 }}>Present</div>
                          )}
                        </td>

                        <td>
                          {isActive ? (
                            <span className="badge-enterprise badge-emerald" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <span className="visitor-live-pulse" /> ACTIVE
                            </span>
                          ) : (
                            <span className="badge-enterprise badge-slate">CHECKED OUT</span>
                          )}
                        </td>

                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              type="button"
                              className="table-icon-btn"
                              title="View Digital Pass"
                              onClick={() => handleOpenVisitorPass(v)}
                            >
                              <Eye size={14} />
                            </button>
                            {isActive && (
                              <button
                                type="button"
                                className="table-icon-btn"
                                title="Check Out Visitor"
                                style={{ color: '#be123c' }}
                                onClick={() => handleCheckOut(v.id)}
                              >
                                <LogOut size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: RECEPTION CHECKPOINTS & GATES                                  */}
      {/* ===================================================================== */}
      {activeTab === 'GATES' && (
        <div className="enterprise-card" style={{ marginBottom: '24px' }}>
          <div className="card-topbar">
            <div className="card-title-group">
              <div className="card-title-icon-wrap">
                <DoorClosed size={16} />
              </div>
              <h2 className="card-title-text">Designated Visitor Reception Checkpoints</h2>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span className="badge-enterprise badge-emerald">
                {filteredGates.length} of {gates.length} Gates Active
              </span>

              {/* View Mode Switcher */}
              <div className="view-toggle-group">
                <button
                  type="button"
                  className={`view-toggle-btn ${gateDisplayMode === 'cards' ? 'active' : ''}`}
                  onClick={() => handleSetGateDisplayMode('cards')}
                  title="Card Grid View"
                >
                  <LayoutGrid size={15} />
                  <span>Cards</span>
                </button>
                <button
                  type="button"
                  className={`view-toggle-btn ${gateDisplayMode === 'table' ? 'active' : ''}`}
                  onClick={() => handleSetGateDisplayMode('table')}
                  title="Table View"
                >
                  <List size={15} />
                  <span>Table</span>
                </button>
              </div>
            </div>
          </div>

          {/* Filter Toolbar for Gates */}
          <div className="enterprise-filter-bar">
            <div className="filter-search-field">
              <Search size={14} className="filter-search-icon" />
              <input
                type="text"
                className="filter-search-input"
                placeholder="Search by checkpoint name, code, facility, location..."
                value={gateSearchTerm}
                onChange={(e) => setGateSearchTerm(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <select
                className="filter-select"
                value={gateStatusFilter}
                onChange={(e) => setGateStatusFilter(e.target.value)}
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>

              <select
                className="filter-select"
                value={gateTypeFilter}
                onChange={(e) => setGateTypeFilter(e.target.value)}
              >
                <option value="ALL">All Gate Types</option>
                <option value="MAIN_ENTRANCE">MAIN ENTRANCE</option>
                <option value="PEDESTRIAN">PEDESTRIAN</option>
                <option value="VEHICULAR">VEHICULAR</option>
                <option value="EMERGENCY_EXIT">EMERGENCY EXIT</option>
              </select>

              {(gateSearchTerm || gateStatusFilter !== 'ALL' || gateTypeFilter !== 'ALL') && (
                <button
                  type="button"
                  className="btn-enterprise-secondary"
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                  onClick={() => {
                    setGateSearchTerm('');
                    setGateStatusFilter('ALL');
                    setGateTypeFilter('ALL');
                  }}
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Loading State */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <LoadingState message="Loading visitor checkpoints..." />
            </div>
          ) : filteredGates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <EmptyState
                icon={DoorClosed}
                title="No visitor reception checkpoints found"
                description="Try adjusting your search criteria or register a perimeter gate checkpoint."
              />
            </div>
          ) : gateDisplayMode === 'cards' ? (
            /* Cards View Mode */
            <div style={{ padding: '18px 20px' }}>
              <div className="visitor-grid-cards">
                {filteredGates.map((gate) => {
                  const hostelName = gate.hostel_id
                    ? hostelMap.get(gate.hostel_id)?.name || 'Main Campus Perimeter'
                    : 'Institutional Perimeter';
                  const assignedGuards = gateGuardsMap.get(gate.id) || [];
                  const isOperational = gate.status === 'ACTIVE';

                  return (
                    <div
                      key={gate.id}
                      className={`visitor-gate-card ${isOperational ? '' : 'inactive-gate'}`}
                    >
                      {/* Top Row: Avatar Box + Names + Badges */}
                      <div className="visitor-gate-top">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                          <div className={`visitor-avatar-box ${isOperational ? '' : 'inactive'}`}>
                            {isOperational ? <DoorOpen size={20} /> : <DoorClosed size={20} />}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <h3
                              style={{
                                fontSize: '0.96rem',
                                fontWeight: 700,
                                color: '#0f172a',
                                margin: 0,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                              title={gate.name}
                            >
                              {gate.name}
                            </h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
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
                                {gate.code}
                              </code>
                              <span>•</span>
                              {getGateTypeBadge(gate.gate_type)}
                            </div>
                          </div>
                        </div>

                        <div>
                          {isOperational ? (
                            <span className="badge-enterprise badge-emerald">OPERATIONAL</span>
                          ) : (
                            <span className="badge-enterprise badge-slate">INACTIVE</span>
                          )}
                        </div>
                      </div>

                      {/* Card Body Info Stack */}
                      <div className="visitor-gate-body">
                        <div className="visitor-info-stack">
                          <div className="visitor-info-row" title={hostelName}>
                            <Building2 size={13} style={{ color: '#64748b', flexShrink: 0 }} />
                            <span style={{ fontWeight: 600, color: '#334155' }}>Facility:</span>
                            <span style={{ color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {hostelName}
                            </span>
                          </div>

                          <div
                            className="visitor-info-row"
                            title={gate.location_description || 'Main entrance security booth'}
                          >
                            <MapPin size={13} style={{ color: '#64748b', flexShrink: 0 }} />
                            <span style={{ fontWeight: 600, color: '#334155' }}>Location:</span>
                            <span style={{ color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {gate.location_description || 'Main entrance security booth'}
                            </span>
                          </div>
                        </div>

                        {/* Stationed Guard Pill */}
                        <div>
                          {assignedGuards.length > 0 ? (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 10px',
                                background: '#ecfdf5',
                                border: '1px solid #a7f3d0',
                                borderRadius: '6px',
                                fontSize: '11.5px',
                                color: '#065f46',
                                fontWeight: 600,
                              }}
                            >
                              <ShieldCheck size={14} style={{ color: '#059669', flexShrink: 0 }} />
                              <span>
                                {assignedGuards.length}{' '}
                                {assignedGuards.length === 1 ? 'Guard Posted' : 'Guards Posted'} (
                                {assignedGuards
                                  .map((a) => {
                                    const staff = staffMap.get(a.staff_id);
                                    return staff ? `${staff.first_name || ''} ${staff.last_name || ''}`.trim() : 'Officer';
                                  })
                                  .join(', ')}
                                )
                              </span>
                            </div>
                          ) : (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 10px',
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                borderRadius: '6px',
                                fontSize: '11.5px',
                                color: '#64748b',
                              }}
                            >
                              <Shield size={14} style={{ color: '#94a3b8', flexShrink: 0 }} />
                              <span>No Security Officers Assigned</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="visitor-gate-footer">
                        <button
                          type="button"
                          className="btn-enterprise-secondary"
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                          onClick={() => handleOpenGateDossier(gate)}
                        >
                          <Eye size={13} />
                          <span>Reception Dossier</span>
                        </button>

                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                          ID Surrender Required
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Table View Mode */
            <div className="enterprise-table-container">
              <table className="enterprise-table">
                <thead>
                  <tr>
                    <th>Gate Checkpoint</th>
                    <th>Identifier Code</th>
                    <th>Gate Type</th>
                    <th>Facility Perimeter</th>
                    <th>Location Details</th>
                    <th>Stationed Guards</th>
                    <th>Operational Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGates.map((g) => {
                    const assignedGuards = gateGuardsMap.get(g.id) || [];
                    const isOperational = g.status === 'ACTIVE';

                    return (
                      <tr key={g.id} className="enterprise-table-row">
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div
                              className={`visitor-avatar-box ${isOperational ? '' : 'inactive'}`}
                              style={{ width: '32px', height: '32px', borderRadius: '8px' }}
                            >
                              {isOperational ? <DoorOpen size={16} /> : <DoorClosed size={16} />}
                            </div>
                            <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '13.5px' }}>
                              {g.name}
                            </div>
                          </div>
                        </td>

                        <td>
                          <code
                            style={{
                              background: '#f1f5f9',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              fontWeight: 700,
                              fontSize: '12px',
                              color: '#0f172a',
                            }}
                          >
                            {g.code}
                          </code>
                        </td>

                        <td>{getGateTypeBadge(g.gate_type)}</td>

                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Building2 size={13} style={{ color: '#64748b' }} />
                            <span style={{ fontSize: '13px', color: '#334155' }}>
                              {g.hostel_id ? hostelMap.get(g.hostel_id)?.name || 'Hostel Boundary' : 'Main Campus Perimeter'}
                            </span>
                          </div>
                        </td>

                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <MapPin size={12} style={{ color: '#64748b' }} />
                            <span style={{ fontSize: '12.5px', color: '#475569' }}>
                              {g.location_description || 'Main entrance security booth'}
                            </span>
                          </div>
                        </td>

                        <td>
                          {assignedGuards.length > 0 ? (
                            <span className="badge-enterprise badge-emerald">
                              {assignedGuards.length} On Duty
                            </span>
                          ) : (
                            <span className="badge-enterprise badge-slate">Unassigned</span>
                          )}
                        </td>

                        <td>
                          {isOperational ? (
                            <span className="badge-enterprise badge-emerald">OPERATIONAL</span>
                          ) : (
                            <span className="badge-enterprise badge-slate">INACTIVE</span>
                          )}
                        </td>

                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="table-icon-btn"
                            title="View Reception Dossier"
                            onClick={() => handleOpenGateDossier(g)}
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
      )}

      {/* ===================================================================== */}
      {/* TAB 3: SECURITY GUARD DEPLOYMENTS                                     */}
      {/* ===================================================================== */}
      {activeTab === 'GUARDS' && (
        <div className="enterprise-card" style={{ marginBottom: '24px' }}>
          <div className="card-topbar">
            <div className="card-title-group">
              <div className="card-title-icon-wrap">
                <ShieldCheck size={16} />
              </div>
              <h2 className="card-title-text">Visitor Gate Security Officer Deployments</h2>
            </div>
            <span className="badge-enterprise badge-purple">
              {securityAssignments.length} Officers Deployed
            </span>
          </div>

          <div className="enterprise-table-container">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Security Officer</th>
                  <th>Assigned Reception Gate</th>
                  <th>Shift Schedule</th>
                  <th>Checkpoint Phone</th>
                  <th>Deployment State</th>
                </tr>
              </thead>
              <tbody>
                {securityAssignments.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                      No security guard gate postings assigned.
                    </td>
                  </tr>
                ) : (
                  securityAssignments.map((sec) => {
                    const staff = staffMap.get(sec.staff_id);
                    const staffName = staff
                      ? `${staff.first_name || ''} ${staff.last_name || ''}`.trim()
                      : 'Security Guard';
                    const initials = staff
                      ? `${staff.first_name?.[0] || 'S'}${staff.last_name?.[0] || 'G'}`.toUpperCase()
                      : 'SG';
                    const gate = gates.find((g) => g.id === sec.gate_id);

                    return (
                      <tr key={sec.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div className="officer-avatar-box">{initials}</div>
                            <div>
                              <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '13.5px' }}>
                                {staffName}
                              </div>
                              <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                                ID: {sec.staff_id ? sec.staff_id.slice(0, 8) : 'N/A'}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td>
                          <div style={{ fontWeight: 600, color: '#1e293b' }}>
                            {gate?.name || 'Main Gate Checkpoint'}
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            Code: {gate?.code || 'GATE-01'}
                          </div>
                        </td>

                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Clock size={13} style={{ color: '#6366f1' }} />
                            <span style={{ fontSize: '12.5px', fontWeight: 500, color: '#334155' }}>
                              {sec.shift || 'Day Reception (08:00 - 20:00)'}
                            </span>
                          </div>
                        </td>

                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Phone size={13} style={{ color: '#059669' }} />
                            <span style={{ fontSize: '12.5px', color: '#0f172a', fontWeight: 500 }}>
                              {staff?.phone || 'Campus Ext #204'}
                            </span>
                          </div>
                        </td>

                        <td>
                          <span className="badge-enterprise badge-emerald">ON DUTY</span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: VISITING CODES & RULES                                         */}
      {/* ===================================================================== */}
      {activeTab === 'PROTOCOLS' && (
        <div className="enterprise-card" style={{ marginBottom: '24px' }}>
          <div className="card-topbar">
            <div className="card-title-group">
              <div className="card-title-icon-wrap">
                <ShieldCheck size={16} />
              </div>
              <h2 className="card-title-text">Hostel Visitor Operating Protocols</h2>
            </div>
            <span className="badge-enterprise badge-blue">Institutional Security Code</span>
          </div>

          <div className="visitor-protocol-grid">
            <div className="visitor-protocol-card">
              <div className="visitor-protocol-icon" style={{ background: '#eff6ff', color: '#2563eb' }}>
                <FileCheck size={20} />
              </div>
              <h4 className="visitor-protocol-title">1. Government Photo ID</h4>
              <p className="visitor-protocol-desc">
                All non-institutional visitors (parents, guardians, relatives, contractors) must surrender valid government photo ID at the perimeter security booth prior to admission.
              </p>
            </div>

            <div className="visitor-protocol-card">
              <div className="visitor-protocol-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
                <Building2 size={20} />
              </div>
              <h4 className="visitor-protocol-title">2. Designated Visitor Lounges</h4>
              <p className="visitor-protocol-desc">
                Guests are permitted strictly within ground-floor visitor parlors and common reception areas. Unescorted residential corridor access is strictly prohibited.
              </p>
            </div>

            <div className="visitor-protocol-card">
              <div className="visitor-protocol-icon" style={{ background: '#fff7ed', color: '#ea580c' }}>
                <Clock size={20} />
              </div>
              <h4 className="visitor-protocol-title">3. Strict Day-Hours Curfew</h4>
              <p className="visitor-protocol-desc">
                All external visitors must clear out of hostel gates by 18:00 hrs. Overnight stays in student rooms are strictly forbidden under institutional code.
              </p>
            </div>

            <div className="visitor-protocol-card">
              <div className="visitor-protocol-icon" style={{ background: '#fef2f2', color: '#dc2626' }}>
                <Ban size={20} />
              </div>
              <h4 className="visitor-protocol-title">4. Prohibited Materials</h4>
              <p className="visitor-protocol-desc">
                Security inspection of personal baggage is conducted at all gate checkpoints. Unauthorized electrical appliances or hazardous items are strictly held at the security desk.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* DRAWER: Checkpoint Reception Dossier                                */}
      {/* =================================================================== */}
      {gateDrawerOpen && selectedGate && (
        <div className="visitor-drawer-overlay" onClick={() => setGateDrawerOpen(false)}>
          <div className="visitor-drawer-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '14px' }}>
              <div>
                <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Perimeter Security Dossier
                </span>
                <h3 style={{ margin: '2px 0 0 0', fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
                  {selectedGate.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setGateDrawerOpen(false)}
                style={{ border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Top Identity Strip */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '14px 16px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
              }}
            >
              <div
                className={`visitor-avatar-box ${selectedGate.status === 'ACTIVE' ? '' : 'inactive'}`}
                style={{ width: '48px', height: '48px' }}
              >
                {selectedGate.status === 'ACTIVE' ? <DoorOpen size={22} /> : <DoorClosed size={22} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '1rem' }}>
                    Code: {selectedGate.code}
                  </span>
                  {selectedGate.status === 'ACTIVE' ? (
                    <span className="badge-enterprise badge-emerald">OPERATIONAL</span>
                  ) : (
                    <span className="badge-enterprise badge-slate">INACTIVE</span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  {getGateTypeBadge(selectedGate.gate_type)}
                </div>
              </div>
            </div>

            {/* Reception Specs */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
                fontSize: '13px',
              }}
            >
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #f1f5f9',
                  borderRadius: '8px',
                  padding: '10px 12px',
                }}
              >
                <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 600 }}>
                  FACILITY PERIMETER
                </div>
                <div style={{ fontWeight: 600, color: '#0f172a', marginTop: '4px' }}>
                  {selectedGate.hostel_id
                    ? hostelMap.get(selectedGate.hostel_id)?.name || 'Hostel Boundary'
                    : 'Main Campus Perimeter'}
                </div>
              </div>

              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #f1f5f9',
                  borderRadius: '8px',
                  padding: '10px 12px',
                }}
              >
                <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 600 }}>
                  VISITING HOURS
                </div>
                <div style={{ fontWeight: 600, color: '#0f172a', marginTop: '4px' }}>
                  10:00 - 18:00 hrs
                </div>
              </div>
            </div>

            {/* Location Description */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #f1f5f9',
                borderRadius: '8px',
                padding: '10px 12px',
                fontSize: '13px',
              }}
            >
              <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 600 }}>
                PHYSICAL LOCATION
              </div>
              <div style={{ color: '#334155', marginTop: '4px' }}>
                {selectedGate.location_description || 'Main entrance security booth and reception desk.'}
              </div>
            </div>

            {/* Stationed Security Personnel */}
            <div>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#475569',
                  textTransform: 'uppercase',
                  marginBottom: '8px',
                }}
              >
                Stationed Security Personnel
              </div>
              {(() => {
                const assigned = gateGuardsMap.get(selectedGate.id) || [];
                if (assigned.length === 0) {
                  return (
                    <div
                      style={{
                        padding: '12px 14px',
                        background: '#f8fafc',
                        border: '1px dashed #cbd5e1',
                        borderRadius: '8px',
                        fontSize: '13px',
                        color: '#64748b',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <Shield size={16} />
                      <span>No security officers currently stationed at this reception gate.</span>
                    </div>
                  );
                }
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {assigned.map((a) => {
                      const staff = staffMap.get(a.staff_id);
                      const name = staff
                        ? `${staff.first_name || ''} ${staff.last_name || ''}`.trim()
                        : 'Security Officer';
                      return (
                        <div
                          key={a.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 12px',
                            background: '#f0fdf4',
                            border: '1px solid #bbf7d0',
                            borderRadius: '8px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <ShieldCheck size={16} style={{ color: '#059669' }} />
                            <div>
                              <div style={{ fontWeight: 600, color: '#065f46', fontSize: '13px' }}>
                                {name}
                              </div>
                              <div style={{ fontSize: '11px', color: '#047857' }}>
                                Shift: {a.shift || 'Day Reception'}
                              </div>
                            </div>
                          </div>
                          <div style={{ fontSize: '12px', color: '#065f46', fontWeight: 500 }}>
                            {staff?.phone || 'Campus Ext #204'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
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
              <strong>Reception Duty Protocol:</strong> Verify guest identity against resident invitation, issue paper/badge visitor pass, and direct guests to ground-floor visitor parlors only.
            </div>

            <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn-enterprise-primary"
                onClick={() => setGateDrawerOpen(false)}
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* DRAWER: Digital Visitor Pass Dossier                                */}
      {/* =================================================================== */}
      {visitorPassDrawerOpen && selectedVisitor && (
        <div className="visitor-drawer-overlay" onClick={() => setVisitorPassDrawerOpen(false)}>
          <div className="visitor-drawer-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '14px' }}>
              <div>
                <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Institutional Security Credential
                </span>
                <h3 style={{ margin: '2px 0 0 0', fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
                  Digital Visitor Gate Pass
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setVisitorPassDrawerOpen(false)}
                style={{ border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Digital Pass Card */}
            <div className="visitor-digital-pass">
              <div className="pass-header-strip">
                <div>
                  <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    HMS Security Command
                  </div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                    VISITOR ENTRY PERMIT
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <code style={{ fontSize: '1rem', fontWeight: 800, color: '#2563eb', background: '#eff6ff', padding: '4px 8px', borderRadius: '6px' }}>
                    {selectedVisitor.id}
                  </code>
                </div>
              </div>

              {/* Visitor Details Block */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                <div>
                  <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Visitor Name</span>
                  <div style={{ fontSize: '0.98rem', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                    {selectedVisitor.visitor_name}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{selectedVisitor.phone}</div>
                </div>

                <div>
                  <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Visitor Category</span>
                  <div style={{ marginTop: '2px' }}>{getVisitorTypeBadge(selectedVisitor.visitor_type)}</div>
                  <div style={{ fontSize: '0.76rem', color: '#475569', marginTop: '4px' }}>
                    ID: {selectedVisitor.id_type} (••{selectedVisitor.id_number_last4})
                  </div>
                </div>
              </div>

              {/* Resident Host Block */}
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Resident Host</span>
                    <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#1e293b' }}>
                      {selectedVisitor.student_name}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Host Location</span>
                    <div style={{ fontSize: '0.86rem', fontWeight: 600, color: '#2563eb' }}>
                      {selectedVisitor.student_room}
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: '8px', fontSize: '0.78rem', color: '#475569', borderTop: '1px dashed #e2e8f0', paddingTop: '6px' }}>
                  <strong>Purpose:</strong> {selectedVisitor.purpose}
                </div>
              </div>

              {/* Gate & Time Specs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', textAlign: 'center', background: '#f8fafc', padding: '10px', borderRadius: '8px' }}>
                <div>
                  <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Check-In</span>
                  <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#0f172a' }}>{selectedVisitor.check_in_time}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Curfew Exit</span>
                  <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#be123c' }}>18:00 hrs</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Entry Gate</span>
                  <div style={{ fontSize: '0.76rem', fontWeight: 600, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedVisitor.gate_name}
                  </div>
                </div>
              </div>

              {/* Barcode & Security Hologram Strip */}
              <div className="pass-barcode-box">
                <svg className="pass-barcode-svg" viewBox="0 0 200 40">
                  <rect x="0" y="0" width="4" height="40" fill="#0f172a" />
                  <rect x="8" y="0" width="2" height="40" fill="#0f172a" />
                  <rect x="14" y="0" width="6" height="40" fill="#0f172a" />
                  <rect x="24" y="0" width="2" height="40" fill="#0f172a" />
                  <rect x="30" y="0" width="8" height="40" fill="#0f172a" />
                  <rect x="42" y="0" width="3" height="40" fill="#0f172a" />
                  <rect x="48" y="0" width="5" height="40" fill="#0f172a" />
                  <rect x="58" y="0" width="2" height="40" fill="#0f172a" />
                  <rect x="64" y="0" width="7" height="40" fill="#0f172a" />
                  <rect x="75" y="0" width="4" height="40" fill="#0f172a" />
                  <rect x="83" y="0" width="2" height="40" fill="#0f172a" />
                  <rect x="88" y="0" width="6" height="40" fill="#0f172a" />
                  <rect x="98" y="0" width="3" height="40" fill="#0f172a" />
                  <rect x="105" y="0" width="7" height="40" fill="#0f172a" />
                  <rect x="116" y="0" width="2" height="40" fill="#0f172a" />
                  <rect x="122" y="0" width="5" height="40" fill="#0f172a" />
                  <rect x="131" y="0" width="3" height="40" fill="#0f172a" />
                  <rect x="138" y="0" width="8" height="40" fill="#0f172a" />
                  <rect x="150" y="0" width="2" height="40" fill="#0f172a" />
                  <rect x="156" y="0" width="6" height="40" fill="#0f172a" />
                  <rect x="166" y="0" width="4" height="40" fill="#0f172a" />
                  <rect x="174" y="0" width="2" height="40" fill="#0f172a" />
                  <rect x="180" y="0" width="5" height="40" fill="#0f172a" />
                  <rect x="190" y="0" width="8" height="40" fill="#0f172a" />
                </svg>
                <div style={{ fontSize: '0.72rem', color: '#64748b', letterSpacing: '2px', fontWeight: 700 }}>
                  *{selectedVisitor.id}*
                </div>
              </div>
            </div>

            {/* Notes & Security Stamp */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 14px', fontSize: '0.82rem', color: '#475569' }}>
              <strong>Checkpoint Note:</strong> {selectedVisitor.notes || 'Verified at perimeter reception gate.'}
            </div>

            {/* Drawer Actions */}
            <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
              <button
                type="button"
                className="btn-enterprise-secondary"
                onClick={() => window.print()}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Printer size={15} />
                <span>Print Pass Badge</span>
              </button>

              <div style={{ display: 'flex', gap: '8px' }}>
                {selectedVisitor.status === 'ACTIVE' && (
                  <button
                    type="button"
                    className="btn-enterprise-secondary"
                    style={{ borderColor: '#fca5a5', color: '#b91c1c' }}
                    onClick={() => handleCheckOut(selectedVisitor.id)}
                  >
                    <LogOut size={15} />
                    <span>Record Departure</span>
                  </button>
                )}

                <button
                  type="button"
                  className="btn-enterprise-primary"
                  onClick={() => setVisitorPassDrawerOpen(false)}
                >
                  Close Pass
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: Issue Visitor Pass & Register Entry                          */}
      {/* =================================================================== */}
      {registerModalOpen && (
        <div className="student-modal-overlay" onClick={() => !formSubmitting && setRegisterModalOpen(false)}>
          <div className="student-modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            <div className="student-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <UserPlus size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                    Issue Visitor Access Pass
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '2px 0 0 0' }}>
                    Verify visitor credentials and register entry at perimeter security booth
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => !formSubmitting && setRegisterModalOpen(false)}
                style={{ border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleRegisterSubmit}>
              <div className="student-modal-body">
                {formError && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px', color: '#b91c1c', fontSize: '0.84rem' }}>
                    <AlertCircle size={16} style={{ flexShrink: 0 }} />
                    <span>{formError}</span>
                  </div>
                )}

                {formSuccess && (
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px', color: '#15803d', fontSize: '0.84rem' }}>
                    <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
                    <span>{formSuccess}</span>
                  </div>
                )}

                {/* Visitor Name & Phone */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                      Visitor Full Name <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Ramesh Chandra"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                      Contact Phone <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. +91 98765 43210"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Visitor Type Selector */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Visitor Category <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                    {[
                      { id: 'PARENT', label: 'Parent / Family' },
                      { id: 'GUARDIAN', label: 'Local Guardian' },
                      { id: 'DELIVERY', label: 'Delivery / Courier' },
                      { id: 'MAINTENANCE', label: 'Maintenance Tech' },
                      { id: 'OFFICIAL', label: 'Official / Inspector' },
                      { id: 'GUEST', label: 'General Guest' },
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setFormType(t.id)}
                        style={{
                          padding: '8px 10px',
                          borderRadius: '8px',
                          border: formType === t.id ? '1.5px solid #2563eb' : '1.5px solid #e2e8f0',
                          background: formType === t.id ? '#eff6ff' : '#ffffff',
                          color: formType === t.id ? '#1d4ed8' : '#475569',
                          fontWeight: 600,
                          fontSize: '0.78rem',
                          cursor: 'pointer',
                        }}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Host Resident & Room */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                      Host Resident / Staff Name <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Enter student full name"
                      value={formStudent}
                      onChange={(e) => setFormStudent(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                      Host Room / Facility
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Block A - Room 302"
                      value={formRoom}
                      onChange={(e) => setFormRoom(e.target.value)}
                    />
                  </div>
                </div>

                {/* ID Verification Details */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                      Photo ID Document Type
                    </label>
                    <select
                      className="form-control"
                      value={formIdType}
                      onChange={(e) => setFormIdType(e.target.value)}
                    >
                      <option value="Aadhaar Card">Aadhaar Card</option>
                      <option value="Driving License">Driving License</option>
                      <option value="Voter ID Card">Voter ID Card</option>
                      <option value="Passport">Passport</option>
                      <option value="Company / Official ID">Company / Official ID</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                      ID Number (Last 4 Digits)
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. 8821"
                      maxLength={8}
                      value={formIdLast4}
                      onChange={(e) => setFormIdLast4(e.target.value)}
                    />
                  </div>
                </div>

                {/* Reception Gate */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Entry Reception Checkpoint Gate
                  </label>
                  <select
                    className="form-control"
                    value={formGate}
                    onChange={(e) => setFormGate(e.target.value)}
                  >
                    {gates.length > 0 ? (
                      gates.map((g) => (
                        <option key={g.id} value={g.name}>
                          {g.name} ({g.code})
                        </option>
                      ))
                    ) : (
                      <option value="Main North Gate Checkpoint">Main North Gate Checkpoint</option>
                    )}
                  </select>
                </div>

                {/* Purpose of Visit */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Purpose of Visit <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Weekend family visit, delivering medications, semester fees discussion..."
                    value={formPurpose}
                    onChange={(e) => setFormPurpose(e.target.value)}
                    required
                  />
                </div>

                {/* Security Notes */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Security Remarks / Baggage Inspection Notes
                  </label>
                  <textarea
                    className="form-control"
                    rows={2}
                    placeholder="Optional notes: e.g. Guest parlor access authorized. Baggage scanned."
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="student-modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setRegisterModalOpen(false)}
                  disabled={formSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={formSubmitting}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  {formSubmitting ? (
                    <>
                      <RefreshCw size={14} className="spin-icon" /> Generating Pass...
                    </>
                  ) : (
                    <>
                      <Check size={16} /> Issue Entry Pass
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
