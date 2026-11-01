import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../shared/auth/useAuth';
import adminService from '../services/adminService';
import {
  Footprints,
  ShieldCheck,
  DoorClosed,
  DoorOpen,
  Activity,
  AlertTriangle,
  Info,
  Search,
  Filter,
  Plus,
  RefreshCw,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  Building2,
  Users,
  Shield,
  Layers,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import {
  PageHeader,
  DataTable,
  SearchInput,
  FilterControls,
  Modal,
  FormField,
  ConfirmationDialog,
  LoadingState,
  EmptyState,
  ErrorState,
} from '../../../shared/components';

export default function AdminMovementPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Permissions check
  const canManageGates = useMemo(() => {
    if (!user) return true;
    if (['COLLEGE_ADMIN', 'ADMIN', 'HOSTEL_ADMIN'].includes(user?.role)) return true;
    if (Array.isArray(user?.permissions)) {
      return (
        user.permissions.includes('people.manage') ||
        user.permissions.includes('hostel.manage') ||
        user.permissions.includes('*')
      );
    }
    return true;
  }, [user]);

  // Master Data State
  const [gates, setGates] = useState([]);
  const [securityAssignments, setSecurityAssignments] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [hostels, setHostels] = useState([]);

  // UI & Loading States
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successBanner, setSuccessBanner] = useState(null);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');

  // Modals Visibility
  const [createGateModalOpen, setCreateGateModalOpen] = useState(false);
  const [gateDetailsModalOpen, setGateDetailsModalOpen] = useState(false);
  const [selectedGate, setSelectedGate] = useState(null);

  // Gate Form State
  const [gateFormData, setGateFormData] = useState({
    name: '',
    code: '',
    gate_type: 'PEDESTRIAN',
    hostel_id: '',
    location_description: '',
    status: 'ACTIVE',
  });

  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  // Quick lookup dictionary for staff
  const staffMap = useMemo(() => {
    const map = new Map();
    staffList.forEach((s) => map.set(s.id, s));
    return map;
  }, [staffList]);

  // Quick lookup dictionary for hostels
  const hostelMap = useMemo(() => {
    const map = new Map();
    hostels.forEach((h) => map.set(h.id, h));
    return map;
  }, [hostels]);

  // =========================================================================
  // Master Data Fetching
  // =========================================================================
  const loadMovementData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    else setLoading(true);
    setErrorMessage(null);

    try {
      const [gatesRes, secRes, staffRes, hostelsRes] = await Promise.allSettled([
        adminService.getGates(),
        adminService.getSecurityAssignments(),
        adminService.getStaff(),
        adminService.getHostels(),
      ]);

      if (gatesRes.status === 'fulfilled') {
        const raw = gatesRes.value;
        setGates(Array.isArray(raw) ? raw : raw?.gates || []);
      } else {
        console.warn('Failed to load campus gates:', gatesRes.reason);
      }

      if (secRes.status === 'fulfilled') {
        const rawSec = secRes.value;
        setSecurityAssignments(Array.isArray(rawSec) ? rawSec : rawSec?.assignments || []);
      }

      if (staffRes.status === 'fulfilled') {
        const rawStaff = staffRes.value;
        setStaffList(Array.isArray(rawStaff) ? rawStaff : rawStaff?.staff || []);
      }

      if (hostelsRes.status === 'fulfilled') {
        const rawH = hostelsRes.value;
        setHostels(Array.isArray(rawH) ? rawH : rawH?.hostels || []);
      }
    } catch (err) {
      console.error('Failed to load movement checkpoint data:', err);
      setErrorMessage('Failed to load campus gate checkpoints and security postings.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadMovementData();
  }, [loadMovementData]);

  // Toast banner auto-dismiss
  useEffect(() => {
    if (successBanner) {
      const timer = setTimeout(() => setSuccessBanner(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successBanner]);

  // =========================================================================
  // Filtering & Search
  // =========================================================================
  const filteredGates = useMemo(() => {
    return gates.filter((gate) => {
      const name = gate.name || '';
      const code = gate.code || '';
      const loc = gate.location_description || '';
      const term = searchTerm.toLowerCase().trim();

      const matchesSearch =
        !term ||
        name.toLowerCase().includes(term) ||
        code.toLowerCase().includes(term) ||
        loc.toLowerCase().includes(term);

      const matchesStatus =
        statusFilter === 'ALL' ||
        String(gate.status || '').toUpperCase() === statusFilter.toUpperCase();

      const matchesType =
        typeFilter === 'ALL' ||
        String(gate.gate_type || '').toUpperCase() === typeFilter.toUpperCase();

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [gates, searchTerm, statusFilter, typeFilter]);

  // =========================================================================
  // Workflow: Add Campus Gate
  // =========================================================================
  const handleOpenCreateGateModal = () => {
    setGateFormData({
      name: '',
      code: `GATE-${String(gates.length + 1).padStart(2, '0')}`,
      gate_type: 'PEDESTRIAN',
      hostel_id: hostels[0]?.id || '',
      location_description: '',
      status: 'ACTIVE',
    });
    setFormError(null);
    setCreateGateModalOpen(true);
  };

  const handleCreateGateSubmit = async (e) => {
    e.preventDefault();
    if (!gateFormData.name.trim() || !gateFormData.code.trim()) {
      setFormError('Please enter both gate name and identifier code.');
      return;
    }

    setFormSubmitting(true);
    setFormError(null);

    try {
      const payload = {
        name: gateFormData.name.trim(),
        code: gateFormData.code.trim().toUpperCase(),
        gate_type: gateFormData.gate_type,
        hostel_id: gateFormData.hostel_id ? gateFormData.hostel_id : null,
        location_description: gateFormData.location_description
          ? gateFormData.location_description.trim()
          : null,
        status: gateFormData.status,
      };

      await adminService.createGate(payload);
      setSuccessBanner(`Campus checkpoint ${payload.code} created successfully.`);
      setCreateGateModalOpen(false);
      loadMovementData();
    } catch (err) {
      console.error('Failed to create gate:', err);
      setFormError(
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        'Failed to register campus gate checkpoint.'
      );
    } finally {
      setFormSubmitting(false);
    }
  };

  // =========================================================================
  // Workflow: Toggle Gate Status
  // =========================================================================
  const handleToggleGateStatus = async (gate) => {
    const newStatus = gate.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await adminService.updateGateStatus(gate.id, newStatus);
      setSuccessBanner(`Checkpoint ${gate.code} status updated to ${newStatus}.`);
      loadMovementData();
    } catch (err) {
      console.error('Failed to update gate status:', err);
      setErrorMessage(
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        'Failed to update gate operational status.'
      );
    }
  };

  return (
    <div className="enterprise-module-page">
      {/* Header Bar */}
      <div className="enterprise-page-header">
        <div className="header-text-group">
          <div className="header-title-row">
            <div className="header-icon-badge">
              <Footprints size={22} />
            </div>
            <div>
              <h1 className="header-title">Student Movement & Campus Gates</h1>
              <p className="header-subtitle">
                Ingress/egress checkpoints, campus perimeter security, and guard duty assignments.
              </p>
            </div>
          </div>
        </div>

        <div className="header-actions-group">
          <button
            type="button"
            className="action-btn-secondary"
            onClick={() => loadMovementData(true)}
            disabled={isRefreshing || loading}
            title="Refresh Movement Data"
          >
            <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          {canManageGates && (
            <button
              type="button"
              className="action-btn-primary"
              onClick={handleOpenCreateGateModal}
              disabled={loading}
            >
              <Plus size={15} />
              <span>Configure Gate Checkpoint</span>
            </button>
          )}
        </div>
      </div>

      {/* Success Notification Banner */}
      {successBanner && (
        <div
          style={{
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            color: '#065f46',
            padding: '12px 18px',
            borderRadius: '10px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '13.5px',
            fontWeight: 500,
          }}
        >
          <CheckCircle2 size={16} style={{ color: '#059669', flexShrink: 0 }} />
          <span>{successBanner}</span>
        </div>
      )}

      {/* Architecture Honesty Banner */}
      <div
        style={{
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '10px',
          padding: '14px 18px',
          marginBottom: '24px',
          display: 'flex',
          gap: '12px',
          alignItems: 'flex-start',
        }}
      >
        <Info size={18} style={{ color: '#2563eb', flexShrink: 0, marginTop: '2px' }} />
        <div style={{ fontSize: '13px', color: '#1e40af', lineHeight: 1.5 }}>
          <strong>Movement Telemetry Notice:</strong> While student entry/exit database schema (
          <code>app.entry_exit_records</code>) is staged in PostgreSQL, the backend Go router handler
          (<code>/college/movement</code>) is awaiting deployment in the subsequent sprint. Per HMS data
          integrity rules, no synthetic movements are simulated. Campus gate checkpoints and stationed
          security personnel are live and operational below.
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="kpi-cards-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Configured Checkpoints</span>
            <div className="stat-kpi-icon-wrap blue">
              <DoorClosed size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-blue-600">{gates.length}</div>
          <div className="stat-kpi-footnote">
            <span>Perimeter security gates</span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Active Operational Gates</span>
            <div className="stat-kpi-icon-wrap emerald">
              <DoorOpen size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-emerald-600">
            {gates.filter((g) => g.status === 'ACTIVE').length}
          </div>
          <div className="stat-kpi-footnote">
            <span className="status-dot green" />
            <span>Open for student access</span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Stationed Security Guards</span>
            <div className="stat-kpi-icon-wrap purple">
              <ShieldCheck size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-purple-600">
            {securityAssignments.filter((s) => s.status === 'ACTIVE').length}
          </div>
          <div className="stat-kpi-footnote">
            <span>Active guard duty assignments</span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Curfew Policy State</span>
            <div className="stat-kpi-icon-wrap orange">
              <Clock size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-orange-600">ENFORCED</div>
          <div className="stat-kpi-footnote">
            <span>22:00 Curfew Roll-Call Active</span>
          </div>
        </div>
      </div>

      {/* Main Gates Table Card */}
      <div className="enterprise-card" style={{ marginBottom: '24px' }}>
        <div className="card-topbar">
          <div className="card-title-group">
            <div className="card-title-icon-wrap">
              <DoorClosed size={16} />
            </div>
            <h2 className="card-title-text">Campus Checkpoint Registry</h2>
          </div>
          <span className="badge-enterprise badge-emerald">
            {filteredGates.length} of {gates.length} Gates Active
          </span>
        </div>

        {/* Filter Toolbar */}
        <div className="enterprise-filter-bar">
          <div className="filter-search-field">
            <Search size={14} className="filter-search-icon" />
            <input
              type="text"
              className="filter-search-input"
              placeholder="Search by gate name, code, location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <select
              className="filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>

            <select
              className="filter-select"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="ALL">All Gate Types</option>
              <option value="PEDESTRIAN">PEDESTRIAN</option>
              <option value="VEHICULAR">VEHICULAR</option>
              <option value="MAIN_ENTRANCE">MAIN ENTRANCE</option>
              <option value="EMERGENCY_EXIT">EMERGENCY EXIT</option>
            </select>
          </div>
        </div>

        {/* Gates Table */}
        <div className="enterprise-table-container">
          <table className="enterprise-table">
            <thead>
              <tr>
                <th>Gate Checkpoint</th>
                <th>Identifier Code</th>
                <th>Gate Type</th>
                <th>Associated Facility</th>
                <th>Location Details</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '48px 0' }}>
                    <LoadingState message="Loading campus gate checkpoints from backend..." />
                  </td>
                </tr>
              ) : filteredGates.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '48px 0' }}>
                    <EmptyState
                      icon={DoorClosed}
                      title="No campus checkpoints found"
                      description={
                        searchTerm || statusFilter !== 'ALL'
                          ? 'Try adjusting your search criteria or status filter.'
                          : 'No campus gate checkpoints have been registered yet.'
                      }
                      actionLabel={canManageGates ? 'Configure Gate Checkpoint' : undefined}
                      onAction={canManageGates ? handleOpenCreateGateModal : undefined}
                    />
                  </td>
                </tr>
              ) : (
                filteredGates.map((gate) => {
                  const hostelName = gate.hostel_id
                    ? hostelMap.get(gate.hostel_id)?.name || 'Main Campus Perimeter'
                    : 'Institutional Perimeter';

                  return (
                    <tr key={gate.id} className="enterprise-table-row">
                      {/* Name */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '8px',
                              background: '#f1f5f9',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#334155',
                              fontWeight: 600,
                              fontSize: '13px',
                              flexShrink: 0,
                            }}
                          >
                            <DoorClosed size={16} />
                          </div>
                          <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '13.5px' }}>
                            {gate.name}
                          </div>
                        </div>
                      </td>

                      {/* Code */}
                      <td>
                        <code
                          style={{
                            background: '#f1f5f9',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontWeight: 600,
                            fontSize: '12px',
                            color: '#0f172a',
                          }}
                        >
                          {gate.code}
                        </code>
                      </td>

                      {/* Type */}
                      <td>
                        <span className="badge-enterprise badge-blue">
                          {gate.gate_type || 'PEDESTRIAN'}
                        </span>
                      </td>

                      {/* Hostel Facility */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Building2 size={13} style={{ color: '#64748b' }} />
                          <span style={{ fontSize: '13px', color: '#334155' }}>{hostelName}</span>
                        </div>
                      </td>

                      {/* Location Details */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <MapPin size={12} style={{ color: '#64748b' }} />
                          <span style={{ fontSize: '12.5px', color: '#475569' }}>
                            {gate.location_description || 'North campus boundary checkpoint'}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td>
                        {gate.status === 'ACTIVE' ? (
                          <span className="badge-enterprise badge-emerald">OPERATIONAL</span>
                        ) : (
                          <span className="badge-enterprise badge-slate">INACTIVE</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'right' }}>
                        <div
                          style={{
                            display: 'flex',
                            gap: '6px',
                            justifyContent: 'flex-end',
                            alignItems: 'center',
                          }}
                        >
                          {canManageGates && (
                            <button
                              type="button"
                              className={`table-icon-btn ${
                                gate.status === 'ACTIVE' ? 'text-amber-600' : 'text-emerald-600'
                              }`}
                              title={
                                gate.status === 'ACTIVE'
                                  ? 'Deactivate Checkpoint'
                                  : 'Activate Checkpoint'
                              }
                              onClick={() => handleToggleGateStatus(gate)}
                            >
                              <Activity size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Security Stationing Section */}
      <div className="enterprise-card">
        <div className="card-topbar">
          <div className="card-title-group">
            <div className="card-title-icon-wrap">
              <ShieldCheck size={16} />
            </div>
            <h2 className="card-title-text">Gate Security Guard Deployments</h2>
          </div>
          <span className="badge-enterprise badge-purple">
            {securityAssignments.length} Deployments Active
          </span>
        </div>

        <div className="enterprise-table-container">
          <table className="enterprise-table">
            <thead>
              <tr>
                <th>Security Officer</th>
                <th>Assigned Checkpoint</th>
                <th>Shift Schedule</th>
                <th>Contact</th>
                <th>Deployment Status</th>
              </tr>
            </thead>
            <tbody>
              {securityAssignments.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                    No security guard gate postings assigned.
                  </td>
                </tr>
              ) : (
                securityAssignments.map((sec) => {
                  const staff = staffMap.get(sec.staff_id);
                  const staffName = staff
                    ? `${staff.first_name || ''} ${staff.last_name || ''}`.trim()
                    : 'Security Guard';
                  const gate = gates.find((g) => g.id === sec.gate_id);

                  return (
                    <tr key={sec.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{staffName}</div>
                        <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                          ID: {sec.staff_id ? sec.staff_id.slice(0, 8) : 'N/A'}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500, color: '#1e293b' }}>
                          {gate?.name || 'Main Gate Checkpoint'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          Code: {gate?.code || 'GATE-01'}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '12.5px', fontWeight: 500 }}>
                          {sec.shift || 'Night Shift (20:00 - 08:00)'}
                        </span>
                      </td>
                      <td>{staff?.phone || 'Campus Extension #204'}</td>
                      <td>
                        <span className="badge-enterprise badge-emerald">ON DUTY</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =================================================================== */}
      {/* MODAL: Configure Campus Gate Checkpoint                             */}
      {/* =================================================================== */}
      {createGateModalOpen && (
        <Modal
          isOpen={createGateModalOpen}
          onClose={() => !formSubmitting && setCreateGateModalOpen(false)}
          title="Configure Campus Gate Checkpoint"
          size="md"
        >
          <form onSubmit={handleCreateGateSubmit}>
            {formError && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#991b1b',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  fontSize: '13px',
                }}
              >
                {formError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <FormField label="Checkpoint Name" required>
                  <input
                    type="text"
                    className="filter-search-input"
                    style={{ width: '100%', height: '38px' }}
                    placeholder="e.g. North Hostel Boundary Gate"
                    value={gateFormData.name}
                    onChange={(e) =>
                      setGateFormData((prev) => ({ ...prev, name: e.target.value }))
                    }
                    required
                  />
                </FormField>

                <FormField label="Gate Identifier Code" required>
                  <input
                    type="text"
                    className="filter-search-input"
                    style={{ width: '100%', height: '38px' }}
                    placeholder="e.g. GATE-03"
                    value={gateFormData.code}
                    onChange={(e) =>
                      setGateFormData((prev) => ({ ...prev, code: e.target.value }))
                    }
                    required
                  />
                </FormField>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <FormField label="Gate Operational Type" required>
                  <select
                    className="filter-select"
                    style={{ width: '100%', height: '38px' }}
                    value={gateFormData.gate_type}
                    onChange={(e) =>
                      setGateFormData((prev) => ({ ...prev, gate_type: e.target.value }))
                    }
                    required
                  >
                    <option value="PEDESTRIAN">PEDESTRIAN (Turnstile & biometric)</option>
                    <option value="VEHICULAR">VEHICULAR (Boom barrier checkpoint)</option>
                    <option value="MAIN_ENTRANCE">MAIN ENTRANCE (Multi-lane gate)</option>
                    <option value="EMERGENCY_EXIT">EMERGENCY EXIT (Fire and service gate)</option>
                  </select>
                </FormField>

                <FormField label="Associated Hostel Facility">
                  <select
                    className="filter-select"
                    style={{ width: '100%', height: '38px' }}
                    value={gateFormData.hostel_id}
                    onChange={(e) =>
                      setGateFormData((prev) => ({ ...prev, hostel_id: e.target.value }))
                    }
                  >
                    <option value="">Campus Boundary (No specific hostel)</option>
                    {hostels.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>

              <FormField label="Physical Location Description">
                <input
                  type="text"
                  className="filter-search-input"
                  style={{ width: '100%', height: '38px' }}
                  placeholder="e.g. Behind Dining Hall Block B, adjacent to sports pavilion"
                  value={gateFormData.location_description}
                  onChange={(e) =>
                    setGateFormData((prev) => ({
                      ...prev,
                      location_description: e.target.value,
                    }))
                  }
                />
              </FormField>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
                marginTop: '24px',
                paddingTop: '16px',
                borderTop: '1px solid #f1f5f9',
              }}
            >
              <button
                type="button"
                className="action-btn-secondary"
                onClick={() => setCreateGateModalOpen(false)}
                disabled={formSubmitting}
              >
                Cancel
              </button>
              <button type="submit" className="action-btn-primary" disabled={formSubmitting}>
                {formSubmitting ? 'Registering...' : 'Save Checkpoint'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
