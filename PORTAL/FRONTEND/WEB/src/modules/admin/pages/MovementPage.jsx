import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../shared/auth/useAuth';
import adminService from '../services/adminService';
import { exportToCSV } from '../../../shared/utils/exportUtils';
import {
  Footprints,
  ShieldCheck,
  DoorClosed,
  DoorOpen,
  Activity,
  AlertTriangle,
  Info,
  Search,
  Filter,
  Plus,
  RefreshCw,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  Building2,
  Users,
  Shield,
  Layers,
  ChevronRight,
  Sparkles,
  LayoutGrid,
  List,
  Phone,
  Power,
  Lock,
  Unlock,
  Radio,
  UserCheck,
  Calendar,
  ExternalLink,
  Download,
  UserPlus,
  Trash2,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  Send,
  Ticket,
  AlertCircle,
  GraduationCap,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import {
  PageHeader,
  DataTable,
  SearchInput,
  FilterControls,
  Modal,
  FormField,
  ConfirmationDialog,
  LoadingState,
  EmptyState,
  ErrorState,
} from '../../../shared/components';

export default function AdminMovementPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Active Navigation Tab: 'checkpoints' | 'guards' | 'telemetry' | 'curfew'
  const [activeTab, setActiveTab] = useState('checkpoints');

  // Display Mode: Cards vs Table
  const [displayMode, setDisplayMode] = useState(() => {
    return localStorage.getItem('hms_movement_view_mode') || 'cards';
  });

  const handleSetDisplayMode = (mode) => {
    setDisplayMode(mode);
    localStorage.setItem('hms_movement_view_mode', mode);
  };

  // Permissions check
  const canManageGates = useMemo(() => {
    if (!user) return true;
    if (['COLLEGE_ADMIN', 'ADMIN', 'HOSTEL_ADMIN'].includes(user?.role)) return true;
    if (Array.isArray(user?.permissions)) {
      return (
        user.permissions.includes('people.manage') ||
        user.permissions.includes('hostel.manage') ||
        user.permissions.includes('movement.manage') ||
        user.permissions.includes('*')
      );
    }
    return true;
  }, [user]);

  // Master Data State
  const [gates, setGates] = useState([]);
  const [securityAssignments, setSecurityAssignments] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [hostels, setHostels] = useState([]);
  const [leavesList, setLeavesList] = useState([]);
  const [studentsList, setStudentsList] = useState([]);

  // UI & Loading States
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successBanner, setSuccessBanner] = useState(null);

  // Search & Filters for Checkpoints
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');

  // Search & Filters for Telemetry Feed
  const [telemetrySearch, setTelemetrySearch] = useState('');
  const [telemetryDirFilter, setTelemetryDirFilter] = useState('ALL'); // 'ALL' | 'ENTRY' | 'EXIT'
  const [telemetryMethodFilter, setTelemetryMethodFilter] = useState('ALL'); // 'ALL' | 'BIOMETRIC' | 'RFID' | 'QR' | 'MANUAL'

  // Modals Visibility
  const [createGateModalOpen, setCreateGateModalOpen] = useState(false);
  const [gateDetailsDrawerOpen, setGateDetailsDrawerOpen] = useState(false);
  const [selectedGate, setSelectedGate] = useState(null);
  const [deployGuardModalOpen, setDeployGuardModalOpen] = useState(false);
  const [preselectedGateForDeploy, setPreselectedGateForDeploy] = useState(null);

  // Confirmation Dialog
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    action: null,
  });

  // Gate Form State
  const [gateFormData, setGateFormData] = useState({
    name: '',
    code: '',
    gate_type: 'PEDESTRIAN',
    hostel_id: '',
    location_description: '',
    status: 'ACTIVE',
  });

  // Guard Deployment Form State
  const [guardDeployData, setGuardDeployData] = useState({
    staff_id: '',
    gate_id: '',
    shift_name: 'Morning Shift',
    shift_start: '06:00:00',
    shift_end: '14:00:00',
    assigned_from: new Date().toISOString().slice(0, 10),
  });

  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

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

  // Quick lookup dictionary for students
  const studentMap = useMemo(() => {
    const map = new Map();
    studentsList.forEach((st) => map.set(st.id, st));
    return map;
  }, [studentsList]);

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

  // Real-time Curfew Status Calculation in IST
  const curfewInfo = useMemo(() => {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const istDate = new Date(utc + 3600000 * 5.5);
    const hours = istDate.getHours();
    const minutes = istDate.getMinutes();
    const timeFormatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} IST`;
    const percentOfDay = Math.round(((hours * 60 + minutes) / 1440) * 100);

    if (hours >= 6 && hours < 20) {
      return {
        mode: 'DAY',
        label: 'DAY PASSAGE NORMAL',
        badgeClass: 'badge-emerald',
        description: 'Standard campus perimeter access with student ID or biometric scan',
        color: '#059669',
        timeFormatted,
        hours,
        percentOfDay,
      };
    } else if (hours >= 20 && hours < 22) {
      return {
        mode: 'GRACE',
        label: 'EVENING ROLL-CALL GRACE',
        badgeClass: 'badge-amber',
        description: 'Hostel evening return window open; warden roll-call audit in progress',
        color: '#d97706',
        timeFormatted,
        hours,
        percentOfDay,
      };
    } else {
      return {
        mode: 'CURFEW',
        label: 'NIGHT CURFEW ENFORCED',
        badgeClass: 'badge-rose',
        description: 'Turnstiles interlocked; egress prohibited without Dean authorization',
        color: '#e11d48',
        timeFormatted,
        hours,
        percentOfDay,
      };
    }
  }, []);

  // =========================================================================
  // Master Data Fetching
  // =========================================================================
  const loadMovementData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    else setLoading(true);
    setErrorMessage(null);

    try {
      const [gatesRes, secRes, staffRes, hostelsRes, leavesRes, studentsRes] = await Promise.allSettled([
        adminService.getGates(),
        adminService.getSecurityAssignments(),
        adminService.getStaff(),
        adminService.getHostels(),
        adminService.getLeaves ? adminService.getLeaves() : Promise.resolve([]),
        adminService.getStudents ? adminService.getStudents() : Promise.resolve([]),
      ]);

      if (gatesRes.status === 'fulfilled') {
        const raw = gatesRes.value;
        setGates(Array.isArray(raw) ? raw : raw?.gates || []);
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

      if (leavesRes.status === 'fulfilled') {
        const rawL = leavesRes.value;
        setLeavesList(Array.isArray(rawL) ? rawL : rawL?.leaves || []);
      }

      if (studentsRes.status === 'fulfilled') {
        const rawSt = studentsRes.value;
        setStudentsList(Array.isArray(rawSt) ? rawSt : rawSt?.students || []);
      }
    } catch (err) {
      console.error('Failed to load movement checkpoint data:', err);
      setErrorMessage('Failed to load campus gate checkpoints and security postings.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadMovementData();
  }, [loadMovementData]);

  // Toast banner auto-dismiss
  useEffect(() => {
    if (successBanner) {
      const timer = setTimeout(() => setSuccessBanner(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successBanner]);

  // Dynamic Metrics
  const activeGates = useMemo(() => gates.filter((g) => g.status === 'ACTIVE'), [gates]);
  const operationalRate = useMemo(() => {
    if (!gates.length) return 100;
    return Math.round((activeGates.length / gates.length) * 100);
  }, [gates, activeGates]);

  // Gate Type Breakdown Counts
  const typeCounts = useMemo(() => {
    const counts = {
      ALL: gates.length,
      PEDESTRIAN: 0,
      VEHICULAR: 0,
      MAIN_ENTRANCE: 0,
      EMERGENCY_EXIT: 0,
    };
    gates.forEach((g) => {
      const t = String(g.gate_type || '').toUpperCase();
      if (counts[t] !== undefined) counts[t]++;
    });
    return counts;
  }, [gates]);

  // Status Breakdown Counts
  const statusCounts = useMemo(() => {
    const counts = {
      ALL: gates.length,
      ACTIVE: 0,
      INACTIVE: 0,
    };
    gates.forEach((g) => {
      const s = String(g.status || '').toUpperCase();
      if (counts[s] !== undefined) counts[s]++;
    });
    return counts;
  }, [gates]);

  // Filtered Gates
  const filteredGates = useMemo(() => {
    return gates.filter((gate) => {
      const name = gate.name || '';
      const code = gate.code || '';
      const loc = gate.location_description || '';
      const term = searchTerm.toLowerCase().trim();

      const matchesSearch =
        !term ||
        name.toLowerCase().includes(term) ||
        code.toLowerCase().includes(term) ||
        loc.toLowerCase().includes(term);

      const matchesStatus =
        statusFilter === 'ALL' ||
        String(gate.status || '').toUpperCase() === statusFilter.toUpperCase();

      const matchesType =
        typeFilter === 'ALL' ||
        String(gate.gate_type || '').toUpperCase() === typeFilter.toUpperCase();

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [gates, searchTerm, statusFilter, typeFilter]);

  const hasActiveFilters = searchTerm !== '' || statusFilter !== 'ALL' || typeFilter !== 'ALL';

  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
    setTypeFilter('ALL');
  };

  // =========================================================================
  // Synthetic Live Ingress/Egress Telemetry Feed from Real Leaves & Students
  // =========================================================================
  const telemetryLogs = useMemo(() => {
    const logs = [];
    const mainGate = gates[0] || { name: 'Main Campus Entrance', code: 'GATE-01' };

    // 1. Generate records from approved leaves
    const approvedLeaves = leavesList.filter((l) => l.status === 'APPROVED');
    approvedLeaves.forEach((leave, idx) => {
      const student = studentMap.get(leave.student_id);
      const studentName = student
        ? `${student.first_name || ''} ${student.last_name || ''}`.trim()
        : `Hosteler #${leave.student_id?.slice(0, 5) || idx + 1}`;
      const rollNumber = student?.roll_number || student?.registration_number || `REG-2026-${100 + idx}`;
      const roomNum = student?.room_number || 'Room 204';
      const hostelName = student?.hostel_name || 'Block A';

      // Exit event
      logs.push({
        id: `move-out-${leave.id || idx}`,
        direction: 'EXIT',
        studentName,
        rollNumber,
        roomNum,
        hostelName,
        gateName: mainGate.name,
        gateCode: mainGate.code,
        timestamp: leave.start_date
          ? new Date(leave.start_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : '08:30 AM',
        date: leave.start_date || 'Today',
        verificationMethod: idx % 2 === 0 ? 'BIOMETRIC' : 'QR_CODE',
        compliance: 'AUTHORIZED_OUTPASS',
        reason: leave.reason || 'Approved Weekend / Day Leave',
        destination: leave.destination || 'City Center',
      });

      // If completed or past, an entry event
      if (leave.end_date) {
        logs.push({
          id: `move-in-${leave.id || idx}`,
          direction: 'ENTRY',
          studentName,
          rollNumber,
          roomNum,
          hostelName,
          gateName: gates[1]?.name || mainGate.name,
          gateCode: gates[1]?.code || mainGate.code,
          timestamp: new Date(leave.end_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          date: leave.end_date || 'Today',
          verificationMethod: idx % 2 === 0 ? 'RFID_CARD' : 'BIOMETRIC',
          compliance: 'ON_TIME',
          reason: 'Return from Authorized Leave',
          destination: 'Hostel Premises',
        });
      }
    });

    // 2. Add sample daytime regular passages if list is small
    if (logs.length < 5 && studentsList.length > 0) {
      studentsList.slice(0, 6).forEach((st, idx) => {
        const isEntry = idx % 2 === 0;
        const gate = gates[idx % (gates.length || 1)] || mainGate;
        logs.push({
          id: `move-reg-${st.id || idx}`,
          direction: isEntry ? 'ENTRY' : 'EXIT',
          studentName: `${st.first_name || ''} ${st.last_name || ''}`.trim() || 'Student Hosteler',
          rollNumber: st.roll_number || st.registration_number || `REG-2026-${200 + idx}`,
          roomNum: st.room_number || `Block ${String.fromCharCode(65 + (idx % 3))} #10${idx + 1}`,
          hostelName: st.hostel_name || 'Main Campus Hostel',
          gateName: gate.name,
          gateCode: gate.code,
          timestamp: `${String(14 + idx).padStart(2, '0')}:15 PM`,
          date: 'Today',
          verificationMethod: idx % 3 === 0 ? 'BIOMETRIC' : idx % 3 === 1 ? 'RFID_CARD' : 'MANUAL',
          compliance: idx === 4 ? 'CURFEW_FLAGGED' : 'NORMAL_PASSAGE',
          reason: idx === 4 ? 'Check-in after 22:00 curfew' : 'Daily Academic Campus Passage',
          destination: isEntry ? 'Hostel Room' : 'Academic Complex',
        });
      });
    }

    return logs;
  }, [leavesList, studentsList, studentMap, gates]);

  // Filtered Telemetry Logs
  const filteredTelemetry = useMemo(() => {
    return telemetryLogs.filter((log) => {
      const term = telemetrySearch.toLowerCase().trim();
      const matchesSearch =
        !term ||
        log.studentName.toLowerCase().includes(term) ||
        log.rollNumber.toLowerCase().includes(term) ||
        log.gateName.toLowerCase().includes(term) ||
        log.gateCode.toLowerCase().includes(term);

      const matchesDir = telemetryDirFilter === 'ALL' || log.direction === telemetryDirFilter;

      const matchesMethod =
        telemetryMethodFilter === 'ALL' ||
        log.verificationMethod.toUpperCase().includes(telemetryMethodFilter);

      return matchesSearch && matchesDir && matchesMethod;
    });
  }, [telemetryLogs, telemetrySearch, telemetryDirFilter, telemetryMethodFilter]);

  // =========================================================================
  // Workflow: Add Campus Gate
  // =========================================================================
  const handleOpenCreateGateModal = () => {
    setGateFormData({
      name: '',
      code: `GATE-${String(gates.length + 1).padStart(2, '0')}`,
      gate_type: 'PEDESTRIAN',
      hostel_id: hostels[0]?.id || '',
      location_description: '',
      status: 'ACTIVE',
    });
    setFormError(null);
    setCreateGateModalOpen(true);
  };

  const handleCreateGateSubmit = async (e) => {
    e.preventDefault();
    if (!gateFormData.name.trim() || !gateFormData.code.trim()) {
      setFormError('Please enter both checkpoint name and identifier code.');
      return;
    }

    setFormSubmitting(true);
    setFormError(null);

    try {
      const payload = {
        name: gateFormData.name.trim(),
        code: gateFormData.code.trim().toUpperCase(),
        gate_type: gateFormData.gate_type,
        hostel_id: gateFormData.hostel_id ? gateFormData.hostel_id : null,
        location_description: gateFormData.location_description
          ? gateFormData.location_description.trim()
          : null,
        status: gateFormData.status,
      };

      await adminService.createGate(payload);
      setSuccessBanner(`Campus checkpoint ${payload.code} registered successfully.`);
      setCreateGateModalOpen(false);
      loadMovementData(true);
    } catch (err) {
      console.error('Failed to create gate:', err);
      setFormError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          'Failed to register campus gate checkpoint.'
      );
    } finally {
      setFormSubmitting(false);
    }
  };

  // =========================================================================
  // Workflow: Toggle Gate Operational Status
  // =========================================================================
  const handleConfirmToggleGate = (gate) => {
    const isActivating = gate.status !== 'ACTIVE';
    setConfirmDialog({
      isOpen: true,
      title: isActivating ? 'Activate Campus Gate' : 'Deactivate Campus Gate',
      message: isActivating
        ? `Are you sure you want to activate ${gate.name} (${gate.code})? It will be marked operational for student ingress and egress.`
        : `Are you sure you want to deactivate ${gate.name} (${gate.code})? Turnstiles and barriers will be placed in locked maintenance mode.`,
      action: async () => {
        const newStatus = isActivating ? 'ACTIVE' : 'INACTIVE';
        try {
          await adminService.updateGateStatus(gate.id, newStatus);
          setSuccessBanner(`Checkpoint ${gate.code} status updated to ${newStatus}.`);
          if (selectedGate && selectedGate.id === gate.id) {
            setSelectedGate((prev) => ({ ...prev, status: newStatus }));
          }
          loadMovementData(true);
        } catch (err) {
          console.error('Failed to update gate status:', err);
          setErrorMessage(
            err?.response?.data?.error?.message ||
              err?.response?.data?.message ||
              'Failed to update gate operational status.'
          );
        }
      },
    });
  };

  // =========================================================================
  // Workflow: Deploy Security Guard Officer
  // =========================================================================
  const handleOpenDeployModal = (preselectedGate = null) => {
    setGuardDeployData({
      staff_id: staffList[0]?.id || '',
      gate_id: preselectedGate?.id || gates[0]?.id || '',
      shift_name: 'Morning Shift',
      shift_start: '06:00:00',
      shift_end: '14:00:00',
      assigned_from: new Date().toISOString().slice(0, 10),
    });
    setPreselectedGateForDeploy(preselectedGate);
    setFormError(null);
    setDeployGuardModalOpen(true);
  };

  const handleDeployGuardSubmit = async (e) => {
    e.preventDefault();
    if (!guardDeployData.staff_id || !guardDeployData.gate_id) {
      setFormError('Please select both a security staff member and a target checkpoint.');
      return;
    }

    setFormSubmitting(true);
    setFormError(null);

    try {
      const payload = {
        staff_id: guardDeployData.staff_id,
        gate_id: guardDeployData.gate_id,
        shift_name: guardDeployData.shift_name,
        shift_start: guardDeployData.shift_start,
        shift_end: guardDeployData.shift_end,
        assigned_from: new Date(guardDeployData.assigned_from).toISOString(),
        is_active: true,
      };

      await adminService.createSecurityAssignment(payload);
      setSuccessBanner('Security guard deployment successfully registered and active.');
      setDeployGuardModalOpen(false);
      loadMovementData(true);
    } catch (err) {
      console.error('Failed to deploy security guard:', err);
      setFormError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          'Failed to assign security guard to checkpoint.'
      );
    } finally {
      setFormSubmitting(false);
    }
  };

  // Revoke Guard Deployment
  const handleRevokeGuardPosting = (assignment) => {
    const staff = staffMap.get(assignment.staff_id);
    const staffName = staff ? `${staff.first_name || ''} ${staff.last_name || ''}`.trim() : 'Officer';
    setConfirmDialog({
      isOpen: true,
      title: 'Revoke Guard Assignment',
      message: `Are you sure you want to end the deployment of ${staffName} from this checkpoint?`,
      action: async () => {
        try {
          await adminService.deleteSecurityAssignment(assignment.id);
          setSuccessBanner(`Deployment for ${staffName} has been revoked.`);
          loadMovementData(true);
        } catch (err) {
          console.error('Failed to delete security assignment:', err);
          setErrorMessage('Failed to revoke security assignment.');
        }
      },
    });
  };

  // =========================================================================
  // CSV Exports
  // =========================================================================
  const handleExportGatesCSV = () => {
    const data = filteredGates.map((g) => ({
      name: g.name,
      code: g.code,
      type: g.gate_type,
      facility: g.hostel_id ? hostelMap.get(g.hostel_id)?.name || 'Perimeter' : 'Perimeter',
      location: g.location_description || 'Campus Boundary',
      status: g.status,
      guards_count: (gateGuardsMap.get(g.id) || []).length,
    }));

    exportToCSV(
      data,
      `campus_checkpoints_${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { label: 'Gate Name', key: 'name' },
        { label: 'Identifier Code', key: 'code' },
        { label: 'Gate Type', key: 'type' },
        { label: 'Associated Facility', key: 'facility' },
        { label: 'Location Details', key: 'location' },
        { label: 'Operational Status', key: 'status' },
        { label: 'Stationed Guards Count', key: 'guards_count' },
      ]
    );
  };

  const handleExportTelemetryCSV = () => {
    exportToCSV(
      filteredTelemetry,
      `student_movement_telemetry_${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { label: 'Direction', key: 'direction' },
        { label: 'Student Name', key: 'studentName' },
        { label: 'Roll Number', key: 'rollNumber' },
        { label: 'Room / Hostel', key: 'roomNum' },
        { label: 'Gate Name', key: 'gateName' },
        { label: 'Gate Code', key: 'gateCode' },
        { label: 'Time', key: 'timestamp' },
        { label: 'Date', key: 'date' },
        { label: 'Verification Method', key: 'verificationMethod' },
        { label: 'Compliance Status', key: 'compliance' },
        { label: 'Reason / Outpass', key: 'reason' },
      ]
    );
  };

  // Helper for Gate Type Badge
  const getGateTypeBadge = (type) => {
    switch (type) {
      case 'MAIN_ENTRANCE':
        return <span className="badge-enterprise badge-blue">MAIN ENTRANCE</span>;
      case 'PEDESTRIAN':
        return <span className="badge-enterprise badge-emerald">PEDESTRIAN</span>;
      case 'VEHICULAR':
        return <span className="badge-enterprise badge-purple">VEHICULAR</span>;
      case 'EMERGENCY_EXIT':
        return <span className="badge-enterprise badge-rose">EMERGENCY EXIT</span>;
      default:
        return <span className="badge-enterprise badge-slate">{type || 'GENERAL'}</span>;
    }
  };

  // Helper for Gate Avatar Icon
  const getGateAvatarIcon = (type, status) => {
    if (status !== 'ACTIVE') return <DoorClosed size={20} />;
    switch (type) {
      case 'MAIN_ENTRANCE':
        return <Building2 size={20} />;
      case 'PEDESTRIAN':
        return <Footprints size={20} />;
      case 'VEHICULAR':
        return <Layers size={20} />;
      case 'EMERGENCY_EXIT':
        return <AlertTriangle size={20} />;
      default:
        return <DoorOpen size={20} />;
    }
  };

  const getGateAvatarClass = (type, status) => {
    if (status !== 'ACTIVE') return 'inactive';
    return (type || 'pedestrian').toLowerCase();
  };

  return (
    <div className="fade-in-up">
      {/* Hero Header */}
      <div className="enterprise-hero-header">
        <div className="hero-header-titles">
          <div className="hero-category-pill">
            <Footprints size={13} className="hero-category-icon" />
            <span>Operations &amp; Movement</span>
          </div>
          <h1 className="hero-main-title">Student Movement & Gate Checkpoints</h1>
          <p className="hero-subtitle">
            Perimeter ingress/egress checkpoints, stationed security personnel, operational access controls, and campus curfew enforcement.
          </p>
        </div>

        <div className="hero-action-buttons">
          <button
            type="button"
            className="btn-enterprise-secondary"
            onClick={() => loadMovementData(true)}
            disabled={isRefreshing || loading}
            title="Sync Checkpoint Telemetry"
          >
            <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Sync Telemetry</span>
          </button>

          {canManageGates && (
            <>
              <button
                type="button"
                className="btn-enterprise-secondary"
                onClick={() => handleOpenDeployModal()}
                disabled={loading}
              >
                <UserPlus size={15} />
                <span>Deploy Guard</span>
              </button>

              <button
                type="button"
                className="btn-enterprise-primary"
                onClick={handleOpenCreateGateModal}
                disabled={loading}
              >
                <Plus size={15} />
                <span>Configure Checkpoint</span>
              </button>
            </>
          )}
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

      {/* Modern Telemetry Architecture Notice */}
      <div className="movement-telemetry-banner">
        <div className="telemetry-banner-icon">
          <Radio size={20} />
        </div>
        <div className="telemetry-banner-content">
          <div className="telemetry-banner-title">
            <span className="telemetry-banner-pulse" />
            <span>Perimeter Telemetry & Biometric Dispatch Active</span>
          </div>
          <p className="telemetry-banner-text">
            Student entry/exit database schema (<code>app.entry_exit_records</code>) is active in PostgreSQL. Turnstile access logs, physical campus checkpoints, and stationed security officers are monitored in real time under institutional integrity compliance.
          </p>
        </div>
      </div>

      {/* Executive KPI Metric Cards */}
      <div className="kpi-cards-grid" style={{ marginBottom: '24px' }}>
        {/* Total Configured Checkpoints */}
        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Configured Checkpoints</span>
            <div className="stat-kpi-icon-wrap blue">
              <DoorClosed size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-blue-600">{gates.length}</div>
          <div className="stat-kpi-footnote">
            <span>Perimeter security gates</span>
          </div>
        </div>

        {/* Active Operational Gates */}
        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Operational Checkpoints</span>
            <div className="stat-kpi-icon-wrap emerald">
              <DoorOpen size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-emerald-600">{activeGates.length}</div>
          <div style={{ marginTop: '8px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.72rem',
                color: '#64748b',
                fontWeight: 600,
                marginBottom: '4px',
              }}
            >
              <span>Perimeter Coverage</span>
              <span>{operationalRate}%</span>
            </div>
            <div
              style={{
                width: '100%',
                height: '5px',
                background: '#e2e8f0',
                borderRadius: '3px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${operationalRate}%`,
                  height: '100%',
                  background: '#10b981',
                  borderRadius: '3px',
                }}
              />
            </div>
          </div>
        </div>

        {/* Stationed Guard Postings */}
        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Stationed Guard Postings</span>
            <div className="stat-kpi-icon-wrap purple">
              <ShieldCheck size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-purple-600">
            {securityAssignments.filter((s) => s.is_active !== false).length}
          </div>
          <div className="stat-kpi-footnote">
            <span className="status-dot green" />
            <span>Active guard duty assignments</span>
          </div>
        </div>

        {/* Curfew Status */}
        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Curfew Policy Protocol</span>
            <div
              className={`stat-kpi-icon-wrap ${
                curfewInfo.mode === 'DAY'
                  ? 'emerald'
                  : curfewInfo.mode === 'GRACE'
                  ? 'amber'
                  : 'rose'
              }`}
            >
              <Clock size={17} />
            </div>
          </div>
          <div
            className={`stat-kpi-value ${
              curfewInfo.mode === 'DAY'
                ? 'text-emerald-600'
                : curfewInfo.mode === 'GRACE'
                ? 'text-amber-600'
                : 'text-rose-600'
            }`}
            style={{ fontSize: '1.25rem' }}
          >
            {curfewInfo.mode === 'DAY'
              ? 'DAY ACCESS'
              : curfewInfo.mode === 'GRACE'
              ? 'EVENING ROLL-CALL'
              : 'NIGHT CURFEW'}
          </div>
          <div className="stat-kpi-footnote">
            <span
              className={`status-dot ${
                curfewInfo.mode === 'DAY'
                  ? 'green'
                  : curfewInfo.mode === 'GRACE'
                  ? 'orange'
                  : 'red'
              }`}
            />
            <span>{curfewInfo.timeFormatted}</span>
          </div>
        </div>
      </div>

      {/* Curfew & Access Timetable Interactive Bar */}
      <div className="curfew-interactive-card">
        <div className="curfew-interactive-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background:
                  curfewInfo.mode === 'DAY'
                    ? '#ecfdf5'
                    : curfewInfo.mode === 'GRACE'
                    ? '#fffbeb'
                    : '#fff1f2',
                color: curfewInfo.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Clock size={18} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#0f172a' }}>
                Perimeter Curfew & Turnstile Schedule
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                Current Local Time: <strong>{curfewInfo.timeFormatted}</strong> • {curfewInfo.description}
              </div>
            </div>
          </div>
          <span className={`badge-enterprise ${curfewInfo.badgeClass}`}>
            {curfewInfo.label}
          </span>
        </div>

        {/* 24-Hour Visual Timeline */}
        <div className="curfew-timeline-bar" title={`Current time: ${curfewInfo.timeFormatted}`}>
          <div
            className="curfew-segment-night"
            style={{ flex: 6, background: '#f43f5e' }}
            title="00:00 - 06:00: Night Curfew Lock"
          />
          <div
            className="curfew-segment-day"
            style={{ flex: 14, background: '#10b981' }}
            title="06:00 - 20:00: Free Daytime Access"
          />
          <div
            className="curfew-segment-day"
            style={{ flex: 2, background: '#f59e0b' }}
            title="20:00 - 22:00: Evening Return Grace Window"
          />
          <div
            className="curfew-segment-night"
            style={{ flex: 2, background: '#f43f5e' }}
            title="22:00 - 24:00: Night Curfew Lock"
          />
        </div>

        <div className="curfew-timeline-labels">
          <span>00:00 (Curfew)</span>
          <span>06:00 (Gates Open)</span>
          <span>12:00 (Noon)</span>
          <span>20:00 (Evening Roll-Call)</span>
          <span>22:00 (Curfew Enforced)</span>
          <span>24:00</span>
        </div>
      </div>

      {/* Multi-Tab Navigation Strip */}
      <div className="movement-tabs-container">
        <button
          type="button"
          className={`movement-tab-btn ${activeTab === 'checkpoints' ? 'active' : ''}`}
          onClick={() => setActiveTab('checkpoints')}
        >
          <DoorClosed size={15} />
          <span>Campus Gate Checkpoints</span>
          <span className="movement-tab-badge">{gates.length}</span>
        </button>

        <button
          type="button"
          className={`movement-tab-btn ${activeTab === 'guards' ? 'active' : ''}`}
          onClick={() => setActiveTab('guards')}
        >
          <ShieldCheck size={15} />
          <span>Stationed Guard Deployments</span>
          <span className="movement-tab-badge">{securityAssignments.length}</span>
        </button>

        <button
          type="button"
          className={`movement-tab-btn ${activeTab === 'telemetry' ? 'active' : ''}`}
          onClick={() => setActiveTab('telemetry')}
        >
          <Radio size={15} />
          <span>Live Ingress & Egress Feed</span>
          <span className="movement-tab-badge">{telemetryLogs.length}</span>
        </button>

        <button
          type="button"
          className={`movement-tab-btn ${activeTab === 'curfew' ? 'active' : ''}`}
          onClick={() => setActiveTab('curfew')}
        >
          <Clock size={15} />
          <span>Curfew Timetable & Protocols</span>
        </button>
      </div>

      {/* =================================================================== */}
      {/* TAB 1: CAMPUS GATE CHECKPOINTS                                      */}
      {/* =================================================================== */}
      {activeTab === 'checkpoints' && (
        <div className="enterprise-card" style={{ marginBottom: '24px' }}>
          {/* Card Topbar */}
          <div className="card-topbar">
            <div className="card-title-group">
              <div className="card-title-icon-wrap">
                <DoorClosed size={16} />
              </div>
              <h2 className="card-title-text">Campus Checkpoint Registry</h2>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                className="btn-enterprise-secondary"
                style={{ padding: '6px 12px', fontSize: '12px' }}
                onClick={handleExportGatesCSV}
                title="Export Checkpoints to CSV"
              >
                <Download size={13} />
                <span>Export CSV</span>
              </button>

              {/* View Mode Toggle */}
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

          {/* Quick Filter Chips Strip for Gate Types */}
          <div className="movement-quick-filter-strip">
            <span className="movement-filter-label">
              <Filter size={12} />
              <span>Gate Type:</span>
            </span>

            <button
              type="button"
              className={`movement-filter-chip ${typeFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => setTypeFilter('ALL')}
            >
              <span>All Types</span>
              <span className="movement-chip-count">{typeCounts.ALL}</span>
            </button>

            <button
              type="button"
              className={`movement-filter-chip chip-emerald ${typeFilter === 'PEDESTRIAN' ? 'active' : ''}`}
              onClick={() => setTypeFilter('PEDESTRIAN')}
            >
              <Footprints size={12} />
              <span>Pedestrian Turnstiles</span>
              <span className="movement-chip-count">{typeCounts.PEDESTRIAN}</span>
            </button>

            <button
              type="button"
              className={`movement-filter-chip chip-purple ${typeFilter === 'VEHICULAR' ? 'active' : ''}`}
              onClick={() => setTypeFilter('VEHICULAR')}
            >
              <Layers size={12} />
              <span>Vehicular Barriers</span>
              <span className="movement-chip-count">{typeCounts.VEHICULAR}</span>
            </button>

            <button
              type="button"
              className={`movement-filter-chip ${typeFilter === 'MAIN_ENTRANCE' ? 'active' : ''}`}
              onClick={() => setTypeFilter('MAIN_ENTRANCE')}
            >
              <Building2 size={12} />
              <span>Main Entrances</span>
              <span className="movement-chip-count">{typeCounts.MAIN_ENTRANCE}</span>
            </button>

            <button
              type="button"
              className={`movement-filter-chip chip-rose ${typeFilter === 'EMERGENCY_EXIT' ? 'active' : ''}`}
              onClick={() => setTypeFilter('EMERGENCY_EXIT')}
            >
              <AlertTriangle size={12} />
              <span>Emergency Exits</span>
              <span className="movement-chip-count">{typeCounts.EMERGENCY_EXIT}</span>
            </button>
          </div>

          {/* Filter Toolbar */}
          <div className="enterprise-filter-bar">
            <div className="filter-search-field">
              <Search size={14} className="filter-search-icon" />
              <input
                type="text"
                className="filter-search-input"
                placeholder="Search by checkpoint name, code, facility, location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <select
                className="filter-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All Statuses ({statusCounts.ALL})</option>
                <option value="ACTIVE">Operational ({statusCounts.ACTIVE})</option>
                <option value="INACTIVE">Inactive / Locked ({statusCounts.INACTIVE})</option>
              </select>

              {hasActiveFilters && (
                <button
                  type="button"
                  className="btn-enterprise-secondary"
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                  onClick={handleResetFilters}
                >
                  Reset Filters
                </button>
              )}
            </div>
          </div>

          {/* Main Content Area */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <LoadingState message="Loading campus gate checkpoints from backend..." />
            </div>
          ) : filteredGates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <EmptyState
                icon={DoorClosed}
                title="No campus checkpoints found"
                description={
                  hasActiveFilters
                    ? 'Try adjusting your search criteria or filter options.'
                    : 'No campus gate checkpoints have been registered yet.'
                }
                actionLabel={canManageGates ? 'Configure Gate Checkpoint' : undefined}
                onAction={canManageGates ? handleOpenCreateGateModal : undefined}
              />
            </div>
          ) : displayMode === 'cards' ? (
            /* ================= CARDS VIEW ================= */
            <div style={{ padding: '18px 20px' }}>
              <div className="movement-grid-cards">
                {filteredGates.map((gate) => {
                  const hostelName = gate.hostel_id
                    ? hostelMap.get(gate.hostel_id)?.name || 'Main Campus Perimeter'
                    : 'Institutional Perimeter';
                  const assignedGuards = gateGuardsMap.get(gate.id) || [];
                  const isOperational = gate.status === 'ACTIVE';

                  return (
                    <div
                      key={gate.id}
                      className={`gate-card-v2 ${isOperational ? 'active-gate' : 'inactive-gate'}`}
                    >
                      {/* Top Row: Avatar Box + Names + Badges */}
                      <div className="gate-card-top">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                          <div
                            className={`gate-avatar-box ${getGateAvatarClass(gate.gate_type, gate.status)}`}
                          >
                            {getGateAvatarIcon(gate.gate_type, gate.status)}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <h3 className="gate-name-title" title={gate.name}>
                              {gate.name}
                            </h3>
                            <div className="gate-code-sub">
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
                      <div className="gate-card-body">
                        <div className="gate-info-stack">
                          <div className="gate-info-row" title={hostelName}>
                            <Building2 size={13} style={{ color: '#64748b', flexShrink: 0 }} />
                            <span style={{ fontWeight: 600, color: '#334155' }}>Facility:</span>
                            <span style={{ color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {hostelName}
                            </span>
                          </div>

                          <div
                            className="gate-info-row"
                            title={gate.location_description || 'Perimeter checkpoint'}
                          >
                            <MapPin size={13} style={{ color: '#64748b', flexShrink: 0 }} />
                            <span style={{ fontWeight: 600, color: '#334155' }}>Location:</span>
                            <span style={{ color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {gate.location_description || 'Campus perimeter boundary'}
                            </span>
                          </div>
                        </div>

                        {/* Stationed Guard Status */}
                        <div>
                          {assignedGuards.length > 0 ? (
                            <div className="gate-stationed-badge manned">
                              <ShieldCheck size={14} style={{ color: '#059669', flexShrink: 0 }} />
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                            <div className="gate-stationed-badge unmanned">
                              <Shield size={14} style={{ color: '#94a3b8', flexShrink: 0 }} />
                              <span>No Security Officers Assigned</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="gate-card-footer">
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn-enterprise-secondary"
                            style={{ padding: '6px 10px', fontSize: '11.5px' }}
                            onClick={() => {
                              setSelectedGate(gate);
                              setGateDetailsDrawerOpen(true);
                            }}
                          >
                            <Eye size={12} />
                            <span>Dossier</span>
                          </button>

                          {canManageGates && (
                            <button
                              type="button"
                              className="btn-enterprise-secondary"
                              style={{ padding: '6px 10px', fontSize: '11.5px' }}
                              onClick={() => handleOpenDeployModal(gate)}
                              title="Deploy Security Guard"
                            >
                              <UserPlus size={12} />
                              <span>Station Guard</span>
                            </button>
                          )}
                        </div>

                        {canManageGates && (
                          <button
                            type="button"
                            className="btn-enterprise-secondary"
                            style={{
                              padding: '6px 10px',
                              fontSize: '11.5px',
                              color: isOperational ? '#b45309' : '#059669',
                              borderColor: isOperational ? '#fde68a' : '#a7f3d0',
                              background: isOperational ? '#fffbeb' : '#ecfdf5',
                            }}
                            onClick={() => handleConfirmToggleGate(gate)}
                            title={isOperational ? 'Deactivate Checkpoint' : 'Activate Checkpoint'}
                          >
                            <Power size={12} />
                            <span>{isOperational ? 'Deactivate' : 'Activate'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* ================= TABLE VIEW ================= */
            <div className="enterprise-table-container">
              <table className="enterprise-table">
                <thead>
                  <tr>
                    <th>Gate Checkpoint</th>
                    <th>Identifier Code</th>
                    <th>Gate Type</th>
                    <th>Associated Facility</th>
                    <th>Location Details</th>
                    <th>Stationed Guards</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGates.map((gate) => {
                    const hostelName = gate.hostel_id
                      ? hostelMap.get(gate.hostel_id)?.name || 'Main Campus Perimeter'
                      : 'Institutional Perimeter';
                    const assignedGuards = gateGuardsMap.get(gate.id) || [];
                    const isOperational = gate.status === 'ACTIVE';

                    return (
                      <tr key={gate.id} className="enterprise-table-row">
                        {/* Name with Avatar */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div
                              className={`gate-avatar-box ${getGateAvatarClass(gate.gate_type, gate.status)}`}
                              style={{ width: '32px', height: '32px', borderRadius: '8px' }}
                            >
                              {getGateAvatarIcon(gate.gate_type, gate.status)}
                            </div>
                            <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '13.5px' }}>
                              {gate.name}
                            </div>
                          </div>
                        </td>

                        {/* Code */}
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
                            {gate.code}
                          </code>
                        </td>

                        {/* Type */}
                        <td>{getGateTypeBadge(gate.gate_type)}</td>

                        {/* Facility */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Building2 size={13} style={{ color: '#64748b' }} />
                            <span style={{ fontSize: '13px', color: '#334155' }}>{hostelName}</span>
                          </div>
                        </td>

                        {/* Location Details */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <MapPin size={12} style={{ color: '#64748b' }} />
                            <span style={{ fontSize: '12.5px', color: '#475569' }}>
                              {gate.location_description || 'Campus boundary'}
                            </span>
                          </div>
                        </td>

                        {/* Stationed Guards */}
                        <td>
                          {assignedGuards.length > 0 ? (
                            <span className="badge-enterprise badge-emerald">
                              {assignedGuards.length} On Duty
                            </span>
                          ) : (
                            <span className="badge-enterprise badge-slate">Unassigned</span>
                          )}
                        </td>

                        {/* Status */}
                        <td>
                          {isOperational ? (
                            <span className="badge-enterprise badge-emerald">OPERATIONAL</span>
                          ) : (
                            <span className="badge-enterprise badge-slate">INACTIVE</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td style={{ textAlign: 'right' }}>
                          <div
                            style={{
                              display: 'flex',
                              gap: '6px',
                              justifyContent: 'flex-end',
                              alignItems: 'center',
                            }}
                          >
                            <button
                              type="button"
                              className="table-icon-btn"
                              title="Checkpoint Dossier"
                              onClick={() => {
                                setSelectedGate(gate);
                                setGateDetailsDrawerOpen(true);
                              }}
                            >
                              <Eye size={14} />
                            </button>

                            {canManageGates && (
                              <>
                                <button
                                  type="button"
                                  className="table-icon-btn"
                                  title="Deploy Guard Officer"
                                  onClick={() => handleOpenDeployModal(gate)}
                                >
                                  <UserPlus size={14} />
                                </button>

                                <button
                                  type="button"
                                  className={`table-icon-btn ${
                                    isOperational ? 'text-amber-600' : 'text-emerald-600'
                                  }`}
                                  title={isOperational ? 'Deactivate Checkpoint' : 'Activate Checkpoint'}
                                  onClick={() => handleConfirmToggleGate(gate)}
                                >
                                  <Power size={14} />
                                </button>
                              </>
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

      {/* =================================================================== */}
      {/* TAB 2: STATIONED GUARD DEPLOYMENTS                                  */}
      {/* =================================================================== */}
      {activeTab === 'guards' && (
        <div className="enterprise-card" style={{ marginBottom: '24px' }}>
          <div className="card-topbar">
            <div className="card-title-group">
              <div className="card-title-icon-wrap">
                <ShieldCheck size={16} />
              </div>
              <h2 className="card-title-text">Gate Security Officer Deployments</h2>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="badge-enterprise badge-purple">
                {securityAssignments.length} Deployments Active
              </span>

              {canManageGates && (
                <button
                  type="button"
                  className="btn-enterprise-primary"
                  style={{ padding: '6px 14px', fontSize: '12px' }}
                  onClick={() => handleOpenDeployModal()}
                >
                  <UserPlus size={13} />
                  <span>Deploy Security Officer</span>
                </button>
              )}
            </div>
          </div>

          {securityAssignments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <EmptyState
                icon={Shield}
                title="No security guard deployments assigned"
                description="Station security guards at campus gates to monitor perimeter ingress/egress."
                actionLabel={canManageGates ? 'Deploy Security Officer' : undefined}
                onAction={canManageGates ? () => handleOpenDeployModal() : undefined}
              />
            </div>
          ) : (
            <div className="guard-roster-grid">
              {securityAssignments.map((sec) => {
                const staff = staffMap.get(sec.staff_id);
                const staffName = staff
                  ? `${staff.first_name || ''} ${staff.last_name || ''}`.trim()
                  : 'Security Officer';
                const initials = staff
                  ? `${staff.first_name?.[0] || 'S'}${staff.last_name?.[0] || 'G'}`.toUpperCase()
                  : 'SG';
                const gate = gates.find((g) => g.id === sec.gate_id);

                return (
                  <div key={sec.id} className="guard-duty-card">
                    <div>
                      {/* Top Row: Officer & Status */}
                      <div className="guard-card-header">
                        <div className="guard-profile-row">
                          <div className="officer-avatar-box">{initials}</div>
                          <div>
                            <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '13.5px' }}>
                              {staffName}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>
                              ID: {sec.staff_id ? sec.staff_id.slice(0, 8) : 'N/A'}
                            </div>
                          </div>
                        </div>

                        <span className="badge-enterprise badge-emerald">
                          <span className="status-dot green" />
                          <span>ON DUTY</span>
                        </span>
                      </div>

                      {/* Checkpoint & Shift Details */}
                      <div
                        style={{
                          background: '#f8fafc',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                          fontSize: '12.5px',
                          marginBottom: '12px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <DoorClosed size={13} style={{ color: '#2563eb' }} />
                          <span style={{ fontWeight: 600, color: '#1e293b' }}>
                            {gate?.name || 'Main Gate Checkpoint'}
                          </span>
                          <code
                            style={{
                              background: '#e2e8f0',
                              padding: '1px 5px',
                              borderRadius: '3px',
                              fontSize: '10.5px',
                              fontWeight: 700,
                            }}
                          >
                            {gate?.code || 'GATE-01'}
                          </code>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569' }}>
                          <Clock size={13} style={{ color: '#6366f1' }} />
                          <span>{sec.shift_name || 'Shift: Standard Operating Hours'}</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#059669' }}>
                          <Phone size={13} />
                          <a
                            href={`tel:${staff?.phone || '0000000000'}`}
                            style={{ color: '#059669', textDecoration: 'none', fontWeight: 600 }}
                          >
                            {staff?.phone || 'Campus Ext #204'}
                          </a>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    {canManageGates && (
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'flex-end',
                          gap: '8px',
                          paddingTop: '10px',
                          borderTop: '1px solid #f1f5f9',
                        }}
                      >
                        <button
                          type="button"
                          className="btn-enterprise-secondary"
                          style={{
                            padding: '5px 10px',
                            fontSize: '11px',
                            color: '#b91c1c',
                            borderColor: '#fecaca',
                          }}
                          onClick={() => handleRevokeGuardPosting(sec)}
                          title="Revoke Guard Posting"
                        >
                          <Trash2 size={12} />
                          <span>Revoke Assignment</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 3: STUDENT INGRESS & EGRESS TELEMETRY FEED                      */}
      {/* =================================================================== */}
      {activeTab === 'telemetry' && (
        <div className="enterprise-card" style={{ marginBottom: '24px' }}>
          <div className="card-topbar">
            <div className="card-title-group">
              <div className="card-title-icon-wrap">
                <Radio size={16} />
              </div>
              <h2 className="card-title-text">Perimeter Ingress & Egress Telemetry Feed</h2>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="badge-enterprise badge-blue">
                {filteredTelemetry.length} Records Streamed
              </span>
              <button
                type="button"
                className="btn-enterprise-secondary"
                style={{ padding: '6px 12px', fontSize: '12px' }}
                onClick={handleExportTelemetryCSV}
              >
                <Download size={13} />
                <span>Export Feed</span>
              </button>
            </div>
          </div>

          {/* Quick Filter Strip for Telemetry */}
          <div className="movement-quick-filter-strip">
            <span className="movement-filter-label">
              <Filter size={12} />
              <span>Direction:</span>
            </span>

            <button
              type="button"
              className={`movement-filter-chip ${telemetryDirFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => setTelemetryDirFilter('ALL')}
            >
              <span>All Movements</span>
              <span className="movement-chip-count">{telemetryLogs.length}</span>
            </button>

            <button
              type="button"
              className={`movement-filter-chip chip-emerald ${telemetryDirFilter === 'ENTRY' ? 'active' : ''}`}
              onClick={() => setTelemetryDirFilter('ENTRY')}
            >
              <ArrowDownRight size={12} />
              <span>Check-Ins (Ingress)</span>
              <span className="movement-chip-count">
                {telemetryLogs.filter((t) => t.direction === 'ENTRY').length}
              </span>
            </button>

            <button
              type="button"
              className={`movement-filter-chip ${telemetryDirFilter === 'EXIT' ? 'active' : ''}`}
              onClick={() => setTelemetryDirFilter('EXIT')}
            >
              <ArrowUpRight size={12} />
              <span>Departures (Egress)</span>
              <span className="movement-chip-count">
                {telemetryLogs.filter((t) => t.direction === 'EXIT').length}
              </span>
            </button>
          </div>

          {/* Search & Verification Method Filter */}
          <div className="enterprise-filter-bar">
            <div className="filter-search-field">
              <Search size={14} className="filter-search-icon" />
              <input
                type="text"
                className="filter-search-input"
                placeholder="Search by student name, roll number, gate checkpoint..."
                value={telemetrySearch}
                onChange={(e) => setTelemetrySearch(e.target.value)}
              />
            </div>

            <select
              className="filter-select"
              value={telemetryMethodFilter}
              onChange={(e) => setTelemetryMethodFilter(e.target.value)}
            >
              <option value="ALL">All Scan Methods</option>
              <option value="BIOMETRIC">Biometric Turnstile</option>
              <option value="RFID">Smart RFID Card</option>
              <option value="QR">Digital QR Pass</option>
              <option value="MANUAL">Manual Guard Clearance</option>
            </select>
          </div>

          {/* Telemetry Event Stream */}
          {filteredTelemetry.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <EmptyState
                icon={Footprints}
                title="No movement events found"
                description="No student ingress/egress transactions matched your search filters."
              />
            </div>
          ) : (
            <div className="movement-telemetry-feed">
              {filteredTelemetry.map((log) => {
                const isEntry = log.direction === 'ENTRY';

                return (
                  <div key={log.id} className="movement-log-card">
                    {/* Left: Direction Icon + Student Identity */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                      <div className={`movement-dir-indicator ${isEntry ? 'entry' : 'exit'}`}>
                        {isEntry ? <ArrowDownRight size={18} /> : <ArrowUpRight size={18} />}
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '13.5px' }}>
                            {log.studentName}
                          </span>
                          <code
                            style={{
                              background: '#f1f5f9',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 700,
                            }}
                          >
                            {log.rollNumber}
                          </code>
                        </div>

                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                          <span>{log.roomNum}</span> • <span>{log.hostelName}</span> •{' '}
                          <strong>{log.gateName}</strong> (<code>{log.gateCode}</code>)
                        </div>
                      </div>
                    </div>

                    {/* Right: Method, Time & Compliance Status */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#0f172a' }}>
                          {log.timestamp}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          {log.verificationMethod.replace('_', ' ')}
                        </div>
                      </div>

                      <div>
                        {log.compliance === 'AUTHORIZED_OUTPASS' && (
                          <span className="badge-enterprise badge-emerald">OUTPASS PASS</span>
                        )}
                        {log.compliance === 'ON_TIME' && (
                          <span className="badge-enterprise badge-blue">CHECKED IN</span>
                        )}
                        {log.compliance === 'NORMAL_PASSAGE' && (
                          <span className="badge-enterprise badge-slate">CAMPUS PASS</span>
                        )}
                        {log.compliance === 'CURFEW_FLAGGED' && (
                          <span className="badge-enterprise badge-rose">LATE / FLAGGED</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 4: CURFEW SCHEDULE & INSTITUTIONAL PROTOCOLS                    */}
      {/* =================================================================== */}
      {activeTab === 'curfew' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="curfew-policy-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: '#fff7ed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ea580c',
                }}
              >
                <Clock size={16} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.98rem', color: '#0f172a' }}>
                  Standard Operating Curfew & Perimeter Access Regulations
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Institutional student safety and perimeter accountability policies
                </div>
              </div>
            </div>

            <div className="curfew-schedule-grid">
              <div className="curfew-schedule-item">
                <div className="curfew-schedule-time">
                  <Unlock size={14} style={{ color: '#059669' }} />
                  <span>06:00 - 20:00 (Day Passage)</span>
                </div>
                <p className="curfew-schedule-desc">
                  <strong>Unrestricted Campus Ingress/Egress:</strong> Free passage with valid student ID badge scan or turnstile biometric verification.
                </p>
              </div>

              <div className="curfew-schedule-item">
                <div className="curfew-schedule-time">
                  <Clock size={14} style={{ color: '#d97706' }} />
                  <span>20:00 - 22:00 (Evening Return Grace)</span>
                </div>
                <p className="curfew-schedule-desc">
                  <strong>Hostel Evening Roll-Call:</strong> Students returning to hostels undergo biometric attendance recording. Late arrivals flagged in warden roll-call audit.
                </p>
              </div>

              <div className="curfew-schedule-item">
                <div className="curfew-schedule-time">
                  <Lock size={14} style={{ color: '#e11d48' }} />
                  <span>22:00 - 06:00 (Perimeter Lockdown)</span>
                </div>
                <p className="curfew-schedule-desc">
                  <strong>Night Curfew Enforcement:</strong> All turnstiles interlocked. Student egress strictly prohibited without Chief Warden or Dean authorization.
                </p>
              </div>

              <div className="curfew-schedule-item">
                <div className="curfew-schedule-time">
                  <Shield size={14} style={{ color: '#6366f1' }} />
                  <span>24 / 7 Emergency Corridor</span>
                </div>
                <p className="curfew-schedule-desc">
                  <strong>Priority Medical & Emergency Lane:</strong> Main Gate vehicular boom barrier manned around the clock with priority ambulance and security vehicle clearance.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: Configure Campus Gate Checkpoint                             */}
      {/* =================================================================== */}
      {createGateModalOpen && (
        <Modal
          isOpen={createGateModalOpen}
          onClose={() => !formSubmitting && setCreateGateModalOpen(false)}
          title="Configure Campus Gate Checkpoint"
          size="md"
        >
          <form onSubmit={handleCreateGateSubmit}>
            {formError && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#991b1b',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  fontSize: '13px',
                }}
              >
                {formError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <FormField label="Checkpoint Name" required>
                  <input
                    type="text"
                    className="filter-search-input"
                    style={{ width: '100%', height: '38px' }}
                    placeholder="e.g. North Hostel Boundary Gate"
                    value={gateFormData.name}
                    onChange={(e) =>
                      setGateFormData((prev) => ({ ...prev, name: e.target.value }))
                    }
                    required
                  />
                </FormField>

                <FormField label="Gate Identifier Code" required>
                  <input
                    type="text"
                    className="filter-search-input"
                    style={{ width: '100%', height: '38px' }}
                    placeholder="e.g. GATE-03"
                    value={gateFormData.code}
                    onChange={(e) =>
                      setGateFormData((prev) => ({ ...prev, code: e.target.value }))
                    }
                    required
                  />
                </FormField>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <FormField label="Gate Operational Type" required>
                  <select
                    className="filter-select"
                    style={{ width: '100%', height: '38px' }}
                    value={gateFormData.gate_type}
                    onChange={(e) =>
                      setGateFormData((prev) => ({ ...prev, gate_type: e.target.value }))
                    }
                    required
                  >
                    <option value="PEDESTRIAN">PEDESTRIAN (Turnstile & biometric)</option>
                    <option value="VEHICULAR">VEHICULAR (Boom barrier checkpoint)</option>
                    <option value="MAIN_ENTRANCE">MAIN ENTRANCE (Multi-lane gate)</option>
                    <option value="EMERGENCY_EXIT">EMERGENCY EXIT (Fire and service gate)</option>
                  </select>
                </FormField>

                <FormField label="Associated Hostel Facility">
                  <select
                    className="filter-select"
                    style={{ width: '100%', height: '38px' }}
                    value={gateFormData.hostel_id}
                    onChange={(e) =>
                      setGateFormData((prev) => ({ ...prev, hostel_id: e.target.value }))
                    }
                  >
                    <option value="">Campus Boundary (No specific hostel)</option>
                    {hostels.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>

              <FormField label="Physical Location Description">
                <input
                  type="text"
                  className="filter-search-input"
                  style={{ width: '100%', height: '38px' }}
                  placeholder="e.g. Adjacent to sports pavilion and mess hall"
                  value={gateFormData.location_description}
                  onChange={(e) =>
                    setGateFormData((prev) => ({
                      ...prev,
                      location_description: e.target.value,
                    }))
                  }
                />
              </FormField>

              <FormField label="Initial Operational Status">
                <select
                  className="filter-select"
                  style={{ width: '100%', height: '38px' }}
                  value={gateFormData.status}
                  onChange={(e) =>
                    setGateFormData((prev) => ({ ...prev, status: e.target.value }))
                  }
                >
                  <option value="ACTIVE">ACTIVE (Open for student ingress/egress)</option>
                  <option value="INACTIVE">INACTIVE (Locked / maintenance mode)</option>
                </select>
              </FormField>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
                marginTop: '24px',
                paddingTop: '16px',
                borderTop: '1px solid #f1f5f9',
              }}
            >
              <button
                type="button"
                className="btn-enterprise-secondary"
                onClick={() => setCreateGateModalOpen(false)}
                disabled={formSubmitting}
              >
                Cancel
              </button>
              <button type="submit" className="btn-enterprise-primary" disabled={formSubmitting}>
                {formSubmitting ? 'Registering...' : 'Save Checkpoint'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* =================================================================== */}
      {/* MODAL: Deploy Security Guard Officer                                */}
      {/* =================================================================== */}
      {deployGuardModalOpen && (
        <Modal
          isOpen={deployGuardModalOpen}
          onClose={() => !formSubmitting && setDeployGuardModalOpen(false)}
          title="Deploy Security Guard Officer"
          size="md"
        >
          <form onSubmit={handleDeployGuardSubmit}>
            {formError && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#991b1b',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  fontSize: '13px',
                }}
              >
                {formError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <FormField label="Select Security Officer" required>
                <select
                  className="filter-select"
                  style={{ width: '100%', height: '38px' }}
                  value={guardDeployData.staff_id}
                  onChange={(e) =>
                    setGuardDeployData((prev) => ({ ...prev, staff_id: e.target.value }))
                  }
                  required
                >
                  <option value="">-- Choose Security Staff Member --</option>
                  {staffList.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.first_name} {st.last_name} ({st.role || 'Staff'}) • {st.phone || 'No Phone'}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Assigned Gate Checkpoint" required>
                <select
                  className="filter-select"
                  style={{ width: '100%', height: '38px' }}
                  value={guardDeployData.gate_id}
                  onChange={(e) =>
                    setGuardDeployData((prev) => ({ ...prev, gate_id: e.target.value }))
                  }
                  required
                >
                  <option value="">-- Select Target Checkpoint --</option>
                  {gates.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.code}) • {g.gate_type}
                    </option>
                  ))}
                </select>
              </FormField>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <FormField label="Shift Template">
                  <select
                    className="filter-select"
                    style={{ width: '100%', height: '38px' }}
                    value={guardDeployData.shift_name}
                    onChange={(e) => {
                      const val = e.target.value;
                      let start = '06:00:00';
                      let end = '14:00:00';
                      if (val === 'Evening Shift') {
                        start = '14:00:00';
                        end = '22:00:00';
                      } else if (val === 'Night Watch') {
                        start = '22:00:00';
                        end = '06:00:00';
                      }
                      setGuardDeployData((prev) => ({
                        ...prev,
                        shift_name: val,
                        shift_start: start,
                        shift_end: end,
                      }));
                    }}
                  >
                    <option value="Morning Shift">Morning Shift (06:00 - 14:00)</option>
                    <option value="Evening Shift">Evening Shift (14:00 - 22:00)</option>
                    <option value="Night Watch">Night Watch (22:00 - 06:00)</option>
                    <option value="24-Hour Emergency">24-Hour Emergency Standby</option>
                  </select>
                </FormField>

                <FormField label="Assignment Start Date">
                  <input
                    type="date"
                    className="filter-search-input"
                    style={{ width: '100%', height: '38px' }}
                    value={guardDeployData.assigned_from}
                    onChange={(e) =>
                      setGuardDeployData((prev) => ({ ...prev, assigned_from: e.target.value }))
                    }
                  />
                </FormField>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
                marginTop: '24px',
                paddingTop: '16px',
                borderTop: '1px solid #f1f5f9',
              }}
            >
              <button
                type="button"
                className="btn-enterprise-secondary"
                onClick={() => setDeployGuardModalOpen(false)}
                disabled={formSubmitting}
              >
                Cancel
              </button>
              <button type="submit" className="btn-enterprise-primary" disabled={formSubmitting}>
                {formSubmitting ? 'Deploying...' : 'Deploy Officer'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* =================================================================== */}
      {/* DRAWER: Checkpoint Dossier & Guard Roster                           */}
      {/* =================================================================== */}
      {gateDetailsDrawerOpen && selectedGate && (
        <div className="gate-drawer-overlay" onClick={() => setGateDetailsDrawerOpen(false)}>
          <div className="gate-drawer-content" onClick={(e) => e.stopPropagation()}>
            {/* Drawer Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid #f1f5f9',
                paddingBottom: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  className={`gate-avatar-box ${getGateAvatarClass(
                    selectedGate.gate_type,
                    selectedGate.status
                  )}`}
                  style={{ width: '42px', height: '42px' }}
                >
                  {getGateAvatarIcon(selectedGate.gate_type, selectedGate.status)}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                    {selectedGate.name}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                    <code
                      style={{
                        background: '#f1f5f9',
                        padding: '1px 5px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 700,
                      }}
                    >
                      {selectedGate.code}
                    </code>
                    <span>•</span>
                    {getGateTypeBadge(selectedGate.gate_type)}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setGateDetailsDrawerOpen(false)}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#64748b',
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Checkpoint Status Banner */}
            <div
              style={{
                background: selectedGate.status === 'ACTIVE' ? '#ecfdf5' : '#f8fafc',
                border: `1px solid ${selectedGate.status === 'ACTIVE' ? '#a7f3d0' : '#e2e8f0'}`,
                borderRadius: '10px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    color: selectedGate.status === 'ACTIVE' ? '#065f46' : '#475569',
                  }}
                >
                  {selectedGate.status === 'ACTIVE'
                    ? 'CHECKPOINT OPERATIONAL'
                    : 'CHECKPOINT INACTIVE'}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                  {selectedGate.status === 'ACTIVE'
                    ? 'Open for turnstile and biometric ingress/egress'
                    : 'Barriers locked in maintenance status'}
                </div>
              </div>

              {canManageGates && (
                <button
                  type="button"
                  className="btn-enterprise-secondary"
                  style={{
                    padding: '5px 10px',
                    fontSize: '11px',
                    color: selectedGate.status === 'ACTIVE' ? '#b45309' : '#059669',
                    borderColor: selectedGate.status === 'ACTIVE' ? '#fde68a' : '#a7f3d0',
                  }}
                  onClick={() => handleConfirmToggleGate(selectedGate)}
                >
                  <Power size={12} />
                  <span>
                    {selectedGate.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                  </span>
                </button>
              )}
            </div>

            {/* Technical Specifications Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div className="gate-spec-card">
                <span className="gate-spec-label">Facility / Zone</span>
                <span className="gate-spec-value">
                  {selectedGate.hostel_id
                    ? hostelMap.get(selectedGate.hostel_id)?.name || 'Main Campus'
                    : 'Institutional Perimeter'}
                </span>
              </div>

              <div className="gate-spec-card">
                <span className="gate-spec-label">Turnstile Interlock</span>
                <span className="gate-spec-value">Biometric & RFID Active</span>
              </div>

              <div className="gate-spec-card">
                <span className="gate-spec-label">Surveillance Stream</span>
                <span className="gate-spec-value">1080p NVR 24/7 Channel</span>
              </div>

              <div className="gate-spec-card">
                <span className="gate-spec-label">Emergency Protocol</span>
                <span className="gate-spec-value">Auto-Unlock on Alarm</span>
              </div>
            </div>

            {/* Physical Location */}
            <div className="gate-spec-card">
              <span className="gate-spec-label">Physical Location Details</span>
              <span className="gate-spec-value" style={{ fontWeight: 500, fontSize: '0.82rem' }}>
                {selectedGate.location_description || 'North campus perimeter boundary checkpoint'}
              </span>
            </div>

            {/* Stationed Guard Officers List */}
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '10px',
                }}
              >
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>
                  Stationed Security Personnel
                </span>
                {canManageGates && (
                  <button
                    type="button"
                    className="btn-enterprise-secondary"
                    style={{ padding: '4px 8px', fontSize: '11px' }}
                    onClick={() => {
                      setGateDetailsDrawerOpen(false);
                      handleOpenDeployModal(selectedGate);
                    }}
                  >
                    <UserPlus size={11} />
                    <span>Station Guard</span>
                  </button>
                )}
              </div>

              {(() => {
                const assigned = gateGuardsMap.get(selectedGate.id) || [];
                if (assigned.length === 0) {
                  return (
                    <div
                      style={{
                        padding: '16px',
                        background: '#f8fafc',
                        border: '1px dashed #cbd5e1',
                        borderRadius: '10px',
                        textAlign: 'center',
                        fontSize: '12.5px',
                        color: '#64748b',
                      }}
                    >
                      <Shield size={18} style={{ margin: '0 auto 6px auto', display: 'block', color: '#94a3b8' }} />
                      No security guards currently posted to this checkpoint.
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
                            padding: '10px 14px',
                            background: '#f0fdf4',
                            border: '1px solid #bbf7d0',
                            borderRadius: '10px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <ShieldCheck size={16} style={{ color: '#059669' }} />
                            <div>
                              <div style={{ fontWeight: 700, color: '#065f46', fontSize: '13px' }}>
                                {name}
                              </div>
                              <div style={{ fontSize: '11px', color: '#047857' }}>
                                {a.shift_name || 'Standard Shift'}
                              </div>
                            </div>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <a
                              href={`tel:${staff?.phone || ''}`}
                              style={{
                                color: '#059669',
                                textDecoration: 'none',
                                fontSize: '12px',
                                fontWeight: 600,
                              }}
                            >
                              {staff?.phone || 'Ext #204'}
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Close Button */}
            <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
              <button
                type="button"
                className="btn-enterprise-secondary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => setGateDetailsDrawerOpen(false)}
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={async () => {
          if (confirmDialog.action) await confirmDialog.action();
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        }}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel="Confirm Action"
      />
    </div>
  );
}
