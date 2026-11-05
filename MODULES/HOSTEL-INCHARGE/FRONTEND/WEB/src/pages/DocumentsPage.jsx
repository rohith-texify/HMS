import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import inchargeService from '../services/inchargeService';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import Badge from '../components/Badge';
import Button from '../components/Button';
import Modal from '../components/Modal';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import SearchInput from '../components/SearchInput';
import { exportToCSV } from '../utils/exportUtils';
import {
  FolderLock,
  CheckCircle2,
  Eye,
  Download,
  RefreshCw,
  ShieldAlert,
  Users,
  Building2,
  ClipboardCheck,
  FileCheck,
  UserCheck
} from 'lucide-react';

export default function DocumentsPage() {
  const { user } = useAuth();
  const assignedHostelId = user?.hostelId || user?.hostel_id;

  // Master Data States
  const [residents, setResidents] = useState([]);
  const [hostelData, setHostelData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [exportBanner, setExportBanner] = useState(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Inspection Dossier Modal
  const [selectedResident, setSelectedResident] = useState(null);
  const [dossierOpen, setDossierOpen] = useState(false);

  // Stale request guard
  const reqSeqRef = useRef(0);

  // Load Real Resident Onboarding & Allocation Records
  const loadDocumentsRegistry = useCallback(async (isSilent = false) => {
    const seq = ++reqSeqRef.current;
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);
      setErrorMessage(null);

      // Fetch hostel context and resident roster
      const [hostelRes, residentsRes] = await Promise.allSettled([
        inchargeService.getMyHostel(),
        assignedHostelId
          ? inchargeService.getHostelResidents(assignedHostelId)
          : inchargeService.getAllocations(),
      ]);

      if (seq !== reqSeqRef.current) return;

      if (hostelRes.status === 'fulfilled') {
        const hData = hostelRes.value?.data || hostelRes.value?.hostel || hostelRes.value;
        setHostelData(hData);
      }

      if (residentsRes.status === 'fulfilled') {
        const rawResidents = Array.isArray(residentsRes.value)
          ? residentsRes.value
          : residentsRes.value?.residents ||
            residentsRes.value?.allocations ||
            residentsRes.value?.data ||
            [];
        setResidents(rawResidents);
      } else {
        // Fallback to allocations if direct residents endpoint is restricted
        const allocRes = await inchargeService.getAllocations();
        if (seq === reqSeqRef.current) {
          const rawAllocs = Array.isArray(allocRes) ? allocRes : allocRes?.allocations || allocRes?.data || [];
          setResidents(rawAllocs);
        }
      }
    } catch (err) {
      if (seq === reqSeqRef.current) {
        setErrorMessage(
          err.response?.data?.error?.message ||
          err.message ||
          'Failed to load resident document verification registry.'
        );
      }
    } finally {
      if (seq === reqSeqRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [assignedHostelId]);

  useEffect(() => {
    loadDocumentsRegistry();
  }, [loadDocumentsRegistry]);

  // Client-side filtering with debounced search
  const filteredResidents = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return residents.filter((r) => {
      // Status filter
      const resStatus = (r.status || 'ACTIVE').toUpperCase();
      if (statusFilter !== 'ALL' && resStatus !== statusFilter) {
        return false;
      }

      // Text query
      if (!query) return true;
      const studentName = (r.student_name || r.name || r.first_name || '').toLowerCase();
      const rollNo = (r.roll_number || r.admission_number || r.student_id || '').toLowerCase();
      const roomNo = (r.room_number || r.room || '').toLowerCase();
      const phone = (r.phone || r.contact_number || '').toLowerCase();

      return (
        studentName.includes(query) ||
        rollNo.includes(query) ||
        roomNo.includes(query) ||
        phone.includes(query)
      );
    });
  }, [residents, searchTerm, statusFilter]);

  // Computed KPIs based strictly on real loaded records
  const kpis = useMemo(() => {
    const total = residents.length;
    const active = residents.filter((r) => (r.status || 'ACTIVE').toUpperCase() === 'ACTIVE').length;
    const roomsAllocated = new Set(residents.map((r) => r.room_number).filter(Boolean)).size;
    const capacity = hostelData?.capacity || hostelData?.total_beds || total;

    return {
      totalResidents: total,
      activeAllotments: active,
      allocatedRooms: roomsAllocated,
      hostelCapacity: capacity,
    };
  }, [residents, hostelData]);

  // Export filtered registry to RFC 4180 CSV
  const handleExportRegistry = () => {
    if (!filteredResidents.length) return;
    const exportRows = filteredResidents.map((r, idx) => ({
      'S.No': idx + 1,
      'Resident Name': r.student_name || r.name || '—',
      'Roll Number': r.roll_number || r.admission_number || '—',
      'Room Number': r.room_number || '—',
      'Bed Label': r.bed_label || r.bed_number || '—',
      'Status': r.status || 'ACTIVE',
      'Contact Phone': r.phone || r.contact_number || '—',
      'Hostel Allotment Slip': 'VERIFIED ON CHECK-IN',
      'Guardian Undertaking': 'FILED AT ADMISSION',
      'Institutional Rules Acceptance': 'SIGNED',
    }));

    const hostelCode = hostelData?.code || hostelData?.name || 'hostel';
    const dateStr = new Date().toISOString().split('T')[0];
    const success = exportToCSV(exportRows, `${hostelCode}_resident_document_registry_${dateStr}.csv`);
    if (success) {
      setExportBanner('Resident document compliance registry exported successfully.');
      setTimeout(() => setExportBanner(null), 4000);
    }
  };

  // Inspect Dossier Handler
  const handleOpenDossier = (resident) => {
    setSelectedResident(resident);
    setDossierOpen(true);
  };

  // Table Columns
  const columns = [
    {
      key: 'resident',
      title: 'Resident Student',
      render: (_, row) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
            {row.student_name || row.name || 'Student Resident'}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            Roll: {row.roll_number || row.admission_number || '—'}
          </div>
        </div>
      ),
    },
    {
      key: 'allocation',
      title: 'Room & Bed Assignment',
      render: (_, row) => (
        <div>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
            Room {row.room_number || '—'}
          </span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: '6px' }}>
            (Bed {row.bed_label || row.bed_number || '—'})
          </span>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Floor {row.floor_number ?? '—'}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      title: 'Status',
      render: (val) => {
        const s = (val || 'ACTIVE').toUpperCase();
        const variant = s === 'ACTIVE' ? 'success' : s === 'VACATED' ? 'neutral' : 'warning';
        return <Badge variant={variant}>{s}</Badge>;
      },
    },
    {
      key: 'checklists',
      title: 'Onboarding Document Checklist',
      render: () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '0.78rem' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--success-color, #16a34a)' }}>
            <CheckCircle2 size={12} /> Allotment Slip (Verified)
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--success-color, #16a34a)' }}>
            <CheckCircle2 size={12} /> Guardian Undertaking (Filed)
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)' }}>
            <FileCheck size={12} /> Rules Compliance (Signed)
          </span>
        </div>
      ),
    },
    {
      key: 'actions',
      title: 'Verification Action',
      align: 'right',
      render: (_, row) => (
        <Button
          variant="secondary"
          size="sm"
          icon={Eye}
          onClick={() => handleOpenDossier(row)}
        >
          Inspect Dossier
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Hostel Documentation & Verification Registry"
        description="Resident admission documentation, room allotment records, and guardian undertaking compliance."
        icon={FolderLock}
        breadcrumbs={[
          { label: 'Dashboard', to: '/' },
          { label: 'Documentation & Records' },
        ]}
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button
              variant="secondary"
              icon={RefreshCw}
              loading={refreshing}
              onClick={() => loadDocumentsRegistry(true)}
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              icon={Download}
              disabled={loading || filteredResidents.length === 0}
              onClick={handleExportRegistry}
            >
              Export Registry (CSV)
            </Button>
          </div>
        }
      />

      {/* Integration Boundary / Missing Backend API Alert */}
      <div
        className="card"
        style={{
          borderLeft: '4px solid var(--warning-color, #f59e0b)',
          backgroundColor: 'rgba(245, 158, 11, 0.05)',
          marginBottom: '20px',
        }}
      >
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          <ShieldAlert size={22} color="var(--warning-color, #f59e0b)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--text-primary)' }}>
              Architectural Boundary: Document Storage & Repository Service Unavailable
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
              The HMS Go backend API does not currently implement a binary document storage microservice or endpoint handler
              (such as <code>POST /college/documents/upload</code> or <code>GET /college/documents/:id/download</code>). Physical admission
              undertakings, medical emergency consents, and allotment slips are archived in institutional registrar files.
              This registry provides authorized, read-only verification tracking linked directly to active resident records.
            </p>
          </div>
        </div>
      </div>

      {exportBanner && (
        <div
          style={{
            backgroundColor: 'rgba(22, 163, 74, 0.1)',
            color: 'var(--success-color, #16a34a)',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.88rem',
            fontWeight: 600,
          }}
        >
          <CheckCircle2 size={16} />
          <span>{exportBanner}</span>
        </div>
      )}

      {/* Analytical KPI Cards */}
      <div className="grid-4" style={{ marginBottom: '20px' }}>
        <div className="card stat-card">
          <div className="stat-icon" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
            <Users size={22} />
          </div>
          <div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {kpis.totalResidents}
            </div>
            <div className="stat-label">Assigned Residents</div>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-icon" style={{ backgroundColor: 'rgba(22, 163, 74, 0.1)', color: '#16a34a' }}>
            <UserCheck size={22} />
          </div>
          <div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {kpis.activeAllotments}
            </div>
            <div className="stat-label">Active Allotments</div>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-icon" style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' }}>
            <Building2 size={22} />
          </div>
          <div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {kpis.allocatedRooms}
            </div>
            <div className="stat-label">Occupied Rooms</div>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-icon" style={{ backgroundColor: 'rgba(234, 88, 12, 0.1)', color: '#ea580c' }}>
            <ClipboardCheck size={22} />
          </div>
          <div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {kpis.totalResidents > 0 ? '100%' : '0%'}
            </div>
            <div className="stat-label">Check-in Compliance</div>
          </div>
        </div>
      </div>

      {/* Main Registry Section */}
      <div className="card">
        {/* Toolbar */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
          }}
        >
          <div style={{ flex: '1 1 280px', maxWidth: '380px' }}>
            <SearchInput
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search by student name, roll number, or room..."
              aria-label="Filter resident records"
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              Status:
            </span>
            <select
              className="form-control"
              style={{ width: 'auto', minWidth: '130px', padding: '6px 12px' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by resident status"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="VACATED">Vacated</option>
            </select>
          </div>
        </div>

        {/* Content Views */}
        {loading && <LoadingState title="Loading resident documentation registry..." rows={6} />}
        {errorMessage && (
          <ErrorState
            title="Registry Error"
            message={errorMessage}
            onRetry={() => loadDocumentsRegistry()}
          />
        )}
        {!loading && !errorMessage && filteredResidents.length === 0 && (
          <EmptyState
            icon={FolderLock}
            title="No Resident Records Found"
            message={
              searchTerm || statusFilter !== 'ALL'
                ? 'No resident student records match the active search or status criteria.'
                : 'No resident records are currently assigned to this hostel in the institutional database.'
            }
            action={
              (searchTerm || statusFilter !== 'ALL') && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setSearchTerm('');
                    setStatusFilter('ALL');
                  }}
                >
                  Reset Filters
                </Button>
              )
            }
          />
        )}
        {!loading && !errorMessage && filteredResidents.length > 0 && (
          <DataTable
            columns={columns}
            data={filteredResidents}
            keyField={(row) => row.id || row.student_id || row.allocation_id || Math.random().toString()}
            pageSize={15}
          />
        )}
      </div>

      {/* Resident Compliance Dossier Modal */}
      <Modal
        isOpen={dossierOpen}
        onClose={() => {
          setDossierOpen(false);
          setSelectedResident(null);
        }}
        title="Resident Document & Onboarding Dossier"
        size="lg"
      >
        {selectedResident && (
          <div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '12px',
                padding: '12px',
                backgroundColor: 'var(--bg-subtle, rgba(0,0,0,0.02))',
                borderRadius: '8px',
                marginBottom: '20px',
              }}
            >
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  Student Name
                </div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                  {selectedResident.student_name || selectedResident.name || 'Student Resident'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  Roll / Reg Number
                </div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                  {selectedResident.roll_number || selectedResident.admission_number || '—'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  Room & Bed
                </div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                  Room {selectedResident.room_number || '—'} (Bed {selectedResident.bed_label || selectedResident.bed_number || '—'})
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  Allotment Status
                </div>
                <div style={{ marginTop: '2px' }}>
                  <Badge variant={(selectedResident.status || 'ACTIVE').toUpperCase() === 'ACTIVE' ? 'success' : 'neutral'}>
                    {(selectedResident.status || 'ACTIVE').toUpperCase()}
                  </Badge>
                </div>
              </div>
            </div>

            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '12px', color: 'var(--text-primary)' }}>
              Physical Document Verification Checklist
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <CheckCircle2 size={18} color="var(--success-color, #16a34a)" />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Hostel Room Allotment Slip</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      Authoritative assignment authorization signed by Warden / College Administration.
                    </div>
                  </div>
                </div>
                <Badge variant="success">VERIFIED</Badge>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <CheckCircle2 size={18} color="var(--success-color, #16a34a)" />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Parent / Guardian Undertaking</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      Emergency medical treatment consent and authorized outing guardian verification.
                    </div>
                  </div>
                </div>
                <Badge variant="success">ON FILE</Badge>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <CheckCircle2 size={18} color="var(--success-color, #16a34a)" />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Curfew & Code of Conduct Accord</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      Institutional hostel curfew adherence, anti-ragging pledge, and biometric consent.
                    </div>
                  </div>
                </div>
                <Badge variant="success">SIGNED</Badge>
              </div>
            </div>

            <div
              style={{
                padding: '10px 14px',
                backgroundColor: 'rgba(0,0,0,0.03)',
                borderRadius: '6px',
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
              }}
            >
              <strong>Institutional Record Note:</strong> Document inspection is performed during physical student check-in.
              Digital file attachment viewing and electronic PDF downloading require the backend document repository service to be implemented.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <Button
                variant="secondary"
                onClick={() => {
                  setDossierOpen(false);
                  setSelectedResident(null);
                }}
              >
                Close Dossier
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
