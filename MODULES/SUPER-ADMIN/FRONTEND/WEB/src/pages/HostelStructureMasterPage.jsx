import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Building2,
  Layers,
  AlignJustify,
  DoorOpen,
  Bed,
  Lock,
  Unlock,
  Sliders,
  History,
  ArrowLeft,
  Plus,
  Zap,
  FileSpreadsheet,
  Copy,
  ChevronRight,
  ChevronDown,
  ChevronsDown,
  ChevronsUp,
  Search,
  X,
  Edit3,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Users,
  UserCheck,
} from 'lucide-react';
import { fetchCollegeById } from '../services/collegeService';
import {
  fetchStructureOverview,
  fetchStructureTree,
  createHostel,
  updateHostel,
  deleteHostel,
  createBlock,
  updateBlock,
  deleteBlock,
  createFloor,
  updateFloor,
  deleteFloor,
  createRoom,
  updateRoom,
  deleteRoom,
  createBed,
  updateBed,
  deleteBed,
  previewBulkGeneration,
  generateBulkStructure,
  downloadCSVTemplate,
  previewCSV,
  importCSV,
  previewClone,
  applyClone,
  fetchStructurePolicy,
  updateStructurePolicy,
  toggleStructureLock,
  fetchStructureAudits,
} from '../services/hostelStructureService';

export default function HostelStructureMasterPage() {
  const { id: collegeId } = useParams();

  // Core Data State
  const [college, setCollege] = useState(null);
  const [overview, setOverview] = useState(null);
  const [tree, setTree] = useState([]);
  const [policy, setPolicy] = useState(null);
  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successNotice, setSuccessNotice] = useState(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNodes, setExpandedNodes] = useState({});
  const [selectedEntity, setSelectedEntity] = useState(null); // { type, data }
  const [hideOptionalBlocks, setHideOptionalBlocks] = useState(false);

  // Modals Visibility
  const [modalType, setModalType] = useState(null); // 'HOSTEL', 'BLOCK', 'FLOOR', 'ROOM', 'BED', 'BULK', 'CSV', 'CLONE', 'POLICY', 'AUDIT'
  const [modalMode, setModalMode] = useState('CREATE'); // 'CREATE' | 'EDIT'
  const [activeParent, setActiveParent] = useState(null); // Parent object when creating child
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  // Form States
  const [hostelForm, setHostelForm] = useState({ code: '', name: '', category: 'BOYS', total_capacity: 0, status: 'ACTIVE', description: '', address: '' });
  const [blockForm, setBlockForm] = useState({ code: '', name: '', status: 'ACTIVE', description: '' });
  const [floorForm, setFloorForm] = useState({ code: '', name: '', floor_number: 1, status: 'ACTIVE', description: '' });
  const [roomForm, setRoomForm] = useState({ code: '', name: '', room_type: 'STANDARD', capacity: 2, status: 'ACTIVE', description: '' });
  const [bedForm, setBedForm] = useState({ code: '', name: '', status: 'AVAILABLE' });

  // Bulk Generation State
  const [bulkStep, setBulkStep] = useState(1);
  const [bulkInput, setBulkInput] = useState({
    hostel_id: '',
    block_id: '',
    block_name: '',
    block_code: '',
    floor_count: 3,
    starting_floor: 1,
    floor_name_prefix: 'Floor ',
    rooms_per_floor: 10,
    room_type: 'STANDARD',
    room_capacity: 2,
    generate_beds: true,
    bed_naming_pattern: 'ALPHA',
  });
  const [bulkPreview, setBulkPreview] = useState(null);

  // CSV Import State
  const [csvFile, setCsvFile] = useState(null);
  const [csvResult, setCsvResult] = useState(null);
  const [csvValidating, setCsvValidating] = useState(false);

  // Clone Structure State
  const [cloneInput, setCloneInput] = useState({
    source_hostel_id: '',
    new_hostel_code: '',
    new_hostel_name: '',
    new_category: 'BOYS',
  });
  const [clonePreview, setClonePreview] = useState(null);

  // Policy & Lock Form
  const [policyForm, setPolicyForm] = useState({
    allow_bulk_generation: true,
    allow_csv_import: true,
    allow_cloning: true,
    prevent_occupied_modification: true,
    is_locked: false,
    lock_reason: '',
  });

  const abortControllerRef = useRef(null);

  // Load all data
  const loadData = async (preserveExpanded = true) => {
    setLoading(true);
    setError(null);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const [colData, overData, treeData, polData] = await Promise.all([
        fetchCollegeById(collegeId, controller.signal),
        fetchStructureOverview(collegeId, controller.signal),
        fetchStructureTree(collegeId, null, controller.signal),
        fetchStructurePolicy(collegeId, controller.signal),
      ]);

      setCollege(colData);
      setOverview(overData);
      setTree(treeData);
      setPolicy(polData);
      setPolicyForm({
        allow_bulk_generation: polData.allow_bulk_generation,
        allow_csv_import: polData.allow_csv_import,
        allow_cloning: polData.allow_cloning,
        prevent_occupied_modification: polData.prevent_occupied_modification,
        is_locked: polData.is_locked,
        lock_reason: polData.lock_reason || '',
      });

      // Default expand all hostels and blocks
      if (!preserveExpanded || Object.keys(expandedNodes).length === 0) {
        const initialExpanded = {};
        treeData.forEach((h) => {
          initialExpanded[`hostel-${h.id}`] = true;
          (h.blocks || []).forEach((b) => {
            initialExpanded[`block-${b.ID || b.id}`] = true;
          });
        });
        setExpandedNodes(initialExpanded);
      }
    } catch (err) {
      if (err.isCanceled || err.name === 'CanceledError') return;
      setError(err.message || 'Failed to load hostel structure data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(false);
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collegeId]);

  // Toggle node expansion
  const toggleExpand = (nodeKey) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [nodeKey]: !prev[nodeKey],
    }));
  };

  // Expand / collapse all
  const setAllExpanded = (expanded) => {
    const next = {};
    tree.forEach((h) => {
      next[`hostel-${h.id}`] = expanded;
      (h.blocks || []).forEach((b) => {
        next[`block-${b.ID || b.id}`] = expanded;
        (b.floors || []).forEach((f) => {
          next[`floor-${f.id}`] = expanded;
          (f.rooms || []).forEach((r) => {
            next[`room-${r.id}`] = expanded;
          });
        });
      });
    });
    setExpandedNodes(next);
  };

  // Filtered Tree based on search query
  const filteredTree = useMemo(() => {
    if (!searchQuery.trim()) return tree;
    const q = searchQuery.toLowerCase().trim();

    return tree
      .map((hostel) => {
        const hMatch = hostel.name.toLowerCase().includes(q) || hostel.code.toLowerCase().includes(q);
        const matchingBlocks = (hostel.blocks || [])
          .map((block) => {
            const bMatch = block.name.toLowerCase().includes(q) || block.code.toLowerCase().includes(q);
            const matchingFloors = (block.floors || [])
              .map((floor) => {
                const fMatch = floor.name.toLowerCase().includes(q) || floor.code.toLowerCase().includes(q);
                const matchingRooms = (floor.rooms || []).filter((room) => {
                  const rMatch = room.name.toLowerCase().includes(q) || room.code.toLowerCase().includes(q);
                  const bedMatch = (room.beds || []).some((b) => b.code.toLowerCase().includes(q));
                  return rMatch || bedMatch;
                });
                if (fMatch || matchingRooms.length > 0) {
                  return { ...floor, rooms: fMatch ? floor.rooms : matchingRooms };
                }
                return null;
              })
              .filter(Boolean);

            if (bMatch || matchingFloors.length > 0) {
              return { ...block, floors: bMatch ? block.floors : matchingFloors };
            }
            return null;
          })
          .filter(Boolean);

        if (hMatch || matchingBlocks.length > 0) {
          return { ...hostel, blocks: hMatch ? hostel.blocks : matchingBlocks };
        }
        return null;
      })
      .filter(Boolean);
  }, [tree, searchQuery]);

  // Open Create/Edit Entity Modals
  const openEntityModal = (type, mode = 'CREATE', entity = null, parent = null) => {
    setModalType(type);
    setModalMode(mode);
    setActiveParent(parent);
    setFormError(null);

    if (type === 'HOSTEL') {
      if (mode === 'EDIT' && entity) {
        setHostelForm({
          id: entity.id,
          code: entity.code,
          name: entity.name,
          category: entity.category,
          total_capacity: entity.total_capacity || 0,
          status: entity.status || 'ACTIVE',
          description: entity.description || '',
          address: entity.address || '',
        });
      } else {
        setHostelForm({ code: '', name: '', category: 'BOYS', total_capacity: 0, status: 'ACTIVE', description: '', address: '' });
      }
    } else if (type === 'BLOCK') {
      if (mode === 'EDIT' && entity) {
        setBlockForm({ id: entity.id || entity.ID, code: entity.code, name: entity.name, status: entity.status || 'ACTIVE', description: entity.description || '' });
      } else {
        setBlockForm({ code: '', name: '', status: 'ACTIVE', description: '', hostel_id: parent?.id });
      }
    } else if (type === 'FLOOR') {
      if (mode === 'EDIT' && entity) {
        setFloorForm({ id: entity.id, code: entity.code, name: entity.name, floor_number: entity.floor_number ?? 1, status: entity.status || 'ACTIVE', description: entity.description || '' });
      } else {
        setFloorForm({ code: '', name: '', floor_number: 1, status: 'ACTIVE', description: '', block_id: parent?.id || parent?.ID });
      }
    } else if (type === 'ROOM') {
      if (mode === 'EDIT' && entity) {
        setRoomForm({ id: entity.id, code: entity.code, name: entity.name, room_type: entity.room_type || 'STANDARD', capacity: entity.capacity || 2, status: entity.status || 'ACTIVE', description: entity.description || '' });
      } else {
        setRoomForm({ code: '', name: '', room_type: 'STANDARD', capacity: 2, status: 'ACTIVE', description: '', floor_id: parent?.id });
      }
    } else if (type === 'BED') {
      if (mode === 'EDIT' && entity) {
        setBedForm({ id: entity.id, code: entity.code, name: entity.name || '', status: entity.status || 'AVAILABLE' });
      } else {
        setBedForm({ code: '', name: '', status: 'AVAILABLE', room_id: parent?.id });
      }
    }
  };

  // Submit Entity Forms
  const handleEntitySubmit = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError(null);

    try {
      if (modalType === 'HOSTEL') {
        if (modalMode === 'CREATE') {
          await createHostel(collegeId, hostelForm);
          setSuccessNotice(`Hostel "${hostelForm.name}" created successfully.`);
        } else {
          await updateHostel(collegeId, hostelForm.id, hostelForm);
          setSuccessNotice(`Hostel "${hostelForm.name}" updated successfully.`);
        }
      } else if (modalType === 'BLOCK') {
        if (modalMode === 'CREATE') {
          await createBlock(collegeId, { ...blockForm, hostel_id: activeParent?.id });
          setSuccessNotice(`Block "${blockForm.name}" created successfully.`);
        } else {
          await updateBlock(collegeId, blockForm.id, blockForm);
          setSuccessNotice(`Block "${blockForm.name}" updated successfully.`);
        }
      } else if (modalType === 'FLOOR') {
        if (modalMode === 'CREATE') {
          await createFloor(collegeId, { ...floorForm, block_id: activeParent?.id || activeParent?.ID });
          setSuccessNotice(`Floor "${floorForm.name}" created successfully.`);
        } else {
          await updateFloor(collegeId, floorForm.id, floorForm);
          setSuccessNotice(`Floor "${floorForm.name}" updated successfully.`);
        }
      } else if (modalType === 'ROOM') {
        if (modalMode === 'CREATE') {
          await createRoom(collegeId, { ...roomForm, floor_id: activeParent?.id });
          setSuccessNotice(`Room "${roomForm.name}" created successfully.`);
        } else {
          await updateRoom(collegeId, roomForm.id, roomForm);
          setSuccessNotice(`Room "${roomForm.name}" updated successfully.`);
        }
      } else if (modalType === 'BED') {
        if (modalMode === 'CREATE') {
          await createBed(collegeId, { ...bedForm, room_id: activeParent?.id });
          setSuccessNotice(`Bed "${bedForm.code}" created successfully.`);
        } else {
          await updateBed(collegeId, bedForm.id, bedForm);
          setSuccessNotice(`Bed "${bedForm.code}" updated successfully.`);
        }
      }

      setModalType(null);
      await loadData();
    } catch (err) {
      setFormError(err.message || 'Operation failed');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Delete Entity Handler
  const handleDeleteEntity = async (type, id, name) => {
    if (!window.confirm(`Are you sure you want to delete ${type} "${name}"? This action cannot be undone.`)) {
      return;
    }
    try {
      if (type === 'Hostel') await deleteHostel(collegeId, id);
      else if (type === 'Block') await deleteBlock(collegeId, id);
      else if (type === 'Floor') await deleteFloor(collegeId, id);
      else if (type === 'Room') await deleteRoom(collegeId, id);
      else if (type === 'Bed') await deleteBed(collegeId, id);

      setSuccessNotice(`${type} deleted successfully.`);
      setSelectedEntity(null);
      await loadData();
    } catch (err) {
      alert(`Deletion failed: ${err.message}`);
    }
  };

  // --- Bulk Generation Handlers ---
  const handleBulkPreview = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError(null);
    try {
      const prev = await previewBulkGeneration(collegeId, bulkInput);
      setBulkPreview(prev);
      setBulkStep(2);
    } catch (err) {
      setFormError(err.message || 'Failed to preview bulk generation');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleBulkGenerateConfirm = async () => {
    setFormSubmitting(true);
    setFormError(null);
    try {
      await generateBulkStructure(collegeId, bulkInput);
      setSuccessNotice(`Structure generated successfully: ${bulkPreview.floors_to_create} floors, ${bulkPreview.rooms_to_create} rooms.`);
      setModalType(null);
      setBulkStep(1);
      setBulkPreview(null);
      await loadData();
    } catch (err) {
      setFormError(err.message || 'Generation failed');
    } finally {
      setFormSubmitting(false);
    }
  };

  // --- CSV Import Handlers ---
  const handleCSVFileChange = (e) => {
    const file = e.target.files[0];
    setCsvFile(file);
    setCsvResult(null);
    setFormError(null);
  };

  const handleCSVValidate = async () => {
    if (!csvFile) {
      setFormError('Please select a CSV file first');
      return;
    }
    setCsvValidating(true);
    setFormError(null);
    try {
      const res = await previewCSV(collegeId, csvFile);
      setCsvResult(res);
    } catch (err) {
      setFormError(err.message || 'CSV validation failed');
    } finally {
      setCsvValidating(false);
    }
  };

  const handleCSVImportApply = async () => {
    if (!csvFile) return;
    setFormSubmitting(true);
    setFormError(null);
    try {
      await importCSV(collegeId, csvFile);
      setSuccessNotice(`CSV structure imported successfully.`);
      setModalType(null);
      setCsvFile(null);
      setCsvResult(null);
      await loadData();
    } catch (err) {
      setFormError(err.message || 'Import failed');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await downloadCSVTemplate(collegeId);
      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hostel_structure_template.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to download template: ' + err.message);
    }
  };

  // --- Clone Handlers ---
  const handleClonePreview = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError(null);
    try {
      const prev = await previewClone(collegeId, cloneInput);
      setClonePreview(prev);
    } catch (err) {
      setFormError(err.message || 'Failed to preview cloning');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleCloneApply = async () => {
    setFormSubmitting(true);
    setFormError(null);
    try {
      await applyClone(collegeId, cloneInput);
      setSuccessNotice(`Structure cloned successfully into "${cloneInput.new_hostel_name}".`);
      setModalType(null);
      setClonePreview(null);
      await loadData();
    } catch (err) {
      setFormError(err.message || 'Cloning failed');
    } finally {
      setFormSubmitting(false);
    }
  };

  // --- Policy & Lock Handlers ---
  const handlePolicySave = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError(null);
    try {
      await updateStructurePolicy(collegeId, policyForm);
      setSuccessNotice('Structure policy updated successfully.');
      setModalType(null);
      await loadData();
    } catch (err) {
      setFormError(err.message || 'Failed to update policy');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleToggleLockQuick = async () => {
    const nextLocked = !policy?.is_locked;
    const promptReason = window.prompt(
      nextLocked
        ? 'Enter a reason for locking the structure (prohibits all structural edits):'
        : 'Enter a reason for unlocking the structure:'
    );
    if (promptReason === null) return;

    try {
      await toggleStructureLock(collegeId, {
        lock: nextLocked,
        reason: promptReason || (nextLocked ? 'Locked by Super Admin' : 'Unlocked by Super Admin'),
      });
      setSuccessNotice(`Structure successfully ${nextLocked ? 'LOCKED' : 'UNLOCKED'}.`);
      await loadData();
    } catch (err) {
      alert(`Lock toggle failed: ${err.message}`);
    }
  };

  // --- Open Audits Modal ---
  const openAuditsModal = async () => {
    setModalType('AUDIT');
    try {
      const res = await fetchStructureAudits(collegeId, 30);
      setAudits(res || []);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading || !college) {
    return (
      <div className="main-content" style={{ padding: '32px' }}>
        <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
          <div style={{ fontSize: '2rem', marginBottom: '16px' }}>⏳</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>Loading Hostel Structure Master...</div>
          <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>Fetching hierarchy, verified occupancy, and college settings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="main-content hostel-master-container" style={{ padding: '24px 32px' }}>
      {/* Hero Header */}
      <div className="hostel-master-hero">
        <div className="hostel-hero-breadcrumb-bar">
          <Link to="/colleges" className="hostel-hero-breadcrumb-link">Colleges</Link>
          <span style={{ color: '#cbd5e1' }}>/</span>
          <Link to={`/colleges/${collegeId}`} className="hostel-hero-breadcrumb-link">
            {college?.name || 'College Details'}
          </Link>
          <span style={{ color: '#cbd5e1' }}>/</span>
          <span style={{ fontWeight: '600', color: '#0f172a' }}>Hostel Structure Master</span>
        </div>

        <div className="hostel-hero-main-row">
          <div className="hostel-hero-title-group">
            <h1 className="hostel-hero-title">
              <span className="hostel-hero-icon-badge">
                <Building2 size={22} />
              </span>
              <span>Hostel Structure Master</span>
              {policy?.is_locked ? (
                <span className="badge-status-locked">
                  <Lock size={12} /> Structure Locked
                </span>
              ) : (
                <span className="badge-status-active">
                  <Unlock size={12} /> Structure Editable
                </span>
              )}
            </h1>
            <p className="hostel-hero-subtitle">
              Physical facilities, buildings, floors, rooms, and beds for <strong>{college?.name}</strong> ({college?.college_code})
            </p>
          </div>

          <div className="hostel-hero-actions">
            <button
              className={`btn-enterprise ${policy?.is_locked ? 'btn-emerald' : 'btn-outline-soft'}`}
              onClick={handleToggleLockQuick}
              title={policy?.is_locked ? 'Click to unlock structure' : 'Click to lock structure against edits'}
              id="btn-lock-toggle"
            >
              {policy?.is_locked ? <Unlock size={14} /> : <Lock size={14} />}
              <span>{policy?.is_locked ? 'Unlock Structure' : 'Lock Structure'}</span>
            </button>
            <button
              className="btn-enterprise btn-outline-soft"
              onClick={() => setModalType('POLICY')}
              id="btn-policy-settings"
            >
              <Sliders size={14} />
              <span>Edit Policy</span>
            </button>
            <button
              className="btn-enterprise btn-outline-soft"
              onClick={openAuditsModal}
              id="btn-audit-logs"
            >
              <History size={14} />
              <span>Audit History</span>
            </button>
            <Link to={`/colleges/${collegeId}`} className="btn-enterprise btn-outline-soft">
              <ArrowLeft size={14} />
              <span>Back to College</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {successNotice && (
        <div
          style={{
            backgroundColor: '#ecfdf5',
            border: '1px solid #a7f3d0',
            color: '#065f46',
            borderRadius: '12px',
            padding: '12px 18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 1px 3px rgba(6, 95, 70, 0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500', fontSize: '0.9rem' }}>
            <CheckCircle2 size={16} className="text-emerald-600" />
            <span>{successNotice}</span>
          </div>
          <button
            className="btn-icon-action"
            onClick={() => setSuccessNotice(null)}
            style={{ width: '24px', height: '24px', border: 'none', background: 'transparent' }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {error && (
        <div
          style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            borderRadius: '12px',
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: '500',
            fontSize: '0.9rem',
            boxShadow: '0 1px 3px rgba(153, 27, 27, 0.05)',
          }}
        >
          <AlertCircle size={16} className="text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Aggregate Occupancy & Physical Summary Metrics */}
      <div className="hostel-kpi-panel">
        <div className="hostel-kpi-panel-header">
          <div className="hostel-kpi-title-block">
            <span style={{ display: 'flex', alignItems: 'center', color: '#2563eb' }}>
              <Building2 size={18} />
            </span>
            <span>Real Aggregate Occupancy & Physical Capacity Metrics</span>
            <span className="badge-category-boys" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <ShieldCheck size={11} /> Verified Live Data
            </span>
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
            Physical capacity vs verified student bed allocations
          </div>
        </div>

        <div className="hostel-kpi-grid">
          {/* Card 1: Hostels */}
          <div className="hostel-stat-box">
            <div className="hostel-stat-icon-wrap blue">
              <Building2 size={16} />
            </div>
            <span className="hostel-stat-label">Hostels</span>
            <span className="hostel-stat-value blue">{overview?.total_hostels ?? 0}</span>
            <span className="hostel-stat-subtext">Facilities</span>
          </div>

          {/* Card 2: Blocks */}
          <div className="hostel-stat-box">
            <div className="hostel-stat-icon-wrap cyan">
              <Layers size={16} />
            </div>
            <span className="hostel-stat-label">Blocks</span>
            <span className="hostel-stat-value cyan">{overview?.total_blocks ?? 0}</span>
            <span className="hostel-stat-subtext">Wings / Units</span>
          </div>

          {/* Card 3: Floors */}
          <div className="hostel-stat-box">
            <div className="hostel-stat-icon-wrap indigo">
              <AlignJustify size={16} />
            </div>
            <span className="hostel-stat-label">Floors</span>
            <span className="hostel-stat-value indigo">{overview?.total_floors ?? 0}</span>
            <span className="hostel-stat-subtext">Levels</span>
          </div>

          {/* Card 4: Active Rooms */}
          <div className="hostel-stat-box">
            <div className="hostel-stat-icon-wrap emerald">
              <DoorOpen size={16} />
            </div>
            <span className="hostel-stat-label">Active Rooms</span>
            <span className="hostel-stat-value emerald">{overview?.active_rooms ?? 0}</span>
            <span className="hostel-stat-subtext">of {overview?.total_rooms ?? 0} Total</span>
          </div>

          {/* Card 5: Vacant Rooms */}
          <div className="hostel-stat-box">
            <div className="hostel-stat-icon-wrap teal">
              <CheckCircle2 size={16} />
            </div>
            <span className="hostel-stat-label">Vacant Rooms</span>
            <span className="hostel-stat-value teal">{overview?.vacant_rooms ?? 0}</span>
            <span className="hostel-stat-subtext">Zero Occupancy</span>
          </div>

          {/* Card 6: Total Capacity */}
          <div className="hostel-stat-box">
            <div className="hostel-stat-icon-wrap purple">
              <Users size={16} />
            </div>
            <span className="hostel-stat-label">Total Capacity</span>
            <span className="hostel-stat-value purple">{overview?.total_bed_capacity ?? 0}</span>
            <span className="hostel-stat-subtext">{overview?.total_beds ?? 0} Beds Made</span>
          </div>

          {/* Card 7: Occupied Beds */}
          <div className="hostel-stat-box">
            <div className="hostel-stat-icon-wrap orange">
              <UserCheck size={16} />
            </div>
            <span className="hostel-stat-label">Occupied Beds</span>
            <span className="hostel-stat-value orange">{overview?.occupied_beds ?? 0}</span>
            <span className="hostel-stat-subtext">{overview?.occupancy_percentage?.toFixed(1) ?? '0.0'}% Occupied</span>
          </div>

          {/* Card 8: Available Beds */}
          <div className="hostel-stat-box">
            <div className="hostel-stat-icon-wrap emerald">
              <Bed size={16} />
            </div>
            <span className="hostel-stat-label">Available Beds</span>
            <span className="hostel-stat-value emerald">{overview?.available_beds ?? 0}</span>
            <span className="hostel-stat-subtext">Ready for Allocation</span>
          </div>
        </div>
      </div>

      {/* Main Structural Actions Bar */}
      <div className="hostel-toolbar-panel">
        <div className="hostel-toolbar-controls">
          <div className="hostel-btn-group">
            <button
              className="btn-enterprise btn-primary-blue"
              onClick={() => openEntityModal('HOSTEL', 'CREATE')}
              disabled={policy?.is_locked}
              title={policy?.is_locked ? 'Locked by policy' : 'Create a new physical hostel facility'}
              id="btn-add-hostel"
            >
              <Plus size={15} />
              <span>Add Hostel</span>
            </button>
            <button
              className="btn-enterprise btn-outline-soft"
              onClick={() => {
                if (tree.length === 0) {
                  alert('Please create at least one hostel before generating structure.');
                  return;
                }
                setBulkInput((prev) => ({ ...prev, hostel_id: tree[0].id }));
                setBulkStep(1);
                setBulkPreview(null);
                setModalType('BULK');
              }}
              disabled={policy?.is_locked || !policy?.allow_bulk_generation}
              title={policy?.is_locked ? 'Locked' : 'Procedural structure builder'}
              id="btn-bulk-generate"
            >
              <Zap size={14} className="text-amber-500" />
              <span>Bulk Generate</span>
            </button>
            <button
              className="btn-enterprise btn-outline-soft"
              onClick={() => {
                setCsvFile(null);
                setCsvResult(null);
                setModalType('CSV');
              }}
              disabled={policy?.is_locked || !policy?.allow_csv_import}
              title="Import physical structure via CSV"
              id="btn-csv-import"
            >
              <FileSpreadsheet size={14} className="text-emerald-600" />
              <span>CSV Import</span>
            </button>
            <button
              className="btn-enterprise btn-outline-soft"
              onClick={() => {
                if (tree.length === 0) {
                  alert('No hostels available to clone.');
                  return;
                }
                setCloneInput({
                  source_hostel_id: tree[0].id,
                  new_hostel_code: `${tree[0].code}_COPY`,
                  new_hostel_name: `${tree[0].name} (Copy)`,
                  new_category: tree[0].category,
                });
                setClonePreview(null);
                setModalType('CLONE');
              }}
              disabled={policy?.is_locked || !policy?.allow_cloning}
              title="Clone an existing hostel hierarchy"
              id="btn-clone-structure"
            >
              <Copy size={14} className="text-purple-600" />
              <span>Clone Structure</span>
            </button>
          </div>

          <div className="hostel-view-options">
            <label className="hostel-toggle-pill">
              <input
                type="checkbox"
                checked={hideOptionalBlocks}
                onChange={(e) => setHideOptionalBlocks(e.target.checked)}
                style={{ accentColor: '#2563eb', cursor: 'pointer' }}
              />
              <span>Collapse Blocks (Direct Floor View)</span>
            </label>
            <button
              className="btn-enterprise btn-outline-soft btn-sm"
              onClick={() => setAllExpanded(true)}
              title="Expand all tree nodes"
            >
              <ChevronsDown size={13} />
              <span>Expand All</span>
            </button>
            <button
              className="btn-enterprise btn-outline-soft btn-sm"
              onClick={() => setAllExpanded(false)}
              title="Collapse all tree nodes"
            >
              <ChevronsUp size={13} />
              <span>Collapse All</span>
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="hostel-search-wrapper">
          <Search size={16} className="hostel-search-icon" />
          <input
            type="text"
            className="hostel-search-input"
            placeholder="Filter structure by hostel name, block code, floor number, room number (e.g. 101), or bed code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="hostel-search-clear"
              onClick={() => setSearchQuery('')}
              title="Clear search"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Main Structural View (Split Tree + Details Drawer) */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedEntity ? '1fr 340px' : '1fr', gap: '20px' }}>
        {/* Tree View */}
        <div className="hostel-browser-panel">
          <div className="hostel-browser-header">
            <h2 className="hostel-browser-title">
              <Building2 size={20} className="text-blue-600" />
              <span>Physical Hierarchy Browser</span>
            </h2>
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '500' }}>
              Showing {filteredTree.length} Hostels
            </span>
          </div>

          {filteredTree.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' }}>
                <Building2 size={28} />
              </div>
              <div style={{ fontWeight: '700', fontSize: '1.05rem', color: '#0f172a' }}>No hostel structures found</div>
              <p style={{ fontSize: '0.85rem', marginTop: '4px' }}>
                {searchQuery ? 'No elements match your search filter.' : 'This college does not have any physical hostels defined yet.'}
              </p>
              {!searchQuery && !policy?.is_locked && (
                <button
                  className="btn-enterprise btn-primary-blue btn-sm"
                  onClick={() => openEntityModal('HOSTEL', 'CREATE')}
                  style={{ marginTop: '12px' }}
                >
                  <Plus size={14} /> Add First Hostel
                </button>
              )}
            </div>
          ) : (
            <div className="structure-tree">
              {filteredTree.map((hostel) => {
                const hExpanded = expandedNodes[`hostel-${hostel.id}`];
                return (
                  <div key={hostel.id} className="hostel-tree-card">
                    {/* Hostel Node Row */}
                    <div
                      className="hostel-node-header"
                      onClick={() => toggleExpand(`hostel-${hostel.id}`)}
                    >
                      <div className="hostel-node-title-cluster">
                        <span className="hostel-node-chevron">
                          {hExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </span>
                        <div className="hostel-node-icon">
                          <Building2 size={16} />
                        </div>
                        <strong className="hostel-node-name">{hostel.name}</strong>
                        <span className="hostel-node-code">{hostel.code}</span>
                        <span className={`badge-category-${hostel.category?.toLowerCase() || 'boys'}`}>
                          {hostel.category}
                        </span>
                        <span className={hostel.status === 'ACTIVE' ? 'badge-status-active' : 'badge-status-inactive'}>
                          {hostel.status}
                        </span>
                        {hostel.is_locked && (
                          <span className="badge-status-locked">
                            <Lock size={11} /> Locked
                          </span>
                        )}
                      </div>

                      <div className="hostel-action-cluster" onClick={(e) => e.stopPropagation()}>
                        <span className="hostel-occ-pill">
                          Cap: <strong>{hostel.total_capacity}</strong> | Occ: <strong>{hostel.occupied_beds}</strong>
                        </span>
                        <button
                          className="btn-enterprise btn-outline-soft btn-sm"
                          onClick={() => openEntityModal('BLOCK', 'CREATE', null, hostel)}
                          disabled={policy?.is_locked || hostel.is_locked}
                          title="Add a block to this hostel"
                        >
                          <Plus size={12} /> Block
                        </button>
                        <button
                          className="btn-enterprise btn-outline-soft btn-sm"
                          onClick={() => setSelectedEntity({ type: 'Hostel', data: hostel })}
                        >
                          Details
                        </button>
                        <button
                          className="btn-icon-action"
                          onClick={() => openEntityModal('HOSTEL', 'EDIT', hostel)}
                          disabled={policy?.is_locked || hostel.is_locked}
                          title="Edit Hostel"
                        >
                          <Edit3 size={13} />
                        </button>
                        <button
                          className="btn-icon-action danger"
                          onClick={() => handleDeleteEntity('Hostel', hostel.id, hostel.name)}
                          disabled={policy?.is_locked || hostel.is_locked}
                          title="Delete Hostel"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Blocks Container */}
                    {hExpanded && (
                      <div style={{ padding: '8px 14px 14px 28px', backgroundColor: '#ffffff' }}>
                        {(hostel.blocks || []).length === 0 ? (
                          <div style={{ color: '#64748b', fontSize: '0.85rem', padding: '10px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>No blocks or wings defined yet.</span>
                            <button
                              className="btn-enterprise btn-outline-soft btn-sm"
                              onClick={() => openEntityModal('BLOCK', 'CREATE', null, hostel)}
                              disabled={policy?.is_locked || hostel.is_locked}
                            >
                              <Plus size={12} /> Add Block
                            </button>
                          </div>
                        ) : (
                          hostel.blocks.map((block) => {
                            const bID = block.ID || block.id;
                            const bExpanded = expandedNodes[`block-${bID}`];
                            return (
                              <div key={bID} className="block-node-item">
                                {/* Block Header Row */}
                                {!hideOptionalBlocks && (
                                  <div
                                    className="block-node-header"
                                    onClick={() => toggleExpand(`block-${bID}`)}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <span style={{ color: '#64748b', display: 'flex' }}>
                                        {bExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                      </span>
                                      <Layers size={15} className="text-slate-500" />
                                      <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>{block.name}</strong>
                                      <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#64748b' }}>({block.code})</span>
                                      <span className={block.status === 'ACTIVE' ? 'badge-status-active' : 'badge-status-inactive'} style={{ fontSize: '0.65rem' }}>
                                        {block.status}
                                      </span>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
                                      <button
                                        className="btn-enterprise btn-outline-soft btn-sm"
                                        onClick={() => openEntityModal('FLOOR', 'CREATE', null, block)}
                                        disabled={policy?.is_locked || hostel.is_locked}
                                        title="Add floor to block"
                                      >
                                        <Plus size={12} /> Floor
                                      </button>
                                      <button
                                        className="btn-icon-action"
                                        onClick={() => openEntityModal('BLOCK', 'EDIT', block)}
                                        disabled={policy?.is_locked || hostel.is_locked}
                                        title="Edit Block"
                                      >
                                        <Edit3 size={13} />
                                      </button>
                                      <button
                                        className="btn-icon-action danger"
                                        onClick={() => handleDeleteEntity('Block', bID, block.name)}
                                        disabled={policy?.is_locked || hostel.is_locked}
                                        title="Delete Block"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  </div>
                                )}

                                {/* Floors Container */}
                                {(bExpanded || hideOptionalBlocks) && (
                                  <div style={{ paddingLeft: hideOptionalBlocks ? '0px' : '16px', marginTop: '6px' }}>
                                    {(block.floors || []).length === 0 ? (
                                      <div style={{ color: '#64748b', fontSize: '0.8rem', padding: '6px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span>No floors on this block.</span>
                                        <button
                                          className="btn-enterprise btn-outline-soft btn-sm"
                                          onClick={() => openEntityModal('FLOOR', 'CREATE', null, block)}
                                          disabled={policy?.is_locked || hostel.is_locked}
                                        >
                                          <Plus size={11} /> Add Floor
                                        </button>
                                      </div>
                                    ) : (
                                      block.floors.map((floor) => {
                                        const fExpanded = expandedNodes[`floor-${floor.id}`];
                                        return (
                                          <div key={floor.id} className="floor-node-item">
                                            {/* Floor Node Row */}
                                            <div
                                              className="floor-node-header"
                                              onClick={() => toggleExpand(`floor-${floor.id}`)}
                                            >
                                              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                                                <span style={{ color: '#94a3b8', display: 'flex' }}>
                                                  {fExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                                </span>
                                                <AlignJustify size={14} className="text-slate-500" />
                                                <span style={{ fontSize: '0.86rem', fontWeight: '600', color: '#0f172a' }}>{floor.name}</span>
                                                <span style={{ fontSize: '0.74rem', color: '#64748b' }}>(Floor #{floor.floor_number})</span>
                                                <span className="hostel-occ-pill" style={{ padding: '1px 6px', fontSize: '0.7rem' }}>
                                                  {floor.rooms?.length || 0} rooms
                                                </span>
                                              </div>

                                              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }} onClick={(e) => e.stopPropagation()}>
                                                <button
                                                  className="btn-enterprise btn-outline-soft btn-sm"
                                                  onClick={() => openEntityModal('ROOM', 'CREATE', null, floor)}
                                                  disabled={policy?.is_locked || hostel.is_locked}
                                                >
                                                  <Plus size={11} /> Room
                                                </button>
                                                <button
                                                  className="btn-icon-action"
                                                  onClick={() => openEntityModal('FLOOR', 'EDIT', floor)}
                                                  disabled={policy?.is_locked || hostel.is_locked}
                                                  title="Edit Floor"
                                                >
                                                  <Edit3 size={12} />
                                                </button>
                                                <button
                                                  className="btn-icon-action danger"
                                                  onClick={() => handleDeleteEntity('Floor', floor.id, floor.name)}
                                                  disabled={policy?.is_locked || hostel.is_locked}
                                                  title="Delete Floor"
                                                >
                                                  <Trash2 size={12} />
                                                </button>
                                              </div>
                                            </div>

                                            {/* Rooms Grid */}
                                            {fExpanded && (
                                              <div className="rooms-grid-container">
                                                {(floor.rooms || []).length === 0 ? (
                                                  <div style={{ color: '#64748b', fontSize: '0.75rem', gridColumn: '1 / -1', padding: '6px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span>No rooms yet.</span>
                                                    <button
                                                      className="btn-enterprise btn-outline-soft btn-sm"
                                                      onClick={() => openEntityModal('ROOM', 'CREATE', null, floor)}
                                                      disabled={policy?.is_locked || hostel.is_locked}
                                                    >
                                                      <Plus size={11} /> Add Room
                                                    </button>
                                                  </div>
                                                ) : (
                                                  floor.rooms.map((room) => {
                                                    const isFull = room.occupied_beds >= room.capacity && room.capacity > 0;
                                                    const isPartial = room.occupied_beds > 0 && room.occupied_beds < room.capacity;
                                                    const isSelected = selectedEntity?.data?.id === room.id;
                                                    return (
                                                      <div
                                                        key={room.id}
                                                        className={`room-card-item ${isSelected ? 'selected' : ''} ${isFull ? 'is-full' : ''}`}
                                                        onClick={() => setSelectedEntity({ type: 'Room', data: room, parent: floor })}
                                                      >
                                                        <div className="room-card-top">
                                                          <div className="room-card-title">
                                                            <DoorOpen size={14} className="text-slate-500" />
                                                            <span>{room.name}</span>
                                                          </div>
                                                          <span className="badge-category-boys" style={{ fontSize: '0.65rem' }}>{room.room_type}</span>
                                                        </div>

                                                        <div className="room-card-meta">
                                                          <span style={{ color: '#64748b' }}>
                                                            Cap: <strong style={{ color: '#0f172a' }}>{room.capacity}</strong>
                                                          </span>
                                                          <span>
                                                            {room.occupied_beds > 0 ? (
                                                              <span style={{ color: '#ea580c', fontWeight: 'bold' }}>{room.occupied_beds} Occ</span>
                                                            ) : (
                                                              <span style={{ color: '#059669', fontWeight: '600' }}>Vacant</span>
                                                            )}
                                                          </span>
                                                        </div>

                                                        {/* Bed Chips Preview */}
                                                        <div className="room-beds-cluster">
                                                          {(room.beds || []).map((bed) => (
                                                            <span
                                                              key={bed.id}
                                                              className={`bed-chip-badge ${bed.is_occupied ? 'occupied' : 'available'}`}
                                                              title={`${bed.code} - ${bed.status}`}
                                                            >
                                                              <Bed size={10} /> {bed.code}
                                                            </span>
                                                          ))}
                                                        </div>
                                                      </div>
                                                    );
                                                  })
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Entity Details Drawer */}
        {selectedEntity && (
          <div className="hostel-drawer-panel">
            <div className="hostel-drawer-header">
              <div className="hostel-drawer-title">
                {selectedEntity.type === 'Hostel' ? <Building2 size={18} className="text-blue-600" /> : selectedEntity.type === 'Room' ? <DoorOpen size={18} className="text-emerald-600" /> : <Bed size={18} className="text-indigo-600" />}
                <span>{selectedEntity.type} Details</span>
              </div>
              <button
                className="btn-icon-action"
                onClick={() => setSelectedEntity(null)}
                title="Close Drawer"
              >
                <X size={14} />
              </button>
            </div>

            <div style={{ fontSize: '0.85rem' }}>
              <div style={{ marginBottom: '12px' }}>
                <div style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: '600', textTransform: 'uppercase' }}>Name / Label</div>
                <div style={{ fontWeight: '700', fontSize: '1.05rem', color: '#0f172a', marginTop: '2px' }}>{selectedEntity.data.name}</div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <div style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: '600', textTransform: 'uppercase' }}>Code</div>
                <div style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#334155', marginTop: '2px' }}>{selectedEntity.data.code}</div>
              </div>

              {selectedEntity.type === 'Room' && (
                <>
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: '600', textTransform: 'uppercase' }}>Room Type</div>
                    <div style={{ marginTop: '4px' }}><span className="badge-category-boys">{selectedEntity.data.room_type}</span></div>
                  </div>

                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: '600', textTransform: 'uppercase' }}>Capacity & Occupancy</div>
                    <div style={{ color: '#334155', marginTop: '2px' }}>
                      Capacity: <strong>{selectedEntity.data.capacity}</strong> | Occupied: <strong>{selectedEntity.data.occupied_beds || 0}</strong>
                    </div>
                  </div>

                  <div style={{ marginTop: '16px', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>Beds in Room ({selectedEntity.data.beds?.length || 0})</strong>
                      <button
                        className="btn-enterprise btn-outline-soft btn-sm"
                        onClick={() => openEntityModal('BED', 'CREATE', null, selectedEntity.data)}
                        disabled={policy?.is_locked}
                      >
                        <Plus size={11} /> Bed
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {(selectedEntity.data.beds || []).length === 0 ? (
                        <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>No individual bed records created yet.</span>
                      ) : (
                        selectedEntity.data.beds.map((b) => (
                          <div
                            key={b.id}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '6px 10px',
                              backgroundColor: '#f8fafc',
                              borderRadius: '6px',
                              border: '1px solid #e2e8f0',
                            }}
                          >
                            <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <Bed size={12} className="text-slate-500" /> {b.code}
                            </span>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              <span className={b.is_occupied ? 'badge-status-inactive' : 'badge-status-active'} style={{ fontSize: '0.65rem' }}>
                                {b.is_occupied ? 'Occupied' : b.status}
                              </span>
                              <button
                                className="btn-icon-action"
                                style={{ width: '22px', height: '22px' }}
                                onClick={() => openEntityModal('BED', 'EDIT', b, selectedEntity.data)}
                                disabled={policy?.is_locked}
                                title="Edit Bed"
                              >
                                <Edit3 size={11} />
                              </button>
                              <button
                                className="btn-icon-action danger"
                                style={{ width: '22px', height: '22px' }}
                                onClick={() => handleDeleteEntity('Bed', b.id, b.code)}
                                disabled={policy?.is_locked}
                                title="Delete Bed"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Actions Footer */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '16px', borderTop: '1px solid #f1f5f9', paddingTop: '14px' }}>
                <button
                  className="btn-enterprise btn-outline-soft btn-sm"
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => openEntityModal(selectedEntity.type.toUpperCase(), 'EDIT', selectedEntity.data, selectedEntity.parent)}
                  disabled={policy?.is_locked}
                >
                  <Edit3 size={13} /> Edit
                </button>
                <button
                  className="btn-enterprise btn-outline-soft btn-sm"
                  style={{ flex: 1, justifyContent: 'center', color: '#dc2626' }}
                  onClick={() => handleDeleteEntity(selectedEntity.type, selectedEntity.data.id, selectedEntity.data.name || selectedEntity.data.code)}
                  disabled={policy?.is_locked}
                >
                  <Trash2 size={13} /> Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODALS */}
      {/* ========================================================================= */}

      {/* 1. HOSTEL MODAL */}
      {modalType === 'HOSTEL' && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>{modalMode === 'CREATE' ? 'Add New Hostel Facility' : 'Edit Hostel Facility'}</h3>
              <button className="btn btn-outline btn-sm" onClick={() => setModalType(null)}>✕</button>
            </div>
            <form onSubmit={handleEntitySubmit}>
              <div className="modal-body">
                {formError && <div className="alert alert-danger" style={{ marginBottom: '12px' }}>{formError}</div>}
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label">Hostel Code *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. BOYS_H1"
                    value={hostelForm.code}
                    onChange={(e) => setHostelForm({ ...hostelForm, code: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label">Hostel Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Kaveri Boys Hostel"
                    value={hostelForm.name}
                    onChange={(e) => setHostelForm({ ...hostelForm, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label">Category *</label>
                  <select
                    className="form-control"
                    value={hostelForm.category}
                    onChange={(e) => setHostelForm({ ...hostelForm, category: e.target.value })}
                  >
                    <option value="BOYS">BOYS</option>
                    <option value="GIRLS">GIRLS</option>
                    <option value="MIXED">MIXED</option>
                    <option value="OTHER">OTHER</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label">Status *</label>
                  <select
                    className="form-control"
                    value={hostelForm.status}
                    onChange={(e) => setHostelForm({ ...hostelForm, status: e.target.value })}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                    <option value="MAINTENANCE">MAINTENANCE</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label">Address / Campus Zone</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. North Campus, Gate 2"
                    value={hostelForm.address}
                    onChange={(e) => setHostelForm({ ...hostelForm, address: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setModalType(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={formSubmitting}>
                  {formSubmitting ? 'Saving...' : modalMode === 'CREATE' ? 'Create Hostel' : 'Update Hostel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. BLOCK MODAL */}
      {modalType === 'BLOCK' && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h3>{modalMode === 'CREATE' ? 'Add Building / Block' : 'Edit Block'}</h3>
              <button className="btn btn-outline btn-sm" onClick={() => setModalType(null)}>✕</button>
            </div>
            <form onSubmit={handleEntitySubmit}>
              <div className="modal-body">
                {formError && <div className="alert alert-danger" style={{ marginBottom: '12px' }}>{formError}</div>}
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label">Block Code *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. BLK-A"
                    value={blockForm.code}
                    onChange={(e) => setBlockForm({ ...blockForm, code: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label">Block Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Block A (East Wing)"
                    value={blockForm.name}
                    onChange={(e) => setBlockForm({ ...blockForm, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label">Status *</label>
                  <select
                    className="form-control"
                    value={blockForm.status}
                    onChange={(e) => setBlockForm({ ...blockForm, status: e.target.value })}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                    <option value="MAINTENANCE">MAINTENANCE</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setModalType(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={formSubmitting}>
                  {formSubmitting ? 'Saving...' : modalMode === 'CREATE' ? 'Create Block' : 'Update Block'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. FLOOR MODAL */}
      {modalType === 'FLOOR' && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h3>{modalMode === 'CREATE' ? 'Add Floor' : 'Edit Floor'}</h3>
              <button className="btn btn-outline btn-sm" onClick={() => setModalType(null)}>✕</button>
            </div>
            <form onSubmit={handleEntitySubmit}>
              <div className="modal-body">
                {formError && <div className="alert alert-danger" style={{ marginBottom: '12px' }}>{formError}</div>}
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label">Floor Number *</label>
                  <input
                    type="number"
                    className="form-control"
                    min="0"
                    max="100"
                    value={floorForm.floor_number}
                    onChange={(e) => setFloorForm({ ...floorForm, floor_number: parseInt(e.target.value, 10) || 0 })}
                    required
                  />
                  <small style={{ color: 'var(--text-secondary)' }}>0 for Ground Floor, 1 for First Floor, etc.</small>
                </div>
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label">Floor Code *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. F1"
                    value={floorForm.code}
                    onChange={(e) => setFloorForm({ ...floorForm, code: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label">Floor Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. First Floor"
                    value={floorForm.name}
                    onChange={(e) => setFloorForm({ ...floorForm, name: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setModalType(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={formSubmitting}>
                  {formSubmitting ? 'Saving...' : 'Save Floor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. ROOM MODAL */}
      {modalType === 'ROOM' && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3>{modalMode === 'CREATE' ? 'Add Room' : 'Edit Room'}</h3>
              <button className="btn btn-outline btn-sm" onClick={() => setModalType(null)}>✕</button>
            </div>
            <form onSubmit={handleEntitySubmit}>
              <div className="modal-body">
                {formError && <div className="alert alert-danger" style={{ marginBottom: '12px' }}>{formError}</div>}
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label">Room Identifier / Number *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. 101"
                    value={roomForm.code}
                    onChange={(e) => setRoomForm({ ...roomForm, code: e.target.value, name: roomForm.name ? roomForm.name : `Room ${e.target.value}` })}
                    required
                  />
                </div>
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label">Room Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Room 101"
                    value={roomForm.name}
                    onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label">Room Type *</label>
                  <select
                    className="form-control"
                    value={roomForm.room_type}
                    onChange={(e) => setRoomForm({ ...roomForm, room_type: e.target.value })}
                  >
                    <option value="STANDARD">STANDARD</option>
                    <option value="SINGLE">SINGLE</option>
                    <option value="DOUBLE">DOUBLE</option>
                    <option value="TRIPLE">TRIPLE</option>
                    <option value="DORMITORY">DORMITORY</option>
                    <option value="SPECIAL">SPECIAL</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label">Capacity (Supported Beds) *</label>
                  <input
                    type="number"
                    className="form-control"
                    min="1"
                    max="20"
                    value={roomForm.capacity}
                    onChange={(e) => setRoomForm({ ...roomForm, capacity: parseInt(e.target.value, 10) || 1 })}
                    required
                  />
                </div>
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label">Status *</label>
                  <select
                    className="form-control"
                    value={roomForm.status}
                    onChange={(e) => setRoomForm({ ...roomForm, status: e.target.value })}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                    <option value="MAINTENANCE">MAINTENANCE</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setModalType(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={formSubmitting}>
                  {formSubmitting ? 'Saving...' : 'Save Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. BED MODAL */}
      {modalType === 'BED' && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h3>{modalMode === 'CREATE' ? 'Add Physical Bed' : 'Edit Bed'}</h3>
              <button className="btn btn-outline btn-sm" onClick={() => setModalType(null)}>✕</button>
            </div>
            <form onSubmit={handleEntitySubmit}>
              <div className="modal-body">
                {formError && <div className="alert alert-danger" style={{ marginBottom: '12px' }}>{formError}</div>}
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label">Bed Code *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. 101-A"
                    value={bedForm.code}
                    onChange={(e) => setBedForm({ ...bedForm, code: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label">Bed Label / Name</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Bed A (Window side)"
                    value={bedForm.name}
                    onChange={(e) => setBedForm({ ...bedForm, name: e.target.value })}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label">Status *</label>
                  <select
                    className="form-control"
                    value={bedForm.status}
                    onChange={(e) => setBedForm({ ...bedForm, status: e.target.value })}
                  >
                    <option value="AVAILABLE">AVAILABLE</option>
                    <option value="RESERVED">RESERVED</option>
                    <option value="MAINTENANCE">MAINTENANCE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setModalType(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={formSubmitting}>
                  {formSubmitting ? 'Saving...' : 'Save Bed'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. BULK GENERATION WIZARD MODAL */}
      {modalType === 'BULK' && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <h3>⚡ Procedural Structure Generation Wizard</h3>
              <button className="btn btn-outline btn-sm" onClick={() => setModalType(null)}>✕</button>
            </div>

            {bulkStep === 1 ? (
              <form onSubmit={handleBulkPreview}>
                <div className="modal-body">
                  {formError && <div className="alert alert-danger" style={{ marginBottom: '12px' }}>{formError}</div>}
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                    Generate uniform physical floors, rooms, and optional beds atomically in seconds.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="form-group">
                      <label className="form-label">Target Hostel *</label>
                      <select
                        className="form-control"
                        value={bulkInput.hostel_id}
                        onChange={(e) => setBulkInput({ ...bulkInput, hostel_id: e.target.value })}
                        required
                      >
                        {tree.map((h) => (
                          <option key={h.id} value={h.id}>{h.name} ({h.code})</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Block / Wing Name</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. Main Block or Block A"
                        value={bulkInput.block_name}
                        onChange={(e) => setBulkInput({ ...bulkInput, block_name: e.target.value })}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Number of Floors *</label>
                      <input
                        type="number"
                        className="form-control"
                        min="1"
                        max="20"
                        value={bulkInput.floor_count}
                        onChange={(e) => setBulkInput({ ...bulkInput, floor_count: parseInt(e.target.value, 10) || 1 })}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Starting Floor Number *</label>
                      <input
                        type="number"
                        className="form-control"
                        min="0"
                        max="10"
                        value={bulkInput.starting_floor}
                        onChange={(e) => setBulkInput({ ...bulkInput, starting_floor: parseInt(e.target.value, 10) || 0 })}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Rooms Per Floor *</label>
                      <input
                        type="number"
                        className="form-control"
                        min="1"
                        max="50"
                        value={bulkInput.rooms_per_floor}
                        onChange={(e) => setBulkInput({ ...bulkInput, rooms_per_floor: parseInt(e.target.value, 10) || 1 })}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Room Type *</label>
                      <select
                        className="form-control"
                        value={bulkInput.room_type}
                        onChange={(e) => setBulkInput({ ...bulkInput, room_type: e.target.value })}
                      >
                        <option value="STANDARD">STANDARD</option>
                        <option value="SINGLE">SINGLE</option>
                        <option value="DOUBLE">DOUBLE</option>
                        <option value="TRIPLE">TRIPLE</option>
                        <option value="DORMITORY">DORMITORY</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Capacity Per Room *</label>
                      <input
                        type="number"
                        className="form-control"
                        min="1"
                        max="10"
                        value={bulkInput.room_capacity}
                        onChange={(e) => setBulkInput({ ...bulkInput, room_capacity: parseInt(e.target.value, 10) || 1 })}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Bed Naming Suffix</label>
                      <select
                        className="form-control"
                        value={bulkInput.bed_naming_pattern}
                        onChange={(e) => setBulkInput({ ...bulkInput, bed_naming_pattern: e.target.value })}
                      >
                        <option value="ALPHA">Alphabetical (A, B, C...)</option>
                        <option value="NUMERIC">Numeric (1, 2, 3...)</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ marginTop: '14px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={bulkInput.generate_beds}
                        onChange={(e) => setBulkInput({ ...bulkInput, generate_beds: e.target.checked })}
                      />
                      <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>
                        Automatically create individual bed records matching room capacity
                      </span>
                    </label>
                  </div>
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn btn-outline" onClick={() => setModalType(null)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={formSubmitting}>
                    {formSubmitting ? 'Validating...' : 'Next: Preview Generation →'}
                  </button>
                </div>
              </form>
            ) : (
              <div>
                <div className="modal-body">
                  {formError && <div className="alert alert-danger" style={{ marginBottom: '12px' }}>{formError}</div>}
                  <div style={{ backgroundColor: '#eff6ff', padding: '14px', borderRadius: '8px', border: '1px solid #bfdbfe', marginBottom: '16px' }}>
                    <h4 style={{ margin: '0 0 8px 0', color: '#1e40af', fontSize: '0.95rem' }}>Generation Summary & Preview</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', textAlign: 'center' }}>
                      <div style={{ background: '#fff', padding: '8px', borderRadius: '4px' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Floors</div>
                        <strong style={{ fontSize: '1.1rem' }}>{bulkPreview?.floors_to_create}</strong>
                      </div>
                      <div style={{ background: '#fff', padding: '8px', borderRadius: '4px' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Rooms</div>
                        <strong style={{ fontSize: '1.1rem' }}>{bulkPreview?.rooms_to_create}</strong>
                      </div>
                      <div style={{ background: '#fff', padding: '8px', borderRadius: '4px' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total Beds</div>
                        <strong style={{ fontSize: '1.1rem' }}>{bulkPreview?.beds_to_create}</strong>
                      </div>
                    </div>
                  </div>

                  <div>
                    <strong style={{ fontSize: '0.85rem' }}>Sample Generated Room Identifiers:</strong>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px', marginBottom: '12px' }}>
                      {(bulkPreview?.sample_room_codes || []).map((code) => (
                        <span key={code} className="badge badge-info" style={{ fontSize: '0.75rem' }}>🚪 {code}</span>
                      ))}
                    </div>

                    {bulkInput.generate_beds && (
                      <>
                        <strong style={{ fontSize: '0.85rem' }}>Sample Generated Bed Identifiers:</strong>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                          {(bulkPreview?.sample_bed_codes || []).map((code) => (
                            <span key={code} className="badge badge-success" style={{ fontSize: '0.75rem' }}>🛏️ {code}</span>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn btn-outline" onClick={() => setBulkStep(1)}>← Back</button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleBulkGenerateConfirm}
                    disabled={formSubmitting}
                  >
                    {formSubmitting ? 'Generating...' : '✓ Confirm & Generate Structure'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 7. CSV IMPORT MODAL */}
      {modalType === 'CSV' && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '680px' }}>
            <div className="modal-header">
              <h3>📁 Import Physical Structure from CSV</h3>
              <button className="btn btn-outline btn-sm" onClick={() => setModalType(null)}>✕</button>
            </div>
            <div className="modal-body">
              {formError && <div className="alert alert-danger" style={{ marginBottom: '12px' }}>{formError}</div>}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Upload a structured CSV file with hostel facilities, rooms, and beds.
                </span>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={handleDownloadTemplate}
                >
                  📥 Download CSV Template
                </button>
              </div>

              <div
                style={{
                  border: '2px dashed var(--border-color)',
                  borderRadius: '8px',
                  padding: '24px',
                  textAlign: 'center',
                  marginBottom: '16px',
                  backgroundColor: '#f8fafc',
                }}
              >
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCSVFileChange}
                  style={{ display: 'none' }}
                  id="csv-file-input"
                />
                <label htmlFor="csv-file-input" className="btn btn-outline btn-sm" style={{ cursor: 'pointer', marginBottom: '8px' }}>
                  Choose CSV File...
                </label>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {csvFile ? `Selected: ${csvFile.name} (${(csvFile.size / 1024).toFixed(1)} KB)` : 'No file chosen yet'}
                </div>
                {csvFile && (
                  <button
                    className="btn btn-primary btn-sm"
                    style={{ marginTop: '12px' }}
                    onClick={handleCSVValidate}
                    disabled={csvValidating}
                  >
                    {csvValidating ? 'Validating...' : '🔍 Validate File'}
                  </button>
                )}
              </div>

              {/* Validation Results */}
              {csvResult && (
                <div style={{ marginTop: '14px' }}>
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: '6px',
                      backgroundColor: csvResult.is_valid ? '#ecfdf5' : '#fef2f2',
                      border: `1px solid ${csvResult.is_valid ? '#a7f3d0' : '#fecaca'}`,
                      color: csvResult.is_valid ? '#065f46' : '#991b1b',
                      marginBottom: '12px',
                    }}
                  >
                    <strong>{csvResult.is_valid ? '✓ Validation Passed' : '⚠️ Validation Failed with Errors'}</strong>
                    <div style={{ fontSize: '0.85rem', marginTop: '4px' }}>
                      Found {csvResult.valid_rows_count} valid rows ({csvResult.hostels_count} Hostels, {csvResult.rooms_count} Rooms, {csvResult.beds_count} Beds).
                    </div>
                  </div>

                  {!csvResult.is_valid && csvResult.errors && (
                    <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px' }}>
                      <table className="table" style={{ fontSize: '0.75rem', margin: 0 }}>
                        <thead>
                          <tr>
                            <th>Row</th>
                            <th>Field</th>
                            <th>Error Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          {csvResult.errors.map((err, i) => (
                            <tr key={i}>
                              <td>{err.row_number}</td>
                              <td><strong>{err.field}</strong></td>
                              <td>{err.message}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-outline" onClick={() => setModalType(null)}>Cancel</button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCSVImportApply}
                disabled={formSubmitting || !csvResult || !csvResult.is_valid}
              >
                {formSubmitting ? 'Importing...' : 'Apply & Save to Structure'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. CLONE STRUCTURE MODAL */}
      {modalType === 'CLONE' && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h3>🧬 Clone Hostel Structure</h3>
              <button className="btn btn-outline btn-sm" onClick={() => setModalType(null)}>✕</button>
            </div>
            <form onSubmit={handleClonePreview}>
              <div className="modal-body">
                {formError && <div className="alert alert-danger" style={{ marginBottom: '12px' }}>{formError}</div>}
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                  Clone an existing physical hostel facility into a new one with clean capacity. Student allocations and personal data are strictly excluded.
                </p>

                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label">Source Hostel *</label>
                  <select
                    className="form-control"
                    value={cloneInput.source_hostel_id}
                    onChange={(e) => setCloneInput({ ...cloneInput, source_hostel_id: e.target.value })}
                    required
                  >
                    {tree.map((h) => (
                      <option key={h.id} value={h.id}>{h.name} ({h.code})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label">New Hostel Code *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. BOYS_H2"
                    value={cloneInput.new_hostel_code}
                    onChange={(e) => setCloneInput({ ...cloneInput, new_hostel_code: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label">New Hostel Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Kaveri Boys Hostel Phase 2"
                    value={cloneInput.new_hostel_name}
                    onChange={(e) => setCloneInput({ ...cloneInput, new_hostel_name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label">Category</label>
                  <select
                    className="form-control"
                    value={cloneInput.new_category}
                    onChange={(e) => setCloneInput({ ...cloneInput, new_category: e.target.value })}
                  >
                    <option value="BOYS">BOYS</option>
                    <option value="GIRLS">GIRLS</option>
                    <option value="MIXED">MIXED</option>
                    <option value="OTHER">OTHER</option>
                  </select>
                </div>

                {clonePreview && (
                  <div style={{ backgroundColor: '#eff6ff', padding: '12px', borderRadius: '6px', border: '1px solid #bfdbfe', marginTop: '14px' }}>
                    <strong>Clone Preview:</strong>
                    <div style={{ fontSize: '0.85rem', marginTop: '4px' }}>
                      Will replicate {clonePreview.blocks_to_clone} blocks, {clonePreview.floors_to_clone} floors, {clonePreview.rooms_to_clone} rooms, and {clonePreview.beds_to_clone} beds ({clonePreview.total_capacity} capacity).
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setModalType(null)}>Cancel</button>
                {!clonePreview ? (
                  <button type="submit" className="btn btn-primary" disabled={formSubmitting}>
                    {formSubmitting ? 'Calculating...' : 'Preview Clone →'}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleCloneApply}
                    disabled={formSubmitting}
                  >
                    {formSubmitting ? 'Cloning...' : '✓ Confirm & Create Cloned Hostel'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 9. POLICY & LOCK CONFIGURATION MODAL */}
      {modalType === 'POLICY' && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h3>⚙️ College Structure Edit Policy & Lock</h3>
              <button className="btn btn-outline btn-sm" onClick={() => setModalType(null)}>✕</button>
            </div>
            <form onSubmit={handlePolicySave}>
              <div className="modal-body">
                {formError && <div className="alert alert-danger" style={{ marginBottom: '12px' }}>{formError}</div>}
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                  Define which structural changes are permitted for this tenant. Enforced on both backend API calls and frontend UI.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={policyForm.is_locked}
                      onChange={(e) => setPolicyForm({ ...policyForm, is_locked: e.target.checked })}
                    />
                    <div>
                      <strong>🔒 Master Structure Lock</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        When enabled, all structural create, update, and delete actions are blocked.
                      </div>
                    </div>
                  </label>

                  {policyForm.is_locked && (
                    <div className="form-group" style={{ paddingLeft: '24px' }}>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>Lock Justification / Reason</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. Allocation semester lock"
                        value={policyForm.lock_reason}
                        onChange={(e) => setPolicyForm({ ...policyForm, lock_reason: e.target.value })}
                      />
                    </div>
                  )}

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={policyForm.allow_bulk_generation}
                      onChange={(e) => setPolicyForm({ ...policyForm, allow_bulk_generation: e.target.checked })}
                    />
                    <div>
                      <strong>Allow Procedural Bulk Generation</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        Enable multi-floor procedural structure creation wizard.
                      </div>
                    </div>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={policyForm.allow_csv_import}
                      onChange={(e) => setPolicyForm({ ...policyForm, allow_csv_import: e.target.checked })}
                    />
                    <div>
                      <strong>Allow CSV Structure Import</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        Permit mass creation via CSV upload.
                      </div>
                    </div>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={policyForm.allow_cloning}
                      onChange={(e) => setPolicyForm({ ...policyForm, allow_cloning: e.target.checked })}
                    />
                    <div>
                      <strong>Allow Hostel Cloning</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        Permit duplicating existing hostel structures into new facilities.
                      </div>
                    </div>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={policyForm.prevent_occupied_modification}
                      onChange={(e) => setPolicyForm({ ...policyForm, prevent_occupied_modification: e.target.checked })}
                    />
                    <div>
                      <strong>Prevent Occupied Room Capacity Reduction</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        Prevent setting capacity below currently active student bed allocations.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setModalType(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={formSubmitting}>
                  {formSubmitting ? 'Saving...' : 'Save Policy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 10. AUDIT LOG MODAL */}
      {modalType === 'AUDIT' && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <h3>📜 Structure Audit History</h3>
              <button className="btn btn-outline btn-sm" onClick={() => setModalType(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '420px', overflowY: 'auto' }}>
              {audits.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                  No structural audit events recorded yet for this college.
                </div>
              ) : (
                <table className="table" style={{ fontSize: '0.8rem' }}>
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Action</th>
                      <th>Entity</th>
                      <th>Actor Role</th>
                      <th>Reason / Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audits.map((a, i) => (
                      <tr key={a.audit_id || i}>
                        <td>{new Date(a.created_at).toLocaleString()}</td>
                        <td><span className="badge badge-info">{a.action}</span></td>
                        <td>{a.entity_type}</td>
                        <td>{a.actor_role}</td>
                        <td>{a.reason || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline" onClick={() => setModalType(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
