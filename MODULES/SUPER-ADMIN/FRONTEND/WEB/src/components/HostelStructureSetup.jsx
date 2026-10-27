import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchStructureOverview,
  fetchStructureTree,
  createHostel,
  updateHostel,
  deleteHostel,
  createBlock,
  deleteBlock,
  createFloor,
  deleteFloor,
  createRoom,
  deleteRoom,
  createBed,
  deleteBed,
  previewBulkGeneration,
  generateBulkStructure,
  downloadCSVTemplate,
  previewCSV,
  importCSV,
} from '../services/hostelStructureService';

const HOSTEL_CATEGORIES = [
  { value: 'BOYS', label: 'Boys Hostel' },
  { value: 'GIRLS', label: 'Girls Hostel' },
  { value: 'MIXED', label: 'Co-ed / Mixed Hostel' },
  { value: 'OTHER', label: 'Other / Specialized Accommodation' },
];

const ROOM_TYPES = [
  { value: 'STANDARD', label: 'Standard Room' },
  { value: 'SINGLE', label: 'Single Occupancy' },
  { value: 'DOUBLE', label: 'Double Occupancy' },
  { value: 'TRIPLE', label: 'Triple Occupancy' },
  { value: 'DORMITORY', label: 'Dormitory' },
  { value: 'SPECIAL', label: 'Special / Accessible Room' },
];

export default function HostelStructureSetup({ collegeId, onStructureChanged }) {
  const [overview, setOverview] = useState(null);
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  // Tree UI state
  const [expandedNodes, setExpandedNodes] = useState({});
  const [selectedEntity, setSelectedEntity] = useState(null);

  // Modals
  const [activeModal, setActiveModal] = useState(null); // 'HOSTEL', 'BLOCK', 'FLOOR', 'ROOM', 'BED', 'BULK', 'CSV'
  const [modalMode, setModalMode] = useState('CREATE'); // 'CREATE' | 'EDIT'
  const [targetParent, setTargetParent] = useState(null); // Parent object for child additions
  const [editItem, setEditItem] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState(null);

  // Forms
  const [hostelForm, setHostelForm] = useState({ code: '', name: '', category: 'BOYS', total_capacity: 0, status: 'ACTIVE', description: '' });
  const [blockForm, setBlockForm] = useState({ code: '', name: '', status: 'ACTIVE', description: '' });
  const [floorForm, setFloorForm] = useState({ code: '', name: '', floor_number: 1, status: 'ACTIVE', description: '' });
  const [roomForm, setRoomForm] = useState({ code: '', name: '', room_type: 'STANDARD', capacity: 2, status: 'ACTIVE', description: '' });
  const [bedForm, setBedForm] = useState({ code: '', name: '', status: 'AVAILABLE' });

  // Bulk Generation Form
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

  const reqIdRef = useRef(0);

  const loadStructureData = useCallback(async (isRefresh = false) => {
    if (!collegeId) return;
    const currentReq = ++reqIdRef.current;
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const [overviewData, treeData] = await Promise.all([
        fetchStructureOverview(collegeId),
        fetchStructureTree(collegeId),
      ]);

      if (reqIdRef.current !== currentReq) return;

      setOverview(overviewData);
      setTree(treeData || []);

      // Auto-expand top-level hostels by default
      if (Array.isArray(treeData) && treeData.length > 0) {
        setExpandedNodes((prev) => {
          const updated = { ...prev };
          treeData.forEach((h) => {
            if (updated[`hostel-${h.id}`] === undefined) {
              updated[`hostel-${h.id}`] = true;
            }
          });
          return updated;
        });
      }
    } catch (err) {
      if (reqIdRef.current !== currentReq) return;
      setError(err?.message || 'Failed to retrieve college hostel structure');
    } finally {
      if (reqIdRef.current === currentReq) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [collegeId]);

  useEffect(() => {
    loadStructureData();
  }, [loadStructureData]);

  // Handle data mutation trigger & readiness propagation
  const handleMutationSuccess = async (successMessage) => {
    setNotice(successMessage);
    setActiveModal(null);
    setEditItem(null);
    setTargetParent(null);
    setModalError(null);
    await loadStructureData(true);
    if (onStructureChanged) {
      onStructureChanged();
    }
    setTimeout(() => {
      setNotice(null);
    }, 6000);
  };

  const toggleNode = (nodeKey) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [nodeKey]: !prev[nodeKey],
    }));
  };

  // --- Modal Openers ---

  const openCreateHostel = () => {
    setHostelForm({
      code: `H-${(tree.length + 1).toString().padStart(2, '0')}`,
      name: '',
      category: 'BOYS',
      total_capacity: 0,
      status: 'ACTIVE',
      description: '',
    });
    setModalMode('CREATE');
    setModalError(null);
    setActiveModal('HOSTEL');
  };

  const openEditHostel = (h) => {
    setHostelForm({
      code: h.code || '',
      name: h.name || '',
      category: h.category || 'BOYS',
      total_capacity: h.total_capacity || 0,
      status: h.status || 'ACTIVE',
      description: h.description || '',
    });
    setEditItem(h);
    setModalMode('EDIT');
    setModalError(null);
    setActiveModal('HOSTEL');
  };

  const openCreateBlock = (hostel) => {
    setBlockForm({
      code: `BLK-${String.fromCharCode(65 + ((hostel.blocks || []).length % 26))}`,
      name: `Block ${String.fromCharCode(65 + ((hostel.blocks || []).length % 26))}`,
      status: 'ACTIVE',
      description: '',
    });
    setTargetParent({ type: 'HOSTEL', data: hostel });
    setModalMode('CREATE');
    setModalError(null);
    setActiveModal('BLOCK');
  };

  const openCreateFloor = (parent) => {
    // parent can be hostel or block
    const isBlock = parent.type === 'BLOCK';
    const floorCount = isBlock ? (parent.data.floors || []).length : 0;
    setFloorForm({
      code: `FL-${floorCount + 1}`,
      name: `Floor ${floorCount + 1}`,
      floor_number: floorCount + 1,
      status: 'ACTIVE',
      description: '',
    });
    setTargetParent(parent);
    setModalMode('CREATE');
    setModalError(null);
    setActiveModal('FLOOR');
  };

  const openCreateRoom = (floor, block, hostel) => {
    const roomCount = (floor.rooms || []).length;
    setRoomForm({
      code: `RM-${floor.floor_number || 1}${String(roomCount + 1).padStart(2, '0')}`,
      name: `Room ${floor.floor_number || 1}${String(roomCount + 1).padStart(2, '0')}`,
      room_type: 'STANDARD',
      capacity: 2,
      status: 'ACTIVE',
      description: '',
    });
    setTargetParent({ type: 'FLOOR', data: floor, block, hostel });
    setModalMode('CREATE');
    setModalError(null);
    setActiveModal('ROOM');
  };

  const openCreateBed = (room, floor, block, hostel) => {
    const bedCount = (room.beds || []).length;
    setBedForm({
      code: `B-${String.fromCharCode(65 + (bedCount % 26))}`,
      name: `Bed ${String.fromCharCode(65 + (bedCount % 26))}`,
      status: 'AVAILABLE',
    });
    setTargetParent({ type: 'ROOM', data: room, floor, block, hostel });
    setModalMode('CREATE');
    setModalError(null);
    setActiveModal('BED');
  };

  const openBulkModal = (hostel) => {
    setBulkStep(1);
    setBulkInput({
      hostel_id: hostel?.id || (tree[0] ? tree[0].id : ''),
      block_id: '',
      block_name: 'Block A',
      block_code: 'BLK-A',
      floor_count: 3,
      starting_floor: 1,
      floor_name_prefix: 'Floor ',
      rooms_per_floor: 8,
      room_type: 'STANDARD',
      room_capacity: 2,
      generate_beds: true,
      bed_naming_pattern: 'ALPHA',
    });
    setBulkPreview(null);
    setModalError(null);
    setActiveModal('BULK');
  };

  const openCSVModal = () => {
    setCsvFile(null);
    setCsvResult(null);
    setModalError(null);
    setActiveModal('CSV');
  };

  // --- Submission Handlers ---

  const handleSaveHostel = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setModalError(null);
    try {
      if (modalMode === 'EDIT') {
        await updateHostel(collegeId, editItem.id, hostelForm);
        await handleMutationSuccess(`Hostel "${hostelForm.name}" updated successfully.`);
      } else {
        await createHostel(collegeId, hostelForm);
        await handleMutationSuccess(`Hostel "${hostelForm.name}" created successfully.`);
      }
    } catch (err) {
      setModalError(err.message || 'Failed to save hostel');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveBlock = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setModalError(null);
    try {
      const payload = {
        ...blockForm,
        hostel_id: targetParent.data.id,
      };
      await createBlock(collegeId, payload);
      await handleMutationSuccess(`Block "${blockForm.name}" added to ${targetParent.data.name}.`);
    } catch (err) {
      setModalError(err.message || 'Failed to create block');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveFloor = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setModalError(null);
    try {
      const payload = {
        ...floorForm,
        floor_number: Number(floorForm.floor_number),
        hostel_id: targetParent.type === 'HOSTEL' ? targetParent.data.id : targetParent.data.hostel_id,
        block_id: targetParent.type === 'BLOCK' ? targetParent.data.id : null,
      };
      await createFloor(collegeId, payload);
      await handleMutationSuccess(`Floor "${floorForm.name}" added successfully.`);
    } catch (err) {
      setModalError(err.message || 'Failed to create floor');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveRoom = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setModalError(null);
    try {
      const payload = {
        ...roomForm,
        capacity: Number(roomForm.capacity),
        floor_id: targetParent.data.id,
        block_id: targetParent.data.block_id || null,
        hostel_id: targetParent.data.hostel_id,
      };
      await createRoom(collegeId, payload);
      await handleMutationSuccess(`Room "${roomForm.name}" added successfully.`);
    } catch (err) {
      setModalError(err.message || 'Failed to create room');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveBed = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setModalError(null);
    try {
      const payload = {
        ...bedForm,
        room_id: targetParent.data.id,
        floor_id: targetParent.data.floor_id,
        block_id: targetParent.data.block_id || null,
        hostel_id: targetParent.data.hostel_id,
      };
      await createBed(collegeId, payload);
      await handleMutationSuccess(`Bed "${bedForm.code}" created successfully.`);
    } catch (err) {
      setModalError(err.message || 'Failed to create bed');
    } finally {
      setSubmitting(false);
    }
  };

  // Bulk Generator Handlers
  const handlePreviewBulk = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setModalError(null);
    try {
      const payload = {
        ...bulkInput,
        floor_count: Number(bulkInput.floor_count),
        starting_floor: Number(bulkInput.starting_floor),
        rooms_per_floor: Number(bulkInput.rooms_per_floor),
        room_capacity: Number(bulkInput.room_capacity),
        block_id: bulkInput.block_id || undefined,
      };
      const res = await previewBulkGeneration(collegeId, payload);
      setBulkPreview(res);
      setBulkStep(2);
    } catch (err) {
      setModalError(err.message || 'Bulk generation preview failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExecuteBulk = async () => {
    setSubmitting(true);
    setModalError(null);
    try {
      const payload = {
        ...bulkInput,
        floor_count: Number(bulkInput.floor_count),
        starting_floor: Number(bulkInput.starting_floor),
        rooms_per_floor: Number(bulkInput.rooms_per_floor),
        room_capacity: Number(bulkInput.room_capacity),
        block_id: bulkInput.block_id || undefined,
      };
      const res = await generateBulkStructure(collegeId, payload);
      await handleMutationSuccess(
        `Bulk generation completed! Created ${res.floors_created || 0} floors, ${res.rooms_created || 0} rooms, and ${res.beds_created || 0} beds.`
      );
    } catch (err) {
      setModalError(err.message || 'Bulk generation execution failed');
    } finally {
      setSubmitting(false);
    }
  };

  // CSV Import Handlers
  const handleCSVFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCsvFile(file);
    setCsvValidating(true);
    setModalError(null);
    try {
      const preview = await previewCSV(collegeId, file);
      setCsvResult(preview);
    } catch (err) {
      setModalError(err.message || 'Failed to parse CSV file');
    } finally {
      setCsvValidating(false);
    }
  };

  const handleExecuteCSVImport = async () => {
    if (!csvFile) return;
    setSubmitting(true);
    setModalError(null);
    try {
      const res = await importCSV(collegeId, csvFile);
      await handleMutationSuccess(
        `CSV import successful! Created ${res.hostels_created || 0} hostels, ${res.blocks_created || 0} blocks, ${res.floors_created || 0} floors, ${res.rooms_created || 0} rooms, and ${res.beds_created || 0} beds.`
      );
    } catch (err) {
      setModalError(err.message || 'CSV import failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await downloadCSVTemplate(collegeId);
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hostel_structure_template_${collegeId}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert(err.message || 'Failed to download template');
    }
  };

  // Quick Deletions with Confirmation
  const handleDeleteHostel = async (h) => {
    if (!window.confirm(`Are you sure you want to delete hostel "${h.name}"? This action cannot be undone.`)) return;
    try {
      await deleteHostel(collegeId, h.id);
      await handleMutationSuccess(`Hostel "${h.name}" deleted.`);
    } catch (err) {
      alert(err.message || 'Failed to delete hostel');
    }
  };

  const handleDeleteBlock = async (b) => {
    if (!window.confirm(`Delete block "${b.name}"?`)) return;
    try {
      await deleteBlock(collegeId, b.id);
      await handleMutationSuccess(`Block "${b.name}" deleted.`);
    } catch (err) {
      alert(err.message || 'Failed to delete block');
    }
  };

  const handleDeleteFloor = async (f) => {
    if (!window.confirm(`Delete floor "${f.name}"?`)) return;
    try {
      await deleteFloor(collegeId, f.id);
      await handleMutationSuccess(`Floor "${f.name}" deleted.`);
    } catch (err) {
      alert(err.message || 'Failed to delete floor');
    }
  };

  const handleDeleteRoom = async (r) => {
    if (!window.confirm(`Delete room "${r.name || r.code}"?`)) return;
    try {
      await deleteRoom(collegeId, r.id);
      await handleMutationSuccess(`Room "${r.name || r.code}" deleted.`);
    } catch (err) {
      alert(err.message || 'Failed to delete room');
    }
  };

  const handleDeleteBed = async (b) => {
    if (!window.confirm(`Delete bed "${b.code}"?`)) return;
    try {
      await deleteBed(collegeId, b.id);
      await handleMutationSuccess(`Bed "${b.code}" deleted.`);
    } catch (err) {
      alert(err.message || 'Failed to delete bed');
    }
  };

  const totalHostels = overview?.total_hostels || tree.length || 0;
  const hasHostel = totalHostels > 0;

  return (
    <div className="hostel-structure-setup">
      {notice && (
        <div style={{
          padding: '12px 16px',
          background: '#ecfdf5',
          borderLeft: '4px solid #10b981',
          color: '#065f46',
          fontSize: '0.875rem',
          marginBottom: '20px',
          borderRadius: '4px',
        }}>
          ✓ {notice}
        </div>
      )}

      {error && (
        <div style={{
          padding: '12px 16px',
          background: '#fef2f2',
          borderLeft: '4px solid #ef4444',
          color: '#991b1b',
          fontSize: '0.875rem',
          marginBottom: '20px',
          borderRadius: '4px',
        }}>
          ✕ {error}
        </div>
      )}

      {/* Readiness Status Banner */}
      <div style={{
        padding: '18px 20px',
        borderRadius: '8px',
        background: hasHostel ? '#ecfdf5' : '#fef2f2',
        border: hasHostel ? '1px solid #a7f3d0' : '1px solid #fecaca',
        marginBottom: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <div>
          <div style={{
            fontWeight: '700',
            fontSize: '1rem',
            color: hasHostel ? '#065f46' : '#991b1b',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <span>{hasHostel ? '✓' : '⚠️'}</span>
            <span>{hasHostel ? 'Hostel Structure Verified — Prerequisite Satisfied' : 'Hostel Structure Missing — Activation Blocked'}</span>
          </div>
          <p style={{ fontSize: '0.875rem', color: hasHostel ? '#047857' : '#b91c1c', margin: '4px 0 0 0' }}>
            {hasHostel
              ? `Found ${totalHostels} active hostel structure(s) registered with ${overview?.total_rooms || 0} rooms and ${overview?.total_beds || 0} beds.`
              : 'At least one active hostel is mandatory for college activation. Use the buttons below to create your initial hostel structure.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => loadStructureData(true)}
            disabled={refreshing}
            id="btn-refresh-hostel-readiness"
            style={{ background: '#ffffff' }}
          >
            {refreshing ? '🔄 Refreshing...' : '🔄 Refresh Check'}
          </button>

          {!hasHostel ? (
            <button
              className="btn btn-primary"
              onClick={openCreateHostel}
              id="btn-create-first-hostel"
              style={{ fontWeight: '600' }}
            >
              + Create First Hostel
            </button>
          ) : (
            <button
              className="btn btn-primary btn-sm"
              onClick={openCreateHostel}
              id="btn-add-hostel-more"
            >
              + Add Another Hostel
            </button>
          )}
        </div>
      </div>

      {/* Metrics Bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: '12px',
        marginBottom: '24px',
      }}>
        <div style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Hostels</div>
          <div style={{ fontSize: '1.4rem', fontWeight: '700', color: '#0f172a', marginTop: '2px' }}>{overview?.total_hostels || tree.length || 0}</div>
        </div>
        <div style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Blocks</div>
          <div style={{ fontSize: '1.4rem', fontWeight: '700', color: '#0f172a', marginTop: '2px' }}>{overview?.total_blocks || 0}</div>
        </div>
        <div style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Floors</div>
          <div style={{ fontSize: '1.4rem', fontWeight: '700', color: '#0f172a', marginTop: '2px' }}>{overview?.total_floors || 0}</div>
        </div>
        <div style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Rooms</div>
          <div style={{ fontSize: '1.4rem', fontWeight: '700', color: '#0f172a', marginTop: '2px' }}>{overview?.total_rooms || 0}</div>
        </div>
        <div style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Total Beds</div>
          <div style={{ fontSize: '1.4rem', fontWeight: '700', color: '#0f172a', marginTop: '2px' }}>{overview?.total_beds || 0}</div>
        </div>
      </div>

      {/* Structural Provisioning Actions & Hierarchy Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
        flexWrap: 'wrap',
        gap: '10px',
      }}>
        <div style={{ fontSize: '1rem', fontWeight: '700', color: '#1e293b' }}>
          Structural Hierarchy & Entities ({tree.length} {tree.length === 1 ? 'Hostel' : 'Hostels'})
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {hasHostel && (
            <>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => openBulkModal(tree[0])}
                id="btn-onboarding-bulk-gen"
                title="Rapidly generate floors, rooms, and beds"
              >
                ⚡ Bulk Generator
              </button>
              <button
                className="btn btn-outline btn-sm"
                onClick={openCSVModal}
                id="btn-onboarding-csv-import"
                title="Import structure hierarchy from CSV file"
              >
                📄 Import CSV
              </button>
            </>
          )}
        </div>
      </div>

      {/* Empty State Banner */}
      {!loading && !hasHostel && (
        <div style={{
          textAlign: 'center',
          padding: '48px 24px',
          background: '#f8fafc',
          borderRadius: '8px',
          border: '1px dashed #cbd5e1',
          marginBottom: '24px',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🏢</div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: '#1e293b', marginBottom: '6px' }}>
            No Hostels Established Yet
          </h3>
          <p style={{ fontSize: '0.875rem', color: '#64748b', maxWidth: '520px', margin: '0 auto 20px auto', lineHeight: '1.5' }}>
            Configure the physical layout of your college’s residential facilities. Creating your first hostel will immediately satisfy the onboarding readiness check.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
            <button className="btn btn-primary" onClick={openCreateHostel} id="btn-empty-create-hostel">
              + Create First Hostel
            </button>
            <button className="btn btn-outline" onClick={openCSVModal} id="btn-empty-import-csv">
              📄 Upload CSV Template
            </button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
          ⏳ Loading hostel structure tree...
        </div>
      )}

      {/* Selected Entity Details Panel */}
      {selectedEntity && (
        <div style={{
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: '4px' }}>
                {selectedEntity.type} Details
              </span>
              <strong style={{ color: '#1e293b' }}>{selectedEntity.name || selectedEntity.code}</strong>
              <span style={{ fontFamily: 'monospace', color: '#64748b', fontSize: '0.8rem' }}>({selectedEntity.code})</span>
              <span style={{ fontSize: '0.75rem', color: selectedEntity.status === 'ACTIVE' || selectedEntity.status === 'AVAILABLE' ? '#059669' : '#d97706', fontWeight: '600' }}>
                ● {selectedEntity.status}
              </span>
            </div>
            <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '4px', display: 'flex', gap: '16px' }}>
              <span>ID: <code style={{ fontSize: '0.75rem' }}>{selectedEntity.id}</code></span>
              {selectedEntity.category && <span>Category: <strong>{selectedEntity.category}</strong></span>}
              {selectedEntity.room_type && <span>Type: <strong>{selectedEntity.room_type}</strong></span>}
              {selectedEntity.capacity !== undefined && <span>Capacity: <strong>{selectedEntity.capacity}</strong></span>}
              {selectedEntity.floor_number !== undefined && <span>Floor Level: <strong>{selectedEntity.floor_number}</strong></span>}
            </div>
          </div>
          <button
            onClick={() => setSelectedEntity(null)}
            className="btn btn-outline btn-sm"
            style={{ fontSize: '0.75rem', padding: '4px 8px' }}
          >
            ✕ Close Details
          </button>
        </div>
      )}

      {/* Hierarchy Browser */}
      {!loading && hasHostel && (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', marginBottom: '24px' }}>
          {tree.map((hostel) => {
            const isHostelExpanded = expandedNodes[`hostel-${hostel.id}`] ?? true;
            const blocks = hostel.blocks || [];

            return (
              <div key={hostel.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                {/* Hostel Row */}
                <div style={{
                  padding: '12px 16px',
                  background: '#f1f5f9',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button
                      onClick={() => toggleNode(`hostel-${hostel.id}`)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem', color: '#475569' }}
                    >
                      {isHostelExpanded ? '▼' : '▶'}
                    </button>
                    <span style={{ fontSize: '1.1rem' }}>🏢</span>
                    <div
                      onClick={() => setSelectedEntity({
                        type: 'Hostel',
                        name: hostel.name,
                        code: hostel.code,
                        id: hostel.id,
                        status: hostel.status,
                        category: hostel.category,
                        capacity: hostel.total_capacity,
                        description: hostel.description,
                      })}
                      style={{ cursor: 'pointer' }}
                      title="Click to view details"
                    >
                      <span style={{ fontWeight: '700', color: '#0f172a', fontSize: '0.95rem' }}>{hostel.name}</span>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#64748b', marginLeft: '8px' }}>({hostel.code})</span>
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: '600',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        background: '#e0e7ff',
                        color: '#3730a3',
                        marginLeft: '8px',
                      }}>
                        {hostel.category}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => openCreateBlock(hostel)}
                      title="Add block under this hostel"
                      style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                    >
                      + Add Block
                    </button>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => openCreateFloor({ type: 'HOSTEL', data: hostel })}
                      title="Add direct floor (no block)"
                      style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                    >
                      + Add Floor
                    </button>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => openEditHostel(hostel)}
                      style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                    >
                      ✏️ Edit
                    </button>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => handleDeleteHostel(hostel)}
                      style={{ fontSize: '0.75rem', padding: '3px 8px', color: '#dc2626' }}
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {/* Blocks & Floors inside Hostel */}
                {isHostelExpanded && (
                  <div style={{ paddingLeft: '24px', background: '#ffffff' }}>
                    {blocks.length === 0 ? (
                      <div style={{ padding: '16px 20px', color: '#94a3b8', fontSize: '0.85rem' }}>
                        No blocks or floors in this hostel. Use &quot;+ Add Block&quot;, &quot;+ Add Floor&quot;, or &quot;⚡ Bulk Generator&quot; above.
                      </div>
                    ) : (
                      blocks.map((block) => {
                        const isBlockExpanded = expandedNodes[`block-${block.id}`] ?? true;
                        const floors = block.floors || [];

                        return (
                          <div key={block.id} style={{ borderLeft: '2px solid #cbd5e1', marginLeft: '12px', marginTop: '8px', marginBottom: '8px' }}>
                            {/* Block Header */}
                            <div style={{
                              padding: '8px 14px',
                              background: '#f8fafc',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <button
                                  onClick={() => toggleNode(`block-${block.id}`)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', color: '#64748b' }}
                                >
                                  {isBlockExpanded ? '▼' : '▶'}
                                </button>
                                <div
                                  onClick={() => setSelectedEntity({
                                    type: 'Block',
                                    name: block.name,
                                    code: block.code,
                                    id: block.id,
                                    status: block.status,
                                    description: block.description,
                                  })}
                                  style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                                  title="Click to view details"
                                >
                                  <span style={{ fontSize: '0.95rem' }}>🧱</span>
                                  <span style={{ fontWeight: '600', color: '#1e293b', fontSize: '0.9rem' }}>{block.name}</span>
                                  <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#64748b' }}>({block.code})</span>
                                </div>
                              </div>

                              <div style={{ display: 'flex', gap: '4px' }}>
                                <button
                                  className="btn btn-outline btn-sm"
                                  onClick={() => openCreateFloor({ type: 'BLOCK', data: block })}
                                  style={{ fontSize: '0.7rem', padding: '2px 6px' }}
                                >
                                  + Floor
                                </button>
                                <button
                                  className="btn btn-outline btn-sm"
                                  onClick={() => handleDeleteBlock(block)}
                                  style={{ fontSize: '0.7rem', padding: '2px 6px', color: '#dc2626' }}
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>

                            {/* Floors inside Block */}
                            {isBlockExpanded && (
                              <div style={{ paddingLeft: '20px' }}>
                                {floors.length === 0 ? (
                                  <div style={{ padding: '8px 12px', color: '#94a3b8', fontSize: '0.8rem' }}>
                                    No floors in this block. Click &quot;+ Floor&quot;.
                                  </div>
                                ) : (
                                  floors.map((floor) => {
                                    const isFloorExpanded = expandedNodes[`floor-${floor.id}`] ?? true;
                                    const rooms = floor.rooms || [];

                                    return (
                                      <div key={floor.id} style={{ borderLeft: '2px solid #e2e8f0', marginLeft: '10px', marginTop: '6px', marginBottom: '6px' }}>
                                        {/* Floor Header */}
                                        <div style={{
                                          padding: '6px 12px',
                                          background: '#ffffff',
                                          display: 'flex',
                                          justifyContent: 'space-between',
                                          alignItems: 'center',
                                        }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <button
                                              onClick={() => toggleNode(`floor-${floor.id}`)}
                                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: '#64748b' }}
                                            >
                                              {isFloorExpanded ? '▼' : '▶'}
                                            </button>
                                            <div
                                              onClick={() => setSelectedEntity({
                                                type: 'Floor',
                                                name: floor.name,
                                                code: floor.code,
                                                id: floor.id,
                                                floor_number: floor.floor_number,
                                                status: floor.status,
                                                description: floor.description,
                                              })}
                                              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                                              title="Click to view details"
                                            >
                                              <span style={{ fontSize: '0.85rem' }}>🪜</span>
                                              <span style={{ fontWeight: '600', color: '#334155', fontSize: '0.85rem' }}>
                                                {floor.name} (L{floor.floor_number})
                                              </span>
                                              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>— {rooms.length} rooms</span>
                                            </div>
                                          </div>

                                          <div style={{ display: 'flex', gap: '4px' }}>
                                            <button
                                              className="btn btn-outline btn-sm"
                                              onClick={() => openCreateRoom(floor, block, hostel)}
                                              style={{ fontSize: '0.7rem', padding: '2px 6px' }}
                                            >
                                              + Room
                                            </button>
                                            <button
                                              className="btn btn-outline btn-sm"
                                              onClick={() => handleDeleteFloor(floor)}
                                              style={{ fontSize: '0.7rem', padding: '2px 6px', color: '#dc2626' }}
                                            >
                                              🗑️
                                            </button>
                                          </div>
                                        </div>

                                        {/* Rooms inside Floor */}
                                        {isFloorExpanded && (
                                          <div style={{ paddingLeft: '24px', display: 'flex', flexWrap: 'wrap', gap: '8px', paddingBottom: '8px', paddingTop: '4px' }}>
                                            {rooms.length === 0 ? (
                                              <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>No rooms. Click &quot;+ Room&quot;</span>
                                            ) : (
                                              rooms.map((room) => {
                                                const beds = room.beds || [];
                                                return (
                                                  <div
                                                    key={room.id}
                                                    style={{
                                                      padding: '8px 10px',
                                                      borderRadius: '6px',
                                                      border: '1px solid #cbd5e1',
                                                      background: '#f8fafc',
                                                      fontSize: '0.8rem',
                                                      minWidth: '150px',
                                                    }}
                                                  >
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                                      <span
                                                        onClick={() => setSelectedEntity({
                                                          type: 'Room',
                                                          name: room.name,
                                                          code: room.code,
                                                          id: room.id,
                                                          room_type: room.room_type,
                                                          capacity: room.capacity,
                                                          status: room.status,
                                                          description: room.description,
                                                        })}
                                                        style={{ fontWeight: '700', color: '#0f172a', cursor: 'pointer' }}
                                                        title="Click to view details"
                                                      >
                                                        🚪 {room.code}
                                                      </span>
                                                      <button
                                                        onClick={() => handleDeleteRoom(room)}
                                                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }}
                                                        title="Delete room"
                                                      >
                                                        ✕
                                                      </button>
                                                    </div>
                                                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                                      {room.room_type} | Cap: {room.capacity}
                                                    </div>
                                                    <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                                                      {beds.map((bed) => (
                                                        <span
                                                          key={bed.id}
                                                          onClick={() => setSelectedEntity({
                                                            type: 'Bed',
                                                            name: bed.name,
                                                            code: bed.code,
                                                            id: bed.id,
                                                            status: bed.status,
                                                          })}
                                                          style={{
                                                            fontSize: '0.7rem',
                                                            background: '#e2e8f0',
                                                            padding: '1px 5px',
                                                            borderRadius: '3px',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '3px',
                                                            cursor: 'pointer',
                                                          }}
                                                          title="Click to view details"
                                                        >
                                                          🛏️ {bed.code}
                                                          <button
                                                            onClick={(e) => {
                                                              e.stopPropagation();
                                                              handleDeleteBed(bed);
                                                            }}
                                                            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}
                                                          >
                                                            ×
                                                          </button>
                                                        </span>
                                                      ))}
                                                      <button
                                                        onClick={() => openCreateBed(room, floor, block, hostel)}
                                                        style={{
                                                          background: 'none',
                                                          border: '1px dashed #94a3b8',
                                                          borderRadius: '3px',
                                                          fontSize: '0.7rem',
                                                          padding: '0 4px',
                                                          cursor: 'pointer',
                                                          color: '#2563eb',
                                                        }}
                                                        title="Add bed"
                                                      >
                                                        + Bed
                                                      </button>
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

      {/* --- MODALS --- */}

      {/* Hostel Modal */}
      {activeModal === 'HOSTEL' && (
        <div className="modal-backdrop" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div className="card" style={{ width: '480px', padding: '24px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.2rem', color: '#0f172a' }}>
              {modalMode === 'CREATE' ? 'Add New Hostel' : 'Edit Hostel'}
            </h3>

            {modalError && (
              <div style={{ padding: '8px 12px', background: '#fef2f2', borderLeft: '4px solid #ef4444', color: '#991b1b', fontSize: '0.85rem', marginBottom: '12px' }}>
                {modalError}
              </div>
            )}

            <form onSubmit={handleSaveHostel}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>
                  Hostel Code * (unique identifier, e.g. BH-01)
                </label>
                <input
                  type="text"
                  value={hostelForm.code}
                  onChange={(e) => setHostelForm({ ...hostelForm, code: e.target.value })}
                  required
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>
                  Hostel Name * (e.g. Boys Hostel Alpha)
                </label>
                <input
                  type="text"
                  value={hostelForm.name}
                  onChange={(e) => setHostelForm({ ...hostelForm, name: e.target.value })}
                  required
                  placeholder="e.g. Ganga Boys Residence"
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>
                  Category *
                </label>
                <select
                  value={hostelForm.category}
                  onChange={(e) => setHostelForm({ ...hostelForm, category: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                >
                  {HOSTEL_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setActiveModal(null)} disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : modalMode === 'CREATE' ? 'Create Hostel' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Block Modal */}
      {activeModal === 'BLOCK' && (
        <div className="modal-backdrop" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div className="card" style={{ width: '450px', padding: '24px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.2rem', color: '#0f172a' }}>
              Add Block to {targetParent?.data?.name}
            </h3>

            {modalError && (
              <div style={{ padding: '8px 12px', background: '#fef2f2', borderLeft: '4px solid #ef4444', color: '#991b1b', fontSize: '0.85rem', marginBottom: '12px' }}>
                {modalError}
              </div>
            )}

            <form onSubmit={handleSaveBlock}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>
                  Block Code *
                </label>
                <input
                  type="text"
                  value={blockForm.code}
                  onChange={(e) => setBlockForm({ ...blockForm, code: e.target.value })}
                  required
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>
                  Block Name *
                </label>
                <input
                  type="text"
                  value={blockForm.name}
                  onChange={(e) => setBlockForm({ ...blockForm, name: e.target.value })}
                  required
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setActiveModal(null)} disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create Block'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floor Modal */}
      {activeModal === 'FLOOR' && (
        <div className="modal-backdrop" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div className="card" style={{ width: '450px', padding: '24px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.2rem', color: '#0f172a' }}>
              Add Floor to {targetParent?.data?.name}
            </h3>

            {modalError && (
              <div style={{ padding: '8px 12px', background: '#fef2f2', borderLeft: '4px solid #ef4444', color: '#991b1b', fontSize: '0.85rem', marginBottom: '12px' }}>
                {modalError}
              </div>
            )}

            <form onSubmit={handleSaveFloor}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>
                  Floor Number *
                </label>
                <input
                  type="number"
                  value={floorForm.floor_number}
                  onChange={(e) => setFloorForm({ ...floorForm, floor_number: e.target.value })}
                  required
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>
                  Floor Name *
                </label>
                <input
                  type="text"
                  value={floorForm.name}
                  onChange={(e) => setFloorForm({ ...floorForm, name: e.target.value })}
                  required
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>
                  Floor Code *
                </label>
                <input
                  type="text"
                  value={floorForm.code}
                  onChange={(e) => setFloorForm({ ...floorForm, code: e.target.value })}
                  required
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setActiveModal(null)} disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create Floor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Room Modal */}
      {activeModal === 'ROOM' && (
        <div className="modal-backdrop" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div className="card" style={{ width: '480px', padding: '24px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.2rem', color: '#0f172a' }}>
              Add Room to {targetParent?.data?.name}
            </h3>

            {modalError && (
              <div style={{ padding: '8px 12px', background: '#fef2f2', borderLeft: '4px solid #ef4444', color: '#991b1b', fontSize: '0.85rem', marginBottom: '12px' }}>
                {modalError}
              </div>
            )}

            <form onSubmit={handleSaveRoom}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>
                  Room Number / Code *
                </label>
                <input
                  type="text"
                  value={roomForm.code}
                  onChange={(e) => setRoomForm({ ...roomForm, code: e.target.value, name: `Room ${e.target.value}` })}
                  required
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>
                  Room Type *
                </label>
                <select
                  value={roomForm.room_type}
                  onChange={(e) => setRoomForm({ ...roomForm, room_type: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                >
                  {ROOM_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>
                  Capacity (Max beds) *
                </label>
                <input
                  type="number"
                  min="1"
                  max="16"
                  value={roomForm.capacity}
                  onChange={(e) => setRoomForm({ ...roomForm, capacity: e.target.value })}
                  required
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setActiveModal(null)} disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bed Modal */}
      {activeModal === 'BED' && (
        <div className="modal-backdrop" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div className="card" style={{ width: '420px', padding: '24px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.2rem', color: '#0f172a' }}>
              Add Bed to {targetParent?.data?.name || targetParent?.data?.code}
            </h3>

            {modalError && (
              <div style={{ padding: '8px 12px', background: '#fef2f2', borderLeft: '4px solid #ef4444', color: '#991b1b', fontSize: '0.85rem', marginBottom: '12px' }}>
                {modalError}
              </div>
            )}

            <form onSubmit={handleSaveBed}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>
                  Bed Code / Label * (e.g. B-A, Bed 1)
                </label>
                <input
                  type="text"
                  value={bedForm.code}
                  onChange={(e) => setBedForm({ ...bedForm, code: e.target.value, name: e.target.value })}
                  required
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setActiveModal(null)} disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Add Bed'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Generator Modal */}
      {activeModal === 'BULK' && (
        <div className="modal-backdrop" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div className="card" style={{ width: '580px', padding: '24px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '1.25rem', color: '#0f172a' }}>
              ⚡ Bulk Structure Generator
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 16px 0' }}>
              Rapidly generate multi-floor layouts, rooms, and bed slots in a single atomic operation.
            </p>

            {modalError && (
              <div style={{ padding: '10px 14px', background: '#fef2f2', borderLeft: '4px solid #ef4444', color: '#991b1b', fontSize: '0.85rem', marginBottom: '14px' }}>
                {modalError}
              </div>
            )}

            {bulkStep === 1 ? (
              <form onSubmit={handlePreviewBulk}>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>
                    Target Hostel *
                  </label>
                  <select
                    value={bulkInput.hostel_id}
                    onChange={(e) => setBulkInput({ ...bulkInput, hostel_id: e.target.value })}
                    required
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  >
                    {tree.map((h) => (
                      <option key={h.id} value={h.id}>{h.name} ({h.code})</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>
                      Floor Count * (1 to 20)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={bulkInput.floor_count}
                      onChange={(e) => setBulkInput({ ...bulkInput, floor_count: e.target.value })}
                      required
                      style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>
                      Rooms Per Floor * (1 to 50)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={bulkInput.rooms_per_floor}
                      onChange={(e) => setBulkInput({ ...bulkInput, rooms_per_floor: e.target.value })}
                      required
                      style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>
                      Room Type *
                    </label>
                    <select
                      value={bulkInput.room_type}
                      onChange={(e) => setBulkInput({ ...bulkInput, room_type: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                    >
                      {ROOM_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>
                      Beds Per Room * (Capacity)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="12"
                      value={bulkInput.room_capacity}
                      onChange={(e) => setBulkInput({ ...bulkInput, room_capacity: e.target.value })}
                      required
                      style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '18px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#1e293b', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={bulkInput.generate_beds}
                      onChange={(e) => setBulkInput({ ...bulkInput, generate_beds: e.target.checked })}
                    />
                    <span>Automatically generate individual bed slots according to room capacity</span>
                  </label>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button type="button" className="btn btn-outline" onClick={() => setActiveModal(null)} disabled={submitting}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? 'Analyzing Preview...' : 'Preview Generation →'}
                  </button>
                </div>
              </form>
            ) : (
              <div>
                <div style={{ background: '#ecfdf5', padding: '14px 18px', borderRadius: '6px', border: '1px solid #a7f3d0', marginBottom: '16px' }}>
                  <div style={{ fontWeight: '700', color: '#065f46', fontSize: '0.95rem', marginBottom: '4px' }}>
                    ✓ Preview Ready — Review Generation Plan
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#047857' }}>
                    This generation will create:
                    <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
                      <li><strong>{bulkPreview?.total_floors || 0}</strong> Floors</li>
                      <li><strong>{bulkPreview?.total_rooms || 0}</strong> Rooms ({bulkInput.room_type})</li>
                      <li><strong>{bulkPreview?.total_beds || 0}</strong> Total Bed Slots</li>
                    </ul>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
                  <button type="button" className="btn btn-outline" onClick={() => setBulkStep(1)} disabled={submitting}>
                    ← Back to Parameters
                  </button>
                  <button type="button" className="btn btn-primary" onClick={handleExecuteBulk} disabled={submitting}>
                    {submitting ? 'Generating Structure...' : 'Confirm & Generate Structure'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {activeModal === 'CSV' && (
        <div className="modal-backdrop" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div className="card" style={{ width: '560px', padding: '24px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '1.25rem', color: '#0f172a' }}>
              📄 Import Structure via CSV
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 16px 0' }}>
              Upload your hostel structure data using the standardized format.
            </p>

            {modalError && (
              <div style={{ padding: '10px 14px', background: '#fef2f2', borderLeft: '4px solid #ef4444', color: '#991b1b', fontSize: '0.85rem', marginBottom: '14px' }}>
                {modalError}
              </div>
            )}

            <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.85rem', color: '#334155' }}>
                Need the standard import format?
              </div>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={handleDownloadTemplate}
                style={{ background: '#fff' }}
              >
                ⬇ Download CSV Template
              </button>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                Choose CSV File
              </label>
              <input
                type="file"
                accept=".csv"
                onChange={handleCSVFileChange}
                style={{ width: '100%', padding: '8px', border: '1px dashed #cbd5e1', borderRadius: '6px' }}
              />
            </div>

            {csvValidating && (
              <div style={{ padding: '12px', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                ⏳ Validating CSV content and checking hierarchy integrity...
              </div>
            )}

            {csvResult && (
              <div style={{
                background: csvResult.is_valid ? '#ecfdf5' : '#fef2f2',
                border: csvResult.is_valid ? '1px solid #a7f3d0' : '1px solid #fecaca',
                padding: '14px',
                borderRadius: '6px',
                marginBottom: '16px',
              }}>
                <div style={{ fontWeight: '700', color: csvResult.is_valid ? '#065f46' : '#991b1b', fontSize: '0.9rem', marginBottom: '4px' }}>
                  {csvResult.is_valid ? '✓ CSV Validation Passed' : '✕ CSV Validation Errors Detected'}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#334155' }}>
                  Found: {csvResult.total_rows || 0} rows ({csvResult.hostel_count || 0} hostels, {csvResult.floor_count || 0} floors, {csvResult.room_count || 0} rooms).
                </div>
                {csvResult.errors && csvResult.errors.length > 0 && (
                  <ul style={{ margin: '8px 0 0 16px', padding: 0, color: '#b91c1c', fontSize: '0.78rem' }}>
                    {csvResult.errors.map((err, idx) => (
                      <li key={idx}>Row {err.row}: {err.message} ({err.field})</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" className="btn btn-outline" onClick={() => setActiveModal(null)} disabled={submitting}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleExecuteCSVImport}
                disabled={!csvFile || submitting || (csvResult && !csvResult.is_valid)}
              >
                {submitting ? 'Importing Data...' : 'Import Structure'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

