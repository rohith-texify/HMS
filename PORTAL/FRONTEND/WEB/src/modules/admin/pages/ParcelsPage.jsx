import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../shared/auth/useAuth';
import adminService from '../services/adminService';
import { exportToCSV } from '../../../shared/utils/exportUtils';
import {
  Zap,
  Package,
  Mail,
  ShieldCheck,
  Clock,
  DoorOpen,
  DoorClosed,
  Info,
  Search,
  Filter,
  RefreshCw,
  Building2,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Calendar,
  LayoutGrid,
  List,
  Eye,
  Radio,
  Truck,
  CheckCheck,
  FileCheck,
  Phone,
  Shield,
  Box,
  Layers,
  Plus,
  X,
  FileSpreadsheet,
  LogOut,
  Printer,
  QrCode,
  Flame,
  UserCheck,
  BookOpen,
  ShoppingBag,
  Utensils,
  Check,
  AlertCircle,
  Lock,
  ArrowRight
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

export default function AdminParcelsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Active Main Tab
  const [activeTab, setActiveTab] = useState('LOGS'); // 'LOGS' | 'GATES' | 'GUARDS' | 'PROTOCOLS'

  // Display Mode: Cards vs Table
  const [parcelDisplayMode, setParcelDisplayMode] = useState(() => {
    return localStorage.getItem('hms_parcel_log_view_mode') || 'cards';
  });

  const [gateDisplayMode, setGateDisplayMode] = useState(() => {
    return localStorage.getItem('hms_parcels_view_mode') || 'cards';
  });

  const handleSetGateDisplayMode = (mode) => {
    setGateDisplayMode(mode);
    localStorage.setItem('hms_parcels_view_mode', mode);
  };

  const handleSetParcelDisplayMode = (mode) => {
    setParcelDisplayMode(mode);
    localStorage.setItem('hms_parcel_log_view_mode', mode);
  };

  // Master Data State
  const [gates, setGates] = useState([]);
  const [securityAssignments, setSecurityAssignments] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [hostels, setHostels] = useState([]);

  // Parcel Logs State (with localStorage persistence)
  const [parcelLogs, setParcelLogs] = useState(() => {
    try {
      const saved = localStorage.getItem('hms_student_parcel_logs');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((p) => !p.id?.startsWith('PKG-2026-88'));
        }
      }
    } catch (e) {
      console.warn('Failed to parse parcel logs from cache:', e);
    }
    return [];
  });

  const persistParcelLogs = (logs) => {
    setParcelLogs(logs);
    try {
      localStorage.setItem('hms_student_parcel_logs', JSON.stringify(logs));
    } catch (e) {
      console.warn('Failed to persist parcel logs:', e);
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

  // Search & Filters for Parcels
  const [parcelSearchTerm, setParcelSearchTerm] = useState('');
  const [parcelStatusFilter, setParcelStatusFilter] = useState('ALL');
  const [parcelCarrierFilter, setParcelCarrierFilter] = useState('ALL');

  // Drawers & Modals
  const [selectedGate, setSelectedGate] = useState(null);
  const [gateDrawerOpen, setGateDrawerOpen] = useState(false);

  const [selectedParcel, setSelectedParcel] = useState(null);
  const [parcelSlipDrawerOpen, setParcelSlipDrawerOpen] = useState(false);

  const [intakeModalOpen, setIntakeModalOpen] = useState(false);

  // Form State for Package Intake
  const [formStudent, setFormStudent] = useState('');
  const [formRoom, setFormRoom] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formCarrier, setFormCarrier] = useState('Amazon Logistics');
  const [formTracking, setFormTracking] = useState('');
  const [formCategory, setFormCategory] = useState('GENERAL');
  const [formLocker, setFormLocker] = useState('Locker Bay A-01');
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
  const loadParcelContext = useCallback(async (isManualRefresh = false) => {
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
      console.error('Failed to load parcel checkpoint context:', err);
      setErrorMessage('Failed to load campus gate checkpoints.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [formGate]);

  useEffect(() => {
    loadParcelContext();
  }, [loadParcelContext]);

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
  // Filtering & Search: Parcels
  // =========================================================================
  const filteredParcels = useMemo(() => {
    return parcelLogs.filter((p) => {
      const term = parcelSearchTerm.toLowerCase().trim();
      if (term) {
        const matchStudent = (p.student_name || '').toLowerCase().includes(term);
        const matchRoom = (p.student_room || '').toLowerCase().includes(term);
        const matchTracking = (p.tracking_number || '').toLowerCase().includes(term);
        const matchCarrier = (p.carrier || '').toLowerCase().includes(term);
        const matchId = (p.id || '').toLowerCase().includes(term);
        const matchLocker = (p.storage_locker || '').toLowerCase().includes(term);
        if (!matchStudent && !matchRoom && !matchTracking && !matchCarrier && !matchId && !matchLocker) return false;
      }

      if (parcelStatusFilter !== 'ALL') {
        if (p.status !== parcelStatusFilter) return false;
      }

      if (parcelCarrierFilter !== 'ALL') {
        if (!p.carrier.toLowerCase().includes(parcelCarrierFilter.toLowerCase())) return false;
      }

      return true;
    });
  }, [parcelLogs, parcelSearchTerm, parcelStatusFilter, parcelCarrierFilter]);

  // =========================================================================
  // Metrics Computation
  // =========================================================================
  const metrics = useMemo(() => {
    const totalParcels = parcelLogs.length;
    const awaitingPickup = parcelLogs.filter((p) => p.status === 'AWAITING_PICKUP').length;
    const collectedParcels = parcelLogs.filter((p) => p.status === 'COLLECTED').length;
    const operationalGates = gates.filter((g) => g.status === 'ACTIVE').length;
    const activeStaff = securityAssignments.filter((s) => s.status === 'ACTIVE').length;

    return {
      totalParcels,
      awaitingPickup,
      collectedParcels,
      operationalGates,
      totalGates: gates.length,
      activeStaff,
    };
  }, [parcelLogs, gates, securityAssignments]);

  // =========================================================================
  // Parcel Handover & Intake Actions
  // =========================================================================
  const handleMarkCollected = (parcelId) => {
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const updated = parcelLogs.map((p) => {
      if (p.id === parcelId) {
        return {
          ...p,
          status: 'COLLECTED',
          collected_time: nowTime,
          notes: p.notes ? `${p.notes} • Handed over to student at ${nowTime}` : `Handed over at ${nowTime}`,
        };
      }
      return p;
    });
    persistParcelLogs(updated);

    if (selectedParcel && selectedParcel.id === parcelId) {
      setSelectedParcel({
        ...selectedParcel,
        status: 'COLLECTED',
        collected_time: nowTime,
      });
    }
  };

  const handleIntakeSubmit = (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!formStudent.trim()) {
      setFormError('Please enter the resident student recipient name.');
      return;
    }
    if (!formRoom.trim()) {
      setFormError('Please enter the student hostel block and room number.');
      return;
    }

    setFormSubmitting(true);

    try {
      const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const pkgNumber = `PKG-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      const autoTracking = formTracking.trim() || `${formCarrier.slice(0, 4).toUpperCase()}-${Math.floor(100000000 + Math.random() * 900000000)}`;
      const selectedGateName = formGate || (gates[0]?.name) || 'Main North Gate Security Booth';

      const newEntry = {
        id: pkgNumber,
        tracking_number: autoTracking,
        carrier: formCarrier,
        student_name: formStudent.trim(),
        student_room: formRoom.trim(),
        phone: formPhone.trim() || '+91 98000 00000',
        category: formCategory,
        gate_name: selectedGateName,
        storage_locker: formLocker.trim() || 'Locker Bay A-01',
        received_time: nowTime,
        collected_time: null,
        status: 'AWAITING_PICKUP',
        notes: formNotes.trim() || 'Intake package verified at checkpoint. Outer packaging intact.',
      };

      const nextLogs = [newEntry, ...parcelLogs];
      persistParcelLogs(nextLogs);

      setFormSuccess(`Package ${pkgNumber} logged successfully! Stored in ${newEntry.storage_locker}`);
      setTimeout(() => {
        setIntakeModalOpen(false);
        setFormStudent('');
        setFormRoom('');
        setFormPhone('');
        setFormTracking('');
        setFormNotes('');
        setFormSuccess('');
        setFormSubmitting(false);
      }, 1000);
    } catch (err) {
      console.error('Failed to log parcel intake:', err);
      setFormError('Failed to record package intake. Please try again.');
      setFormSubmitting(false);
    }
  };

  const handleExportManifest = () => {
    const columns = [
      { key: 'id', title: 'Parcel ID' },
      { key: 'tracking_number', title: 'Tracking / AWB #' },
      { key: 'carrier', title: 'Courier / Carrier' },
      { key: 'student_name', title: 'Student Recipient' },
      { key: 'student_room', title: 'Hostel Room' },
      { key: 'phone', title: 'Contact Phone' },
      { key: 'category', title: 'Category' },
      { key: 'storage_locker', title: 'Storage Locker' },
      { key: 'gate_name', title: 'Intake Gate' },
      { key: 'received_time', title: 'Received Time' },
      { key: 'collected_time', title: 'Collected Time' },
      { key: 'status', title: 'Delivery Status' },
      { key: 'notes', title: 'Inspection Notes' },
    ];

    exportToCSV('Student_Parcels_Mailroom_Manifest', columns, filteredParcels);
  };

  // Open Gate Dossier Drawer
  const handleOpenGateDossier = (gate) => {
    setSelectedGate(gate);
    setGateDrawerOpen(true);
  };

  // Open Parcel Slip Drawer
  const handleOpenParcelSlip = (parcel) => {
    setSelectedParcel(parcel);
    setParcelSlipDrawerOpen(true);
  };

  // Helper for Category Metadata
  const getCategoryMeta = (cat) => {
    switch (cat) {
      case 'BOOKS_STATIONERY':
        return { label: 'Books & Stationery', icon: BookOpen, color: '#3b82f6', bg: '#eff6ff' };
      case 'ELECTRONICS':
        return { label: 'Electronics & Gadgets', icon: Zap, color: '#f59e0b', bg: '#fef3c7' };
      case 'MEDICINE':
        return { label: 'Medicines & Health', icon: Shield, color: '#f43f5e', bg: '#ffe4e6' };
      case 'DOCUMENTS':
        return { label: 'Official Documents', icon: FileCheck, color: '#8b5cf6', bg: '#ede9fe' };
      case 'CLOTHING':
        return { label: 'Clothing & Apparel', icon: ShoppingBag, color: '#10b981', bg: '#d1fae5' };
      case 'FOOD_PERISHABLE':
        return { label: 'Perishable Food', icon: Utensils, color: '#ea580c', bg: '#ffedd5' };
      default:
        return { label: 'General Parcel', icon: Package, color: '#64748b', bg: '#f1f5f9' };
    }
  };

  // Helper for Gate Type Badge
  const getGateTypeBadge = (type) => {
    switch (type) {
      case 'MAIN_ENTRANCE':
        return <span className="badge-enterprise badge-blue">MAIN RECEPTION</span>;
      case 'PEDESTRIAN':
        return <span className="badge-enterprise badge-emerald">PEDESTRIAN</span>;
      case 'VEHICULAR':
        return <span className="badge-enterprise badge-purple">VEHICULAR DROP</span>;
      case 'EMERGENCY_EXIT':
        return <span className="badge-enterprise badge-rose">EMERGENCY</span>;
      default:
        return <span className="badge-enterprise badge-slate">{type || 'CHECKPOINT'}</span>;
    }
  };

  return (
    <div className="fade-in-up">
      {/* Enterprise Hero Header */}
      <div className="enterprise-hero-header">
        <div className="hero-header-titles">
          <div className="hero-category-pill">
            <Package size={13} className="hero-category-icon" />
            <span>Support &amp; Safety</span>
          </div>
          <h1 className="hero-main-title">Student Parcels & Courier Reception</h1>
          <p className="hero-subtitle">
            Perimeter gate courier drop checkpoints, package intake custody, digital locker allocations, and student handover verification.
          </p>
        </div>

        <div className="hero-action-buttons">
          <button
            type="button"
            className="btn-enterprise-secondary"
            onClick={handleExportManifest}
            title="Export Parcel Manifest to RFC 4180 CSV"
          >
            <FileSpreadsheet size={15} />
            <span>Export Manifest</span>
          </button>

          <button
            type="button"
            className="btn-enterprise-secondary"
            onClick={() => loadParcelContext(true)}
            disabled={isRefreshing || loading}
            title="Refresh Drop Checkpoints & Mail Staff"
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
              setIntakeModalOpen(true);
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Package size={16} />
            <span>Log Package Intake</span>
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
            <span>Institutional Mailroom Logistics & Package Drop Intake Active</span>
          </div>
          <p className="telemetry-banner-text">
            Parcel registry is synchronized across all perimeter checkpoints and student residence blocks. External delivery agents must deposit packages at authorized gate security lockers. Resident ID verification is mandatory for collection.
          </p>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div style={{ marginBottom: '20px' }}>
          <ErrorState message={errorMessage} onRetry={() => loadParcelContext(true)} />
        </div>
      )}

      {/* KPI Stats Bar */}
      <div className="kpi-cards-grid" style={{ marginBottom: '24px' }}>
        {/* Awaiting Resident Pickup */}
        <div className="stat-kpi-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Awaiting Pickup</span>
            <div className="stat-kpi-icon-wrap orange">
              <Package size={17} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
            <span className="parcel-awaiting-pulse" />
            <div className="stat-kpi-value text-orange-600">{metrics.awaitingPickup}</div>
          </div>
          <div className="stat-kpi-footnote">
            <span>In secure mailroom lockers</span>
          </div>
        </div>

        {/* Handed Over & Collected */}
        <div className="stat-kpi-card" style={{ borderLeft: '4px solid #10b981' }}>
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Handed Over</span>
            <div className="stat-kpi-icon-wrap emerald">
              <CheckCircle2 size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-emerald-600">{metrics.collectedParcels}</div>
          <div className="stat-kpi-footnote">
            <span>Verified student collections</span>
          </div>
        </div>

        {/* Total Packages Processed */}
        <div className="stat-kpi-card" style={{ borderLeft: '4px solid #3b82f6' }}>
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Total Intakes</span>
            <div className="stat-kpi-icon-wrap blue">
              <Truck size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-blue-600">{metrics.totalParcels}</div>
          <div className="stat-kpi-footnote">
            <span>Processed across all drop gates</span>
          </div>
        </div>

        {/* Courier Drop Checkpoints */}
        <div className="stat-kpi-card" style={{ borderLeft: '4px solid #8b5cf6' }}>
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Authorized Drop Gates</span>
            <div className="stat-kpi-icon-wrap purple">
              <DoorClosed size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-purple-600">
            {metrics.operationalGates} / {metrics.totalGates}
          </div>
          <div className="stat-kpi-footnote">
            <span>{metrics.activeStaff} intake officers on duty</span>
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
          <Package size={16} />
          <span>Mailroom Intake & Package Registry</span>
          <span style={{ fontSize: '0.72rem', background: activeTab === 'LOGS' ? '#eff6ff' : '#f1f5f9', color: activeTab === 'LOGS' ? '#2563eb' : '#64748b', padding: '1px 7px', borderRadius: '10px' }}>
            {parcelLogs.length}
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
          <span>Courier Drop Gates</span>
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
          <span>Intake Security Personnel</span>
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
          <Mail size={16} />
          <span>Mailroom Protocols</span>
        </button>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: MAILROOM INTAKE & PACKAGE REGISTRY                             */}
      {/* ===================================================================== */}
      {activeTab === 'LOGS' && (
        <div className="enterprise-card" style={{ marginBottom: '24px' }}>
          <div className="card-topbar">
            <div className="card-title-group">
              <div className="card-title-icon-wrap">
                <Package size={16} />
              </div>
              <h2 className="card-title-text">Live Mailroom Package Registry</h2>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span className="badge-enterprise badge-amber">
                {metrics.awaitingPickup} Awaiting Resident Pickup
              </span>

              {/* View Mode Switcher */}
              <div className="view-toggle-group">
                <button
                  type="button"
                  className={`view-toggle-btn ${parcelDisplayMode === 'cards' ? 'active' : ''}`}
                  onClick={() => handleSetParcelDisplayMode('cards')}
                  title="Card Grid View"
                >
                  <LayoutGrid size={15} />
                  <span>Cards</span>
                </button>
                <button
                  type="button"
                  className={`view-toggle-btn ${parcelDisplayMode === 'table' ? 'active' : ''}`}
                  onClick={() => handleSetParcelDisplayMode('table')}
                  title="Table View"
                >
                  <List size={15} />
                  <span>Table</span>
                </button>
              </div>
            </div>
          </div>

          {/* Filter Toolbar for Parcels */}
          <div className="enterprise-filter-bar" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div className="filter-search-field" style={{ flex: '1 1 300px', maxWidth: '460px' }}>
                <Search size={14} className="filter-search-icon" />
                <input
                  type="text"
                  className="filter-search-input"
                  placeholder="Search by tracking #, student name, room, carrier, locker..."
                  value={parcelSearchTerm}
                  onChange={(e) => setParcelSearchTerm(e.target.value)}
                />
                {parcelSearchTerm && (
                  <button
                    type="button"
                    onClick={() => setParcelSearchTerm('')}
                    style={{ border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer', paddingRight: '8px' }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Status Filter Chips */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  className={`parcel-filter-chip ${parcelStatusFilter === 'ALL' ? 'active' : ''}`}
                  onClick={() => setParcelStatusFilter('ALL')}
                >
                  All Packages <span className="parcel-chip-count">{parcelLogs.length}</span>
                </button>
                <button
                  type="button"
                  className={`parcel-filter-chip chip-amber ${parcelStatusFilter === 'AWAITING_PICKUP' ? 'active' : ''}`}
                  onClick={() => setParcelStatusFilter('AWAITING_PICKUP')}
                >
                  Awaiting Pickup <span className="parcel-chip-count">{metrics.awaitingPickup}</span>
                </button>
                <button
                  type="button"
                  className={`parcel-filter-chip chip-emerald ${parcelStatusFilter === 'COLLECTED' ? 'active' : ''}`}
                  onClick={() => setParcelStatusFilter('COLLECTED')}
                >
                  Collected <span className="parcel-chip-count">{metrics.collectedParcels}</span>
                </button>
              </div>
            </div>

            {/* Carrier Filter Chips */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginRight: '4px' }}>
                Carrier:
              </span>
              {[
                { id: 'ALL', label: 'All Carriers' },
                { id: 'Amazon', label: 'Amazon' },
                { id: 'Flipkart', label: 'Flipkart' },
                { id: 'Blue Dart', label: 'Blue Dart' },
                { id: 'India Post', label: 'India Post' },
                { id: 'Delhivery', label: 'Delhivery' },
                { id: 'DHL', label: 'DHL' },
              ].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`parcel-filter-chip ${parcelCarrierFilter === c.id ? 'active' : ''}`}
                  onClick={() => setParcelCarrierFilter(c.id)}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Parcel Content: Cards vs Table */}
          {filteredParcels.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <EmptyState
                icon={Package}
                title="No parcels match your search"
                description="Try resetting your search query or carrier filters to view all packages."
              />
            </div>
          ) : parcelDisplayMode === 'cards' ? (
            /* Cards Grid View */
            <div style={{ padding: '18px 20px' }}>
              <div className="parcels-grid-cards">
                {filteredParcels.map((p) => {
                  const isAwaiting = p.status === 'AWAITING_PICKUP';
                  const catMeta = getCategoryMeta(p.category);
                  const CatIcon = catMeta.icon;

                  return (
                    <div
                      key={p.id}
                      className="parcel-gate-card"
                      style={{ borderLeftColor: isAwaiting ? '#f59e0b' : '#10b981', cursor: 'pointer' }}
                      onClick={() => handleOpenParcelSlip(p)}
                    >
                      {/* Top Row */}
                      <div className="parcel-gate-top">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                          <div
                            className="parcel-avatar-box"
                            style={{
                              background: isAwaiting
                                ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                                : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            }}
                          >
                            <Package size={20} />
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
                              title={p.tracking_number}
                            >
                              {p.carrier}
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
                                {p.id}
                              </code>
                              <span>•</span>
                              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                                {p.tracking_number}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div>
                          {isAwaiting ? (
                            <span className="badge-enterprise badge-amber" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <span className="parcel-awaiting-pulse" /> AWAITING PICKUP
                            </span>
                          ) : (
                            <span className="badge-enterprise badge-emerald">COLLECTED</span>
                          )}
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className="parcel-gate-body">
                        <div className="parcel-info-stack">
                          <div className="parcel-info-row">
                            <UserCheck size={13} style={{ color: '#64748b', flexShrink: 0 }} />
                            <span style={{ fontWeight: 600, color: '#334155' }}>Recipient:</span>
                            <span style={{ color: '#0f172a', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {p.student_name}
                            </span>
                          </div>

                          <div className="parcel-info-row">
                            <Building2 size={13} style={{ color: '#64748b', flexShrink: 0 }} />
                            <span style={{ fontWeight: 600, color: '#334155' }}>Hostel Room:</span>
                            <span style={{ color: '#2563eb', fontWeight: 600 }}>{p.student_room}</span>
                          </div>

                          <div className="parcel-info-row">
                            <Lock size={13} style={{ color: '#64748b', flexShrink: 0 }} />
                            <span style={{ fontWeight: 600, color: '#334155' }}>Locker Bay:</span>
                            <span style={{ color: '#475569', fontWeight: 700 }}>{p.storage_locker}</span>
                          </div>

                          <div className="parcel-info-row">
                            <Clock size={13} style={{ color: '#64748b', flexShrink: 0 }} />
                            <span style={{ fontWeight: 600, color: '#334155' }}>Received:</span>
                            <span style={{ color: '#475569' }}>{p.received_time}</span>
                            {p.collected_time && (
                              <span style={{ color: '#059669', fontWeight: 600 }}>• Picked up: {p.collected_time}</span>
                            )}
                          </div>
                        </div>

                        {/* Category & Condition Pill */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: catMeta.bg, padding: '6px 10px', borderRadius: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', color: catMeta.color, fontWeight: 700 }}>
                            <CatIcon size={14} />
                            <span>{catMeta.label}</span>
                          </div>
                          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                            Gate: {p.gate_name ? p.gate_name.slice(0, 16) : 'Main Gate'}
                          </span>
                        </div>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="parcel-gate-footer">
                        <button
                          type="button"
                          className="btn-enterprise-secondary"
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenParcelSlip(p);
                          }}
                        >
                          <Eye size={13} />
                          <span>Intake Slip</span>
                        </button>

                        {isAwaiting && (
                          <button
                            type="button"
                            className="btn-enterprise-primary"
                            style={{ padding: '6px 12px', fontSize: '12px' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMarkCollected(p.id);
                            }}
                          >
                            <CheckCheck size={13} />
                            <span>Hand Over</span>
                          </button>
                        )}
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
                    <th>Parcel Ref #</th>
                    <th>Carrier & Tracking</th>
                    <th>Resident Recipient</th>
                    <th>Room & Hostel</th>
                    <th>Storage Locker</th>
                    <th>Intake Timestamp</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredParcels.map((p) => {
                    const isAwaiting = p.status === 'AWAITING_PICKUP';

                    return (
                      <tr key={p.id} className="enterprise-table-row">
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
                            {p.id}
                          </code>
                        </td>

                        <td>
                          <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '13.5px' }}>
                            {p.carrier}
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                            AWB: {p.tracking_number}
                          </div>
                        </td>

                        <td>
                          <div style={{ fontWeight: 600, color: '#334155', fontSize: '13px' }}>
                            {p.student_name}
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#64748b' }}>{p.phone}</div>
                        </td>

                        <td>
                          <span style={{ fontWeight: 600, color: '#2563eb', fontSize: '12.5px' }}>
                            {p.student_room}
                          </span>
                        </td>

                        <td>
                          <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '12px', background: '#f8fafc', padding: '3px 8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                            {p.storage_locker}
                          </span>
                        </td>

                        <td>
                          <div style={{ fontSize: '12px', color: '#0f172a', fontWeight: 600 }}>
                            {p.received_time}
                          </div>
                          {p.collected_time ? (
                            <div style={{ fontSize: '11px', color: '#059669' }}>Out: {p.collected_time}</div>
                          ) : (
                            <div style={{ fontSize: '11px', color: '#ea580c' }}>In locker</div>
                          )}
                        </td>

                        <td>
                          {isAwaiting ? (
                            <span className="badge-enterprise badge-amber" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <span className="parcel-awaiting-pulse" /> AWAITING PICKUP
                            </span>
                          ) : (
                            <span className="badge-enterprise badge-emerald">COLLECTED</span>
                          )}
                        </td>

                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              type="button"
                              className="table-icon-btn"
                              title="View Intake Slip"
                              onClick={() => handleOpenParcelSlip(p)}
                            >
                              <Eye size={14} />
                            </button>
                            {isAwaiting && (
                              <button
                                type="button"
                                className="table-icon-btn"
                                title="Mark as Collected by Resident"
                                style={{ color: '#059669' }}
                                onClick={() => handleMarkCollected(p.id)}
                              >
                                <CheckCheck size={14} />
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
      {/* TAB 2: COURIER DROP GATES                                             */}
      {/* ===================================================================== */}
      {activeTab === 'GATES' && (
        <div className="enterprise-card" style={{ marginBottom: '24px' }}>
          <div className="card-topbar">
            <div className="card-title-group">
              <div className="card-title-icon-wrap">
                <DoorClosed size={16} />
              </div>
              <h2 className="card-title-text">Authorized Courier Drop Checkpoints</h2>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span className="badge-enterprise badge-emerald">
                {filteredGates.length} of {gates.length} Drop Gates Operational
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
                placeholder="Search by intake gate name, code, facility, location..."
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

          {/* Gates Content */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <LoadingState message="Loading intake drop gates..." />
            </div>
          ) : filteredGates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <EmptyState
                icon={DoorClosed}
                title="No courier drop checkpoints found"
                description="Try adjusting your filter options or register a courier intake gate."
              />
            </div>
          ) : gateDisplayMode === 'cards' ? (
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
                                {assignedGuards.length === 1 ? 'Guard On Duty' : 'Guards On Duty'}
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

                      <div className="visitor-gate-footer">
                        <button
                          type="button"
                          className="btn-enterprise-secondary"
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                          onClick={() => handleOpenGateDossier(gate)}
                        >
                          <Eye size={13} />
                          <span>Intake Gate Dossier</span>
                        </button>

                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                          Locker Intake Desk
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="enterprise-table-container">
              <table className="enterprise-table">
                <thead>
                  <tr>
                    <th>Intake Checkpoint</th>
                    <th>Identifier Code</th>
                    <th>Gate Type</th>
                    <th>Facility Perimeter</th>
                    <th>Location Details</th>
                    <th>Stationed Staff</th>
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
                            title="View Gate Dossier"
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
      {/* TAB 3: STATIONED INTAKE SECURITY PERSONNEL                            */}
      {/* ===================================================================== */}
      {activeTab === 'GUARDS' && (
        <div className="enterprise-card" style={{ marginBottom: '24px' }}>
          <div className="card-topbar">
            <div className="card-title-group">
              <div className="card-title-icon-wrap">
                <ShieldCheck size={16} />
              </div>
              <h2 className="card-title-text">Parcel Intake Security & Custody Officers</h2>
            </div>
            <span className="badge-enterprise badge-purple">
              {securityAssignments.length} Officers Deployed
            </span>
          </div>

          <div className="enterprise-table-container">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Intake Officer</th>
                  <th>Assigned Reception Gate</th>
                  <th>Shift Schedule</th>
                  <th>Checkpoint Contact</th>
                  <th>Intake Status</th>
                </tr>
              </thead>
              <tbody>
                {securityAssignments.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                      No security staff gate postings recorded.
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
      {/* TAB 4: MAILROOM OPERATING PROTOCOLS                                   */}
      {/* ===================================================================== */}
      {activeTab === 'PROTOCOLS' && (
        <div className="enterprise-card" style={{ marginBottom: '24px' }}>
          <div className="card-topbar">
            <div className="card-title-group">
              <div className="card-title-icon-wrap">
                <Mail size={16} />
              </div>
              <h2 className="card-title-text">Mailroom & Courier Operating Protocols</h2>
            </div>
            <span className="badge-enterprise badge-amber">Institutional Mailroom Code</span>
          </div>

          <div className="parcel-protocol-grid">
            <div className="parcel-protocol-card">
              <div className="parcel-protocol-icon" style={{ background: '#eff6ff', color: '#2563eb' }}>
                <Truck size={20} />
              </div>
              <h4 className="parcel-protocol-title">1. Perimeter Gate Drop Only</h4>
              <p className="parcel-protocol-desc">
                All delivery agents (Amazon, Flipkart, India Post, DHL) must deposit packages at designated gate security booths. Unescorted access to student rooms is prohibited.
              </p>
            </div>

            <div className="parcel-protocol-card">
              <div className="parcel-protocol-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
                <FileCheck size={20} />
              </div>
              <h4 className="parcel-protocol-title">2. Resident ID Verification</h4>
              <p className="parcel-protocol-desc">
                Students must present their institutional RFID student ID card or verified digital outpass profile matching the package recipient name upon collection.
              </p>
            </div>

            <div className="parcel-protocol-card">
              <div className="parcel-protocol-icon" style={{ background: '#fff7ed', color: '#ea580c' }}>
                <Clock size={20} />
              </div>
              <h4 className="parcel-protocol-title">3. Secure 7-Day Holding Window</h4>
              <p className="parcel-protocol-desc">
                Packages are stored securely in weather-protected intake lockers for up to 7 calendar days before automated reminder alerts and return-to-sender disposition.
              </p>
            </div>

            <div className="parcel-protocol-card">
              <div className="parcel-protocol-icon" style={{ background: '#f5f3ff', color: '#7c3aed' }}>
                <CheckCheck size={20} />
              </div>
              <h4 className="parcel-protocol-title">4. Real-Time Intake Receipt</h4>
              <p className="parcel-protocol-desc">
                Stationed security personnel record courier airway bill numbers, consignor details, and physical damage inspection prior to signing delivery acceptance receipts.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* DRAWER: Digital Parcel Intake Slip & Handover Dossier               */}
      {/* =================================================================== */}
      {parcelSlipDrawerOpen && selectedParcel && (
        <div className="parcel-drawer-overlay" onClick={() => setParcelSlipDrawerOpen(false)}>
          <div className="parcel-drawer-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '14px' }}>
              <div>
                <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Institutional Mailroom Registry
                </span>
                <h3 style={{ margin: '2px 0 0 0', fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
                  Digital Package Intake Slip
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setParcelSlipDrawerOpen(false)}
                style={{ border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Digital Slip Card */}
            <div className="parcel-digital-slip">
              <div className="slip-header-strip">
                <div>
                  <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    HMS Secure Logistics
                  </div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                    PARCEL CUSTODY RECEIPT
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <code style={{ fontSize: '1rem', fontWeight: 800, color: '#d97706', background: '#fef3c7', padding: '4px 8px', borderRadius: '6px' }}>
                    {selectedParcel.id}
                  </code>
                </div>
              </div>

              {/* Student Recipient Info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '14px', marginBottom: '16px' }}>
                <div>
                  <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Recipient Resident</span>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                    {selectedParcel.student_name}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#2563eb', fontWeight: 600 }}>{selectedParcel.student_room}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{selectedParcel.phone}</div>
                </div>

                <div>
                  <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Courier Service</span>
                  <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#334155', marginTop: '2px' }}>
                    {selectedParcel.carrier}
                  </div>
                  <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '2px' }}>
                    AWB: {selectedParcel.tracking_number}
                  </div>
                </div>
              </div>

              {/* Storage Locker Location Block */}
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Lock size={18} />
                    </div>
                    <div>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Allocated Storage Locker</span>
                      <div style={{ fontSize: '0.96rem', fontWeight: 800, color: '#0f172a' }}>
                        {selectedParcel.storage_locker}
                      </div>
                    </div>
                  </div>

                  <div>
                    {selectedParcel.status === 'AWAITING_PICKUP' ? (
                      <span className="badge-enterprise badge-amber">IN STORAGE</span>
                    ) : (
                      <span className="badge-enterprise badge-emerald">DISPATCHED</span>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: '10px', fontSize: '0.78rem', color: '#475569', borderTop: '1px dashed #e2e8f0', paddingTop: '8px' }}>
                  <strong>Intake Checkpoint:</strong> {selectedParcel.gate_name}
                </div>
              </div>

              {/* Timestamps */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', textAlign: 'center', background: '#f8fafc', padding: '10px', borderRadius: '8px' }}>
                <div>
                  <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Received</span>
                  <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#0f172a' }}>{selectedParcel.received_time}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Retention Curfew</span>
                  <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#059669' }}>7 Days Active</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Handover Status</span>
                  <div style={{ fontSize: '0.84rem', fontWeight: 700, color: selectedParcel.status === 'COLLECTED' ? '#059669' : '#d97706' }}>
                    {selectedParcel.status === 'COLLECTED' ? 'Collected' : 'Pending Pick'}
                  </div>
                </div>
              </div>

              {/* Barcode Strip */}
              <div className="slip-barcode-box">
                <svg className="slip-barcode-svg" viewBox="0 0 200 40">
                  <rect x="0" y="0" width="3" height="40" fill="#0f172a" />
                  <rect x="6" y="0" width="2" height="40" fill="#0f172a" />
                  <rect x="12" y="0" width="7" height="40" fill="#0f172a" />
                  <rect x="22" y="0" width="3" height="40" fill="#0f172a" />
                  <rect x="28" y="0" width="6" height="40" fill="#0f172a" />
                  <rect x="38" y="0" width="2" height="40" fill="#0f172a" />
                  <rect x="44" y="0" width="5" height="40" fill="#0f172a" />
                  <rect x="54" y="0" width="3" height="40" fill="#0f172a" />
                  <rect x="62" y="0" width="6" height="40" fill="#0f172a" />
                  <rect x="72" y="0" width="2" height="40" fill="#0f172a" />
                  <rect x="80" y="0" width="5" height="40" fill="#0f172a" />
                  <rect x="90" y="0" width="3" height="40" fill="#0f172a" />
                  <rect x="98" y="0" width="7" height="40" fill="#0f172a" />
                  <rect x="110" y="0" width="2" height="40" fill="#0f172a" />
                  <rect x="118" y="0" width="4" height="40" fill="#0f172a" />
                  <rect x="128" y="0" width="5" height="40" fill="#0f172a" />
                  <rect x="138" y="0" width="3" height="40" fill="#0f172a" />
                  <rect x="146" y="0" width="7" height="40" fill="#0f172a" />
                  <rect x="158" y="0" width="2" height="40" fill="#0f172a" />
                  <rect x="166" y="0" width="5" height="40" fill="#0f172a" />
                  <rect x="176" y="0" width="4" height="40" fill="#0f172a" />
                  <rect x="186" y="0" width="6" height="40" fill="#0f172a" />
                </svg>
                <div style={{ fontSize: '0.72rem', color: '#64748b', letterSpacing: '2px', fontWeight: 700 }}>
                  *{selectedParcel.id}*
                </div>
              </div>
            </div>

            {/* Condition & Inspection Note */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 14px', fontSize: '0.82rem', color: '#475569' }}>
              <strong>Condition Report:</strong> {selectedParcel.notes || 'Package arrived sealed. Inspected at intake gate.'}
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
                <span>Print Intake Slip</span>
              </button>

              <div style={{ display: 'flex', gap: '8px' }}>
                {selectedParcel.status === 'AWAITING_PICKUP' && (
                  <button
                    type="button"
                    className="btn-enterprise-primary"
                    onClick={() => handleMarkCollected(selectedParcel.id)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <CheckCheck size={16} />
                    <span>Confirm Handover to Resident</span>
                  </button>
                )}

                <button
                  type="button"
                  className="btn-enterprise-secondary"
                  onClick={() => setParcelSlipDrawerOpen(false)}
                >
                  Close Slip
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* DRAWER: Checkpoint Dossier                                          */}
      {/* =================================================================== */}
      {gateDrawerOpen && selectedGate && (
        <div className="parcel-drawer-overlay" onClick={() => setGateDrawerOpen(false)}>
          <div className="parcel-drawer-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '14px' }}>
              <div>
                <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Courier Checkpoint Dossier
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

            {/* Top Gate Identity */}
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
                style={{ width: '48px', height: '48px', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}
              >
                <DoorOpen size={22} />
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

            {/* Specs */}
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
                  COURIER INTAKE WINDOW
                </div>
                <div style={{ fontWeight: 600, color: '#0f172a', marginTop: '4px' }}>
                  09:00 - 17:00 hrs
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
                {selectedGate.location_description || 'Main entrance security booth and package intake desk.'}
              </div>
            </div>

            {/* Stationed Personnel */}
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
                Intake Custody Officers On Duty
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
                      <span>No security officers stationed at this drop gate currently.</span>
                    </div>
                  );
                }
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {assigned.map((a) => {
                      const staff = staffMap.get(a.staff_id);
                      const name = staff
                        ? `${staff.first_name || ''} ${staff.last_name || ''}`.trim()
                        : 'Intake Officer';
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
      {/* MODAL: Log Package Intake                                           */}
      {/* =================================================================== */}
      {intakeModalOpen && (
        <div className="student-modal-overlay" onClick={() => !formSubmitting && setIntakeModalOpen(false)}>
          <div className="student-modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            <div className="student-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Package size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                    Log Package Intake Custody
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '2px 0 0 0' }}>
                    Record incoming courier package and assign secure holding locker
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => !formSubmitting && setIntakeModalOpen(false)}
                style={{ border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleIntakeSubmit}>
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

                {/* Recipient Student & Room */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                      Resident Student Name <span style={{ color: '#ef4444' }}>*</span>
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
                      Hostel Block & Room <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Block A - Room 302"
                      value={formRoom}
                      onChange={(e) => setFormRoom(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Carrier & Tracking */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                      Courier / Carrier Service <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <select
                      className="form-control"
                      value={formCarrier}
                      onChange={(e) => setFormCarrier(e.target.value)}
                    >
                      <option value="Amazon Logistics">Amazon Logistics</option>
                      <option value="Flipkart Courier">Flipkart Courier</option>
                      <option value="Blue Dart Express">Blue Dart Express</option>
                      <option value="India Post Speed Post">India Post Speed Post</option>
                      <option value="Delhivery">Delhivery</option>
                      <option value="DHL Express">DHL Express</option>
                      <option value="FedEx Express">FedEx Express</option>
                      <option value="Other Courier">Other Courier</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                      Airway Bill / Tracking #
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. AMZN-992147318"
                      value={formTracking}
                      onChange={(e) => setFormTracking(e.target.value)}
                    />
                  </div>
                </div>

                {/* Student Phone */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Student Contact Phone (for Pickup SMS)
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. +91 98231 44521"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                  />
                </div>

                {/* Parcel Category Selector */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Package Category
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                    {[
                      { id: 'GENERAL', label: 'General Goods' },
                      { id: 'BOOKS_STATIONERY', label: 'Books / Study' },
                      { id: 'ELECTRONICS', label: 'Electronics' },
                      { id: 'MEDICINE', label: 'Medicines / Health' },
                      { id: 'DOCUMENTS', label: 'Certificates' },
                      { id: 'CLOTHING', label: 'Clothing / Shoes' },
                    ].map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setFormCategory(c.id)}
                        style={{
                          padding: '8px 10px',
                          borderRadius: '8px',
                          border: formCategory === c.id ? '1.5px solid #2563eb' : '1.5px solid #e2e8f0',
                          background: formCategory === c.id ? '#eff6ff' : '#ffffff',
                          color: formCategory === c.id ? '#1d4ed8' : '#475569',
                          fontWeight: 600,
                          fontSize: '0.78rem',
                          cursor: 'pointer',
                        }}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Storage Locker & Gate */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                      Assigned Storage Locker / Bay
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Locker Bay A-01"
                      value={formLocker}
                      onChange={(e) => setFormLocker(e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                      Intake Drop Checkpoint
                    </label>
                    <select
                      className="form-control"
                      value={formGate}
                      onChange={(e) => setFormGate(e.target.value)}
                    >
                      {gates.length > 0 ? (
                        gates.map((g) => (
                          <option key={g.id} value={g.name}>
                            {g.name}
                          </option>
                        ))
                      ) : (
                        <option value="Main North Gate Security Booth">Main North Gate Security Booth</option>
                      )}
                    </select>
                  </div>
                </div>

                {/* Security Remarks */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Package Condition / Inspection Notes
                  </label>
                  <textarea
                    className="form-control"
                    rows={2}
                    placeholder="Optional notes: e.g. Outer carton intact. Fragile sticker noted. Security seal verified."
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="student-modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIntakeModalOpen(false)}
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
                      <RefreshCw size={14} className="spin-icon" /> Generating Intake Slip...
                    </>
                  ) : (
                    <>
                      <Check size={16} /> Log Package & Issue Slip
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
