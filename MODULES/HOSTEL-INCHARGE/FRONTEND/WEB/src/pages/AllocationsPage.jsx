import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import inchargeService from '../services/inchargeService';
import { PERMISSIONS } from '../constants/permissions';
import PageHeader from '../components/PageHeader';
import LoadingState from '../components/LoadingState';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import Badge from '../components/Badge';
import Button from '../components/Button';
import SearchInput from '../components/SearchInput';
import { formatDate, truncateUUID } from '../utils/formatUtils';
import {
  KeyRound,
  RefreshCw,
  Plus,
  ArrowRightLeft,
  LogOut,
  History,
  CheckCircle2,
  Info
} from 'lucide-react';

export default function AllocationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
    const { assignedHostel } = useAuth();
  const { hasPermission } = usePermissions();

  const canManage = hasPermission(PERMISSIONS.HOSTEL_MANAGE) || hasPermission(PERMISSIONS.PEOPLE_MANAGE);

  // URL Query Parameters
  const paramStudentId = searchParams.get('studentId');
  const paramBedId = searchParams.get('bedId');
  const paramAction = searchParams.get('action');

  // Master Data
  const [hostelData, setHostelData] = useState(null);
  const [allocations, setAllocations] = useState([]);
  const [residents, setResidents] = useState([]);
  const [vacantBeds, setVacantBeds] = useState([]);
  const [unallocatedStudents, setUnallocatedStudents] = useState([]);
  const [, setBlocks] = useState([]);

  // Loading & State flags
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [successBanner, setSuccessBanner] = useState(null);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [blockFilter, setBlockFilter] = useState('ALL');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(12);

  // Modals & Action State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [releaseModalOpen, setReleaseModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedAllocation, setSelectedAllocation] = useState(null);
  const [studentHistory, setStudentHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Form States
  const [createForm, setCreateForm] = useState({
    student_id: '',
    bed_id: '',
    allocation_type: 'REGULAR',
    allocated_at: new Date().toISOString().split('T')[0],
    remarks: '',
  });

  const [transferForm, setTransferForm] = useState({
    new_bed_id: '',
    transferred_at: new Date().toISOString().split('T')[0],
  });

  const [releaseForm, setReleaseForm] = useState({
    released_at: new Date().toISOString().split('T')[0],
    status: 'RELEASED',
  });

  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  // Auto-dismiss banner
  useEffect(() => {
    if (successBanner) {
      const timer = setTimeout(() => setSuccessBanner(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successBanner]);

  // Load complete allocation and reference datasets
  const loadAllocationData = useCallback(
    async (isSilent = false) => {
      try {
        if (isSilent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }
        setError(null);

        // 1. Fetch assigned hostel record
        const hostel = await inchargeService.getMyHostel();
        setHostelData(hostel);

        const hostelId = hostel?.id || hostel?.hostel_id || assignedHostel?.id;
        if (!hostelId) {
          throw new Error('No assigned hostel found for the authenticated In-Charge.');
        }

        // 2. Fetch parallel data: allocations, residents, vacant beds, unallocated students, blocks
        const [allocRes, resRes, vacRes, unallocRes, blocksRes] = await Promise.allSettled([
          inchargeService.getBedAllocations(),
          inchargeService.getHostelResidents(hostelId),
          inchargeService.getVacantBeds(hostelId),
          inchargeService.getUnallocatedStudents(),
          inchargeService.getBlocks(hostelId),
        ]);

        const rawAlloc = allocRes.status === 'fulfilled' ? allocRes.value : [];
        const rawResidents = resRes.status === 'fulfilled' ? resRes.value : [];
        const rawVacant = vacRes.status === 'fulfilled' ? vacRes.value : [];
        const rawUnalloc = unallocRes.status === 'fulfilled' ? unallocRes.value : [];
        const rawBlocks = blocksRes.status === 'fulfilled' ? blocksRes.value : [];

        const validAlloc = Array.isArray(rawAlloc) ? rawAlloc : [];
        setAllocations(validAlloc);
        setResidents(Array.isArray(rawResidents) ? rawResidents : []);
        setVacantBeds(Array.isArray(rawVacant) ? rawVacant : []);
        setUnallocatedStudents(Array.isArray(rawUnalloc) ? rawUnalloc : []);
        setBlocks(Array.isArray(rawBlocks) ? rawBlocks : []);

        // Handle URL parameters for direct deep-link actions
        if (paramAction === 'allocate' && paramBedId) {
          setCreateForm((prev) => ({ ...prev, bed_id: paramBedId }));
          setCreateModalOpen(true);
        }
      } catch (err) {
        console.error('Failed to load allocation data:', err);
        setError(err.message || 'Failed to retrieve room and bed allocation records.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [assignedHostel, paramAction, paramBedId]
  );

  useEffect(() => {
    loadAllocationData(false);
  }, [loadAllocationData]);

  // High-Efficiency Algorithmic Maps for O(1) Lookups
  const { residentMap, residentByAllocMap } = useMemo(() => {
    const byStudent = new Map();
    const byBed = new Map();
    const byAlloc = new Map();

    residents.forEach((r) => {
      if (r.student_id) byStudent.set(r.student_id, r);
      if (r.bed_id) byBed.set(r.bed_id, r);
      if (r.allocation_id) byAlloc.set(r.allocation_id, r);
    });

    return {
      residentMap: byStudent,
      residentByBedMap: byBed,
      residentByAllocMap: byAlloc,
    };
  }, [residents]);

  // Scoped Allocations: Restrict to allocations associated with assigned hostel beds or residents
  const scopedAllocations = useMemo(() => {
    const assignedResidentAllocIds = new Set(residents.map((r) => r.allocation_id).filter(Boolean));
    const assignedBedIds = new Set([
      ...residents.map((r) => r.bed_id).filter(Boolean),
      ...vacantBeds.map((v) => v.bed_id).filter(Boolean),
    ]);

    return allocations.filter((a) => {
      // Direct match on allocation ID or Bed ID belonging to assigned hostel
      if (assignedResidentAllocIds.has(a.id)) return true;
      if (assignedBedIds.has(a.bed_id)) return true;
      if (a.student_id && residentMap.has(a.student_id)) return true;
      return false;
    });
  }, [allocations, residents, vacantBeds, residentMap]);

  // Filtered Allocations
  const filteredAllocations = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return scopedAllocations.filter((a) => {
      // 1. Status Filter
      if (statusFilter !== 'ALL' && a.status !== statusFilter) return false;

      // 2. Type Filter
      if (typeFilter !== 'ALL' && a.allocation_type !== typeFilter) return false;

      // Resolve metadata for student & room
      const res = residentByAllocMap.get(a.id) || (a.student_id ? residentMap.get(a.student_id) : null);
      const studentName = res?.full_name || '';
      const rollNumber = res?.roll_number || res?.admission_number || '';
      const roomName = res?.room_name || res?.room_code || '';
      const blockName = res?.block_name || '';

      // 3. Block Filter
      if (blockFilter !== 'ALL' && blockName !== blockFilter) return false;

      // 4. URL Param Filters
      if (paramStudentId && a.student_id !== paramStudentId) return false;
      if (paramBedId && a.bed_id !== paramBedId) return false;

      // 5. Search Term Filter
      if (term) {
        const idMatch = String(a.id || '').toLowerCase().includes(term);
        const nameMatch = studentName.toLowerCase().includes(term);
        const rollMatch = rollNumber.toLowerCase().includes(term);
        const roomMatch = roomName.toLowerCase().includes(term);
        const blockMatch = blockName.toLowerCase().includes(term);
        if (!idMatch && !nameMatch && !rollMatch && !roomMatch && !blockMatch) return false;
      }

      return true;
    });
  }, [
    scopedAllocations,
    searchTerm,
    statusFilter,
    typeFilter,
    blockFilter,
    paramStudentId,
    paramBedId,
    residentByAllocMap,
    residentMap,
  ]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredAllocations.length / pageSize));
  const paginatedAllocations = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAllocations.slice(start, start + pageSize);
  }, [filteredAllocations, currentPage, pageSize]);

  // Unique Blocks for Filter
  const availableBlocks = useMemo(() => {
    const bSet = new Set();
    residents.forEach((r) => {
      if (r.block_name) bSet.add(r.block_name);
    });
    return Array.from(bSet).sort();
  }, [residents]);

  // Authoritative Derived Aggregates
  const activeAllocationsCount = scopedAllocations.filter((a) => a.status === 'ACTIVE').length;
  const releasedAllocationsCount = scopedAllocations.filter((a) => a.status === 'RELEASED').length;
  const vacantBedsCount = vacantBeds.length;
  const unallocatedCount = unallocatedStudents.length;

  // 1. Create Allocation Submit Handler (Conflict-Safe)
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!createForm.student_id || !createForm.bed_id) {
      setFormError('Please select both an eligible student and an available bed space.');
      return;
    }

    setFormSubmitting(true);
    setFormError(null);

    // Recheck destination availability immediately before submission
    const hostelId = hostelData?.id || hostelData?.hostel_id || assignedHostel?.id;
    try {
      const freshVacant = await inchargeService.getVacantBeds(hostelId);
      const isStillAvailable = Array.isArray(freshVacant) && freshVacant.some((v) => v.bed_id === createForm.bed_id);
      if (!isStillAvailable) {
        throw new Error('Selected bed is no longer available. Please select another vacant bed slot.');
      }

      const allocatedTimestamp = createForm.allocated_at
        ? new Date(createForm.allocated_at).toISOString()
        : new Date().toISOString();

      await inchargeService.createBedAllocation({
        student_id: createForm.student_id,
        bed_id: createForm.bed_id,
        allocation_type: createForm.allocation_type || 'REGULAR',
        allocated_at: allocatedTimestamp,
        remarks: createForm.remarks ? createForm.remarks.trim() : null,
      });

      setSuccessBanner('Room and bed allocated successfully.');
      setCreateModalOpen(false);
      setCreateForm({
        student_id: '',
        bed_id: '',
        allocation_type: 'REGULAR',
        allocated_at: new Date().toISOString().split('T')[0],
        remarks: '',
      });
      await loadAllocationData(true);
    } catch (err) {
      console.error('Failed to create allocation:', err);
      const msg = err.response?.data?.message || err.message || 'Failed to complete bed allocation.';
      setFormError(msg);
    } finally {
      setFormSubmitting(false);
    }
  };

  // 2. Transfer Allocation Submit Handler (Conflict-Safe, Atomic in Go)
  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    if (!selectedAllocation || !transferForm.new_bed_id) {
      setFormError('Please select a valid destination bed slot.');
      return;
    }

    if (transferForm.new_bed_id === selectedAllocation.bed_id) {
      setFormError('Destination bed cannot be the same as the current allocated bed.');
      return;
    }

    setFormSubmitting(true);
    setFormError(null);

    const hostelId = hostelData?.id || hostelData?.hostel_id || assignedHostel?.id;
    try {
      // Recheck availability
      const freshVacant = await inchargeService.getVacantBeds(hostelId);
      const isStillAvailable =
        Array.isArray(freshVacant) && freshVacant.some((v) => v.bed_id === transferForm.new_bed_id);
      if (!isStillAvailable) {
        throw new Error('Target destination bed is no longer available. Please choose another bed.');
      }

      const transferTimestamp = transferForm.transferred_at
        ? new Date(transferForm.transferred_at).toISOString()
        : new Date().toISOString();

      await inchargeService.transferBedAllocation(selectedAllocation.id, {
        new_bed_id: transferForm.new_bed_id,
        transferred_at: transferTimestamp,
      });

      setSuccessBanner('Student allocation transferred successfully to the new bed.');
      setTransferModalOpen(false);
      setSelectedAllocation(null);
      await loadAllocationData(true);
    } catch (err) {
      console.error('Transfer failed:', err);
      const msg = err.response?.data?.message || err.message || 'Failed to transfer bed allocation.';
      setFormError(msg);
    } finally {
      setFormSubmitting(false);
    }
  };

  // 3. Release / Vacate Submit Handler
  const handleReleaseSubmit = async (e) => {
    e.preventDefault();
    if (!selectedAllocation) return;

    setFormSubmitting(true);
    setFormError(null);

    try {
      const releaseTimestamp = releaseForm.released_at
        ? new Date(releaseForm.released_at).toISOString()
        : new Date().toISOString();

      await inchargeService.releaseBedAllocation(selectedAllocation.id, {
        released_at: releaseTimestamp,
        status: releaseForm.status || 'RELEASED',
      });

      setSuccessBanner('Bed allocation terminated and bed space released to inventory.');
      setReleaseModalOpen(false);
      setSelectedAllocation(null);
      await loadAllocationData(true);
    } catch (err) {
      console.error('Release failed:', err);
      const msg = err.response?.data?.message || err.message || 'Failed to terminate bed allocation.';
      setFormError(msg);
    } finally {
      setFormSubmitting(false);
    }
  };

  // 4. View Allocation History
  const handleOpenHistory = async (allocation) => {
    setSelectedAllocation(allocation);
    setHistoryModalOpen(true);
    setStudentHistory([]);

    if (allocation.student_id) {
      setLoadingHistory(true);
      try {
        const hist = await inchargeService.getBedAllocations({ student_id: allocation.student_id });
        setStudentHistory(Array.isArray(hist) ? hist : []);
      } catch (err) {
        console.error('Failed to load history:', err);
      } finally {
        setLoadingHistory(false);
      }
    }
  };

  const activeHostel = hostelData || assignedHostel;

  return (
    <div>
      <PageHeader
        title="Room Allocation & Movement"
        description="Oversee bed assignments, assign unallocated residents, perform room transfers, and release bed spaces."
        icon={KeyRound}
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Button
              variant="outline"
              size="sm"
              icon={RefreshCw}
              onClick={() => loadAllocationData(true)}
              loading={refreshing}
            >
              Sync Allocations
            </Button>
            {canManage && (
              <Button
                variant="primary"
                size="sm"
                icon={Plus}
                onClick={() => {
                  setFormError(null);
                  setCreateModalOpen(true);
                }}
              >
                New Allocation
              </Button>
            )}
          </div>
        }
      />

      {/* Success Notification */}
      {successBanner && (
        <div
          style={{
            backgroundColor: 'var(--success-bg)',
            border: '1px solid var(--success-border)',
            borderRadius: '8px',
            padding: '12px 18px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            color: 'var(--success-text)',
            fontSize: '0.88rem',
            fontWeight: 500,
          }}
        >
          <CheckCircle2 size={18} />
          <span>{successBanner}</span>
        </div>
      )}

      {/* Boundary & Lifecycle Notice */}
      <div
        style={{
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '8px',
          padding: '12px 18px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          color: '#1e40af',
          fontSize: '0.85rem',
        }}
      >
        <Info size={18} style={{ flexShrink: 0 }} />
        <div>
          <strong>Allocation Lifecycle:</strong> Bed allocations are active immediately upon assignment. Transfers atomically release the prior bed slot and occupy the new slot. Check-in/check-out states are tracked through gate passes and curfew attendance.
        </div>
      </div>

      {loading && <LoadingState title="Loading Allocation Registry..." rows={4} />}
      {error && (
        <ErrorState
          title="Unable to Access Allocations"
          message={error}
          onRetry={() => loadAllocationData(false)}
        />
      )}

      {!loading && !error && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Authoritative KPI Tiles */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px',
            }}
          >
            <div
              style={{
                padding: '16px 20px',
                borderRadius: '10px',
                backgroundColor: '#ffffff',
                border: '1px solid var(--border-color)',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                Active Allocations
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--primary-color)', marginTop: '4px' }}>
                {activeAllocationsCount}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Assigned to hostel beds</div>
            </div>

            <div
              style={{
                padding: '16px 20px',
                borderRadius: '10px',
                backgroundColor: '#ffffff',
                border: '1px solid var(--border-color)',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                Vacant Beds Available
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#15803d', marginTop: '4px' }}>
                {vacantBedsCount}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Ready for student assignment</div>
            </div>

            <div
              style={{
                padding: '16px 20px',
                borderRadius: '10px',
                backgroundColor: '#ffffff',
                border: '1px solid var(--border-color)',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                Unallocated Queue
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#b45309', marginTop: '4px' }}>
                {unallocatedCount}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Students awaiting bed assignment</div>
            </div>

            <div
              style={{
                padding: '16px 20px',
                borderRadius: '10px',
                backgroundColor: '#ffffff',
                border: '1px solid var(--border-color)',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                Vacated / Released
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-secondary)', marginTop: '4px' }}>
                {releasedAllocationsCount}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Historical releases</div>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="card" style={{ padding: '18px 24px' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '14px',
                alignItems: 'flex-end',
              }}
            >
              {/* Search Bar */}
              <div style={{ gridColumn: 'span 2' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    marginBottom: '6px',
                  }}
                >
                  Search Allocations:
                </label>
                <SearchInput
                  value={searchTerm}
                  onChange={(val) => {
                    setSearchTerm(val);
                    setCurrentPage(1);
                  }}
                  placeholder="Search by student name, roll number, room code, bed label..."
                  debounceMs={300}
                />
              </div>

              {/* Status Filter */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    marginBottom: '6px',
                  }}
                >
                  Allocation Status:
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: '#ffffff',
                    fontSize: '0.86rem',
                  }}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">ACTIVE (Current)</option>
                  <option value="RELEASED">RELEASED (Vacated)</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </div>

              {/* Type Filter */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    marginBottom: '6px',
                  }}
                >
                  Allocation Type:
                </label>
                <select
                  value={typeFilter}
                  onChange={(e) => {
                    setTypeFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: '#ffffff',
                    fontSize: '0.86rem',
                  }}
                >
                  <option value="ALL">All Allocation Types</option>
                  <option value="REGULAR">REGULAR</option>
                  <option value="TEMPORARY">TEMPORARY</option>
                  <option value="TRANSFER">TRANSFER</option>
                </select>
              </div>

              {/* Block Filter */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    marginBottom: '6px',
                  }}
                >
                  Hostel Block:
                </label>
                <select
                  value={blockFilter}
                  onChange={(e) => {
                    setBlockFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: '#ffffff',
                    fontSize: '0.86rem',
                  }}
                >
                  <option value="ALL">All Blocks</option>
                  {availableBlocks.map((b) => (
                    <option key={b} value={b}>
                      Block {b}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: '14px',
                paddingTop: '12px',
                borderTop: '1px solid #f1f5f9',
                fontSize: '0.82rem',
                color: 'var(--text-secondary)',
              }}
            >
              <div>
                Showing <strong>{filteredAllocations.length}</strong> allocation records
                {(paramStudentId || paramBedId) && (
                  <span style={{ marginLeft: '10px', color: 'var(--primary-color)' }}>
                    (Filtered by deep-link parameters —{' '}
                    <button
                      type="button"
                      onClick={() => setSearchParams({})}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--primary-color)',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      Clear filter
                    </button>
                    )
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Allocations Table */}
          {filteredAllocations.length === 0 ? (
            <EmptyState
              icon={KeyRound}
              title="No Allocations Found"
              message={
                scopedAllocations.length === 0
                  ? 'No room or bed allocations have been made in this hostel yet.'
                  : 'No allocation records matched your selected search and filter criteria.'
              }
            />
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-container" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        Allocation Ref
                      </th>
                      <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        Resident Student
                      </th>
                      <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        Assigned Room & Bed
                      </th>
                      <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        Block / Floor
                      </th>
                      <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Type</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        Effective Date
                      </th>
                      <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Status</th>
                      <th
                        style={{
                          padding: '12px 16px',
                          fontWeight: 600,
                          color: 'var(--text-secondary)',
                          textAlign: 'right',
                        }}
                      >
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedAllocations.map((alloc) => {
                      const res =
                        residentByAllocMap.get(alloc.id) ||
                        (alloc.student_id ? residentMap.get(alloc.student_id) : null);
                      const isOccupied = alloc.status === 'ACTIVE';

                      return (
                        <tr
                          key={alloc.id}
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            transition: 'background-color 0.15s ease',
                          }}
                        >
                          <td style={{ padding: '12px 16px' }}>
                            <span
                              style={{
                                fontFamily: 'monospace',
                                fontWeight: 600,
                                color: 'var(--text-primary)',
                                fontSize: '0.8rem',
                              }}
                            >
                              {truncateUUID(alloc.id)}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            {res ? (
                              <div>
                                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{res.full_name}</div>
                                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                  Roll: <strong>{res.roll_number || '—'}</strong>
                                </div>
                              </div>
                            ) : (
                              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                Student {truncateUUID(alloc.student_id)}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                Room: {res?.room_name || res?.room_code || '—'}
                              </div>
                              <div style={{ fontSize: '0.74rem', color: 'var(--primary-color)' }}>
                                Bed: <strong>{res?.bed_name || 'Assigned'}</strong>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                            {res?.block_name || 'Block A'}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <Badge variant={alloc.allocation_type === 'TRANSFER' ? 'neutral' : 'info'}>
                              {alloc.allocation_type || 'REGULAR'}
                            </Badge>
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                            {formatDate(alloc.allocated_at)}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <Badge
                              variant={
                                alloc.status === 'ACTIVE'
                                  ? 'success'
                                  : alloc.status === 'RELEASED'
                                  ? 'neutral'
                                  : 'warning'
                              }
                            >
                              {alloc.status}
                            </Badge>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                              {isOccupied && canManage && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    icon={ArrowRightLeft}
                                    title="Transfer to another room/bed"
                                    onClick={() => {
                                      setSelectedAllocation(alloc);
                                      setTransferForm({
                                        new_bed_id: '',
                                        transferred_at: new Date().toISOString().split('T')[0],
                                      });
                                      setFormError(null);
                                      setTransferModalOpen(true);
                                    }}
                                  >
                                    Transfer
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    icon={LogOut}
                                    title="Release Bed / Vacate"
                                    onClick={() => {
                                      setSelectedAllocation(alloc);
                                      setReleaseForm({
                                        released_at: new Date().toISOString().split('T')[0],
                                        status: 'RELEASED',
                                      });
                                      setFormError(null);
                                      setReleaseModalOpen(true);
                                    }}
                                  >
                                    Vacate
                                  </Button>
                                </>
                              )}
                              <Button
                                variant="secondary"
                                size="sm"
                                icon={History}
                                title="View History & Timeline"
                                onClick={() => handleOpenHistory(alloc)}
                              >
                                History
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pagination Controls */}
          {filteredAllocations.length > pageSize && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 20px',
                borderRadius: '8px',
                backgroundColor: '#ffffff',
                border: '1px solid var(--border-color)',
                fontSize: '0.84rem',
              }}
            >
              <div style={{ color: 'var(--text-secondary)' }}>
                Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =================== 1. CREATE ALLOCATION MODAL =================== */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="New Room & Bed Allocation"
        subtitle={`Premises: ${activeHostel?.name || 'Assigned Hostel'}`}
        maxWidth="560px"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCreateModalOpen(false)}
              disabled={formSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreateSubmit}
              loading={formSubmitting}
            >
              Allocate Bed Space
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {formError && (
            <div
              style={{
                backgroundColor: 'var(--danger-bg)',
                color: 'var(--danger-text)',
                padding: '10px 14px',
                borderRadius: '6px',
                fontSize: '0.84rem',
              }}
            >
              {formError}
            </div>
          )}

          {/* Student Selector */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: '6px',
              }}
            >
              Select Unallocated Student <span style={{ color: '#ef4444' }}>*</span>:
            </label>
            <select
              value={createForm.student_id}
              onChange={(e) => setCreateForm({ ...createForm, student_id: e.target.value })}
              required
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: '#ffffff',
                fontSize: '0.88rem',
              }}
            >
              <option value="">-- Choose unallocated student --</option>
              {unallocatedStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.first_name} {s.last_name} ({s.roll_number || s.admission_number || 'No Roll'}) •{' '}
                  {s.department || s.gender || 'Student'}
                </option>
              ))}
            </select>
            {unallocatedStudents.length === 0 && (
              <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                All enrolled students are currently assigned to accommodation.
              </p>
            )}
          </div>

          {/* Destination Bed Selector */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: '6px',
              }}
            >
              Select Available Bed Space <span style={{ color: '#ef4444' }}>*</span>:
            </label>
            <select
              value={createForm.bed_id}
              onChange={(e) => setCreateForm({ ...createForm, bed_id: e.target.value })}
              required
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: '#ffffff',
                fontSize: '0.88rem',
              }}
            >
              <option value="">-- Choose vacant bed --</option>
              {vacantBeds.map((v) => (
                <option key={v.bed_id} value={v.bed_id}>
                  {v.block_name ? `Block ${v.block_name}` : ''} • Room {v.room_name || v.room_code} • Bed {v.bed_name}
                </option>
              ))}
            </select>
            {vacantBeds.length === 0 && (
              <p style={{ fontSize: '0.74rem', color: '#b91c1c', marginTop: '4px' }}>
                No vacant beds available in the assigned hostel.
              </p>
            )}
          </div>

          {/* Allocation Type & Date */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: '6px',
                }}
              >
                Allocation Type:
              </label>
              <select
                value={createForm.allocation_type}
                onChange={(e) => setCreateForm({ ...createForm, allocation_type: e.target.value })}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: '#ffffff',
                  fontSize: '0.88rem',
                }}
              >
                <option value="REGULAR">REGULAR (Full Session)</option>
                <option value="TEMPORARY">TEMPORARY (Guest / Short)</option>
              </select>
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: '6px',
                }}
              >
                Effective Allocation Date:
              </label>
              <input
                type="date"
                value={createForm.allocated_at}
                onChange={(e) => setCreateForm({ ...createForm, allocated_at: e.target.value })}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: '#ffffff',
                  fontSize: '0.88rem',
                }}
              />
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: '6px',
              }}
            >
              Administrative Remarks (Optional):
            </label>
            <textarea
              value={createForm.remarks}
              onChange={(e) => setCreateForm({ ...createForm, remarks: e.target.value })}
              placeholder="e.g., Medical priority, scholarship ward, batch transfer..."
              rows={2}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: '#ffffff',
                fontSize: '0.88rem',
              }}
            />
          </div>
        </form>
      </Modal>

      {/* =================== 2. TRANSFER ALLOCATION MODAL =================== */}
      <Modal
        isOpen={transferModalOpen}
        onClose={() => setTransferModalOpen(false)}
        title="Transfer Resident Room / Bed"
        subtitle={`Current Allocation ID: ${selectedAllocation ? truncateUUID(selectedAllocation.id) : ''}`}
        maxWidth="500px"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTransferModalOpen(false)}
              disabled={formSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleTransferSubmit}
              loading={formSubmitting}
            >
              Execute Transfer
            </Button>
          </>
        }
      >
        <form onSubmit={handleTransferSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {formError && (
            <div
              style={{
                backgroundColor: 'var(--danger-bg)',
                color: 'var(--danger-text)',
                padding: '10px 14px',
                borderRadius: '6px',
                fontSize: '0.84rem',
              }}
            >
              {formError}
            </div>
          )}

          {selectedAllocation && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '8px',
                backgroundColor: '#f8fafc',
                border: '1px solid var(--border-color)',
                fontSize: '0.84rem',
              }}
            >
              {(() => {
                const res = residentByAllocMap.get(selectedAllocation.id);
                return (
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                      Resident: {res?.full_name || 'Enrolled Student'}
                    </div>
                    <div style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
                      Current Assignment: <strong>Room {res?.room_name || res?.room_code || '—'}</strong> • Bed{' '}
                      <strong>{res?.bed_name || '—'}</strong>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* New Destination Bed */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: '6px',
              }}
            >
              Select New Vacant Bed <span style={{ color: '#ef4444' }}>*</span>:
            </label>
            <select
              value={transferForm.new_bed_id}
              onChange={(e) => setTransferForm({ ...transferForm, new_bed_id: e.target.value })}
              required
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: '#ffffff',
                fontSize: '0.88rem',
              }}
            >
              <option value="">-- Choose destination vacant bed --</option>
              {vacantBeds
                .filter((v) => v.bed_id !== selectedAllocation?.bed_id)
                .map((v) => (
                  <option key={v.bed_id} value={v.bed_id}>
                    {v.block_name ? `Block ${v.block_name}` : ''} • Room {v.room_name || v.room_code} • Bed{' '}
                    {v.bed_name}
                  </option>
                ))}
            </select>
          </div>

          {/* Transfer Effective Date */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: '6px',
              }}
            >
              Effective Transfer Date:
            </label>
            <input
              type="date"
              value={transferForm.transferred_at}
              onChange={(e) => setTransferForm({ ...transferForm, transferred_at: e.target.value })}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: '#ffffff',
                fontSize: '0.88rem',
              }}
            />
          </div>
        </form>
      </Modal>

      {/* =================== 3. RELEASE / VACATE MODAL =================== */}
      <Modal
        isOpen={releaseModalOpen}
        onClose={() => setReleaseModalOpen(false)}
        title="Terminate Bed Allocation (Vacate)"
        subtitle={`Target: ${selectedAllocation ? truncateUUID(selectedAllocation.id) : ''}`}
        maxWidth="460px"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReleaseModalOpen(false)}
              disabled={formSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleReleaseSubmit}
              loading={formSubmitting}
            >
              Confirm Vacating
            </Button>
          </>
        }
      >
        <form onSubmit={handleReleaseSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {formError && (
            <div
              style={{
                backgroundColor: 'var(--danger-bg)',
                color: 'var(--danger-text)',
                padding: '10px 14px',
                borderRadius: '6px',
                fontSize: '0.84rem',
              }}
            >
              {formError}
            </div>
          )}

          <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
            Terminating this allocation will release the occupied bed slot back into active inventory as{' '}
            <strong>AVAILABLE</strong>.
          </p>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: '6px',
              }}
            >
              Release Status:
            </label>
            <select
              value={releaseForm.status}
              onChange={(e) => setReleaseForm({ ...releaseForm, status: e.target.value })}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: '#ffffff',
                fontSize: '0.88rem',
              }}
            >
              <option value="RELEASED">RELEASED (Completed stay / Vacated)</option>
              <option value="CANCELLED">CANCELLED (Revoked / Error)</option>
            </select>
          </div>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: '6px',
              }}
            >
              Effective Release Date:
            </label>
            <input
              type="date"
              value={releaseForm.released_at}
              onChange={(e) => setReleaseForm({ ...releaseForm, released_at: e.target.value })}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: '#ffffff',
                fontSize: '0.88rem',
              }}
            />
          </div>
        </form>
      </Modal>

      {/* =================== 4. ALLOCATION HISTORY MODAL =================== */}
      <Modal
        isOpen={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        title="Allocation History & Timeline"
        subtitle={`Allocation Ref: ${selectedAllocation ? truncateUUID(selectedAllocation.id) : ''}`}
        maxWidth="620px"
        footer={
          <Button variant="secondary" size="sm" onClick={() => setHistoryModalOpen(false)}>
            Close
          </Button>
        }
      >
        {selectedAllocation && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Allocation Metadata Summary */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: '12px',
                padding: '14px',
                borderRadius: '8px',
                backgroundColor: '#f8fafc',
                border: '1px solid var(--border-color)',
              }}
            >
              <div>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Status</span>
                <div>
                  <Badge variant={selectedAllocation.status === 'ACTIVE' ? 'success' : 'neutral'}>
                    {selectedAllocation.status}
                  </Badge>
                </div>
              </div>
              <div>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Type</span>
                <div style={{ fontWeight: 600, fontSize: '0.86rem' }}>
                  {selectedAllocation.allocation_type || 'REGULAR'}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Allocated At</span>
                <div style={{ fontWeight: 600, fontSize: '0.86rem' }}>
                  {formatDate(selectedAllocation.allocated_at)}
                </div>
              </div>
              {selectedAllocation.released_at && (
                <div>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Released At</span>
                  <div style={{ fontWeight: 600, fontSize: '0.86rem' }}>
                    {formatDate(selectedAllocation.released_at)}
                  </div>
                </div>
              )}
            </div>

            {selectedAllocation.remarks && (
              <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                <strong>Remarks:</strong> {selectedAllocation.remarks}
              </div>
            )}

            {/* Resident Lifecycle Timeline */}
            <div>
              <h4
                style={{
                  fontSize: '0.92rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <History size={16} />
                Resident Allocation History ({studentHistory.length})
              </h4>

              {loadingHistory ? (
                <div style={{ padding: '24px', textAlign: 'center' }}>
                  <LoadingSpinner message="Retrieving allocation timeline..." size="sm" />
                </div>
              ) : studentHistory.length === 0 ? (
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  No prior historical allocations logged for this resident.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {studentHistory.map((h, i) => (
                    <div
                      key={h.id || i}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: h.id === selectedAllocation.id ? '#eff6ff' : '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.82rem',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          Ref: {truncateUUID(h.id)} • {h.allocation_type || 'REGULAR'}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          From: {formatDate(h.allocated_at)}{' '}
                          {h.released_at ? `to ${formatDate(h.released_at)}` : '(Current Active)'}
                        </div>
                      </div>
                      <Badge variant={h.status === 'ACTIVE' ? 'success' : 'neutral'}>{h.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
