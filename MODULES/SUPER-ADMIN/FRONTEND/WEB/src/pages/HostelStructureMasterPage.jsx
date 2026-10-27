import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
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

  if (loading && !college) {
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
    <div className="main-content" style={{ padding: '24px 32px' }}>
      {/* Breadcrumb Header */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
          <Link to="/colleges" style={{ color: 'var(--primary-color)', textDecoration: 'none' }}>Colleges</Link>
          {' > '}
          <Link to={`/colleges/${collegeId}`} style={{ color: 'var(--primary-color)', textDecoration: 'none' }}>
            {college?.name || 'College Details'}
          </Link>
          {' > '}
          <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>Hostel Structure Master</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span>🏰</span>
              <span>Hostel Structure Master</span>
              {policy?.is_locked ? (
                <span className="badge badge-danger" style={{ fontSize: '0.75rem', padding: '4px 10px' }}>🔒 Structure Locked</span>
              ) : (
                <span className="badge badge-success" style={{ fontSize: '0.75rem', padding: '4px 10px' }}>🔓 Structure Editable</span>
              )}
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: '4px 0 0 0' }}>
              Physical facilities, buildings, floors, rooms, and beds for <strong>{college?.name}</strong> ({college?.college_code})
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              className={`btn btn-sm ${policy?.is_locked ? 'btn-success' : 'btn-outline'}`}
              onClick={handleToggleLockQuick}
              title={policy?.is_locked ? 'Click to unlock structure' : 'Click to lock structure against edits'}
              id="btn-lock-toggle"
            >
              {policy?.is_locked ? '🔓 Unlock Structure' : '🔒 Lock Structure'}
            </button>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => setModalType('POLICY')}
              id="btn-policy-settings"
            >
              ⚙️ Edit Policy
            </button>
            <button
              className="btn btn-outline btn-sm"
              onClick={openAuditsModal}
              id="btn-audit-logs"
            >
              📜 Audit History
            </button>
            <Link to={`/colleges/${collegeId}`} className="btn btn-outline btn-sm">
              ← Back to College
            </Link>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {successNotice && (
        <div
          className="card"
          style={{
            marginBottom: '16px',
            backgroundColor: 'var(--success-bg, #ecfdf5)',
            borderColor: 'var(--success-border, #a7f3d0)',
            color: 'var(--success-text, #065f46)',
            padding: '12px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>✓ {successNotice}</span>
          <button className="btn btn-outline btn-sm" onClick={() => setSuccessNotice(null)} style={{ padding: '2px 8px' }}>✕</button>
        </div>
      )}

      {error && (
        <div
          className="card"
          style={{
            marginBottom: '16px',
            backgroundColor: '#fef2f2',
            borderColor: '#fecaca',
            color: '#991b1b',
            padding: '12px 16px',
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* Aggregate Occupancy & Physical Summary Metrics */}
      <div className="card" style={{ marginBottom: '24px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
          <div style={{ fontWeight: '700', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>📊</span>
            <span>Real Aggregate Occupancy & Physical Capacity Metrics</span>
            <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>Verified Live Data</span>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Physical capacity vs verified student bed allocations
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '14px', textAlign: 'center' }}>
          <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Hostels</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--primary-color)' }}>{overview?.total_hostels ?? 0}</div>
          </div>
          <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Blocks</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0284c7' }}>{overview?.total_blocks ?? 0}</div>
          </div>
          <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Floors</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#4f46e5' }}>{overview?.total_floors ?? 0}</div>
          </div>
          <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Active Rooms</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#16a34a' }}>{overview?.active_rooms ?? 0}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>of {overview?.total_rooms ?? 0} Total</div>
          </div>
          <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Vacant Rooms</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#059669' }}>{overview?.vacant_rooms ?? 0}</div>
          </div>
          <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Total Capacity</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#7c3aed' }}>{overview?.total_bed_capacity ?? 0}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{overview?.total_beds ?? 0} Beds Made</div>
          </div>
          <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Occupied Beds</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#ea580c' }}>{overview?.occupied_beds ?? 0}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{overview?.occupancy_percentage?.toFixed(1) ?? '0.0'}% Occupied</div>
          </div>
          <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Available Beds</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0d9488' }}>{overview?.available_beds ?? 0}</div>
          </div>
        </div>
      </div>

      {/* Main Structural Actions Bar */}
      <div className="card" style={{ marginBottom: '20px', padding: '14px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => openEntityModal('HOSTEL', 'CREATE')}
              disabled={policy?.is_locked}
              title={policy?.is_locked ? 'Locked by policy' : 'Create a new physical hostel facility'}
              id="btn-add-hostel"
            >
              + Add Hostel
            </button>
            <button
              className="btn btn-outline btn-sm"
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
              ⚡ Bulk Generate
            </button>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => {
                setCsvFile(null);
                setCsvResult(null);
                setModalType('CSV');
              }}
              disabled={policy?.is_locked || !policy?.allow_csv_import}
              title="Import physical structure via CSV"
              id="btn-csv-import"
            >
              📁 CSV Import
            </button>
            <button
              className="btn btn-outline btn-sm"
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
              🧬 Clone Structure
            </button>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer', margin: 0 }}>
              <input
                type="checkbox"
                checked={hideOptionalBlocks}
                onChange={(e) => setHideOptionalBlocks(e.target.checked)}
              />
              <span>Collapse Blocks (Direct Floor View)</span>
            </label>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => setAllExpanded(true)}
              title="Expand all tree nodes"
            >
              Expand All
            </button>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => setAllExpanded(false)}
              title="Collapse all tree nodes"
            >
              Collapse All
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div style={{ marginTop: '12px' }}>
          <input
            type="text"
            className="form-control"
            placeholder="🔍 Filter structure by hostel name, block code, floor number, room number (e.g. 101), or bed code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', fontSize: '0.9rem' }}
          />
        </div>
      </div>

      {/* Main Structural View (Split Tree + Details Drawer) */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedEntity ? '1fr 340px' : '1fr', gap: '20px' }}>
        {/* Tree View */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: '700', margin: 0 }}>
              Physical Hierarchy Browser
            </h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Showing {filteredTree.length} Hostels
            </span>
          </div>

          {filteredTree.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🏢</div>
              <div style={{ fontWeight: '600', fontSize: '1.05rem', color: 'var(--text-primary)' }}>No hostel structures found</div>
              <p style={{ fontSize: '0.85rem', marginTop: '4px' }}>
                {searchQuery ? 'No elements match your search filter.' : 'This college does not have any physical hostels defined yet.'}
              </p>
              {!searchQuery && !policy?.is_locked && (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => openEntityModal('HOSTEL', 'CREATE')}
                  style={{ marginTop: '12px' }}
                >
                  + Add First Hostel
                </button>
              )}
            </div>
          ) : (
            <div className="structure-tree" style={{ fontFamily: 'var(--font-sans, inherit)' }}>
              {filteredTree.map((hostel) => {
                const hExpanded = expandedNodes[`hostel-${hostel.id}`];
                return (
                  <div key={hostel.id} style={{ marginBottom: '14px', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                    {/* Hostel Node Row */}
                    <div
                      style={{
                        backgroundColor: '#f1f5f9',
                        padding: '10px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                      }}
                      onClick={() => toggleExpand(`hostel-${hostel.id}`)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{hExpanded ? '▼' : '▶'}</span>
                        <span style={{ fontSize: '1.1rem' }}>🏰</span>
                        <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>{hostel.name}</strong>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>({hostel.code})</span>
                        <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>{hostel.category}</span>
                        <span className={`badge ${hostel.status === 'ACTIVE' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.7rem' }}>
                          {hostel.status}
                        </span>
                        {hostel.is_locked && (
                          <span className="badge badge-danger" style={{ fontSize: '0.7rem' }}>🔒 Locked</span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginRight: '8px' }}>
                          Cap: <strong>{hostel.total_capacity}</strong> | Occ: <strong>{hostel.occupied_beds}</strong>
                        </span>
                        <button
                          className="btn btn-outline btn-sm"
                          style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                          onClick={() => openEntityModal('BLOCK', 'CREATE', null, hostel)}
                          disabled={policy?.is_locked || hostel.is_locked}
                          title="Add a block to this hostel"
                        >
                          + Block
                        </button>
                        <button
                          className="btn btn-outline btn-sm"
                          style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                          onClick={() => {
                            setSelectedEntity({ type: 'Hostel', data: hostel });
                          }}
                        >
                          Details
                        </button>
                        <button
                          className="btn btn-outline btn-sm"
                          style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                          onClick={() => openEntityModal('HOSTEL', 'EDIT', hostel)}
                          disabled={policy?.is_locked || hostel.is_locked}
                        >
                          ✏️
                        </button>
                        <button
                          className="btn btn-outline btn-sm"
                          style={{ padding: '2px 8px', fontSize: '0.75rem', color: 'var(--danger-color)' }}
                          onClick={() => handleDeleteEntity('Hostel', hostel.id, hostel.name)}
                          disabled={policy?.is_locked || hostel.is_locked}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    {/* Blocks Container */}
                    {hExpanded && (
                      <div style={{ padding: '8px 12px 12px 24px', backgroundColor: '#ffffff' }}>
                        {(hostel.blocks || []).length === 0 ? (
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', padding: '8px' }}>
                            No blocks or wings defined yet.{' '}
                            <button
                              className="btn btn-link btn-sm"
                              style={{ padding: 0 }}
                              onClick={() => openEntityModal('BLOCK', 'CREATE', null, hostel)}
                              disabled={policy?.is_locked || hostel.is_locked}
                            >
                              Add Block
                            </button>
                          </div>
                        ) : (
                          hostel.blocks.map((block) => {
                            const bID = block.ID || block.id;
                            const bExpanded = expandedNodes[`block-${bID}`];
                            return (
                              <div key={bID} style={{ marginTop: '8px', borderLeft: '3px solid #cbd5e1', paddingLeft: '12px' }}>
                                {/* Block Header Row (or transparent if collapsed) */}
                                {!hideOptionalBlocks && (
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      padding: '6px 10px',
                                      backgroundColor: '#f8fafc',
                                      borderRadius: '6px',
                                      cursor: 'pointer',
                                    }}
                                    onClick={() => toggleExpand(`block-${bID}`)}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{bExpanded ? '▼' : '▶'}</span>
                                      <span style={{ fontSize: '0.95rem' }}>🏢</span>
                                      <strong style={{ fontSize: '0.9rem' }}>{block.name}</strong>
                                      <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>({block.code})</span>
                                      <span className={`badge ${block.status === 'ACTIVE' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.65rem' }}>
                                        {block.status}
                                      </span>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
                                      <button
                                        className="btn btn-outline btn-sm"
                                        style={{ padding: '2px 6px', fontSize: '0.7rem' }}
                                        onClick={() => openEntityModal('FLOOR', 'CREATE', null, block)}
                                        disabled={policy?.is_locked || hostel.is_locked}
                                        title="Add floor to block"
                                      >
                                        + Floor
                                      </button>
                                      <button
                                        className="btn btn-outline btn-sm"
                                        style={{ padding: '2px 6px', fontSize: '0.7rem' }}
                                        onClick={() => openEntityModal('BLOCK', 'EDIT', block)}
                                        disabled={policy?.is_locked || hostel.is_locked}
                                      >
                                        ✏️
                                      </button>
                                      <button
                                        className="btn btn-outline btn-sm"
                                        style={{ padding: '2px 6px', fontSize: '0.7rem', color: 'var(--danger-color)' }}
                                        onClick={() => handleDeleteEntity('Block', bID, block.name)}
                                        disabled={policy?.is_locked || hostel.is_locked}
                                      >
                                        🗑️
                                      </button>
                                    </div>
                                  </div>
                                )}

                                {/* Floors Container */}
                                {(bExpanded || hideOptionalBlocks) && (
                                  <div style={{ paddingLeft: hideOptionalBlocks ? '0px' : '16px', marginTop: '6px' }}>
                                    {(block.floors || []).length === 0 ? (
                                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', padding: '6px 0' }}>
                                        No floors on this block.{' '}
                                        <button
                                          className="btn btn-link btn-sm"
                                          style={{ padding: 0 }}
                                          onClick={() => openEntityModal('FLOOR', 'CREATE', null, block)}
                                          disabled={policy?.is_locked || hostel.is_locked}
                                        >
                                          Add Floor
                                        </button>
                                      </div>
                                    ) : (
                                      block.floors.map((floor) => {
                                        const fExpanded = expandedNodes[`floor-${floor.id}`];
                                        return (
                                          <div key={floor.id} style={{ marginTop: '6px', borderLeft: '2px solid #e2e8f0', paddingLeft: '10px' }}>
                                            {/* Floor Node Row */}
                                            <div
                                              style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                padding: '4px 8px',
                                                cursor: 'pointer',
                                              }}
                                              onClick={() => toggleExpand(`floor-${floor.id}`)}
                                            >
                                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{fExpanded ? '▼' : '▶'}</span>
                                                <span>🪜</span>
                                                <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>{floor.name}</span>
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>(Floor #{floor.floor_number})</span>
                                                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>({floor.rooms?.length || 0} rooms)</span>
                                              </div>

                                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} onClick={(e) => e.stopPropagation()}>
                                                <button
                                                  className="btn btn-outline btn-sm"
                                                  style={{ padding: '1px 6px', fontSize: '0.7rem' }}
                                                  onClick={() => openEntityModal('ROOM', 'CREATE', null, floor)}
                                                  disabled={policy?.is_locked || hostel.is_locked}
                                                >
                                                  + Room
                                                </button>
                                                <button
                                                  className="btn btn-outline btn-sm"
                                                  style={{ padding: '1px 6px', fontSize: '0.7rem' }}
                                                  onClick={() => openEntityModal('FLOOR', 'EDIT', floor)}
                                                  disabled={policy?.is_locked || hostel.is_locked}
                                                >
                                                  ✏️
                                                </button>
                                                <button
                                                  className="btn btn-outline btn-sm"
                                                  style={{ padding: '1px 6px', fontSize: '0.7rem', color: 'var(--danger-color)' }}
                                                  onClick={() => handleDeleteEntity('Floor', floor.id, floor.name)}
                                                  disabled={policy?.is_locked || hostel.is_locked}
                                                >
                                                  🗑️
                                                </button>
                                              </div>
                                            </div>

                                            {/* Rooms Grid */}
                                            {fExpanded && (
                                              <div
                                                style={{
                                                  display: 'grid',
                                                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                                                  gap: '8px',
                                                  marginTop: '6px',
                                                  paddingLeft: '14px',
                                                  marginBottom: '10px',
                                                }}
                                              >
                                                {(floor.rooms || []).length === 0 ? (
                                                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', gridColumn: '1 / -1' }}>
                                                    No rooms yet.{' '}
                                                    <button
                                                      className="btn btn-link btn-sm"
                                                      style={{ padding: 0, fontSize: '0.75rem' }}
                                                      onClick={() => openEntityModal('ROOM', 'CREATE', null, floor)}
                                                      disabled={policy?.is_locked || hostel.is_locked}
                                                    >
                                                      Add Room
                                                    </button>
                                                  </div>
                                                ) : (
                                                  floor.rooms.map((room) => {
                                                    const isFull = room.occupied_beds >= room.capacity && room.capacity > 0;
                                                    const isPartial = room.occupied_beds > 0 && room.occupied_beds < room.capacity;
                                                    return (
                                                      <div
                                                        key={room.id}
                                                        style={{
                                                          backgroundColor: isFull ? '#fff7ed' : isPartial ? '#fefce8' : '#ffffff',
                                                          border: `1px solid ${selectedEntity?.data?.id === room.id ? 'var(--primary-color)' : '#e2e8f0'}`,
                                                          borderRadius: '6px',
                                                          padding: '8px 10px',
                                                          cursor: 'pointer',
                                                          transition: 'all 0.15s ease',
                                                        }}
                                                        onClick={() => setSelectedEntity({ type: 'Room', data: room, parent: floor })}
                                                      >
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <span>🚪</span>
                                                            <strong style={{ fontSize: '0.85rem' }}>{room.name}</strong>
                                                          </div>
                                                          <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>{room.room_type}</span>
                                                        </div>

                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', fontSize: '0.75rem' }}>
                                                          <span style={{ color: 'var(--text-secondary)' }}>
                                                            Cap: <strong>{room.capacity}</strong>
                                                          </span>
                                                          <span>
                                                            {room.occupied_beds > 0 ? (
                                                              <span style={{ color: '#ea580c', fontWeight: 'bold' }}>{room.occupied_beds} Occ</span>
                                                            ) : (
                                                              <span style={{ color: '#16a34a' }}>Vacant</span>
                                                            )}
                                                          </span>
                                                        </div>

                                                        {/* Bed Chips Preview */}
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                                                          {(room.beds || []).map((bed) => (
                                                            <span
                                                              key={bed.id}
                                                              className={`badge ${bed.is_occupied ? 'badge-warning' : bed.status === 'AVAILABLE' ? 'badge-success' : 'badge-secondary'}`}
                                                              style={{ fontSize: '0.65rem', padding: '2px 5px' }}
                                                              title={`${bed.code} - ${bed.status}`}
                                                            >
                                                              🛏️ {bed.code}
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
          <div className="card" style={{ padding: '18px', height: 'fit-content', position: 'sticky', top: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              <div style={{ fontWeight: '700', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>{selectedEntity.type === 'Hostel' ? '🏰' : selectedEntity.type === 'Room' ? '🚪' : '🛏️'}</span>
                <span>{selectedEntity.type} Details</span>
              </div>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setSelectedEntity(null)}
                style={{ padding: '2px 8px' }}
              >
                ✕
              </button>
            </div>

            <div style={{ fontSize: '0.85rem' }}>
              <div style={{ marginBottom: '10px' }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Name / Label</div>
                <div style={{ fontWeight: '700', fontSize: '1rem' }}>{selectedEntity.data.name}</div>
              </div>

              <div style={{ marginBottom: '10px' }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Code</div>
                <div style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{selectedEntity.data.code}</div>
              </div>

              {selectedEntity.type === 'Room' && (
                <>
                  <div style={{ marginBottom: '10px' }}>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Room Type</div>
                    <div><span className="badge badge-info">{selectedEntity.data.room_type}</span></div>
                  </div>

                  <div style={{ marginBottom: '10px' }}>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Capacity & Occupancy</div>
                    <div>Capacity: <strong>{selectedEntity.data.capacity}</strong> | Occupied: <strong>{selectedEntity.data.occupied_beds || 0}</strong></div>
                  </div>

                  <div style={{ marginTop: '14px', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <strong style={{ fontSize: '0.85rem' }}>Beds in Room ({selectedEntity.data.beds?.length || 0})</strong>
                      <button
                        className="btn btn-outline btn-sm"
                        style={{ padding: '2px 6px', fontSize: '0.75rem' }}
                        onClick={() => openEntityModal('BED', 'CREATE', null, selectedEntity.data)}
                        disabled={policy?.is_locked}
                      >
                        + Add Bed
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {(selectedEntity.data.beds || []).length === 0 ? (
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>No individual bed records created yet.</span>
                      ) : (
                        selectedEntity.data.beds.map((b) => (
                          <div
                            key={b.id}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '4px 8px',
                              backgroundColor: '#f8fafc',
                              borderRadius: '4px',
                              border: '1px solid #e2e8f0',
                            }}
                          >
                            <span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>🛏️ {b.code}</span>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              <span className={`badge ${b.is_occupied ? 'badge-warning' : b.status === 'AVAILABLE' ? 'badge-success' : 'badge-secondary'}`} style={{ fontSize: '0.65rem' }}>
                                {b.is_occupied ? 'Occupied' : b.status}
                              </span>
                              <button
                                className="btn btn-outline btn-sm"
                                style={{ padding: '1px 5px', fontSize: '0.65rem' }}
                                onClick={() => openEntityModal('BED', 'EDIT', b, selectedEntity.data)}
                                disabled={policy?.is_locked}
                              >
                                ✏️
                              </button>
                              <button
                                className="btn btn-outline btn-sm"
                                style={{ padding: '1px 5px', fontSize: '0.65rem', color: 'var(--danger-color)' }}
                                onClick={() => handleDeleteEntity('Bed', b.id, b.code)}
                                disabled={policy?.is_locked}
                              >
                                🗑️
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
              <div style={{ display: 'flex', gap: '8px', marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                <button
                  className="btn btn-outline btn-sm"
                  style={{ flex: 1 }}
                  onClick={() => openEntityModal(selectedEntity.type.toUpperCase(), 'EDIT', selectedEntity.data, selectedEntity.parent)}
                  disabled={policy?.is_locked}
                >
                  ✏️ Edit
                </button>
                <button
                  className="btn btn-outline btn-sm"
                  style={{ flex: 1, color: 'var(--danger-color)' }}
                  onClick={() => handleDeleteEntity(selectedEntity.type, selectedEntity.data.id, selectedEntity.data.name)}
                  disabled={policy?.is_locked}
                >
                  🗑️ Delete
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
