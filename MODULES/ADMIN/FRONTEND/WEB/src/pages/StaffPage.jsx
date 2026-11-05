import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import adminService from '../services/adminService';
import { useAuth } from '../../../shared/auth/useAuth';
import {
  Users,
  LayoutGrid,
  List,
  Search,
  RefreshCw,
  Phone,
  Mail,
  UserCheck,
  Plus,
  UserPlus,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
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
  const [displayMode, setDisplayMode] = useState('CARDS');

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
    employee_number: '',
    first_name: '',
    middle_name: '',
    last_name: '',
    designation: 'Hostel In-Charge',
    role_code: 'HOSTEL_INCHARGE',
    hostel_id: '',
    department_id: '',
    phone: '',
    alternate_phone: '',
    email: '',
    password: '',
    confirm_password: '',
    joining_date: '',
    employment_status: 'ACTIVE',
  });
  const [showStaffPassword, setShowStaffPassword] = useState(false);
  const [showStaffConfirmPassword, setShowStaffConfirmPassword] = useState(false);
  const [showAdvancedStaffFields, setShowAdvancedStaffFields] = useState(false);
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

  // Security Personnel Enrollment State
  const [enrollSecurityOpen, setEnrollSecurityOpen] = useState(false);
  const [securityEnrollSubmitting, setSecurityEnrollSubmitting] = useState(false);
  const [securityEnrollError, setSecurityEnrollError] = useState(null);
  const [showSecurityPassword, setShowSecurityPassword] = useState(false);
  const [showSecurityConfirmPassword, setShowSecurityConfirmPassword] = useState(false);
  const [securityEnrollFormData, setSecurityEnrollFormData] = useState({
    name: '',
    first_name: '',
    middle_name: '',
    last_name: '',
    employee_number: '',
    designation: 'Security Officer',
    role_code: 'SECURITY',
    gate_id: '',
    phone: '',
    alternate_phone: '',
    email: '',
    password: '',
    confirm_password: '',
    joining_date: new Date().toISOString().split('T')[0],
    employment_status: 'ACTIVE',
  });

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
    setStaffFormData({
      employee_number: `EMP-${Math.floor(1000 + Math.random() * 9000)}`,
      name: '',
      first_name: '',
      middle_name: '',
      last_name: '',
      designation: 'Hostel In-Charge',
      role_code: 'HOSTEL_INCHARGE',
      hostel_id: hostelsList.length > 0 ? (hostelsList[0].id || hostelsList[0].hostel_id) : '',
      department_id: '',
      phone: '',
      alternate_phone: '',
      email: '',
      password: '',
      confirm_password: '',
      joining_date: new Date().toISOString().split('T')[0],
      employment_status: 'ACTIVE',
    });
    setShowStaffPassword(false);
    setShowStaffConfirmPassword(false);
    setShowAdvancedStaffFields(false);
    setStaffFormError(null);
    setCreateStaffOpen(true);
  };

  const handleCreateStaffSubmit = async (e) => {
    e.preventDefault();
    const fullName = (staffFormData.name || staffFormData.first_name || '').trim();
    if (!fullName) {
      setStaffFormError('Staff member name is required.');
      return;
    }
    if (!staffFormData.email.trim()) {
      setStaffFormError('College Email Address is required.');
      return;
    }
    if (!staffFormData.phone.trim()) {
      setStaffFormError('Mobile Number is required.');
      return;
    }
    if (!staffFormData.password) {
      setStaffFormError('Password is required for staff account creation.');
      return;
    }
    if (staffFormData.password.length < 8) {
      setStaffFormError('Password must be at least 8 characters long.');
      return;
    }
    if (staffFormData.password !== staffFormData.confirm_password) {
      setStaffFormError('Type Password and Retype Password do not match.');
      return;
    }



    setStaffSubmitting(true);
    setStaffFormError(null);

    try {
      const nameParts = fullName.split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || (staffFormData.last_name || '');

      const payload = {
        employee_number: staffFormData.employee_number?.trim() || `EMP-${Math.floor(1000 + Math.random() * 9000)}`,
        first_name: firstName,
        middle_name: staffFormData.middle_name?.trim() || '',
        last_name: lastName,
        designation: staffFormData.designation?.trim() || 'Hostel In-Charge',
        role_code: 'HOSTEL_INCHARGE',
        hostel_id: undefined,
        department_id: staffFormData.department_id?.trim() || undefined,
        phone: staffFormData.phone.trim(),
        alternate_phone: staffFormData.alternate_phone?.trim() || '',
        email: staffFormData.email.trim().toLowerCase(),
        password: staffFormData.password,
        confirm_password: staffFormData.confirm_password,
        joining_date: staffFormData.joining_date?.trim() || new Date().toISOString().split('T')[0],
        employment_status: staffFormData.employment_status || 'ACTIVE',
      };

      await adminService.createStaff(payload);
      setSuccessBanner(`Staff account for ${fullName} created successfully with Hostel Incharge role. You can assign them to a hostel under Hostel Staff Allocation.`);
      setCreateStaffOpen(false);
      loadAllData(true);
    } catch (err) {
      console.error('Error creating staff:', err);
      setStaffFormError(err.response?.data?.message || err.message || 'Failed to create staff account.');
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
  // Security Handlers: Enroll, Assign, Edit, Delete
  // =========================================================================
  const handleOpenEnrollSecurity = () => {
    setSecurityEnrollFormData({
      name: '',
      first_name: '',
      middle_name: '',
      last_name: '',
      employee_number: `SEC-${Math.floor(1000 + Math.random() * 9000)}`,
      designation: 'Security Officer',
      role_code: 'SECURITY',
      gate_id: gatesList.length > 0 ? (gatesList[0].id || '') : '',
      phone: '',
      alternate_phone: '',
      email: '',
      password: '',
      confirm_password: '',
      joining_date: new Date().toISOString().split('T')[0],
      employment_status: 'ACTIVE',
    });
    setShowSecurityPassword(false);
    setShowSecurityConfirmPassword(false);
    setSecurityEnrollError(null);
    setEnrollSecurityOpen(true);
  };

  const handleEnrollSecuritySubmit = async (e) => {
    e.preventDefault();
    const fullName = (securityEnrollFormData.name || securityEnrollFormData.first_name || '').trim();
    if (!fullName) {
      setSecurityEnrollError('Security officer name is required.');
      return;
    }
    if (!securityEnrollFormData.phone.trim()) {
      setSecurityEnrollError('Contact Phone number is required.');
      return;
    }
    if (!securityEnrollFormData.email.trim()) {
      setSecurityEnrollError('Security Login ID (Email Address) is required to configure portal access.');
      return;
    }
    if (!securityEnrollFormData.password) {
      setSecurityEnrollError('Password is required for security account creation.');
      return;
    }
    if (securityEnrollFormData.password.length < 8) {
      setSecurityEnrollError('Security portal password must be at least 8 characters long.');
      return;
    }
    if (securityEnrollFormData.password !== securityEnrollFormData.confirm_password) {
      setSecurityEnrollError('Password and Retype Password do not match.');
      return;
    }

    setSecurityEnrollSubmitting(true);
    setSecurityEnrollError(null);

    try {
      const nameParts = fullName.split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || (securityEnrollFormData.last_name || '');

      const payload = {
        employee_number: securityEnrollFormData.employee_number?.trim() || `SEC-${Math.floor(1000 + Math.random() * 9000)}`,
        first_name: firstName,
        middle_name: securityEnrollFormData.middle_name?.trim() || '',
        last_name: lastName,
        designation: securityEnrollFormData.designation?.trim() || 'Security Officer',
        role_code: 'SECURITY',
        phone: securityEnrollFormData.phone.trim(),
        alternate_phone: securityEnrollFormData.alternate_phone?.trim() || '',
        email: securityEnrollFormData.email.trim().toLowerCase(),
        password: securityEnrollFormData.password,
        confirm_password: securityEnrollFormData.confirm_password,
        joining_date: securityEnrollFormData.joining_date?.trim() || new Date().toISOString().split('T')[0],
        employment_status: securityEnrollFormData.employment_status || 'ACTIVE',
      };

      const res = await adminService.createStaff(payload);
      const createdStaff = res?.data || res;
      const newStaffId = createdStaff?.id;

      // If a gate post was selected, automatically create the initial gate post assignment
      if (newStaffId && securityEnrollFormData.gate_id) {
        try {
          await adminService.createSecurityAssignment({
            staff_id: newStaffId,
            gate_id: securityEnrollFormData.gate_id,
            shift_name: 'DAY_SHIFT',
            assigned_from: securityEnrollFormData.joining_date || new Date().toISOString().split('T')[0],
            is_active: true,
          });
        } catch (assignErr) {
          console.warn('Initial gate assignment notice:', assignErr);
        }
      }

      setSuccessBanner(`Security officer ${fullName} registered successfully with Security Portal access.`);
      setEnrollSecurityOpen(false);
      loadAllData(true);
    } catch (err) {
      console.error('Error creating security personnel:', err);
      setSecurityEnrollError(err.response?.data?.message || err.message || 'Failed to register security personnel.');
    } finally {
      setSecurityEnrollSubmitting(false);
    }
  };

  const handleOpenAssignSecurity = () => {
    const securityStaff = staffList.filter(s => 
      s.role_code === 'SECURITY' || 
      s.role_code === 'SECURITY_GUARD' || 
      (s.designation || '').toLowerCase().includes('security') || 
      (s.designation || '').toLowerCase().includes('guard')
    );
    const initialStaffId = securityStaff.length > 0 ? securityStaff[0].id : (staffList[0]?.id || '');

    setSecurityFormData({
      staff_id: initialStaffId,
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
      setPasswordFeedback({
        type: 'danger',
        message:
          err.response?.data?.message ||
          err.response?.data?.error?.message ||
          err.message ||
          'Failed to reset staff password. Please verify permissions and try again.',
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
            {activeTab === 'incharges' ? (
              <>
                <BedDouble size={13} />
                <span>Hostel Incharge Administration</span>
              </>
            ) : activeTab === 'security' ? (
              <>
                <ShieldCheck size={13} />
                <span>Campus Gate & Security Administration</span>
              </>
            ) : activeTab === 'passwords' ? (
              <>
                <KeyRound size={13} />
                <span>Account & Credential Security</span>
              </>
            ) : (
              <>
                <Users size={13} />
                <span>Personnel & Access Administration</span>
              </>
            )}
          </div>
          <h1 className="hero-main-title">
            {activeTab === 'incharges'
              ? 'Hostel Staff Allocation & Warden Oversight'
              : activeTab === 'security'
              ? 'Campus Security Personnel & Gate Posts'
              : activeTab === 'passwords'
              ? 'Staff Password & Credential Security'
              : 'Hostel Staff Directory & Personnel'}
          </h1>
          <p className="hero-subtitle">
            {activeTab === 'incharges'
              ? 'Supervise residential facilities, manage primary and backup warden appointments, and monitor residential oversight.'
              : activeTab === 'security'
              ? 'Assign security personnel to campus gate posts, manage shift schedules, and oversee gate attendance.'
              : activeTab === 'passwords'
              ? 'Manage institutional staff user account credentials, password resets, and role permissions.'
              : 'Manage residential wardens, hostel in-charges, security gate personnel, and account credential security.'}
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
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="btn-enterprise-primary"
                onClick={() => handleOpenAssignIncharge(hostelsList[0])}
                disabled={hostelsList.length === 0}
              >
                <Plus size={15} />
                <span>Assign Staff Member</span>
              </button>
            </div>
          )}

          {canManagePeople && activeTab === 'security' && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="btn-enterprise-primary"
                onClick={handleOpenEnrollSecurity}
              >
                <UserPlus size={15} />
                <span>Enroll Security Personnel</span>
              </button>

              <button
                type="button"
                className="btn-enterprise-secondary"
                onClick={handleOpenAssignSecurity}
                disabled={gatesList.length === 0}
              >
                <Plus size={15} />
                <span>Post Security Guard</span>
              </button>
            </div>
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
        {activeTab === 'security' ? (
          <>
            <div className="stat-kpi-card">
              <div className="stat-kpi-header">
                <span className="stat-kpi-label">Gate Officer Postings</span>
                <div className="stat-kpi-icon-wrap orange">
                  <ShieldCheck size={17} />
                </div>
              </div>
              <div className="stat-kpi-value text-orange-600">{securityAssignments.length}</div>
              <div className="stat-kpi-footnote">
                <span className="status-dot green" />
                <span>Configured checkpoint postings</span>
              </div>
            </div>

            <div className="stat-kpi-card">
              <div className="stat-kpi-header">
                <span className="stat-kpi-label">Active on Post</span>
                <div className="stat-kpi-icon-wrap green">
                  <UserCheck size={17} />
                </div>
              </div>
              <div className="stat-kpi-value text-green-600">
                {securityAssignments.filter((s) => s.is_active).length}
              </div>
              <div className="stat-kpi-footnote">
                <span>Guards currently on active duty</span>
              </div>
            </div>

            <div className="stat-kpi-card">
              <div className="stat-kpi-header">
                <span className="stat-kpi-label">Monitored Gates</span>
                <div className="stat-kpi-icon-wrap blue">
                  <DoorOpen size={17} />
                </div>
              </div>
              <div className="stat-kpi-value text-blue-600">{gatesList.length}</div>
              <div className="stat-kpi-footnote">
                <span>Campus perimeter checkpoints</span>
              </div>
            </div>

            <div className="stat-kpi-card">
              <div className="stat-kpi-header">
                <span className="stat-kpi-label">Rotational Coverage</span>
                <div className="stat-kpi-icon-wrap purple">
                  <Clock size={17} />
                </div>
              </div>
              <div className="stat-kpi-value text-purple-600">24 / 7</div>
              <div className="stat-kpi-footnote">
                <span>Day &amp; Night shift coverage</span>
              </div>
            </div>
          </>
        ) : activeTab === 'incharges' ? (
          <>
            <div className="stat-kpi-card">
              <div className="stat-kpi-header">
                <span className="stat-kpi-label">Monitored Hostels</span>
                <div className="stat-kpi-icon-wrap blue">
                  <Building2 size={17} />
                </div>
              </div>
              <div className="stat-kpi-value text-blue-600">{hostelsList.length}</div>
              <div className="stat-kpi-footnote">
                <span>Residential facilities configured</span>
              </div>
            </div>

            <div className="stat-kpi-card">
              <div className="stat-kpi-header">
                <span className="stat-kpi-label">Supervised Blocks</span>
                <div className="stat-kpi-icon-wrap green">
                  <CheckCircle2 size={17} />
                </div>
              </div>
              <div className="stat-kpi-value text-green-600">
                {inchargeAssignments.filter((h) => (h.assignments || []).some((a) => a.is_primary)).length}
              </div>
              <div className="stat-kpi-footnote">
                <span className="status-dot green" />
                <span>Primary warden assigned</span>
              </div>
            </div>

            <div className="stat-kpi-card">
              <div className="stat-kpi-header">
                <span className="stat-kpi-label">Unsupervised Blocks</span>
                <div className="stat-kpi-icon-wrap orange">
                  <AlertCircle size={17} />
                </div>
              </div>
              <div className="stat-kpi-value text-orange-600">
                {Math.max(0, hostelsList.length - inchargeAssignments.filter((h) => (h.assignments || []).some((a) => a.is_primary)).length)}
              </div>
              <div className="stat-kpi-footnote">
                <span>Awaiting warden appointment</span>
              </div>
            </div>

            <div className="stat-kpi-card">
              <div className="stat-kpi-header">
                <span className="stat-kpi-label">Total Incharge Posts</span>
                <div className="stat-kpi-icon-wrap purple">
                  <BedDouble size={17} />
                </div>
              </div>
              <div className="stat-kpi-value text-purple-600">
                {inchargeAssignments.reduce((sum, h) => sum + (h.assignments ? h.assignments.length : 0), 0)}
              </div>
              <div className="stat-kpi-footnote">
                <span>Primary &amp; backup wardens</span>
              </div>
            </div>
          </>
        ) : activeTab === 'passwords' ? (
          <>
            <div className="stat-kpi-card">
              <div className="stat-kpi-header">
                <span className="stat-kpi-label">Staff Accounts</span>
                <div className="stat-kpi-icon-wrap purple">
                  <Users size={17} />
                </div>
              </div>
              <div className="stat-kpi-value text-purple-600">{staffList.length}</div>
              <div className="stat-kpi-footnote">
                <span className="status-dot green" />
                <span>Enrolled staff profiles</span>
              </div>
            </div>

            <div className="stat-kpi-card">
              <div className="stat-kpi-header">
                <span className="stat-kpi-label">Active Credentials</span>
                <div className="stat-kpi-icon-wrap green">
                  <UserCheck size={17} />
                </div>
              </div>
              <div className="stat-kpi-value text-green-600">
                {staffList.filter((s) => s.employment_status === 'ACTIVE').length}
              </div>
              <div className="stat-kpi-footnote">
                <span>Active sign-in standing</span>
              </div>
            </div>

            <div className="stat-kpi-card">
              <div className="stat-kpi-header">
                <span className="stat-kpi-label">Selected Account</span>
                <div className="stat-kpi-icon-wrap blue">
                  <KeyRound size={17} />
                </div>
              </div>
              <div className="stat-kpi-value text-blue-600" style={{ fontSize: selectedPasswordStaff ? '1.15rem' : '1.35rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedPasswordStaff ? (selectedPasswordStaff.first_name || 'Selected') : 'None'}
              </div>
              <div className="stat-kpi-footnote">
                <span>{selectedPasswordStaff ? (selectedPasswordStaff.designation || 'Staff') : 'Select from directory'}</span>
              </div>
            </div>

            <div className="stat-kpi-card">
              <div className="stat-kpi-header">
                <span className="stat-kpi-label">Security Audit</span>
                <div className="stat-kpi-icon-wrap orange">
                  <ShieldCheck size={17} />
                </div>
              </div>
              <div className="stat-kpi-value text-orange-600">Active</div>
              <div className="stat-kpi-footnote">
                <span className="status-dot green" />
                <span>Institutional audit logging</span>
              </div>
            </div>
          </>
        ) : (
          <>
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
                <span className="stat-kpi-label">Hostel Staff Allocation</span>
                <div className="stat-kpi-icon-wrap blue">
                  <BedDouble size={17} />
                </div>
              </div>
              <div className="stat-kpi-value text-blue-600">
                {inchargeAssignments.reduce((sum, h) => sum + (h.assignments ? h.assignments.length : 0), 0)}
              </div>
              <div className="stat-kpi-footnote">
                <span>Primary &amp; backup wardens</span>
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
          </>
        )}
      </div>

      {/* Tab Navigation Controls */}
      <div className="staff-segmented-tabs">
        <button
          type="button"
          onClick={() => setActiveTab('staff')}
          className={`staff-tab-pill ${activeTab === 'staff' ? 'active' : ''}`}
        >
          <Users size={15} />
          <span>Staff Directory</span>
          <span className="staff-tab-counter">{staffList.length}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('incharges')}
          className={`staff-tab-pill ${activeTab === 'incharges' ? 'active' : ''}`}
        >
          <BedDouble size={15} />
          <span>Hostel Staff Allocation</span>
          <span className="staff-tab-counter">{hostelsList.length} Hostels</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('security')}
          className={`staff-tab-pill ${activeTab === 'security' ? 'active' : ''}`}
        >
          <ShieldCheck size={15} />
          <span>Security Personnel &amp; Gates</span>
          <span className="staff-tab-counter">{securityAssignments.length} Posts</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('passwords')}
          className={`staff-tab-pill ${activeTab === 'passwords' ? 'active' : ''}`}
        >
          <KeyRound size={15} />
          <span>Password &amp; Account Security</span>
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

            {/* View Switcher & Tally */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="stats-tally-pill" style={{ color: '#4338ca', background: '#e0e7ff', borderColor: '#c7d2fe' }}>
                <Users size={12} />
                <span>{filteredStaff.length} of {staffList.length} Staff</span>
              </span>

              <div className="view-mode-toggle">
                <button
                  type="button"
                  className={`view-mode-btn ${displayMode === 'CARDS' ? 'active' : ''}`}
                  onClick={() => setDisplayMode('CARDS')}
                  title="Card Grid View"
                >
                  <LayoutGrid size={13} />
                  <span>Cards</span>
                </button>
                <button
                  type="button"
                  className={`view-mode-btn ${displayMode === 'TABLE' ? 'active' : ''}`}
                  onClick={() => setDisplayMode('TABLE')}
                  title="Table View"
                >
                  <List size={13} />
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

          {filteredStaff.length === 0 ? (
            <div style={{ padding: '36px', textAlign: 'center' }}>
              <EmptyState
                title="No staff records found"
                message="No staff members match the selected criteria or search term."
              />
            </div>
          ) : displayMode === 'CARDS' ? (
            /* Staff Directory Modern Cards */
            <div className="staff-grid-cards">
              {filteredStaff.map((s, idx) => {
                const fullName = getStaffFullName(s);
                const desig = (s.designation || 'Staff').toUpperCase();
                const isWarden = desig.includes('WARDEN') || desig.includes('INCHARGE');
                const isSecurity = desig.includes('SECURITY') || desig.includes('GUARD');
                const avatarClass = isWarden ? 'warden' : isSecurity ? 'security' : 'general';
                const statusClass =
                  s.employment_status === 'ACTIVE' ? 'active' : s.employment_status === 'SUSPENDED' ? 'warning' : 'inactive';

                const assignedHostel = inchargeAssignments.find((h) =>
                  (h.assignments || []).some((a) => a.staff_id === s.id)
                );
                const assignedSecurity = securityAssignments.find(
                  (sec) => sec.staff_id === s.id && sec.is_active
                );

                return (
                  <div key={s.id || idx} className="staff-card-v2">
                    <div>
                      <div className="staff-card-top">
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', minWidth: 0 }}>
                          <div className={`staff-avatar-box ${avatarClass}`}>
                            {(s.first_name || 'S')[0].toUpperCase()}
                            <span className={`staff-online-status-dot ${statusClass}`} title={s.employment_status} />
                          </div>
                          <div className="staff-title-group">
                            <h3 className="staff-name-h3" title={fullName}>
                              {fullName}
                            </h3>
                            <div className="staff-emp-code-sub">
                              <span className="code-pill" style={{ fontSize: '11px', fontWeight: 700 }}>
                                {s.employee_number || `EMP-${100 + idx}`}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div>{renderStatusBadge(s.employment_status)}</div>
                      </div>

                      <div className="staff-card-body">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                          <span className={`staff-designation-badge ${avatarClass}`}>
                            {isWarden ? <BedDouble size={12} /> : isSecurity ? <Shield size={12} /> : <Users size={12} />}
                            <span>{s.designation || 'Staff Member'}</span>
                          </span>
                          {s.department_id && (
                            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                              Dept: {s.department_id}
                            </span>
                          )}
                        </div>

                        <div className="staff-contacts-stack">
                          <span className="staff-contact-row" title={s.email || 'No email recorded'}>
                            <Mail size={12} style={{ color: '#94a3b8', flexShrink: 0 }} />
                            <span>{s.email || 'No email recorded'}</span>
                          </span>
                          <span className="staff-contact-row" title={s.phone || 'No phone recorded'}>
                            <Phone size={12} style={{ color: '#94a3b8', flexShrink: 0 }} />
                            <span>{s.phone || 'No phone recorded'}</span>
                          </span>
                        </div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {assignedHostel ? (
                            <span className="staff-duty-tag" style={{ background: '#e0e7ff', color: '#3730a3' }}>
                              <BedDouble size={12} />
                              <span>Warden &bull; {assignedHostel.hostel?.name || 'Assigned Hostel'}</span>
                            </span>
                          ) : assignedSecurity ? (
                            <span className="staff-duty-tag" style={{ background: '#ffedd5', color: '#9a3412' }}>
                              <Shield size={12} />
                              <span>Gate &bull; {gateMap.get(assignedSecurity.gate_id)?.name || 'Main Gate'}</span>
                            </span>
                          ) : (
                            <span className="staff-duty-tag">
                              <Building2 size={12} />
                              <span>General Operations</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="staff-card-footer">
                      <button
                        type="button"
                        className="btn-enterprise-secondary"
                        style={{ padding: '5px 12px', fontSize: '0.8rem' }}
                        onClick={() => handleOpenProfile(s)}
                        title="View Full Profile Dossier"
                      >
                        <Eye size={13} />
                        <span>Profile</span>
                      </button>

                      {canManagePeople && (
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn-icon"
                            title="Edit Staff Record"
                            onClick={() => handleOpenEditStaff(s)}
                          >
                            <Edit2 size={13} />
                          </button>

                          <button
                            type="button"
                            className="btn-icon"
                            title="Change Employment Status"
                            onClick={() => handleOpenStatusModal(s)}
                          >
                            <UserX size={13} />
                          </button>

                          <button
                            type="button"
                            className="btn-icon"
                            title="Manage Password & Credentials"
                            onClick={() => {
                              setSelectedPasswordStaff(s);
                              setActiveTab('passwords');
                            }}
                          >
                            <KeyRound size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Staff Table */
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
                  {filteredStaff.map((s, idx) => (
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
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
              <h2 className="card-title-text">Hostel Incharge &amp; Warden Assignments</h2>
            </div>

            {/* View Switcher & Tally */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="stats-tally-pill" style={{ color: '#1d4ed8', background: '#dbeafe', borderColor: '#bfdbfe' }}>
                <Building2 size={12} />
                <span>{inchargeAssignments.length} Hostels Monitored</span>
              </span>

              <div className="view-mode-toggle">
                <button
                  type="button"
                  className={`view-mode-btn ${displayMode === 'CARDS' ? 'active' : ''}`}
                  onClick={() => setDisplayMode('CARDS')}
                  title="Card Grid View"
                >
                  <LayoutGrid size={13} />
                  <span>Cards</span>
                </button>
                <button
                  type="button"
                  className={`view-mode-btn ${displayMode === 'TABLE' ? 'active' : ''}`}
                  onClick={() => setDisplayMode('TABLE')}
                  title="Table View"
                >
                  <List size={13} />
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

          {filteredIncharges.length === 0 ? (
            <div style={{ padding: '36px', textAlign: 'center' }}>
              <EmptyState
                title="No hostel assignments found"
                message="No incharge assignments exist matching the selected criteria."
              />
            </div>
          ) : displayMode === 'CARDS' ? (
            /* Incharge Cards Grid */
            <div className="incharges-grid-cards">
              {filteredIncharges.map(({ hostel, assignments }) => {
                const primary = assignments.find((a) => a.is_primary);
                const backups = assignments.filter((a) => !a.is_primary);
                const primaryStaff = primary ? staffMap.get(primary.staff_id) : null;

                return (
                  <div key={hostel.id} className="incharge-card-v2">
                    <div>
                      <div className="incharge-card-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '38px',
                              height: '38px',
                              borderRadius: '10px',
                              background: '#eff6ff',
                              color: '#2563eb',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Building2 size={18} />
                          </div>
                          <div>
                            <strong style={{ color: '#0f172a', fontSize: '0.98rem', display: 'block' }}>
                              {hostel.name}
                            </strong>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
                              <span className="code-pill" style={{ fontSize: '10.5px' }}>
                                {hostel.code}
                              </span>
                              <span style={{ fontSize: '11px', color: '#64748b' }}>
                                {hostel.hostel_type || 'RESIDENTIAL'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div>
                          {primaryStaff ? (
                            <span className="badge-enterprise badge-green">SUPERVISED</span>
                          ) : (
                            <span className="badge-enterprise badge-orange">UNSUPERVISED</span>
                          )}
                        </div>
                      </div>

                      <div className="incharge-card-body">
                        {primaryStaff ? (
                          <div className="incharge-primary-box">
                            <div
                              style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '8px',
                                background: '#10b981',
                                color: '#ffffff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: '13px',
                                flexShrink: 0,
                              }}
                            >
                              {(primaryStaff.first_name || 'W')[0].toUpperCase()}
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <strong style={{ color: '#065f46', fontSize: '13px' }}>
                                  {getStaffFullName(primaryStaff)}
                                </strong>
                                <span className="badge-enterprise badge-purple" style={{ fontSize: '9px', padding: '1px 5px' }}>
                                  PRIMARY
                                </span>
                              </div>
                              <span style={{ fontSize: '11px', color: '#047857', display: 'block' }}>
                                {primaryStaff.phone || primaryStaff.email || 'Verified Incharge'}
                              </span>
                              <span style={{ fontSize: '10.5px', color: '#6b7280' }}>
                                Since {primary.assigned_from ? String(primary.assigned_from).split('T')[0] : 'Immediate'}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="incharge-primary-box empty" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <AlertCircle size={16} style={{ color: '#ef4444', flexShrink: 0 }} />
                              <div>
                                <strong style={{ color: '#991b1b', fontSize: '12.5px', display: 'block' }}>
                                  No Primary Incharge
                                </strong>
                                <span style={{ fontSize: '11px', color: '#b91c1c' }}>
                                  Assign an active staff member to oversee this facility.
                                </span>
                              </div>
                            </div>
                            {canManagePeople && (
                              <button
                                type="button"
                                className="btn-enterprise-primary"
                                style={{ padding: '3px 8px', fontSize: '11px', whiteSpace: 'nowrap' }}
                                onClick={() => handleOpenAssignIncharge(hostel)}
                              >
                                <Plus size={11} />
                                <span>Assign Staff</span>
                              </button>
                            )}
                          </div>
                        )}

                        {backups.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>
                              Backup Wardens ({backups.length})
                            </span>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                              {backups.map((b) => {
                                const bStaff = staffMap.get(b.staff_id);
                                return (
                                  <span
                                    key={b.id}
                                    className="staff-duty-tag"
                                    style={{ fontSize: '11px', background: '#f1f5f9' }}
                                  >
                                    <UserCheck size={11} />
                                    <span>{getStaffFullName(bStaff)}</span>
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="staff-card-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {canManagePeople && (
                          <button
                            type="button"
                            className="btn-enterprise-primary"
                            style={{ padding: '4px 10px', fontSize: '11.5px' }}
                            onClick={() => handleOpenAssignIncharge(hostel)}
                            title="Assign staff member to oversee this hostel"
                          >
                            <Plus size={12} />
                            <span>Assign Staff</span>
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-enterprise-secondary"
                          style={{ padding: '4px 10px', fontSize: '11.5px' }}
                          onClick={() => navigate('/admin/allocations')}
                          title="Assign students to beds in this hostel facility"
                        >
                          <Users size={12} />
                          <span>Assign Students</span>
                        </button>
                      </div>

                      {canManagePeople && primary && (
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn-icon"
                            title="Edit Primary Incharge Assignment"
                            onClick={() => handleOpenEditIncharge(hostel, primary)}
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            type="button"
                            className="btn-icon danger"
                            title="Remove Primary Incharge Assignment"
                            onClick={() => handleOpenDeleteInchargeConfirm(hostel, primary)}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Hostels Incharges Table */
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
                  {filteredIncharges.map(({ hostel, assignments }) => {
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
                                {hostel.code} &bull; {hostel.hostel_type || 'RESIDENTIAL'}
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
                                Since {primary.assigned_from ? String(primary.assigned_from).split('T')[0] : 'Immediate'}
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
                  })}
                </tbody>
              </table>
            </div>
          )}
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
              <h2 className="card-title-text">Campus Security Personnel &amp; Gate Posts</h2>
            </div>

            {/* View Switcher & Tally */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="stats-tally-pill" style={{ color: '#ea580c', background: '#ffedd5', borderColor: '#fed7aa' }}>
                <ShieldCheck size={12} />
                <span>{securityAssignments.length} Gate Assignments</span>
              </span>

              <div className="view-mode-toggle">
                <button
                  type="button"
                  className={`view-mode-btn ${displayMode === 'CARDS' ? 'active' : ''}`}
                  onClick={() => setDisplayMode('CARDS')}
                  title="Card Grid View"
                >
                  <LayoutGrid size={13} />
                  <span>Cards</span>
                </button>
                <button
                  type="button"
                  className={`view-mode-btn ${displayMode === 'TABLE' ? 'active' : ''}`}
                  onClick={() => setDisplayMode('TABLE')}
                  title="Table View"
                >
                  <List size={13} />
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

          {filteredSecurityAssignments.length === 0 ? (
            <div style={{ padding: '36px', textAlign: 'center' }}>
              <EmptyState
                title="No security assignments found"
                message="No security officers are currently assigned to gate posts."
              />
            </div>
          ) : displayMode === 'CARDS' ? (
            /* Security Cards Grid */
            <div className="security-grid-cards">
              {filteredSecurityAssignments.map((sec) => {
                const staff = staffMap.get(sec.staff_id);
                const gate = gateMap.get(sec.gate_id);

                return (
                  <div key={sec.id} className="security-card-v2">
                    <div>
                      <div className="security-card-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '38px',
                              height: '38px',
                              borderRadius: '10px',
                              background: '#fff7ed',
                              color: '#ea580c',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Shield size={18} />
                          </div>
                          <div>
                            <strong style={{ color: '#0f172a', fontSize: '0.98rem', display: 'block' }}>
                              {getStaffFullName(staff)}
                            </strong>
                            <span style={{ fontSize: '11px', color: '#64748b' }}>
                              {staff?.phone || staff?.employee_number || 'Security Officer'}
                            </span>
                            {staff?.email && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                                <Mail size={11} style={{ color: '#94a3b8' }} />
                                <span>{staff.email}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                          {sec.is_active ? (
                            <span className="badge-enterprise badge-green">ON POST</span>
                          ) : (
                            <span className="badge-enterprise badge-gray">OFF DUTY</span>
                          )}
                          {staff?.email && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px', fontWeight: 600, color: '#15803d', backgroundColor: '#dcfce7', padding: '1px 6px', borderRadius: '4px' }}>
                              <ShieldCheck size={10} /> Portal Active
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="security-card-body">
                        <div className="security-gate-callout">
                          <DoorOpen size={18} style={{ color: '#ea580c', flexShrink: 0 }} />
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <strong style={{ color: '#9a3412', fontSize: '13px', display: 'block' }}>
                              {gate?.name || 'Main Campus Gate'}
                            </strong>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
                              <span className="code-pill" style={{ fontSize: '10.5px' }}>
                                {gate?.code || 'GATE-01'}
                              </span>
                              <span style={{ fontSize: '11px', color: '#c2410c' }}>
                                {gate?.gate_type || 'ENTRY_EXIT'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div style={{ background: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: '8px', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Shift Schedule</span>
                            <span className="badge-enterprise badge-purple" style={{ fontSize: '10.5px' }}>
                              {sec.shift_name || 'GENERAL_SHIFT'}
                            </span>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Timings</span>
                            <span style={{ fontSize: '11.5px', color: '#334155', fontWeight: 600 }}>
                              {sec.shift_start ? String(sec.shift_start).split('T')[0] : 'Standard'}
                            </span>
                          </div>
                        </div>

                        <div style={{ fontSize: '11.5px', color: '#64748b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>From: <strong>{sec.assigned_from ? String(sec.assigned_from).split('T')[0] : 'Immediate'}</strong></span>
                          {sec.assigned_until && <span>Until: <strong>{String(sec.assigned_until).split('T')[0]}</strong></span>}
                        </div>
                      </div>
                    </div>

                    <div className="staff-card-footer">
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>Gate Guard Duty</span>
                      {canManagePeople && (
                        <div style={{ display: 'flex', gap: '6px' }}>
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
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Security Table */
            <div className="enterprise-table-container">
              <table className="enterprise-table">
                <thead>
                  <tr>
                    <th>Security Officer</th>
                    <th>Assigned Gate Post</th>
                    <th>Shift &amp; Timings</th>
                    <th>Assignment Period</th>
                    <th>Duty Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSecurityAssignments.map((sec) => {
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
                              {staff?.email && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                                  <Mail size={11} style={{ color: '#94a3b8' }} />
                                  <span>{staff.email}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        <td>
                          <span style={{ fontWeight: 600, color: '#1e293b', display: 'block' }}>
                            {gate?.name || 'Main Campus Gate'}
                          </span>
                          <span className="code-pill" style={{ fontSize: '10.5px' }}>
                            {gate?.code || 'GATE-01'} &bull; {gate?.gate_type || 'ENTRY_EXIT'}
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
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            {sec.is_active ? (
                              <span className="badge-enterprise badge-green">ON POST</span>
                            ) : (
                              <span className="badge-enterprise badge-gray">OFF DUTY</span>
                            )}
                            {staff?.email && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px', fontWeight: 600, color: '#15803d', backgroundColor: '#dcfce7', padding: '1px 6px', borderRadius: '4px' }}>
                                <ShieldCheck size={10} /> Portal Active
                              </span>
                            )}
                          </div>
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
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 4 CONTENT: Password & Account Security                          */}
      {/* =================================================================== */}
      {activeTab === 'passwords' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) minmax(420px, 1.4fr)', gap: '20px' }}>
          {/* Left Column: Staff Account Directory */}
          <div className="enterprise-card">
            <div className="card-topbar">
              <div className="card-title-group">
                <div className="card-title-icon-wrap" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
                  <Users size={16} />
                </div>
                <div>
                  <h2 className="card-title-text">Staff Accounts</h2>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    Showing {filteredStaff.length} of {staffList.length} accounts
                  </span>
                </div>
              </div>
              <span className="badge-enterprise badge-purple">
                {filteredStaff.length} Accounts
              </span>
            </div>

            <div style={{ padding: '16px' }}>
              <div style={{ position: 'relative', marginBottom: '14px' }}>
                <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  className="filter-search-input"
                  style={{ width: '100%', paddingLeft: '34px' }}
                  placeholder="Search by name, employee code, email..."
                  value={staffSearch}
                  onChange={(e) => setStaffSearch(e.target.value)}
                />
              </div>

              <div className="password-staff-list">
                {filteredStaff.length === 0 ? (
                  <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                    No staff profiles match your search criteria.
                  </div>
                ) : (
                  filteredStaff.map((s) => {
                    const isSelected = selectedPasswordStaff?.id === s.id;
                    const initials = `${s.first_name?.[0] || 'S'}${s.last_name?.[0] || ''}`.toUpperCase();
                    const status = (s.employment_status || 'ACTIVE').toUpperCase();

                    return (
                      <div
                        key={s.id}
                        onClick={() => handleSelectStaffForPassword(s)}
                        className={`password-staff-item ${isSelected ? 'selected' : ''}`}
                      >
                        <div
                          style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '10px',
                            background: isSelected
                              ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)'
                              : '#f1f5f9',
                            color: isSelected ? '#ffffff' : '#475569',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '0.84rem',
                            flexShrink: 0,
                            boxShadow: isSelected ? '0 2px 6px rgba(99, 102, 241, 0.25)' : 'none',
                          }}
                        >
                          {initials}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                            <strong
                              style={{
                                color: '#0f172a',
                                fontSize: '0.88rem',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                              title={getStaffFullName(s)}
                            >
                              {getStaffFullName(s)}
                            </strong>
                            <span
                              className={`badge-enterprise ${
                                status === 'ACTIVE'
                                  ? 'badge-green'
                                  : status === 'ON_LEAVE'
                                  ? 'badge-amber'
                                  : 'badge-gray'
                              }`}
                              style={{ fontSize: '0.65rem' }}
                            >
                              {status}
                            </span>
                          </div>

                          <div
                            style={{
                              fontSize: '0.74rem',
                              color: '#64748b',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              marginTop: '2px',
                            }}
                          >
                            {s.email || s.phone || 'No direct contact'}
                          </div>

                          <div
                            style={{
                              marginTop: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontSize: '0.7rem',
                              color: '#94a3b8',
                            }}
                          >
                            <span className="code-pill" style={{ fontSize: '0.66rem', padding: '1px 5px' }}>
                              {s.employee_number || 'EMP'}
                            </span>
                            <span>•</span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {s.designation || 'Staff'}
                            </span>
                          </div>
                        </div>

                        {isSelected && (
                          <div style={{ color: '#6366f1', flexShrink: 0 }}>
                            <CheckCircle2 size={16} />
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Password Overwrite & Access Control Center */}
          <div className="enterprise-card">
            <div className="card-topbar">
              <div className="card-title-group">
                <div className="card-title-icon-wrap" style={{ backgroundColor: '#faf5ff', color: '#9333ea' }}>
                  <KeyRound size={16} />
                </div>
                <div>
                  <h2 className="card-title-text">Credential Security & Password Recovery</h2>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    Administer staff credentials with audited reset workflows
                  </span>
                </div>
              </div>
              <span className="badge-enterprise badge-emerald">
                <ShieldCheck size={12} style={{ marginRight: '4px' }} />
                Audit Trail Protected
              </span>
            </div>

            <div style={{ padding: '24px' }}>
              {selectedPasswordStaff ? (
                <>
                  {/* Selected Staff Identity Dossier Banner */}
                  <div
                    style={{
                      background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                      border: '1px solid #e2e8f0',
                      borderRadius: '14px',
                      padding: '16px 18px',
                      marginBottom: '20px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                      <div
                        style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: '12px',
                          background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '1.1rem',
                          boxShadow: '0 4px 10px rgba(79, 70, 229, 0.25)',
                          flexShrink: 0,
                        }}
                      >
                        {`${selectedPasswordStaff.first_name?.[0] || 'S'}${selectedPasswordStaff.last_name?.[0] || ''}`.toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: '200px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
                            {getStaffFullName(selectedPasswordStaff)}
                          </h3>
                          <span className="badge-enterprise badge-purple" style={{ fontSize: '0.68rem' }}>
                            {selectedPasswordStaff.designation || 'Staff Member'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px', flexWrap: 'wrap', fontSize: '0.78rem', color: '#64748b' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span className="code-pill" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                              {selectedPasswordStaff.employee_number || 'EMP'}
                            </span>
                          </span>
                          {selectedPasswordStaff.email && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Mail size={12} style={{ color: '#6366f1' }} />
                              <span>{selectedPasswordStaff.email}</span>
                            </span>
                          )}
                          {selectedPasswordStaff.phone && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Phone size={12} style={{ color: '#10b981' }} />
                              <span>{selectedPasswordStaff.phone}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Institutional Security Policy & Compliance Box */}
                  <div className="password-policy-box">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: '#1e293b' }}>
                      <Shield size={16} style={{ color: '#6366f1' }} />
                      <strong style={{ fontSize: '0.84rem' }}>Institutional Security Protocol:</strong>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px' }}>
                      <div className="password-policy-item">
                        <CheckCircle2 size={13} style={{ color: '#10b981', flexShrink: 0 }} />
                        <span>Minimum 8 characters length</span>
                      </div>
                      <div className="password-policy-item">
                        <CheckCircle2 size={13} style={{ color: '#10b981', flexShrink: 0 }} />
                        <span>Alphanumeric letters &amp; numbers</span>
                      </div>
                      <div className="password-policy-item">
                        <CheckCircle2 size={13} style={{ color: '#10b981', flexShrink: 0 }} />
                        <span>Logged in immutable security audit trail</span>
                      </div>
                      <div className="password-policy-item">
                        <CheckCircle2 size={13} style={{ color: '#10b981', flexShrink: 0 }} />
                        <span>Immediately revokes old active tokens</span>
                      </div>
                    </div>
                  </div>

                  {/* Feedback Banner */}
                  {passwordFeedback && (
                    <div
                      style={{
                        padding: '12px 16px',
                        borderRadius: '10px',
                        marginBottom: '18px',
                        fontSize: '0.84rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
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
                      {passwordFeedback.type === 'success' ? (
                        <CheckCircle2 size={16} style={{ color: '#059669', flexShrink: 0 }} />
                      ) : (
                        <AlertCircle size={16} style={{ color: '#dc2626', flexShrink: 0 }} />
                      )}
                      <span>{passwordFeedback.message}</span>
                    </div>
                  )}

                  {/* Reset Password Form */}
                  <form onSubmit={handlePasswordResetSubmit}>
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                        New Account Password *
                      </label>
                      <div className="password-input-group">
                        <Lock size={15} className="password-input-icon" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          className="filter-search-input"
                          style={{ width: '100%', paddingLeft: '34px', paddingRight: '38px' }}
                          placeholder="Enter strong replacement password (min 8 chars)..."
                          value={passwordFormData.newPassword}
                          onChange={(e) => setPasswordFormData({ ...passwordFormData, newPassword: e.target.value })}
                          required
                        />
                        <button
                          type="button"
                          className="password-toggle-btn"
                          onClick={() => setShowPassword(!showPassword)}
                          title={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>

                      {/* Real-time strength meter */}
                      {passwordFormData.newPassword && (
                        <div style={{ marginTop: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Password Strength</span>
                            <span
                              style={{
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                color:
                                  passwordFormData.newPassword.length >= 10 && /[A-Z]/.test(passwordFormData.newPassword) && /[0-9]/.test(passwordFormData.newPassword)
                                    ? '#16a34a'
                                    : passwordFormData.newPassword.length >= 8
                                    ? '#d97706'
                                    : '#dc2626',
                              }}
                            >
                              {passwordFormData.newPassword.length >= 10 && /[A-Z]/.test(passwordFormData.newPassword) && /[0-9]/.test(passwordFormData.newPassword)
                                ? 'Strong'
                                : passwordFormData.newPassword.length >= 8
                                ? 'Moderate'
                                : 'Too Short'}
                            </span>
                          </div>
                          <div style={{ height: '4px', background: '#e2e8f0', borderRadius: '2px', overflow: 'hidden', display: 'flex' }}>
                            <div
                              style={{
                                height: '100%',
                                width:
                                  passwordFormData.newPassword.length >= 10 && /[A-Z]/.test(passwordFormData.newPassword) && /[0-9]/.test(passwordFormData.newPassword)
                                    ? '100%'
                                    : passwordFormData.newPassword.length >= 8
                                    ? '65%'
                                    : '30%',
                                background:
                                  passwordFormData.newPassword.length >= 10 && /[A-Z]/.test(passwordFormData.newPassword) && /[0-9]/.test(passwordFormData.newPassword)
                                    ? '#16a34a'
                                    : passwordFormData.newPassword.length >= 8
                                    ? '#f59e0b'
                                    : '#ef4444',
                                transition: 'all 0.2s ease',
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                        Confirm Replacement Password *
                      </label>
                      <div className="password-input-group">
                        <Lock size={15} className="password-input-icon" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          className="filter-search-input"
                          style={{ width: '100%', paddingLeft: '34px', paddingRight: '38px' }}
                          placeholder="Re-type password to verify match..."
                          value={passwordFormData.confirmPassword}
                          onChange={(e) => setPasswordFormData({ ...passwordFormData, confirmPassword: e.target.value })}
                          required
                        />
                        {passwordFormData.confirmPassword && (
                          <div style={{ position: 'absolute', right: '12px' }}>
                            {passwordFormData.newPassword === passwordFormData.confirmPassword ? (
                              <CheckCircle2 size={16} style={{ color: '#10b981' }} title="Passwords match" />
                            ) : (
                              <AlertCircle size={16} style={{ color: '#ef4444' }} title="Passwords do not match" />
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
                      <button
                        type="button"
                        className="btn-enterprise-secondary"
                        onClick={() => {
                          setSelectedPasswordStaff(null);
                          setPasswordFeedback(null);
                          setPasswordFormData({ newPassword: '', confirmPassword: '' });
                        }}
                      >
                        Clear Selection
                      </button>

                      <button
                        type="submit"
                        className="btn-enterprise-primary"
                        disabled={passwordSubmitting}
                        style={{ gap: '6px' }}
                      >
                        <ShieldCheck size={14} />
                        <span>{passwordSubmitting ? 'Overwriting...' : 'Update Staff Password'}</span>
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                  <div
                    style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '16px',
                      background: '#eff6ff',
                      color: '#2563eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 16px',
                    }}
                  >
                    <KeyRound size={26} />
                  </div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>
                    No Staff Account Selected
                  </h3>
                  <p style={{ fontSize: '0.82rem', color: '#64748b', maxWidth: '380px', margin: '0 auto 18px', lineHeight: 1.5 }}>
                    Select an enrolled staff profile from the directory on the left to inspect authentication standing, verify contact information, or issue an authorized credential update.
                  </p>
                  {filteredStaff.length > 0 && (
                    <button
                      type="button"
                      className="btn-enterprise-secondary"
                      onClick={() => handleSelectStaffForPassword(filteredStaff[0])}
                      style={{ fontSize: '0.8rem', gap: '6px' }}
                    >
                      <UserCheck size={14} />
                      <span>Select {filteredStaff[0].first_name} {filteredStaff[0].last_name || ''}</span>
                    </button>
                  )}
                </div>
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
          title="Create Staff Account"
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
            {/* System Role: Fixed to Hostel In-Charge */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                System Role
              </label>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                background: '#f1f5f9',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                fontWeight: 600,
                color: '#0f172a'
              }}>
                <ShieldCheck size={16} style={{ color: '#2563eb' }} />
                <span>Hostel In-Charge</span>
              </div>
            </div>

            {/* Full Name */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Full Name *
              </label>
              <input
                type="text"
                className="filter-search-input"
                style={{ width: '100%', fontSize: '13px' }}
                value={staffFormData.name !== undefined ? staffFormData.name : `${staffFormData.first_name} ${staffFormData.last_name}`.trim()}
                onChange={(e) => setStaffFormData({ ...staffFormData, name: e.target.value, first_name: e.target.value })}
                placeholder="Enter staff member full name (e.g. Dr. Kavitha Raman)"
                required
              />
            </div>

            {/* Mobile Number & College Email */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Mobile Number *
                </label>
                <input
                  type="tel"
                  className="filter-search-input"
                  style={{ width: '100%', fontSize: '13px' }}
                  value={staffFormData.phone}
                  onChange={(e) => setStaffFormData({ ...staffFormData, phone: e.target.value })}
                  placeholder="+91 9876543210"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  College Email Address *
                </label>
                <input
                  type="email"
                  className="filter-search-input"
                  style={{ width: '100%', fontSize: '13px' }}
                  value={staffFormData.email}
                  onChange={(e) => setStaffFormData({ ...staffFormData, email: e.target.value })}
                  placeholder="staff@college.edu"
                  required
                />
              </div>
            </div>

            {/* Password Creation (Type Password & Retype Password) */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '12px 14px',
              marginBottom: '16px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#1e293b', fontSize: '12.5px', fontWeight: 600 }}>
                  <Lock size={14} style={{ color: '#0284c7' }} />
                  <span>Account Credentials</span>
                </div>
                {staffFormData.password && staffFormData.confirm_password && (
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: staffFormData.password === staffFormData.confirm_password ? '#16a34a' : '#dc2626'
                  }}>
                    {staffFormData.password === staffFormData.confirm_password ? 'Passwords match' : 'Passwords do not match'}
                  </span>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Type Password *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showStaffPassword ? 'text' : 'password'}
                      className="filter-search-input"
                      style={{ width: '100%', fontSize: '12px', paddingRight: '36px' }}
                      value={staffFormData.password}
                      onChange={(e) => setStaffFormData({ ...staffFormData, password: e.target.value })}
                      placeholder="Minimum 8 characters"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowStaffPassword(!showStaffPassword)}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#64748b',
                        padding: 0,
                      }}
                      tabIndex={-1}
                    >
                      {showStaffPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Retype Password *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showStaffConfirmPassword ? 'text' : 'password'}
                      className="filter-search-input"
                      style={{ width: '100%', fontSize: '12px', paddingRight: '36px' }}
                      value={staffFormData.confirm_password}
                      onChange={(e) => setStaffFormData({ ...staffFormData, confirm_password: e.target.value })}
                      placeholder="Retype password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowStaffConfirmPassword(!showStaffConfirmPassword)}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#64748b',
                        padding: 0,
                      }}
                      tabIndex={-1}
                    >
                      {showStaffConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>
                The staff member can sign into the Hostel Incharge / Staff portal using their college email and this password.
              </div>
            </div>

            {/* Optional Collapsible Details */}
            <div style={{ marginBottom: '16px' }}>
              <button
                type="button"
                onClick={() => setShowAdvancedStaffFields(!showAdvancedStaffFields)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#0284c7',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span>{showAdvancedStaffFields ? '− Hide' : '+ Show'} Optional Details (Designation, Employee ID, Joining Date)</span>
              </button>

              {showAdvancedStaffFields && (
                <div style={{ marginTop: '10px', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '10px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                        Designation / Role Title
                      </label>
                      <input
                        type="text"
                        className="filter-search-input"
                        style={{ width: '100%', fontSize: '12px' }}
                        value={staffFormData.designation}
                        onChange={(e) => setStaffFormData({ ...staffFormData, designation: e.target.value })}
                        placeholder="e.g. Primary Hostel Incharge"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                        Employee Number
                      </label>
                      <input
                        type="text"
                        className="filter-search-input"
                        style={{ width: '100%', fontSize: '12px' }}
                        value={staffFormData.employee_number}
                        onChange={(e) => setStaffFormData({ ...staffFormData, employee_number: e.target.value })}
                        placeholder="e.g. EMP-1746"
                      />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
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
                    <div>
                      <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                        Employment Status
                      </label>
                      <select
                        className="filter-select"
                        style={{ width: '100%', fontSize: '12px' }}
                        value={staffFormData.employment_status}
                        onChange={(e) => setStaffFormData({ ...staffFormData, employment_status: e.target.value })}
                      >
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="INACTIVE">INACTIVE</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
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
                <UserPlus size={14} />
                <span>{staffSubmitting ? 'Creating Account...' : 'Create Staff Account'}</span>
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
      {/* MODAL: Enroll Security Personnel & Credentials                     */}
      {/* =================================================================== */}
      {enrollSecurityOpen && (
        <Modal
          isOpen={enrollSecurityOpen}
          onClose={() => setEnrollSecurityOpen(false)}
          title="Enroll Campus Security Personnel"
          subtitle="Register campus security officer and configure their portal login access"
          maxWidth="640px"
        >
          {securityEnrollError && (
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
              {securityEnrollError}
            </div>
          )}

          <form onSubmit={handleEnrollSecuritySubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  System Role *
                </label>
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: '#f1f5f9',
                    border: '1px solid #e2e8f0',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#0f172a',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <ShieldCheck size={15} style={{ color: '#ea580c' }} />
                  <span>Security Guard (Campus Security)</span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Badge / Security ID *
                </label>
                <input
                  type="text"
                  className="filter-search-input"
                  style={{ width: '100%', fontSize: '13px' }}
                  placeholder="e.g. SEC-1042"
                  value={securityEnrollFormData.employee_number}
                  onChange={(e) => setSecurityEnrollFormData({ ...securityEnrollFormData, employee_number: e.target.value })}
                  required
                />
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Full Name *
                </label>
                <input
                  type="text"
                  className="filter-search-input"
                  style={{ width: '100%', fontSize: '13px' }}
                  placeholder="e.g. Rajesh Kumar"
                  value={securityEnrollFormData.name}
                  onChange={(e) => setSecurityEnrollFormData({ ...securityEnrollFormData, name: e.target.value, first_name: e.target.value })}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Primary Phone *
                </label>
                <input
                  type="tel"
                  className="filter-search-input"
                  style={{ width: '100%', fontSize: '13px' }}
                  placeholder="+91 9876543210"
                  value={securityEnrollFormData.phone}
                  onChange={(e) => setSecurityEnrollFormData({ ...securityEnrollFormData, phone: e.target.value })}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Alternate Phone
                </label>
                <input
                  type="tel"
                  className="filter-search-input"
                  style={{ width: '100%', fontSize: '13px' }}
                  placeholder="Secondary telephone"
                  value={securityEnrollFormData.alternate_phone}
                  onChange={(e) => setSecurityEnrollFormData({ ...securityEnrollFormData, alternate_phone: e.target.value })}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Date of Joining
                </label>
                <input
                  type="date"
                  className="filter-search-input"
                  style={{ width: '100%', fontSize: '13px' }}
                  value={securityEnrollFormData.joining_date}
                  onChange={(e) => setSecurityEnrollFormData({ ...securityEnrollFormData, joining_date: e.target.value })}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Initial Gate Post (Optional)
                </label>
                <select
                  className="filter-select"
                  style={{ width: '100%', fontSize: '13px' }}
                  value={securityEnrollFormData.gate_id}
                  onChange={(e) => setSecurityEnrollFormData({ ...securityEnrollFormData, gate_id: e.target.value })}
                >
                  <option value="">Assign Later / Not Posted Yet</option>
                  {gatesList.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Security Portal Access & Credentials Card */}
            <div
              style={{
                marginTop: '16px',
                padding: '16px',
                borderRadius: '10px',
                border: '1px solid #fed7aa',
                backgroundColor: '#fff7ed',
                marginBottom: '20px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    backgroundColor: '#ffedd5',
                    color: '#c2410c',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Lock size={15} />
                </div>
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#9a3412' }}>
                    Security Portal Access & Credentials (Security ID & Password)
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#c2410c' }}>
                    Set up login credentials so the security officer can sign in to the Campus Gate Security Portal.
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#431407', marginBottom: '4px' }}>
                    Security Login ID / Email Address *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="email"
                      className="filter-search-input"
                      style={{ width: '100%', paddingLeft: '34px', fontSize: '13px' }}
                      placeholder="e.g. security.officer@college.edu"
                      value={securityEnrollFormData.email}
                      onChange={(e) => setSecurityEnrollFormData({ ...securityEnrollFormData, email: e.target.value })}
                      required
                    />
                    <Mail
                      size={15}
                      style={{
                        position: 'absolute',
                        left: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: '#94a3b8',
                        pointerEvents: 'none',
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#431407', marginBottom: '4px' }}>
                      Security Portal Password *
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showSecurityPassword ? 'text' : 'password'}
                        className="filter-search-input"
                        style={{ width: '100%', paddingRight: '36px', fontSize: '13px' }}
                        placeholder="Min 8 characters"
                        value={securityEnrollFormData.password}
                        onChange={(e) => setSecurityEnrollFormData({ ...securityEnrollFormData, password: e.target.value })}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecurityPassword(!showSecurityPassword)}
                        style={{
                          position: 'absolute',
                          right: '8px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: '#64748b',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          padding: '4px',
                        }}
                        tabIndex={-1}
                        title={showSecurityPassword ? 'Hide password' : 'Show password'}
                      >
                        {showSecurityPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#431407', marginBottom: '4px' }}>
                      Retype Password *
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showSecurityConfirmPassword ? 'text' : 'password'}
                        className="filter-search-input"
                        style={{ width: '100%', paddingRight: '36px', fontSize: '13px' }}
                        placeholder="Confirm password"
                        value={securityEnrollFormData.confirm_password}
                        onChange={(e) => setSecurityEnrollFormData({ ...securityEnrollFormData, confirm_password: e.target.value })}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecurityConfirmPassword(!showSecurityConfirmPassword)}
                        style={{
                          position: 'absolute',
                          right: '8px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: '#64748b',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          padding: '4px',
                        }}
                        tabIndex={-1}
                        title={showSecurityConfirmPassword ? 'Hide password' : 'Show password'}
                      >
                        {showSecurityConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn-enterprise-secondary"
                onClick={() => setEnrollSecurityOpen(false)}
                disabled={securityEnrollSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-enterprise-primary"
                disabled={securityEnrollSubmitting}
              >
                {securityEnrollSubmitting ? 'Registering...' : 'Enroll Security Officer'}
              </button>
            </div>
          </form>
        </Modal>
      )}

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
                {staffList.map((s) => {
                  const isSec = s.role_code === 'SECURITY' || s.role_code === 'SECURITY_GUARD' || (s.designation || '').toLowerCase().includes('security') || (s.designation || '').toLowerCase().includes('guard');
                  return (
                    <option key={s.id} value={s.id}>
                      {isSec ? '[Security] ' : ''}{getStaffFullName(s)} ({s.employee_number || 'No Code'} - {s.designation || 'Staff'})
                    </option>
                  );
                })}
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
