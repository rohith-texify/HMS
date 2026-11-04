import React, { useState, useEffect, useCallback, useMemo } from 'react';
import adminService from '../services/adminService';
import {
  GraduationCap,
  Search,
  RefreshCw,
  Phone,
  Mail,
  UserCheck,
  Plus,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  Lock,
  Key,
  ShieldAlert,
  UserX,
  Users,
  Building2,
  BedDouble,
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Link as LinkIcon,
  Unlink,
  HeartHandshake,
  Calendar,
  FileText,
  LayoutGrid,
  List,
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

export default function AdminStudentsPage() {
  // Primary State
  const [students, setStudents] = useState([]);
  const [parents, setParents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // View & Display Mode: CARDS (visual grid) or TABLE (tabular list)
  const [displayMode, setDisplayMode] = useState('CARDS');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [hostelStatusFilter, setHostelStatusFilter] = useState('ALL');

  // Modals & Drawers
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [linkParentModalOpen, setLinkParentModalOpen] = useState(false);
  const [addEmergencyModalOpen, setAddEmergencyModalOpen] = useState(false);
  const [unlinkConfirmOpen, setUnlinkConfirmOpen] = useState(false);
  const [deleteEmergencyConfirmOpen, setDeleteEmergencyConfirmOpen] = useState(false);

  // Selected Records
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentParents, setStudentParents] = useState([]);
  const [studentEmergencyContacts, setStudentEmergencyContacts] = useState([]);
  const [loadingRelations, setLoadingRelations] = useState(false);
  const [selectedRelationshipToUnlink, setSelectedRelationshipToUnlink] = useState(null);
  const [selectedEmergencyToDelete, setSelectedEmergencyToDelete] = useState(null);

  // Form State
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    admission_number: '',
    registration_number: '',
    roll_number: '',
    first_name: '',
    middle_name: '',
    last_name: '',
    gender: 'MALE',
    blood_group: 'O+',
    phone: '',
    email: '',
    password: '',
    confirm_password: '',
    date_of_birth: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'India',
    student_status: 'ACTIVE',
    hostel_status: 'NOT_ALLOCATED',
  });

  // Link Parent Form State
  const [linkParentData, setLinkParentData] = useState({
    parent_id: '',
    relationship: 'FATHER',
    is_primary: true,
    can_receive_notifications: true,
    can_pickup_student: true,
  });

  // Emergency Contact Form State
  const [emergencyData, setEmergencyData] = useState({
    contact_name: '',
    relationship: 'GUARDIAN',
    phone: '',
    alternate_phone: '',
    email: '',
    is_primary: true,
  });

  // New Status Selection
  const [newStatus, setNewStatus] = useState('ACTIVE');

  // Load Students and Parents Catalog
  const loadData = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const [studRes, parentRes] = await Promise.allSettled([
        adminService.getStudents(),
        adminService.getParents(),
      ]);

      if (studRes.status === 'fulfilled') {
        const d = studRes.value?.data || studRes.value;
        setStudents(Array.isArray(d) ? d : d?.students || []);
      } else {
        setError(studRes.reason?.message || 'Failed to retrieve students');
      }

      if (parentRes.status === 'fulfilled') {
        const d = parentRes.value?.data || parentRes.value;
        setParents(Array.isArray(d) ? d : d?.parents || []);
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load Related Data (Parents & Emergency Contacts) for Profile View
  const loadStudentRelations = useCallback(async (studentId) => {
    if (!studentId) return;
    setLoadingRelations(true);
    try {
      const [parentsRes, emergencyRes] = await Promise.allSettled([
        adminService.getStudentParents(studentId),
        adminService.getEmergencyContacts(studentId),
      ]);

      if (parentsRes.status === 'fulfilled') {
        const d = parentsRes.value?.data || parentsRes.value;
        setStudentParents(Array.isArray(d) ? d : []);
      }
      if (emergencyRes.status === 'fulfilled') {
        const d = emergencyRes.value?.data || emergencyRes.value;
        setStudentEmergencyContacts(Array.isArray(d) ? d : []);
      }
    } catch (err) {
      console.warn('Failed to load student relations:', err);
    } finally {
      setLoadingRelations(false);
    }
  }, []);

  // Open Full Profile View
  const handleOpenProfile = (student) => {
    setSelectedStudent(student);
    setProfileModalOpen(true);
    loadStudentRelations(student.id);
  };

  // Open Edit Modal
  const handleOpenEdit = (student) => {
    setSelectedStudent(student);
    setFormError(null);
    setFormData({
      admission_number: student.admission_number || '',
      registration_number: student.registration_number || '',
      roll_number: student.roll_number || '',
      first_name: student.first_name || '',
      middle_name: student.middle_name || '',
      last_name: student.last_name || '',
      gender: student.gender || 'MALE',
      blood_group: student.blood_group || 'O+',
      phone: student.phone || '',
      email: student.email || '',
      date_of_birth: student.date_of_birth ? student.date_of_birth.slice(0, 10) : '',
      address_line1: student.address_line1 || '',
      address_line2: student.address_line2 || '',
      city: student.city || '',
      state: student.state || '',
      postal_code: student.postal_code || '',
      country: student.country || 'India',
      student_status: student.student_status || 'ACTIVE',
      hostel_status: student.hostel_status || 'UNALLOCATED',
    });
    setEditModalOpen(true);
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    setFormError(null);
    setShowPassword(false);
    setShowConfirmPassword(false);
    setFormData({
      admission_number: '',
      registration_number: '',
      roll_number: '',
      first_name: '',
      middle_name: '',
      last_name: '',
      gender: 'MALE',
      blood_group: 'O+',
      phone: '',
      email: '',
      password: '',
      confirm_password: '',
      date_of_birth: '',
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      postal_code: '',
      country: 'India',
      student_status: 'ACTIVE',
      hostel_status: 'NOT_ALLOCATED',
    });
    setCreateModalOpen(true);
  };

  // Open Status Management Modal
  const handleOpenStatusModal = (student) => {
    setSelectedStudent(student);
    setNewStatus(student.student_status || 'ACTIVE');
    setStatusModalOpen(true);
  };

  // Submit Student Creation
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.admission_number.trim() || !formData.first_name.trim()) {
      setFormError('Admission Number and First Name are mandatory fields.');
      return;
    }

    if (formData.password?.trim()) {
      if (formData.password.trim().length < 8) {
        setFormError('Password must be at least 8 characters long.');
        return;
      }
      if (formData.password !== formData.confirm_password) {
        setFormError('Password and Confirm Password do not match.');
        return;
      }
      if (!formData.email?.trim()) {
        setFormError('Institutional Email Address is required when creating portal login access.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        admission_number: formData.admission_number.trim(),
        registration_number: formData.registration_number?.trim() || null,
        roll_number: formData.roll_number?.trim() || null,
        first_name: formData.first_name.trim(),
        middle_name: formData.middle_name?.trim() || null,
        last_name: formData.last_name?.trim() || null,
        gender: formData.gender || null,
        blood_group: formData.blood_group || null,
        phone: formData.phone?.trim() || null,
        email: formData.email?.trim() || null,
        password: formData.password?.trim() || null,
        confirm_password: formData.confirm_password?.trim() || null,
        date_of_birth: formData.date_of_birth ? new Date(formData.date_of_birth).toISOString() : null,
        address_line1: formData.address_line1?.trim() || null,
        address_line2: formData.address_line2?.trim() || null,
        city: formData.city?.trim() || null,
        state: formData.state?.trim() || null,
        postal_code: formData.postal_code?.trim() || null,
        country: formData.country?.trim() || null,
        student_status: formData.student_status || 'ACTIVE',
        hostel_status: (formData.hostel_status === 'UNALLOCATED' || !formData.hostel_status) ? 'NOT_ALLOCATED' : formData.hostel_status,
      };

      await adminService.createStudent(payload);
      setCreateModalOpen(false);
      loadData(true);
    } catch (err) {
      setFormError(err.message || 'Failed to create student account');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Student Edit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStudent) return;
    setFormError(null);

    if (!formData.admission_number.trim() || !formData.first_name.trim()) {
      setFormError('Admission Number and First Name are required.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        admission_number: formData.admission_number.trim(),
        first_name: formData.first_name.trim(),
        middle_name: formData.middle_name?.trim() || null,
        last_name: formData.last_name?.trim() || null,
        registration_number: formData.registration_number?.trim() || null,
        roll_number: formData.roll_number?.trim() || null,
        gender: formData.gender || null,
        blood_group: formData.blood_group || null,
        phone: formData.phone?.trim() || null,
        email: formData.email?.trim() || null,
        date_of_birth: formData.date_of_birth ? new Date(formData.date_of_birth).toISOString() : null,
        address_line1: formData.address_line1?.trim() || null,
        address_line2: formData.address_line2?.trim() || null,
        city: formData.city?.trim() || null,
        state: formData.state?.trim() || null,
        postal_code: formData.postal_code?.trim() || null,
        country: formData.country?.trim() || null,
      };

      await adminService.updateStudent(selectedStudent.id, payload);
      setEditModalOpen(false);
      loadData(true);
    } catch (err) {
      setFormError(err.message || 'Failed to update student details');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Status Change
  const handleStatusSubmit = async () => {
    if (!selectedStudent) return;
    setSubmitting(true);
    try {
      await adminService.updateStudentStatus(selectedStudent.id, newStatus);
      setStatusModalOpen(false);
      loadData(true);
    } catch (err) {
      alert(`Status Update Failed: ${err.message || 'Error updating student status'}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Link Parent to Student
  const handleLinkParentSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStudent || !linkParentData.parent_id) return;
    setSubmitting(true);
    try {
      await adminService.linkStudentParent(selectedStudent.id, linkParentData);
      setLinkParentModalOpen(false);
      loadStudentRelations(selectedStudent.id);
    } catch (err) {
      alert(`Parent Link Failed: ${err.message || 'Error linking parent'}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Unlink Parent
  const handleConfirmUnlink = async () => {
    if (!selectedStudent || !selectedRelationshipToUnlink) return;
    setSubmitting(true);
    try {
      await adminService.unlinkStudentParent(selectedStudent.id, selectedRelationshipToUnlink.id);
      setUnlinkConfirmOpen(false);
      loadStudentRelations(selectedStudent.id);
    } catch (err) {
      alert(`Unlink Failed: ${err.message || 'Error unlinking parent'}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Add Emergency Contact
  const handleAddEmergencySubmit = async (e) => {
    e.preventDefault();
    if (!selectedStudent || !emergencyData.contact_name.trim() || !emergencyData.phone.trim()) {
      alert('Contact Name and Phone are required.');
      return;
    }
    setSubmitting(true);
    try {
      await adminService.createEmergencyContact(selectedStudent.id, emergencyData);
      setAddEmergencyModalOpen(false);
      loadStudentRelations(selectedStudent.id);
    } catch (err) {
      alert(`Failed to Add Emergency Contact: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Emergency Contact
  const handleConfirmDeleteEmergency = async () => {
    if (!selectedStudent || !selectedEmergencyToDelete) return;
    setSubmitting(true);
    try {
      await adminService.deleteEmergencyContact(selectedStudent.id, selectedEmergencyToDelete.id);
      setDeleteEmergencyConfirmOpen(false);
      loadStudentRelations(selectedStudent.id);
    } catch (err) {
      alert(`Failed to Delete Emergency Contact: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered Students List
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const q = searchTerm.toLowerCase();
      const fullName = `${s.first_name || ''} ${s.last_name || ''}`.toLowerCase();
      const adm = (s.admission_number || '').toLowerCase();
      const reg = (s.registration_number || '').toLowerCase();
      const roll = (s.roll_number || '').toLowerCase();
      const email = (s.email || '').toLowerCase();
      const phone = (s.phone || '').toLowerCase();

      const matchesSearch = !q || fullName.includes(q) || adm.includes(q) || reg.includes(q) || roll.includes(q) || email.includes(q) || phone.includes(q);

      const status = (s.student_status || 'ACTIVE').toUpperCase();
      const matchesStatus = statusFilter === 'ALL' || status === statusFilter;

      const hStatus = (s.hostel_status || 'NOT_ALLOCATED').toUpperCase();
      const normalizedHStatus = hStatus === 'UNALLOCATED' ? 'NOT_ALLOCATED' : hStatus;
      const normalizedFilter = hostelStatusFilter === 'UNALLOCATED' ? 'NOT_ALLOCATED' : hostelStatusFilter;
      const matchesHostelStatus = normalizedFilter === 'ALL' || normalizedHStatus === normalizedFilter;

      return matchesSearch && matchesStatus && matchesHostelStatus;
    });
  }, [students, searchTerm, statusFilter, hostelStatusFilter]);

  // KPI Calculations
  const totalCount = students.length;
  const activeCount = students.filter((s) => (s.student_status || '').toUpperCase() === 'ACTIVE').length;
  const allocatedCount = students.filter((s) => (s.hostel_status || '').toUpperCase() === 'ALLOCATED').length;
  const unallocatedCount = students.filter((s) => (s.hostel_status || '').toUpperCase() !== 'ALLOCATED').length;

  // Table Columns Definition
  const columns = [
    {
      header: 'Resident Student',
      key: 'name',
      render: (s) => {
        const initials = `${s.first_name?.[0] || 'S'}${s.last_name?.[0] || ''}`.toUpperCase();
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                backgroundColor: '#eff6ff',
                color: '#2563eb',
                fontWeight: 700,
                fontSize: '0.76rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {initials}
            </div>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {s.first_name} {s.last_name || ''}
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                {s.email || s.phone || 'No direct contact'}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      header: 'Admission / Reg / Roll',
      key: 'admission_number',
      render: (s) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span className="code-pill" title="Admission Number">{s.admission_number}</span>
            {s.registration_number && (
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  color: '#4f46e5',
                  backgroundColor: '#eef2ff',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  border: '1px solid #c7d2fe',
                }}
                title="Registration Number"
              >
                Reg: {s.registration_number}
              </span>
            )}
          </div>
          {s.roll_number && (
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '3px' }}>
              Roll: {s.roll_number}
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Student Status',
      key: 'student_status',
      render: (s) => {
        const status = (s.student_status || 'ACTIVE').toUpperCase();
        const badgeMap = {
          ACTIVE: 'badge-green',
          INACTIVE: 'badge-amber',
          SUSPENDED: 'badge-purple',
          ALUMNI: 'badge-gray',
          WITHDRAWN: 'badge-gray',
        };
        return <span className={`badge-enterprise ${badgeMap[status] || 'badge-blue'}`}>{status}</span>;
      },
    },
    {
      header: 'Hostel Status',
      key: 'hostel_status',
      render: (s) => {
        const status = (s.hostel_status || 'UNALLOCATED').toUpperCase();
        return (
          <span className={`badge-enterprise ${status === 'ALLOCATED' ? 'badge-blue' : 'badge-gray'}`}>
            {status}
          </span>
        );
      },
    },
    {
      header: 'Actions',
      key: 'actions',
      align: 'right',
      render: (s) => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
          <button
            type="button"
            className="btn-enterprise-secondary"
            style={{ padding: '5px 10px', fontSize: '0.76rem' }}
            onClick={() => handleOpenProfile(s)}
            title="View Full Profile"
          >
            <Eye size={13} />
            <span>Profile</span>
          </button>
          <button
            type="button"
            className="btn-enterprise-secondary"
            style={{ padding: '5px 8px' }}
            onClick={() => handleOpenEdit(s)}
            title="Edit Student"
          >
            <Edit2 size={13} />
          </button>
          <button
            type="button"
            className="btn-enterprise-secondary"
            style={{ padding: '5px 8px' }}
            onClick={() => handleOpenStatusModal(s)}
            title="Manage Account Status"
          >
            <ShieldAlert size={13} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="fade-in-up">
      {/* 1. Modern Enterprise Hero Header */}
      <div className="enterprise-hero-header">
        <div className="hero-header-titles">
          <div className="hero-category-pill">
            <GraduationCap size={13} />
            <span>Admissions & Campus Residents</span>
          </div>
          <h1 className="hero-main-title">Resident Students Directory</h1>
          <p className="hero-subtitle">
            Comprehensive residential student records, guardian linkages, bed allocation tracking, and status management.
          </p>
        </div>

        <div className="hero-action-buttons">
          <button
            type="button"
            className="btn-enterprise-secondary"
            onClick={() => loadData(true)}
            disabled={isRefreshing}
          >
            <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} />
            <span>{isRefreshing ? 'Syncing...' : 'Sync Directory'}</span>
          </button>
          <button
            type="button"
            className="btn-enterprise-primary"
            onClick={handleOpenCreate}
          >
            <Plus size={15} />
            <span>Enroll Student</span>
          </button>
        </div>
      </div>

      {/* 2. Executive KPI Cards */}
      <div className="kpi-cards-grid" style={{ marginBottom: '20px' }}>
        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-title">Total Enrolled</span>
            <div className="stat-kpi-icon-box" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
              <GraduationCap size={18} />
            </div>
          </div>
          <div className="stat-kpi-value">{totalCount}</div>
          <div className="stat-kpi-subtext">Active campus records</div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-title">Active Residents</span>
            <div className="stat-kpi-icon-box" style={{ backgroundColor: '#f0fdf4', color: '#16a34a' }}>
              <UserCheck size={18} />
            </div>
          </div>
          <div className="stat-kpi-value">{activeCount}</div>
          <div className="stat-kpi-subtext">Good administrative standing</div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-title">Allocated Beds</span>
            <div className="stat-kpi-icon-box" style={{ backgroundColor: '#faf5ff', color: '#9333ea' }}>
              <BedDouble size={18} />
            </div>
          </div>
          <div className="stat-kpi-value">{allocatedCount}</div>
          <div className="stat-kpi-subtext">Assigned to hostel rooms</div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-title">Awaiting Allotment</span>
            <div className="stat-kpi-icon-box" style={{ backgroundColor: '#fffbeb', color: '#d97706' }}>
              <Building2 size={18} />
            </div>
          </div>
          <div className="stat-kpi-value">{unallocatedCount}</div>
          <div className="stat-kpi-subtext">Unassigned residents</div>
        </div>
      </div>

      {/* 3. Search and Filters Toolbar */}
      <FilterControls
        totalRecords={filteredStudents.length}
        onReset={() => {
          setSearchTerm('');
          setStatusFilter('ALL');
          setHostelStatusFilter('ALL');
        }}
      >
        <SearchInput
          placeholder="Search by name, adm #, roll, phone, email..."
          value={searchTerm}
          onChange={setSearchTerm}
          width={300}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Status:</span>
          <select
            className="filter-search-input"
            style={{ width: 'auto', padding: '6px 12px' }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="ALUMNI">Alumni</option>
            <option value="WITHDRAWN">Withdrawn</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Hostel:</span>
          <select
            className="filter-search-input"
            style={{ width: 'auto', padding: '6px 12px' }}
            value={hostelStatusFilter}
            onChange={(e) => setHostelStatusFilter(e.target.value)}
          >
            <option value="ALL">All Allotments</option>
            <option value="ALLOCATED">Allocated</option>
            <option value="UNALLOCATED">Unallocated</option>
          </select>
        </div>

        {/* View Switcher: Cards vs Table */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
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
      </FilterControls>

      {/* 4. Enterprise Card Container */}
      <div className="enterprise-card" style={{ marginTop: '16px' }}>
        <div className="card-topbar">
          <div className="card-title-group">
            <div className="card-title-icon-wrap" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
              <GraduationCap size={16} />
            </div>
            <div>
              <h2 className="card-title-text">Enrolled Resident Students</h2>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                Showing {filteredStudents.length} of {students.length} registered students
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="badge-enterprise badge-emerald">
              <span className="live-pulse" />
              {activeCount} Active
            </span>
            <span className="badge-enterprise badge-blue">
              {allocatedCount} Allocated
            </span>
            {unallocatedCount > 0 && (
              <span className="badge-enterprise badge-amber">
                {unallocatedCount} Awaiting Bed
              </span>
            )}
          </div>
        </div>

        {error ? (
          <div style={{ padding: '24px' }}>
            <ErrorState title="Failed to load students" message={error} onRetry={() => loadData(true)} />
          </div>
        ) : loading ? (
          <div style={{ padding: '40px' }}>
            <LoadingState message="Loading resident directory..." />
          </div>
        ) : filteredStudents.length === 0 ? (
          <div style={{ padding: '40px' }}>
            <EmptyState
              title="No student records found"
              message="No residents match your search query or filter selection."
            />
          </div>
        ) : displayMode === 'CARDS' ? (
          <div style={{ padding: '20px' }}>
            <div className="students-grid-cards">
              {filteredStudents.map((s) => {
                const initials = `${s.first_name?.[0] || 'S'}${s.last_name?.[0] || ''}`.toUpperCase();
                const status = (s.student_status || 'ACTIVE').toLowerCase();
                const isAllocated = (s.hostel_status || '').toUpperCase() === 'ALLOCATED';

                return (
                  <div
                    key={s.id}
                    className={`student-card-v2 ${isAllocated ? 'allocated' : 'unallocated'}`}
                  >
                    {/* Card Top: Avatar, Name, Admission, Status Dot */}
                    <div className="student-card-top">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                        <div className="student-avatar-box">
                          {initials}
                          <span
                            className={`student-status-dot ${
                              status === 'active' ? 'active' : status === 'suspended' ? 'suspended' : 'inactive'
                            }`}
                            title={`Status: ${s.student_status || 'ACTIVE'}`}
                          />
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <h3 className="student-name-title" title={`${s.first_name} ${s.last_name || ''}`}>
                            {s.first_name} {s.last_name || ''}
                          </h3>
                          <div className="student-adm-sub" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span className="code-pill" style={{ fontSize: '0.7rem', padding: '2px 6px' }} title="Admission Number">
                              {s.admission_number || 'NO-ADM'}
                            </span>
                            {s.registration_number && (
                              <span
                                style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 600,
                                  color: '#4f46e5',
                                  backgroundColor: '#eef2ff',
                                  padding: '1px 5px',
                                  borderRadius: '4px',
                                  border: '1px solid #c7d2fe',
                                }}
                                title="Registration Number"
                              >
                                Reg: {s.registration_number}
                              </span>
                            )}
                            {s.roll_number && (
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Roll: {s.roll_number}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <span
                        className={`badge-enterprise ${
                          status === 'active'
                            ? 'badge-green'
                            : status === 'suspended'
                            ? 'badge-purple'
                            : 'badge-amber'
                        }`}
                        style={{ fontSize: '0.68rem', textTransform: 'uppercase' }}
                      >
                        {s.student_status || 'ACTIVE'}
                      </span>
                    </div>

                    {/* Card Body: Allocation pill, Contact Stack, Demographic chips */}
                    <div className="student-card-body">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <div
                          className={`student-allocation-pill ${isAllocated ? 'allocated' : 'unallocated'}`}
                        >
                          <BedDouble size={12} />
                          <span>{isAllocated ? 'Allocated to Bed' : 'Awaiting Bed Allotment'}</span>
                        </div>
                      </div>

                      <div className="student-contacts-stack">
                        <div className="student-contact-row" title={s.email || 'No email registered'}>
                          <Mail size={12} style={{ color: '#6366f1', flexShrink: 0 }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {s.email || 'No email registered'}
                          </span>
                        </div>
                        <div className="student-contact-row" title={s.phone || 'No phone registered'}>
                          <Phone size={12} style={{ color: '#10b981', flexShrink: 0 }} />
                          <span>{s.phone || 'No phone registered'}</span>
                        </div>
                        {(s.city || s.state) && (
                          <div className="student-contact-row" title={`${s.city || ''}, ${s.state || ''}`}>
                            <MapPin size={12} style={{ color: '#f59e0b', flexShrink: 0 }} />
                            <span>
                              {s.city || ''}{s.city && s.state ? ', ' : ''}{s.state || ''}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Demographics / Quick chips */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        {s.gender && (
                          <span
                            className="badge-enterprise badge-gray"
                            style={{ fontSize: '0.68rem', padding: '2px 7px' }}
                          >
                            {s.gender}
                          </span>
                        )}
                        {s.blood_group && (
                          <span
                            className="badge-enterprise badge-amber"
                            style={{ fontSize: '0.68rem', padding: '2px 7px' }}
                          >
                            Blood: {s.blood_group}
                          </span>
                        )}
                        {s.date_of_birth && (
                          <span
                            className="badge-enterprise badge-blue"
                            style={{ fontSize: '0.68rem', padding: '2px 7px' }}
                          >
                            DOB: {new Date(s.date_of_birth).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Card Footer: Action Buttons */}
                    <div className="student-card-footer">
                      <button
                        type="button"
                        className="btn-enterprise-secondary"
                        style={{ padding: '5px 10px', fontSize: '0.76rem', gap: '5px' }}
                        onClick={() => handleOpenProfile(s)}
                        title="View Full Profile & Guardians"
                      >
                        <Eye size={13} />
                        <span>Dossier & Guardians</span>
                      </button>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          className="btn-enterprise-secondary"
                          style={{ padding: '5px 8px' }}
                          onClick={() => handleOpenEdit(s)}
                          title="Edit Student Profile"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          className="btn-enterprise-secondary"
                          style={{ padding: '5px 8px' }}
                          onClick={() => handleOpenStatusModal(s)}
                          title="Manage Account Standing & Status"
                        >
                          <ShieldAlert size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div style={{ padding: '0' }}>
            <DataTable
              columns={columns}
              data={filteredStudents}
              rowKey="id"
              loading={loading}
              emptyTitle="No student records found"
              emptyMessage="No residents match your search query or filter selection."
              footer={
                <span>
                  Showing <strong>{filteredStudents.length}</strong> of <strong>{students.length}</strong> registered students
                </span>
              }
            />
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 5. MODAL: Student Detailed Profile Drawer & View                          */}
      {/* ========================================================================= */}
      {selectedStudent && (
        <Modal
          isOpen={profileModalOpen}
          onClose={() => setProfileModalOpen(false)}
          title={`${selectedStudent.first_name} ${selectedStudent.last_name || ''}`}
          subtitle={`Admission Number: ${selectedStudent.admission_number}`}
          maxWidth="720px"
          footer={
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn-enterprise-secondary"
                  onClick={() => {
                    setProfileModalOpen(false);
                    handleOpenEdit(selectedStudent);
                  }}
                >
                  <Edit2 size={13} />
                  <span>Edit Profile</span>
                </button>
                <button
                  type="button"
                  className="btn-enterprise-secondary"
                  onClick={() => {
                    setProfileModalOpen(false);
                    handleOpenStatusModal(selectedStudent);
                  }}
                >
                  <ShieldAlert size={13} />
                  <span>Change Status</span>
                </button>
              </div>
              <button
                type="button"
                className="btn-enterprise-secondary"
                onClick={() => setProfileModalOpen(false)}
              >
                Close
              </button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Header Badge Strip */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', paddingBottom: '14px', borderBottom: '1px solid var(--border-color)' }}>
              <span className="badge-enterprise badge-blue">
                Status: {selectedStudent.student_status || 'ACTIVE'}
              </span>
              <span className="badge-enterprise badge-purple">
                Hostel: {selectedStudent.hostel_status || 'UNALLOCATED'}
              </span>
              {selectedStudent.gender && (
                <span className="badge-enterprise badge-gray">Gender: {selectedStudent.gender}</span>
              )}
              {selectedStudent.blood_group && (
                <span className="badge-enterprise badge-amber">Blood: {selectedStudent.blood_group}</span>
              )}
            </div>

            {/* Academic & Contact Information */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Roll Number</span>
                <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>{selectedStudent.roll_number || 'N/A'}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Registration Number</span>
                <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>{selectedStudent.registration_number || 'N/A'}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Primary Phone</span>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Phone size={13} style={{ color: 'var(--text-muted)' }} />
                  <span>{selectedStudent.phone || 'N/A'}</span>
                </div>
              </div>
              <div>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Institutional Email</span>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Mail size={13} style={{ color: 'var(--text-muted)' }} />
                  <span>{selectedStudent.email || 'N/A'}</span>
                </div>
              </div>
              <div>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Date of Birth</span>
                <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>
                  {selectedStudent.date_of_birth ? new Date(selectedStudent.date_of_birth).toLocaleDateString() : 'N/A'}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Residential City / State</span>
                <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>
                  {selectedStudent.city || 'N/A'}, {selectedStudent.state || ''}
                </div>
              </div>
            </div>

            {/* Linked Parents & Guardians Section */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users size={16} style={{ color: 'var(--primary-color)' }} />
                  <strong style={{ fontSize: '0.92rem' }}>Parents & Guardians ({studentParents.length})</strong>
                </div>
                <button
                  type="button"
                  className="btn-enterprise-secondary"
                  style={{ padding: '4px 8px', fontSize: '0.74rem' }}
                  onClick={() => setLinkParentModalOpen(true)}
                >
                  <Plus size={12} />
                  <span>Link Parent</span>
                </button>
              </div>

              {loadingRelations ? (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  Loading linked guardians...
                </div>
              ) : studentParents.length === 0 ? (
                <div style={{ padding: '14px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px dashed var(--border-color)', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  No guardians linked to this student. Click "Link Parent" to associate a guardian.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {studentParents.map((rel) => {
                    const parentObj = parents.find((p) => p.id === rel.parent_id);
                    const parentName = parentObj ? `${parentObj.first_name} ${parentObj.last_name || ''}` : `Parent (${rel.parent_id.slice(0, 8)})`;
                    return (
                      <div
                        key={rel.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: '#ffffff',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.86rem' }}>
                            {parentName}
                            <span className="badge-enterprise badge-purple" style={{ marginLeft: '8px', fontSize: '0.68rem' }}>
                              {rel.relationship}
                            </span>
                            {rel.is_primary && (
                              <span className="badge-enterprise badge-green" style={{ marginLeft: '4px', fontSize: '0.68rem' }}>
                                Primary
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {parentObj?.phone && <span>Phone: {parentObj.phone} · </span>}
                            <span>Notifications: {rel.can_receive_notifications ? 'Yes' : 'No'}</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          className="btn-enterprise-secondary"
                          style={{ padding: '4px 8px', color: '#dc2626' }}
                          title="Unlink Parent"
                          onClick={() => {
                            setSelectedRelationshipToUnlink(rel);
                            setUnlinkConfirmOpen(true);
                          }}
                        >
                          <Unlink size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Emergency Contacts Section */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <HeartHandshake size={16} style={{ color: '#d97706' }} />
                  <strong style={{ fontSize: '0.92rem' }}>Emergency Contacts ({studentEmergencyContacts.length})</strong>
                </div>
                <button
                  type="button"
                  className="btn-enterprise-secondary"
                  style={{ padding: '4px 8px', fontSize: '0.74rem' }}
                  onClick={() => setAddEmergencyModalOpen(true)}
                >
                  <Plus size={12} />
                  <span>Add Emergency Contact</span>
                </button>
              </div>

              {studentEmergencyContacts.length === 0 ? (
                <div style={{ padding: '14px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px dashed var(--border-color)', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  No emergency contacts registered.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {studentEmergencyContacts.map((contact) => (
                    <div
                      key={contact.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: '#ffffff',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.86rem' }}>
                          {contact.contact_name}
                          <span className="badge-enterprise badge-blue" style={{ marginLeft: '8px', fontSize: '0.68rem' }}>
                            {contact.relationship || 'Emergency Contact'}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          <span>Phone: {contact.phone}</span>
                          {contact.alternate_phone && <span> · Alt: {contact.alternate_phone}</span>}
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn-enterprise-secondary"
                        style={{ padding: '4px 8px', color: '#dc2626' }}
                        title="Delete Contact"
                        onClick={() => {
                          setSelectedEmergencyToDelete(contact);
                          setDeleteEmergencyConfirmOpen(true);
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Audit History Unavailable State (Strict Phase 3.E Specification) */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Clock size={16} style={{ color: 'var(--text-muted)' }} />
                <strong style={{ fontSize: '0.92rem' }}>Student Profile History & Audit Log</strong>
                <span className="badge-enterprise badge-gray" style={{ fontSize: '0.66rem' }}>Unavailable</span>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.45 }}>
                Individual student lifecycle audit histories and profile diff logs are not exposed by the current backend HTTP API.
              </p>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* 6. MODAL: Create New Student Form                                        */}
      {/* ========================================================================= */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Enroll New Student Resident"
        subtitle="Provide student admissions metadata according to platform schema"
        maxWidth="640px"
        footer={
          <>
            <button
              type="button"
              className="btn-enterprise-secondary"
              onClick={() => setCreateModalOpen(false)}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-enterprise-primary"
              onClick={handleCreateSubmit}
              disabled={submitting}
            >
              {submitting ? 'Enrolling...' : 'Submit Enrollment'}
            </button>
          </>
        }
      >
        <form onSubmit={handleCreateSubmit}>
          {formError && (
            <div style={{ padding: '10px 14px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '8px', fontSize: '0.82rem', marginBottom: '14px' }}>
              {formError}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <FormField label="Admission Number" required>
              <input
                type="text"
                className="filter-search-input"
                style={{ width: '100%' }}
                value={formData.admission_number}
                onChange={(e) => setFormData({ ...formData, admission_number: e.target.value })}
                required
              />
            </FormField>

            <FormField label="Registration Number / Register No">
              <input
                type="text"
                className="filter-search-input"
                style={{ width: '100%' }}
                placeholder="e.g. 720321104001"
                value={formData.registration_number}
                onChange={(e) => setFormData({ ...formData, registration_number: e.target.value })}
              />
            </FormField>

            <FormField label="Roll Number">
              <input
                type="text"
                className="filter-search-input"
                style={{ width: '100%' }}
                placeholder="e.g. 26CS101"
                value={formData.roll_number}
                onChange={(e) => setFormData({ ...formData, roll_number: e.target.value })}
              />
            </FormField>

            <FormField label="First Name" required>
              <input
                type="text"
                className="filter-search-input"
                style={{ width: '100%' }}
                placeholder="First name"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                required
              />
            </FormField>

            <FormField label="Last Name">
              <input
                type="text"
                className="filter-search-input"
                style={{ width: '100%' }}
                placeholder="Last name"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
              />
            </FormField>

            <FormField label="Primary Phone">
              <input
                type="tel"
                className="filter-search-input"
                style={{ width: '100%' }}
                placeholder="+91 9876543210"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </FormField>

            <FormField label="Gender">
              <select
                className="filter-search-input"
                style={{ width: '100%' }}
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
              >
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </FormField>

            <FormField label="Blood Group">
              <select
                className="filter-search-input"
                style={{ width: '100%' }}
                value={formData.blood_group}
                onChange={(e) => setFormData({ ...formData, blood_group: e.target.value })}
              >
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
              </select>
            </FormField>
          </div>

          {/* Student Portal Account & Login Access */}
          <div
            style={{
              marginTop: '18px',
              padding: '16px',
              borderRadius: '10px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  backgroundColor: '#e0e7ff',
                  color: '#4338ca',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Lock size={15} />
              </div>
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Student Portal Access & Credentials
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  Create the student's institutional login credentials to enable direct student portal access.
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px', marginTop: '12px' }}>
              <FormField label="Institutional College Email" required={Boolean(formData.password?.trim())}>
                <input
                  type="email"
                  className="filter-search-input"
                  style={{ width: '100%' }}
                  placeholder="e.g. student.regno@college.edu"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required={Boolean(formData.password?.trim())}
                />
              </FormField>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <FormField label="Portal Password" required={Boolean(formData.email?.trim())}>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="filter-search-input"
                      style={{ width: '100%', paddingRight: '36px' }}
                      placeholder="Min 8 characters"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
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
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        padding: '4px',
                      }}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </FormField>

                <FormField label="Retype Password" required={Boolean(formData.password?.trim())}>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      className="filter-search-input"
                      style={{ width: '100%', paddingRight: '36px' }}
                      placeholder="Confirm password"
                      value={formData.confirm_password}
                      onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        padding: '4px',
                      }}
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </FormField>
              </div>
            </div>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* 7. MODAL: Edit Student Form                                              */}
      {/* ========================================================================= */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit Student Information"
        subtitle={`Updating profile for: ${formData.first_name} ${formData.last_name || ''}`}
        maxWidth="640px"
        footer={
          <>
            <button
              type="button"
              className="btn-enterprise-secondary"
              onClick={() => setEditModalOpen(false)}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-enterprise-primary"
              onClick={handleEditSubmit}
              disabled={submitting}
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </>
        }
      >
        <form onSubmit={handleEditSubmit}>
          {formError && (
            <div style={{ padding: '10px 14px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '8px', fontSize: '0.82rem', marginBottom: '14px' }}>
              {formError}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <FormField label="Admission Number" required>
              <input
                type="text"
                className="filter-search-input"
                style={{ width: '100%' }}
                value={formData.admission_number}
                onChange={(e) => setFormData({ ...formData, admission_number: e.target.value })}
                required
              />
            </FormField>

            <FormField label="Roll Number">
              <input
                type="text"
                className="filter-search-input"
                style={{ width: '100%' }}
                value={formData.roll_number}
                onChange={(e) => setFormData({ ...formData, roll_number: e.target.value })}
              />
            </FormField>

            <FormField label="First Name" required>
              <input
                type="text"
                className="filter-search-input"
                style={{ width: '100%' }}
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                required
              />
            </FormField>

            <FormField label="Last Name">
              <input
                type="text"
                className="filter-search-input"
                style={{ width: '100%' }}
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
              />
            </FormField>

            <FormField label="Email Address">
              <input
                type="email"
                className="filter-search-input"
                style={{ width: '100%' }}
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </FormField>

            <FormField label="Primary Phone">
              <input
                type="tel"
                className="filter-search-input"
                style={{ width: '100%' }}
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </FormField>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* 8. MODAL: Student Status Management                                      */}
      {/* ========================================================================= */}
      {selectedStudent && (
        <Modal
          isOpen={statusModalOpen}
          onClose={() => setStatusModalOpen(false)}
          title="Manage Student Account Status"
          subtitle={`Student: ${selectedStudent.first_name} ${selectedStudent.last_name || ''} (${selectedStudent.admission_number})`}
          maxWidth="460px"
          footer={
            <>
              <button
                type="button"
                className="btn-enterprise-secondary"
                onClick={() => setStatusModalOpen(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-enterprise-primary"
                onClick={handleStatusSubmit}
                disabled={submitting}
              >
                {submitting ? 'Updating...' : 'Confirm Status Change'}
              </button>
            </>
          }
        >
          <div>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              Changing account status governs residential hostel check-in privileges and portal access.
            </p>

            <FormField label="Select Status State">
              <select
                className="filter-search-input"
                style={{ width: '100%' }}
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
              >
                <option value="ACTIVE">ACTIVE (Nominal residential standing)</option>
                <option value="INACTIVE">INACTIVE (Temporarily offline)</option>
                <option value="SUSPENDED">SUSPENDED (Disciplinary gate restrictions)</option>
                <option value="ALUMNI">ALUMNI (Graduated & departed)</option>
                <option value="WITHDRAWN">WITHDRAWN (Admissions terminated)</option>
              </select>
            </FormField>
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* 9. MODAL: Link Existing Parent to Student                                */}
      {/* ========================================================================= */}
      {selectedStudent && (
        <Modal
          isOpen={linkParentModalOpen}
          onClose={() => setLinkParentModalOpen(false)}
          title="Link Parent / Guardian to Student"
          subtitle={`Student: ${selectedStudent.first_name} ${selectedStudent.last_name || ''}`}
          maxWidth="500px"
          footer={
            <>
              <button
                type="button"
                className="btn-enterprise-secondary"
                onClick={() => setLinkParentModalOpen(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-enterprise-primary"
                onClick={handleLinkParentSubmit}
                disabled={submitting || !linkParentData.parent_id}
              >
                {submitting ? 'Linking...' : 'Establish Link'}
              </button>
            </>
          }
        >
          <form onSubmit={handleLinkParentSubmit}>
            <FormField label="Select Registered Parent" required>
              <select
                className="filter-search-input"
                style={{ width: '100%' }}
                value={linkParentData.parent_id}
                onChange={(e) => setLinkParentData({ ...linkParentData, parent_id: e.target.value })}
                required
              >
                <option value="">-- Choose from Registered Parents ({parents.length}) --</option>
                {parents.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.first_name} {p.last_name || ''} ({p.relationship || 'Guardian'} · {p.phone || p.email || 'No contact'})
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Relationship Role" required>
              <select
                className="filter-search-input"
                style={{ width: '100%' }}
                value={linkParentData.relationship}
                onChange={(e) => setLinkParentData({ ...linkParentData, relationship: e.target.value })}
                required
              >
                <option value="FATHER">Father</option>
                <option value="MOTHER">Mother</option>
                <option value="GUARDIAN">Legal Guardian</option>
                <option value="SIBLING">Sibling</option>
                <option value="OTHER">Other</option>
              </select>
            </FormField>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem' }}>
                <input
                  type="checkbox"
                  checked={linkParentData.is_primary}
                  onChange={(e) => setLinkParentData({ ...linkParentData, is_primary: e.target.checked })}
                />
                <span>Primary Emergency Contact Guardian</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem' }}>
                <input
                  type="checkbox"
                  checked={linkParentData.can_receive_notifications}
                  onChange={(e) => setLinkParentData({ ...linkParentData, can_receive_notifications: e.target.checked })}
                />
                <span>Authorized to Receive Campus Broadcasts & Alerts</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem' }}>
                <input
                  type="checkbox"
                  checked={linkParentData.can_pickup_student}
                  onChange={(e) => setLinkParentData({ ...linkParentData, can_pickup_student: e.target.checked })}
                />
                <span>Authorized for Campus Gate Pickup</span>
              </label>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* 10. MODAL: Add Emergency Contact                                         */}
      {/* ========================================================================= */}
      {selectedStudent && (
        <Modal
          isOpen={addEmergencyModalOpen}
          onClose={() => setAddEmergencyModalOpen(false)}
          title="Register Emergency Contact"
          subtitle={`Student: ${selectedStudent.first_name} ${selectedStudent.last_name || ''}`}
          maxWidth="500px"
          footer={
            <>
              <button
                type="button"
                className="btn-enterprise-secondary"
                onClick={() => setAddEmergencyModalOpen(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-enterprise-primary"
                onClick={handleAddEmergencySubmit}
                disabled={submitting}
              >
                {submitting ? 'Registering...' : 'Save Contact'}
              </button>
            </>
          }
        >
          <form onSubmit={handleAddEmergencySubmit}>
            <FormField label="Contact Person Name" required>
              <input
                type="text"
                className="filter-search-input"
                style={{ width: '100%' }}
                placeholder="Full Name"
                value={emergencyData.contact_name}
                onChange={(e) => setEmergencyData({ ...emergencyData, contact_name: e.target.value })}
                required
              />
            </FormField>

            <FormField label="Relationship" required>
              <input
                type="text"
                className="filter-search-input"
                style={{ width: '100%' }}
                placeholder="e.g. Uncle, Family Doctor, Local Guardian"
                value={emergencyData.relationship}
                onChange={(e) => setEmergencyData({ ...emergencyData, relationship: e.target.value })}
                required
              />
            </FormField>

            <FormField label="Primary Contact Phone" required>
              <input
                type="tel"
                className="filter-search-input"
                style={{ width: '100%' }}
                placeholder="+91 9876543210"
                value={emergencyData.phone}
                onChange={(e) => setEmergencyData({ ...emergencyData, phone: e.target.value })}
                required
              />
            </FormField>

            <FormField label="Alternate Phone">
              <input
                type="tel"
                className="filter-search-input"
                style={{ width: '100%' }}
                placeholder="Secondary contact"
                value={emergencyData.alternate_phone}
                onChange={(e) => setEmergencyData({ ...emergencyData, alternate_phone: e.target.value })}
              />
            </FormField>
          </form>
        </Modal>
      )}

      {/* Confirmation Dialogs */}
      <ConfirmationDialog
        isOpen={unlinkConfirmOpen}
        onCancel={() => setUnlinkConfirmOpen(false)}
        onConfirm={handleConfirmUnlink}
        title="Unlink Parent Guardian"
        message="Are you sure you wish to sever this parent-student guardian relationship? This will remove direct notification privileges."
        confirmText="Unlink Guardian"
        confirmVariant="danger"
        loading={submitting}
      />

      <ConfirmationDialog
        isOpen={deleteEmergencyConfirmOpen}
        onCancel={() => setDeleteEmergencyConfirmOpen(false)}
        onConfirm={handleConfirmDeleteEmergency}
        title="Delete Emergency Contact"
        message="Are you sure you want to remove this emergency contact record?"
        confirmText="Delete Record"
        confirmVariant="danger"
        loading={submitting}
      />
    </div>
  );
}
