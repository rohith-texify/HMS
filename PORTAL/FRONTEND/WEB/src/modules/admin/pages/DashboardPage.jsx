import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../../../shared/api/api';
import { useAuth } from '../../../shared/auth/useAuth';
import {
  Building2,
  GraduationCap,
  Users,
  BedDouble,
  RefreshCw,
  Plus,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Search,
  Sparkles,
  ExternalLink,
} from 'lucide-react';

/**
 * Lightweight, accessible count-up effect that only runs on mount.
 */
function CountUpNumber({ value, duration = 350 }) {
  const [displayValue, setDisplayValue] = useState(0);
  const animatedRef = useRef(false);

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion || animatedRef.current || typeof value !== 'number') {
      setDisplayValue(value);
      return;
    }

    animatedRef.current = true;
    let startTimestamp = null;
    const target = Number(value) || 0;

    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(easeProgress * target));

      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        setDisplayValue(target);
      }
    };

    window.requestAnimationFrame(step);
  }, [value, duration]);

  return <span>{displayValue}</span>;
}

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [hostels, setHostels] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [tableSearch, setTableSearch] = useState('');

  const loadData = async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const [studRes, hostRes, staffRes] = await Promise.allSettled([
        api.get('/college/students'),
        api.get('/college/hostels'),
        api.get('/college/staff'),
      ]);

      if (studRes.status === 'fulfilled') {
        const d = studRes.value.data || studRes.value;
        setStudents(Array.isArray(d) ? d : d?.students || []);
      }
      if (hostRes.status === 'fulfilled') {
        const d = hostRes.value.data || hostRes.value;
        setHostels(Array.isArray(d) ? d : d?.hostels || []);
      }
      if (staffRes.status === 'fulfilled') {
        const d = staffRes.value.data || staffRes.value;
        setStaff(Array.isArray(d) ? d : d?.staff || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to load college data');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter hostels table
  const filteredHostels = hostels.filter((h) => {
    if (!tableSearch) return true;
    const q = tableSearch.toLowerCase();
    const name = (h.name || '').toLowerCase();
    const code = (h.code || '').toLowerCase();
    const type = (h.type || '').toLowerCase();
    return name.includes(q) || code.includes(q) || type.includes(q);
  });

  // Calculate total capacity
  const totalCapacity = hostels.reduce((acc, h) => {
    const cap = parseInt(h.capacity, 10);
    return acc + (isNaN(cap) ? 120 : cap);
  }, 0);

  return (
    <div className="fade-in-up">
      {/* SECTION 1: Hero Header */}
      <div className="enterprise-hero-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
          {user?.college_logo_url && (
            <img
              src={user.college_logo_url}
              alt={user.college_name || 'College Logo'}
              style={{
                width: '56px',
                height: '56px',
                objectFit: 'contain',
                borderRadius: '12px',
                background: '#ffffff',
                padding: '4px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                flexShrink: 0,
              }}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          )}
          <div className="hero-header-titles">
            <div className="hero-category-pill">
              <Sparkles size={13} />
              <span>{user?.college_code ? `${user.college_code} • Institutional Control Plane` : 'Institutional Control Plane'}</span>
            </div>
            <h1 className="hero-main-title">{user?.college_name || 'College Dashboard'}</h1>
            <p className="hero-subtitle">
              Real-time management overview of campus hostel blocks, residential staff, student enrollments, and room capacities.
            </p>
          </div>
        </div>

        <div className="hero-action-buttons">
          <button
            type="button"
            className="btn-enterprise-secondary"
            onClick={() => loadData(true)}
            disabled={isRefreshing}
            title="Refresh dashboard data"
          >
            <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <Link to="/admin/hostels" className="btn-enterprise-primary">
            <Plus size={14} />
            <span>Manage Hostels</span>
          </Link>
        </div>
      </div>

      {/* Error Notice */}
      {error && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '10px',
            color: '#b91c1c',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '20px',
            fontSize: '0.85rem',
          }}
          role="alert"
        >
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* SECTION 2: Enterprise KPI Metric Cards */}
      <div className="kpi-cards-grid">
        {/* Total Students */}
        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Enrolled Students</span>
            <div className="stat-kpi-icon-wrap blue">
              <GraduationCap size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-blue-600">
            <CountUpNumber value={students.length} />
          </div>
          <div className="stat-kpi-footnote">
            <span className="status-dot green" />
            <span>Active residential enrollments</span>
          </div>
        </div>

        {/* Hostel Blocks */}
        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Hostel Blocks</span>
            <div className="stat-kpi-icon-wrap emerald">
              <Building2 size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-emerald-600">
            <CountUpNumber value={hostels.length} />
          </div>
          <div className="stat-kpi-footnote">
            <span className="status-dot green" />
            <span>Managed campus facilities</span>
          </div>
        </div>

        {/* College Staff */}
        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">College Staff</span>
            <div className="stat-kpi-icon-wrap purple">
              <Users size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-purple-600">
            <CountUpNumber value={staff.length} />
          </div>
          <div className="stat-kpi-footnote">
            <span className="status-dot green" />
            <span>Wardens & supervisory team</span>
          </div>
        </div>

        {/* Total Capacity */}
        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Bed Capacity</span>
            <div className="stat-kpi-icon-wrap amber">
              <BedDouble size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-amber-600">
            <CountUpNumber value={totalCapacity} />
          </div>
          <div className="stat-kpi-footnote">
            <span className="status-dot green" />
            <span>Total residential bed capacity</span>
          </div>
        </div>
      </div>

      {/* SECTION 3: Quick Operations Module Grid */}
      <div className="enterprise-card">
        <div className="card-topbar">
          <div className="card-title-group">
            <div className="card-title-icon-wrap">
              <Building2 size={16} />
            </div>
            <h2 className="card-title-text">Administrative Management Modules</h2>
          </div>
          <span className="badge-enterprise badge-green">Operational</span>
        </div>

        <div className="admin-quick-ops-grid">
          <Link to="/admin/hostels" className="operation-module-item">
            <div className="module-item-header">
              <div className="module-icon-box">
                <Building2 size={18} />
              </div>
              <span className="badge-enterprise badge-blue">Facility</span>
            </div>
            <div className="module-item-title">Hostels & Blocks</div>
            <p className="module-item-desc">
              Manage hostel structures, wings, floors, room configurations, and gender partitions.
            </p>
            <div className="module-item-action">
              <span>Configure Facilities</span>
              <ArrowRight size={13} />
            </div>
          </Link>

          <Link to="/admin/staff" className="operation-module-item">
            <div className="module-item-header">
              <div className="module-icon-box">
                <Users size={18} />
              </div>
              <span className="badge-enterprise badge-purple">Staffing</span>
            </div>
            <div className="module-item-title">College Staff</div>
            <p className="module-item-desc">
              Oversee residential hostel wardens, caretaking supervisors, and duty rosters.
            </p>
            <div className="module-item-action">
              <span>View Staff Roster</span>
              <ArrowRight size={13} />
            </div>
          </Link>

          <Link to="/admin/students" className="operation-module-item">
            <div className="module-item-header">
              <div className="module-icon-box">
                <GraduationCap size={18} />
              </div>
              <span className="badge-enterprise badge-green">Enrollment</span>
            </div>
            <div className="module-item-title">Students Directory</div>
            <p className="module-item-desc">
              Access the complete resident student directory, room allotments, and parent details.
            </p>
            <div className="module-item-action">
              <span>Open Directory</span>
              <ArrowRight size={13} />
            </div>
          </Link>

          <div className="operation-module-item" style={{ opacity: 0.9 }}>
            <div className="module-item-header">
              <div className="module-icon-box">
                <ShieldCheck size={18} />
              </div>
              <span className="badge-enterprise badge-amber">Compliance</span>
            </div>
            <div className="module-item-title">Institutional Health</div>
            <p className="module-item-desc">
              Audit occupancy compliance, warden assignments, and campus emergency readiness.
            </p>
            <div className="module-item-action" style={{ color: '#059669' }}>
              <span>All Systems Nominal</span>
              <CheckCircle2 size={13} />
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 4: Split Layout — Facilities Table & Quick Action Panel */}
      <div className="dashboard-split-layout">
        {/* Left: Facilities Overview */}
        <div className="enterprise-card" style={{ marginBottom: 0 }}>
          <div className="card-topbar">
            <div className="card-title-group">
              <div className="card-title-icon-wrap">
                <Building2 size={16} />
              </div>
              <h2 className="card-title-text">Hostel Facilities & Buildings</h2>
            </div>
            <span className="badge-enterprise badge-gray">
              {filteredHostels.length} Registered
            </span>
          </div>

          {/* Filter Bar */}
          <div className="enterprise-filter-bar">
            <div className="filter-search-field">
              <Search size={14} className="filter-search-icon" />
              <input
                type="text"
                className="filter-search-input"
                placeholder="Search by block name, code, type..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
              />
            </div>
            <Link to="/admin/hostels" className="btn-enterprise-secondary">
              <span>View All Hostels</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          {/* Table */}
          <div className="enterprise-table-container">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Hostel Name</th>
                  <th>Building Code</th>
                  <th>Facility Type</th>
                  <th>Bed Capacity</th>
                  <th>Operational Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredHostels.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', color: '#94a3b8', padding: '36px' }}>
                      {loading ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                          <span className="portal-spinner" style={{ width: '16px', height: '16px' }} />
                          <span>Loading hostel facilities...</span>
                        </div>
                      ) : (
                        'No hostel facilities match your query.'
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredHostels.slice(0, 6).map((h, i) => (
                    <tr key={h.id || i}>
                      <td>
                        <strong style={{ color: '#0f172a' }}>{h.name || 'Block ' + (i + 1)}</strong>
                      </td>
                      <td>
                        <span className="code-pill">{h.code || 'B-' + (i + 1)}</span>
                      </td>
                      <td>
                        <span className="badge-enterprise badge-blue">{h.type || 'CO-ED'}</span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: '#334155' }}>
                          {h.capacity || '120'} Beds
                        </span>
                      </td>
                      <td>
                        <span className="badge-enterprise badge-green">ACTIVE</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Quick Action & Readiness Panel */}
        <div className="side-quick-panel">
          {/* Institutional Readiness Card */}
          <div className="side-panel-card">
            <div className="side-panel-header">
              <span className="side-panel-title">Campus Readiness</span>
              <span className="badge-enterprise badge-green">Nominal</span>
            </div>
            <p style={{ fontSize: '0.82rem', color: '#64748b', lineHeight: 1.45, marginBottom: '14px' }}>
              Campus infrastructure is synchronized with the college central database. Residential allotments and gate verification rules are active.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  backgroundColor: '#f8fafc',
                  fontSize: '0.82rem',
                }}
              >
                <span style={{ color: '#475569' }}>Occupancy Rate</span>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>
                  {totalCapacity > 0 ? Math.round((students.length / totalCapacity) * 100) : 0}%
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  backgroundColor: '#f8fafc',
                  fontSize: '0.82rem',
                }}
              >
                <span style={{ color: '#475569' }}>Warden-to-Student Ratio</span>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>
                  1 : {staff.length > 0 ? Math.round(students.length / staff.length) : students.length}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Action Navigation Links */}
          <div className="side-panel-card">
            <div className="side-panel-header">
              <span className="side-panel-title">Quick Actions</span>
            </div>

            <Link to="/admin/students" className="quick-action-link-item">
              <span>View Enrolled Students</span>
              <ArrowRight size={13} />
            </Link>

            <Link to="/admin/staff" className="quick-action-link-item">
              <span>Manage Duty Wardens</span>
              <ArrowRight size={13} />
            </Link>

            <Link to="/admin/hostels" className="quick-action-link-item">
              <span>Configure Room Inventory</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
