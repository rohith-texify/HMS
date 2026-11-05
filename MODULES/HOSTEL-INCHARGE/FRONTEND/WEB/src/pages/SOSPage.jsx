import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import inchargeService from '../services/inchargeService';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import SearchInput from '../components/SearchInput';
import Modal from '../components/Modal';
import LoadingState from '../components/LoadingState';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import Badge from '../components/Badge';
import {
  PhoneCall,
  ShieldCheck,
  RefreshCw,
  Phone,
  GraduationCap,
  Users,
  MapPin,
  HeartPulse,
  DoorOpen,
  Download,
  Shield
} from 'lucide-react';

export default function SOSPage() {
  const { assignedHostel } = useAuth();
  const navigate = useNavigate();

  // Active Tab
  const [activeTab, setActiveTab] = useState('STUDENTS'); // 'STUDENTS' | 'SECURITY' | 'STAFF'

  // Master Data State
  const [students, setStudents] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [securityAssignments, setSecurityAssignments] = useState([]);
  const [gates, setGates] = useState([]);

  // Selected Student Emergency Contacts State
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [emergencyContacts, setEmergencyContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contactsModalOpen, setContactsModalOpen] = useState(false);

  // UI & Loading States
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [roomFilter, setRoomFilter] = useState('ALL');
  const [bloodGroupFilter, setBloodGroupFilter] = useState('ALL');

  // Load Context
  const loadData = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    else setLoading(true);
    setErrorMessage(null);

    try {
      const [studentsRes, staffRes, secRes, gatesRes] = await Promise.allSettled([
        inchargeService.getStudents(),
        inchargeService.getStaff(),
        inchargeService.getSecurityAssignments(),
        inchargeService.getGates(),
      ]);

      if (studentsRes.status === 'fulfilled') {
        const val = studentsRes.value;
        const list = Array.isArray(val) ? val : val?.students || val?.data || [];
        setStudents(list);
      }

      if (staffRes.status === 'fulfilled') {
        const val = staffRes.value;
        setStaffList(Array.isArray(val) ? val : val?.staff || val?.data || []);
      }

      if (secRes.status === 'fulfilled') {
        const val = secRes.value;
        setSecurityAssignments(Array.isArray(val) ? val : val?.assignments || val?.data || []);
      }

      if (gatesRes.status === 'fulfilled') {
        const val = gatesRes.value;
        setGates(Array.isArray(val) ? val : val?.gates || val?.data || []);
      }
    } catch (err) {
      console.error('Failed to load emergency contacts context:', err);
      setErrorMessage(err.message || 'Failed to load emergency contacts directory.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load Student Emergency Contacts
  const handleInspectContacts = async (student) => {
    setSelectedStudent(student);
    setContactsModalOpen(true);
    setLoadingContacts(true);

    try {
      const studentId = student.student_id || student.id;
      const data = await inchargeService.getStudentEmergencyContacts(studentId);
      setEmergencyContacts(Array.isArray(data) ? data : data?.emergency_contacts || data?.contacts || []);
    } catch (err) {
      console.warn('Failed to load emergency contacts:', err);
      setEmergencyContacts([]);
    } finally {
      setLoadingContacts(false);
    }
  };

  // Filtered Students
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const name = s.full_name || `${s.first_name || ''} ${s.last_name || ''}`.trim() || '';
      const reg = s.admission_number || s.roll_number || s.reg_number || '';
      const room = s.room_name || s.room_code || s.room_number || '';
      const bg = s.blood_group || '';

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        if (!name.toLowerCase().includes(term) && !reg.toLowerCase().includes(term) && !room.toLowerCase().includes(term)) {
          return false;
        }
      }

      if (roomFilter !== 'ALL' && room !== roomFilter) {
        return false;
      }

      if (bloodGroupFilter !== 'ALL' && bg.toUpperCase() !== bloodGroupFilter) {
        return false;
      }

      return true;
    });
  }, [students, searchTerm, roomFilter, bloodGroupFilter]);

  // Unique Rooms & Blood Groups
  const availableRooms = useMemo(() => {
    const set = new Set();
    students.forEach((s) => {
      const r = s.room_name || s.room_code || s.room_number;
      if (r) set.add(r);
    });
    return Array.from(set).sort();
  }, [students]);

  const availableBloodGroups = useMemo(() => {
    const set = new Set();
    students.forEach((s) => {
      if (s.blood_group) set.add(s.blood_group.toUpperCase());
    });
    return Array.from(set).sort();
  }, [students]);

  // Export CSV of Emergency Contacts Roster
  const handleExportCSV = () => {
    if (filteredStudents.length === 0) return;

    const headers = ['Resident Student', 'Registration Number', 'Room', 'Bed', 'Blood Group', 'Phone', 'Hostel'];
    const rows = filteredStudents.map((s) => [
      `"${s.full_name || s.first_name || 'Resident'}"`,
      `"${s.admission_number || s.roll_number || '—'}"`,
      `"${s.room_name || s.room_code || '—'}"`,
      `"${s.bed_name || 'Bed'}"`,
      `"${s.blood_group || 'Unknown'}"`,
      `"${s.phone || '—'}"`,
      `"${assignedHostel?.name || 'Assigned Hostel'}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Resident_Emergency_Contacts_Roster_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Student Columns
  const studentColumns = [
    {
      header: 'Resident Student',
      accessor: 'full_name',
      cell: (row) => {
        const name = row.full_name || `${row.first_name || ''} ${row.last_name || ''}`.trim() || 'Resident Student';
        const reg = row.admission_number || row.roll_number || '—';
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: '#fee2e2',
                color: '#b91c1c',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.85rem',
                flexShrink: 0,
              }}
            >
              {name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div
                style={{ fontWeight: 600, color: 'var(--primary-color)', cursor: 'pointer' }}
                onClick={() => navigate(`/students?search=${encodeURIComponent(reg || name)}`)}
                title="View resident profile"
              >
                {name}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Reg: <strong>{reg}</strong>
              </div>
            </div>
          </div>
        );
      },
    },
    {
      header: 'Accommodation',
      accessor: 'room_name',
      cell: (row) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
            Room {row.room_name || row.room_code || '—'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {row.bed_name || 'Assigned Bed'}
          </div>
        </div>
      ),
    },
    {
      header: 'Blood Group',
      accessor: 'blood_group',
      cell: (row) => (
        <div>
          {row.blood_group ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                backgroundColor: '#fef2f2',
                color: '#b91c1c',
                border: '1px solid #fecaca',
                borderRadius: '4px',
                fontWeight: 700,
                fontSize: '0.8rem',
              }}
            >
              <HeartPulse size={12} />
              <span>{row.blood_group.toUpperCase()}</span>
            </span>
          ) : (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Not Recorded</span>
          )}
        </div>
      ),
    },
    {
      header: 'Primary Phone',
      accessor: 'phone',
      cell: (row) => (
        <div style={{ fontSize: '0.82rem' }}>
          {row.phone ? (
            <a href={`tel:${row.phone}`} style={{ textDecoration: 'none', color: '#b91c1c', fontWeight: 600 }}>
              {row.phone}
            </a>
          ) : (
            '—'
          )}
        </div>
      ),
    },
    {
      header: 'Emergency Contacts',
      accessor: 'actions',
      cell: (row) => (
        <button
          type="button"
          className="btn btn-sm btn-outline"
          onClick={() => handleInspectContacts(row)}
          style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '5px', borderColor: '#fca5a5', color: '#b91c1c' }}
        >
          <PhoneCall size={13} />
          <span>View Contacts</span>
        </button>
      ),
    },
  ];

  return (
    <div style={{ paddingBottom: '40px' }}>
      {/* Page Header */}
      <PageHeader
        title="Resident Emergency Contacts Directory"
        description="Reference roster of resident emergency contacts and campus gate assignments. Real-time SOS alerts and physical incident dispatch are managed by Security."
        icon={PhoneCall}
        actions={
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => loadData(true)}
              disabled={isRefreshing}
              style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={handleExportCSV}
              disabled={filteredStudents.length === 0}
              style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Download size={14} />
              <span>Export Roster</span>
            </button>
          </div>
        }
      />

      {/* Security Incident Command & Missing SOS API Notice */}
      <div
        style={{
          marginBottom: '20px',
          padding: '14px 18px',
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
        }}
      >
        <ShieldCheck size={20} color="#2563eb" style={{ marginTop: '2px', flexShrink: 0 }} />
        <div style={{ fontSize: '0.85rem', color: '#1e40af', lineHeight: 1.5 }}>
          <strong>Incident Management & Real-Time Alert API Status:</strong> Real-time SOS broadcast and incident
          dispatch routes (<code>/college/sos</code>) are not registered in the API. Physical emergency response, perimeter
          lockdown, and formal incident resolution are handled by Campus Security and institutional emergency teams.
          This directory provides verified resident emergency contacts (<code>/college/students/:id/emergency-contacts</code>)
          and registered staff/guard assignments for authorized emergency communication.
        </div>
      </div>

      {/* Verified KPI Summary Cards */}
      <div className="grid-4" style={{ marginBottom: '24px' }}>
        <div className="card stat-card" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                Monitored Residents
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                {students.length}
              </div>
            </div>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '8px',
                backgroundColor: '#eff6ff',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Users size={20} />
            </div>
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
            Resident student safety roster
          </div>
        </div>

        <div className="card stat-card" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                Campus Access Gates
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                {gates.length}
              </div>
            </div>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '8px',
                backgroundColor: '#eff6ff',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <DoorOpen size={20} />
            </div>
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
            Perimeter security gate locations
          </div>
        </div>

        <div className="card stat-card" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                Security Gate Assignments
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#059669', marginTop: '4px' }}>
                {securityAssignments.length}
              </div>
            </div>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '8px',
                backgroundColor: '#ecfdf5',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ShieldCheck size={20} />
            </div>
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
            Registered security personnel assignments
          </div>
        </div>

        <div className="card stat-card" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                Staff & Warden Contacts
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                {staffList.length}
              </div>
            </div>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '8px',
                backgroundColor: '#f1f5f9',
                color: '#475569',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <GraduationCap size={20} />
            </div>
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
            College staff contact network
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-color)',
          marginBottom: '20px',
          gap: '24px',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('STUDENTS')}
          style={{
            padding: '10px 4px',
            border: 'none',
            borderBottom: activeTab === 'STUDENTS' ? '2px solid var(--primary-color)' : '2px solid transparent',
            backgroundColor: 'transparent',
            color: activeTab === 'STUDENTS' ? 'var(--primary-color)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'STUDENTS' ? 700 : 500,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <PhoneCall size={16} />
          <span>Resident Emergency Contacts</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('SECURITY')}
          style={{
            padding: '10px 4px',
            border: 'none',
            borderBottom: activeTab === 'SECURITY' ? '2px solid var(--primary-color)' : '2px solid transparent',
            backgroundColor: 'transparent',
            color: activeTab === 'SECURITY' ? 'var(--primary-color)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'SECURITY' ? 700 : 500,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Shield size={16} />
          <span>Registered Gate Security Assignments</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('STAFF')}
          style={{
            padding: '10px 4px',
            border: 'none',
            borderBottom: activeTab === 'STAFF' ? '2px solid var(--primary-color)' : '2px solid transparent',
            backgroundColor: 'transparent',
            color: activeTab === 'STAFF' ? 'var(--primary-color)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'STAFF' ? 700 : 500,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <GraduationCap size={16} />
          <span>College Staff Directory</span>
        </button>
      </div>

      {/* Main Tab Content */}
      {loading ? (
        <LoadingState title="Loading emergency contacts roster..." rows={5} />
      ) : errorMessage ? (
        <ErrorState title="Failed to Load Data" message={errorMessage} onRetry={() => loadData(false)} />
      ) : activeTab === 'STUDENTS' ? (
        <div>
          {/* Search Toolbar */}
          <div
            className="card"
            style={{
              padding: '14px 18px',
              marginBottom: '16px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '12px',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ flex: '1 1 260px', minWidth: '220px' }}>
              <SearchInput
                placeholder="Search resident student, roll number, or room..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onClear={() => setSearchTerm('')}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <select
                className="form-control"
                value={roomFilter}
                onChange={(e) => setRoomFilter(e.target.value)}
                style={{ width: 'auto', minWidth: '130px', fontSize: '0.85rem' }}
              >
                <option value="ALL">All Rooms</option>
                {availableRooms.map((r) => (
                  <option key={r} value={r}>
                    Room {r}
                  </option>
                ))}
              </select>

              <select
                className="form-control"
                value={bloodGroupFilter}
                onChange={(e) => setBloodGroupFilter(e.target.value)}
                style={{ width: 'auto', minWidth: '140px', fontSize: '0.85rem' }}
              >
                <option value="ALL">All Blood Groups</option>
                {availableBloodGroups.map((bg) => (
                  <option key={bg} value={bg}>
                    Blood: {bg}
                  </option>
                ))}
              </select>

              {(searchTerm || roomFilter !== 'ALL' || bloodGroupFilter !== 'ALL') && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setSearchTerm('');
                    setRoomFilter('ALL');
                    setBloodGroupFilter('ALL');
                  }}
                  style={{ fontSize: '0.82rem', padding: '6px 10px' }}
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {filteredStudents.length === 0 ? (
            <EmptyState
              title="No Resident Students Match Search"
              description="Check the name, room number, or blood group filter."
              icon={PhoneCall}
            />
          ) : (
            <div className="card" style={{ overflow: 'hidden' }}>
              <DataTable columns={studentColumns} data={filteredStudents} keyField="student_id" />
            </div>
          )}
        </div>
      ) : activeTab === 'SECURITY' ? (
        /* Security Guard Coverage */
        <div>
          {securityAssignments.length === 0 ? (
            <EmptyState title="No Security Assignments Found" description="No registered security assignments in database." icon={ShieldCheck} />
          ) : (
            <div className="grid-3" style={{ gap: '16px' }}>
              {securityAssignments.map((a, idx) => (
                <div key={a.id || idx} className="card" style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {a.staff_name || a.guard_name || 'Security Personnel'}
                      </h4>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        Assignment ID: <code>{(a.id || '').slice(0, 8)}</code>
                      </div>
                    </div>
                    <Badge variant="neutral">Assigned</Badge>
                  </div>

                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <MapPin size={13} />
                      <span>{a.gate_name || 'Campus Gate Security Point'}</span>
                    </div>
                  </div>

                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    Shift Record: <strong>{a.shift || 'General Shift'}</strong>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Staff Directory */
        <div>
          {staffList.length === 0 ? (
            <EmptyState title="No College Staff Found" description="No staff records returned." icon={GraduationCap} />
          ) : (
            <div className="grid-3" style={{ gap: '16px' }}>
              {staffList.map((s, idx) => (
                <div key={s.id || idx} className="card" style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {s.full_name || s.name || `${s.first_name || ''} ${s.last_name || ''}`.trim() || 'Staff Member'}
                      </h4>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        Role: <strong>{s.role || 'Staff'}</strong>
                      </div>
                    </div>
                    <Badge variant={s.status === 'ACTIVE' ? 'success' : 'neutral'}>{s.status || 'ACTIVE'}</Badge>
                  </div>

                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    {s.phone && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Phone size={13} />
                        <a href={`tel:${s.phone}`} style={{ textDecoration: 'none', color: 'var(--primary-color)' }}>
                          {s.phone}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Emergency Contacts Modal */}
      <Modal
        isOpen={contactsModalOpen}
        onClose={() => setContactsModalOpen(false)}
        title="Resident Emergency Contacts"
        maxWidth="600px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            {selectedStudent && (
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  setContactsModalOpen(false);
                  navigate(`/students?search=${encodeURIComponent(selectedStudent.admission_number || selectedStudent.full_name || '')}`);
                }}
                style={{ fontSize: '0.82rem' }}
              >
                View Full Student Profile
              </button>
            )}
            <button type="button" className="btn btn-primary" onClick={() => setContactsModalOpen(false)}>
              Close
            </button>
          </div>
        }
      >
        {selectedStudent && (
          <div>
            <div
              style={{
                padding: '14px 16px',
                backgroundColor: '#f8fafc',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                marginBottom: '16px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                    {selectedStudent.full_name || selectedStudent.first_name}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Reg: <strong>{selectedStudent.admission_number || selectedStudent.roll_number || '—'}</strong> • Room:{' '}
                    <strong>{selectedStudent.room_name || selectedStudent.room_code || '—'}</strong>
                  </div>
                </div>
                {selectedStudent.blood_group && (
                  <span
                    style={{
                      padding: '4px 10px',
                      backgroundColor: '#fef2f2',
                      color: '#b91c1c',
                      border: '1px solid #fecaca',
                      borderRadius: '6px',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                    }}
                  >
                    Blood: {selectedStudent.blood_group.toUpperCase()}
                  </span>
                )}
              </div>
            </div>

            <div style={{ marginBottom: '14px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Note: These emergency contacts are authoritative records from the student database (<code>/college/students/:id/emergency-contacts</code>).
            </div>

            {loadingContacts ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                Loading emergency contacts...
              </div>
            ) : emergencyContacts.length === 0 ? (
              <div
                style={{
                  padding: '24px',
                  backgroundColor: '#fef2f2',
                  borderRadius: '6px',
                  textAlign: 'center',
                  fontSize: '0.85rem',
                  color: '#991b1b',
                  border: '1px dashed #fecaca',
                }}
              >
                No emergency contacts configured for this student. Use primary phone{' '}
                <strong>{selectedStudent.phone || 'Not available'}</strong> or consult the student profile.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {emergencyContacts.map((c, idx) => (
                  <div
                    key={c.id || idx}
                    style={{
                      padding: '14px 16px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #fde68a',
                      borderRadius: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '10px',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                        {c.name || c.contact_name || 'Emergency Contact'}
                      </div>
                      <div style={{ fontSize: '0.76rem', color: '#b45309', marginTop: '2px' }}>
                        Relationship: <strong>{c.relationship || 'Emergency'}</strong>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {c.phone && (
                        <a
                          href={`tel:${c.phone}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '6px 14px',
                            backgroundColor: '#b91c1c',
                            color: '#ffffff',
                            borderRadius: '6px',
                            textDecoration: 'none',
                            fontSize: '0.85rem',
                            fontWeight: 700,
                          }}
                        >
                          <PhoneCall size={13} />
                          <span>Call: {c.phone}</span>
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
