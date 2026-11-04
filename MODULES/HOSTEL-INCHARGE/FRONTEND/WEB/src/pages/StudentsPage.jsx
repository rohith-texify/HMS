import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import inchargeService from '../services/inchargeService';
import PageHeader from '../components/PageHeader';
import LoadingState from '../components/LoadingState';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import SearchInput from '../components/SearchInput';
import { exportToCSV } from '../utils/exportUtils';
import { formatDate, truncateUUID } from '../utils/formatUtils';
import {
  Users,
  Search,
  Filter,
  Download,
  RefreshCw,
  Building2,
  BedDouble,
  KeyRound,
  ClipboardList,
  Phone,
  Mail,
  HeartPulse,
  ShieldCheck,
  User,
  Eye,
  AlertCircle,
  CheckCircle2,
  PhoneCall,
  UserCheck,
  X,
  FileText,
  MapPin,
  Calendar,
} from 'lucide-react';

export default function StudentsPage() {
  const navigate = useNavigate();
  const { assignedHostel } = useAuth();

  // Master Data
  const [residents, setResidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [exportSuccess, setExportSuccess] = useState(null);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [blockFilter, setBlockFilter] = useState('ALL');
  const [genderFilter, setGenderFilter] = useState('ALL');
  const [bloodGroupFilter, setBloodGroupFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Pagination & Sorting State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortField, setSortField] = useState('name');
  const [sortAsc, setSortAsc] = useState(true);

  // Profile Modal State
  const [selectedResident, setSelectedResident] = useState(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [studentParents, setStudentParents] = useState([]);
  const [studentEmergencyContacts, setStudentEmergencyContacts] = useState([]);
  const [studentFullDetails, setStudentFullDetails] = useState(null);

  // Load residents assigned strictly to the authenticated hostel
  const loadResidents = useCallback(
    async (isSilent = false) => {
      try {
        if (isSilent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }
        setError(null);

        const hostelId = assignedHostel?.id || assignedHostel?.hostel_id;
        const data = await inchargeService.getHostelResidents(hostelId);
        setResidents(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message || 'Failed to load assigned hostel residents roster.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [assignedHostel]
  );

  useEffect(() => {
    loadResidents(false);
  }, [loadResidents]);

  // Derive unique filter options from actual resident data
  const availableBlocks = useMemo(() => {
    const blocks = new Set();
    residents.forEach((r) => {
      if (r.block_name) blocks.add(r.block_name);
    });
    return Array.from(blocks).sort();
  }, [residents]);

  const availableBloodGroups = useMemo(() => {
    const bgs = new Set();
    residents.forEach((r) => {
      if (r.blood_group) bgs.add(r.blood_group.toUpperCase());
    });
    return Array.from(bgs).sort();
  }, [residents]);

  // Search and Filter computation
  const filteredResidents = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();

    return residents.filter((r) => {
      // Search matches
      const fullName = (r.full_name || `${r.first_name || ''} ${r.last_name || ''}`).toLowerCase();
      const admissionNo = (r.admission_number || '').toLowerCase();
      const rollNo = (r.roll_number || '').toLowerCase();
      const roomName = (r.room_name || r.room_code || '').toLowerCase();
      const bedName = (r.bed_name || '').toLowerCase();
      const phone = (r.phone || '').toLowerCase();
      const email = (r.email || '').toLowerCase();

      const matchesSearch =
        !term ||
        fullName.includes(term) ||
        admissionNo.includes(term) ||
        rollNo.includes(term) ||
        roomName.includes(term) ||
        bedName.includes(term) ||
        phone.includes(term) ||
        email.includes(term);

      if (!matchesSearch) return false;

      // Filter matches
      if (blockFilter !== 'ALL' && r.block_name !== blockFilter) return false;
      if (genderFilter !== 'ALL' && (r.gender || '').toUpperCase() !== genderFilter) return false;
      if (bloodGroupFilter !== 'ALL' && (r.blood_group || '').toUpperCase() !== bloodGroupFilter) return false;
      if (statusFilter !== 'ALL' && (r.hostel_status || 'HOUSED').toUpperCase() !== statusFilter) return false;

      return true;
    });
  }, [residents, searchTerm, blockFilter, genderFilter, bloodGroupFilter, statusFilter]);

  // Sort computation
  const sortedResidents = useMemo(() => {
    return [...filteredResidents].sort((a, b) => {
      let valA = '';
      let valB = '';

      switch (sortField) {
        case 'name':
          valA = (a.full_name || a.first_name || '').toLowerCase();
          valB = (b.full_name || b.first_name || '').toLowerCase();
          break;
        case 'room':
          valA = (a.room_name || a.room_code || '').toLowerCase();
          valB = (b.room_name || b.room_code || '').toLowerCase();
          break;
        case 'admission':
          valA = (a.admission_number || '').toLowerCase();
          valB = (b.admission_number || '').toLowerCase();
          break;
        case 'date':
          valA = new Date(a.allocated_at || 0).getTime();
          valB = new Date(b.allocated_at || 0).getTime();
          break;
        default:
          valA = (a.full_name || '').toLowerCase();
          valB = (b.full_name || '').toLowerCase();
      }

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [filteredResidents, sortField, sortAsc]);

  // Pagination slice
  const totalPages = Math.ceil(sortedResidents.length / pageSize) || 1;
  const paginatedResidents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedResidents.slice(start, start + pageSize);
  }, [sortedResidents, currentPage, pageSize]);

  // Summary Metrics
  const uniqueRoomsCount = useMemo(() => {
    const rooms = new Set();
    residents.forEach((r) => {
      if (r.room_id || r.room_name) rooms.add(r.room_id || r.room_name);
    });
    return rooms.size;
  }, [residents]);

  const medicalRecordedCount = useMemo(() => {
    return residents.filter((r) => Boolean(r.blood_group)).length;
  }, [residents]);

  // Load detailed profile (student info, parents, emergency contacts)
  const handleOpenProfile = async (resident) => {
    setSelectedResident(resident);
    setProfileModalOpen(true);
    setProfileLoading(true);
    setStudentParents([]);
    setStudentEmergencyContacts([]);
    setStudentFullDetails(null);

    const sId = resident.student_id || resident.id;
    if (!sId) {
      setProfileLoading(false);
      return;
    }

    try {
      const [detailsRes, parentsRes, emergencyRes] = await Promise.allSettled([
        inchargeService.getStudentDetails(sId),
        inchargeService.getStudentParents(sId),
        inchargeService.getStudentEmergencyContacts(sId),
      ]);

      if (detailsRes.status === 'fulfilled') {
        setStudentFullDetails(detailsRes.value);
      }
      if (parentsRes.status === 'fulfilled') {
        const raw = parentsRes.value;
        setStudentParents(Array.isArray(raw) ? raw : raw?.parents || raw?.data || []);
      }
      if (emergencyRes.status === 'fulfilled') {
        const raw = emergencyRes.value;
        setStudentEmergencyContacts(Array.isArray(raw) ? raw : raw?.emergency_contacts || raw?.data || []);
      }
    } catch (err) {
      console.warn('Failed to load full student sub-profile:', err);
    } finally {
      setProfileLoading(false);
    }
  };

  // Export filtered residents to CSV
  const handleExport = () => {
    if (!filteredResidents.length) return;

    const exportRows = filteredResidents.map((r) => ({
      FullName: r.full_name || `${r.first_name || ''} ${r.last_name || ''}`.trim(),
      AdmissionNumber: r.admission_number || '',
      RollNumber: r.roll_number || '',
      Gender: r.gender || '',
      BloodGroup: r.blood_group || '',
      Block: r.block_name || '',
      RoomNumber: r.room_name || r.room_code || '',
      BedLabel: r.bed_name || '',
      Phone: r.phone || '',
      Email: r.email || '',
      HostelStatus: r.hostel_status || 'HOUSED',
      AllocatedDate: r.allocated_at ? new Date(r.allocated_at).toLocaleDateString() : '',
    }));

    const hostelCode = assignedHostel?.code || 'hostel';
    exportToCSV(exportRows, `${hostelCode}_residents_${new Date().toISOString().split('T')[0]}.csv`);
    setExportSuccess(`Exported ${exportRows.length} resident records successfully.`);
    setTimeout(() => setExportSuccess(null), 3500);
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setBlockFilter('ALL');
    setGenderFilter('ALL');
    setBloodGroupFilter('ALL');
    setStatusFilter('ALL');
    setCurrentPage(1);
  };

  const hostelName = assignedHostel?.name || assignedHostel?.hostel_name || 'Assigned Hostel';

  return (
    <div>
      {/* Page Header */}
      <PageHeader
        title="Student Accommodation & Residents"
        description={`Verified student residents housed in ${hostelName}. Verified hostel scope.`}
        icon={Users}
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleExport}
              disabled={filteredResidents.length === 0}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              title="Export resident student roster to CSV"
            >
              <Download size={15} />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => loadResidents(true)}
              disabled={loading || refreshing}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              title="Refresh roster from server"
            >
              <RefreshCw size={15} className={refreshing ? 'spin' : ''} />
              <span>{refreshing ? 'Syncing...' : 'Refresh'}</span>
            </button>
          </div>
        }
      />

      {/* Export Success Notification */}
      {exportSuccess && (
        <div
          style={{
            backgroundColor: 'var(--success-bg)',
            color: 'var(--success-text)',
            border: '1px solid var(--success-border)',
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <CheckCircle2 size={16} />
          <span>{exportSuccess}</span>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <ErrorState
          title="Failed to Load Residents"
          message={error}
          onRetry={() => loadResidents(false)}
        />
      )}

      {/* Loading Skeleton */}
      {loading && <LoadingState title="Loading resident directory..." rows={5} />}

      {!loading && !error && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* 4 Telemetry Stat Cards */}
          <div className="grid-4">
            <div className="stat-card">
              <div className="stat-icon" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary-color)' }}>
                <Users size={22} />
              </div>
              <div>
                <div className="stat-value">{residents.length}</div>
                <div className="stat-label">Total Residents</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon" style={{ backgroundColor: 'var(--info-bg)', color: 'var(--info-text)' }}>
                <Building2 size={22} />
              </div>
              <div>
                <div className="stat-value">{uniqueRoomsCount}</div>
                <div className="stat-label">Occupied Rooms</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon" style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success-text)' }}>
                <BedDouble size={22} />
              </div>
              <div>
                <div className="stat-value">{availableBlocks.length || 1}</div>
                <div className="stat-label">Active Blocks / Wings</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon" style={{ backgroundColor: '#fef2f2', color: '#b91c1c' }}>
                <HeartPulse size={22} />
              </div>
              <div>
                <div className="stat-value">{medicalRecordedCount}</div>
                <div className="stat-label">Medical Data On File</div>
              </div>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="card" style={{ padding: '16px 20px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '14px',
              }}
            >
              {/* Search Bar */}
              <div style={{ flex: '1 1 280px', minWidth: '240px' }}>
                <SearchInput
                  value={searchTerm}
                  onChange={(val) => {
                    setSearchTerm(val);
                    setCurrentPage(1);
                  }}
                  placeholder="Search by name, roll no, room, bed, phone..."
                />
              </div>

              {/* Filter Controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                {/* Block Filter */}
                {availableBlocks.length > 0 && (
                  <select
                    value={blockFilter}
                    onChange={(e) => {
                      setBlockFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      fontSize: '0.85rem',
                      color: 'var(--text-primary)',
                      backgroundColor: 'var(--bg-surface)',
                      outline: 'none',
                    }}
                    aria-label="Filter by block"
                  >
                    <option value="ALL">All Blocks</option>
                    {availableBlocks.map((b) => (
                      <option key={b} value={b}>
                        Block {b}
                      </option>
                    ))}
                  </select>
                )}

                {/* Gender Filter */}
                <select
                  value={genderFilter}
                  onChange={(e) => {
                    setGenderFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    fontSize: '0.85rem',
                    color: 'var(--text-primary)',
                    backgroundColor: 'var(--bg-surface)',
                    outline: 'none',
                  }}
                  aria-label="Filter by gender"
                >
                  <option value="ALL">All Genders</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>

                {/* Blood Group Filter */}
                {availableBloodGroups.length > 0 && (
                  <select
                    value={bloodGroupFilter}
                    onChange={(e) => {
                      setBloodGroupFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      fontSize: '0.85rem',
                      color: 'var(--text-primary)',
                      backgroundColor: 'var(--bg-surface)',
                      outline: 'none',
                    }}
                    aria-label="Filter by blood group"
                  >
                    <option value="ALL">Blood Group (All)</option>
                    {availableBloodGroups.map((bg) => (
                      <option key={bg} value={bg}>
                        {bg}
                      </option>
                    ))}
                  </select>
                )}

                {/* Reset Filters */}
                {(searchTerm ||
                  blockFilter !== 'ALL' ||
                  genderFilter !== 'ALL' ||
                  bloodGroupFilter !== 'ALL' ||
                  statusFilter !== 'ALL') && (
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={handleResetFilters}
                    style={{ fontSize: '0.82rem', padding: '7px 12px' }}
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Results Counter */}
            <div
              style={{
                fontSize: '0.78rem',
                color: 'var(--text-secondary)',
                marginTop: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>Showing</span>
              <strong>{sortedResidents.length}</strong>
              <span>of</span>
              <strong>{residents.length}</strong>
              <span>assigned residents</span>
            </div>
          </div>

          {/* Primary Residents Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {sortedResidents.length === 0 ? (
              <div style={{ padding: '32px' }}>
                <EmptyState
                  icon={Users}
                  title="No Residents Found"
                  description={
                    residents.length === 0
                      ? 'No resident students are currently assigned to this hostel in the system.'
                      : 'No resident students match the selected search or filter criteria.'
                  }
                  action={
                    residents.length > 0 ? (
                      <button type="button" className="btn btn-secondary" onClick={handleResetFilters}>
                        Clear All Filters
                      </button>
                    ) : undefined
                  }
                />
              </div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th
                        onClick={() => {
                          if (sortField === 'name') setSortAsc(!sortAsc);
                          else {
                            setSortField('name');
                            setSortAsc(true);
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        Resident Student {sortField === 'name' && (sortAsc ? '▲' : '▼')}
                      </th>
                      <th
                        onClick={() => {
                          if (sortField === 'admission') setSortAsc(!sortAsc);
                          else {
                            setSortField('admission');
                            setSortAsc(true);
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        Admission / Roll No {sortField === 'admission' && (sortAsc ? '▲' : '▼')}
                      </th>
                      <th
                        onClick={() => {
                          if (sortField === 'room') setSortAsc(!sortAsc);
                          else {
                            setSortField('room');
                            setSortAsc(true);
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        Accommodation {sortField === 'room' && (sortAsc ? '▲' : '▼')}
                      </th>
                      <th>Contact Communication</th>
                      <th>Medical Info</th>
                      <th>Allotment Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedResidents.map((resident, idx) => {
                      const studentName =
                        resident.full_name ||
                        `${resident.first_name || ''} ${resident.last_name || ''}`.trim() ||
                        'Resident Student';
                      const initials = (studentName.slice(0, 2) || 'ST').toUpperCase();
                      const roomLabel = resident.room_name || resident.room_code || '—';
                      const bedLabel = resident.bed_name || 'Bed';

                      return (
                        <tr key={resident.student_id || resident.id || idx}>
                          {/* Student Identity */}
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div
                                style={{
                                  width: '36px',
                                  height: '36px',
                                  borderRadius: '50%',
                                  backgroundColor: 'var(--primary-light)',
                                  color: 'var(--primary-color)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 700,
                                  fontSize: '0.85rem',
                                  flexShrink: 0,
                                }}
                              >
                                {initials}
                              </div>
                              <div>
                                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.92rem' }}>
                                  {studentName}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  {resident.gender ? resident.gender.toUpperCase() : 'STUDENT'}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Admission Numbers */}
                          <td>
                            <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#334155' }}>
                              {resident.admission_number || '—'}
                            </div>
                            {resident.roll_number && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                Roll: {resident.roll_number}
                              </div>
                            )}
                          </td>

                          {/* Room & Bed Allocation */}
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span
                                style={{
                                  fontSize: '0.85rem',
                                  fontWeight: 700,
                                  color: 'var(--primary-color)',
                                  backgroundColor: 'var(--primary-light)',
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                }}
                              >
                                Room {roomLabel}
                              </span>
                              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                                ({bedLabel})
                              </span>
                            </div>
                            {resident.block_name && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                Block {resident.block_name}
                              </div>
                            )}
                          </td>

                          {/* Contact Info */}
                          <td>
                            {resident.phone ? (
                              <a
                                href={`tel:${resident.phone}`}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  fontSize: '0.82rem',
                                  color: 'var(--text-primary)',
                                  textDecoration: 'none',
                                }}
                              >
                                <Phone size={13} color="var(--primary-color)" />
                                <span>{resident.phone}</span>
                              </a>
                            ) : (
                              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>—</span>
                            )}
                            {resident.email && (
                              <a
                                href={`mailto:${resident.email}`}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  fontSize: '0.75rem',
                                  color: 'var(--text-secondary)',
                                  textDecoration: 'none',
                                  marginTop: '2px',
                                }}
                              >
                                <Mail size={12} color="#94a3b8" />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px' }}>
                                  {resident.email}
                                </span>
                              </a>
                            )}
                          </td>

                          {/* Medical / Blood Group */}
                          <td>
                            {resident.blood_group ? (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  backgroundColor: '#fef2f2',
                                  color: '#b91c1c',
                                  border: '1px solid #fecaca',
                                  borderRadius: '6px',
                                  padding: '2px 8px',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                }}
                              >
                                <HeartPulse size={12} />
                                <span>{resident.blood_group.toUpperCase()}</span>
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Not recorded</span>
                            )}
                          </td>

                          {/* Hostel Allotment Status */}
                          <td>
                            <span className="badge badge-resolved">
                              {resident.hostel_status || 'HOUSED'}
                            </span>
                          </td>

                          {/* Actions */}
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => handleOpenProfile(resident)}
                              style={{
                                padding: '6px 12px',
                                fontSize: '0.78rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                              }}
                            >
                              <Eye size={13} />
                              <span>View Profile</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {sortedResidents.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 20px',
                  borderTop: '1px solid var(--border-color)',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  <span>Rows per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      fontSize: '0.82rem',
                    }}
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                  >
                    Previous
                  </button>

                  <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', padding: '0 8px' }}>
                    Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
                  </span>

                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Detailed Resident Accommodation Profile Modal */}
      <Modal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        title="Resident Student Profile"
        maxWidth="760px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            {selectedResident && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => {
                    navigate(`/allocations?studentId=${selectedResident.student_id}`);
                  }}
                  className="btn btn-secondary"
                  style={{
                    fontSize: '0.82rem',
                    padding: '6px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <KeyRound size={14} />
                  <span>Allocation Record</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigate(
                      `/rooms?search=${encodeURIComponent(
                        selectedResident.room_name || selectedResident.room_code || ''
                      )}`
                    );
                  }}
                  className="btn btn-secondary"
                  style={{
                    fontSize: '0.82rem',
                    padding: '6px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <BedDouble size={14} />
                  <span>View Room</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigate(`/attendance?studentId=${selectedResident.student_id}`);
                  }}
                  className="btn btn-secondary"
                  style={{
                    fontSize: '0.82rem',
                    padding: '6px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <ClipboardList size={14} />
                  <span>Attendance</span>
                </button>
              </div>
            )}
            <button type="button" className="btn btn-primary" onClick={() => setProfileModalOpen(false)}>
              Close Profile
            </button>
          </div>
        }
      >
        {selectedResident && (
          <div>
            {profileLoading ? (
              <div style={{ padding: '40px', textAlign: 'center' }}>
                <LoadingSpinner message="Retrieving resident record and parent linkages..." />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* Profile Header Banner */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '16px 20px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-lg)',
                  }}
                >
                  <div
                    style={{
                      width: '54px',
                      height: '54px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--primary-color)',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '1.25rem',
                      flexShrink: 0,
                    }}
                  >
                    {(selectedResident.full_name || selectedResident.first_name || 'ST')
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {selectedResident.full_name ||
                        `${selectedResident.first_name || ''} ${selectedResident.last_name || ''}`.trim() ||
                        'Resident Student'}
                    </h3>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      Admission No: <strong>{selectedResident.admission_number || '—'}</strong> • Roll No:{' '}
                      <strong>{selectedResident.roll_number || '—'}</strong>
                    </p>
                  </div>
                </div>

                {/* Section 1: Residential Accommodation Scope */}
                <div>
                  <h4
                    style={{
                      fontSize: '0.95rem',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      marginBottom: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <BedDouble size={16} color="var(--primary-color)" />
                    <span>Hostel Accommodation Details</span>
                  </h4>
                  <div className="grid-3">
                    <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Assigned Hostel</div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', marginTop: '2px' }}>
                        {hostelName}
                      </div>
                    </div>
                    <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Room & Bed</div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--primary-color)', marginTop: '2px' }}>
                        Room {selectedResident.room_name || selectedResident.room_code || '—'} ({selectedResident.bed_name || 'Bed'})
                      </div>
                    </div>
                    <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Block / Wing</div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', marginTop: '2px' }}>
                        {selectedResident.block_name ? `Block ${selectedResident.block_name}` : 'Main Facility'}
                      </div>
                    </div>
                    <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Allocation Type</div>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)', marginTop: '2px' }}>
                        {selectedResident.allocation_type || 'REGULAR'}
                      </div>
                    </div>
                    <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Allocated Date</div>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)', marginTop: '2px' }}>
                        {formatDate(selectedResident.allocated_at)}
                      </div>
                    </div>
                    <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Allocation Reference</div>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#64748b', marginTop: '2px', fontFamily: 'monospace' }}>
                        {truncateUUID(selectedResident.allocation_id)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 2: Personal & Contact Information */}
                <div>
                  <h4
                    style={{
                      fontSize: '0.95rem',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      marginBottom: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <User size={16} color="var(--primary-color)" />
                    <span>Personal & Medical Information</span>
                  </h4>
                  <div className="grid-3">
                    <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Primary Contact Phone</div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', marginTop: '2px' }}>
                        {selectedResident.phone || '—'}
                      </div>
                    </div>
                    <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Student Email</div>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)', marginTop: '2px' }}>
                        {selectedResident.email || '—'}
                      </div>
                    </div>
                    <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Blood Group</div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#b91c1c', marginTop: '2px' }}>
                        {selectedResident.blood_group ? selectedResident.blood_group.toUpperCase() : 'Not Provided'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 3: Registered Parent & Guardian Information */}
                <div>
                  <h4
                    style={{
                      fontSize: '0.95rem',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      marginBottom: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <UserCheck size={16} color="var(--primary-color)" />
                    <span>Parents & Guardians ({studentParents.length})</span>
                  </h4>

                  {studentParents.length === 0 ? (
                    <div
                      style={{
                        padding: '16px',
                        backgroundColor: '#f8fafc',
                        borderRadius: '8px',
                        border: '1px dashed #cbd5e1',
                        textAlign: 'center',
                        fontSize: '0.85rem',
                        color: 'var(--text-muted)',
                      }}
                    >
                      No parent/guardian link records found in this student profile.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {studentParents.map((parent, pIdx) => (
                        <div
                          key={parent.id || pIdx}
                          style={{
                            padding: '12px 16px',
                            backgroundColor: '#ffffff',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '10px',
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                              {parent.name || `${parent.first_name || ''} ${parent.last_name || ''}`.trim() || 'Parent'}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              Relationship: <strong>{parent.relationship || 'GUARDIAN'}</strong> • Occupation:{' '}
                              {parent.occupation || '—'}
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {parent.phone && (
                              <a
                                href={`tel:${parent.phone}`}
                                className="btn btn-outline"
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  fontSize: '0.78rem',
                                  padding: '4px 10px',
                                }}
                              >
                                <PhoneCall size={13} color="var(--primary-color)" />
                                <span>{parent.phone}</span>
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Section 4: Emergency Contacts */}
                <div>
                  <h4
                    style={{
                      fontSize: '0.95rem',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      marginBottom: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <AlertCircle size={16} color="#b91c1c" />
                    <span>Emergency Contacts ({studentEmergencyContacts.length})</span>
                  </h4>

                  {studentEmergencyContacts.length === 0 ? (
                    <div
                      style={{
                        padding: '16px',
                        backgroundColor: '#fef2f2',
                        borderRadius: '8px',
                        border: '1px dashed #fecaca',
                        textAlign: 'center',
                        fontSize: '0.85rem',
                        color: '#991b1b',
                      }}
                    >
                      No emergency contact entries configured for this student.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {studentEmergencyContacts.map((contact, cIdx) => (
                        <div
                          key={contact.id || cIdx}
                          style={{
                            padding: '12px 16px',
                            backgroundColor: '#fffbeb',
                            border: '1px solid #fde68a',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '10px',
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#92400e' }}>
                              {contact.name || contact.contact_name || 'Emergency Contact'}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#b45309' }}>
                              Relationship: <strong>{contact.relationship || 'Emergency'}</strong>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {contact.phone && (
                              <a
                                href={`tel:${contact.phone}`}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  padding: '5px 12px',
                                  backgroundColor: '#b91c1c',
                                  color: '#ffffff',
                                  borderRadius: '6px',
                                  textDecoration: 'none',
                                  fontSize: '0.82rem',
                                  fontWeight: 600,
                                }}
                              >
                                <PhoneCall size={13} />
                                <span>{contact.phone}</span>
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
