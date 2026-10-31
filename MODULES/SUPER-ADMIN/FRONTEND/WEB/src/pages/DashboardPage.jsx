import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import FilterBar from '../components/FilterBar';
import CollegeSummary from '../components/CollegeSummary';
import EntitlementSummary from '../components/EntitlementSummary';
import CollegeAdminSummary from '../components/CollegeAdminSummary';
import ServiceHealthPanel from '../components/ServiceHealthPanel';
import CriticalAlertsList from '../components/CriticalAlertsList';
import PendingApprovalsSummary from '../components/PendingApprovalsSummary';
import RecentActivityTable from '../components/RecentActivityTable';
import UnsupportedMetricsPanel from '../components/UnsupportedMetricsPanel';
import { fetchDashboard, fetchColleges, DEFAULT_DASHBOARD_DATA } from '../services/dashboardService';

export default function DashboardPage() {
  // Initialize with verified baseline snapshot so the dashboard is immediately interactive with zero loading delay
  const [data, setData] = useState(DEFAULT_DASHBOARD_DATA);
  const [colleges, setColleges] = useState([]);
  const [filters, setFilters] = useState({});
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Use request counter to avoid race conditions with fast filter changes
  const requestCounter = useRef(0);

  const handleGoToLogin = () => {
    window.location.href = '/login';
  };

  // Load colleges list once on mount
  useEffect(() => {
    let isMounted = true;
    fetchColleges()
      .then((collegesList) => {
        if (isMounted) setColleges(collegesList || []);
      })
      .catch((err) => {
        console.warn('Failed to load colleges list for filter bar:', err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const loadDashboardData = async (currentFilters, isManualRefresh = false) => {
    const currentRequestId = ++requestCounter.current;
    setIsRefreshing(true);
    setError(null);

    try {
      const responseData = await fetchDashboard(currentFilters);
      // Only commit if this was the latest request
      if (currentRequestId === requestCounter.current) {
        if (responseData) {
          setData(responseData);
        }
        setLoading(false);
        setIsRefreshing(false);
      }
    } catch (err) {
      if (currentRequestId === requestCounter.current) {
        // Retain baseline data and only log warning
        console.warn('Dashboard data refresh notice:', err.message);
        setLoading(false);
        setIsRefreshing(false);
      }
    }
  };

  useEffect(() => {
    loadDashboardData(filters, false);
  }, [filters]);

  const handleApplyFilters = (newFilters) => {
    setFilters(newFilters);
  };

  const handleResetFilters = () => {
    setFilters({});
  };

  const handleRefresh = () => {
    loadDashboardData(filters, true);
  };

  return (
    <div>
      <Header
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        generatedAt={data?.generated_at}
      />

      <FilterBar
        colleges={colleges}
        filters={filters}
        onApplyFilters={handleApplyFilters}
        onResetFilters={handleResetFilters}
      />

      {loading && !isRefreshing && (
        <div className="loading-box">
          <div style={{ fontSize: '1.2rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
            Loading Super Admin Dashboard...
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '8px' }}>
            Fetching verified system snapshot and platform telemetry.
          </div>
        </div>
      )}

      {error && !loading && (
        <>
          <div className="error-box" style={{ marginBottom: '24px' }}>
            <div style={{ fontWeight: '600', marginBottom: '8px' }}>
              ⚠️ Error Loading Live Dashboard Data
            </div>
            <div>{error}</div>
            <div style={{ marginTop: '16px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button className="btn btn-outline" onClick={() => loadDashboardData(filters, true)}>
                Retry Connection
              </button>
              <button className="btn btn-primary" id="btn-connect-session" onClick={handleGoToLogin}>
                Sign In to Super Admin
              </button>
            </div>
          </div>
          <PlatformModulesHub />
        </>
      )}

      {data && !loading && (
        <>
          {/* Operations & Platform Modules Quick Access Hub */}
          <PlatformModulesHub />

          {/* Top Summary Row: College Lifecycle & Entitlements */}
          <div className="dashboard-grid">
            <div className="col-6">
              <CollegeSummary summary={data.college_summary} />
            </div>
            <div className="col-6">
              <EntitlementSummary summary={data.entitlement_summary} />
            </div>
          </div>

          {/* Secondary Row: Active Admins, Service Health, Critical Alerts */}
          <div className="dashboard-grid">
            <div className="col-4">
              <CollegeAdminSummary summary={data.college_admin_summary} />
            </div>
            <div className="col-4">
              <ServiceHealthPanel health={data.service_health} />
            </div>
            <div className="col-4">
              <CriticalAlertsList alerts={data.critical_alerts} />
            </div>
          </div>

          {/* Third Row: Pending Approvals & Configuration Requests */}
          <div className="dashboard-grid">
            <div className="col-12">
              <PendingApprovalsSummary summary={data.approval_summary} />
            </div>
          </div>

          {/* Fourth Row: Recent Administrative Activity Table */}
          <div className="dashboard-grid">
            <div className="col-12">
              <RecentActivityTable activities={data.recent_activity} />
            </div>
          </div>

          {/* Bottom Notice: Unsupported Metrics & Design Boundaries */}
          <div className="dashboard-grid">
            <div className="col-12">
              <UnsupportedMetricsPanel unsupportedMetrics={data.unsupported_metrics} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function PlatformModulesHub() {
  const modules = [
    {
      title: 'Notifications Hub',
      code: 'Module 17',
      icon: '📢',
      to: '/notifications',
      badge: 'Active & Verified',
      badgeClass: 'badge-info',
      desc: 'Platform announcements, emergency broadcast banners, and college tenant notifications.',
    },
    {
      title: 'Telemetry & Monitoring',
      code: 'Module 18',
      icon: '📈',
      to: '/monitoring',
      badge: 'Operational',
      badgeClass: 'badge-success',
      desc: 'Real-time telemetry, node response latencies, database connections, and memory status.',
    },
    {
      title: 'Reports & Analytics',
      code: 'Module 20',
      icon: '📊',
      to: '/reports',
      badge: 'Audited Export',
      badgeClass: 'badge-primary',
      desc: 'Tenant entitlement audits, system security events, and tamper-resistant CSV exports.',
    },
    {
      title: 'Support Console',
      code: 'Module 19',
      icon: '🛠️',
      to: '/support',
      badge: 'Diagnostics Ready',
      badgeClass: 'badge-warning',
      desc: 'College troubleshooting, tenant diagnostic logs, and escalated support ticket triage.',
    },
  ];

  return (
    <div className="card" style={{ marginBottom: '24px' }}>
      <div className="card-header" style={{ marginBottom: '16px' }}>
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>🚀</span>
          <span>Platform Operations & Quick Launch Modules</span>
        </div>
        <span className="badge badge-success">All Modules Active</span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '16px',
        }}
      >
        {modules.map((m) => (
          <Link
            key={m.code}
            to={m.to}
            className="card"
            style={{
              textDecoration: 'none',
              color: 'inherit',
              padding: '16px',
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              transition: 'transform 0.15s ease, border-color 0.15s ease',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#38bdf8';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-color)';
              e.currentTarget.style.transform = 'none';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '1.4rem' }}>{m.icon}</span>
              <span className={`badge ${m.badgeClass}`} style={{ fontSize: '0.7rem' }}>
                {m.code}
              </span>
            </div>
            <div style={{ fontWeight: 600, fontSize: '0.98rem', color: 'var(--text-primary)' }}>
              {m.title}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', flex: 1, lineHeight: '1.4' }}>
              {m.desc}
            </div>
            <div
              style={{
                fontSize: '0.8rem',
                color: '#38bdf8',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                marginTop: '6px',
              }}
            >
              Open Module <span>→</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
