import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../../shared/api/api';
import adminService from '../../admin/services/adminService';
import {
  BedDouble,
  Building2,
  Search,
  RefreshCw,
  LayoutGrid,
  List,
  UserCheck,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight,
  Plus,
  Trash2,
  AlertCircle,
  Users,
} from 'lucide-react';
import { LoadingState, EmptyState, Modal } from '../../../shared/components';

export default function InchargeRoomsPage() {
  const [myHostel, setMyHostel] = useState(null);
  const [residents, setResidents] = useState([]);
  const [vacantBeds, setVacantBeds] = useState([]);
  const [unallocatedStudents, setUnallocatedStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, OCCUPIED, VACANT
  const [displayMode, setDisplayMode] = useState('CARDS');

  // Allocate Student Modal State
  const [isAllocateModalOpen, setIsAllocateModalOpen] = useState(false);
  const [allocateFormData, setAllocateFormData] = useState({
    student_id: '',
    bed_id: '',
    allocation_type: 'REGULAR',
    allocated_at: new Date().toISOString().split('T')[0],
    remarks: '',
  });
  const [allocateSubmitting, setAllocateSubmitting] = useState(false);
  const [allocateError, setAllocateError] = useState(null);
  const [allocateSuccess, setAllocateSuccess] = useState(null);

  // Vacate Modal State
  const [vacateConfirmOpen, setVacateConfirmOpen] = useState(false);
  const [selectedAllocation, setSelectedAllocation] = useState(null);
  const [vacateSubmitting, setVacateSubmitting] = useState(false);

  const loadData = useCallback(async (manual = false) => {
    try {
      if (manual) setIsRefreshing(true);
      else setLoading(true);

      const hostelRes = await adminService.getMyHostel();
      const hostel = hostelRes.data || hostelRes;
      setMyHostel(hostel);

      if (hostel?.hostel_id) {
        const [resRes, bedRes, unallocRes] = await Promise.allSettled([
          adminService.getHostelResidents(hostel.hostel_id),
          adminService.getHostelVacantBeds(hostel.hostel_id),
          adminService.getUnallocatedStudents(),
        ]);

        if (resRes.status === 'fulfilled') {
          const d = resRes.value.data || resRes.value;
          setResidents(Array.isArray(d) ? d : []);
        }
        if (bedRes.status === 'fulfilled') {
          const d = bedRes.value.data || bedRes.value;
          setVacantBeds(Array.isArray(d) ? d : []);
        }
        if (unallocRes.status === 'fulfilled') {
          const d = unallocRes.value.data || unallocRes.value;
          setUnallocatedStudents(Array.isArray(d) ? d : []);
        }
      }
    } catch (err) {
      console.error('Failed to load incharge rooms data:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Combine occupied residents and vacant beds for unified view
  const allBeds = useMemo(() => {
    const list = [];
    residents.forEach((r) => {
      list.push({
        id: r.allocation_id,
        bed_id: r.bed_id,
        bed_name: r.bed_name,
        room_code: r.room_code || r.room_name,
        room_name: r.room_name,
        block_name: r.block_name,
        is_occupied: true,
        resident_name: r.full_name,
        student_id: r.student_id,
        admission_number: r.admission_number,
        allocated_at: r.allocated_at,
        allocation_id: r.allocation_id,
        status: 'OCCUPIED',
      });
    });

    vacantBeds.forEach((b) => {
      list.push({
        id: b.bed_id,
        bed_id: b.bed_id,
        bed_name: b.bed_name,
        room_code: b.room_code || b.room_name,
        room_name: b.room_name,
        block_name: b.block_name,
        is_occupied: false,
        status: 'VACANT',
      });
    });

    return list;
  }, [residents, vacantBeds]);

  const filteredBeds = useMemo(() => {
    return allBeds.filter((b) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !search ||
        (b.room_code || '').toLowerCase().includes(q) ||
        (b.bed_name || '').toLowerCase().includes(q) ||
        (b.resident_name || '').toLowerCase().includes(q) ||
        (b.admission_number || '').toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === 'ALL' || b.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [allBeds, search, statusFilter]);

  const handleOpenAllocateModal = (preselectedBed = null) => {
    setAllocateError(null);
    setAllocateSuccess(null);
    setAllocateFormData({
      student_id: unallocatedStudents[0]?.student_id || '',
      bed_id: preselectedBed?.bed_id || vacantBeds[0]?.bed_id || '',
      allocation_type: 'REGULAR',
      allocated_at: new Date().toISOString().split('T')[0],
      remarks: '',
    });
    setIsAllocateModalOpen(true);
  };

  const handleAllocateSubmit = async (e) => {
    e.preventDefault();
    setAllocateError(null);
    setAllocateSuccess(null);

    if (!allocateFormData.student_id) {
      setAllocateError('Please select an enrolled student to allocate.');
      return;
    }
    if (!allocateFormData.bed_id) {
      setAllocateError('Please select an available bed space.');
      return;
    }

    try {
      setAllocateSubmitting(true);
      await api.post('/college/bed-allocations', {
        student_id: allocateFormData.student_id,
        bed_id: allocateFormData.bed_id,
        allocation_type: allocateFormData.allocation_type || 'REGULAR',
        allocated_at: new Date(allocateFormData.allocated_at).toISOString(),
        remarks: allocateFormData.remarks ? allocateFormData.remarks : null,
      });

      setAllocateSuccess('Student assigned to bed slot successfully!');
      await loadData(true);

      setTimeout(() => {
        setIsAllocateModalOpen(false);
        setAllocateSuccess(null);
      }, 1400);
    } catch (err) {
      console.error('Failed to allocate student:', err);
      setAllocateError(err.response?.data?.message || err.message || 'Failed to complete bed allocation.');
    } finally {
      setAllocateSubmitting(false);
    }
  };

  const handleOpenVacateConfirm = (allocation) => {
    setSelectedAllocation(allocation);
    setVacateConfirmOpen(true);
  };

  const handleVacateConfirm = async () => {
    if (!selectedAllocation) return;

    try {
      setVacateSubmitting(true);
      await api.patch(`/college/bed-allocations/${selectedAllocation.allocation_id}/release`, {
        released_at: new Date().toISOString(),
        status: 'RELEASED',
      });

      setVacateConfirmOpen(false);
      setSelectedAllocation(null);
      await loadData(true);
    } catch (err) {
      console.error('Failed to release allocation:', err);
      alert(err.response?.data?.message || 'Failed to release bed slot.');
    } finally {
      setVacateSubmitting(false);
    }
  };

  return (
    <div className="fade-in-up">
      {/* Supervisory Facility Scope Banner */}
      {myHostel && (
        <div
          style={{
            background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
            borderRadius: '12px',
            padding: '14px 20px',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Building2 size={20} style={{ color: '#a5b4fc' }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <strong style={{ fontSize: '1.05rem' }}>{myHostel.hostel_name}</strong>
                <span className="code-pill" style={{ background: '#4338ca', color: '#e0e7ff' }}>
                  {myHostel.hostel_code || 'HOSTEL'}
                </span>
                <span className="badge-enterprise badge-purple">
                  {myHostel.hostel_type || 'RESIDENTIAL'}
                </span>
              </div>
              <span style={{ fontSize: '11.5px', color: '#c7d2fe', marginTop: '2px', display: 'block' }}>
                Supervised by: <strong>{myHostel.staff_name}</strong> &bull; Managing room inventory &amp; resident beds
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                fontSize: '12px',
                color: '#e0e7ff',
                background: 'rgba(255, 255, 255, 0.1)',
                padding: '6px 12px',
                borderRadius: '8px',
              }}
            >
              Occupancy: <strong>{residents.length} Occupied / {vacantBeds.length} Vacant</strong>
            </span>
          </div>
        </div>
      )}

      {/* Enterprise Hero Header */}
      <div className="enterprise-hero-header">
        <div className="hero-header-titles">
          <div className="hero-category-pill">
            <BedDouble size={13} />
            <span>Room &amp; Bed Inventory</span>
          </div>
          <h1 className="hero-main-title">Bed Space Inventory &amp; Room Allocations</h1>
          <p className="hero-subtitle">
            Review room occupancy, allocate students to available vacant slots, and monitor resident housing within {myHostel?.hostel_name || 'this facility'}.
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
            <span>{isRefreshing ? 'Syncing...' : 'Sync Inventory'}</span>
          </button>

          <button
            type="button"
            className="btn-enterprise-primary"
            onClick={() => handleOpenAllocateModal()}
            disabled={vacantBeds.length === 0}
          >
            <Plus size={15} />
            <span>Allocate Student to Bed</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="kpi-cards-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Occupied Beds</span>
            <div className="stat-kpi-icon-wrap purple">
              <UserCheck size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-purple-600">{residents.length}</div>
          <div className="stat-kpi-footnote">
            <span className="status-dot green" />
            <span>Students officially housed</span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Vacant Bed Spaces</span>
            <div className="stat-kpi-icon-wrap green">
              <BedDouble size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-green-600">{vacantBeds.length}</div>
          <div className="stat-kpi-footnote">
            <span>Available for new residents</span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Total Bed Spaces</span>
            <div className="stat-kpi-icon-wrap blue">
              <Layers size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-blue-600">{allBeds.length}</div>
          <div className="stat-kpi-footnote">
            <span>Configured inventory slots</span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Occupancy Rate</span>
            <div className="stat-kpi-icon-wrap orange">
              <CheckCircle2 size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-orange-600">
            {allBeds.length > 0 ? `${Math.round((residents.length / allBeds.length) * 100)}%` : '0%'}
          </div>
          <div className="stat-kpi-footnote">
            <span>Current utilization</span>
          </div>
        </div>
      </div>

      {/* Main Container Card */}
      <div className="enterprise-card">
        <div className="card-topbar">
          <div className="card-title-group">
            <div className="card-title-icon-wrap">
              <BedDouble size={16} />
            </div>
            <h2 className="card-title-text">
              {myHostel?.hostel_name || 'Hostel'} Bed Spaces &amp; Occupancy
            </h2>
          </div>

          {/* View Switcher & Tally */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="stats-tally-pill" style={{ color: '#4338ca', background: '#e0e7ff', borderColor: '#c7d2fe' }}>
              <BedDouble size={12} />
              <span>{filteredBeds.length} of {allBeds.length} Slots</span>
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
              placeholder="Search by room, bed, resident name, admission no..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <select
              className="filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Slots (Occupied &amp; Vacant)</option>
              <option value="OCCUPIED">Occupied Beds Only</option>
              <option value="VACANT">Vacant Beds Only</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '36px', textAlign: 'center' }}>
            <LoadingState message="Loading room and bed inventory..." />
          </div>
        ) : filteredBeds.length === 0 ? (
          <div style={{ padding: '36px', textAlign: 'center' }}>
            <EmptyState
              title="No bed spaces found"
              message="No slots match your current filter in this facility."
            />
          </div>
        ) : displayMode === 'CARDS' ? (
          /* Cards Grid */
          <div className="beds-grid-cards" style={{ padding: '16px' }}>
            {filteredBeds.map((b) => (
              <div
                key={b.id}
                className={`bed-slot-card ${b.is_occupied ? 'occupied' : 'vacant'}`}
              >
                <div>
                  <div className="bed-card-header">
                    <div className="bed-card-identifier">
                      <div className={`bed-icon-badge ${b.is_occupied ? 'occupied' : 'vacant'}`}>
                        <BedDouble size={20} />
                      </div>
                      <div>
                        <h3 className="bed-code-title">Room {b.room_code}</h3>
                        <p className="bed-name-sub">{b.bed_name} {b.block_name ? `• ${b.block_name}` : ''}</p>
                      </div>
                    </div>

                    <span
                      className={`badge-enterprise ${b.is_occupied ? 'badge-purple' : 'badge-green'}`}
                    >
                      {b.is_occupied ? 'OCCUPIED' : 'VACANT'}
                    </span>
                  </div>

                  <div className="bed-card-body">
                    {b.is_occupied ? (
                      <div className="bed-resident-box">
                        <div className="resident-avatar-circle">
                          {(b.resident_name || 'R')[0].toUpperCase()}
                        </div>
                        <div className="resident-details">
                          <span className="resident-name">{b.resident_name}</span>
                          <span className="resident-adm-no">
                            <span>Adm:</span>
                            <strong>{b.admission_number}</strong>
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          background: '#f8fafc',
                          border: '1px dashed #cbd5e1',
                          borderRadius: '8px',
                          padding: '12px',
                          textAlign: 'center',
                          color: '#64748b',
                          fontSize: '12px',
                        }}
                      >
                        Vacant Slot Ready for Student Assignment
                      </div>
                    )}
                  </div>
                </div>

                <div className="bed-card-footer">
                  {b.is_occupied ? (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.74rem', color: '#64748b' }}>
                        <Calendar size={12} />
                        <span>Allocated: {b.allocated_at ? String(b.allocated_at).split('T')[0] : 'Current Term'}</span>
                      </div>
                      <button
                        type="button"
                        className="btn-enterprise-secondary"
                        style={{ padding: '3px 8px', fontSize: '11px', color: '#dc2626', borderColor: '#fca5a5' }}
                        onClick={() => handleOpenVacateConfirm(b)}
                      >
                        <Trash2 size={11} />
                        <span>Vacate</span>
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="btn-enterprise-primary"
                      style={{ width: '100%', fontSize: '11.5px', padding: '4px' }}
                      onClick={() => handleOpenAllocateModal(b)}
                    >
                      <Plus size={12} />
                      <span>Allocate Student Here</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Table View */
          <div className="enterprise-table-container">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Room Code</th>
                  <th>Bed Space</th>
                  <th>Resident Student</th>
                  <th>Admission No</th>
                  <th>Slot Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBeds.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <strong style={{ color: '#0f172a' }}>Room {b.room_code}</strong>
                    </td>
                    <td>
                      <span className="badge-enterprise badge-purple">{b.bed_name}</span>
                    </td>
                    <td>
                      {b.is_occupied ? (
                        <strong style={{ color: '#0f172a', fontSize: '13px' }}>
                          {b.resident_name}
                        </strong>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '12px' }}>Unoccupied</span>
                      )}
                    </td>
                    <td>
                      {b.is_occupied ? (
                        <span className="code-pill">{b.admission_number}</span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>&mdash;</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge-enterprise ${b.is_occupied ? 'badge-purple' : 'badge-green'}`}>
                        {b.is_occupied ? 'OCCUPIED' : 'VACANT'}
                      </span>
                    </td>
                    <td>
                      {b.is_occupied ? (
                        <button
                          type="button"
                          className="btn-enterprise-secondary"
                          style={{ padding: '3px 8px', fontSize: '11px', color: '#dc2626' }}
                          onClick={() => handleOpenVacateConfirm(b)}
                        >
                          Vacate Bed
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn-enterprise-primary"
                          style={{ padding: '3px 8px', fontSize: '11px' }}
                          onClick={() => handleOpenAllocateModal(b)}
                        >
                          Allocate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* =================================================================== */}
      {/* MODAL: Allocate Student to Bed                                      */}
      {/* =================================================================== */}
      {isAllocateModalOpen && (
        <Modal
          isOpen={isAllocateModalOpen}
          onClose={() => setIsAllocateModalOpen(false)}
          title={`Allocate Student to Bed in ${myHostel?.hostel_name || 'Hostel'}`}
        >
          {allocateError && (
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
              {allocateError}
            </div>
          )}

          {allocateSuccess && (
            <div
              style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                color: '#166534',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                marginBottom: '16px',
              }}
            >
              {allocateSuccess}
            </div>
          )}

          <form onSubmit={handleAllocateSubmit}>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Select Student *
              </label>
              <select
                className="filter-select"
                style={{ width: '100%' }}
                value={allocateFormData.student_id}
                onChange={(e) => setAllocateFormData({ ...allocateFormData, student_id: e.target.value })}
                required
              >
                <option value="">-- Choose Unallocated Student --</option>
                {unallocatedStudents.map((s) => (
                  <option key={s.student_id} value={s.student_id}>
                    {s.full_name} ({s.admission_number}{s.roll_number ? ` - Roll: ${s.roll_number}` : ''})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Select Vacant Bed Space *
              </label>
              <select
                className="filter-select"
                style={{ width: '100%' }}
                value={allocateFormData.bed_id}
                onChange={(e) => setAllocateFormData({ ...allocateFormData, bed_id: e.target.value })}
                required
              >
                <option value="">-- Choose Vacant Bed --</option>
                {vacantBeds.map((b) => (
                  <option key={b.bed_id} value={b.bed_id}>
                    Room {b.room_code || b.room_name} - {b.bed_name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Allocation Date
                </label>
                <input
                  type="date"
                  className="filter-search-input"
                  style={{ width: '100%' }}
                  value={allocateFormData.allocated_at}
                  onChange={(e) => setAllocateFormData({ ...allocateFormData, allocated_at: e.target.value })}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Allocation Type
                </label>
                <select
                  className="filter-select"
                  style={{ width: '100%' }}
                  value={allocateFormData.allocation_type}
                  onChange={(e) => setAllocateFormData({ ...allocateFormData, allocation_type: e.target.value })}
                >
                  <option value="REGULAR">Regular Resident</option>
                  <option value="TEMPORARY">Temporary / Guest</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn-enterprise-secondary"
                onClick={() => setIsAllocateModalOpen(false)}
                disabled={allocateSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-enterprise-primary"
                disabled={allocateSubmitting}
              >
                {allocateSubmitting ? 'Allocating...' : 'Confirm Allocation'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* =================================================================== */}
      {/* MODAL: Vacate Bed Confirmation                                      */}
      {/* =================================================================== */}
      {vacateConfirmOpen && (
        <Modal
          isOpen={vacateConfirmOpen}
          onClose={() => setVacateConfirmOpen(false)}
          title="Confirm Vacate Bed"
        >
          <div style={{ marginBottom: '16px', fontSize: '13.5px', color: '#334155' }}>
            Are you sure you want to release the bed in{' '}
            <strong>Room {selectedAllocation?.room_code} ({selectedAllocation?.bed_name})</strong>{' '}
            assigned to <strong>{selectedAllocation?.resident_name}</strong>?
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              className="btn-enterprise-secondary"
              onClick={() => setVacateConfirmOpen(false)}
              disabled={vacateSubmitting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-enterprise-primary"
              style={{ background: '#dc2626', borderColor: '#dc2626' }}
              onClick={handleVacateConfirm}
              disabled={vacateSubmitting}
            >
              {vacateSubmitting ? 'Releasing...' : 'Confirm Vacate'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
