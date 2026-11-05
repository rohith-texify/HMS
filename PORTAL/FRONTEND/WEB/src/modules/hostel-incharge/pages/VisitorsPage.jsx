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
  Users,
  UserCheck,
  ShieldCheck,
  DoorOpen,
  RefreshCw,
  MapPin,
  PhoneCall,
  Download
} from 'lucide-react';

export default function VisitorsPage() {
  const { assignedHostel } = useAuth();
  const navigate = useNavigate();

  // Active Tab
  const [activeTab, setActiveTab] = useState('PARENTS'); // 'PARENTS' | 'GATES'

  // Master Data State
  const [students, setStudents] = useState([]);
  const [gates, setGates] = useState([]);
  const [securityAssignments, setSecurityAssignments] = useState([]);

  // Selected Student for Parent/Guardian Inspection
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [parents, setParents] = useState([]);
  const [loadingParents, setLoadingParents] = useState(false);
  const [parentModalOpen, setParentModalOpen] = useState(false);

  // UI & Loading States
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [roomFilter, setRoomFilter] = useState('ALL');

  // Load Master Data
  const loadData = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    else setLoading(true);
    setErrorMessage(null);

    try {
      const [studentsRes, gatesRes, secRes] = await Promise.allSettled([
        inchargeService.getStudents(),
        inchargeService.getGates(),
        inchargeService.getSecurityAssignments(),
      ]);

      if (studentsRes.status === 'fulfilled') {
        const val = studentsRes.value;
        const list = Array.isArray(val) ? val : val?.students || val?.data || [];
        setStudents(list);
      }

      if (gatesRes.status === 'fulfilled') {
        const val = gatesRes.value;
        setGates(Array.isArray(val) ? val : val?.gates || val?.data || []);
      }

      if (secRes.status === 'fulfilled') {
        const val = secRes.value;
        setSecurityAssignments(Array.isArray(val) ? val : val?.assignments || val?.data || []);
      }
    } catch (err) {
      console.error('Failed to load parent directory context:', err);
      setErrorMessage(err.message || 'Failed to load resident directory.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load Parent / Guardian Contacts for Selected Student
  const handleInspectParents = async (student) => {
    setSelectedStudent(student);
    setParentModalOpen(true);
    setLoadingParents(true);

    try {
      const studentId = student.student_id || student.id;
      const data = await inchargeService.getStudentParents(studentId);
      setParents(Array.isArray(data) ? data : data?.parents || []);
    } catch (err) {
      console.warn('Failed to load student parents:', err);
      setParents([]);
    } finally {
      setLoadingParents(false);
    }
  };

  // Filtered Students
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const name = s.full_name || `${s.first_name || ''} ${s.last_name || ''}`.trim() || '';
      const reg = s.admission_number || s.roll_number || s.reg_number || '';
      const room = s.room_name || s.room_code || s.room_number || '';

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        if (!name.toLowerCase().includes(term) && !reg.toLowerCase().includes(term) && !room.toLowerCase().includes(term)) {
          return false;
        }
      }

      if (roomFilter !== 'ALL' && room !== roomFilter) {
        return false;
      }

      return true;
    });
  }, [students, searchTerm, roomFilter]);

  // Unique Rooms for Filter
  const availableRooms = useMemo(() => {
    const set = new Set();
    students.forEach((s) => {
      const r = s.room_name || s.room_code || s.room_number;
      if (r) set.add(r);
    });
    return Array.from(set).sort();
  }, [students]);

  // Export CSV of Resident Parent/Guardian Directory
  const handleExportCSV = () => {
    if (filteredStudents.length === 0) return;

    const headers = ['Resident Student', 'Registration Number', 'Room', 'Bed', 'Student Phone', 'Hostel'];
    const rows = filteredStudents.map((s) => [
      `"${s.full_name || s.first_name || 'Student'}"`,
      `"${s.admission_number || s.roll_number || '—'}"`,
      `"${s.room_name || s.room_code || '—'}"`,
      `"${s.bed_name || 'Bed'}"`,
      `"${s.phone || '—'}"`,
      `"${assignedHostel?.name || 'Assigned Hostel'}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Resident_Parent_Guardian_Directory_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Student Table Columns
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
                backgroundColor: 'var(--primary-light, #eff6ff)',
                color: 'var(--primary-color, #2563eb)',
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
      header: 'Department / Branch',
      accessor: 'department',
      cell: (row) => (
        <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>
          {row.department || row.branch || 'General'}
        </div>
      ),
    },
    {
      header: 'Student Contact',
      accessor: 'phone',
      cell: (row) => (
        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          {row.phone ? (
            <a href={`tel:${row.phone}`} style={{ textDecoration: 'none', color: 'var(--primary-color)' }}>
              {row.phone}
            </a>
          ) : (
            '—'
          )}
        </div>
      ),
    },
    {
      header: 'Parent/Guardian Linkage',
      accessor: 'actions',
      cell: (row) => (
        <button
          type="button"
          className="btn btn-sm btn-outline"
          onClick={() => handleInspectParents(row)}
          style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '5px' }}
        >
          <UserCheck size={13} />
          <span>View Parents/Guardians</span>
        </button>
      ),
    },
  ];

  return (
    <div style={{ paddingBottom: '40px' }}>
      {/* Page Header */}
      <PageHeader
        title="Resident Parent/Guardian Directory"
        description="Reference directory of resident students and their registered parent/guardian contacts. Physical visitor registration and gate logging are managed by Security."
        icon={Users}
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
              <span>Export Directory</span>
            </button>
          </div>
        }
      />

      {/* Security Role Boundary & Missing Visitor API Status Notice */}
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
          <strong>Security Ownership & API Integration Status:</strong> Campus Security personnel own physical visitor
          registration, identity verification, badge issuance, and gate entry/exit logging at perimeter gates.
          The backend HTTP endpoint for visitor management (<code>/college/visitors</code>) is currently not registered
          in the API. This interface serves as a read-only Resident Parent/Guardian Reference Directory based on
          authorized student relationships (<code>/college/students/:id/parents</code>). It does not represent actual
          visitor check-ins, check-outs, or visitor history.
        </div>
      </div>

      {/* Verified KPI Summary Cards */}
      <div className="grid-3" style={{ marginBottom: '24px' }}>
        <div className="card stat-card" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                Scoped Residents
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
            Resident student records in hostel scope
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
            Registered campus gate access points
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
      </div>

      {/* Tab Navigation */}
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
          onClick={() => setActiveTab('PARENTS')}
          style={{
            padding: '10px 4px',
            border: 'none',
            borderBottom: activeTab === 'PARENTS' ? '2px solid var(--primary-color)' : '2px solid transparent',
            backgroundColor: 'transparent',
            color: activeTab === 'PARENTS' ? 'var(--primary-color)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'PARENTS' ? 700 : 500,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Users size={16} />
          <span>Resident Parent & Guardian Reference</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('GATES')}
          style={{
            padding: '10px 4px',
            border: 'none',
            borderBottom: activeTab === 'GATES' ? '2px solid var(--primary-color)' : '2px solid transparent',
            backgroundColor: 'transparent',
            color: activeTab === 'GATES' ? 'var(--primary-color)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'GATES' ? 700 : 500,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <DoorOpen size={16} />
          <span>Registered Campus Gates</span>
        </button>
      </div>

      {/* Main Tab Content */}
      {loading ? (
        <LoadingState title="Loading resident parent directory..." rows={5} />
      ) : errorMessage ? (
        <ErrorState title="Failed to Load Data" message={errorMessage} onRetry={() => loadData(false)} />
      ) : activeTab === 'PARENTS' ? (
        <div>
          {/* Search & Filter Toolbar */}
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

              {(searchTerm || roomFilter !== 'ALL') && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setSearchTerm('');
                    setRoomFilter('ALL');
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
              description="Try adjusting your search criteria or clearing filters."
              icon={Users}
            />
          ) : (
            <div className="card" style={{ overflow: 'hidden' }}>
              <DataTable columns={studentColumns} data={filteredStudents} keyField="student_id" />
            </div>
          )}
        </div>
      ) : (
        /* Campus Gates Directory */
        <div>
          {gates.length === 0 ? (
            <EmptyState title="No Campus Gates Registered" description="No gate infrastructure found." icon={DoorOpen} />
          ) : (
            <div className="grid-3" style={{ gap: '16px' }}>
              {gates.map((g) => {
                const assignedGuards = securityAssignments.filter(
                  (a) => a.gate_id === g.id || a.gate_name === g.name
                );

                return (
                  <div key={g.id} className="card" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {g.name}
                        </h4>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          Code: <strong>{g.code || 'GATE'}</strong> • Type: {g.gate_type || 'Main Entry'}
                        </div>
                      </div>
                      <Badge variant={g.status === 'ACTIVE' ? 'success' : 'neutral'}>{g.status || 'ACTIVE'}</Badge>
                    </div>

                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <MapPin size={13} />
                        <span>{g.location || 'Campus Perimeter'}</span>
                      </div>
                    </div>

                    <div
                      style={{
                        padding: '10px 12px',
                        backgroundColor: '#f8fafc',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        fontSize: '0.78rem',
                      }}
                    >
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                        Assigned Security Guard Records
                      </div>
                      {assignedGuards.length === 0 ? (
                        <div style={{ color: 'var(--text-muted)' }}>No guard records currently linked to this gate.</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {assignedGuards.map((a, idx) => (
                            <div key={idx} style={{ color: '#047857' }}>
                              • {a.staff_name || a.guard_name || 'Security Personnel'} ({a.shift || 'General Shift'})
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Parent / Guardian Inspection Modal */}
      <Modal
        isOpen={parentModalOpen}
        onClose={() => setParentModalOpen(false)}
        title="Registered Parent/Guardian Contacts"
        maxWidth="600px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            {selectedStudent && (
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  setParentModalOpen(false);
                  navigate(`/students?search=${encodeURIComponent(selectedStudent.admission_number || selectedStudent.full_name || '')}`);
                }}
                style={{ fontSize: '0.82rem' }}
              >
                View Full Student Profile
              </button>
            )}
            <button type="button" className="btn btn-primary" onClick={() => setParentModalOpen(false)}>
              Close
            </button>
          </div>
        }
      >
        {selectedStudent && (
          <div>
            <div
              style={{
                padding: '12px 16px',
                backgroundColor: '#f8fafc',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                marginBottom: '16px',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                {selectedStudent.full_name || selectedStudent.first_name}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Reg: <strong>{selectedStudent.admission_number || selectedStudent.roll_number || '—'}</strong> • Room:{' '}
                <strong>{selectedStudent.room_name || selectedStudent.room_code || '—'}</strong>
              </div>
            </div>

            <div style={{ marginBottom: '14px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Note: These records reflect registered parent/guardian relationships in the student database, not physical visitor logs.
            </div>

            {loadingParents ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                Loading parent & guardian records...
              </div>
            ) : parents.length === 0 ? (
              <div
                style={{
                  padding: '20px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '6px',
                  textAlign: 'center',
                  fontSize: '0.85rem',
                  color: 'var(--text-secondary)',
                }}
              >
                No parent or guardian records linked to this student in the database.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {parents.map((p, idx) => (
                  <div
                    key={p.id || idx}
                    style={{
                      padding: '14px 16px',
                      backgroundColor: '#ffffff',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '10px',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                        {p.name || p.full_name || 'Parent / Guardian'}
                      </div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        Relationship: <strong>{p.relationship || 'Guardian'}</strong>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {p.phone && (
                        <a
                          href={`tel:${p.phone}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '6px 12px',
                            backgroundColor: '#eff6ff',
                            color: '#2563eb',
                            borderRadius: '6px',
                            textDecoration: 'none',
                            fontSize: '0.82rem',
                            fontWeight: 600,
                          }}
                        >
                          <PhoneCall size={12} />
                          <span>{p.phone}</span>
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
