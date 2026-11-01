import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../shared/auth/useAuth';
import adminService from '../services/adminService';
import {
  Users,
  UserCheck,
  ShieldCheck,
  Clock,
  DoorOpen,
  DoorClosed,
  Info,
  Search,
  Filter,
  RefreshCw,
  Building2,
  MapPin,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Phone,
  FileText,
} from 'lucide-react';
import {
  PageHeader,
  DataTable,
  SearchInput,
  FilterControls,
  Modal,
  FormField,
  LoadingState,
  EmptyState,
  ErrorState,
} from '../../../shared/components';

export default function AdminVisitorsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Master Data State
  const [gates, setGates] = useState([]);
  const [securityAssignments, setSecurityAssignments] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [hostels, setHostels] = useState([]);

  // UI & Loading States
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

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
  const loadVisitorContext = useCallback(async (isManualRefresh = false) => {
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
      console.error('Failed to load visitor checkpoint context:', err);
      setErrorMessage('Failed to load campus gate checkpoints.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadVisitorContext();
  }, [loadVisitorContext]);

  return (
    <div className="enterprise-module-page">
      {/* Header Bar */}
      <div className="enterprise-page-header">
        <div className="header-text-group">
          <div className="header-title-row">
            <div className="header-icon-badge">
              <Users size={22} />
            </div>
            <div>
              <h1 className="header-title">Visitor Management & Campus Access</h1>
              <p className="header-subtitle">
                Campus visitor registration protocol, security gate check-in rules, and perimeter access logs.
              </p>
            </div>
          </div>
        </div>

        <div className="header-actions-group">
          <button
            type="button"
            className="action-btn-secondary"
            onClick={() => loadVisitorContext(true)}
            disabled={isRefreshing || loading}
            title="Refresh Checkpoint Data"
          >
            <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

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
          <strong>Backend Service Notice:</strong> While the PostgreSQL visitor database tables (
          <code>app.visitor_requests</code>, <code>app.visitors</code>, and <code>app.visitor_visits</code>) are defined
          in the migration schema, the corresponding Go backend HTTP handlers (<code>/college/visitors</code>)
          have not yet been exposed in <code>router.go</code>. In strict compliance with HMS data integrity rules,
          no simulated visitor records or synthetic check-ins/check-outs are displayed. Active gate checkpoints and
          security postings operating under institutional visitor guidelines are shown below.
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="kpi-cards-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Visitor Checkpoints</span>
            <div className="stat-kpi-icon-wrap blue">
              <DoorClosed size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-blue-600">{gates.length}</div>
          <div className="stat-kpi-footnote">
            <span>Perimeter reception gates</span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">On-Duty Security Guards</span>
            <div className="stat-kpi-icon-wrap purple">
              <ShieldCheck size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-purple-600">
            {securityAssignments.filter((s) => s.status === 'ACTIVE').length}
          </div>
          <div className="stat-kpi-footnote">
            <span>Gate inspection personnel</span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Visiting Hours</span>
            <div className="stat-kpi-icon-wrap emerald">
              <Clock size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-emerald-600">10:00 - 18:00</div>
          <div className="stat-kpi-footnote">
            <span className="status-dot green" />
            <span>Authorized daytime hours</span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Visitor Policy</span>
            <div className="stat-kpi-icon-wrap orange">
              <UserCheck size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-orange-600">ENFORCED</div>
          <div className="stat-kpi-footnote">
            <span>Valid government ID required</span>
          </div>
        </div>
      </div>

      {/* Main Table: Active Gate Reception Checkpoints */}
      <div className="enterprise-card" style={{ marginBottom: '24px' }}>
        <div className="card-topbar">
          <div className="card-title-group">
            <div className="card-title-icon-wrap">
              <DoorClosed size={16} />
            </div>
            <h2 className="card-title-text">Designated Visitor Reception Checkpoints</h2>
          </div>
          <span className="badge-enterprise badge-emerald">
            {gates.length} Checkpoints Configured
          </span>
        </div>

        <div className="enterprise-table-container">
          <table className="enterprise-table">
            <thead>
              <tr>
                <th>Gate Checkpoint</th>
                <th>Identifier Code</th>
                <th>Gate Type</th>
                <th>Facility Perimeter</th>
                <th>Location Details</th>
                <th>Operational Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '36px 0' }}>
                    <LoadingState message="Loading visitor checkpoints..." />
                  </td>
                </tr>
              ) : gates.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '36px 0' }}>
                    <EmptyState
                      icon={DoorClosed}
                      title="No gate checkpoints registered"
                      description="Perimeter gates have not been configured yet."
                    />
                  </td>
                </tr>
              ) : (
                gates.map((g) => (
                  <tr key={g.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{g.name}</div>
                    </td>
                    <td>
                      <code>{g.code}</code>
                    </td>
                    <td>
                      <span className="badge-enterprise badge-blue">{g.gate_type}</span>
                    </td>
                    <td>
                      {g.hostel_id ? hostelMap.get(g.hostel_id)?.name || 'Hostel Boundary' : 'Main Campus Perimeter'}
                    </td>
                    <td>{g.location_description || 'Main entrance security booth'}</td>
                    <td>
                      {g.status === 'ACTIVE' ? (
                        <span className="badge-enterprise badge-emerald">OPERATIONAL</span>
                      ) : (
                        <span className="badge-enterprise badge-slate">INACTIVE</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Institutional Guidelines */}
      <div className="enterprise-card">
        <div className="card-topbar">
          <div className="card-title-group">
            <div className="card-title-icon-wrap">
              <ShieldCheck size={16} />
            </div>
            <h2 className="card-title-text">Hostel Visitor Compliance Guidelines</h2>
          </div>
        </div>

        <div style={{ padding: '20px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: '6px' }}>
              1. Government ID Verification
            </div>
            <div style={{ fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>
              All non-institutional visitors (parents, guardians, relatives) must present valid government photo ID
              at campus checkpoints prior to admission.
            </div>
          </div>

          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: '6px' }}>
              2. Designated Visitor Lounges
            </div>
            <div style={{ fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>
              Visitors are permitted strictly in ground-floor visitor parlors and common reception areas. Unescorted access to
              residential corridors and student rooms is prohibited.
            </div>
          </div>

          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: '6px' }}>
              3. Curfew & Overnight Restrictions
            </div>
            <div style={{ fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>
              All visitors must depart campus by 18:00 hrs. Overnight stays in hostel premises are not permitted under standard
              institutional safety policy.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

