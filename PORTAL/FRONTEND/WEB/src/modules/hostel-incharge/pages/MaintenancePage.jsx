import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import inchargeService from '../services/inchargeService';
import { PERMISSIONS } from '../constants/permissions';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import SearchInput from '../components/SearchInput';
import Modal from '../components/Modal';
import FormField from '../components/FormField';
import LoadingState from '../components/LoadingState';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import Badge from '../components/Badge';
import {
  Wrench,
  Hammer,
  Clock,
  CheckCircle2,
  XCircle,
  Plus,
  RefreshCw,
  Eye,
  Check,
  Building2,
  DoorOpen,
  Download,
  LayoutGrid,
  List
} from 'lucide-react';

export default function MaintenancePage() {
  const { assignedHostel } = useAuth();
  const { hasPermission } = usePermissions();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const canManage = hasPermission(PERMISSIONS.HOSTEL_MANAGE);

  // Display Mode: Cards vs Table
  const [displayMode, setDisplayMode] = useState('TABLE');

  // Master Data State
  const [maintenanceList, setMaintenanceList] = useState([]);
  const [, setHostelData] = useState(null);
  const [roomsMap, setRoomsMap] = useState({}); // { [roomId]: { room_number, block_name, floor_number, ... } }
  const [availableRooms, setAvailableRooms] = useState([]); // List for creation dropdown

  // UI & Loading States
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successBanner, setSuccessBanner] = useState(null);

  // Search & Filters (Note: Backend GET /college/maintenance does not support query parameters; filters operate client-side)
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [scopeFilter, setScopeFilter] = useState('ALL'); // 'ALL' or 'MY_HOSTEL'

  // Debounce search input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Modals Visibility
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [dossierModalOpen, setDossierModalOpen] = useState(false);

  // Active Selected Work Order
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Create Form State
  const [formRoomId, setFormRoomId] = useState(searchParams.get('roomId') || '');
  const [formType, setFormType] = useState('GENERAL');
  const [formReason, setFormReason] = useState('');
  const [formStartedAt, setFormStartedAt] = useState(() => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [formExpectedEndAt, setFormExpectedEndAt] = useState('');
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const [createFormError, setCreateFormError] = useState(null);

  // Resolve Form State
  const [resolveRemarks, setResolveRemarks] = useState('');
  const [isSubmittingResolve, setIsSubmittingResolve] = useState(false);
  const [resolveFormError, setResolveFormError] = useState(null);

  // Auto-dismiss success notification
  useEffect(() => {
    if (successBanner) {
      const timer = setTimeout(() => setSuccessBanner(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [successBanner]);

  // Load all hostel rooms across blocks and floors to enrich room_id
  const loadHostelRooms = async (hostelId) => {
    try {
      const blocks = await inchargeService.getBlocks(hostelId);
      if (!Array.isArray(blocks) || blocks.length === 0) return { map: {}, list: [] };

      const allRooms = [];
      const map = {};

      for (const block of blocks) {
        try {
          const floors = await inchargeService.getFloors(hostelId, block.id);
          if (Array.isArray(floors)) {
            for (const floor of floors) {
              try {
                const rooms = await inchargeService.getRooms(hostelId, block.id, floor.id);
                if (Array.isArray(rooms)) {
                  for (const r of rooms) {
                    const enriched = {
                      ...r,
                      block_id: block.id,
                      block_name: block.block_name || block.name || `Block ${block.block_code || ''}`,
                      floor_id: floor.id,
                      floor_number: floor.floor_number ?? floor.floor_name ?? floor.name,
                    };
                    map[r.id] = enriched;
                    allRooms.push(enriched);
                  }
                }
              } catch {
                // Ignore individual floor fetch failures
              }
            }
          }
        } catch {
          // Ignore individual block fetch failures
        }
      }

      return { map, list: allRooms };
    } catch (err) {
      console.warn('Could not populate room mapping hierarchy:', err);
      return { map: {}, list: [] };
    }
  };

  // Request sequence counter to avoid race conditions and stale response overwrites
  const reqSeqRef = React.useRef(0);

  // Master Data Loader
  const loadData = useCallback(async (isRefresh = false) => {
    const seq = ++reqSeqRef.current;
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
      setErrorMessage(null);

      // 1. Fetch Maintenance Orders
      const maintenancePromise = inchargeService.getMaintenance();

      // 2. Fetch Hostel & Rooms
      const hostelPromise = inchargeService.getMyHostel().catch(() => null);

      const [maintRes, hostelRes] = await Promise.all([
        maintenancePromise,
        hostelPromise,
      ]);

      if (seq !== reqSeqRef.current) return;

      const rawMaint = Array.isArray(maintRes) ? maintRes : maintRes?.maintenance || maintRes?.data || [];
      setMaintenanceList(rawMaint);

      const activeHostel = hostelRes || assignedHostel;
      setHostelData(activeHostel);

      const activeHostelId = activeHostel?.id || activeHostel?.hostel_id;
      if (activeHostelId) {
        const { map, list } = await loadHostelRooms(activeHostelId);
        if (seq !== reqSeqRef.current) return;
        setRoomsMap(map);
        setAvailableRooms(list);
      }
    } catch (err) {
      if (seq !== reqSeqRef.current) return;
      console.error('Failed to load maintenance data:', err);
      setErrorMessage(err.message || 'Unable to retrieve maintenance records.');
    } finally {
      if (seq === reqSeqRef.current) {
        setLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [assignedHostel]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle URL Pre-selection for modal
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'new') {
      setCreateModalOpen(true);
    }
  }, [searchParams]);

  // Format date helper
  const formatDate = (isoString) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      return d.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  // Format short date helper
  const formatShortDate = (isoString) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      return d.toLocaleDateString('en-IN', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  // Status Badge Component
  const getStatusBadge = (status) => {
    const s = String(status || '').toUpperCase();
    switch (s) {
      case 'OPEN':
        return (
          <Badge variant="warning" style={{ gap: '4px' }}>
            <Clock size={12} /> OPEN
          </Badge>
        );
      case 'IN_PROGRESS':
        return (
          <Badge variant="info" style={{ gap: '4px' }}>
            <Wrench size={12} /> IN PROGRESS
          </Badge>
        );
      case 'COMPLETED':
        return (
          <Badge variant="success" style={{ gap: '4px' }}>
            <CheckCircle2 size={12} /> COMPLETED
          </Badge>
        );
      case 'CANCELLED':
        return (
          <Badge variant="danger" style={{ gap: '4px' }}>
            <XCircle size={12} /> CANCELLED
          </Badge>
        );
      default:
        return <Badge variant="info">{s || 'UNKNOWN'}</Badge>;
    }
  };

  // Maintenance Type Badge
  const getTypeBadge = (type) => {
    const t = String(type || '').toUpperCase();
    const colors = {
      ELECTRICAL: { bg: 'rgba(234, 179, 8, 0.15)', text: '#ca8a04', border: '#eab308' },
      PLUMBING: { bg: 'rgba(59, 130, 246, 0.15)', text: '#2563eb', border: '#3b82f6' },
      CIVIL: { bg: 'rgba(168, 85, 247, 0.15)', text: '#9333ea', border: '#a855f7' },
      FURNITURE: { bg: 'rgba(249, 115, 22, 0.15)', text: '#ea580c', border: '#f97316' },
      CLEANING: { bg: 'rgba(20, 184, 166, 0.15)', text: '#0d9488', border: '#14b8a6' },
      SAFETY: { bg: 'rgba(239, 68, 68, 0.15)', text: '#dc2626', border: '#ef4444' },
      GENERAL: { bg: 'rgba(100, 116, 139, 0.15)', text: '#475569', border: '#94a3b8' },
      OTHER: { bg: 'rgba(148, 163, 184, 0.15)', text: '#64748b', border: '#cbd5e1' },
    };
    const c = colors[t] || colors.OTHER;

    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 8px',
          borderRadius: '4px',
          fontSize: '0.72rem',
          fontWeight: 700,
          background: c.bg,
          color: c.text,
          border: `1px solid ${c.border}`,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        <Hammer size={11} /> {t}
      </span>
    );
  };

  // Filtered and Searched Records (Evaluated Client-Side on the retrieved tenant dataset)
  const filteredList = useMemo(() => {
    return maintenanceList.filter((item) => {
      // 1. Scope Filter: My Hostel Rooms vs All Tenant Orders
      if (scopeFilter === 'MY_HOSTEL' && !roomsMap[item.room_id]) {
        return false;
      }

      // 2. Status Filter
      if (statusFilter !== 'ALL' && item.status !== statusFilter) {
        return false;
      }

      // 3. Type Filter
      if (typeFilter !== 'ALL' && item.maintenance_type !== typeFilter) {
        return false;
      }

      // 4. Debounced Search Term
      if (debouncedSearch.trim()) {
        const query = debouncedSearch.toLowerCase().trim();
        const room = roomsMap[item.room_id];
        const roomNum = (room?.room_number || '').toLowerCase();
        const blockName = (room?.block_name || '').toLowerCase();
        const reason = (item.reason || '').toLowerCase();
        const remarks = (item.remarks || '').toLowerCase();
        const type = (item.maintenance_type || '').toLowerCase();
        const id = (item.id || '').toLowerCase();

        return (
          roomNum.includes(query) ||
          blockName.includes(query) ||
          reason.includes(query) ||
          remarks.includes(query) ||
          type.includes(query) ||
          id.includes(query)
        );
      }

      return true;
    });
  }, [maintenanceList, scopeFilter, statusFilter, typeFilter, debouncedSearch, roomsMap]);

  // Aggregate KPI Statistics
  const kpiStats = useMemo(() => {
    const total = maintenanceList.length;
    const open = maintenanceList.filter((m) => m.status === 'OPEN').length;
    const inProgress = maintenanceList.filter((m) => m.status === 'IN_PROGRESS').length;
    const completed = maintenanceList.filter((m) => m.status === 'COMPLETED').length;
    const cancelled = maintenanceList.filter((m) => m.status === 'CANCELLED').length;
    const active = open + inProgress;

    return { total, open, inProgress, completed, cancelled, active };
  }, [maintenanceList]);

  // Export CSV Handler
  const exportToCSV = () => {
    if (filteredList.length === 0) {
      alert('No work orders available to export.');
      return;
    }

    const headers = [
      'Work Order ID',
      'Room Number',
      'Block',
      'Floor',
      'Maintenance Type',
      'Status',
      'Reason',
      'Started At',
      'Expected End At',
      'Completed At',
      'Remarks',
    ];

    const rows = filteredList.map((m) => {
      const room = roomsMap[m.room_id];
      return [
        m.id,
        room?.room_number || m.room_id || '—',
        room?.block_name || '—',
        room?.floor_number ?? '—',
        m.maintenance_type || '—',
        m.status || '—',
        `"${(m.reason || '').replace(/"/g, '""')}"`,
        m.started_at ? new Date(m.started_at).toISOString() : '',
        m.expected_end_at ? new Date(m.expected_end_at).toISOString() : '',
        m.completed_at ? new Date(m.completed_at).toISOString() : '',
        `"${(m.remarks || '').replace(/"/g, '""')}"`,
      ];
    });

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `hostel_maintenance_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Form Submissions: Create Maintenance
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setCreateFormError(null);

    if (!formRoomId) {
      setCreateFormError('Please select a room for this maintenance order.');
      return;
    }

    if (!formReason.trim()) {
      setCreateFormError('Please describe the repair issue or reason for maintenance.');
      return;
    }

    if (!formStartedAt) {
      setCreateFormError('Please specify the start date and time.');
      return;
    }

    // Validate expected_end_at is after started_at if specified
    if (formExpectedEndAt) {
      const startDate = new Date(formStartedAt);
      const endDate = new Date(formExpectedEndAt);
      if (endDate <= startDate) {
        setCreateFormError('Expected completion date must be later than the start date.');
        return;
      }
    }

    try {
      setIsSubmittingCreate(true);
      const payload = {
        room_id: formRoomId,
        maintenance_type: formType,
        reason: formReason.trim(),
        started_at: new Date(formStartedAt).toISOString(),
      };

      if (formExpectedEndAt) {
        payload.expected_end_at = new Date(formExpectedEndAt).toISOString();
      }

      await inchargeService.createMaintenance(payload);

      setSuccessBanner('Maintenance work order logged successfully.');
      setCreateModalOpen(false);
      // Reset form
      setFormReason('');
      setFormExpectedEndAt('');
      // Reload table
      loadData(true);
    } catch (err) {
      console.error('Create maintenance failed:', err);
      setCreateFormError(err.message || 'Failed to create maintenance work order.');
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  // Form Submissions: Resolve Maintenance
  const handleResolveSubmit = async (e) => {
    e.preventDefault();
    setResolveFormError(null);

    if (!resolveRemarks.trim()) {
      setResolveFormError('Please enter completion remarks detailing the resolution.');
      return;
    }

    if (!selectedOrder?.id) return;

    try {
      setIsSubmittingResolve(true);
      await inchargeService.resolveMaintenance(selectedOrder.id, {
        remarks: resolveRemarks.trim(),
      });

      setSuccessBanner(`Work order ${selectedOrder.id.substring(0, 8)} marked as completed.`);
      setResolveModalOpen(false);
      setDossierModalOpen(false);
      setResolveRemarks('');
      setSelectedOrder(null);
      // Reload table
      loadData(true);
    } catch (err) {
      console.error('Resolve maintenance failed:', err);
      setResolveFormError(err.message || 'Failed to mark maintenance as resolved.');
    } finally {
      setIsSubmittingResolve(false);
    }
  };

  // Table Columns Definition
  const columns = [
    {
      header: 'Work Order ID',
      key: 'id',
      width: '150px',
      render: (row) => (
        <div>
          <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.85rem', color: 'var(--primary-color)' }}>
            #{row.id ? row.id.substring(0, 8) : '—'}
          </span>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
            {formatShortDate(row.created_at || row.started_at)}
          </div>
        </div>
      ),
    },
    {
      header: 'Premises Location',
      key: 'room_id',
      width: '180px',
      render: (row) => {
        const room = roomsMap[row.room_id];
        return (
          <div>
            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
              <DoorOpen size={14} style={{ color: 'var(--primary-color)' }} />
              <span>Room {room?.room_number || 'ID: ' + row.room_id.substring(0, 8)}</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {room?.block_name ? `${room.block_name} • Floor ${room.floor_number ?? '—'}` : 'Room Record'}
            </div>
          </div>
        );
      },
    },
    {
      header: 'Category',
      key: 'maintenance_type',
      width: '140px',
      render: (row) => getTypeBadge(row.maintenance_type),
    },
    {
      header: 'Reason / Problem Statement',
      key: 'reason',
      render: (row) => (
        <div>
          <div
            style={{
              fontSize: '0.85rem',
              fontWeight: 500,
              color: 'var(--text-primary)',
              maxWidth: '320px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={row.reason}
          >
            {row.reason}
          </div>
          {row.remarks && (
            <div
              style={{
                fontSize: '0.75rem',
                color: '#059669',
                fontStyle: 'italic',
                maxWidth: '320px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                marginTop: '2px',
              }}
              title={`Resolution: ${row.remarks}`}
            >
              Resolved: {row.remarks}
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Schedule Window',
      key: 'started_at',
      width: '160px',
      render: (row) => (
        <div style={{ fontSize: '0.75rem' }}>
          <div>
            <span style={{ color: 'var(--text-secondary)' }}>Start: </span>
            <strong>{formatShortDate(row.started_at)}</strong>
          </div>
          {row.expected_end_at && (
            <div>
              <span style={{ color: 'var(--text-secondary)' }}>Est. End: </span>
              <span>{formatShortDate(row.expected_end_at)}</span>
            </div>
          )}
          {row.completed_at && (
            <div style={{ color: '#059669', fontWeight: 600 }}>
              Done: {formatShortDate(row.completed_at)}
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Status',
      key: 'status',
      width: '130px',
      render: (row) => getStatusBadge(row.status),
    },
    {
      header: 'Actions',
      key: 'actions',
      width: '140px',
      align: 'right',
      render: (row) => {
        const isClosed = row.status === 'COMPLETED' || row.status === 'CANCELLED';
        return (
          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-outline"
              title="Inspect Dossier"
              style={{ padding: '4px 8px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              onClick={() => {
                setSelectedOrder(row);
                setDossierModalOpen(true);
              }}
            >
              <Eye size={13} /> Details
            </button>
            {!isClosed && canManage && (
              <button
                type="button"
                className="btn btn-success"
                title="Mark Completed"
                style={{ padding: '4px 8px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                onClick={() => {
                  setSelectedOrder(row);
                  setResolveRemarks('');
                  setResolveModalOpen(true);
                }}
              >
                <Check size={13} /> Resolve
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="maintenance-page">
      {/* Page Header */}
      <PageHeader
        title="Facility Maintenance & Work Orders"
        description={`Manage premises repair jobs, electrical, plumbing, carpentry, and safety work orders for ${assignedHostel?.name || 'Assigned Hostel'}.`}
        icon={Wrench}
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => loadData(true)}
              disabled={isRefreshing || loading}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              className="btn btn-outline"
              onClick={exportToCSV}
              disabled={filteredList.length === 0}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Download size={14} />
              <span>Export CSV</span>
            </button>

            {canManage && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setCreateFormError(null);
                  setCreateModalOpen(true);
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={14} />
                <span>Log Work Order</span>
              </button>
            )}
          </div>
        }
      />

      {/* Success Notification Banner */}
      {successBanner && (
        <div
          style={{
            margin: '0 0 16px 0',
            padding: '12px 16px',
            backgroundColor: '#ecfdf5',
            color: '#065f46',
            borderRadius: '6px',
            border: '1px solid #a7f3d0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.88rem',
            fontWeight: 500,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={18} color="#059669" />
            <span>{successBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessBanner(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#065f46', padding: '2px' }}
          >
            ×
          </button>
        </div>
      )}

      {/* Tenant Scope & Integration Notice */}
      <div
        style={{
          margin: '0 0 16px 0',
          padding: '10px 14px',
          backgroundColor: 'rgba(59, 130, 246, 0.08)',
          borderRadius: '6px',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '0.82rem',
          color: 'var(--text-secondary)',
        }}
      >
        <Building2 size={16} color="#3b82f6" />
        <span>
          <strong>Tenant Integration Notice:</strong> The facility maintenance repository operates at institutional tenant scope (<code style={{ fontSize: '0.78rem' }}>college_id</code>). All filters (search, status, type) are evaluated on retrieved records. Staff assignment/routing is unsupported by the current backend contract.
        </span>
      </div>

      {/* KPI Stat Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '14px',
          marginBottom: '20px',
        }}
      >
        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '8px',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#3b82f6',
            }}
          >
            <Hammer size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
              Total Records (Tenant)
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {kpiStats.total}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Loaded college tenant records
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '8px',
              backgroundColor: 'rgba(234, 179, 8, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#eab308',
            }}
          >
            <Clock size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
              Open / Pending
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {kpiStats.open}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Derived from loaded tenant records
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '8px',
              backgroundColor: 'rgba(99, 102, 241, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#6366f1',
            }}
          >
            <Wrench size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
              Active / In Progress
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {kpiStats.active}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Derived from loaded tenant records
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '8px',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#10b981',
            }}
          >
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
              Resolved / Done
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {kpiStats.completed}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Derived from loaded tenant records
            </div>
          </div>
        </div>
      </div>

      {/* Control Bar: Filters, Search & View Mode */}
      <div
        className="card"
        style={{
          padding: '14px 18px',
          marginBottom: '20px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', flex: 1 }}>
          {/* Search Box */}
          <div style={{ minWidth: '240px', flex: 1, maxWidth: '380px' }}>
            <SearchInput
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by room, issue, type, or ID..."
            />
          </div>

          {/* Status Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Status:</span>
            <select
              className="form-control"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ fontSize: '0.82rem', padding: '6px 10px', width: 'auto' }}
            >
              <option value="ALL">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {/* Type Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Type:</span>
            <select
              className="form-control"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              style={{ fontSize: '0.82rem', padding: '6px 10px', width: 'auto' }}
            >
              <option value="ALL">All Categories</option>
              <option value="GENERAL">General</option>
              <option value="ELECTRICAL">Electrical</option>
              <option value="PLUMBING">Plumbing</option>
              <option value="CIVIL">Civil</option>
              <option value="FURNITURE">Furniture</option>
              <option value="CLEANING">Cleaning</option>
              <option value="SAFETY">Safety</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          {/* Scope Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Scope:</span>
            <select
              className="form-control"
              value={scopeFilter}
              onChange={(e) => setScopeFilter(e.target.value)}
              style={{ fontSize: '0.82rem', padding: '6px 10px', width: 'auto' }}
            >
              <option value="ALL">All Loaded Tenant Orders</option>
              <option value="MY_HOSTEL">Assigned Hostel Rooms Only</option>
            </select>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div style={{ display: 'flex', gap: '4px', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '2px' }}>
          <button
            type="button"
            className={`btn ${displayMode === 'TABLE' ? 'btn-primary' : 'btn-text'}`}
            onClick={() => setDisplayMode('TABLE')}
            style={{ padding: '5px 10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}
            title="Table View"
          >
            <List size={14} /> Table
          </button>
          <button
            type="button"
            className={`btn ${displayMode === 'CARDS' ? 'btn-primary' : 'btn-text'}`}
            onClick={() => setDisplayMode('CARDS')}
            style={{ padding: '5px 10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}
            title="Grid Cards View"
          >
            <LayoutGrid size={14} /> Cards
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {loading && <LoadingState title="Loading maintenance records..." rows={5} />}

      {errorMessage && !loading && (
        <ErrorState
          title="Error Loading Maintenance Data"
          message={errorMessage}
          onRetry={() => loadData(false)}
        />
      )}

      {!loading && !errorMessage && (
        <>
          {filteredList.length === 0 ? (
            <div className="card" style={{ padding: '40px 20px' }}>
              <EmptyState
                icon={Hammer}
                title="No Maintenance Work Orders"
                description={
                  searchTerm || statusFilter !== 'ALL' || typeFilter !== 'ALL'
                    ? 'No work orders match the selected filters or search terms. Try clearing your filters.'
                    : 'There are currently no active or historical maintenance orders recorded for this hostel.'
                }
              />
            </div>
          ) : displayMode === 'TABLE' ? (
            <div className="card" style={{ overflow: 'hidden' }}>
              <DataTable
                columns={columns}
                data={filteredList}
                rowKey="id"
                emptyTitle="No work orders found"
                emptyMessage="No work orders match the criteria."
              />
            </div>
          ) : (
            /* Cards Grid View */
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: '16px',
              }}
            >
              {filteredList.map((m) => {
                const room = roomsMap[m.room_id];
                const isClosed = m.status === 'COMPLETED' || m.status === 'CANCELLED';

                return (
                  <div
                    key={m.id}
                    className="card"
                    style={{
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '12px',
                      borderTop: `3px solid ${
                        m.status === 'COMPLETED'
                          ? '#10b981'
                          : m.status === 'IN_PROGRESS'
                          ? '#3b82f6'
                          : m.status === 'CANCELLED'
                          ? '#ef4444'
                          : '#eab308'
                      }`,
                    }}
                  >
                    <div>
                      {/* Top Badges & ID */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div>
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.8rem', color: 'var(--primary-color)' }}>
                            #{m.id.substring(0, 8)}
                          </span>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                            Logged: {formatShortDate(m.created_at || m.started_at)}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          {getStatusBadge(m.status)}
                        </div>
                      </div>

                      {/* Room & Category Banner */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '8px 10px',
                          backgroundColor: '#f8fafc',
                          borderRadius: '6px',
                          marginBottom: '10px',
                          border: '1px solid var(--border-color)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <DoorOpen size={15} style={{ color: 'var(--primary-color)' }} />
                          <strong style={{ fontSize: '0.85rem' }}>
                            Room {room?.room_number || m.room_id.substring(0, 8)}
                          </strong>
                          {room?.block_name && (
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                              ({room.block_name})
                            </span>
                          )}
                        </div>
                        {getTypeBadge(m.maintenance_type)}
                      </div>

                      {/* Reason Description */}
                      <div
                        style={{
                          fontSize: '0.84rem',
                          lineHeight: '1.4',
                          color: 'var(--text-primary)',
                          marginBottom: '8px',
                          fontWeight: 500,
                        }}
                      >
                        {m.reason}
                      </div>

                      {/* Resolution Remarks (if resolved) */}
                      {m.remarks && (
                        <div
                          style={{
                            padding: '8px 10px',
                            backgroundColor: '#ecfdf5',
                            border: '1px solid #a7f3d0',
                            borderRadius: '5px',
                            fontSize: '0.76rem',
                            color: '#065f46',
                            marginBottom: '8px',
                          }}
                        >
                          <strong>Resolution:</strong> {m.remarks}
                        </div>
                      )}

                      {/* Schedule info */}
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div>Started: {formatDate(m.started_at)}</div>
                        {m.expected_end_at && <div>Expected End: {formatDate(m.expected_end_at)}</div>}
                        {m.completed_at && (
                          <div style={{ color: '#059669', fontWeight: 600 }}>
                            Completed: {formatDate(m.completed_at)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingTop: '10px',
                        borderTop: '1px solid var(--border-color)',
                        marginTop: '4px',
                      }}
                    >
                      <button
                        type="button"
                        className="btn btn-outline"
                        style={{ padding: '4px 10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                        onClick={() => {
                          setSelectedOrder(m);
                          setDossierModalOpen(true);
                        }}
                      >
                        <Eye size={13} /> View Dossier
                      </button>

                      {!isClosed && canManage && (
                        <button
                          type="button"
                          className="btn btn-success"
                          style={{ padding: '4px 10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                          onClick={() => {
                            setSelectedOrder(m);
                            setResolveRemarks('');
                            setResolveModalOpen(true);
                          }}
                        >
                          <Check size={13} /> Resolve
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: LOG NEW MAINTENANCE WORK ORDER                                  */}
      {/* ========================================================================= */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => !isSubmittingCreate && setCreateModalOpen(false)}
        title="Log Maintenance Work Order"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setCreateModalOpen(false)}
              disabled={isSubmittingCreate}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleCreateSubmit}
              disabled={isSubmittingCreate}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {isSubmittingCreate && <RefreshCw size={14} className="spin" />}
              <span>{isSubmittingCreate ? 'Logging...' : 'Submit Work Order'}</span>
            </button>
          </div>
        }
      >
        <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {createFormError && (
            <div
              style={{
                padding: '10px 14px',
                backgroundColor: '#fef2f2',
                color: '#991b1b',
                borderRadius: '6px',
                border: '1px solid #fecaca',
                fontSize: '0.84rem',
              }}
            >
              {createFormError}
            </div>
          )}

          {/* Room Selection */}
          <FormField label="Hostel Room" required helpText="Select the room requiring repairs or maintenance.">
            <select
              className="form-control"
              value={formRoomId}
              onChange={(e) => setFormRoomId(e.target.value)}
              required
            >
              <option value="">-- Select Room --</option>
              {availableRooms.map((r) => (
                <option key={r.id} value={r.id}>
                  Room {r.room_number} ({r.block_name || 'Block'}, Floor {r.floor_number ?? '—'})
                </option>
              ))}
            </select>
          </FormField>

          {/* Maintenance Category */}
          <FormField label="Maintenance Category" required>
            <select
              className="form-control"
              value={formType}
              onChange={(e) => setFormType(e.target.value)}
              required
            >
              <option value="GENERAL">General Maintenance</option>
              <option value="ELECTRICAL">Electrical (Wiring, Lights, Fans, Sockets)</option>
              <option value="PLUMBING">Plumbing (Taps, Pipes, Drains, Flush)</option>
              <option value="CIVIL">Civil (Masonry, Paint, Wall, Window)</option>
              <option value="FURNITURE">Furniture & Carpentry (Beds, Desks, Almirah, Locks)</option>
              <option value="CLEANING">Deep Cleaning / Sanitation</option>
              <option value="SAFETY">Fire & Safety Equipment</option>
              <option value="OTHER">Other / Miscellaneous</option>
            </select>
          </FormField>

          {/* Issue Description */}
          <FormField label="Issue Description / Reason" required helpText="Specify the defect, symptoms, or maintenance required in detail.">
            <textarea
              className="form-control"
              rows={4}
              value={formReason}
              onChange={(e) => setFormReason(e.target.value)}
              placeholder="e.g. Ceiling fan speed regulator burned out and making buzzing noise. Requires technician replacement."
              required
            />
          </FormField>

          {/* Dates */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <FormField label="Work Start Date & Time" required>
              <input
                type="datetime-local"
                className="form-control"
                value={formStartedAt}
                onChange={(e) => setFormStartedAt(e.target.value)}
                required
              />
            </FormField>

            <FormField label="Expected Completion (Optional)">
              <input
                type="datetime-local"
                className="form-control"
                value={formExpectedEndAt}
                onChange={(e) => setFormExpectedEndAt(e.target.value)}
              />
            </FormField>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 2: RESOLVE / COMPLETE MAINTENANCE WORK ORDER                       */}
      {/* ========================================================================= */}
      <Modal
        isOpen={resolveModalOpen}
        onClose={() => !isSubmittingResolve && setResolveModalOpen(false)}
        title="Resolve & Complete Work Order"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setResolveModalOpen(false)}
              disabled={isSubmittingResolve}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-success"
              onClick={handleResolveSubmit}
              disabled={isSubmittingResolve}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {isSubmittingResolve && <RefreshCw size={14} className="spin" />}
              <span>{isSubmittingResolve ? 'Saving...' : 'Mark Completed'}</span>
            </button>
          </div>
        }
      >
        <form onSubmit={handleResolveSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {resolveFormError && (
            <div
              style={{
                padding: '10px 14px',
                backgroundColor: '#fef2f2',
                color: '#991b1b',
                borderRadius: '6px',
                border: '1px solid #fecaca',
                fontSize: '0.84rem',
              }}
            >
              {resolveFormError}
            </div>
          )}

          {selectedOrder && (
            <div
              style={{
                padding: '12px',
                backgroundColor: '#f8fafc',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                fontSize: '0.84rem',
              }}
            >
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                Order #{selectedOrder.id?.substring(0, 8)} • Room {roomsMap[selectedOrder.room_id]?.room_number || 'Room'}
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                <strong>Issue:</strong> {selectedOrder.reason}
              </div>
            </div>
          )}

          <FormField
            label="Resolution Remarks / Completion Details"
            required
            helpText="Detail what repairs were conducted, parts replaced, or technician notes."
          >
            <textarea
              className="form-control"
              rows={4}
              value={resolveRemarks}
              onChange={(e) => setResolveRemarks(e.target.value)}
              placeholder="e.g. Replaced capacitor and regulator. Tested at full speeds, operating normally."
              required
            />
          </FormField>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 3: WORK ORDER DOSSIER & PARTICULARS                                */}
      {/* ========================================================================= */}
      <Modal
        isOpen={dossierModalOpen}
        onClose={() => setDossierModalOpen(false)}
        title="Maintenance Order Dossier"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <div>
              {selectedOrder &&
                selectedOrder.status !== 'COMPLETED' &&
                selectedOrder.status !== 'CANCELLED' &&
                canManage && (
                  <button
                    type="button"
                    className="btn btn-success"
                    onClick={() => {
                      setDossierModalOpen(false);
                      setResolveRemarks('');
                      setResolveModalOpen(true);
                    }}
                    style={{ fontSize: '0.82rem' }}
                  >
                    Resolve Work Order
                  </button>
                )}
            </div>
            <button type="button" className="btn btn-primary" onClick={() => setDossierModalOpen(false)}>
              Close
            </button>
          </div>
        }
      >
        {selectedOrder && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Header Particulars */}
            <div
              style={{
                padding: '16px',
                backgroundColor: '#f8fafc',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '0.78rem', fontFamily: 'monospace', color: 'var(--primary-color)', fontWeight: 700 }}>
                    #{selectedOrder.id}
                  </div>
                  <h3 style={{ margin: '4px 0', fontSize: '1.15rem', color: 'var(--text-primary)' }}>
                    Room {roomsMap[selectedOrder.room_id]?.room_number || 'Room'} Maintenance
                  </h3>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Category: <strong>{selectedOrder.maintenance_type}</strong>
                  </div>
                </div>
                <div>{getStatusBadge(selectedOrder.status)}</div>
              </div>
            </div>

            {/* Room Location Breakdown */}
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '6px' }}>
                Location Particulars
              </div>
              <div
                style={{
                  padding: '12px 14px',
                  backgroundColor: '#ffffff',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: '12px',
                  fontSize: '0.85rem',
                }}
              >
                <div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.72rem' }}>Room Number</div>
                  <strong>{roomsMap[selectedOrder.room_id]?.room_number || '—'}</strong>
                </div>
                <div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.72rem' }}>Block</div>
                  <strong>{roomsMap[selectedOrder.room_id]?.block_name || '—'}</strong>
                </div>
                <div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.72rem' }}>Floor</div>
                  <strong>Floor {roomsMap[selectedOrder.room_id]?.floor_number ?? '—'}</strong>
                </div>
                <div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.72rem' }}>Actions</div>
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                    onClick={() => {
                      setDossierModalOpen(false);
                      navigate(`/rooms?search=${roomsMap[selectedOrder.room_id]?.room_number || ''}`);
                    }}
                  >
                    View Room
                  </button>
                </div>
              </div>
            </div>

            {/* Reason / Statement */}
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '6px' }}>
                Problem Description
              </div>
              <div
                style={{
                  padding: '14px',
                  backgroundColor: '#ffffff',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.88rem',
                  lineHeight: 1.5,
                  color: 'var(--text-primary)',
                }}
              >
                {selectedOrder.reason}
              </div>
            </div>

            {/* Resolution Statement (if resolved) */}
            {selectedOrder.remarks && (
              <div
                style={{
                  padding: '14px',
                  backgroundColor: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  borderRadius: '6px',
                }}
              >
                <div style={{ fontSize: '0.8rem', color: '#065f46', fontWeight: 700, marginBottom: '4px' }}>
                  Resolution Remarks (Completed on {formatDate(selectedOrder.completed_at)})
                </div>
                <div style={{ fontSize: '0.85rem', color: '#047857', lineHeight: 1.4 }}>
                  {selectedOrder.remarks}
                </div>
              </div>
            )}

            {/* Timeline Breakdown */}
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '6px' }}>
                Order Lifecycle Timeline
              </div>
              <div
                style={{
                  padding: '12px 14px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: '12px',
                  fontSize: '0.82rem',
                }}
              >
                <div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.72rem' }}>Started At</div>
                  <strong>{formatDate(selectedOrder.started_at)}</strong>
                </div>
                {selectedOrder.expected_end_at && (
                  <div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.72rem' }}>Expected End</div>
                    <strong>{formatDate(selectedOrder.expected_end_at)}</strong>
                  </div>
                )}
                {selectedOrder.completed_at && (
                  <div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.72rem' }}>Completed At</div>
                    <strong style={{ color: '#059669' }}>{formatDate(selectedOrder.completed_at)}</strong>
                  </div>
                )}
                <div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.72rem' }}>Logged In System</div>
                  <span>{formatDate(selectedOrder.created_at)}</span>
                </div>
              </div>
            </div>

            {/* Assignment & Routing Status */}
            <div
              style={{
                padding: '10px 14px',
                backgroundColor: 'rgba(100, 116, 139, 0.08)',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                fontSize: '0.78rem',
                color: 'var(--text-secondary)',
              }}
            >
              <strong>Routing & Assignment Status:</strong> Staff assignment/routing is unsupported by the current backend contract (<code style={{ fontSize: '0.74rem' }}>app.room_maintenance</code> tracks direct room work order lifecycle without an assigned technician entity).
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
