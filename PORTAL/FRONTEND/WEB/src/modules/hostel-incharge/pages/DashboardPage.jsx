import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../../shared/api/api';
import adminService from '../../admin/services/adminService';
import {
  BedDouble,
  Building2,
  Wrench,
  ClipboardList,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  ShieldCheck,
  Users,
  DoorOpen,
  UserCheck,
  Phone,
} from 'lucide-react';
import { LoadingState, EmptyState } from '../../../shared/components';

export default function InchargeDashboardPage() {
  const navigate = useNavigate();
  const [myHostel, setMyHostel] = useState(null);
  const [residents, setResidents] = useState([]);
  const [vacantBeds, setVacantBeds] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [complaintSearch, setComplaintSearch] = useState('');
  const [complaintStatusFilter, setComplaintStatusFilter] = useState('ALL');

  const loadData = useCallback(async (manual = false) => {
    try {
      if (manual) setIsRefreshing(true);
      else setLoading(true);

      // 1. Resolve logged-in incharge's assigned hostel
      const hostelRes = await adminService.getMyHostel();
      const hostel = hostelRes.data || hostelRes;
      setMyHostel(hostel);

      if (hostel?.hostel_id) {
        // 2. Fetch residents, vacant beds, and complaints for this hostel
        const [resRes, bedRes, compRes] = await Promise.allSettled([
          adminService.getHostelResidents(hostel.hostel_id),
          adminService.getHostelVacantBeds(hostel.hostel_id),
          api.get('/college/complaints'),
        ]);

        let residentList = [];
        if (resRes.status === 'fulfilled') {
          const d = resRes.value.data || resRes.value;
          residentList = Array.isArray(d) ? d : [];
          setResidents(residentList);
        }

        if (bedRes.status === 'fulfilled') {
          const d = bedRes.value.data || bedRes.value;
          setVacantBeds(Array.isArray(d) ? d : []);
        }

        if (compRes.status === 'fulfilled') {
          const d = compRes.value.data || compRes.value;
          const allComplaints = Array.isArray(d) ? d : d?.complaints || [];

          // Scope complaints strictly to this hostel or students residing in this hostel
          const residentIds = new Set(residentList.map((r) => r.student_id));
          const scopedComplaints = allComplaints.filter(
            (c) =>
              c.hostel_id === hostel.hostel_id ||
              (c.student_id && residentIds.has(c.student_id))
          );
          setComplaints(scopedComplaints);
        }
      }
    } catch (err) {
      console.error('Failed to load incharge dashboard data:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredComplaints = useMemo(() => {
    return complaints.filter((c) => {
      const matchesSearch =
        !complaintSearch ||
        (c.title || '').toLowerCase().includes(complaintSearch.toLowerCase()) ||
        (c.category || '').toLowerCase().includes(complaintSearch.toLowerCase()) ||
        (c.complaint_number || '').toLowerCase().includes(complaintSearch.toLowerCase());
      const matchesStatus =
        complaintStatusFilter === 'ALL' || (c.status || '').toUpperCase() === complaintStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [complaints, complaintSearch, complaintStatusFilter]);

  const pendingComplaintsCount = complaints.filter(
    (c) => (c.status || '').toUpperCase() !== 'RESOLVED'
  ).length;

  const totalBedsCount = (myHostel?.total_capacity && myHostel.total_capacity > 0)
    ? myHostel.total_capacity
    : residents.length + vacantBeds.length;

  const occupancyRate = totalBedsCount > 0
    ? Math.round((residents.length / totalBedsCount) * 100)
    : 0;

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
                Supervised by: <strong>{myHostel.staff_name}</strong> ({myHostel.designation || 'Primary Incharge'}) &bull; Authorized Facility Scope
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
              Occupancy: <strong>{occupancyRate}% ({residents.length}/{totalBedsCount})</strong>
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
              Your incharge account is not currently linked to any hostel facility. Please contact College Administration to link your account.
            </p>
          </div>
        </div>
      )}

      {/* Enterprise Hero Header */}
      <div className="enterprise-hero-header">
        <div className="hero-header-titles">
          <div className="hero-category-pill">
            <BedDouble size={13} />
            <span>Hostel Incharge Operations</span>
          </div>
          <h1 className="hero-main-title">
            {myHostel ? `${myHostel.hostel_name} Operations Dashboard` : 'Warden Operations & Residential Dashboard'}
          </h1>
          <p className="hero-subtitle">
            Real-time room occupancy, resident welfare, maintenance resolution, and nightly roll-call monitoring strictly scoped to {myHostel?.hostel_name || 'your assigned hostel'}.
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
            <span>{isRefreshing ? 'Syncing...' : 'Sync Operations'}</span>
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
            <span>Ready for student allocation</span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Pending Maintenance</span>
            <div className="stat-kpi-icon-wrap orange">
              <Wrench size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-orange-600">{pendingComplaintsCount}</div>
          <div className="stat-kpi-footnote">
            <span>Facility service tickets</span>
          </div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-label">Nightly Curfew Check</span>
            <div className="stat-kpi-icon-wrap blue">
              <ClipboardList size={17} />
            </div>
          </div>
          <div className="stat-kpi-value text-blue-600">Active</div>
          <div className="stat-kpi-footnote">
            <span>Roll-call verification ready</span>
          </div>
        </div>
      </div>

      {/* Facility Residents Overview Card */}
      <div className="enterprise-card" style={{ marginBottom: '24px' }}>
        <div className="card-topbar">
          <div className="card-title-group">
            <div className="card-title-icon-wrap">
              <Users size={16} />
            </div>
            <h2 className="card-title-text">
              Current Resident Students ({residents.length})
            </h2>
          </div>

          <button
            type="button"
            className="btn-enterprise-secondary"
            style={{ fontSize: '12px', padding: '4px 10px' }}
            onClick={() => navigate('/hostel-incharge/students')}
          >
            <span>View All Residents</span>
            <ArrowRight size={13} />
          </button>
        </div>

        <div style={{ padding: '16px' }}>
          {loading ? (
            <div style={{ padding: '36px', textAlign: 'center' }}>
              <LoadingState message="Loading facility residents..." />
            </div>
          ) : residents.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center' }}>
              <EmptyState
                title="No resident students assigned"
                message="No students have been allocated to rooms in this hostel facility yet."
              />
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '12px',
              }}
            >
              {residents.slice(0, 8).map((r) => (
                <div
                  key={r.allocation_id}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: '#e0e7ff',
                        color: '#4338ca',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '12px',
                        flexShrink: 0,
                      }}
                    >
                      {(r.first_name || 'S')[0].toUpperCase()}
                    </div>
                    <div>
                      <strong style={{ color: '#0f172a', fontSize: '13px', display: 'block' }}>
                        {r.full_name}
                      </strong>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>
                        {r.admission_number}
                      </span>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span className="badge-enterprise badge-purple" style={{ fontSize: '10.5px' }}>
                      Room {r.room_code || r.room_name}
                    </span>
                    <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginTop: '2px' }}>
                      {r.bed_name}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Facility Complaints & Service Requests */}
      <div className="enterprise-card">
        <div className="card-topbar">
          <div className="card-title-group">
            <div className="card-title-icon-wrap">
              <Wrench size={16} />
            </div>
            <h2 className="card-title-text">
              Facility Service &amp; Maintenance Requests ({complaints.length})
            </h2>
          </div>

          <span className="badge-enterprise badge-orange">
            {pendingComplaintsCount} Pending Tickets
          </span>
        </div>

        {/* Filter Toolbar */}
        <div className="enterprise-filter-bar">
          <div className="filter-search-field">
            <Search size={14} className="filter-search-icon" />
            <input
              type="text"
              className="filter-search-input"
              placeholder="Search complaints by title, category..."
              value={complaintSearch}
              onChange={(e) => setComplaintSearch(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <select
              className="filter-select"
              value={complaintStatusFilter}
              onChange={(e) => setComplaintStatusFilter(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">PENDING</option>
              <option value="IN_PROGRESS">IN_PROGRESS</option>
              <option value="RESOLVED">RESOLVED</option>
            </select>
          </div>
        </div>

        <div className="enterprise-table-container">
          <table className="enterprise-table">
            <thead>
              <tr>
                <th>Issue / Description</th>
                <th>Category</th>
                <th>Date Logged</th>
                <th>Resolution Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '36px' }}>
                    <LoadingState message="Loading maintenance tickets..." />
                  </td>
                </tr>
              ) : filteredComplaints.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '36px' }}>
                    <EmptyState
                      title="No maintenance requests"
                      message="All resident service tickets for this facility are resolved or none match filters."
                    />
                  </td>
                </tr>
              ) : (
                filteredComplaints.slice(0, 10).map((c, i) => {
                  const status = (c.status || 'PENDING').toUpperCase();
                  const isResolved = status === 'RESOLVED';
                  const isInProgress = status === 'IN_PROGRESS';

                  return (
                    <tr key={c.id || i}>
                      <td>
                        <strong style={{ color: '#0f172a', display: 'block', fontSize: '13.5px' }}>
                          {c.title}
                        </strong>
                        {c.description && (
                          <span style={{ fontSize: '11px', color: '#64748b' }}>
                            {c.description.slice(0, 80)}...
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="badge-enterprise badge-purple">
                          {c.category || 'GENERAL'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '12px', color: '#475569' }}>
                          {c.created_at ? new Date(c.created_at).toLocaleDateString() : 'Recent'}
                        </span>
                      </td>
                      <td>
                        {isResolved ? (
                          <span className="badge-enterprise badge-green">RESOLVED</span>
                        ) : isInProgress ? (
                          <span className="badge-enterprise badge-blue">IN PROGRESS</span>
                        ) : (
                          <span className="badge-enterprise badge-orange">PENDING</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
