import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
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
import ConfirmationDialog from '../components/ConfirmationDialog';
import Badge from '../components/Badge';
import Button from '../components/Button';
import SearchInput from '../components/SearchInput';
import {
  BedDouble,
  Building2,
  Layers,
  Search,
  Filter,
  RefreshCw,
  LayoutGrid,
  List,
  Eye,
  SlidersHorizontal,
  CheckCircle2,
  AlertCircle,
  Users,
  Info,
  ShieldCheck,
  DoorOpen,
  Wrench,
  Check,
  User,
} from 'lucide-react';

export default function RoomsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { assignedHostel } = useAuth();
  const { hasPermission } = usePermissions();

  const canManage = hasPermission(PERMISSIONS.HOSTEL_MANAGE) || hasPermission(PERMISSIONS.PEOPLE_MANAGE);

  // URL search params pre-selection
  const initialBlockId = searchParams.get('blockId');
  const initialFloorId = searchParams.get('floorId');

  // Master Data
  const [hostelData, setHostelData] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [selectedBlockId, setSelectedBlockId] = useState(initialBlockId || '');
  const [floors, setFloors] = useState([]);
  const [selectedFloorId, setSelectedFloorId] = useState(initialFloorId || '');
  const [rooms, setRooms] = useState([]);
  const [vacantBeds, setVacantBeds] = useState([]);
  const [residents, setResidents] = useState([]);

  // Loading & State flags
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [successBanner, setSuccessBanner] = useState(null);

  // View & Filter State
  const [viewMode, setViewMode] = useState('GRID'); // 'GRID' | 'TABLE'
  const [searchTerm, setSearchTerm] = useState('');
  const [roomTypeFilter, setRoomTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [occupancyFilter, setOccupancyFilter] = useState('ALL');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  // Room Detail Modal State
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [roomBeds, setRoomBeds] = useState([]);
  const [loadingBeds, setLoadingBeds] = useState(false);

  // Operational Status Modal State
  const [statusTarget, setStatusTarget] = useState(null); // { type: 'ROOM'|'BED', item: object, room?: object }
  const [targetStatusValue, setTargetStatusValue] = useState('ACTIVE');
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [statusError, setStatusError] = useState(null);

  // Auto-dismiss banner
  useEffect(() => {
    if (successBanner) {
      const timer = setTimeout(() => setSuccessBanner(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successBanner]);

  // 1. Initial Load: Hostel, Blocks, Vacant Beds, and Residents
  const loadInitialData = useCallback(async () => {
    try {
      setLoadingInitial(true);
      setError(null);

      const hostel = await inchargeService.getMyHostel();
      setHostelData(hostel);

      const hostelId = hostel?.id || hostel?.hostel_id || assignedHostel?.id;
      if (!hostelId) {
        throw new Error('No assigned hostel found for the authenticated user.');
      }

      // Parallel fetch blocks, vacant beds, and residents
      const [blocksRes, vacantBedsRes, residentsRes] = await Promise.allSettled([
        inchargeService.getBlocks(hostelId),
        inchargeService.getVacantBeds(hostelId),
        inchargeService.getHostelResidents(hostelId),
      ]);

      const rawBlocks = blocksRes.status === 'fulfilled' ? blocksRes.value : [];
      const validBlocks = Array.isArray(rawBlocks) ? rawBlocks : [];
      setBlocks(validBlocks);

      setVacantBeds(
        vacantBedsRes.status === 'fulfilled' && Array.isArray(vacantBedsRes.value)
          ? vacantBedsRes.value
          : []
      );
      setResidents(
        residentsRes.status === 'fulfilled' && Array.isArray(residentsRes.value)
          ? residentsRes.value
          : []
      );

      // Resolve initial block selection
      let activeBlockId = selectedBlockId;
      if (!activeBlockId && validBlocks.length > 0) {
        activeBlockId = validBlocks[0].id;
        setSelectedBlockId(activeBlockId);
      }

      if (activeBlockId) {
        const floorsData = await inchargeService.getFloors(hostelId, activeBlockId);
        const validFloors = Array.isArray(floorsData) ? floorsData : [];
        setFloors(validFloors);

        let activeFloorId = selectedFloorId;
        if (!activeFloorId && validFloors.length > 0) {
          activeFloorId = validFloors[0].id;
          setSelectedFloorId(activeFloorId);
        }

        if (activeFloorId) {
          await fetchRoomsForFloor(hostelId, activeBlockId, activeFloorId);
        }
      }
    } catch (err) {
      console.error('Initial room data loading failed:', err);
      setError(err.message || 'Failed to initialize hostel room operations.');
    } finally {
      setLoadingInitial(false);
    }
  }, [assignedHostel, selectedBlockId, selectedFloorId]);

  useEffect(() => {
    loadInitialData();
  }, []);

  // 2. Fetch rooms for a specific floor
  const fetchRoomsForFloor = async (hostelId, blockId, floorId) => {
    if (!hostelId || !blockId || !floorId) return;
    try {
      setLoadingRooms(true);
      const data = await inchargeService.getRooms(hostelId, blockId, floorId);
      setRooms(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load rooms:', err);
      setRooms([]);
    } finally {
      setLoadingRooms(false);
    }
  };

  // Handle block switch
  const handleBlockChange = async (newBlockId) => {
    setSelectedBlockId(newBlockId);
    setSelectedFloorId('');
    setRooms([]);
    setCurrentPage(1);

    const hostelId = hostelData?.id || hostelData?.hostel_id || assignedHostel?.id;
    if (newBlockId && hostelId) {
      try {
        setLoadingRooms(true);
        const floorsData = await inchargeService.getFloors(hostelId, newBlockId);
        const validFloors = Array.isArray(floorsData) ? floorsData : [];
        setFloors(validFloors);
        if (validFloors.length > 0) {
          const firstFloorId = validFloors[0].id;
          setSelectedFloorId(firstFloorId);
          await fetchRoomsForFloor(hostelId, newBlockId, firstFloorId);
        }
      } catch (err) {
        console.error('Failed to load floors on block change:', err);
      } finally {
        setLoadingRooms(false);
      }
    }
  };

  // Handle floor switch
  const handleFloorChange = async (newFloorId) => {
    setSelectedFloorId(newFloorId);
    setCurrentPage(1);
    const hostelId = hostelData?.id || hostelData?.hostel_id || assignedHostel?.id;
    if (hostelId && selectedBlockId && newFloorId) {
      await fetchRoomsForFloor(hostelId, selectedBlockId, newFloorId);
    }
  };

  // 3. Algorithmic High-Efficiency Mappings (O(n) construction, O(1) lookups)
  const { residentBedMap, residentRoomCountMap, vacantBedCountMap } = useMemo(() => {
    const resBedMap = new Map();
    const resRoomMap = new Map();
    residents.forEach((r) => {
      if (r.bed_id) resBedMap.set(r.bed_id, r);
      if (r.room_id) {
        resRoomMap.set(r.room_id, (resRoomMap.get(r.room_id) || 0) + 1);
      }
    });

    const vacMap = new Map();
    vacantBeds.forEach((v) => {
      if (v.room_id) {
        vacMap.set(v.room_id, (vacMap.get(v.room_id) || 0) + 1);
      }
    });

    return {
      residentBedMap: resBedMap,
      residentRoomCountMap: resRoomMap,
      vacantBedCountMap: vacMap,
    };
  }, [residents, vacantBeds]);

  // 4. Client Search & Filtering
  const filteredRooms = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return rooms.filter((room) => {
      // Search query filter (matches room code, name, type)
      if (term) {
        const codeMatch = String(room.code || '').toLowerCase().includes(term);
        const nameMatch = String(room.name || '').toLowerCase().includes(term);
        const typeMatch = String(room.room_type || '').toLowerCase().includes(term);
        if (!codeMatch && !nameMatch && !typeMatch) return false;
      }

      // Room Type filter
      if (roomTypeFilter !== 'ALL' && room.room_type !== roomTypeFilter) {
        return false;
      }

      // Status filter
      if (statusFilter !== 'ALL' && room.status !== statusFilter) {
        return false;
      }

      // Occupancy filter
      const capacity = Number(room.capacity || 0);
      const occupied = residentRoomCountMap.get(room.id) || 0;
      const vacant = Math.max(0, capacity - occupied);

      if (occupancyFilter === 'AVAILABLE' && vacant <= 0) return false;
      if (occupancyFilter === 'FULL' && (vacant > 0 || capacity === 0)) return false;
      if (occupancyFilter === 'EMPTY' && occupied > 0) return false;

      return true;
    });
  }, [rooms, searchTerm, roomTypeFilter, statusFilter, occupancyFilter, residentRoomCountMap]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredRooms.length / pageSize));
  const paginatedRooms = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRooms.slice(start, start + pageSize);
  }, [filteredRooms, currentPage, pageSize]);

  // Open Room Detail Modal & Load beds on demand
  const handleOpenRoomDetail = async (room) => {
    setSelectedRoom(room);
    setDetailModalOpen(true);
    setRoomBeds([]);
    setLoadingBeds(true);

    const hostelId = hostelData?.id || hostelData?.hostel_id || assignedHostel?.id;
    try {
      const beds = await inchargeService.getBeds(hostelId, selectedBlockId, selectedFloorId, room.id);
      setRoomBeds(Array.isArray(beds) ? beds : []);
    } catch (err) {
      console.error('Failed to load beds for room:', err);
    } finally {
      setLoadingBeds(false);
    }
  };

  // Operational Status update submit
  const handleStatusSubmit = async () => {
    if (!statusTarget) return;
    setStatusSubmitting(true);
    setStatusError(null);

    const hostelId = hostelData?.id || hostelData?.hostel_id || assignedHostel?.id;
    try {
      if (statusTarget.type === 'ROOM') {
        await inchargeService.updateRoomStatus(
          hostelId,
          selectedBlockId,
          selectedFloorId,
          statusTarget.item.id,
          targetStatusValue
        );
        setSuccessBanner(`Room "${statusTarget.item.name}" status updated to ${targetStatusValue}.`);
        // Refresh rooms
        await fetchRoomsForFloor(hostelId, selectedBlockId, selectedFloorId);
        if (selectedRoom?.id === statusTarget.item.id) {
          setSelectedRoom((prev) => ({ ...prev, status: targetStatusValue }));
        }
      } else if (statusTarget.type === 'BED') {
        const roomId = statusTarget.room?.id || selectedRoom?.id;
        await inchargeService.updateBedStatus(
          hostelId,
          selectedBlockId,
          selectedFloorId,
          roomId,
          statusTarget.item.id,
          targetStatusValue
        );
        setSuccessBanner(`Bed "${statusTarget.item.code}" status updated to ${targetStatusValue}.`);
        // Refresh beds in modal
        const beds = await inchargeService.getBeds(hostelId, selectedBlockId, selectedFloorId, roomId);
        setRoomBeds(Array.isArray(beds) ? beds : []);
      }
      setStatusTarget(null);
    } catch (err) {
      console.error('Status update failed:', err);
      setStatusError(err.response?.data?.message || err.message || 'Failed to update operational status.');
    } finally {
      setStatusSubmitting(false);
    }
  };

  const activeHostel = hostelData || assignedHostel;
  const activeBlock = blocks.find((b) => b.id === selectedBlockId);
  const activeFloor = floors.find((f) => f.id === selectedFloorId);

  return (
    <div>
      <PageHeader
        title="Room & Bed Operations"
        description="Operational room directory, bed allocation states, occupancy telemetry, and status maintenance."
        icon={BedDouble}
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Button
              variant="outline"
              size="sm"
              icon={RefreshCw}
              onClick={() => {
                const hostelId = hostelData?.id || hostelData?.hostel_id || assignedHostel?.id;
                if (hostelId && selectedBlockId && selectedFloorId) {
                  fetchRoomsForFloor(hostelId, selectedBlockId, selectedFloorId);
                }
              }}
              loading={loadingRooms}
            >
              Sync Rooms
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={Building2}
              onClick={() => navigate('/hostel')}
            >
              Hostel Overview
            </Button>
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

      {/* Ownership Boundary Notice */}
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
          <strong>Operational Maintenance:</strong> Room specifications, codes, and design capacities are provisioned
          by College Administration. Hostel In-Charges oversee bed occupancy telemetry, resident assignments, and operational maintenance statuses.
        </div>
      </div>

      {loadingInitial && <LoadingState title="Loading Room Operations Workspace..." rows={4} />}
      {error && (
        <ErrorState
          title="Unable to Access Room Operations"
          message={error}
          onRetry={loadInitialData}
        />
      )}

      {!loadingInitial && !error && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Hierarchy Filter Bar */}
          <div className="card" style={{ padding: '18px 24px' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px',
                alignItems: 'flex-end',
              }}
            >
              {/* Block Selection */}
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
                  Architectural Block:
                </label>
                <select
                  value={selectedBlockId}
                  onChange={(e) => handleBlockChange(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: '#ffffff',
                    fontSize: '0.86rem',
                    fontWeight: 500,
                  }}
                >
                  {blocks.length === 0 ? (
                    <option value="">No Blocks Available</option>
                  ) : (
                    blocks.map((b) => (
                      <option key={b.id} value={b.id}>
                        Block {b.name} ({b.code})
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Floor Selection */}
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
                  Configured Floor:
                </label>
                <select
                  value={selectedFloorId}
                  onChange={(e) => handleFloorChange(e.target.value)}
                  disabled={floors.length === 0}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: floors.length === 0 ? '#f1f5f9' : '#ffffff',
                    fontSize: '0.86rem',
                    fontWeight: 500,
                  }}
                >
                  {floors.length === 0 ? (
                    <option value="">No Floors in Block</option>
                  ) : (
                    floors.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} (Code: {f.code})
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Room Type Filter */}
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
                  Room Type:
                </label>
                <select
                  value={roomTypeFilter}
                  onChange={(e) => {
                    setRoomTypeFilter(e.target.value);
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
                  <option value="ALL">All Room Types</option>
                  <option value="SINGLE">Single Room</option>
                  <option value="DOUBLE">Double Sharing</option>
                  <option value="TRIPLE">Triple Sharing</option>
                  <option value="DORMITORY">Dormitory</option>
                  <option value="STANDARD">Standard</option>
                </select>
              </div>

              {/* Operational Status Filter */}
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
                  Operational Status:
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
                  <option value="ALL">All Operational Statuses</option>
                  <option value="ACTIVE">ACTIVE (Operational)</option>
                  <option value="MAINTENANCE">MAINTENANCE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>

              {/* Occupancy State Filter */}
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
                  Occupancy State:
                </label>
                <select
                  value={occupancyFilter}
                  onChange={(e) => {
                    setOccupancyFilter(e.target.value);
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
                  <option value="ALL">All Occupancy States</option>
                  <option value="AVAILABLE">Has Vacant Beds</option>
                  <option value="FULL">Fully Occupied</option>
                  <option value="EMPTY">Completely Vacant</option>
                </select>
              </div>
            </div>

            {/* Sub-bar: Search Input & View Toggle */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '14px',
                marginTop: '16px',
                paddingTop: '16px',
                borderTop: '1px solid #f1f5f9',
              }}
            >
              <div style={{ flex: '1 1 300px', maxWidth: '400px' }}>
                <SearchInput
                  value={searchTerm}
                  onChange={(val) => {
                    setSearchTerm(val);
                    setCurrentPage(1);
                  }}
                  placeholder="Search by room code, name, or type..."
                  debounceMs={300}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  Showing <strong>{filteredRooms.length}</strong> matching rooms
                </span>

                {/* View Mode Toggle Buttons */}
                <div
                  style={{
                    display: 'flex',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    overflow: 'hidden',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setViewMode('GRID')}
                    style={{
                      padding: '6px 12px',
                      border: 'none',
                      backgroundColor: viewMode === 'GRID' ? 'var(--primary-light)' : '#ffffff',
                      color: viewMode === 'GRID' ? 'var(--primary-color)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                    }}
                  >
                    <LayoutGrid size={15} />
                    Grid
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('TABLE')}
                    style={{
                      padding: '6px 12px',
                      border: 'none',
                      backgroundColor: viewMode === 'TABLE' ? 'var(--primary-light)' : '#ffffff',
                      color: viewMode === 'TABLE' ? 'var(--primary-color)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                    }}
                  >
                    <List size={15} />
                    Table
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Rooms Display Container */}
          {loadingRooms ? (
            <LoadingState title="Loading Floor Rooms..." rows={3} />
          ) : filteredRooms.length === 0 ? (
            <EmptyState
              icon={DoorOpen}
              title="No Rooms Match Filter"
              message={
                rooms.length === 0
                  ? `No rooms have been provisioned on Floor ${activeFloor?.name || 'this floor'}.`
                  : 'Try adjusting your search criteria or operational status filters.'
              }
            />
          ) : viewMode === 'GRID' ? (
            /* =================== GRID VIEW =================== */
            <div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
                  gap: '16px',
                }}
              >
                {paginatedRooms.map((room) => {
                  const capacity = Number(room.capacity || 0);
                  const occupied = residentRoomCountMap.get(room.id) || 0;
                  const available = Math.max(0, capacity - occupied);
                  const fillPercent = capacity > 0 ? Math.min(100, Math.round((occupied / capacity) * 100)) : 0;

                  return (
                    <div
                      key={room.id}
                      style={{
                        border: '1px solid var(--border-color)',
                        borderRadius: '10px',
                        padding: '16px',
                        backgroundColor: '#ffffff',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        boxShadow: 'var(--shadow-card)',
                        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                      }}
                    >
                      <div>
                        {/* Header: Room Name, Code & Status */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '6px',
                                backgroundColor: 'var(--primary-light)',
                                color: 'var(--primary-color)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <DoorOpen size={18} />
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.98rem' }}>
                                Room {room.name}
                              </div>
                              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                Code: <strong>{room.code}</strong>
                              </div>
                            </div>
                          </div>
                          <Badge
                            variant={
                              room.status === 'ACTIVE'
                                ? 'success'
                                : room.status === 'MAINTENANCE'
                                ? 'warning'
                                : 'neutral'
                            }
                          >
                            {room.status || 'ACTIVE'}
                          </Badge>
                        </div>

                        {/* Room Attributes */}
                        <div
                          style={{
                            margin: '12px 0',
                            padding: '10px 12px',
                            borderRadius: '6px',
                            backgroundColor: '#f8fafc',
                            fontSize: '0.78rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Type:</span>
                            <strong style={{ color: 'var(--text-primary)' }}>{room.room_type || 'Standard'}</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Capacity:</span>
                            <strong style={{ color: 'var(--text-primary)' }}>{capacity} Beds</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Available:</span>
                            <strong style={{ color: available > 0 ? '#15803d' : '#991b1b' }}>
                              {available} Vacant
                            </strong>
                          </div>
                        </div>

                        {/* Occupancy Gauge */}
                        <div style={{ marginBottom: '14px' }}>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              fontSize: '0.74rem',
                              marginBottom: '4px',
                            }}
                          >
                            <span style={{ color: 'var(--text-muted)' }}>Occupancy</span>
                            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                              {occupied} / {capacity} Beds
                            </span>
                          </div>
                          <div
                            style={{
                              height: '6px',
                              width: '100%',
                              backgroundColor: '#e2e8f0',
                              borderRadius: '3px',
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                height: '100%',
                                width: `${fillPercent}%`,
                                backgroundColor: fillPercent === 100 ? '#2563eb' : '#10b981',
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Card Footer Actions */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingTop: '12px',
                          borderTop: '1px solid #f1f5f9',
                          gap: '8px',
                        }}
                      >
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={Eye}
                          onClick={() => handleOpenRoomDetail(room)}
                          style={{ flex: 1 }}
                        >
                          Beds & Details
                        </Button>

                        {canManage && (
                          <button
                            type="button"
                            title="Update Operational Status"
                            onClick={() => {
                              setStatusTarget({ type: 'ROOM', item: room });
                              setTargetStatusValue(room.status || 'ACTIVE');
                            }}
                            style={{
                              padding: '6px 10px',
                              borderRadius: '6px',
                              border: '1px solid var(--border-color)',
                              backgroundColor: '#ffffff',
                              color: 'var(--text-secondary)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <SlidersHorizontal size={15} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* =================== TABLE VIEW =================== */
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-container" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Room</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Block / Floor</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Type</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Capacity</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Occupied</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Available</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Status</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right' }}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRooms.map((room) => {
                      const capacity = Number(room.capacity || 0);
                      const occupied = residentRoomCountMap.get(room.id) || 0;
                      const available = Math.max(0, capacity - occupied);

                      return (
                        <tr
                          key={room.id}
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            transition: 'background-color 0.15s ease',
                          }}
                        >
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{room.name}</div>
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{room.code}</div>
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                            {activeBlock?.name || '—'} / {activeFloor?.name || '—'}
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--text-primary)' }}>
                            {room.room_type || 'Standard'}
                          </td>
                          <td style={{ padding: '12px 16px', fontWeight: 600 }}>{capacity}</td>
                          <td style={{ padding: '12px 16px', color: 'var(--primary-color)', fontWeight: 600 }}>
                            {occupied}
                          </td>
                          <td
                            style={{
                              padding: '12px 16px',
                              fontWeight: 700,
                              color: available > 0 ? '#15803d' : '#991b1b',
                            }}
                          >
                            {available}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <Badge
                              variant={
                                room.status === 'ACTIVE'
                                  ? 'success'
                                  : room.status === 'MAINTENANCE'
                                  ? 'warning'
                                  : 'neutral'
                              }
                            >
                              {room.status || 'ACTIVE'}
                            </Badge>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                              <Button
                                variant="secondary"
                                size="sm"
                                icon={Eye}
                                onClick={() => handleOpenRoomDetail(room)}
                              >
                                View
                              </Button>
                              {canManage && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setStatusTarget({ type: 'ROOM', item: room });
                                    setTargetStatusValue(room.status || 'ACTIVE');
                                  }}
                                  style={{
                                    padding: '5px 8px',
                                    borderRadius: '6px',
                                    border: '1px solid var(--border-color)',
                                    backgroundColor: '#ffffff',
                                    color: 'var(--text-secondary)',
                                    cursor: 'pointer',
                                  }}
                                  title="Change Status"
                                >
                                  <SlidersHorizontal size={14} />
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
            </div>
          )}

          {/* Pagination Controls */}
          {filteredRooms.length > pageSize && (
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

      {/* =================== ROOM & BED DETAIL MODAL =================== */}
      <Modal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title={selectedRoom ? `Room Details — ${selectedRoom.name} (${selectedRoom.code})` : 'Room Details'}
        subtitle={`Premises Block: ${activeBlock?.name || '—'} • Floor: ${activeFloor?.name || '—'}`}
        maxWidth="680px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <div>
              {canManage && selectedRoom && (
                <Button
                  variant="outline"
                  size="sm"
                  icon={SlidersHorizontal}
                  onClick={() => {
                    setStatusTarget({ type: 'ROOM', item: selectedRoom });
                    setTargetStatusValue(selectedRoom.status || 'ACTIVE');
                  }}
                >
                  Change Room Status
                </Button>
              )}
            </div>
            <Button variant="secondary" size="sm" onClick={() => setDetailModalOpen(false)}>
              Close
            </Button>
          </div>
        }
      >
        {selectedRoom && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Room Metadata Card */}
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
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Room Type</span>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.86rem' }}>
                  {selectedRoom.room_type || 'Standard'}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Total Capacity</span>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.86rem' }}>
                  {selectedRoom.capacity} Beds
                </div>
              </div>
              <div>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Occupied</span>
                <div style={{ fontWeight: 600, color: 'var(--primary-color)', fontSize: '0.86rem' }}>
                  {residentRoomCountMap.get(selectedRoom.id) || 0} Residents
                </div>
              </div>
              <div>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Operational Status</span>
                <div>
                  <Badge
                    variant={
                      selectedRoom.status === 'ACTIVE'
                        ? 'success'
                        : selectedRoom.status === 'MAINTENANCE'
                        ? 'warning'
                        : 'neutral'
                    }
                  >
                    {selectedRoom.status || 'ACTIVE'}
                  </Badge>
                </div>
              </div>
            </div>

            {selectedRoom.description && (
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                <strong>Description:</strong> {selectedRoom.description}
              </div>
            )}

            {/* Bed Inventory Subsection */}
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '10px',
                }}
              >
                <h4
                  style={{
                    fontSize: '0.92rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <BedDouble size={16} />
                  Bed Inventory & Allocation Status ({roomBeds.length})
                </h4>
              </div>

              {loadingBeds ? (
                <div style={{ padding: '24px', textAlign: 'center' }}>
                  <LoadingSpinner message="Loading Bed Allocations..." size="md" />
                </div>
              ) : roomBeds.length === 0 ? (
                <EmptyState
                  icon={BedDouble}
                  title="No Beds Configured"
                  message="No bed slots have been added to this room by College Administration."
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {roomBeds.map((bed) => {
                    const resident = residentBedMap.get(bed.id);
                    const isOccupied = Boolean(resident);

                    return (
                      <div
                        key={bed.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 16px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: isOccupied ? '#f8fafc' : '#ffffff',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '6px',
                              backgroundColor: isOccupied ? 'var(--primary-light)' : '#f0fdf4',
                              color: isOccupied ? 'var(--primary-color)' : '#15803d',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <BedDouble size={16} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.88rem' }}>
                              Bed {bed.code}
                              {bed.name ? ` (${bed.name})` : ''}
                            </div>
                            <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                              {isOccupied ? (
                                <span>
                                  Occupied by: <strong>{resident.full_name}</strong> • Roll:{' '}
                                  <strong>{resident.roll_number || '—'}</strong>
                                </span>
                              ) : (
                                <span style={{ color: '#15803d', fontWeight: 600 }}>
                                  Vacant / Available for Assignment
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Badge
                            variant={
                              bed.status === 'AVAILABLE' || bed.status === 'ACTIVE'
                                ? 'success'
                                : bed.status === 'MAINTENANCE'
                                ? 'warning'
                                : 'neutral'
                            }
                          >
                            {bed.status || (isOccupied ? 'OCCUPIED' : 'AVAILABLE')}
                          </Badge>

                          {isOccupied ? (
                            <button
                              type="button"
                              onClick={() => {
                                navigate(`/allocations?bedId=${bed.id}&studentId=${resident.student_id}`);
                              }}
                              title="Manage or view bed allocation record"
                              style={{
                                padding: '4px 8px',
                                borderRadius: '4px',
                                border: '1px solid var(--primary-border)',
                                backgroundColor: 'var(--primary-light)',
                                color: 'var(--primary-color)',
                                fontSize: '0.74rem',
                                cursor: 'pointer',
                                fontWeight: 600,
                              }}
                            >
                              Allocation
                            </button>
                          ) : (
                            canManage && (
                              <button
                                type="button"
                                onClick={() => {
                                  navigate(`/allocations?bedId=${bed.id}&action=allocate`);
                                }}
                                title="Assign unallocated student to this vacant bed"
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  border: '1px solid #bbf7d0',
                                  backgroundColor: '#f0fdf4',
                                  color: '#15803d',
                                  fontSize: '0.74rem',
                                  cursor: 'pointer',
                                  fontWeight: 600,
                                }}
                              >
                                Allocate
                              </button>
                            )
                          )}

                          {canManage && (
                            <button
                              type="button"
                              onClick={() => {
                                setStatusTarget({ type: 'BED', item: bed, room: selectedRoom });
                                setTargetStatusValue(bed.status || 'AVAILABLE');
                              }}
                              title="Update operational status"
                              style={{
                                padding: '4px 8px',
                                borderRadius: '4px',
                                border: '1px solid var(--border-color)',
                                backgroundColor: '#ffffff',
                                color: 'var(--text-secondary)',
                                fontSize: '0.74rem',
                                cursor: 'pointer',
                                fontWeight: 500,
                              }}
                            >
                              Status
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Operational Inspection Note */}
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '8px',
                backgroundColor: '#fffbeb',
                border: '1px solid #fde68a',
                fontSize: '0.78rem',
                color: '#92400e',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Info size={16} style={{ flexShrink: 0 }} />
              <div>
                <strong>Physical Inspection Protocol:</strong> Routine custodial reviews are maintained through maintenance tickets. Room operational availability can be adjusted using the status controls above.
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* =================== OPERATIONAL STATUS UPDATE MODAL =================== */}
      <Modal
        isOpen={Boolean(statusTarget)}
        onClose={() => setStatusTarget(null)}
        title={`Update ${statusTarget?.type === 'ROOM' ? 'Room' : 'Bed'} Operational Status`}
        subtitle={`Target: ${statusTarget?.item?.code || statusTarget?.item?.name || 'Selected'}`}
        maxWidth="440px"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStatusTarget(null)}
              disabled={statusSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleStatusSubmit}
              loading={statusSubmitting}
            >
              Apply Status
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {statusError && (
            <div
              style={{
                backgroundColor: 'var(--danger-bg)',
                color: 'var(--danger-text)',
                padding: '10px 14px',
                borderRadius: '6px',
                fontSize: '0.84rem',
              }}
            >
              {statusError}
            </div>
          )}

          <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
            Adjust the operational status of this {statusTarget?.type?.toLowerCase()}. When marked as{' '}
            <strong>MAINTENANCE</strong> or <strong>INACTIVE</strong>, it is flagged as unavailable for bed allocations.
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
              Operational Status:
            </label>
            <select
              value={targetStatusValue}
              onChange={(e) => setTargetStatusValue(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: '#ffffff',
                fontSize: '0.88rem',
                color: 'var(--text-primary)',
              }}
            >
              <option value="ACTIVE">ACTIVE (Fully Operational)</option>
              <option value="AVAILABLE">AVAILABLE (Vacant & Ready)</option>
              <option value="MAINTENANCE">MAINTENANCE (Under Cleaning / Service)</option>
              <option value="INACTIVE">INACTIVE (Out of Service)</option>
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
}
