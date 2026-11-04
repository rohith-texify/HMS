import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../../shared/api/api';
import adminService from '../../admin/services/adminService';
import {
  Users,
  Search,
  RefreshCw,
  Plus,
  BedDouble,
  Building2,
  Phone,
  Mail,
  UserCheck,
  Calendar,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Filter,
  Trash2,
  Layers,
  Sparkles,
} from 'lucide-react';
import { LoadingState, EmptyState, Modal } from '../../../shared/components';

export default function InchargeStudentsPage() {
  const [myHostel, setMyHostel] = useState(null);
  const [residents, setResidents] = useState([]);
  const [vacantBeds, setVacantBeds] = useState([]);
  const [unallocatedStudents, setUnallocatedStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [roomFilter, setRoomFilter] = useState('ALL');
  const [genderFilter, setGenderFilter] = useState('ALL');

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

      // 1. Resolve logged-in incharge's assigned hostel
      const hostelRes = await adminService.getMyHostel();
      const hostel = hostelRes.data || hostelRes;
      setMyHostel(hostel);

      if (hostel?.hostel_id) {
        // 2. Fetch residents and vacant beds for this hostel
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
      console.error('Failed to load incharge students data:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Unique Room Codes for Filter
  const uniqueRooms = useMemo(() => {
    return Array.from(new Set(residents.map((r) => r.room_code).filter(Boolean))).sort();
  }, [residents]);

  // Filtered Residents
  const filteredResidents = useMemo(() => {
    return residents.filter((r) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !search ||
        (r.full_name || '').toLowerCase().includes(q) ||
        (r.admission_number || '').toLowerCase().includes(q) ||
        (r.roll_number || '').toLowerCase().includes(q) ||
        (r.room_code || '').toLowerCase().includes(q) ||
        (r.bed_name || '').toLowerCase().includes(q) ||
        (r.phone || '').toLowerCase().includes(q);

      const matchesRoom = roomFilter === 'ALL' || r.room_code === roomFilter;
      const matchesGender = genderFilter === 'ALL' || (r.gender || '').toUpperCase() === genderFilter;

      return matchesSearch && matchesRoom && matchesGender;
    });
  }, [residents, search, roomFilter, genderFilter]);

  const handleOpenAllocateModal = () => {
    setAllocateError(null);
    setAllocateSuccess(null);
    setAllocateFormData({
      student_id: unallocatedStudents[0]?.student_id || '',
      bed_id: vacantBeds[0]?.bed_id || '',
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
      setAllocateError('Please select a student to allocate.');
      return;
    }
    if (!allocateFormData.bed_id) {
      setAllocateError('Please select an available bed space in this hostel.');
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

      setAllocateSuccess('Student assigned to hostel room and bed successfully!');
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
      alert(err.response?.data?.message || 'Failed to vacate student bed allocation.');
    } finally {
      setVacateSubmitting(false);
    }
  };

  return (
    <div className="fade-in-up">
      {/* Supervisory Facility Scope Banner */}
      {myHostel ? (
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
            boxShadow: '0 4px 12px rgba(30, 27, 75, 0.15)',
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
                <strong style={{ fontSize: '1.05rem', letterSpacing: '-0.01em' }}>
                  {myHostel.hostel_name}
                </strong>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '6px',
                    background: '#4338ca',
                    color: '#e0e7ff',
                  }}
                >
                  {myHostel.hostel_code || 'HOSTEL'}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    background: 'rgba(255, 255, 255, 0.15)',
                  }}
                >
                  {myHostel.hostel_type || 'RESIDENTIAL'}
                </span>
              </div>
              <span style={{ fontSize: '11.5px', color: '#c7d2fe', marginTop: '2px', display: 'block' }}>
                Supervised by: <strong>{myHostel.staff_name}</strong> ({myHostel.designation || 'Primary Incharge'}) &bull; Scoped strictly to this facility
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
              Capacity: <strong>{myHostel.total_capacity || residents.length + vacantBeds.length} Beds</strong>
            </span>
          </div>
        </div>
      ) : !loading && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '12px',
            padding: '16px 20px',
            marginBottom: '20px',
            color: '#991b1b',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <AlertCircle size={22} style={{ flexShrink: 0 }} />
          <div>
            <strong>No Active Hostel Assignment Linked</strong>
            <p style={{ margin: 0, fontSize: '13px', color: '#b91c1c' }}>
              Your incharge profile does not have an active hostel facility assignment. Please contact College Administration to link your account to a hostel.
            </p>
          </div>
        </div>
      )}

      {/* Enterprise Hero Header */}
      <div className="enterprise-hero-header">
        <div className="hero-header-titles">
          <div className="hero-category-pill">
            <Users size={13} />
            <span>Facility Roster &amp; Residents</span>
          </div>
          <h1 className="hero-main-title">Hostel Resident Directory &amp; Allocations</h1>
          <p className="hero-subtitle">
            Manage assigned students living in {myHostel?.hostel_name || 'this facility'}, assign incoming students to available beds, and maintain room allocations.
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
            <span>{isRefreshing ? 'Syncing...' : 'Sync Residents'}</span>
          </button>

          <button
            type="button"
            className="btn-enterprise-primary"
            onClick={handleOpenAllocateModal}
            disabled={vacantBeds.length === 0}
          >
            <Plus size={15} />
            <span>Assign Student to Bed</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="kpi-cards-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Active Residents</span>
            <div className="stat-kpi-icon-wrap purple">
              <Users size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-purple-600">{residents.length}</div>
          <div className="stat-kpi-footnote">
            <span className="status-dot green" />
            <span>Students housed in this facility</span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Available Vacant Beds</span>
            <div className="stat-kpi-icon-wrap green">
              <BedDouble size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-green-600">{vacantBeds.length}</div>
          <div className="stat-kpi-footnote">
            <span>Ready for student assignment</span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Occupied Rooms</span>
            <div className="stat-kpi-icon-wrap blue">
              <Building2 size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-blue-600">{uniqueRooms.length}</div>
          <div className="stat-kpi-footnote">
            <span>Rooms currently housing students</span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Unallocated Students</span>
            <div className="stat-kpi-icon-wrap orange">
              <UserCheck size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-orange-600">{unallocatedStudents.length}</div>
          <div className="stat-kpi-footnote">
            <span>Awaiting hostel room allocation</span>
          </div>
        </div>
      </div>

      {/* Main Resident Directory Card */}
      <div className="enterprise-card">
        <div className="card-topbar">
          <div className="card-title-group">
            <div className="card-title-icon-wrap">
              <Users size={16} />
            </div>
            <h2 className="card-title-text">
              Assigned Residents of {myHostel?.hostel_name || 'Hostel'} ({filteredResidents.length})
            </h2>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span className="stats-tally-pill" style={{ color: '#4338ca', background: '#e0e7ff', borderColor: '#c7d2fe' }}>
              <BedDouble size={12} />
              <span>{filteredResidents.length} of {residents.length} Shown</span>
            </span>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="enterprise-filter-bar">
          <div className="filter-search-field">
            <Search size={14} className="filter-search-icon" />
            <input
              type="text"
              className="filter-search-input"
              placeholder="Search resident name, roll no, admission no, room..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <select
              className="filter-select"
              value={roomFilter}
              onChange={(e) => setRoomFilter(e.target.value)}
            >
              <option value="ALL">All Rooms</option>
              {uniqueRooms.map((r) => (
                <option key={r} value={r}>
                  Room {r}
                </option>
              ))}
            </select>

            <select
              className="filter-select"
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value)}
            >
              <option value="ALL">All Genders</option>
              <option value="MALE">MALE</option>
              <option value="FEMALE">FEMALE</option>
            </select>
          </div>
        </div>

        {/* Residents Table */}
        <div className="enterprise-table-container">
          <table className="enterprise-table">
            <thead>
              <tr>
                <th>Resident Student</th>
                <th>Admission / Roll No</th>
                <th>Assigned Room &amp; Bed</th>
                <th>Contact Info</th>
                <th>Allocation Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '36px' }}>
                    <LoadingState message="Loading assigned hostel residents..." />
                  </td>
                </tr>
              ) : filteredResidents.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '36px' }}>
                    <EmptyState
                      title="No resident students found"
                      message="No students are currently allocated to this hostel facility matching the filters."
                    />
                  </td>
                </tr>
              ) : (
                filteredResidents.map((r) => (
                  <tr key={r.allocation_id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            background: '#e0e7ff',
                            color: '#4338ca',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '13px',
                            flexShrink: 0,
                          }}
                        >
                          {(r.first_name || 'S')[0].toUpperCase()}
                        </div>
                        <div>
                          <strong style={{ color: '#0f172a', display: 'block', fontSize: '13.5px' }}>
                            {r.full_name}
                          </strong>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>
                            {r.gender || 'Student'} &bull; {r.blood_group ? `Blood: ${r.blood_group}` : 'Verified'}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span className="code-pill" style={{ fontWeight: 600 }}>
                          {r.admission_number}
                        </span>
                        {r.roll_number && (
                          <span style={{ fontSize: '11px', color: '#64748b' }}>
                            Roll: {r.roll_number}
                          </span>
                        )}
                      </div>
                    </td>

                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className="badge-enterprise badge-purple" style={{ fontSize: '11px' }}>
                            Room {r.room_code || r.room_name}
                          </span>
                          <span className="badge-enterprise badge-blue" style={{ fontSize: '11px' }}>
                            {r.bed_name}
                          </span>
                        </div>
                        {r.block_name && (
                          <span style={{ fontSize: '11px', color: '#64748b' }}>
                            {r.block_name}
                          </span>
                        )}
                      </div>
                    </td>

                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '12px' }}>
                        {r.phone && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#334155' }}>
                            <Phone size={12} style={{ color: '#64748b' }} />
                            <span>{r.phone}</span>
                          </span>
                        )}
                        {r.email && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#64748b', fontSize: '11px' }}>
                            <Mail size={12} />
                            <span>{r.email}</span>
                          </span>
                        )}
                      </div>
                    </td>

                    <td>
                      <span style={{ fontSize: '12px', color: '#475569' }}>
                        {r.allocated_at ? new Date(r.allocated_at).toLocaleDateString() : 'Active'}
                      </span>
                    </td>

                    <td>
                      <span className="badge-enterprise badge-green">
                        HOUSED
                      </span>
                    </td>

                    <td>
                      <button
                        type="button"
                        className="btn-enterprise-secondary"
                        style={{ padding: '3px 8px', fontSize: '11px', color: '#dc2626', borderColor: '#fca5a5' }}
                        onClick={() => handleOpenVacateConfirm(r)}
                        title="Vacate and release this bed slot"
                      >
                        <Trash2 size={12} />
                        <span>Vacate Bed</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =================================================================== */}
      {/* MODAL: Allocate Student to Hostel Bed                              */}
      {/* =================================================================== */}
      {isAllocateModalOpen && (
        <Modal
          isOpen={isAllocateModalOpen}
          onClose={() => setIsAllocateModalOpen(false)}
          title={`Assign Student to ${myHostel?.hostel_name || 'Hostel'}`}
        >
          <div style={{ marginBottom: '14px', color: '#64748b', fontSize: '13px' }}>
            Select an enrolled student to assign to a vacant bed in this facility. Once confirmed, the student will officially reside in this hostel.
          </div>

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
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{allocateError}</span>
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
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
              <span>{allocateSuccess}</span>
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
                <option value="">-- Choose Vacant Bed in this Hostel --</option>
                {vacantBeds.map((b) => (
                  <option key={b.bed_id} value={b.bed_id}>
                    Room {b.room_code || b.room_name} - {b.bed_name} {b.block_name ? `(${b.block_name})` : ''}
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
                  <option value="SPECIAL">Special Academic Term</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Allocation Remarks (Optional)
              </label>
              <input
                type="text"
                className="filter-search-input"
                style={{ width: '100%' }}
                placeholder="e.g. Standard single bed assignment"
                value={allocateFormData.remarks}
                onChange={(e) => setAllocateFormData({ ...allocateFormData, remarks: e.target.value })}
              />
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
                <UserCheck size={14} />
                <span>{allocateSubmitting ? 'Assigning...' : 'Confirm Bed Assignment'}</span>
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
          title="Confirm Vacate Bed Allocation"
        >
          <div style={{ marginBottom: '16px', fontSize: '13.5px', color: '#334155' }}>
            Are you sure you want to vacate the bed allocation for{' '}
            <strong>{selectedAllocation?.full_name}</strong> in{' '}
            <strong>Room {selectedAllocation?.room_code} ({selectedAllocation?.bed_name})</strong>?
            <p style={{ marginTop: '8px', color: '#64748b', fontSize: '12px' }}>
              This will release the bed slot back to the facility vacant inventory.
            </p>
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
              {vacateSubmitting ? 'Releasing...' : 'Vacate Bed'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
