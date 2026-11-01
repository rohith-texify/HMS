import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import adminService from '../services/adminService';
import { useAuth } from '../../../shared/auth/useAuth';
import {
  BedDouble,
  GraduationCap,
  Building2,
  DoorOpen,
  Search,
  Plus,
  RefreshCw,
  Edit2,
  Trash2,
  Eye,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRightLeft,
  LogOut,
  Calendar,
  Layers,
  Sparkles,
  UserCheck,
  UserX,
  FileText,
  Info,
  ChevronRight,
  ShieldCheck,
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

export default function AdminAllocationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Permissions check
  const canManageAllocations = useMemo(() => {
    if (!user) return true;
    if (['COLLEGE_ADMIN', 'ADMIN', 'HOSTEL_ADMIN'].includes(user?.role)) return true;
    if (Array.isArray(user?.permissions)) {
      return (
        user.permissions.includes('people.manage') ||
        user.permissions.includes('hostel.manage') ||
        user.permissions.includes('*')
      );
    }
    return true;
  }, [user]);

  // Master Data State
  const [allocations, setAllocations] = useState([]);
  const [students, setStudents] = useState([]);
  const [hostels, setHostels] = useState([]);

  // Accommodation Structure Cache for lookups: { hostelId: { blocks: [...] } }
  const [hostelBlocksMap, setHostelBlocksMap] = useState({});
  const [blockFloorsMap, setBlockFloorsMap] = useState({});
  const [floorRoomsMap, setFloorRoomsMap] = useState({});
  const [roomBedsMap, setRoomBedsMap] = useState({});

  // UI & Loading States
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successBanner, setSuccessBanner] = useState(null);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [hostelFilter, setHostelFilter] = useState('ALL');

  // Modals Visibility
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [releaseModalOpen, setReleaseModalOpen] = useState(false);
  const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(false);

  // Active Selected Allocation for Modals
  const [selectedAllocation, setSelectedAllocation] = useState(null);

  // Form States & Cascading Selectors
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  // Create Allocation Form
  const [createFormData, setCreateFormData] = useState({
    student_id: '',
    hostel_id: '',
    block_id: '',
    floor_id: '',
    room_id: '',
    bed_id: '',
    allocation_type: 'REGULAR',
    allocated_at: new Date().toISOString().split('T')[0],
    remarks: '',
  });

  // Transfer Allocation Form
  const [transferFormData, setTransferFormData] = useState({
    hostel_id: '',
    block_id: '',
    floor_id: '',
    room_id: '',
    new_bed_id: '',
    transferred_at: new Date().toISOString().split('T')[0],
  });

  // Release Allocation Form
  const [releaseFormData, setReleaseFormData] = useState({
    released_at: new Date().toISOString().split('T')[0],
    status: 'RELEASED',
  });

  // Cascading options for Create & Transfer
  const [cascadingBlocks, setCascadingBlocks] = useState([]);
  const [cascadingFloors, setCascadingFloors] = useState([]);
  const [cascadingRooms, setCascadingRooms] = useState([]);
  const [cascadingBeds, setCascadingBeds] = useState([]);
  const [cascadingLoading, setCascadingLoading] = useState(false);

  // Auto-dismiss banner
  useEffect(() => {
    if (successBanner) {
      const timer = setTimeout(() => setSuccessBanner(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successBanner]);

  // =========================================================================
  // Master Data Loading
  // =========================================================================
  const loadMasterData = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    else setLoading(true);
    setErrorMessage(null);

    try {
      // 1. Fetch Allocations
      const allocRes = await adminService.getBedAllocations();
      const rawAlloc = Array.isArray(allocRes) ? allocRes : allocRes?.allocations || [];
      setAllocations(rawAlloc);

      // 2. Fetch Students
      const studRes = await adminService.getStudents();
      const rawStudents = Array.isArray(studRes) ? studRes : studRes?.students || [];
      setStudents(rawStudents);

      // 3. Fetch Hostels
      const hostelsRes = await adminService.getHostels();
      const rawHostels = Array.isArray(hostelsRes) ? hostelsRes : hostelsRes?.hostels || [];
      setHostels(rawHostels);
    } catch (err) {
      console.error('Failed to load room allocation records:', err);
      setErrorMessage(err.message || 'Failed to retrieve bed allocations and hostel records.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadMasterData();
  }, [loadMasterData]);

  // Maps for Quick Lookup
  const studentMap = useMemo(() => {
    const map = new Map();
    students.forEach((st) => map.set(st.id, st));
    return map;
  }, [students]);

  const hostelMap = useMemo(() => {
    const map = new Map();
    hostels.forEach((h) => map.set(h.id, h));
    return map;
  }, [hostels]);

  // =========================================================================
  // KPI Metrics Calculation
  // =========================================================================
  const totalAllocations = allocations.length;
  const activeAllocations = allocations.filter((a) => a.status === 'ACTIVE');
  const activeCount = activeAllocations.length;
  const releasedCount = allocations.filter((a) => a.status === 'RELEASED').length;
  const transferredCount = allocations.filter((a) => a.status === 'TRANSFERRED').length;

  const totalHostelCapacity = hostels.reduce(
    (sum, h) => sum + (parseInt(h.total_capacity, 10) || 0),
    0
  );
  const campusOccupancyRate =
    totalHostelCapacity > 0 ? Math.round((activeCount / totalHostelCapacity) * 100) : 0;
  const availableBedsCount = Math.max(0, totalHostelCapacity - activeCount);

  // =========================================================================
  // Filtered Allocations
  // =========================================================================
  const filteredAllocations = useMemo(() => {
    return allocations.filter((a) => {
      if (statusFilter !== 'ALL' && a.status !== statusFilter) return false;
      if (typeFilter !== 'ALL' && a.allocation_type !== typeFilter) return false;

      if (!searchTerm.trim()) return true;

      const q = searchTerm.toLowerCase();
      const student = a.student_id ? studentMap.get(a.student_id) : null;
      const studentName = student
        ? [student.first_name, student.last_name].filter(Boolean).join(' ').toLowerCase()
        : '';
      const admNo = (student?.admission_number || '').toLowerCase();
      const remarks = (a.remarks || '').toLowerCase();
      const allocId = (a.id || '').toLowerCase();

      return (
        studentName.includes(q) ||
        admNo.includes(q) ||
        remarks.includes(q) ||
        allocId.includes(q)
      );
    });
  }, [allocations, searchTerm, statusFilter, typeFilter, studentMap]);

  // =========================================================================
  // Cascading Selectors Helpers for Allocation Forms
  // =========================================================================
  const handleHostelChange = async (hostelId, formType = 'CREATE') => {
    if (formType === 'CREATE') {
      setCreateFormData((prev) => ({
        ...prev,
        hostel_id: hostelId,
        block_id: '',
        floor_id: '',
        room_id: '',
        bed_id: '',
      }));
    } else {
      setTransferFormData((prev) => ({
        ...prev,
        hostel_id: hostelId,
        block_id: '',
        floor_id: '',
        room_id: '',
        new_bed_id: '',
      }));
    }

    setCascadingBlocks([]);
    setCascadingFloors([]);
    setCascadingRooms([]);
    setCascadingBeds([]);

    if (!hostelId) return;

    setCascadingLoading(true);
    try {
      const res = await adminService.getBlocks(hostelId);
      const rawBlocks = Array.isArray(res) ? res : res?.blocks || [];
      setCascadingBlocks(rawBlocks);
    } catch (err) {
      console.warn('Error fetching blocks for hostel:', err);
    } finally {
      setCascadingLoading(false);
    }
  };

  const handleBlockChange = async (hostelId, blockId, formType = 'CREATE') => {
    if (formType === 'CREATE') {
      setCreateFormData((prev) => ({
        ...prev,
        block_id: blockId,
        floor_id: '',
        room_id: '',
        bed_id: '',
      }));
    } else {
      setTransferFormData((prev) => ({
        ...prev,
        block_id: blockId,
        floor_id: '',
        room_id: '',
        new_bed_id: '',
      }));
    }

    setCascadingFloors([]);
    setCascadingRooms([]);
    setCascadingBeds([]);

    if (!blockId) return;

    setCascadingLoading(true);
    try {
      const res = await adminService.getFloors(hostelId, blockId);
      const rawFloors = Array.isArray(res) ? res : res?.floors || [];
      rawFloors.sort((a, b) => (a.floor_number || 0) - (b.floor_number || 0));
      setCascadingFloors(rawFloors);
    } catch (err) {
      console.warn('Error fetching floors for block:', err);
    } finally {
      setCascadingLoading(false);
    }
  };

  const handleFloorChange = async (hostelId, blockId, floorId, formType = 'CREATE') => {
    if (formType === 'CREATE') {
      setCreateFormData((prev) => ({
        ...prev,
        floor_id: floorId,
        room_id: '',
        bed_id: '',
      }));
    } else {
      setTransferFormData((prev) => ({
        ...prev,
        floor_id: floorId,
        room_id: '',
        new_bed_id: '',
      }));
    }

    setCascadingRooms([]);
    setCascadingBeds([]);

    if (!floorId) return;

    setCascadingLoading(true);
    try {
      const res = await adminService.getRooms(hostelId, blockId, floorId);
      const rawRooms = Array.isArray(res) ? res : res?.rooms || [];
      setCascadingRooms(rawRooms);
    } catch (err) {
      console.warn('Error fetching rooms for floor:', err);
    } finally {
      setCascadingLoading(false);
    }
  };

  const handleRoomChange = async (hostelId, blockId, floorId, roomId, formType = 'CREATE') => {
    if (formType === 'CREATE') {
      setCreateFormData((prev) => ({
        ...prev,
        room_id: roomId,
        bed_id: '',
      }));
    } else {
      setTransferFormData((prev) => ({
        ...prev,
        room_id: roomId,
        new_bed_id: '',
      }));
    }

    setCascadingBeds([]);

    if (!roomId) return;

    setCascadingLoading(true);
    try {
      const res = await adminService.getBeds(hostelId, blockId, floorId, roomId);
      const rawBeds = Array.isArray(res) ? res : res?.beds || [];
      // Filter out beds that are already actively allocated
      const occupiedBedIds = new Set(
        allocations.filter((a) => a.status === 'ACTIVE').map((a) => a.bed_id)
      );
      const availableBeds = rawBeds.filter(
        (b) => b.status === 'ACTIVE' && !occupiedBedIds.has(b.id)
      );
      setCascadingBeds(availableBeds.length > 0 ? availableBeds : rawBeds);
    } catch (err) {
      console.warn('Error fetching beds for room:', err);
    } finally {
      setCascadingLoading(false);
    }
  };

  // =========================================================================
  // Workflow: Create Bed Allocation
  // =========================================================================
  const handleOpenCreateModal = () => {
    setCreateFormData({
      student_id: students[0]?.id || '',
      hostel_id: hostels[0]?.id || '',
      block_id: '',
      floor_id: '',
      room_id: '',
      bed_id: '',
      allocation_type: 'REGULAR',
      allocated_at: new Date().toISOString().split('T')[0],
      remarks: '',
    });
    setFormError(null);
    setCreateModalOpen(true);

    if (hostels.length > 0) {
      handleHostelChange(hostels[0].id, 'CREATE');
    }
  };

  const handleCreateAllocationSubmit = async (e) => {
    e.preventDefault();
    if (!createFormData.student_id) {
      setFormError('Please select a student for allocation.');
      return;
    }
    if (!createFormData.bed_id) {
      setFormError('Please select a specific available bed slot.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const payload = {
        student_id: createFormData.student_id,
        bed_id: createFormData.bed_id,
        allocation_type: createFormData.allocation_type || 'REGULAR',
        allocated_at: new Date(createFormData.allocated_at).toISOString(),
        remarks: createFormData.remarks.trim() ? createFormData.remarks.trim() : null,
      };

      await adminService.createBedAllocation(payload);
      const student = studentMap.get(payload.student_id);
      setSuccessBanner(
        `Room and bed allocated successfully for ${
          student ? [student.first_name, student.last_name].filter(Boolean).join(' ') : 'Student'
        }.`
      );
      setCreateModalOpen(false);
      loadMasterData(true);
    } catch (err) {
      console.error('Error creating bed allocation:', err);
      setFormError(
        err.response?.data?.message || err.message || 'Failed to complete bed allocation.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  // =========================================================================
  // Workflow: Transfer Bed Allocation
  // =========================================================================
  const handleOpenTransferModal = (allocation) => {
    setSelectedAllocation(allocation);
    setTransferFormData({
      hostel_id: hostels[0]?.id || '',
      block_id: '',
      floor_id: '',
      room_id: '',
      new_bed_id: '',
      transferred_at: new Date().toISOString().split('T')[0],
    });
    setFormError(null);
    setTransferModalOpen(true);

    if (hostels.length > 0) {
      handleHostelChange(hostels[0].id, 'TRANSFER');
    }
  };

  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    if (!selectedAllocation || !transferFormData.new_bed_id) {
      setFormError('Please select the new destination bed space.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const payload = {
        new_bed_id: transferFormData.new_bed_id,
        transferred_at: new Date(transferFormData.transferred_at).toISOString(),
      };

      await adminService.transferBedAllocation(selectedAllocation.id, payload);
      setSuccessBanner('Resident room allocation transferred successfully.');
      setTransferModalOpen(false);
      loadMasterData(true);
    } catch (err) {
      console.error('Error transferring allocation:', err);
      setFormError(err.response?.data?.message || err.message || 'Failed to transfer allocation.');
    } finally {
      setSubmitting(false);
    }
  };

  // =========================================================================
  // Workflow: Release Bed / End Allocation
  // =========================================================================
  const handleOpenReleaseModal = (allocation) => {
    setSelectedAllocation(allocation);
    setReleaseFormData({
      released_at: new Date().toISOString().split('T')[0],
      status: 'RELEASED',
    });
    setFormError(null);
    setReleaseModalOpen(true);
  };

  const handleReleaseSubmit = async (e) => {
    e.preventDefault();
    if (!selectedAllocation) return;

    setSubmitting(true);
    setFormError(null);

    try {
      const payload = {
        released_at: new Date(releaseFormData.released_at).toISOString(),
        status: releaseFormData.status || 'RELEASED',
      };

      await adminService.releaseBedAllocation(selectedAllocation.id, payload);
      setSuccessBanner('Bed allocation terminated and bed space released to inventory.');
      setReleaseModalOpen(false);
      loadMasterData(true);
    } catch (err) {
      console.error('Error releasing bed allocation:', err);
      setFormError(err.response?.data?.message || err.message || 'Failed to release allocation.');
    } finally {
      setSubmitting(false);
    }
  };

  // View Details Drawer
  const handleOpenDetails = (allocation) => {
    setSelectedAllocation(allocation);
    setDetailsDrawerOpen(true);
  };

  // Status Badge Helper
  const renderAllocationStatusBadge = (status) => {
    switch (status) {
      case 'ACTIVE':
        return <span className="badge-enterprise badge-green">ACTIVE ALLOCATION</span>;
      case 'RELEASED':
        return <span className="badge-enterprise badge-gray">RELEASED / ENDED</span>;
      case 'TRANSFERRED':
        return <span className="badge-enterprise badge-blue">TRANSFERRED</span>;
      default:
        return <span className="badge-enterprise badge-purple">{status || 'UNKNOWN'}</span>;
    }
  };

  if (loading && allocations.length === 0) {
    return (
      <div className="fade-in-up" style={{ padding: '32px' }}>
        <LoadingState message="Loading bed allocation directory, student records, and room occupancies..." />
      </div>
    );
  }

  return (
    <div className="fade-in-up">
      {/* Hero Header */}
      <div className="enterprise-hero-header">
        <div className="hero-header-titles">
          <div className="hero-category-pill">
            <BedDouble size={13} />
            <span>Accommodation & Occupancy Management</span>
          </div>
          <h1 className="hero-main-title">Room & Bed Allocation Management</h1>
          <p className="hero-subtitle">
            Manage student room assignments, bed space occupancy, transfers, and residential vacating workflows.
          </p>
        </div>

        <div className="hero-action-buttons">
          <button
            type="button"
            className="btn-enterprise-secondary"
            onClick={() => loadMasterData(true)}
            disabled={isRefreshing}
          >
            <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} />
            <span>{isRefreshing ? 'Syncing...' : 'Sync Data'}</span>
          </button>

          {canManageAllocations && (
            <button
              type="button"
              className="btn-enterprise-primary"
              onClick={handleOpenCreateModal}
            >
              <Plus size={15} />
              <span>Allocate Bed Space</span>
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
          <ErrorState message={errorMessage} onRetry={() => loadMasterData(true)} />
        </div>
      )}

      {/* KPI Stats Bar */}
      <div className="kpi-cards-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Active Allocations</span>
            <div className="stat-kpi-icon-wrap emerald">
              <UserCheck size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-emerald-600">{activeCount}</div>
          <div className="stat-kpi-footnote">
            <span className="status-dot green" />
            <span>Currently housed residents</span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Available Bed Slots</span>
            <div className="stat-kpi-icon-wrap blue">
              <BedDouble size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-blue-600">{availableBedsCount}</div>
          <div className="stat-kpi-footnote">
            <span>Ready for student intake</span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Campus Occupancy Rate</span>
            <div className="stat-kpi-icon-wrap purple">
              <Sparkles size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-purple-600">{campusOccupancyRate}%</div>
          <div className="stat-kpi-footnote">
            <span>{totalHostelCapacity} total beds designed</span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Historical Vacated</span>
            <div className="stat-kpi-icon-wrap orange">
              <LogOut size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-orange-600">
            {releasedCount + transferredCount}
          </div>
          <div className="stat-kpi-footnote">
            <span>{releasedCount} released • {transferredCount} transferred</span>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="enterprise-card">
        <div className="card-topbar">
          <div className="card-title-group">
            <div className="card-title-icon-wrap">
              <BedDouble size={16} />
            </div>
            <h2 className="card-title-text">Bed Allocation Registry</h2>
          </div>
          <span className="badge-enterprise badge-emerald">
            {filteredAllocations.length} of {allocations.length} Records Showing
          </span>
        </div>

        {/* Filter Toolbar */}
        <div className="enterprise-filter-bar">
          <div className="filter-search-field">
            <Search size={14} className="filter-search-icon" />
            <input
              type="text"
              className="filter-search-input"
              placeholder="Search by student name, admission number, or remarks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <select
              className="filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Allocation Statuses</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="RELEASED">RELEASED</option>
              <option value="TRANSFERRED">TRANSFERRED</option>
            </select>

            <select
              className="filter-select"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="ALL">All Allocation Types</option>
              <option value="REGULAR">REGULAR</option>
              <option value="TEMPORARY">TEMPORARY</option>
              <option value="GUEST">GUEST</option>
            </select>
          </div>
        </div>

        {/* Allocations Table */}
        <div className="enterprise-table-container">
          <table className="enterprise-table">
            <thead>
              <tr>
                <th>Resident Student</th>
                <th>Assigned Bed Space</th>
                <th>Allocation Type</th>
                <th>Assigned Period</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAllocations.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '36px' }}>
                    <EmptyState
                      title="No bed allocation records found"
                      message="No allocations match your active search and filter criteria."
                    />
                  </td>
                </tr>
              ) : (
                filteredAllocations.map((alloc) => {
                  const student = alloc.student_id ? studentMap.get(alloc.student_id) : null;
                  const isActive = alloc.status === 'ACTIVE';

                  return (
                    <tr key={alloc.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '34px',
                              height: '34px',
                              borderRadius: '8px',
                              background: '#ecfdf5',
                              color: '#059669',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '13px',
                            }}
                          >
                            {(student?.first_name || 'S')[0].toUpperCase()}
                          </div>
                          <div>
                            <strong style={{ color: '#0f172a', display: 'block', fontSize: '13.5px' }}>
                              {student
                                ? [student.first_name, student.last_name].filter(Boolean).join(' ')
                                : 'Registered Student'}
                            </strong>
                            <span style={{ fontSize: '11px', color: '#64748b' }}>
                              Adm No: {student?.admission_number || '—'}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span className="code-pill" style={{ fontWeight: 700 }}>
                            Bed ID: {String(alloc.bed_id).slice(0, 8)}...
                          </span>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>
                            Campus Residential Wing
                          </span>
                        </div>
                      </td>

                      <td>
                        <span className="badge-enterprise badge-blue">
                          {alloc.allocation_type || 'REGULAR'}
                        </span>
                      </td>

                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '12.5px' }}>
                          <span style={{ color: '#334155' }}>
                            From: {alloc.allocated_at ? String(alloc.allocated_at).split('T')[0] : '—'}
                          </span>
                          {alloc.released_at && (
                            <span style={{ color: '#94a3b8', fontSize: '11px' }}>
                              To: {String(alloc.released_at).split('T')[0]}
                            </span>
                          )}
                        </div>
                      </td>

                      <td>{renderAllocationStatusBadge(alloc.status)}</td>

                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn-icon"
                            title="View Allocation Dossier"
                            onClick={() => handleOpenDetails(alloc)}
                          >
                            <Eye size={14} />
                          </button>

                          {canManageAllocations && isActive && (
                            <>
                              <button
                                type="button"
                                className="btn-icon"
                                title="Transfer to Different Room / Bed"
                                onClick={() => handleOpenTransferModal(alloc)}
                              >
                                <ArrowRightLeft size={14} />
                              </button>

                              <button
                                type="button"
                                className="btn-icon danger"
                                title="Release Bed Space / Vacate"
                                onClick={() => handleOpenReleaseModal(alloc)}
                              >
                                <LogOut size={14} />
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

      {/* =================================================================== */}
      {/* MODAL: Allocate Bed Space (Create Allocation)                       */}
      {/* =================================================================== */}
      {createModalOpen && (
        <Modal
          isOpen={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          title="Allocate Room & Bed Space to Student"
        >
          {formError && (
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
              {formError}
            </div>
          )}

          <form onSubmit={handleCreateAllocationSubmit}>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Select Student *
              </label>
              <select
                className="filter-select"
                style={{ width: '100%' }}
                value={createFormData.student_id}
                onChange={(e) => setCreateFormData({ ...createFormData, student_id: e.target.value })}
                required
              >
                {students.map((st) => (
                  <option key={st.id} value={st.id}>
                    {[st.first_name, st.last_name].filter(Boolean).join(' ')} (Adm No: {st.admission_number || '—'})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Target Hostel *
                </label>
                <select
                  className="filter-select"
                  style={{ width: '100%' }}
                  value={createFormData.hostel_id}
                  onChange={(e) => handleHostelChange(e.target.value, 'CREATE')}
                  required
                >
                  <option value="">Select Hostel</option>
                  {hostels.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} ({h.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Block / Wing *
                </label>
                <select
                  className="filter-select"
                  style={{ width: '100%' }}
                  value={createFormData.block_id}
                  onChange={(e) =>
                    handleBlockChange(createFormData.hostel_id, e.target.value, 'CREATE')
                  }
                  disabled={!createFormData.hostel_id || cascadingLoading}
                  required
                >
                  <option value="">Select Block</option>
                  {cascadingBlocks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Floor Level *
                </label>
                <select
                  className="filter-select"
                  style={{ width: '100%' }}
                  value={createFormData.floor_id}
                  onChange={(e) =>
                    handleFloorChange(
                      createFormData.hostel_id,
                      createFormData.block_id,
                      e.target.value,
                      'CREATE'
                    )
                  }
                  disabled={!createFormData.block_id || cascadingLoading}
                  required
                >
                  <option value="">Select Floor</option>
                  {cascadingFloors.map((flr) => (
                    <option key={flr.id} value={flr.id}>
                      {flr.name} (Level {flr.floor_number})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Room *
                </label>
                <select
                  className="filter-select"
                  style={{ width: '100%' }}
                  value={createFormData.room_id}
                  onChange={(e) =>
                    handleRoomChange(
                      createFormData.hostel_id,
                      createFormData.block_id,
                      createFormData.floor_id,
                      e.target.value,
                      'CREATE'
                    )
                  }
                  disabled={!createFormData.floor_id || cascadingLoading}
                  required
                >
                  <option value="">Select Room</option>
                  {cascadingRooms.map((rm) => (
                    <option key={rm.id} value={rm.id}>
                      {rm.name} ({rm.code} - {rm.room_type})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Available Bed Slot *
                </label>
                <select
                  className="filter-select"
                  style={{ width: '100%' }}
                  value={createFormData.bed_id}
                  onChange={(e) => setCreateFormData({ ...createFormData, bed_id: e.target.value })}
                  disabled={!createFormData.room_id || cascadingLoading}
                  required
                >
                  <option value="">Select Bed Slot</option>
                  {cascadingBeds.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.code} ({b.name || 'Bed'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Allocation Type *
                </label>
                <select
                  className="filter-select"
                  style={{ width: '100%' }}
                  value={createFormData.allocation_type}
                  onChange={(e) =>
                    setCreateFormData({ ...createFormData, allocation_type: e.target.value })
                  }
                  required
                >
                  <option value="REGULAR">REGULAR (Semester Stay)</option>
                  <option value="TEMPORARY">TEMPORARY (Short-term / Exam)</option>
                  <option value="GUEST">GUEST RESIDENCE</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Allocation Effective Date *
                </label>
                <input
                  type="date"
                  className="filter-search-input"
                  style={{ width: '100%', fontSize: '12px' }}
                  value={createFormData.allocated_at}
                  onChange={(e) =>
                    setCreateFormData({ ...createFormData, allocated_at: e.target.value })
                  }
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Remarks / Notes
                </label>
                <input
                  type="text"
                  className="filter-search-input"
                  style={{ width: '100%', fontSize: '12px' }}
                  value={createFormData.remarks}
                  onChange={(e) => setCreateFormData({ ...createFormData, remarks: e.target.value })}
                  placeholder="Optional notes regarding key handover..."
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn-enterprise-secondary"
                onClick={() => setCreateModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-enterprise-primary"
                disabled={submitting || !createFormData.bed_id}
              >
                {submitting ? 'Allocating...' : 'Confirm Allocation'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* =================================================================== */}
      {/* MODAL: Transfer Bed Allocation                                      */}
      {/* =================================================================== */}
      {transferModalOpen && selectedAllocation && (
        <Modal
          isOpen={transferModalOpen}
          onClose={() => setTransferModalOpen(false)}
          title="Transfer Student to New Room / Bed Space"
        >
          {formError && (
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
              {formError}
            </div>
          )}

          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '16px',
              fontSize: '12.5px',
            }}
          >
            <strong>Current Allocation:</strong> Bed ID{' '}
            <code>{String(selectedAllocation.bed_id).slice(0, 8)}...</code> &bull; Status:{' '}
            {selectedAllocation.status}
          </div>

          <form onSubmit={handleTransferSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Destination Hostel *
                </label>
                <select
                  className="filter-select"
                  style={{ width: '100%' }}
                  value={transferFormData.hostel_id}
                  onChange={(e) => handleHostelChange(e.target.value, 'TRANSFER')}
                  required
                >
                  <option value="">Select Hostel</option>
                  {hostels.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} ({h.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Destination Block *
                </label>
                <select
                  className="filter-select"
                  style={{ width: '100%' }}
                  value={transferFormData.block_id}
                  onChange={(e) =>
                    handleBlockChange(transferFormData.hostel_id, e.target.value, 'TRANSFER')
                  }
                  disabled={!transferFormData.hostel_id || cascadingLoading}
                  required
                >
                  <option value="">Select Block</option>
                  {cascadingBlocks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Destination Floor *
                </label>
                <select
                  className="filter-select"
                  style={{ width: '100%' }}
                  value={transferFormData.floor_id}
                  onChange={(e) =>
                    handleFloorChange(
                      transferFormData.hostel_id,
                      transferFormData.block_id,
                      e.target.value,
                      'TRANSFER'
                    )
                  }
                  disabled={!transferFormData.block_id || cascadingLoading}
                  required
                >
                  <option value="">Select Floor</option>
                  {cascadingFloors.map((flr) => (
                    <option key={flr.id} value={flr.id}>
                      {flr.name} (Level {flr.floor_number})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Destination Room *
                </label>
                <select
                  className="filter-select"
                  style={{ width: '100%' }}
                  value={transferFormData.room_id}
                  onChange={(e) =>
                    handleRoomChange(
                      transferFormData.hostel_id,
                      transferFormData.block_id,
                      transferFormData.floor_id,
                      e.target.value,
                      'TRANSFER'
                    )
                  }
                  disabled={!transferFormData.floor_id || cascadingLoading}
                  required
                >
                  <option value="">Select Room</option>
                  {cascadingRooms.map((rm) => (
                    <option key={rm.id} value={rm.id}>
                      {rm.name} ({rm.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  New Bed Slot *
                </label>
                <select
                  className="filter-select"
                  style={{ width: '100%' }}
                  value={transferFormData.new_bed_id}
                  onChange={(e) =>
                    setTransferFormData({ ...transferFormData, new_bed_id: e.target.value })
                  }
                  disabled={!transferFormData.room_id || cascadingLoading}
                  required
                >
                  <option value="">Select Destination Bed</option>
                  {cascadingBeds.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.code} ({b.name || 'Bed'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Transfer Effective Date *
                </label>
                <input
                  type="date"
                  className="filter-search-input"
                  style={{ width: '100%', fontSize: '12px' }}
                  value={transferFormData.transferred_at}
                  onChange={(e) =>
                    setTransferFormData({ ...transferFormData, transferred_at: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn-enterprise-secondary"
                onClick={() => setTransferModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-enterprise-primary"
                disabled={submitting || !transferFormData.new_bed_id}
              >
                {submitting ? 'Transferring...' : 'Execute Transfer'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* =================================================================== */}
      {/* MODAL: Release Bed / End Allocation                                 */}
      {/* =================================================================== */}
      {releaseModalOpen && selectedAllocation && (
        <Modal
          isOpen={releaseModalOpen}
          onClose={() => setReleaseModalOpen(false)}
          title="Release Bed Space / End Allocation"
        >
          {formError && (
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
              {formError}
            </div>
          )}

          <div
            style={{
              background: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: '8px',
              padding: '14px',
              marginBottom: '16px',
              fontSize: '12.5px',
              color: '#92400e',
            }}
          >
            <strong>Confirmation:</strong> You are ending this resident's bed allocation. The assigned bed space will be marked as available immediately in the campus inventory.
          </div>

          <form onSubmit={handleReleaseSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Release Effective Date *
                </label>
                <input
                  type="date"
                  className="filter-search-input"
                  style={{ width: '100%', fontSize: '12px' }}
                  value={releaseFormData.released_at}
                  onChange={(e) =>
                    setReleaseFormData({ ...releaseFormData, released_at: e.target.value })
                  }
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Termination Status *
                </label>
                <select
                  className="filter-select"
                  style={{ width: '100%' }}
                  value={releaseFormData.status}
                  onChange={(e) =>
                    setReleaseFormData({ ...releaseFormData, status: e.target.value })
                  }
                  required
                >
                  <option value="RELEASED">RELEASED (Standard Checkout)</option>
                  <option value="COMPLETED">COMPLETED (Graduation / Term End)</option>
                  <option value="TERMINATED">TERMINATED (Disciplinary / Eviction)</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn-enterprise-secondary"
                onClick={() => setReleaseModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-enterprise-primary"
                style={{ background: '#dc2626', borderColor: '#b91c1c' }}
                disabled={submitting}
              >
                {submitting ? 'Releasing...' : 'Confirm Bed Release'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* =================================================================== */}
      {/* DRAWER: Allocation Dossier Details                                  */}
      {/* =================================================================== */}
      {detailsDrawerOpen && selectedAllocation && (
        <Modal
          isOpen={detailsDrawerOpen}
          onClose={() => setDetailsDrawerOpen(false)}
          title="Bed Allocation Dossier"
        >
          {(() => {
            const student = selectedAllocation.student_id
              ? studentMap.get(selectedAllocation.student_id)
              : null;

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
                    <h3 style={{ margin: 0, fontSize: '15px', color: '#0f172a' }}>
                      {student
                        ? [student.first_name, student.last_name].filter(Boolean).join(' ')
                        : 'Resident Student'}
                    </h3>
                    <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748b' }}>
                      Admission No: {student?.admission_number || '—'} &bull; Gender: {student?.gender || '—'}
                    </p>
                  </div>
                  {renderAllocationStatusBadge(selectedAllocation.status)}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', fontSize: '13px' }}>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>
                      Bed Identifier
                    </span>
                    <strong style={{ color: '#0f172a' }}>
                      <code>{selectedAllocation.bed_id}</code>
                    </strong>
                  </div>

                  <div>
                    <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>
                      Allocation Type
                    </span>
                    <span className="badge-enterprise badge-blue">
                      {selectedAllocation.allocation_type || 'REGULAR'}
                    </span>
                  </div>

                  <div>
                    <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>
                      Allocated Since
                    </span>
                    <strong style={{ color: '#0f172a' }}>
                      {selectedAllocation.allocated_at
                        ? String(selectedAllocation.allocated_at).split('T')[0]
                        : '—'}
                    </strong>
                  </div>

                  <div>
                    <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>
                      Released Date
                    </span>
                    <strong style={{ color: '#0f172a' }}>
                      {selectedAllocation.released_at
                        ? String(selectedAllocation.released_at).split('T')[0]
                        : 'Currently Active'}
                    </strong>
                  </div>

                  <div>
                    <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>
                      Allocated By
                    </span>
                    <span style={{ color: '#475569', fontSize: '12px' }}>
                      {selectedAllocation.allocated_by
                        ? `UUID: ${String(selectedAllocation.allocated_by).slice(0, 8)}...`
                        : 'System'}
                    </span>
                  </div>

                  <div>
                    <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>
                      Remarks / Notes
                    </span>
                    <span style={{ color: '#0f172a', fontSize: '12px' }}>
                      {selectedAllocation.remarks || 'No remarks recorded'}
                    </span>
                  </div>
                </div>

                {/* Audit trail box */}
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
                    Historical Audit Trail:
                  </strong>
                  Unavailable / Awaiting Backend Handler. Historical movement timestamps and previous room migration logs are not yet exposed by the API router.
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                  <button
                    type="button"
                    className="btn-enterprise-secondary"
                    onClick={() => setDetailsDrawerOpen(false)}
                  >
                    Close Dossier
                  </button>
                </div>
              </div>
            );
          })()}
        </Modal>
      )}
    </div>
  );
}

