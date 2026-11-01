import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import adminService from '../services/adminService';
import { useAuth } from '../../../shared/auth/useAuth';
import {
  Building2,
  Layers,
  DoorOpen,
  BedDouble,
  Search,
  Plus,
  RefreshCw,
  Edit2,
  Trash2,
  Eye,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Home,
  Users,
  Info,
  ShieldCheck,
  Sparkles,
  ArrowLeft,
  SlidersHorizontal,
  Clock,
  Shield,
  UserCheck,
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

export default function AdminHostelsPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Permission check
  const canManageAccommodation = useMemo(() => {
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
  const [hostels, setHostels] = useState([]);
  const [inchargesMap, setInchargesMap] = useState({}); // { hostelId: [] }
  const [activeAllocations, setActiveAllocations] = useState([]);
  const [studentsList, setStudentsList] = useState([]);

  // Drilldown Hierarchy Context
  const [selectedHostel, setSelectedHostel] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [floors, setFloors] = useState([]);
  const [selectedFloor, setSelectedFloor] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [beds, setBeds] = useState([]);

  // UI & Loading States
  const [loading, setLoading] = useState(true);
  const [hierarchyLoading, setHierarchyLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successBanner, setSuccessBanner] = useState(null);

  // View Mode: 'HIERARCHY' (drill down) or 'GLOBAL_ROOMS' (all rooms flat lookup)
  const [viewMode, setViewMode] = useState('HIERARCHY');

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [roomTypeFilter, setRoomTypeFilter] = useState('ALL');

  // Modals Visibility
  const [hostelModalOpen, setHostelModalOpen] = useState(false);
  const [hostelModalMode, setHostelModalMode] = useState('CREATE'); // 'CREATE' | 'EDIT'
  const [hostelStatusModalOpen, setHostelStatusModalOpen] = useState(false);

  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [blockModalMode, setBlockModalMode] = useState('CREATE');
  const [blockStatusModalOpen, setBlockStatusModalOpen] = useState(false);
  const [targetBlock, setTargetBlock] = useState(null);

  const [floorModalOpen, setFloorModalOpen] = useState(false);
  const [floorModalMode, setFloorModalMode] = useState('CREATE');
  const [floorStatusModalOpen, setFloorStatusModalOpen] = useState(false);
  const [targetFloor, setTargetFloor] = useState(null);

  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [roomModalMode, setRoomModalMode] = useState('CREATE');
  const [roomStatusModalOpen, setRoomStatusModalOpen] = useState(false);
  const [targetRoom, setTargetRoom] = useState(null);

  const [bedModalOpen, setBedModalOpen] = useState(false);
  const [bedStatusModalOpen, setBedStatusModalOpen] = useState(false);
  const [targetBed, setTargetBed] = useState(null);

  // Form States
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const [hostelForm, setHostelForm] = useState({
    code: '',
    name: '',
    category: 'BOYS',
    total_capacity: 100,
    status: 'ACTIVE',
    description: '',
    address: '',
  });

  const [blockForm, setBlockForm] = useState({
    code: '',
    name: '',
    description: '',
  });

  const [floorForm, setFloorForm] = useState({
    code: '',
    name: '',
    floor_number: 1,
    description: '',
  });

  const [roomForm, setRoomForm] = useState({
    code: '',
    name: '',
    room_type: 'DOUBLE',
    capacity: 2,
    description: '',
  });

  const [bedForm, setBedForm] = useState({
    code: '',
    name: '',
  });

  const [newStatusValue, setNewStatusValue] = useState('ACTIVE');

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
  const loadHostelsAndAllocations = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    else setLoading(true);
    setErrorMessage(null);

    try {
      // 1. Fetch Hostels
      const hostelsRes = await adminService.getHostels();
      const rawHostels = Array.isArray(hostelsRes) ? hostelsRes : hostelsRes?.hostels || [];
      setHostels(rawHostels);

      // 2. Fetch Active Bed Allocations for live occupancy calculation
      try {
        const allocRes = await adminService.getBedAllocations({ status: 'ACTIVE' });
        const rawAlloc = Array.isArray(allocRes) ? allocRes : allocRes?.allocations || [];
        setActiveAllocations(rawAlloc);
      } catch (err) {
        console.warn('Could not load bed allocations:', err);
      }

      // 3. Fetch Student directory for occupant name lookup
      try {
        const studRes = await adminService.getStudents();
        const rawStudents = Array.isArray(studRes) ? studRes : studRes?.students || [];
        setStudentsList(rawStudents);
      } catch (err) {
        console.warn('Could not load students directory:', err);
      }

      // 4. Fetch Incharge assignments per hostel
      if (rawHostels.length > 0) {
        try {
          const inchargeResults = await Promise.allSettled(
            rawHostels.map(async (h) => {
              const res = await adminService.getInchargeAssignments(h.id);
              const incharges = Array.isArray(res) ? res : res?.incharges || [];
              return { hostelId: h.id, incharges };
            })
          );
          const map = {};
          inchargeResults.forEach((r) => {
            if (r.status === 'fulfilled') {
              map[r.value.hostelId] = r.value.incharges;
            }
          });
          setInchargesMap(map);
        } catch (err) {
          console.warn('Could not load incharge assignments:', err);
        }
      }
    } catch (err) {
      console.error('Failed to load hostels:', err);
      setErrorMessage(err.message || 'Failed to load hostel structures.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadHostelsAndAllocations();
  }, [loadHostelsAndAllocations]);

  // Student Map Lookup
  const studentMap = useMemo(() => {
    const map = new Map();
    studentsList.forEach((st) => map.set(st.id, st));
    return map;
  }, [studentsList]);

  // Bed Allocation Map Lookup: bedId -> BedAllocation
  const bedAllocationMap = useMemo(() => {
    const map = new Map();
    activeAllocations.forEach((alloc) => {
      if (alloc.bed_id) {
        map.set(alloc.bed_id, alloc);
      }
    });
    return map;
  }, [activeAllocations]);

  // =========================================================================
  // Hierarchy Fetchers: Blocks, Floors, Rooms, Beds
  // =========================================================================
  const loadBlocksForHostel = async (hostel) => {
    setSelectedHostel(hostel);
    setSelectedBlock(null);
    setSelectedFloor(null);
    setSelectedRoom(null);
    setHierarchyLoading(true);

    try {
      const res = await adminService.getBlocks(hostel.id);
      const rawBlocks = Array.isArray(res) ? res : res?.blocks || [];
      setBlocks(rawBlocks);
    } catch (err) {
      console.error('Failed to load blocks:', err);
      setBlocks([]);
    } finally {
      setHierarchyLoading(false);
    }
  };

  const loadFloorsForBlock = async (block) => {
    if (!selectedHostel) return;
    setSelectedBlock(block);
    setSelectedFloor(null);
    setSelectedRoom(null);
    setHierarchyLoading(true);

    try {
      const res = await adminService.getFloors(selectedHostel.id, block.id);
      const rawFloors = Array.isArray(res) ? res : res?.floors || [];
      // Sort floors by floor_number ascending
      rawFloors.sort((a, b) => (a.floor_number || 0) - (b.floor_number || 0));
      setFloors(rawFloors);
    } catch (err) {
      console.error('Failed to load floors:', err);
      setFloors([]);
    } finally {
      setHierarchyLoading(false);
    }
  };

  const loadRoomsForFloor = async (floor) => {
    if (!selectedHostel || !selectedBlock) return;
    setSelectedFloor(floor);
    setSelectedRoom(null);
    setHierarchyLoading(true);

    try {
      const res = await adminService.getRooms(selectedHostel.id, selectedBlock.id, floor.id);
      const rawRooms = Array.isArray(res) ? res : res?.rooms || [];
      setRooms(rawRooms);
    } catch (err) {
      console.error('Failed to load rooms:', err);
      setRooms([]);
    } finally {
      setHierarchyLoading(false);
    }
  };

  const loadBedsForRoom = async (room) => {
    if (!selectedHostel || !selectedBlock || !selectedFloor) return;
    setSelectedRoom(room);
    setHierarchyLoading(true);

    try {
      const res = await adminService.getBeds(
        selectedHostel.id,
        selectedBlock.id,
        selectedFloor.id,
        room.id
      );
      const rawBeds = Array.isArray(res) ? res : res?.beds || [];
      setBeds(rawBeds);
    } catch (err) {
      console.error('Failed to load beds:', err);
      setBeds([]);
    } finally {
      setHierarchyLoading(false);
    }
  };

  // Reset drilldown to root
  const resetToRoot = () => {
    setSelectedHostel(null);
    setSelectedBlock(null);
    setSelectedFloor(null);
    setSelectedRoom(null);
    setBlocks([]);
    setFloors([]);
    setRooms([]);
    setBeds([]);
  };

  // =========================================================================
  // KPI Metrics Calculation
  // =========================================================================
  const totalHostels = hostels.length;
  const boysHostels = hostels.filter((h) => (h.category || '').toUpperCase().includes('BOY')).length;
  const girlsHostels = hostels.filter((h) => (h.category || '').toUpperCase().includes('GIRL')).length;
  const coedHostels = hostels.filter((h) => (h.category || '').toUpperCase().includes('CO')).length;

  const totalCapacitySum = hostels.reduce((sum, h) => sum + (parseInt(h.total_capacity, 10) || 0), 0);
  const totalActiveAllocationsCount = activeAllocations.length;
  const liveOccupancyRate = totalCapacitySum > 0 ? Math.round((totalActiveAllocationsCount / totalCapacitySum) * 100) : 0;

  // =========================================================================
  // Filtered Hostels List
  // =========================================================================
  const filteredHostels = useMemo(() => {
    return hostels.filter((h) => {
      if (statusFilter !== 'ALL' && h.status !== statusFilter) return false;
      if (categoryFilter !== 'ALL') {
        const cat = (h.category || '').toUpperCase();
        if (categoryFilter === 'BOYS' && !cat.includes('BOY')) return false;
        if (categoryFilter === 'GIRLS' && !cat.includes('GIRL')) return false;
        if (categoryFilter === 'COED' && !cat.includes('CO')) return false;
      }
      if (!searchTerm.trim()) return true;

      const q = searchTerm.toLowerCase();
      const name = (h.name || '').toLowerCase();
      const code = (h.code || '').toLowerCase();
      const addr = (h.address || '').toLowerCase();
      return name.includes(q) || code.includes(q) || addr.includes(q);
    });
  }, [hostels, searchTerm, categoryFilter, statusFilter]);

  // =========================================================================
  // Filtered Rooms List
  // =========================================================================
  const filteredRooms = useMemo(() => {
    return rooms.filter((r) => {
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      if (roomTypeFilter !== 'ALL' && r.room_type !== roomTypeFilter) return false;
      if (!searchTerm.trim()) return true;

      const q = searchTerm.toLowerCase();
      const code = (r.code || '').toLowerCase();
      const name = (r.name || '').toLowerCase();
      return code.includes(q) || name.includes(q);
    });
  }, [rooms, searchTerm, statusFilter, roomTypeFilter]);

  // =========================================================================
  // Hostel CRUD Handlers
  // =========================================================================
  const handleOpenCreateHostel = () => {
    setHostelForm({
      code: `H-${Math.floor(100 + Math.random() * 900)}`,
      name: '',
      category: 'BOYS',
      total_capacity: 120,
      status: 'ACTIVE',
      description: '',
      address: '',
    });
    setHostelModalMode('CREATE');
    setFormError(null);
    setHostelModalOpen(true);
  };

  const handleOpenEditHostel = (hostel) => {
    setSelectedHostel(hostel);
    setHostelForm({
      code: hostel.code || '',
      name: hostel.name || '',
      category: hostel.category || 'BOYS',
      total_capacity: hostel.total_capacity || 0,
      description: hostel.description || '',
      address: hostel.address || '',
    });
    setHostelModalMode('EDIT');
    setFormError(null);
    setHostelModalOpen(true);
  };

  const handleHostelSubmit = async (e) => {
    e.preventDefault();
    if (!hostelForm.code.trim() || !hostelForm.name.trim()) {
      setFormError('Hostel Code and Name are mandatory.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const payload = {
        code: hostelForm.code.trim(),
        name: hostelForm.name.trim(),
        category: hostelForm.category,
        description: hostelForm.description.trim() || '',
        address: hostelForm.address.trim() || '',
        total_capacity: parseInt(hostelForm.total_capacity, 10) || 0,
      };

      if (hostelModalMode === 'CREATE') {
        payload.status = hostelForm.status || 'ACTIVE';
        await adminService.createHostel(payload);
        setSuccessBanner(`Hostel facility "${payload.name}" created successfully.`);
      } else {
        await adminService.updateHostel(selectedHostel.id, payload);
        setSuccessBanner(`Hostel "${payload.name}" updated successfully.`);
      }

      setHostelModalOpen(false);
      loadHostelsAndAllocations(true);
    } catch (err) {
      console.error('Error saving hostel:', err);
      setFormError(err.response?.data?.message || err.message || 'Failed to save hostel.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenHostelStatusModal = (hostel) => {
    setSelectedHostel(hostel);
    setNewStatusValue(hostel.status || 'ACTIVE');
    setFormError(null);
    setHostelStatusModalOpen(true);
  };

  const handleHostelStatusSubmit = async (e) => {
    e.preventDefault();
    if (!selectedHostel) return;

    setSubmitting(true);
    setFormError(null);

    try {
      await adminService.updateHostelStatus(selectedHostel.id, newStatusValue);
      setSuccessBanner(`Status for "${selectedHostel.name}" updated to ${newStatusValue}.`);
      setHostelStatusModalOpen(false);
      loadHostelsAndAllocations(true);
    } catch (err) {
      console.error('Error changing hostel status:', err);
      setFormError(err.response?.data?.message || err.message || 'Failed to update status.');
    } finally {
      setSubmitting(false);
    }
  };

  // =========================================================================
  // Block CRUD Handlers
  // =========================================================================
  const handleOpenCreateBlock = () => {
    if (!selectedHostel) return;
    setBlockForm({
      code: `BLK-${String.fromCharCode(65 + blocks.length)}`,
      name: `Block ${String.fromCharCode(65 + blocks.length)}`,
      description: '',
    });
    setBlockModalMode('CREATE');
    setFormError(null);
    setBlockModalOpen(true);
  };

  const handleOpenEditBlock = (block) => {
    setTargetBlock(block);
    setBlockForm({
      code: block.code || '',
      name: block.name || '',
      description: block.description || '',
    });
    setBlockModalMode('EDIT');
    setFormError(null);
    setBlockModalOpen(true);
  };

  const handleBlockSubmit = async (e) => {
    e.preventDefault();
    if (!selectedHostel) return;
    if (!blockForm.code.trim() || !blockForm.name.trim()) {
      setFormError('Block Code and Name are required.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const payload = {
        code: blockForm.code.trim(),
        name: blockForm.name.trim(),
        description: blockForm.description.trim() ? blockForm.description.trim() : null,
      };

      if (blockModalMode === 'CREATE') {
        await adminService.createBlock(selectedHostel.id, payload);
        setSuccessBanner(`Block "${payload.name}" created under ${selectedHostel.name}.`);
      } else {
        await adminService.updateBlock(selectedHostel.id, targetBlock.id, payload);
        setSuccessBanner(`Block "${payload.name}" updated successfully.`);
      }

      setBlockModalOpen(false);
      loadBlocksForHostel(selectedHostel);
    } catch (err) {
      console.error('Error saving block:', err);
      setFormError(err.response?.data?.message || err.message || 'Failed to save block.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenBlockStatusModal = (block) => {
    setTargetBlock(block);
    setNewStatusValue(block.status || 'ACTIVE');
    setFormError(null);
    setBlockStatusModalOpen(true);
  };

  const handleBlockStatusSubmit = async (e) => {
    e.preventDefault();
    if (!selectedHostel || !targetBlock) return;

    setSubmitting(true);
    setFormError(null);

    try {
      await adminService.updateBlockStatus(selectedHostel.id, targetBlock.id, newStatusValue);
      setSuccessBanner(`Status for block "${targetBlock.name}" updated to ${newStatusValue}.`);
      setBlockStatusModalOpen(false);
      loadBlocksForHostel(selectedHostel);
    } catch (err) {
      console.error('Error updating block status:', err);
      setFormError(err.response?.data?.message || err.message || 'Failed to update block status.');
    } finally {
      setSubmitting(false);
    }
  };

  // =========================================================================
  // Floor CRUD Handlers
  // =========================================================================
  const handleOpenCreateFloor = () => {
    if (!selectedHostel || !selectedBlock) return;
    const nextNum = floors.length + 1;
    setFloorForm({
      code: `FLR-${nextNum}`,
      name: `Floor ${nextNum}`,
      floor_number: nextNum,
      description: '',
    });
    setFloorModalMode('CREATE');
    setFormError(null);
    setFloorModalOpen(true);
  };

  const handleOpenEditFloor = (floor) => {
    setTargetFloor(floor);
    setFloorForm({
      code: floor.code || '',
      name: floor.name || '',
      floor_number: floor.floor_number || 1,
      description: floor.description || '',
    });
    setFloorModalMode('EDIT');
    setFormError(null);
    setFloorModalOpen(true);
  };

  const handleFloorSubmit = async (e) => {
    e.preventDefault();
    if (!selectedHostel || !selectedBlock) return;
    if (!floorForm.code.trim() || !floorForm.name.trim()) {
      setFormError('Floor Code and Name are required.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const payload = {
        code: floorForm.code.trim(),
        name: floorForm.name.trim(),
        floor_number: parseInt(floorForm.floor_number, 10) || 1,
        description: floorForm.description.trim() ? floorForm.description.trim() : null,
      };

      if (floorModalMode === 'CREATE') {
        await adminService.createFloor(selectedHostel.id, selectedBlock.id, payload);
        setSuccessBanner(`Floor "${payload.name}" created under ${selectedBlock.name}.`);
      } else {
        await adminService.updateFloor(selectedHostel.id, selectedBlock.id, targetFloor.id, payload);
        setSuccessBanner(`Floor "${payload.name}" updated successfully.`);
      }

      setFloorModalOpen(false);
      loadFloorsForBlock(selectedBlock);
    } catch (err) {
      console.error('Error saving floor:', err);
      setFormError(err.response?.data?.message || err.message || 'Failed to save floor.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenFloorStatusModal = (floor) => {
    setTargetFloor(floor);
    setNewStatusValue(floor.status || 'ACTIVE');
    setFormError(null);
    setFloorStatusModalOpen(true);
  };

  const handleFloorStatusSubmit = async (e) => {
    e.preventDefault();
    if (!selectedHostel || !selectedBlock || !targetFloor) return;

    setSubmitting(true);
    setFormError(null);

    try {
      await adminService.updateFloorStatus(selectedHostel.id, selectedBlock.id, targetFloor.id, newStatusValue);
      setSuccessBanner(`Status for floor "${targetFloor.name}" updated to ${newStatusValue}.`);
      setFloorStatusModalOpen(false);
      loadFloorsForBlock(selectedBlock);
    } catch (err) {
      console.error('Error updating floor status:', err);
      setFormError(err.response?.data?.message || err.message || 'Failed to update floor status.');
    } finally {
      setSubmitting(false);
    }
  };

  // =========================================================================
  // Room CRUD Handlers
  // =========================================================================
  const handleOpenCreateRoom = () => {
    if (!selectedHostel || !selectedBlock || !selectedFloor) return;
    const roomNum = (selectedFloor.floor_number || 1) * 100 + (rooms.length + 1);
    setRoomForm({
      code: `RM-${roomNum}`,
      name: `Room ${roomNum}`,
      room_type: 'DOUBLE',
      capacity: 2,
      description: '',
    });
    setRoomModalMode('CREATE');
    setFormError(null);
    setRoomModalOpen(true);
  };

  const handleOpenEditRoom = (room) => {
    setTargetRoom(room);
    setRoomForm({
      code: room.code || '',
      name: room.name || '',
      room_type: room.room_type || 'DOUBLE',
      capacity: room.capacity || 2,
      description: room.description || '',
    });
    setRoomModalMode('EDIT');
    setFormError(null);
    setRoomModalOpen(true);
  };

  const handleRoomSubmit = async (e) => {
    e.preventDefault();
    if (!selectedHostel || !selectedBlock || !selectedFloor) return;
    if (!roomForm.code.trim() || !roomForm.name.trim()) {
      setFormError('Room Code and Name are required.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const payload = {
        code: roomForm.code.trim(),
        name: roomForm.name.trim(),
        room_type: roomForm.room_type,
        capacity: parseInt(roomForm.capacity, 10) || 1,
        description: roomForm.description.trim() ? roomForm.description.trim() : null,
      };

      if (roomModalMode === 'CREATE') {
        await adminService.createRoom(selectedHostel.id, selectedBlock.id, selectedFloor.id, payload);
        setSuccessBanner(`Room "${payload.name}" added to ${selectedFloor.name}.`);
      } else {
        await adminService.updateRoom(
          selectedHostel.id,
          selectedBlock.id,
          selectedFloor.id,
          targetRoom.id,
          payload
        );
        setSuccessBanner(`Room "${payload.name}" updated successfully.`);
      }

      setRoomModalOpen(false);
      loadRoomsForFloor(selectedFloor);
    } catch (err) {
      console.error('Error saving room:', err);
      setFormError(err.response?.data?.message || err.message || 'Failed to save room.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenRoomStatusModal = (room) => {
    setTargetRoom(room);
    setNewStatusValue(room.status || 'ACTIVE');
    setFormError(null);
    setRoomStatusModalOpen(true);
  };

  const handleRoomStatusSubmit = async (e) => {
    e.preventDefault();
    if (!selectedHostel || !selectedBlock || !selectedFloor || !targetRoom) return;

    setSubmitting(true);
    setFormError(null);

    try {
      await adminService.updateRoomStatus(
        selectedHostel.id,
        selectedBlock.id,
        selectedFloor.id,
        targetRoom.id,
        newStatusValue
      );
      setSuccessBanner(`Status for room "${targetRoom.name}" updated to ${newStatusValue}.`);
      setRoomStatusModalOpen(false);
      loadRoomsForFloor(selectedFloor);
    } catch (err) {
      console.error('Error updating room status:', err);
      setFormError(err.response?.data?.message || err.message || 'Failed to update room status.');
    } finally {
      setSubmitting(false);
    }
  };

  // =========================================================================
  // Bed CRUD Handlers
  // =========================================================================
  const handleOpenCreateBed = () => {
    if (!selectedHostel || !selectedBlock || !selectedFloor || !selectedRoom) return;
    const nextBedIdx = beds.length + 1;
    setBedForm({
      code: `BED-${nextBedIdx}`,
      name: `Bed ${String.fromCharCode(64 + nextBedIdx)}`,
    });
    setFormError(null);
    setBedModalOpen(true);
  };

  const handleBedSubmit = async (e) => {
    e.preventDefault();
    if (!selectedHostel || !selectedBlock || !selectedFloor || !selectedRoom) return;
    if (!bedForm.code.trim()) {
      setFormError('Bed Code is required.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const payload = {
        code: bedForm.code.trim(),
        name: bedForm.name.trim() ? bedForm.name.trim() : null,
      };

      await adminService.createBed(
        selectedHostel.id,
        selectedBlock.id,
        selectedFloor.id,
        selectedRoom.id,
        payload
      );
      setSuccessBanner(`Bed space "${payload.code}" added to ${selectedRoom.name}.`);
      setBedModalOpen(false);
      loadBedsForRoom(selectedRoom);
    } catch (err) {
      console.error('Error creating bed:', err);
      setFormError(err.response?.data?.message || err.message || 'Failed to create bed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenBedStatusModal = (bed) => {
    setTargetBed(bed);
    setNewStatusValue(bed.status || 'ACTIVE');
    setFormError(null);
    setBedStatusModalOpen(true);
  };

  const handleBedStatusSubmit = async (e) => {
    e.preventDefault();
    if (!selectedHostel || !selectedBlock || !selectedFloor || !selectedRoom || !targetBed) return;

    setSubmitting(true);
    setFormError(null);

    try {
      await adminService.updateBedStatus(
        selectedHostel.id,
        selectedBlock.id,
        selectedFloor.id,
        selectedRoom.id,
        targetBed.id,
        newStatusValue
      );
      setSuccessBanner(`Status for bed "${targetBed.code}" updated to ${newStatusValue}.`);
      setBedStatusModalOpen(false);
      loadBedsForRoom(selectedRoom);
    } catch (err) {
      console.error('Error updating bed status:', err);
      setFormError(err.response?.data?.message || err.message || 'Failed to update bed status.');
    } finally {
      setSubmitting(false);
    }
  };

  // Helper: Status badge
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'ACTIVE':
        return <span className="badge-enterprise badge-green">ACTIVE</span>;
      case 'INACTIVE':
        return <span className="badge-enterprise badge-gray">INACTIVE</span>;
      case 'MAINTENANCE':
        return <span className="badge-enterprise badge-orange">MAINTENANCE</span>;
      case 'OCCUPIED':
        return <span className="badge-enterprise badge-purple">OCCUPIED</span>;
      case 'RESERVED':
        return <span className="badge-enterprise badge-blue">RESERVED</span>;
      default:
        return <span className="badge-enterprise badge-gray">{status || 'UNKNOWN'}</span>;
    }
  };

  // Helper: Category badge
  const renderCategoryBadge = (category) => {
    const c = (category || '').toUpperCase();
    if (c.includes('BOY') || c === 'MALE') {
      return <span className="badge-enterprise badge-blue">BOYS HOSTEL</span>;
    }
    if (c.includes('GIRL') || c === 'FEMALE') {
      return <span className="badge-enterprise badge-purple">GIRLS HOSTEL</span>;
    }
    return <span className="badge-enterprise badge-green">CO-ED RESIDENCE</span>;
  };

  if (loading && hostels.length === 0) {
    return (
      <div className="fade-in-up" style={{ padding: '32px' }}>
        <LoadingState message="Loading campus hostel structures, building wings, and capacity metrics..." />
      </div>
    );
  }

  return (
    <div className="fade-in-up">
      {/* Hero Header */}
      <div className="enterprise-hero-header">
        <div className="hero-header-titles">
          <div className="hero-category-pill">
            <Building2 size={13} />
            <span>Facility & Accommodation Administration</span>
          </div>
          <h1 className="hero-main-title">Hostel & Room Structure Management</h1>
          <p className="hero-subtitle">
            Configure residential hostels, structural blocks, floors, room inventory, and live bed space capacity.
          </p>
        </div>

        <div className="hero-action-buttons">
          <button
            type="button"
            className="btn-enterprise-secondary"
            onClick={() => loadHostelsAndAllocations(true)}
            disabled={isRefreshing}
          >
            <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} />
            <span>{isRefreshing ? 'Syncing...' : 'Sync Facility Data'}</span>
          </button>

          {canManageAccommodation && !selectedHostel && (
            <button
              type="button"
              className="btn-enterprise-primary"
              onClick={handleOpenCreateHostel}
            >
              <Plus size={15} />
              <span>Add Hostel Facility</span>
            </button>
          )}

          {canManageAccommodation && selectedHostel && !selectedBlock && (
            <button
              type="button"
              className="btn-enterprise-primary"
              onClick={handleOpenCreateBlock}
            >
              <Plus size={15} />
              <span>Add Block / Wing</span>
            </button>
          )}

          {canManageAccommodation && selectedBlock && !selectedFloor && (
            <button
              type="button"
              className="btn-enterprise-primary"
              onClick={handleOpenCreateFloor}
            >
              <Plus size={15} />
              <span>Add Floor</span>
            </button>
          )}

          {canManageAccommodation && selectedFloor && !selectedRoom && (
            <button
              type="button"
              className="btn-enterprise-primary"
              onClick={handleOpenCreateRoom}
            >
              <Plus size={15} />
              <span>Add Room</span>
            </button>
          )}

          {canManageAccommodation && selectedRoom && (
            <button
              type="button"
              className="btn-enterprise-primary"
              onClick={handleOpenCreateBed}
            >
              <Plus size={15} />
              <span>Add Bed Space</span>
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
          <ErrorState message={errorMessage} onRetry={() => loadHostelsAndAllocations(true)} />
        </div>
      )}

      {/* KPI Stats Bar */}
      <div className="kpi-cards-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Total Hostels</span>
            <div className="stat-kpi-icon-wrap emerald">
              <Building2 size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-emerald-600">{totalHostels}</div>
          <div className="stat-kpi-footnote">
            <span>
              {boysHostels} Boys • {girlsHostels} Girls • {coedHostels} Co-Ed
            </span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Total Designed Capacity</span>
            <div className="stat-kpi-icon-wrap blue">
              <BedDouble size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-blue-600">{totalCapacitySum} Beds</div>
          <div className="stat-kpi-footnote">
            <span className="status-dot green" />
            <span>Across all institutional facilities</span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Active Bed Allocations</span>
            <div className="stat-kpi-icon-wrap purple">
              <UserCheck size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-purple-600">{totalActiveAllocationsCount}</div>
          <div className="stat-kpi-footnote">
            <span>Verified student residents</span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Campus Occupancy Rate</span>
            <div className="stat-kpi-icon-wrap orange">
              <Sparkles size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-orange-600">{liveOccupancyRate}%</div>
          <div className="stat-kpi-footnote">
            <span>{Math.max(0, totalCapacitySum - totalActiveAllocationsCount)} available beds</span>
          </div>
        </div>
      </div>

      {/* Architecture Hierarchy Notice */}
      <div
        style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '12.5px',
          color: '#475569',
        }}
      >
        <Info size={16} style={{ color: '#6366f1', flexShrink: 0 }} />
        <div>
          <strong>HMS Hierarchy Flow:</strong> <code>Hostel Facility</code> &rarr;{' '}
          <code>Block / Wing</code> &rarr; <code>Floor</code> &rarr; <code>Room</code> &rarr;{' '}
          <code>Bed Space</code>. Click any row or breadcrumb item to drill down or navigate upward.
        </div>
      </div>

      {/* Breadcrumb Navigation Trail */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '12px 18px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '13.5px',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={resetToRoot}
          style={{
            background: 'none',
            border: 'none',
            color: selectedHostel ? '#4f46e5' : '#0f172a',
            fontWeight: selectedHostel ? 500 : 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <Home size={15} />
          <span>All Hostels</span>
        </button>

        {selectedHostel && (
          <>
            <ChevronRight size={14} style={{ color: '#94a3b8' }} />
            <button
              type="button"
              onClick={() => {
                setSelectedBlock(null);
                setSelectedFloor(null);
                setSelectedRoom(null);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: selectedBlock ? '#4f46e5' : '#0f172a',
                fontWeight: selectedBlock ? 500 : 700,
                cursor: 'pointer',
              }}
            >
              {selectedHostel.name} ({selectedHostel.code})
            </button>
          </>
        )}

        {selectedBlock && (
          <>
            <ChevronRight size={14} style={{ color: '#94a3b8' }} />
            <button
              type="button"
              onClick={() => {
                setSelectedFloor(null);
                setSelectedRoom(null);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: selectedFloor ? '#4f46e5' : '#0f172a',
                fontWeight: selectedFloor ? 500 : 700,
                cursor: 'pointer',
              }}
            >
              {selectedBlock.name}
            </button>
          </>
        )}

        {selectedFloor && (
          <>
            <ChevronRight size={14} style={{ color: '#94a3b8' }} />
            <button
              type="button"
              onClick={() => setSelectedRoom(null)}
              style={{
                background: 'none',
                border: 'none',
                color: selectedRoom ? '#4f46e5' : '#0f172a',
                fontWeight: selectedRoom ? 500 : 700,
                cursor: 'pointer',
              }}
            >
              {selectedFloor.name}
            </button>
          </>
        )}

        {selectedRoom && (
          <>
            <ChevronRight size={14} style={{ color: '#94a3b8' }} />
            <span style={{ fontWeight: 700, color: '#0f172a' }}>
              {selectedRoom.name} ({selectedRoom.code})
            </span>
          </>
        )}
      </div>

      {/* =================================================================== */}
      {/* LEVEL 1: Hostels Listing (Root View)                                */}
      {/* =================================================================== */}
      {!selectedHostel && (
        <div className="enterprise-card">
          <div className="card-topbar">
            <div className="card-title-group">
              <div className="card-title-icon-wrap">
                <Building2 size={16} />
              </div>
              <h2 className="card-title-text">Hostel Facilities Master</h2>
            </div>
            <span className="badge-enterprise badge-emerald">
              {filteredHostels.length} of {hostels.length} Facilities Showing
            </span>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="enterprise-filter-bar">
            <div className="filter-search-field">
              <Search size={14} className="filter-search-icon" />
              <input
                type="text"
                className="filter-search-input"
                placeholder="Search hostels by name, building code, or address..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <select
                className="filter-select"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="ALL">All Categories</option>
                <option value="BOYS">Boys Hostel</option>
                <option value="GIRLS">Girls Hostel</option>
                <option value="COED">Co-Ed Residence</option>
              </select>

              <select
                className="filter-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
                <option value="MAINTENANCE">MAINTENANCE</option>
              </select>
            </div>
          </div>

          {/* Hostels Table */}
          <div className="enterprise-table-container">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Hostel Facility</th>
                  <th>Classification</th>
                  <th>Design Capacity</th>
                  <th>Resident Incharges</th>
                  <th>Facility Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredHostels.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '36px' }}>
                      <EmptyState
                        title="No hostel facilities found"
                        message="No hostels match your active search and filter criteria."
                      />
                    </td>
                  </tr>
                ) : (
                  filteredHostels.map((h, idx) => {
                    const incharges = inchargesMap[h.id] || [];
                    const primaryIncharge = incharges.find((i) => i.is_primary);

                    return (
                      <tr
                        key={h.id || idx}
                        style={{ cursor: 'pointer' }}
                        onClick={() => loadBlocksForHostel(h)}
                      >
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div
                              style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '8px',
                                background: '#ecfdf5',
                                color: '#059669',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Building2 size={18} />
                            </div>
                            <div>
                              <strong style={{ color: '#0f172a', display: 'block', fontSize: '13.5px' }}>
                                {h.name}
                              </strong>
                              <span className="code-pill" style={{ fontSize: '10.5px' }}>
                                {h.code}
                              </span>
                              {h.address && (
                                <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '6px' }}>
                                  • {h.address}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td>{renderCategoryBadge(h.category)}</td>

                        <td>
                          <span style={{ fontWeight: 600, color: '#334155' }}>
                            {h.total_capacity || 0} Beds
                          </span>
                        </td>

                        <td>
                          {primaryIncharge ? (
                            <span style={{ fontSize: '12px', color: '#475569' }}>
                              Primary Incharge Assigned
                            </span>
                          ) : (
                            <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                              No Incharge Assigned
                            </span>
                          )}
                        </td>

                        <td>{renderStatusBadge(h.status)}</td>

                        <td onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              type="button"
                              className="btn-enterprise-secondary"
                              style={{ padding: '4px 10px', fontSize: '12px' }}
                              onClick={() => loadBlocksForHostel(h)}
                              title="Explore Blocks & Floors"
                            >
                              <span>Explore</span>
                              <ChevronRight size={13} />
                            </button>

                            {canManageAccommodation && (
                              <>
                                <button
                                  type="button"
                                  className="btn-icon"
                                  title="Edit Hostel Profile"
                                  onClick={() => handleOpenEditHostel(h)}
                                >
                                  <Edit2 size={13} />
                                </button>

                                <button
                                  type="button"
                                  className="btn-icon"
                                  title="Change Operational Status"
                                  onClick={() => handleOpenHostelStatusModal(h)}
                                >
                                  <SlidersHorizontal size={13} />
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
      {/* LEVEL 2: Blocks Listing under Selected Hostel                       */}
      {/* =================================================================== */}
      {selectedHostel && !selectedBlock && (
        <div className="enterprise-card">
          <div className="card-topbar">
            <div className="card-title-group">
              <div className="card-title-icon-wrap">
                <Layers size={16} />
              </div>
              <h2 className="card-title-text">
                Structural Blocks / Wings in {selectedHostel.name}
              </h2>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="btn-enterprise-secondary"
                style={{ padding: '4px 10px', fontSize: '12px' }}
                onClick={resetToRoot}
              >
                <ArrowLeft size={13} />
                <span>Back to All Hostels</span>
              </button>
              {canManageAccommodation && (
                <button
                  type="button"
                  className="btn-enterprise-primary"
                  style={{ padding: '4px 12px', fontSize: '12px' }}
                  onClick={handleOpenCreateBlock}
                >
                  <Plus size={13} />
                  <span>Add Block</span>
                </button>
              )}
            </div>
          </div>

          <div className="enterprise-table-container">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Block / Wing Name</th>
                  <th>Block Code</th>
                  <th>Design Capacity</th>
                  <th>Description</th>
                  <th>Operational Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {hierarchyLoading ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '36px' }}>
                      <LoadingState message="Loading structural blocks..." />
                    </td>
                  </tr>
                ) : blocks.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '36px' }}>
                      <EmptyState
                        title="No blocks found for this hostel"
                        message="Click 'Add Block' to create the first structural wing."
                      />
                    </td>
                  </tr>
                ) : (
                  blocks.map((b) => (
                    <tr
                      key={b.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => loadFloorsForBlock(b)}
                    >
                      <td>
                        <strong style={{ color: '#0f172a', fontSize: '13.5px' }}>{b.name}</strong>
                      </td>
                      <td>
                        <span className="code-pill">{b.code}</span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: '#334155' }}>
                          {b.total_capacity || 'Dynamic'} Beds
                        </span>
                      </td>
                      <td>
                        <span style={{ color: '#64748b', fontSize: '12px' }}>
                          {b.description || '—'}
                        </span>
                      </td>
                      <td>{renderStatusBadge(b.status)}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn-enterprise-secondary"
                            style={{ padding: '4px 10px', fontSize: '12px' }}
                            onClick={() => loadFloorsForBlock(b)}
                            title="Explore Floors in this Block"
                          >
                            <span>Floors</span>
                            <ChevronRight size={13} />
                          </button>

                          {canManageAccommodation && (
                            <>
                              <button
                                type="button"
                                className="btn-icon"
                                title="Edit Block"
                                onClick={() => handleOpenEditBlock(b)}
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                type="button"
                                className="btn-icon"
                                title="Change Block Status"
                                onClick={() => handleOpenBlockStatusModal(b)}
                              >
                                <SlidersHorizontal size={13} />
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
      {/* LEVEL 3: Floors Listing under Selected Block                        */}
      {/* =================================================================== */}
      {selectedBlock && !selectedFloor && (
        <div className="enterprise-card">
          <div className="card-topbar">
            <div className="card-title-group">
              <div className="card-title-icon-wrap">
                <Layers size={16} />
              </div>
              <h2 className="card-title-text">
                Floors in {selectedHostel?.name} &bull; {selectedBlock.name}
              </h2>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="btn-enterprise-secondary"
                style={{ padding: '4px 10px', fontSize: '12px' }}
                onClick={() => setSelectedBlock(null)}
              >
                <ArrowLeft size={13} />
                <span>Back to Blocks</span>
              </button>
              {canManageAccommodation && (
                <button
                  type="button"
                  className="btn-enterprise-primary"
                  style={{ padding: '4px 12px', fontSize: '12px' }}
                  onClick={handleOpenCreateFloor}
                >
                  <Plus size={13} />
                  <span>Add Floor</span>
                </button>
              )}
            </div>
          </div>

          <div className="enterprise-table-container">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Floor Name</th>
                  <th>Floor Number</th>
                  <th>Floor Code</th>
                  <th>Capacity</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {hierarchyLoading ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '36px' }}>
                      <LoadingState message="Loading floors..." />
                    </td>
                  </tr>
                ) : floors.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '36px' }}>
                      <EmptyState
                        title="No floors found in this block"
                        message="Click 'Add Floor' to create the first floor level."
                      />
                    </td>
                  </tr>
                ) : (
                  floors.map((flr) => (
                    <tr
                      key={flr.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => loadRoomsForFloor(flr)}
                    >
                      <td>
                        <strong style={{ color: '#0f172a', fontSize: '13.5px' }}>{flr.name}</strong>
                      </td>
                      <td>
                        <span className="badge-enterprise badge-purple">Level {flr.floor_number}</span>
                      </td>
                      <td>
                        <span className="code-pill">{flr.code}</span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: '#334155' }}>
                          {flr.total_capacity || 'Dynamic'} Beds
                        </span>
                      </td>
                      <td>{renderStatusBadge(flr.status)}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn-enterprise-secondary"
                            style={{ padding: '4px 10px', fontSize: '12px' }}
                            onClick={() => loadRoomsForFloor(flr)}
                            title="Explore Rooms on this Floor"
                          >
                            <span>Rooms</span>
                            <ChevronRight size={13} />
                          </button>

                          {canManageAccommodation && (
                            <>
                              <button
                                type="button"
                                className="btn-icon"
                                title="Edit Floor"
                                onClick={() => handleOpenEditFloor(flr)}
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                type="button"
                                className="btn-icon"
                                title="Change Floor Status"
                                onClick={() => handleOpenFloorStatusModal(flr)}
                              >
                                <SlidersHorizontal size={13} />
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
      {/* LEVEL 4: Rooms Listing under Selected Floor                         */}
      {/* =================================================================== */}
      {selectedFloor && !selectedRoom && (
        <div className="enterprise-card">
          <div className="card-topbar">
            <div className="card-title-group">
              <div className="card-title-icon-wrap">
                <DoorOpen size={16} />
              </div>
              <h2 className="card-title-text">
                Rooms in {selectedBlock?.name} &bull; {selectedFloor.name}
              </h2>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="btn-enterprise-secondary"
                style={{ padding: '4px 10px', fontSize: '12px' }}
                onClick={() => setSelectedFloor(null)}
              >
                <ArrowLeft size={13} />
                <span>Back to Floors</span>
              </button>
              {canManageAccommodation && (
                <button
                  type="button"
                  className="btn-enterprise-primary"
                  style={{ padding: '4px 12px', fontSize: '12px' }}
                  onClick={handleOpenCreateRoom}
                >
                  <Plus size={13} />
                  <span>Add Room</span>
                </button>
              )}
            </div>
          </div>

          {/* Rooms Search & Filter Bar */}
          <div className="enterprise-filter-bar">
            <div className="filter-search-field">
              <Search size={14} className="filter-search-icon" />
              <input
                type="text"
                className="filter-search-input"
                placeholder="Search rooms by number or code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                className="filter-select"
                value={roomTypeFilter}
                onChange={(e) => setRoomTypeFilter(e.target.value)}
              >
                <option value="ALL">All Room Types</option>
                <option value="SINGLE">SINGLE</option>
                <option value="DOUBLE">DOUBLE</option>
                <option value="TRIPLE">TRIPLE</option>
                <option value="FOUR_BED">FOUR_BED</option>
                <option value="DORMITORY">DORMITORY</option>
              </select>

              <select
                className="filter-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
                <option value="MAINTENANCE">MAINTENANCE</option>
              </select>
            </div>
          </div>

          <div className="enterprise-table-container">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Room Code / Number</th>
                  <th>Room Name</th>
                  <th>Room Type</th>
                  <th>Bed Capacity</th>
                  <th>Operational Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {hierarchyLoading ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '36px' }}>
                      <LoadingState message="Loading rooms..." />
                    </td>
                  </tr>
                ) : filteredRooms.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '36px' }}>
                      <EmptyState
                        title="No rooms found on this floor"
                        message="Click 'Add Room' to configure your first room space."
                      />
                    </td>
                  </tr>
                ) : (
                  filteredRooms.map((rm) => (
                    <tr
                      key={rm.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => loadBedsForRoom(rm)}
                    >
                      <td>
                        <span className="code-pill" style={{ fontWeight: 700, fontSize: '13px' }}>
                          {rm.code}
                        </span>
                      </td>
                      <td>
                        <strong style={{ color: '#0f172a' }}>{rm.name}</strong>
                      </td>
                      <td>
                        <span className="badge-enterprise badge-blue">{rm.room_type || 'STANDARD'}</span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: '#334155' }}>
                          {rm.capacity} Beds
                        </span>
                      </td>
                      <td>{renderStatusBadge(rm.status)}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn-enterprise-secondary"
                            style={{ padding: '4px 10px', fontSize: '12px' }}
                            onClick={() => loadBedsForRoom(rm)}
                            title="Manage Bed Spaces"
                          >
                            <span>Bed Spaces</span>
                            <ChevronRight size={13} />
                          </button>

                          {canManageAccommodation && (
                            <>
                              <button
                                type="button"
                                className="btn-icon"
                                title="Edit Room"
                                onClick={() => handleOpenEditRoom(rm)}
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                type="button"
                                className="btn-icon"
                                title="Change Room Status"
                                onClick={() => handleOpenRoomStatusModal(rm)}
                              >
                                <SlidersHorizontal size={13} />
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
      {/* LEVEL 5: Beds & Occupancy under Selected Room                       */}
      {/* =================================================================== */}
      {selectedRoom && (
        <div className="enterprise-card">
          <div className="card-topbar">
            <div className="card-title-group">
              <div className="card-title-icon-wrap">
                <BedDouble size={16} />
              </div>
              <h2 className="card-title-text">
                Bed Spaces & Resident Occupants in {selectedRoom.name} ({selectedRoom.code})
              </h2>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="btn-enterprise-secondary"
                style={{ padding: '4px 10px', fontSize: '12px' }}
                onClick={() => setSelectedRoom(null)}
              >
                <ArrowLeft size={13} />
                <span>Back to Rooms</span>
              </button>
              {canManageAccommodation && (
                <button
                  type="button"
                  className="btn-enterprise-primary"
                  style={{ padding: '4px 12px', fontSize: '12px' }}
                  onClick={handleOpenCreateBed}
                >
                  <Plus size={13} />
                  <span>Add Bed Space</span>
                </button>
              )}
            </div>
          </div>

          <div className="enterprise-table-container">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Bed Identifier</th>
                  <th>Bed Name</th>
                  <th>Occupant Resident</th>
                  <th>Allocation Period</th>
                  <th>Bed Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {hierarchyLoading ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '36px' }}>
                      <LoadingState message="Loading bed spaces..." />
                    </td>
                  </tr>
                ) : beds.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '36px' }}>
                      <EmptyState
                        title="No beds configured in this room"
                        message="Click 'Add Bed Space' to define bed slots for this room."
                      />
                    </td>
                  </tr>
                ) : (
                  beds.map((b) => {
                    const allocation = bedAllocationMap.get(b.id);
                    const student = allocation && allocation.student_id ? studentMap.get(allocation.student_id) : null;

                    return (
                      <tr key={b.id}>
                        <td>
                          <span className="code-pill" style={{ fontWeight: 700 }}>{b.code}</span>
                        </td>
                        <td>
                          <strong style={{ color: '#0f172a' }}>{b.name || 'Standard Bed'}</strong>
                        </td>
                        <td>
                          {student ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <strong style={{ color: '#0f172a', fontSize: '13px' }}>
                                {[student.first_name, student.last_name].filter(Boolean).join(' ') || student.name}
                              </strong>
                              <span style={{ fontSize: '11px', color: '#64748b' }}>
                                Adm No: {student.admission_number || '—'}
                              </span>
                            </div>
                          ) : (
                            <span style={{ color: '#10b981', fontSize: '12px', fontWeight: 600 }}>
                              Available / Vacant
                            </span>
                          )}
                        </td>
                        <td>
                          {allocation ? (
                            <span style={{ fontSize: '12px', color: '#475569' }}>
                              Since {allocation.allocated_at ? String(allocation.allocated_at).split('T')[0] : '—'}
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '12px' }}>Not Allocated</span>
                          )}
                        </td>
                        <td>
                          {allocation ? (
                            <span className="badge-enterprise badge-purple">OCCUPIED</span>
                          ) : (
                            renderStatusBadge(b.status)
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            {canManageAccommodation && (
                              <button
                                type="button"
                                className="btn-icon"
                                title="Change Bed Status"
                                onClick={() => handleOpenBedStatusModal(b)}
                              >
                                <SlidersHorizontal size={13} />
                              </button>
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
      {/* MODAL: Create / Edit Hostel Facility                                */}
      {/* =================================================================== */}
      {hostelModalOpen && (
        <Modal
          isOpen={hostelModalOpen}
          onClose={() => setHostelModalOpen(false)}
          title={hostelModalMode === 'CREATE' ? 'Add New Hostel Facility' : `Edit Hostel — ${selectedHostel?.name}`}
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

          <form onSubmit={handleHostelSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Hostel Code *
                </label>
                <input
                  type="text"
                  className="filter-search-input"
                  style={{ width: '100%', fontSize: '12px' }}
                  value={hostelForm.code}
                  onChange={(e) => setHostelForm({ ...hostelForm, code: e.target.value })}
                  placeholder="e.g. H-NORTH"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Hostel Name *
                </label>
                <input
                  type="text"
                  className="filter-search-input"
                  style={{ width: '100%', fontSize: '12px' }}
                  value={hostelForm.name}
                  onChange={(e) => setHostelForm({ ...hostelForm, name: e.target.value })}
                  placeholder="e.g. Nelson Mandela Hostel"
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Classification Category *
                </label>
                <select
                  className="filter-select"
                  style={{ width: '100%' }}
                  value={hostelForm.category}
                  onChange={(e) => setHostelForm({ ...hostelForm, category: e.target.value })}
                  required
                >
                  <option value="BOYS">BOYS HOSTEL</option>
                  <option value="GIRLS">GIRLS HOSTEL</option>
                  <option value="COED">CO-ED RESIDENCE</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Designed Total Capacity (Beds)
                </label>
                <input
                  type="number"
                  min="0"
                  className="filter-search-input"
                  style={{ width: '100%', fontSize: '12px' }}
                  value={hostelForm.total_capacity}
                  onChange={(e) => setHostelForm({ ...hostelForm, total_capacity: e.target.value })}
                />
              </div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Physical Location / Address
              </label>
              <input
                type="text"
                className="filter-search-input"
                style={{ width: '100%', fontSize: '12px' }}
                value={hostelForm.address}
                onChange={(e) => setHostelForm({ ...hostelForm, address: e.target.value })}
                placeholder="e.g. North Campus, Sector 4"
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Description
              </label>
              <textarea
                className="filter-search-input"
                style={{ width: '100%', fontSize: '12px', minHeight: '60px' }}
                value={hostelForm.description}
                onChange={(e) => setHostelForm({ ...hostelForm, description: e.target.value })}
                placeholder="Facility details, amenities, or notes..."
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn-enterprise-secondary"
                onClick={() => setHostelModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-enterprise-primary"
                disabled={submitting}
              >
                {submitting ? 'Saving...' : hostelModalMode === 'CREATE' ? 'Create Facility' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* =================================================================== */}
      {/* MODAL: Update Hostel Status                                         */}
      {/* =================================================================== */}
      {hostelStatusModalOpen && selectedHostel && (
        <Modal
          isOpen={hostelStatusModalOpen}
          onClose={() => setHostelStatusModalOpen(false)}
          title={`Update Status — ${selectedHostel.name}`}
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

          <form onSubmit={handleHostelStatusSubmit}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Select Operational Status
              </label>
              <select
                className="filter-select"
                style={{ width: '100%' }}
                value={newStatusValue}
                onChange={(e) => setNewStatusValue(e.target.value)}
              >
                <option value="ACTIVE">ACTIVE (Fully Operational)</option>
                <option value="INACTIVE">INACTIVE (Not Admitting Students)</option>
                <option value="MAINTENANCE">MAINTENANCE (Renovation / Service)</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn-enterprise-secondary"
                onClick={() => setHostelStatusModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-enterprise-primary"
                disabled={submitting}
              >
                {submitting ? 'Updating...' : 'Update Status'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* =================================================================== */}
      {/* MODAL: Create / Edit Block                                          */}
      {/* =================================================================== */}
      {blockModalOpen && (
        <Modal
          isOpen={blockModalOpen}
          onClose={() => setBlockModalOpen(false)}
          title={blockModalMode === 'CREATE' ? `Add Block to ${selectedHostel?.name}` : `Edit Block — ${targetBlock?.name}`}
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

          <form onSubmit={handleBlockSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Block Code *
                </label>
                <input
                  type="text"
                  className="filter-search-input"
                  style={{ width: '100%', fontSize: '12px' }}
                  value={blockForm.code}
                  onChange={(e) => setBlockForm({ ...blockForm, code: e.target.value })}
                  placeholder="e.g. BLK-A"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Block Name *
                </label>
                <input
                  type="text"
                  className="filter-search-input"
                  style={{ width: '100%', fontSize: '12px' }}
                  value={blockForm.name}
                  onChange={(e) => setBlockForm({ ...blockForm, name: e.target.value })}
                  placeholder="e.g. Block A (East Wing)"
                  required
                />
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Description
              </label>
              <textarea
                className="filter-search-input"
                style={{ width: '100%', fontSize: '12px', minHeight: '60px' }}
                value={blockForm.description}
                onChange={(e) => setBlockForm({ ...blockForm, description: e.target.value })}
                placeholder="Optional notes regarding this wing..."
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn-enterprise-secondary"
                onClick={() => setBlockModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-enterprise-primary"
                disabled={submitting}
              >
                {submitting ? 'Saving...' : blockModalMode === 'CREATE' ? 'Add Block' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* =================================================================== */}
      {/* MODAL: Update Block Status                                          */}
      {/* =================================================================== */}
      {blockStatusModalOpen && targetBlock && (
        <Modal
          isOpen={blockStatusModalOpen}
          onClose={() => setBlockStatusModalOpen(false)}
          title={`Update Block Status — ${targetBlock.name}`}
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

          <form onSubmit={handleBlockStatusSubmit}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Operational Status
              </label>
              <select
                className="filter-select"
                style={{ width: '100%' }}
                value={newStatusValue}
                onChange={(e) => setNewStatusValue(e.target.value)}
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
                <option value="MAINTENANCE">MAINTENANCE</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn-enterprise-secondary"
                onClick={() => setBlockStatusModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-enterprise-primary"
                disabled={submitting}
              >
                {submitting ? 'Updating...' : 'Update Status'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* =================================================================== */}
      {/* MODAL: Create / Edit Floor                                          */}
      {/* =================================================================== */}
      {floorModalOpen && (
        <Modal
          isOpen={floorModalOpen}
          onClose={() => setFloorModalOpen(false)}
          title={floorModalMode === 'CREATE' ? `Add Floor to ${selectedBlock?.name}` : `Edit Floor — ${targetFloor?.name}`}
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

          <form onSubmit={handleFloorSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Floor Code *
                </label>
                <input
                  type="text"
                  className="filter-search-input"
                  style={{ width: '100%', fontSize: '12px' }}
                  value={floorForm.code}
                  onChange={(e) => setFloorForm({ ...floorForm, code: e.target.value })}
                  placeholder="e.g. FLR-1"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Floor Name *
                </label>
                <input
                  type="text"
                  className="filter-search-input"
                  style={{ width: '100%', fontSize: '12px' }}
                  value={floorForm.name}
                  onChange={(e) => setFloorForm({ ...floorForm, name: e.target.value })}
                  placeholder="e.g. First Floor"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Floor Number (Level)
                </label>
                <input
                  type="number"
                  className="filter-search-input"
                  style={{ width: '100%', fontSize: '12px' }}
                  value={floorForm.floor_number}
                  onChange={(e) => setFloorForm({ ...floorForm, floor_number: e.target.value })}
                />
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Description
              </label>
              <textarea
                className="filter-search-input"
                style={{ width: '100%', fontSize: '12px', minHeight: '60px' }}
                value={floorForm.description}
                onChange={(e) => setFloorForm({ ...floorForm, description: e.target.value })}
                placeholder="Floor amenities or details..."
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn-enterprise-secondary"
                onClick={() => setFloorModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-enterprise-primary"
                disabled={submitting}
              >
                {submitting ? 'Saving...' : floorModalMode === 'CREATE' ? 'Add Floor' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* =================================================================== */}
      {/* MODAL: Update Floor Status                                          */}
      {/* =================================================================== */}
      {floorStatusModalOpen && targetFloor && (
        <Modal
          isOpen={floorStatusModalOpen}
          onClose={() => setFloorStatusModalOpen(false)}
          title={`Update Floor Status — ${targetFloor.name}`}
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

          <form onSubmit={handleFloorStatusSubmit}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Operational Status
              </label>
              <select
                className="filter-select"
                style={{ width: '100%' }}
                value={newStatusValue}
                onChange={(e) => setNewStatusValue(e.target.value)}
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
                <option value="MAINTENANCE">MAINTENANCE</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn-enterprise-secondary"
                onClick={() => setFloorStatusModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-enterprise-primary"
                disabled={submitting}
              >
                {submitting ? 'Updating...' : 'Update Status'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* =================================================================== */}
      {/* MODAL: Create / Edit Room                                           */}
      {/* =================================================================== */}
      {roomModalOpen && (
        <Modal
          isOpen={roomModalOpen}
          onClose={() => setRoomModalOpen(false)}
          title={roomModalMode === 'CREATE' ? `Add Room to ${selectedFloor?.name}` : `Edit Room — ${targetRoom?.name}`}
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

          <form onSubmit={handleRoomSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Room Number / Code *
                </label>
                <input
                  type="text"
                  className="filter-search-input"
                  style={{ width: '100%', fontSize: '12px' }}
                  value={roomForm.code}
                  onChange={(e) => setRoomForm({ ...roomForm, code: e.target.value })}
                  placeholder="e.g. RM-101"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Room Name *
                </label>
                <input
                  type="text"
                  className="filter-search-input"
                  style={{ width: '100%', fontSize: '12px' }}
                  value={roomForm.name}
                  onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })}
                  placeholder="e.g. Room 101"
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Room Type *
                </label>
                <select
                  className="filter-select"
                  style={{ width: '100%' }}
                  value={roomForm.room_type}
                  onChange={(e) => {
                    const t = e.target.value;
                    let cap = 2;
                    if (t === 'SINGLE') cap = 1;
                    if (t === 'DOUBLE') cap = 2;
                    if (t === 'TRIPLE') cap = 3;
                    if (t === 'FOUR_BED') cap = 4;
                    if (t === 'DORMITORY') cap = 8;
                    setRoomForm({ ...roomForm, room_type: t, capacity: cap });
                  }}
                  required
                >
                  <option value="SINGLE">SINGLE OCCUPANCY</option>
                  <option value="DOUBLE">DOUBLE OCCUPANCY</option>
                  <option value="TRIPLE">TRIPLE OCCUPANCY</option>
                  <option value="FOUR_BED">FOUR BED ROOM</option>
                  <option value="DORMITORY">DORMITORY</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Bed Capacity *
                </label>
                <input
                  type="number"
                  min="1"
                  className="filter-search-input"
                  style={{ width: '100%', fontSize: '12px' }}
                  value={roomForm.capacity}
                  onChange={(e) => setRoomForm({ ...roomForm, capacity: e.target.value })}
                  required
                />
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Description
              </label>
              <textarea
                className="filter-search-input"
                style={{ width: '100%', fontSize: '12px', minHeight: '60px' }}
                value={roomForm.description}
                onChange={(e) => setRoomForm({ ...roomForm, description: e.target.value })}
                placeholder="Attached washroom, balcony, or air conditioning notes..."
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn-enterprise-secondary"
                onClick={() => setRoomModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-enterprise-primary"
                disabled={submitting}
              >
                {submitting ? 'Saving...' : roomModalMode === 'CREATE' ? 'Add Room' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* =================================================================== */}
      {/* MODAL: Update Room Status                                           */}
      {/* =================================================================== */}
      {roomStatusModalOpen && targetRoom && (
        <Modal
          isOpen={roomStatusModalOpen}
          onClose={() => setRoomStatusModalOpen(false)}
          title={`Update Room Status — ${targetRoom.name}`}
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

          <form onSubmit={handleRoomStatusSubmit}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Operational Status
              </label>
              <select
                className="filter-select"
                style={{ width: '100%' }}
                value={newStatusValue}
                onChange={(e) => setNewStatusValue(e.target.value)}
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
                <option value="MAINTENANCE">MAINTENANCE</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn-enterprise-secondary"
                onClick={() => setRoomStatusModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-enterprise-primary"
                disabled={submitting}
              >
                {submitting ? 'Updating...' : 'Update Status'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* =================================================================== */}
      {/* MODAL: Create Bed Space                                             */}
      {/* =================================================================== */}
      {bedModalOpen && (
        <Modal
          isOpen={bedModalOpen}
          onClose={() => setBedModalOpen(false)}
          title={`Add Bed Space to ${selectedRoom?.name}`}
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

          <form onSubmit={handleBedSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Bed Identifier / Code *
                </label>
                <input
                  type="text"
                  className="filter-search-input"
                  style={{ width: '100%', fontSize: '12px' }}
                  value={bedForm.code}
                  onChange={(e) => setBedForm({ ...bedForm, code: e.target.value })}
                  placeholder="e.g. BED-A"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Bed Label / Name
                </label>
                <input
                  type="text"
                  className="filter-search-input"
                  style={{ width: '100%', fontSize: '12px' }}
                  value={bedForm.name}
                  onChange={(e) => setBedForm({ ...bedForm, name: e.target.value })}
                  placeholder="e.g. Lower Bunk Left"
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn-enterprise-secondary"
                onClick={() => setBedModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-enterprise-primary"
                disabled={submitting}
              >
                {submitting ? 'Creating...' : 'Add Bed Space'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* =================================================================== */}
      {/* MODAL: Update Bed Status                                            */}
      {/* =================================================================== */}
      {bedStatusModalOpen && targetBed && (
        <Modal
          isOpen={bedStatusModalOpen}
          onClose={() => setBedStatusModalOpen(false)}
          title={`Update Bed Status — ${targetBed.code}`}
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

          <form onSubmit={handleBedStatusSubmit}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Bed Status
              </label>
              <select
                className="filter-select"
                style={{ width: '100%' }}
                value={newStatusValue}
                onChange={(e) => setNewStatusValue(e.target.value)}
              >
                <option value="ACTIVE">ACTIVE (Available for Allocation)</option>
                <option value="MAINTENANCE">MAINTENANCE (Out of Order)</option>
                <option value="RESERVED">RESERVED (Hold for Special Quota)</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn-enterprise-secondary"
                onClick={() => setBedStatusModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-enterprise-primary"
                disabled={submitting}
              >
                {submitting ? 'Updating...' : 'Update Status'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
