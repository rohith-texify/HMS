import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import adminService from '../services/adminService';
import { useAuth } from '../../../shared/auth/useAuth';
import {
  Users,
  Search,
  RefreshCw,
  Phone,
  Mail,
  UserCheck,
  Plus,
  Edit2,
  Trash2,
  Eye,
  ShieldCheck,
  ShieldAlert,
  UserX,
  Building2,
  BedDouble,
  Clock,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Lock,
  Calendar,
  FileText,
  DoorOpen,
  ArrowRight,
  Shield,
  Layers,
  Sparkles,
  Info,
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

export default function AdminStaffPage({ defaultTab = 'staff' }) {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Active Tab: 'staff', 'incharges', 'security', 'passwords'
  const activeTab = searchParams.get('tab') || defaultTab || 'staff';

  const setActiveTab = (tab) => {
    setSearchParams({ tab });
  };

  // Permission check
  const canManagePeople = useMemo(() => {
    if (!user) return true;
    if (['COLLEGE_ADMIN', 'ADMIN', 'HOSTEL_ADMIN'].includes(user?.role)) return true;
    if (Array.isArray(user?.permissions)) {
      return user.permissions.includes('people.manage') || user.permissions.includes('*');
    }
    return true;
  }, [user]);

  // =========================================================================
  // Master State
  // =========================================================================
  const [staffList, setStaffList] = useState([]);
  const [hostelsList, setHostelsList] = useState([]);
  const [inchargeAssignments, setInchargeAssignments] = useState([]); // [{ hostel, assignments: [] }]
  const [gatesList, setGatesList] = useState([]);
  const [securityAssignments, setSecurityAssignments] = useState([]);

  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successBanner, setSuccessBanner] = useState(null);

  // =========================================================================
  // TAB 1: Staff Directory Filters & State
  // =========================================================================
  const [staffSearch, setStaffSearch] = useState('');
  const [staffStatusFilter, setStaffStatusFilter] = useState('ALL');
  const [staffDesignationFilter, setStaffDesignationFilter] = useState('ALL');

  // Staff Modals
  const [createStaffOpen, setCreateStaffOpen] = useState(false);
  const [editStaffOpen, setEditStaffOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [profileDrawerOpen, setProfileDrawerOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);

  // Staff Form
  const [staffFormData, setStaffFormData] = useState({
    user_id: '',
    employee_number: '',
    first_name: '',
    middle_name: '',
    last_name: '',
    designation: '',
    department_id: '',
    phone: '',
    alternate_phone: '',
    email: '',
    joining_date: '',
    employment_status: 'ACTIVE',
  });
  const [newStaffStatus, setNewStaffStatus] = useState('ACTIVE');
  const [staffSubmitting, setStaffSubmitting] = useState(false);
  const [staffFormError, setStaffFormError] = useState(null);

  // =========================================================================
  // TAB 2: Hostel Incharge Modals & State
  // =========================================================================
  const [inchargeSearch, setInchargeSearch] = useState('');
  const [inchargeHostelFilter, setInchargeHostelFilter] = useState('ALL');
  const [assignInchargeOpen, setAssignInchargeOpen] = useState(false);
  const [editInchargeOpen, setEditInchargeOpen] = useState(false);
  const [deleteInchargeConfirmOpen, setDeleteInchargeConfirmOpen] = useState(false);
  const [selectedInchargeHostel, setSelectedInchargeHostel] = useState(null);
  const [selectedAssignment, setSelectedAssignment] = useState(null);

  const [inchargeFormData, setInchargeFormData] = useState({
    hostel_id: '',
    staff_id: '',
    is_primary: true,
    assigned_from: new Date().toISOString().split('T')[0],
    assigned_until: '',
  });
  const [inchargeSubmitting, setInchargeSubmitting] = useState(false);
  const [inchargeFormError, setInchargeFormError] = useState(null);

  // =========================================================================
  // TAB 3: Security Personnel & Gates Modals & State
  // =========================================================================
  const [securitySearch, setSecuritySearch] = useState('');
  const [securityGateFilter, setSecurityGateFilter] = useState('ALL');
  const [assignSecurityOpen, setAssignSecurityOpen] = useState(false);
  const [editSecurityOpen, setEditSecurityOpen] = useState(false);
  const [deleteSecurityConfirmOpen, setDeleteSecurityConfirmOpen] = useState(false);
  const [selectedSecurityAssignment, setSelectedSecurityAssignment] = useState(null);

  const [securityFormData, setSecurityFormData] = useState({
    staff_id: '',
    gate_id: '',
    shift_name: 'DAY_SHIFT',
    shift_start: '',
    shift_end: '',
    assigned_from: new Date().toISOString().split('T')[0],
    assigned_until: '',
    is_active: true,
  });
  const [securitySubmitting, setSecuritySubmitting] = useState(false);
  const [securityFormError, setSecurityFormError] = useState(null);

  // =========================================================================
  // TAB 4: Password & Account Management State
  // =========================================================================
  const [selectedPasswordStaff, setSelectedPasswordStaff] = useState(null);
  const [passwordFormData, setPasswordFormData] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState(null);

  // Auto-dismiss banner
  useEffect(() => {
    if (successBanner) {
      const timer = setTimeout(() => setSuccessBanner(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successBanner]);

  // =========================================================================
  // Data Fetching
  // =========================================================================
  const loadAllData = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    else setLoading(true);
    setErrorMessage(null);

    try {
      // 1. Fetch Staff
      const staffRes = await adminService.getStaff();
      const rawStaff = Array.isArray(staffRes) ? staffRes : staffRes?.staff || [];
      setStaffList(rawStaff);

      // 2. Fetch Hostels
      let rawHostels = [];
      try {
        const hostelsRes = await adminService.getHostels();
        rawHostels = Array.isArray(hostelsRes) ? hostelsRes : hostelsRes?.hostels || [];
        setHostelsList(rawHostels);
      } catch (err) {
        console.warn('Could not load hostels for incharges:', err);
      }

      // 3. Fetch Incharges per hostel
      if (rawHostels.length > 0) {
        try {
          const inchargeResults = await Promise.allSettled(
            rawHostels.map(async (h) => {
              const res = await adminService.getInchargeAssignments(h.id);
              const assignments = Array.isArray(res) ? res : res?.incharges || [];
              return { hostel: h, assignments };
            })
          );
          const mappedIncharges = inchargeResults
            .filter((r) => r.status === 'fulfilled')
            .map((r) => r.value);
          setInchargeAssignments(mappedIncharges);
        } catch (err) {
          console.warn('Failed to load hostel incharge details:', err);
        }
      }

      // 4. Fetch Gates
      let rawGates = [];
      try {
        const gatesRes = await adminService.getGates();
        rawGates = Array.isArray(gatesRes) ? gatesRes : gatesRes?.gates || [];
        setGatesList(rawGates);
      } catch (err) {
        console.warn('Could not load gates:', err);
      }

      // 5. Fetch Security Assignments
      try {
        const secRes = await adminService.getSecurityAssignments();
        const rawSec = Array.isArray(secRes) ? secRes : secRes?.assignments || [];
        setSecurityAssignments(rawSec);
      } catch (err) {
        console.warn('Could not load security assignments:', err);
      }
    } catch (err) {
      console.error('Error fetching staff data:', err);
      setErrorMessage(err.message || 'Failed to load staff roster and personnel assignments.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // =========================================================================
  // Computed Mappings & Lookups
  // =========================================================================
  const staffMap = useMemo(() => {
    const map = new Map();
    staffList.forEach((s) => map.set(s.id, s));
    return map;
  }, [staffList]);

  const hostelMap = useMemo(() => {
    const map = new Map();
    hostelsList.forEach((h) => map.set(h.id, h));
    return map;
  }, [hostelsList]);

  const gateMap = useMemo(() => {
    const map = new Map();
    gatesList.forEach((g) => map.set(g.id, g));
    return map;
  }, [gatesList]);

  // Format Helper
  const getStaffFullName = (s) => {
    if (!s) return 'Unknown Staff';
    const parts = [s.first_name, s.middle_name, s.last_name].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : s.name || 'Staff Member';
  };

  // =========================================================================
  // TAB 1: Filtered Staff List
  // =========================================================================
  const filteredStaff = useMemo(() => {
    return staffList.filter((s) => {
      if (staffStatusFilter !== 'ALL' && s.employment_status !== staffStatusFilter) {
        return false;
      }
      if (staffDesignationFilter !== 'ALL') {
        const des = (s.designation || '').toUpperCase();
        if (!des.includes(staffDesignationFilter)) return false;
      }
      if (!staffSearch.trim()) return true;

      const q = staffSearch.toLowerCase();
      const fullName = getStaffFullName(s).toLowerCase();
      const empNo = (s.employee_number || '').toLowerCase();
      const email = (s.email || '').toLowerCase();
      const phone = (s.phone || '').toLowerCase();
      const des = (s.designation || '').toLowerCase();

      return (
        fullName.includes(q) ||
        empNo.includes(q) ||
        email.includes(q) ||
        phone.includes(q) ||
        des.includes(q)
      );
    });
  }, [staffList, staffSearch, staffStatusFilter, staffDesignationFilter]);

  // Unique designations for filter dropdown
  const uniqueDesignations = useMemo(() => {
    const set = new Set();
    staffList.forEach((s) => {
      if (s.designation) set.add(s.designation.toUpperCase());
    });
    return Array.from(set);
  }, [staffList]);

  // =========================================================================
  // TAB 2: Filtered Incharge Hostels
  // =========================================================================
  const filteredIncharges = useMemo(() => {
    return inchargeAssignments.filter(({ hostel, assignments }) => {
      if (inchargeHostelFilter !== 'ALL' && hostel.id !== inchargeHostelFilter) {
        return false;
      }
      if (!inchargeSearch.trim()) return true;

      const q = inchargeSearch.toLowerCase();
      const hostelName = (hostel.name || '').toLowerCase();
      const hostelCode = (hostel.code || '').toLowerCase();

      // Check if any incharge matches
      const hasMatchingIncharge = assignments.some((a) => {
        const staff = staffMap.get(a.staff_id);
        if (!staff) return false;
        return (
          getStaffFullName(staff).toLowerCase().includes(q) ||
          (staff.employee_number || '').toLowerCase().includes(q) ||
          (staff.email || '').toLowerCase().includes(q)
        );
      });

      return hostelName.includes(q) || hostelCode.includes(q) || hasMatchingIncharge;
    });
  }, [inchargeAssignments, inchargeSearch, inchargeHostelFilter, staffMap]);

  // =========================================================================
  // TAB 3: Filtered Security Assignments
  // =========================================================================
  const filteredSecurityAssignments = useMemo(() => {
    return securityAssignments.filter((sec) => {
      if (securityGateFilter !== 'ALL' && sec.gate_id !== securityGateFilter) {
        return false;
      }
      if (!securitySearch.trim()) return true;

      const q = securitySearch.toLowerCase();
      const staff = staffMap.get(sec.staff_id);
      const gate = gateMap.get(sec.gate_id);

      const staffName = staff ? getStaffFullName(staff).toLowerCase() : '';
      const gateName = gate ? (gate.name || '').toLowerCase() : '';
      const shiftName = (sec.shift_name || '').toLowerCase();

      return staffName.includes(q) || gateName.includes(q) || shiftName.includes(q);
    });
  }, [securityAssignments, securitySearch, securityGateFilter, staffMap, gateMap]);

  // =========================================================================
  // Staff Handlers: Create, Edit, Status
  // =========================================================================
  const handleOpenCreateStaff = () => {
    // Generate pseudo-UUID if user wants to link to existing or new user
    const autoUUID = crypto.randomUUID ? crypto.randomUUID() : '10000000-0000-4000-8000-000000000001';
    setStaffFormData({
      user_id: autoUUID,
      employee_number: `EMP-${Math.floor(1000 + Math.random() * 9000)}`,
      first_name: '',
      middle_name: '',
      last_name: '',
      designation: 'Hostel Warden',
      department_id: '',
      phone: '',
      alternate_phone: '',
      email: '',
      joining_date: new Date().toISOString().split('T')[0],
      employment_status: 'ACTIVE',
    });
    setStaffFormError(null);
    setCreateStaffOpen(true);
  };

  const handleCreateStaffSubmit = async (e) => {
    e.preventDefault();
    if (!staffFormData.first_name.trim()) {
      setStaffFormError('First Name is strictly required.');
      return;
    }
    if (!staffFormData.user_id.trim()) {
      setStaffFormError('User Account ID (UUID) is required to associate credentials.');
      return;
    }

    setStaffSubmitting(true);
    setStaffFormError(null);

    try {
      const payload = {
        user_id: staffFormData.user_id.trim(),
        employee_number: staffFormData.employee_number.trim(),
        first_name: staffFormData.first_name.trim(),
        middle_name: staffFormData.middle_name.trim(),
        last_name: staffFormData.last_name.trim(),
        designation: staffFormData.designation.trim(),
        department_id: staffFormData.department_id.trim() || undefined,
        phone: staffFormData.phone.trim(),
        alternate_phone: staffFormData.alternate_phone.trim(),
        email: staffFormData.email.trim(),
        joining_date: staffFormData.joining_date.trim() || undefined,
        employment_status: staffFormData.employment_status,
      };

      await adminService.createStaff(payload);
      setSuccessBanner(`Staff member ${payload.first_name} ${payload.last_name} enrolled successfully.`);
      setCreateStaffOpen(false);
      loadAllData(true);
    } catch (err) {
      console.error('Error creating staff:', err);
      setStaffFormError(err.response?.data?.message || err.message || 'Failed to create staff member.');
    } finally {
      setStaffSubmitting(false);
    }
  };

  const handleOpenEditStaff = (staff) => {
    setSelectedStaff(staff);
    setStaffFormData({
      employee_number: staff.employee_number || '',
      first_name: staff.first_name || '',
      middle_name: staff.middle_name || '',
      last_name: staff.last_name || '',
      designation: staff.designation || '',
      phone: staff.phone || '',
      alternate_phone: staff.alternate_phone || '',
      email: staff.email || '',
      joining_date: staff.joining_date ? String(staff.joining_date).split('T')[0] : '',
    });
    setStaffFormError(null);
    setEditStaffOpen(true);
  };

  const handleEditStaffSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStaff) return;
    if (!staffFormData.first_name.trim()) {
      setStaffFormError('First Name is required.');
      return;
    }

    setStaffSubmitting(true);
    setStaffFormError(null);

    try {
      const payload = {
        employee_number: staffFormData.employee_number.trim(),
        first_name: staffFormData.first_name.trim(),
        middle_name: staffFormData.middle_name.trim(),
        last_name: staffFormData.last_name.trim(),
        designation: staffFormData.designation.trim(),
        phone: staffFormData.phone.trim(),
        alternate_phone: staffFormData.alternate_phone.trim(),
        email: staffFormData.email.trim(),
        joining_date: staffFormData.joining_date.trim() || undefined,
      };

      await adminService.updateStaff(selectedStaff.id, payload);
      setSuccessBanner(`Profile for ${payload.first_name} updated successfully.`);
      setEditStaffOpen(false);
      loadAllData(true);
    } catch (err) {
      console.error('Error updating staff:', err);
      setStaffFormError(err.response?.data?.message || err.message || 'Failed to update staff profile.');
    } finally {
      setStaffSubmitting(false);
    }
  };

  const handleOpenStatusModal = (staff) => {
    setSelectedStaff(staff);
    setNewStaffStatus(staff.employment_status || 'ACTIVE');
    setStaffFormError(null);
    setStatusModalOpen(true);
  };

  const handleUpdateStatusSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStaff) return;

    setStaffSubmitting(true);
    setStaffFormError(null);

    try {
      await adminService.updateStaffStatus(selectedStaff.id, newStaffStatus);
      setSuccessBanner(`Status for ${getStaffFullName(selectedStaff)} updated to ${newStaffStatus}.`);
      setStatusModalOpen(false);
      loadAllData(true);
    } catch (err) {
      console.error('Error changing staff status:', err);
      setStaffFormError(err.response?.data?.message || err.message || 'Failed to update status.');
    } finally {
      setStaffSubmitting(false);
    }
  };

  const handleOpenProfile = (staff) => {
    setSelectedStaff(staff);
    setProfileDrawerOpen(true);
  };

  // =========================================================================
  // Incharge Handlers: Create, Edit, Delete
  // =========================================================================
  const handleOpenAssignIncharge = (hostel) => {
    setSelectedInchargeHostel(hostel);
    setInchargeFormData({
      hostel_id: hostel?.id || '',
      staff_id: staffList[0]?.id || '',
      is_primary: true,
      assigned_from: new Date().toISOString().split('T')[0],
      assigned_until: '',
    });
    setInchargeFormError(null);
    setAssignInchargeOpen(true);
  };

  const handleAssignInchargeSubmit = async (e) => {
    e.preventDefault();
    if (!inchargeFormData.hostel_id) {
      setInchargeFormError('Hostel selection is required.');
      return;
    }
    if (!inchargeFormData.staff_id) {
      setInchargeFormError('Staff member selection is required.');
      return;
    }

    setInchargeSubmitting(true);
    setInchargeFormError(null);

    try {
      const payload = {
        staff_id: inchargeFormData.staff_id,
        is_primary: Boolean(inchargeFormData.is_primary),
        assigned_from: inchargeFormData.assigned_from,
        assigned_until: inchargeFormData.assigned_until ? inchargeFormData.assigned_until : null,
      };

      await adminService.createInchargeAssignment(inchargeFormData.hostel_id, payload);
      setSuccessBanner(`Incharge assignment recorded successfully.`);
      setAssignInchargeOpen(false);
      loadAllData(true);
    } catch (err) {
      console.error('Error assigning incharge:', err);
      setInchargeFormError(err.response?.data?.message || err.message || 'Failed to create incharge assignment.');
    } finally {
      setInchargeSubmitting(false);
    }
  };

  const handleOpenEditIncharge = (hostel, assignment) => {
    setSelectedInchargeHostel(hostel);
    setSelectedAssignment(assignment);
    setInchargeFormData({
      hostel_id: hostel.id,
      staff_id: assignment.staff_id,
      is_primary: assignment.is_primary,
      assigned_from: assignment.assigned_from ? String(assignment.assigned_from).split('T')[0] : '',
      assigned_until: assignment.assigned_until ? String(assignment.assigned_until).split('T')[0] : '',
    });
    setInchargeFormError(null);
    setEditInchargeOpen(true);
  };

  const handleEditInchargeSubmit = async (e) => {
    e.preventDefault();
    if (!selectedInchargeHostel || !selectedAssignment) return;

    setInchargeSubmitting(true);
    setInchargeFormError(null);

    try {
      const payload = {
        is_primary: Boolean(inchargeFormData.is_primary),
        assigned_from: inchargeFormData.assigned_from,
        assigned_until: inchargeFormData.assigned_until ? inchargeFormData.assigned_until : null,
      };

      await adminService.updateInchargeAssignment(
        selectedInchargeHostel.id,
        selectedAssignment.id,
        payload
      );
      setSuccessBanner(`Incharge assignment updated successfully.`);
      setEditInchargeOpen(false);
      loadAllData(true);
    } catch (err) {
      console.error('Error updating incharge assignment:', err);
      setInchargeFormError(err.response?.data?.message || err.message || 'Failed to update assignment.');
    } finally {
      setInchargeSubmitting(false);
    }
  };

  const handleOpenDeleteInchargeConfirm = (hostel, assignment) => {
    setSelectedInchargeHostel(hostel);
    setSelectedAssignment(assignment);
    setDeleteInchargeConfirmOpen(true);
  };

  const handleDeleteIncharge = async () => {
    if (!selectedInchargeHostel || !selectedAssignment) return;

    try {
      await adminService.deleteInchargeAssignment(
        selectedInchargeHostel.id,
        selectedAssignment.id
      );
      setSuccessBanner(`Incharge assignment removed.`);
      setDeleteInchargeConfirmOpen(false);
      loadAllData(true);
    } catch (err) {
      console.error('Error removing incharge assignment:', err);
      alert(err.response?.data?.message || err.message || 'Failed to remove assignment.');
    }
  };

  // =========================================================================
  // Security Handlers: Create, Edit, Delete
  // =========================================================================
  const handleOpenAssignSecurity = () => {
    setSecurityFormData({
      staff_id: staffList[0]?.id || '',
      gate_id: gatesList[0]?.id || '',
      shift_name: 'DAY_SHIFT',
      shift_start: '',
      shift_end: '',
      assigned_from: new Date().toISOString().split('T')[0],
      assigned_until: '',
      is_active: true,
    });
    setSecurityFormError(null);
    setAssignSecurityOpen(true);
  };

  const handleAssignSecuritySubmit = async (e) => {
    e.preventDefault();
    if (!securityFormData.staff_id) {
      setSecurityFormError('Security Personnel selection is required.');
      return;
    }
    if (!securityFormData.gate_id) {
      setSecurityFormError('Campus Gate selection is required.');
      return;
    }

    setSecuritySubmitting(true);
    setSecurityFormError(null);

    try {
      const payload = {
        staff_id: securityFormData.staff_id,
        gate_id: securityFormData.gate_id,
        shift_name: securityFormData.shift_name,
        shift_start: securityFormData.shift_start ? securityFormData.shift_start : null,
        shift_end: securityFormData.shift_end ? securityFormData.shift_end : null,
        assigned_from: securityFormData.assigned_from,
        assigned_until: securityFormData.assigned_until ? securityFormData.assigned_until : null,
        is_active: Boolean(securityFormData.is_active),
      };

      await adminService.createSecurityAssignment(payload);
      setSuccessBanner(`Security officer assigned to gate post successfully.`);
      setAssignSecurityOpen(false);
      loadAllData(true);
    } catch (err) {
      console.error('Error assigning security officer:', err);
      setSecurityFormError(err.response?.data?.message || err.message || 'Failed to assign security personnel.');
    } finally {
      setSecuritySubmitting(false);
    }
  };

  const handleOpenEditSecurity = (assignment) => {
    setSelectedSecurityAssignment(assignment);
    setSecurityFormData({
      staff_id: assignment.staff_id,
      gate_id: assignment.gate_id,
      shift_name: assignment.shift_name || 'DAY_SHIFT',
      shift_start: assignment.shift_start ? String(assignment.shift_start).split('T')[0] : '',
      shift_end: assignment.shift_end ? String(assignment.shift_end).split('T')[0] : '',
      assigned_from: assignment.assigned_from ? String(assignment.assigned_from).split('T')[0] : '',
      assigned_until: assignment.assigned_until ? String(assignment.assigned_until).split('T')[0] : '',
      is_active: assignment.is_active,
    });
    setSecurityFormError(null);
    setEditSecurityOpen(true);
  };

  const handleEditSecuritySubmit = async (e) => {
    e.preventDefault();
    if (!selectedSecurityAssignment) return;

    setSecuritySubmitting(true);
    setSecurityFormError(null);

    try {
      const payload = {
        shift_name: securityFormData.shift_name,
        shift_start: securityFormData.shift_start ? securityFormData.shift_start : null,
        shift_end: securityFormData.shift_end ? securityFormData.shift_end : null,
        assigned_from: securityFormData.assigned_from,
        assigned_until: securityFormData.assigned_until ? securityFormData.assigned_until : null,
        is_active: Boolean(securityFormData.is_active),
      };

      await adminService.updateSecurityAssignment(selectedSecurityAssignment.id, payload);
      setSuccessBanner(`Security gate assignment updated.`);
      setEditSecurityOpen(false);
      loadAllData(true);
    } catch (err) {
      console.error('Error updating security assignment:', err);
      setSecurityFormError(err.response?.data?.message || err.message || 'Failed to update assignment.');
    } finally {
      setSecuritySubmitting(false);
    }
  };

  const handleOpenDeleteSecurityConfirm = (assignment) => {
    setSelectedSecurityAssignment(assignment);
    setDeleteSecurityConfirmOpen(true);
  };

  const handleDeleteSecurity = async () => {
    if (!selectedSecurityAssignment) return;

    try {
      await adminService.deleteSecurityAssignment(selectedSecurityAssignment.id);
      setSuccessBanner(`Security assignment removed.`);
      setDeleteSecurityConfirmOpen(false);
      loadAllData(true);
    } catch (err) {
      console.error('Error removing security assignment:', err);
      alert(err.response?.data?.message || err.message || 'Failed to remove security assignment.');
    }
  };

  // =========================================================================
  // Password Management Handlers
  // =========================================================================
  const handleSelectStaffForPassword = (staff) => {
    setSelectedPasswordStaff(staff);
    setPasswordFormData({ newPassword: '', confirmPassword: '' });
    setPasswordFeedback(null);
  };

  const handlePasswordResetSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPasswordStaff) return;

    if (passwordFormData.newPassword.length < 8) {
      setPasswordFeedback({
        type: 'error',
        message: 'Password must be at least 8 characters long and contain letters and numbers.',
      });
      return;
    }

    if (passwordFormData.newPassword !== passwordFormData.confirmPassword) {
      setPasswordFeedback({
        type: 'error',
        message: 'The new password and confirmation password do not match.',
      });
      return;
    }

    setPasswordSubmitting(true);
    setPasswordFeedback(null);

    try {
      // Attempt API call to existing or upcoming backend reset endpoint
      await adminService.resetStaffPassword(selectedPasswordStaff.id, {
        password: passwordFormData.newPassword,
      });

      setPasswordFeedback({
        type: 'success',
        message: `Password for ${getStaffFullName(selectedPasswordStaff)} has been reset successfully.`,
      });
      // Clear password state immediately
      setPasswordFormData({ newPassword: '', confirmPassword: '' });
    } catch (err) {
      console.warn('Backend password reset route response:', err);
      // The Go backend router does not expose POST /college/staff/:id/reset-password
      // Per instructions: "If no authorized password reset API exists, provide a clearly labeled unavailable state and document the exact missing capability. Do not simulate success."
      setPasswordFeedback({
        type: 'warning',
        message:
          'Backend API Notice: Administrative password reset endpoint (`POST /college/staff/:id/reset-password`) is not currently exposed in the backend router. Account credentials cannot be overwritten until the backend authentication route is mounted.',
      });
      // Clear password state immediately for security
      setPasswordFormData({ newPassword: '', confirmPassword: '' });
    } finally {
      setPasswordSubmitting(false);
    }
  };

  // Status Badge Helper
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'ACTIVE':
        return <span className="badge-enterprise badge-green">ACTIVE</span>;
      case 'INACTIVE':
        return <span className="badge-enterprise badge-gray">INACTIVE</span>;
      case 'SUSPENDED':
        return <span className="badge-enterprise badge-red">SUSPENDED</span>;
      case 'RESIGNED':
        return <span className="badge-enterprise badge-orange">RESIGNED</span>;
      case 'TERMINATED':
        return <span className="badge-enterprise badge-red">TERMINATED</span>;
      case 'RETIRED':
        return <span className="badge-enterprise badge-blue">RETIRED</span>;
      default:
        return <span className="badge-enterprise badge-purple">{status || 'UNKNOWN'}</span>;
    }
  };

  // If initial load fails completely
  if (loading && staffList.length === 0) {
    return (
      <div className="fade-in-up" style={{ padding: '32px' }}>
        <LoadingState message="Loading staff directory, hostel incharge assignments, and gate personnel..." />
      </div>
    );
  }

  return (
    <div className="fade-in-up">
      {/* Page Header */}
      <div className="enterprise-hero-header">
        <div className="hero-header-titles">
          <div className="hero-category-pill">
            <Users size={13} />
            <span>Personnel & Access Administration</span>
          </div>
          <h1 className="hero-main-title">College Staff & Password Management</h1>
          <p className="hero-subtitle">
            Manage residential wardens, hostel in-charges, security gate personnel, and account credential security.
          </p>
        </div>

        <div className="hero-action-buttons">
          <button
            type="button"
            className="btn-enterprise-secondary"
            onClick={() => loadAllData(true)}
            disabled={isRefreshing}
          >
            <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} />
            <span>{isRefreshing ? 'Syncing...' : 'Sync Data'}</span>
          </button>

          {canManagePeople && activeTab === 'staff' && (
            <button
              type="button"
              className="btn-enterprise-primary"
              onClick={handleOpenCreateStaff}
            >
              <Plus size={15} />
              <span>Enroll Staff Member</span>
            </button>
          )}

          {canManagePeople && activeTab === 'incharges' && (
            <button
              type="button"
              className="btn-enterprise-primary"
              onClick={() => handleOpenAssignIncharge(hostelsList[0])}
              disabled={hostelsList.length === 0}
            >
              <Plus size={15} />
              <span>Assign Hostel Incharge</span>
            </button>
          )}

          {canManagePeople && activeTab === 'security' && (
            <button
              type="button"
              className="btn-enterprise-primary"
              onClick={handleOpenAssignSecurity}
              disabled={gatesList.length === 0}
            >
              <Plus size={15} />
              <span>Post Security Guard</span>
            </button>
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

      {/* Error State Banner */}
      {errorMessage && (
        <div style={{ marginBottom: '20px' }}>
          <ErrorState message={errorMessage} onRetry={() => loadAllData(true)} />
        </div>
      )}

      {/* KPI Stats Bar */}
      <div className="kpi-cards-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Total Staff Roster</span>
            <div className="stat-kpi-icon-wrap purple">
              <Users size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-purple-600">{staffList.length}</div>
          <div className="stat-kpi-footnote">
            <span className="status-dot green" />
            <span>Enrolled college personnel</span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Active Duty Staff</span>
            <div className="stat-kpi-icon-wrap green">
              <UserCheck size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-green-600">
            {staffList.filter((s) => s.employment_status === 'ACTIVE').length}
          </div>
          <div className="stat-kpi-footnote">
            <span>Currently on active status</span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Hostel In-Charges</span>
            <div className="stat-kpi-icon-wrap blue">
              <BedDouble size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-blue-600">
            {
              inchargeAssignments.reduce(
                (sum, h) => sum + (h.assignments ? h.assignments.length : 0),
                0
              )
            }
          </div>
          <div className="stat-kpi-footnote">
            <span>Primary & backup wardens</span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Security Gate Officers</span>
            <div className="stat-kpi-icon-wrap orange">
              <ShieldCheck size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-orange-600">
            {securityAssignments.filter((s) => s.is_active).length}
          </div>
          <div className="stat-kpi-footnote">
            <span>Active campus gate posts</span>
          </div>
        </div>
      </div>

      {/* Tab Navigation Controls */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid #e2e8f0',
          marginBottom: '20px',
          paddingBottom: '2px',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('staff')}
          style={{
            padding: '10px 18px',
            borderRadius: '8px 8px 0 0',
            fontWeight: 600,
            fontSize: '13.5px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            border: 'none',
            cursor: 'pointer',
            background: activeTab === 'staff' ? '#ffffff' : 'transparent',
            color: activeTab === 'staff' ? '#4f46e5' : '#64748b',
            borderBottom: activeTab === 'staff' ? '2px solid #4f46e5' : '2px solid transparent',
            transition: 'all 0.15s ease',
          }}
        >
          <Users size={16} />
          <span>Staff Directory</span>
          <span
            style={{
              padding: '2px 7px',
              borderRadius: '12px',
              fontSize: '11px',
              background: activeTab === 'staff' ? '#e0e7ff' : '#f1f5f9',
              color: activeTab === 'staff' ? '#4338ca' : '#64748b',
            }}
          >
            {staffList.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('incharges')}
          style={{
            padding: '10px 18px',
            borderRadius: '8px 8px 0 0',
            fontWeight: 600,
            fontSize: '13.5px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            border: 'none',
            cursor: 'pointer',
            background: activeTab === 'incharges' ? '#ffffff' : 'transparent',
            color: activeTab === 'incharges' ? '#4f46e5' : '#64748b',
            borderBottom: activeTab === 'incharges' ? '2px solid #4f46e5' : '2px solid transparent',
            transition: 'all 0.15s ease',
          }}
        >
          <BedDouble size={16} />
          <span>Hostel In-Charges</span>
          <span
            style={{
              padding: '2px 7px',
              borderRadius: '12px',
              fontSize: '11px',
              background: activeTab === 'incharges' ? '#e0e7ff' : '#f1f5f9',
              color: activeTab === 'incharges' ? '#4338ca' : '#64748b',
            }}
          >
            {hostelsList.length} Hostels
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('security')}
          style={{
            padding: '10px 18px',
            borderRadius: '8px 8px 0 0',
            fontWeight: 600,
            fontSize: '13.5px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            border: 'none',
            cursor: 'pointer',
            background: activeTab === 'security' ? '#ffffff' : 'transparent',
            color: activeTab === 'security' ? '#4f46e5' : '#64748b',
            borderBottom: activeTab === 'security' ? '2px solid #4f46e5' : '2px solid transparent',
            transition: 'all 0.15s ease',
          }}
        >
          <ShieldCheck size={16} />
          <span>Security Personnel & Gates</span>
          <span
            style={{
              padding: '2px 7px',
              borderRadius: '12px',
              fontSize: '11px',
              background: activeTab === 'security' ? '#e0e7ff' : '#f1f5f9',
              color: activeTab === 'security' ? '#4338ca' : '#64748b',
            }}
          >
            {securityAssignments.length} Posts
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('passwords')}
          style={{
            padding: '10px 18px',
            borderRadius: '8px 8px 0 0',
            fontWeight: 600,
            fontSize: '13.5px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            border: 'none',
            cursor: 'pointer',
            background: activeTab === 'passwords' ? '#ffffff' : 'transparent',
            color: activeTab === 'passwords' ? '#4f46e5' : '#64748b',
            borderBottom: activeTab === 'passwords' ? '2px solid #4f46e5' : '2px solid transparent',
            transition: 'all 0.15s ease',
          }}
        >
          <KeyRound size={16} />
          <span>Password & Account Security</span>
        </button>
      </div>

      {/* =================================================================== */}
      {/* TAB 1 CONTENT: Staff Directory                                      */}
      {/* =================================================================== */}
      {activeTab === 'staff' && (
        <div className="enterprise-card">
          <div className="card-topbar">
            <div className="card-title-group">
              <div className="card-title-icon-wrap">
                <Users size={16} />
              </div>
              <h2 className="card-title-text">Enrolled Staff Roster</h2>
            </div>
            <span className="badge-enterprise badge-purple">
              {filteredStaff.length} of {staffList.length} Active Profiles
            </span>
          </div>

          {/* Filter Toolbar */}
          <div className="enterprise-filter-bar">
            <div className="filter-search-field">
              <Search size={14} className="filter-search-icon" />
              <input
                type="text"
                className="filter-search-input"
                placeholder="Search staff by name, employee code, email, designation..."
                value={staffSearch}
                onChange={(e) => setStaffSearch(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <select
                className="filter-select"
                value={staffStatusFilter}
                onChange={(e) => setStaffStatusFilter(e.target.value)}
              >
                <option value="ALL">All Employment Statuses</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
                <option value="SUSPENDED">SUSPENDED</option>
                <option value="RESIGNED">RESIGNED</option>
                <option value="TERMINATED">TERMINATED</option>
                <option value="RETIRED">RETIRED</option>
              </select>

              <select
                className="filter-select"
                value={staffDesignationFilter}
                onChange={(e) => setStaffDesignationFilter(e.target.value)}
              >
                <option value="ALL">All Designations</option>
                {uniqueDesignations.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Staff Table */}
          <div className="enterprise-table-container">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Staff Member</th>
                  <th>Employee Code</th>
                  <th>Designation</th>
                  <th>Contact Details</th>
                  <th>Employment Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStaff.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '36px' }}>
                      <EmptyState
                        title="No staff records found"
                        message="No staff members match the selected criteria or search term."
                      />
                    </td>
                  </tr>
                ) : (
                  filteredStaff.map((s, idx) => (
                    <tr key={s.id || idx}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '34px',
                              height: '34px',
                              borderRadius: '8px',
                              background: '#ede9fe',
                              color: '#6d28d9',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '13px',
                            }}
                          >
                            {(s.first_name || 'S')[0].toUpperCase()}
                          </div>
                          <div>
                            <strong style={{ color: '#0f172a', display: 'block', fontSize: '13.5px' }}>
                              {getStaffFullName(s)}
                            </strong>
                            <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                              UUID: {s.user_id ? `${s.user_id.slice(0, 8)}...` : 'Unlinked'}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className="code-pill">
                          {s.employee_number || `EMP-${100 + idx}`}
                        </span>
                      </td>

                      <td>
                        <span className="badge-enterprise badge-purple">
                          {s.designation || 'Staff'}
                        </span>
                      </td>

                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '12.5px' }}>
                          {s.email && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#475569' }}>
                              <Mail size={12} style={{ color: '#94a3b8' }} />
                              <span>{s.email}</span>
                            </span>
                          )}
                          {s.phone && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#64748b' }}>
                              <Phone size={12} style={{ color: '#94a3b8' }} />
                              <span>{s.phone}</span>
                            </span>
                          )}
                          {!s.email && !s.phone && <span style={{ color: '#94a3b8' }}>No contact recorded</span>}
                        </div>
                      </td>

                      <td>{renderStatusBadge(s.employment_status)}</td>

                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn-icon"
                            title="View Full Profile"
                            onClick={() => handleOpenProfile(s)}
                          >
                            <Eye size={14} />
                          </button>

                          {canManagePeople && (
                            <>
                              <button
                                type="button"
                                className="btn-icon"
                                title="Edit Staff Record"
                                onClick={() => handleOpenEditStaff(s)}
                              >
                                <Edit2 size={14} />
                              </button>

                              <button
                                type="button"
                                className="btn-icon"
                                title="Change Employment Status"
                                onClick={() => handleOpenStatusModal(s)}
                              >
                                <UserX size={14} />
                              </button>

                              <button
                                type="button"
                                className="btn-icon"
                                title="Manage Password & Access"
                                onClick={() => {
                                  setSelectedPasswordStaff(s);
                                  setActiveTab('passwords');
                                }}
                              >
                                <KeyRound size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2 CONTENT: Hostel Incharges                                     */}
      {/* =================================================================== */}
      {activeTab === 'incharges' && (
        <div className="enterprise-card">
          <div className="card-topbar">
            <div className="card-title-group">
              <div className="card-title-icon-wrap">
                <BedDouble size={16} />
              </div>
              <h2 className="card-title-text">Hostel Incharge & Warden Assignments</h2>
            </div>
            <span className="badge-enterprise badge-blue">
              {inchargeAssignments.length} Hostels Monitored
            </span>
          </div>

          {/* Filter Toolbar */}
          <div className="enterprise-filter-bar">
            <div className="filter-search-field">
              <Search size={14} className="filter-search-icon" />
              <input
                type="text"
                className="filter-search-input"
                placeholder="Search by hostel name, code, or incharge warden name..."
                value={inchargeSearch}
                onChange={(e) => setInchargeSearch(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                className="filter-select"
                value={inchargeHostelFilter}
                onChange={(e) => setInchargeHostelFilter(e.target.value)}
              >
                <option value="ALL">All Hostels</option>
                {hostelsList.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name} ({h.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Hostels Incharges Table */}
          <div className="enterprise-table-container">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Hostel Facility</th>
                  <th>Primary Incharge</th>
                  <th>Backup Incharges</th>
                  <th>Assignment Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredIncharges.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '36px' }}>
                      <EmptyState
                        title="No hostel assignments found"
                        message="No incharge assignments exist matching the selected criteria."
                      />
                    </td>
                  </tr>
                ) : (
                  filteredIncharges.map(({ hostel, assignments }) => {
                    const primary = assignments.find((a) => a.is_primary);
                    const backups = assignments.filter((a) => !a.is_primary);
                    const primaryStaff = primary ? staffMap.get(primary.staff_id) : null;

                    return (
                      <tr key={hostel.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div
                              style={{
                                width: '34px',
                                height: '34px',
                                borderRadius: '8px',
                                background: '#dbeafe',
                                color: '#1d4ed8',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Building2 size={16} />
                            </div>
                            <div>
                              <strong style={{ color: '#0f172a', display: 'block' }}>{hostel.name}</strong>
                              <span className="code-pill" style={{ fontSize: '10.5px' }}>
                                {hostel.code} • {hostel.hostel_type || 'RESIDENTIAL'}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td>
                          {primaryStaff ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              <strong style={{ color: '#0f172a', fontSize: '13px' }}>
                                {getStaffFullName(primaryStaff)}
                              </strong>
                              <span style={{ fontSize: '11px', color: '#64748b' }}>
                                {primaryStaff.phone || primaryStaff.email || 'Verified Staff'}
                              </span>
                              <span style={{ fontSize: '10.5px', color: '#94a3b8' }}>
                                Since {primary.assigned_from ? String(primary.assigned_from).split('T')[0] : '—'}
                              </span>
                            </div>
                          ) : (
                            <span style={{ color: '#ef4444', fontSize: '12px', fontWeight: 500 }}>
                              No Primary Incharge Assigned
                            </span>
                          )}
                        </td>

                        <td>
                          {backups.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {backups.map((b) => {
                                const bStaff = staffMap.get(b.staff_id);
                                return (
                                  <div
                                    key={b.id}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      fontSize: '12px',
                                      color: '#475569',
                                    }}
                                  >
                                    <span className="badge-enterprise badge-gray" style={{ fontSize: '10px' }}>
                                      BACKUP
                                    </span>
                                    <span>{getStaffFullName(bStaff)}</span>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '12px' }}>None</span>
                          )}
                        </td>

                        <td>
                          {primaryStaff ? (
                            <span className="badge-enterprise badge-green">SUPERVISED</span>
                          ) : (
                            <span className="badge-enterprise badge-orange">UNSUPERVISED</span>
                          )}
                        </td>

                        <td>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            {canManagePeople && (
                              <>
                                <button
                                  type="button"
                                  className="btn-enterprise-secondary"
                                  style={{ padding: '4px 10px', fontSize: '12px' }}
                                  onClick={() => handleOpenAssignIncharge(hostel)}
                                  title="Add or Change Incharge"
                                >
                                  <Plus size={12} />
                                  <span>Assign</span>
                                </button>

                                {primary && (
                                  <button
                                    type="button"
                                    className="btn-icon"
                                    title="Edit Primary Incharge Assignment"
                                    onClick={() => handleOpenEditIncharge(hostel, primary)}
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                )}

                                {primary && (
                                  <button
                                    type="button"
                                    className="btn-icon danger"
                                    title="Remove Primary Incharge Assignment"
                                    onClick={() => handleOpenDeleteInchargeConfirm(hostel, primary)}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
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

      {/* =================================================================== */}
      {/* TAB 3 CONTENT: Security Personnel & Gates                          */}
      {/* =================================================================== */}
      {activeTab === 'security' && (
        <div className="enterprise-card">
          <div className="card-topbar">
            <div className="card-title-group">
              <div className="card-title-icon-wrap">
                <ShieldCheck size={16} />
              </div>
              <h2 className="card-title-text">Campus Security Personnel & Gate Posts</h2>
            </div>
            <span className="badge-enterprise badge-orange">
              {securityAssignments.length} Gate Assignments Active
            </span>
          </div>

          {/* Filter Toolbar */}
          <div className="enterprise-filter-bar">
            <div className="filter-search-field">
              <Search size={14} className="filter-search-icon" />
              <input
                type="text"
                className="filter-search-input"
                placeholder="Search security assignments by officer name, gate, or shift..."
                value={securitySearch}
                onChange={(e) => setSecuritySearch(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                className="filter-select"
                value={securityGateFilter}
                onChange={(e) => setSecurityGateFilter(e.target.value)}
              >
                <option value="ALL">All Campus Gates</option>
                {gatesList.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Security Table */}
          <div className="enterprise-table-container">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Security Officer</th>
                  <th>Assigned Gate Post</th>
                  <th>Shift & Timings</th>
                  <th>Assignment Period</th>
                  <th>Duty Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSecurityAssignments.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '36px' }}>
                      <EmptyState
                        title="No security assignments found"
                        message="No security officers are currently assigned to gate posts."
                      />
                    </td>
                  </tr>
                ) : (
                  filteredSecurityAssignments.map((sec) => {
                    const staff = staffMap.get(sec.staff_id);
                    const gate = gateMap.get(sec.gate_id);

                    return (
                      <tr key={sec.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div
                              style={{
                                width: '34px',
                                height: '34px',
                                borderRadius: '8px',
                                background: '#ffedd5',
                                color: '#c2410c',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Shield size={16} />
                            </div>
                            <div>
                              <strong style={{ color: '#0f172a', display: 'block' }}>
                                {getStaffFullName(staff)}
                              </strong>
                              <span style={{ fontSize: '11px', color: '#64748b' }}>
                                {staff?.phone || staff?.employee_number || 'Security Personnel'}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td>
                          <span style={{ fontWeight: 600, color: '#1e293b', display: 'block' }}>
                            {gate?.name || 'Main Campus Gate'}
                          </span>
                          <span className="code-pill" style={{ fontSize: '10.5px' }}>
                            {gate?.code || 'GATE-01'} • {gate?.gate_type || 'ENTRY_EXIT'}
                          </span>
                        </td>

                        <td>
                          <span className="badge-enterprise badge-purple" style={{ marginBottom: '2px' }}>
                            {sec.shift_name || 'GENERAL_SHIFT'}
                          </span>
                          {sec.shift_start && (
                            <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>
                              {String(sec.shift_start).split('T')[0]} - {sec.shift_end ? String(sec.shift_end).split('T')[0] : 'Open'}
                            </span>
                          )}
                        </td>

                        <td>
                          <span style={{ fontSize: '12px', color: '#475569' }}>
                            From: {sec.assigned_from ? String(sec.assigned_from).split('T')[0] : 'Immediate'}
                          </span>
                          {sec.assigned_until && (
                            <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block' }}>
                              Until: {String(sec.assigned_until).split('T')[0]}
                            </span>
                          )}
                        </td>

                        <td>
                          {sec.is_active ? (
                            <span className="badge-enterprise badge-green">ON POST</span>
                          ) : (
                            <span className="badge-enterprise badge-gray">OFF DUTY</span>
                          )}
                        </td>

                        <td>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            {canManagePeople && (
                              <>
                                <button
                                  type="button"
                                  className="btn-icon"
                                  title="Edit Security Assignment"
                                  onClick={() => handleOpenEditSecurity(sec)}
                                >
                                  <Edit2 size={13} />
                                </button>

                                <button
                                  type="button"
                                  className="btn-icon danger"
                                  title="Remove Security Assignment"
                                  onClick={() => handleOpenDeleteSecurityConfirm(sec)}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </>
                            )}
                          </div>
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

      {/* =================================================================== */}
      {/* TAB 4 CONTENT: Password & Account Security                          */}
      {/* =================================================================== */}
      {activeTab === 'passwords' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '24px' }}>
          {/* Left Column: Staff Account Selector */}
          <div className="enterprise-card">
            <div className="card-topbar">
              <div className="card-title-group">
                <div className="card-title-icon-wrap">
                  <Users size={16} />
                </div>
                <h2 className="card-title-text">Select Staff Account</h2>
              </div>
            </div>

            <div style={{ padding: '16px' }}>
              <input
                type="text"
                className="filter-search-input"
                style={{ width: '100%', marginBottom: '12px' }}
                placeholder="Search staff to manage credentials..."
                value={staffSearch}
                onChange={(e) => setStaffSearch(e.target.value)}
              />

              <div style={{ maxHeight: '450px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {filteredStaff.map((s) => {
                  const isSelected = selectedPasswordStaff?.id === s.id;
                  return (
                    <div
                      key={s.id}
                      onClick={() => handleSelectStaffForPassword(s)}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '8px',
                        border: isSelected ? '1px solid #6366f1' : '1px solid #e2e8f0',
                        background: isSelected ? '#f5f3ff' : '#ffffff',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong style={{ color: '#0f172a', fontSize: '13.5px', display: 'block' }}>
                            {getStaffFullName(s)}
                          </strong>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>
                            {s.email || s.phone || 'No direct contact'}
                          </span>
                        </div>
                        {renderStatusBadge(s.employment_status)}
                      </div>
                      <div style={{ marginTop: '6px', fontSize: '11px', color: '#94a3b8' }}>
                        Emp No: {s.employee_number || '—'} • {s.designation || 'Staff'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Password Reset Form & Security Protocol */}
          <div className="enterprise-card">
            <div className="card-topbar">
              <div className="card-title-group">
                <div className="card-title-icon-wrap">
                  <KeyRound size={16} />
                </div>
                <h2 className="card-title-text">Credential Overwrite & Password Recovery</h2>
              </div>
            </div>

            <div style={{ padding: '24px' }}>
              {selectedPasswordStaff ? (
                <>
                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '16px',
                      marginBottom: '20px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '8px',
                          background: '#ede9fe',
                          color: '#6d28d9',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '15px',
                        }}
                      >
                        {(selectedPasswordStaff.first_name || 'S')[0].toUpperCase()}
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '15px', color: '#0f172a' }}>
                          {getStaffFullName(selectedPasswordStaff)}
                        </h3>
                        <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                          Designation: {selectedPasswordStaff.designation || 'Staff Member'} • Code: {selectedPasswordStaff.employee_number || '—'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Architecture & Backend Notice */}
                  <div
                    style={{
                      background: '#fffbeb',
                      border: '1px solid #fde68a',
                      borderRadius: '8px',
                      padding: '14px',
                      marginBottom: '20px',
                      display: 'flex',
                      gap: '10px',
                      fontSize: '12.5px',
                      color: '#92400e',
                    }}
                  >
                    <Info size={18} style={{ color: '#d97706', flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <strong style={{ display: 'block', marginBottom: '2px' }}>
                        Backend Router Verification:
                      </strong>
                      Administrative password overwrite endpoint (`POST /college/staff/:id/reset-password`) is not currently mounted in the Go backend router. In accordance with strict data integrity rules, password operations are validated and dispatched without simulating false success.
                    </div>
                  </div>

                  {passwordFeedback && (
                    <div
                      style={{
                        padding: '12px 16px',
                        borderRadius: '8px',
                        marginBottom: '16px',
                        fontSize: '13px',
                        background:
                          passwordFeedback.type === 'success'
                            ? '#ecfdf5'
                            : passwordFeedback.type === 'warning'
                            ? '#fffbeb'
                            : '#fef2f2',
                        border:
                          passwordFeedback.type === 'success'
                            ? '1px solid #a7f3d0'
                            : passwordFeedback.type === 'warning'
                            ? '1px solid #fde68a'
                            : '1px solid #fecaca',
                        color:
                          passwordFeedback.type === 'success'
                            ? '#065f46'
                            : passwordFeedback.type === 'warning'
                            ? '#92400e'
                            : '#991b1b',
                      }}
                    >
                      {passwordFeedback.message}
                    </div>
                  )}

                  <form onSubmit={handlePasswordResetSubmit}>
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                        New Temporary / Permanent Password
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          className="filter-search-input"
                          style={{ width: '100%', paddingRight: '70px' }}
                          value={passwordFormData.newPassword}
                          onChange={(e) =>
                            setPasswordFormData({ ...passwordFormData, newPassword: e.target.value })
                          }
                          placeholder="Minimum 8 characters"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          style={{
                            position: 'absolute',
                            right: '8px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'none',
                            border: 'none',
                            fontSize: '11px',
                            color: '#6366f1',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          {showPassword ? 'Hide' : 'Show'}
                        </button>
                      </div>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                        Confirm Password
                      </label>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className="filter-search-input"
                        style={{ width: '100%' }}
                        value={passwordFormData.confirmPassword}
                        onChange={(e) =>
                          setPasswordFormData({ ...passwordFormData, confirmPassword: e.target.value })
                        }
                        placeholder="Re-enter password"
                        required
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                      <button
                        type="button"
                        className="btn-enterprise-secondary"
                        onClick={() => {
                          setPasswordFormData({ newPassword: '', confirmPassword: '' });
                          setPasswordFeedback(null);
                        }}
                      >
                        Clear Fields
                      </button>

                      <button
                        type="submit"
                        className="btn-enterprise-primary"
                        disabled={passwordSubmitting || !canManagePeople}
                      >
                        <Lock size={14} />
                        <span>{passwordSubmitting ? 'Verifying with Backend...' : 'Submit Password Reset'}</span>
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <EmptyState
                  title="No staff account selected"
                  message="Please select a staff member from the left list to review their account status or initiate a credential reset."
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: Create Staff Member                                          */}
      {/* =================================================================== */}
      {createStaffOpen && (
        <Modal
          isOpen={createStaffOpen}
          onClose={() => setCreateStaffOpen(false)}
          title="Enroll New College Staff Member"
        >
          {staffFormError && (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                marginBottom: '16px',
              }}
            >
              {staffFormError}
            </div>
          )}

          <form onSubmit={handleCreateStaffSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  User Account UUID *
                </label>
                <input
                  type="text"
                  className="filter-search-input"
                  style={{ width: '100%', fontSize: '12px' }}
                  value={staffFormData.user_id}
                  onChange={(e) => setStaffFormData({ ...staffFormData, user_id: e.target.value })}
                  placeholder="UUID (e.g. 10000000-0000-4000...)"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Employee Number
                </label>
                <input
                  type="text"
                  className="filter-search-input"
                  style={{ width: '100%', fontSize: '12px' }}
                  value={staffFormData.employee_number}
                  onChange={(e) => setStaffFormData({ ...staffFormData, employee_number: e.target.value })}
                  placeholder="e.g. EMP-1042"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  First Name *
                </label>
                <input
                  type="text"
                  className="filter-search-input"
                  style={{ width: '100%', fontSize: '12px' }}
                  value={staffFormData.first_name}
                  onChange={(e) => setStaffFormData({ ...staffFormData, first_name: e.target.value })}
                  placeholder="First name"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Middle Name
                </label>
                <input
                  type="text"
                  className="filter-search-input"
                  style={{ width: '100%', fontSize: '12px' }}
                  value={staffFormData.middle_name}
                  onChange={(e) => setStaffFormData({ ...staffFormData, middle_name: e.target.value })}
                  placeholder="Optional"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Last Name
                </label>
                <input
                  type="text"
                  className="filter-search-input"
                  style={{ width: '100%', fontSize: '12px' }}
                  value={staffFormData.last_name}
                  onChange={(e) => setStaffFormData({ ...staffFormData, last_name: e.target.value })}
                  placeholder="Last name"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Designation / Role
                </label>
                <input
                  type="text"
                  className="filter-search-input"
                  style={{ width: '100%', fontSize: '12px' }}
                  value={staffFormData.designation}
                  onChange={(e) => setStaffFormData({ ...staffFormData, designation: e.target.value })}
                  placeholder="e.g. Chief Warden, Hostel Incharge, Security Guard"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Employment Status
                </label>
                <select
                  className="filter-select"
                  style={{ width: '100%' }}
                  value={staffFormData.employment_status}
                  onChange={(e) => setStaffFormData({ ...staffFormData, employment_status: e.target.value })}
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                  <option value="SUSPENDED">SUSPENDED</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  className="filter-search-input"
                  style={{ width: '100%', fontSize: '12px' }}
                  value={staffFormData.email}
                  onChange={(e) => setStaffFormData({ ...staffFormData, email: e.target.value })}
                  placeholder="staff@college.edu"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Primary Phone
                </label>
                <input
                  type="tel"
                  className="filter-search-input"
                  style={{ width: '100%', fontSize: '12px' }}
                  value={staffFormData.phone}
                  onChange={(e) => setStaffFormData({ ...staffFormData, phone: e.target.value })}
                  placeholder="+91 9876543210"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Alternate Phone
                </label>
                <input
                  type="tel"
                  className="filter-search-input"
                  style={{ width: '100%', fontSize: '12px' }}
                  value={staffFormData.alternate_phone}
                  onChange={(e) => setStaffFormData({ ...staffFormData, alternate_phone: e.target.value })}
                  placeholder="Optional alternate"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Joining Date
                </label>
                <input
                  type="date"
                  className="filter-search-input"
                  style={{ width: '100%', fontSize: '12px' }}
                  value={staffFormData.joining_date}
                  onChange={(e) => setStaffFormData({ ...staffFormData, joining_date: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn-enterprise-secondary"
                onClick={() => setCreateStaffOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-enterprise-primary"
                disabled={staffSubmitting}
              >
                {staffSubmitting ? 'Enrolling...' : 'Enroll Staff'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* =================================================================== */}
      {/* MODAL: Edit Staff Member                                            */}
      {/* =================================================================== */}
      {editStaffOpen && (
        <Modal
          isOpen={editStaffOpen}
          onClose={() => setEditStaffOpen(false)}
          title={`Edit Staff Profile — ${getStaffFullName(selectedStaff)}`}
        >
          {staffFormError && (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                marginBottom: '16px',
              }}
            >
              {staffFormError}
            </div>
          )}

          <form onSubmit={handleEditStaffSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  First Name *
                </label>
                <input
                  type="text"
                  className="filter-search-input"
                  style={{ width: '100%', fontSize: '12px' }}
                  value={staffFormData.first_name}
                  onChange={(e) => setStaffFormData({ ...staffFormData, first_name: e.target.value })}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Middle Name
                </label>
                <input
                  type="text"
                  className="filter-search-input"
                  style={{ width: '100%', fontSize: '12px' }}
                  value={staffFormData.middle_name}
                  onChange={(e) => setStaffFormData({ ...staffFormData, middle_name: e.target.value })}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Last Name
                </label>
                <input
                  type="text"
                  className="filter-search-input"
                  style={{ width: '100%', fontSize: '12px' }}
                  value={staffFormData.last_name}
                  onChange={(e) => setStaffFormData({ ...staffFormData, last_name: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Employee Number
                </label>
                <input
                  type="text"
                  className="filter-search-input"
                  style={{ width: '100%', fontSize: '12px' }}
                  value={staffFormData.employee_number}
                  onChange={(e) => setStaffFormData({ ...staffFormData, employee_number: e.target.value })}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Designation
                </label>
                <input
                  type="text"
                  className="filter-search-input"
                  style={{ width: '100%', fontSize: '12px' }}
                  value={staffFormData.designation}
                  onChange={(e) => setStaffFormData({ ...staffFormData, designation: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Email
                </label>
                <input
                  type="email"
                  className="filter-search-input"
                  style={{ width: '100%', fontSize: '12px' }}
                  value={staffFormData.email}
                  onChange={(e) => setStaffFormData({ ...staffFormData, email: e.target.value })}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Phone
                </label>
                <input
                  type="tel"
                  className="filter-search-input"
                  style={{ width: '100%', fontSize: '12px' }}
                  value={staffFormData.phone}
                  onChange={(e) => setStaffFormData({ ...staffFormData, phone: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Alternate Phone
                </label>
                <input
                  type="tel"
                  className="filter-search-input"
                  style={{ width: '100%', fontSize: '12px' }}
                  value={staffFormData.alternate_phone}
                  onChange={(e) => setStaffFormData({ ...staffFormData, alternate_phone: e.target.value })}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Joining Date
                </label>
                <input
                  type="date"
                  className="filter-search-input"
                  style={{ width: '100%', fontSize: '12px' }}
                  value={staffFormData.joining_date}
                  onChange={(e) => setStaffFormData({ ...staffFormData, joining_date: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn-enterprise-secondary"
                onClick={() => setEditStaffOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-enterprise-primary"
                disabled={staffSubmitting}
              >
                {staffSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* =================================================================== */}
      {/* MODAL: Update Staff Status                                          */}
      {/* =================================================================== */}
      {statusModalOpen && (
        <Modal
          isOpen={statusModalOpen}
          onClose={() => setStatusModalOpen(false)}
          title={`Update Employment Status — ${getStaffFullName(selectedStaff)}`}
        >
          {staffFormError && (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                marginBottom: '16px',
              }}
            >
              {staffFormError}
            </div>
          )}

          <form onSubmit={handleUpdateStatusSubmit}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Select New Status
              </label>
              <select
                className="filter-select"
                style={{ width: '100%' }}
                value={newStaffStatus}
                onChange={(e) => setNewStaffStatus(e.target.value)}
              >
                <option value="ACTIVE">ACTIVE (On Active Duty)</option>
                <option value="INACTIVE">INACTIVE (Temporarily Inactive)</option>
                <option value="SUSPENDED">SUSPENDED (Disciplinary Hold)</option>
                <option value="RESIGNED">RESIGNED (Voluntary Exit)</option>
                <option value="TERMINATED">TERMINATED (Involuntary Exit)</option>
                <option value="RETIRED">RETIRED (Honorable Retirement)</option>
              </select>
            </div>

            <div
              style={{
                background: '#fffbeb',
                border: '1px solid #fef3c7',
                padding: '12px',
                borderRadius: '8px',
                fontSize: '12.5px',
                color: '#92400e',
                marginBottom: '20px',
              }}
            >
              <strong>Note:</strong> Status changes affect institutional portal access and assignment eligibility in real-time. Deactivation does not delete records.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn-enterprise-secondary"
                onClick={() => setStatusModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-enterprise-primary"
                disabled={staffSubmitting}
              >
                {staffSubmitting ? 'Updating...' : 'Update Status'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* =================================================================== */}
      {/* DRAWER: Staff Profile & Assigned Duties                             */}
      {/* =================================================================== */}
      {profileDrawerOpen && selectedStaff && (
        <Modal
          isOpen={profileDrawerOpen}
          onClose={() => setProfileDrawerOpen(false)}
          title={`Staff Dossier: ${getStaffFullName(selectedStaff)}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Header pill */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                padding: '16px',
                borderRadius: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>
                  {getStaffFullName(selectedStaff)}
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748b' }}>
                  {selectedStaff.designation || 'Staff'} • Code: {selectedStaff.employee_number || '—'}
                </p>
              </div>
              {renderStatusBadge(selectedStaff.employment_status)}
            </div>

            {/* Profile fields */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', fontSize: '13px' }}>
              <div>
                <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>Email</span>
                <strong style={{ color: '#0f172a' }}>{selectedStaff.email || '—'}</strong>
              </div>

              <div>
                <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>Phone</span>
                <strong style={{ color: '#0f172a' }}>{selectedStaff.phone || '—'}</strong>
              </div>

              <div>
                <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>Alternate Phone</span>
                <strong style={{ color: '#0f172a' }}>{selectedStaff.alternate_phone || '—'}</strong>
              </div>

              <div>
                <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>Joining Date</span>
                <strong style={{ color: '#0f172a' }}>
                  {selectedStaff.joining_date ? String(selectedStaff.joining_date).split('T')[0] : '—'}
                </strong>
              </div>

              <div>
                <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>User Account ID</span>
                <code style={{ fontSize: '11.5px', color: '#4338ca' }}>
                  {selectedStaff.user_id || 'Not Linked'}
                </code>
              </div>

              <div>
                <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>Tenant College ID</span>
                <code style={{ fontSize: '11.5px', color: '#475569' }}>
                  {selectedStaff.college_id ? `${String(selectedStaff.college_id).slice(0, 13)}...` : '—'}
                </code>
              </div>
            </div>

            {/* Assignments Summary */}
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '14px' }}>
              <h4 style={{ margin: '0 0 10px', fontSize: '13px', color: '#334155' }}>
                Residential & Security Duties
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {inchargeAssignments
                  .filter((h) => h.assignments.some((a) => a.staff_id === selectedStaff.id))
                  .map(({ hostel, assignments }) => {
                    const match = assignments.find((a) => a.staff_id === selectedStaff.id);
                    return (
                      <div
                        key={hostel.id}
                        style={{
                          background: '#eff6ff',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <strong>{hostel.name}</strong>
                          <span style={{ color: '#64748b', marginLeft: '6px' }}>({hostel.code})</span>
                        </div>
                        <span className="badge-enterprise badge-blue">
                          {match.is_primary ? 'PRIMARY INCHARGE' : 'BACKUP INCHARGE'}
                        </span>
                      </div>
                    );
                  })}

                {securityAssignments
                  .filter((sec) => sec.staff_id === selectedStaff.id)
                  .map((sec) => {
                    const gate = gateMap.get(sec.gate_id);
                    return (
                      <div
                        key={sec.id}
                        style={{
                          background: '#fff7ed',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <strong>Gate Post: {gate?.name || 'Campus Gate'}</strong>
                          <span style={{ color: '#64748b', marginLeft: '6px' }}>({sec.shift_name})</span>
                        </div>
                        <span className="badge-enterprise badge-orange">
                          {sec.is_active ? 'ACTIVE POST' : 'OFF DUTY'}
                        </span>
                      </div>
                    );
                  })}

                {!inchargeAssignments.some((h) => h.assignments.some((a) => a.staff_id === selectedStaff.id)) &&
                  !securityAssignments.some((sec) => sec.staff_id === selectedStaff.id) && (
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                      No active hostel incharge or gate posts currently assigned.
                    </span>
                  )}
              </div>
            </div>

            {/* Audit History Box */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px dashed #cbd5e1',
                borderRadius: '6px',
                padding: '12px',
                fontSize: '12px',
                color: '#64748b',
              }}
            >
              <strong style={{ display: 'block', color: '#475569', marginBottom: '4px' }}>
                Staff Activity Audit Trail:
              </strong>
              Unavailable / Awaiting Backend Handler. Historical duty logs and activity audits are not yet exposed by the API router.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
              <button
                type="button"
                className="btn-enterprise-secondary"
                onClick={() => setProfileDrawerOpen(false)}
              >
                Close Dossier
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* =================================================================== */}
      {/* MODAL: Assign Hostel Incharge                                       */}
      {/* =================================================================== */}
      {assignInchargeOpen && (
        <Modal
          isOpen={assignInchargeOpen}
          onClose={() => setAssignInchargeOpen(false)}
          title={`Assign Incharge for ${selectedInchargeHostel?.name || 'Hostel'}`}
        >
          {inchargeFormError && (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                marginBottom: '16px',
              }}
            >
              {inchargeFormError}
            </div>
          )}

          <form onSubmit={handleAssignInchargeSubmit}>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Target Hostel Facility
              </label>
              <select
                className="filter-select"
                style={{ width: '100%' }}
                value={inchargeFormData.hostel_id}
                onChange={(e) => setInchargeFormData({ ...inchargeFormData, hostel_id: e.target.value })}
              >
                {hostelsList.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name} ({h.code})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Select Staff Member *
              </label>
              <select
                className="filter-select"
                style={{ width: '100%' }}
                value={inchargeFormData.staff_id}
                onChange={(e) => setInchargeFormData({ ...inchargeFormData, staff_id: e.target.value })}
                required
              >
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {getStaffFullName(s)} ({s.employee_number || 'No Code'} - {s.designation || 'Staff'})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={inchargeFormData.is_primary}
                  onChange={(e) => setInchargeFormData({ ...inchargeFormData, is_primary: e.target.checked })}
                />
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                  Designate as Primary Hostel Incharge
                </span>
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Assigned From
                </label>
                <input
                  type="date"
                  className="filter-search-input"
                  style={{ width: '100%', fontSize: '12px' }}
                  value={inchargeFormData.assigned_from}
                  onChange={(e) => setInchargeFormData({ ...inchargeFormData, assigned_from: e.target.value })}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Assigned Until (Optional)
                </label>
                <input
                  type="date"
                  className="filter-search-input"
                  style={{ width: '100%', fontSize: '12px' }}
                  value={inchargeFormData.assigned_until}
                  onChange={(e) => setInchargeFormData({ ...inchargeFormData, assigned_until: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn-enterprise-secondary"
                onClick={() => setAssignInchargeOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-enterprise-primary"
                disabled={inchargeSubmitting}
              >
                {inchargeSubmitting ? 'Recording...' : 'Save Incharge Assignment'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* =================================================================== */}
      {/* MODAL: Edit Incharge Assignment                                     */}
      {/* =================================================================== */}
      {editInchargeOpen && (
        <Modal
          isOpen={editInchargeOpen}
          onClose={() => setEditInchargeOpen(false)}
          title="Update Incharge Assignment Dates & Designation"
        >
          {inchargeFormError && (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                marginBottom: '16px',
              }}
            >
              {inchargeFormError}
            </div>
          )}

          <form onSubmit={handleEditInchargeSubmit}>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={inchargeFormData.is_primary}
                  onChange={(e) => setInchargeFormData({ ...inchargeFormData, is_primary: e.target.checked })}
                />
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                  Primary Incharge Designation
                </span>
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Assigned From
                </label>
                <input
                  type="date"
                  className="filter-search-input"
                  style={{ width: '100%', fontSize: '12px' }}
                  value={inchargeFormData.assigned_from}
                  onChange={(e) => setInchargeFormData({ ...inchargeFormData, assigned_from: e.target.value })}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Assigned Until
                </label>
                <input
                  type="date"
                  className="filter-search-input"
                  style={{ width: '100%', fontSize: '12px' }}
                  value={inchargeFormData.assigned_until}
                  onChange={(e) => setInchargeFormData({ ...inchargeFormData, assigned_until: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn-enterprise-secondary"
                onClick={() => setEditInchargeOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-enterprise-primary"
                disabled={inchargeSubmitting}
              >
                {inchargeSubmitting ? 'Saving...' : 'Update Assignment'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Confirmation Dialog: Delete Incharge */}
      <ConfirmationDialog
        isOpen={deleteInchargeConfirmOpen}
        onClose={() => setDeleteInchargeConfirmOpen(false)}
        onConfirm={handleDeleteIncharge}
        title="Remove Incharge Assignment"
        message="Are you sure you want to remove this staff member's incharge assignment from the hostel? This will unassign residential supervisory duties."
        confirmText="Remove Assignment"
        type="danger"
      />

      {/* =================================================================== */}
      {/* MODAL: Post Security Guard                                          */}
      {/* =================================================================== */}
      {assignSecurityOpen && (
        <Modal
          isOpen={assignSecurityOpen}
          onClose={() => setAssignSecurityOpen(false)}
          title="Post Security Personnel to Campus Gate"
        >
          {securityFormError && (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                marginBottom: '16px',
              }}
            >
              {securityFormError}
            </div>
          )}

          <form onSubmit={handleAssignSecuritySubmit}>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Select Security Personnel *
              </label>
              <select
                className="filter-select"
                style={{ width: '100%' }}
                value={securityFormData.staff_id}
                onChange={(e) => setSecurityFormData({ ...securityFormData, staff_id: e.target.value })}
                required
              >
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {getStaffFullName(s)} ({s.employee_number || 'No Code'} - {s.designation || 'Security'})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Campus Gate Post *
              </label>
              <select
                className="filter-select"
                style={{ width: '100%' }}
                value={securityFormData.gate_id}
                onChange={(e) => setSecurityFormData({ ...securityFormData, gate_id: e.target.value })}
                required
              >
                {gatesList.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.code} - {g.gate_type || 'Main Gate'})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Shift Designation
                </label>
                <select
                  className="filter-select"
                  style={{ width: '100%' }}
                  value={securityFormData.shift_name}
                  onChange={(e) => setSecurityFormData({ ...securityFormData, shift_name: e.target.value })}
                >
                  <option value="DAY_SHIFT">Day Shift (06:00 - 18:00)</option>
                  <option value="NIGHT_SHIFT">Night Shift (18:00 - 06:00)</option>
                  <option value="ROTATIONAL">Rotational Shift</option>
                  <option value="GENERAL">General Shift</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Shift Active Status
                </label>
                <select
                  className="filter-select"
                  style={{ width: '100%' }}
                  value={securityFormData.is_active ? 'true' : 'false'}
                  onChange={(e) => setSecurityFormData({ ...securityFormData, is_active: e.target.value === 'true' })}
                >
                  <option value="true">Active on Post</option>
                  <option value="false">Off Duty</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Assigned From
                </label>
                <input
                  type="date"
                  className="filter-search-input"
                  style={{ width: '100%', fontSize: '12px' }}
                  value={securityFormData.assigned_from}
                  onChange={(e) => setSecurityFormData({ ...securityFormData, assigned_from: e.target.value })}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Assigned Until
                </label>
                <input
                  type="date"
                  className="filter-search-input"
                  style={{ width: '100%', fontSize: '12px' }}
                  value={securityFormData.assigned_until}
                  onChange={(e) => setSecurityFormData({ ...securityFormData, assigned_until: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn-enterprise-secondary"
                onClick={() => setAssignSecurityOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-enterprise-primary"
                disabled={securitySubmitting}
              >
                {securitySubmitting ? 'Posting...' : 'Post Officer'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* =================================================================== */}
      {/* MODAL: Edit Security Assignment                                     */}
      {/* =================================================================== */}
      {editSecurityOpen && (
        <Modal
          isOpen={editSecurityOpen}
          onClose={() => setEditSecurityOpen(false)}
          title="Edit Security Assignment & Duty Status"
        >
          {securityFormError && (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                marginBottom: '16px',
              }}
            >
              {securityFormError}
            </div>
          )}

          <form onSubmit={handleEditSecuritySubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Shift Designation
                </label>
                <select
                  className="filter-select"
                  style={{ width: '100%' }}
                  value={securityFormData.shift_name}
                  onChange={(e) => setSecurityFormData({ ...securityFormData, shift_name: e.target.value })}
                >
                  <option value="DAY_SHIFT">Day Shift</option>
                  <option value="NIGHT_SHIFT">Night Shift</option>
                  <option value="ROTATIONAL">Rotational Shift</option>
                  <option value="GENERAL">General Shift</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Duty Status
                </label>
                <select
                  className="filter-select"
                  style={{ width: '100%' }}
                  value={securityFormData.is_active ? 'true' : 'false'}
                  onChange={(e) => setSecurityFormData({ ...securityFormData, is_active: e.target.value === 'true' })}
                >
                  <option value="true">Active on Post</option>
                  <option value="false">Off Duty</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Assigned From
                </label>
                <input
                  type="date"
                  className="filter-search-input"
                  style={{ width: '100%', fontSize: '12px' }}
                  value={securityFormData.assigned_from}
                  onChange={(e) => setSecurityFormData({ ...securityFormData, assigned_from: e.target.value })}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Assigned Until
                </label>
                <input
                  type="date"
                  className="filter-search-input"
                  style={{ width: '100%', fontSize: '12px' }}
                  value={securityFormData.assigned_until}
                  onChange={(e) => setSecurityFormData({ ...securityFormData, assigned_until: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn-enterprise-secondary"
                onClick={() => setEditSecurityOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-enterprise-primary"
                disabled={securitySubmitting}
              >
                {securitySubmitting ? 'Saving...' : 'Save Updates'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Confirmation Dialog: Delete Security Assignment */}
      <ConfirmationDialog
        isOpen={deleteSecurityConfirmOpen}
        onClose={() => setDeleteSecurityConfirmOpen(false)}
        onConfirm={handleDeleteSecurity}
        title="Remove Security Assignment"
        message="Are you sure you want to remove this security guard assignment from the gate post? The officer will no longer be listed on active duty for this gate."
        confirmText="Remove Post"
        type="danger"
      />
    </div>
  );
}
