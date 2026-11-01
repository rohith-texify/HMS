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
import { fetchDashboard, fetchColleges, DEFAULT_DASHBOARD_DATA } from '../services/dashboardService';
import {
  Building2,
  CheckCircle2,
  FileCheck,
  Users,
  Bell,
  Activity,
  BarChart3,
  HelpCircle,
  ArrowRight,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';

/**
 * Lightweight, accessible count-up effect that only runs on initial mount.
 * Prevents repeated animations on background refreshes or ordinary re-renders.
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
      // Ease out cubic
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

export default function DashboardPage() {
  const [data, setData] = useState(DEFAULT_DASHBOARD_DATA);
  const [colleges, setColleges] = useState([]);
  const [filters, setFilters] = useState({});
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const requestCounter = useRef(0);

  const handleGoToLogin = () => {
    window.location.href = '/login';
  };

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
      if (currentRequestId === requestCounter.current) {
        if (responseData) {
          setData(responseData);
        }
        setLoading(false);
        setIsRefreshing(false);
      }
    } catch (err) {
      if (currentRequestId === requestCounter.current) {
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

  const totalColleges = data?.college_summary?.total_colleges ?? 0;
  const activeColleges = data?.college_summary?.active_colleges ?? 0;
  const inactiveColleges = data?.college_summary?.inactive_colleges ?? 0;
  const onboardingColleges = data?.college_summary?.onboarding_colleges ?? 0;
  const pendingApprovals = data?.approval_summary?.pending_count ?? 0;
  const pendingConfigChanges = data?.approval_summary?.pending_configuration_count ?? 0;
  const activeAdmins = data?.college_admin_summary?.active_count ?? 0;

  return (
    <div className="dashboard-content-wrapper fade-in-up">
      {/* SECTION 3: Dashboard Header */}
      <Header
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        generatedAt={data?.generated_at}
      />

      {/* SECTION 4: Compact Filter Toolbar */}
      <FilterBar
        colleges={colleges}
        filters={filters}
        onApplyFilters={handleApplyFilters}
        onResetFilters={handleResetFilters}
      />

      {loading && !isRefreshing && (
        <div className="enterprise-loading-box">
          <div className="loading-spinner-blue" />
          <div className="loading-title">Loading Super Admin Dashboard...</div>
          <div className="loading-sub">Fetching verified platform telemetry and system snapshot.</div>
        </div>
      )}

      {error && !loading && (
        <div className="enterprise-alert-card error">
          <div className="alert-card-header">
            <ShieldAlert size={18} className="text-rose-600" />
            <span className="alert-card-title">Error Loading Live Dashboard Data</span>
          </div>
          <p className="alert-card-body">{error}</p>
          <div className="alert-card-actions">
            <button className="btn-enterprise btn-outline-soft" onClick={() => loadDashboardData(filters, true)}>
              Retry Connection
            </button>
            <button className="btn-enterprise btn-primary-blue" id="btn-connect-session" onClick={handleGoToLogin}>
              Sign In to Super Admin
            </button>
          </div>
        </div>
      )}

      {data && !loading && (
        <>
          {/* SECTION 5: Premium Statistics Cards (Subtle Entrance + Count-up) */}
          <div className="stats-kpi-grid stagger-1">
            {/* Card 1: Total Colleges */}
            <div className="stat-kpi-card">
              <div className="stat-kpi-header">
                <span className="stat-kpi-label">Total Colleges</span>
                <div className="stat-kpi-icon-wrap blue">
                  <Building2 size={17} />
                </div>
              </div>
              <div className="stat-kpi-value">
                <CountUpNumber value={totalColleges} />
              </div>
              <div className="stat-kpi-footnote">
                <span className="stat-footnote-highlight">{activeColleges} active</span>
                <span>• {inactiveColleges} inactive</span>
              </div>
            </div>

            {/* Card 2: Active Colleges */}
            <div className="stat-kpi-card">
              <div className="stat-kpi-header">
                <span className="stat-kpi-label">Active Colleges</span>
                <div className="stat-kpi-icon-wrap green">
                  <CheckCircle2 size={17} />
                </div>
              </div>
              <div className="stat-kpi-value text-emerald-600">
                <CountUpNumber value={activeColleges} />
              </div>
              <div className="stat-kpi-footnote">
                <span className="stat-footnote-highlight">{onboardingColleges}</span>
                <span>in onboarding pipeline</span>
              </div>
            </div>

            {/* Card 3: Pending Approvals */}
            <div className="stat-kpi-card">
              <div className="stat-kpi-header">
                <span className="stat-kpi-label">Pending Approvals</span>
                <div className="stat-kpi-icon-wrap amber">
                  <FileCheck size={17} />
                </div>
              </div>
              <div className="stat-kpi-value text-amber-600">
                <CountUpNumber value={pendingApprovals} />
              </div>
              <div className="stat-kpi-footnote">
                <span className="stat-footnote-highlight">{pendingConfigChanges}</span>
                <span>config change requests</span>
              </div>
            </div>

            {/* Card 4: Total Admins */}
            <div className="stat-kpi-card">
              <div className="stat-kpi-header">
                <span className="stat-kpi-label">Total Admins</span>
                <div className="stat-kpi-icon-wrap indigo">
                  <Users size={17} />
                </div>
              </div>
              <div className="stat-kpi-value text-indigo-600">
                <CountUpNumber value={activeAdmins} />
              </div>
              <div className="stat-kpi-footnote">
                <span>Verified active college administrators</span>
              </div>
            </div>
          </div>

          {/* SECTION 6: Quick-Launch Module Cards */}
          <div className="stagger-2">
            <PlatformOperationsHub />
          </div>

          {/* SECTION 7: Summary Sections (2-Column Aligned Grid) */}
          <div className="enterprise-layout-grid two-column stagger-3">
            <div className="grid-cell">
              <CollegeSummary summary={data.college_summary} />
            </div>
            <div className="grid-cell">
              <EntitlementSummary summary={data.entitlement_summary} />
            </div>
          </div>

          {/* SECTION 8: Operational Overview (3-Column Balanced Grid) */}
          <div className="enterprise-layout-grid three-column stagger-4">
            <div className="grid-cell">
              <CollegeAdminSummary summary={data.college_admin_summary} />
            </div>
            <div className="grid-cell">
              <ServiceHealthPanel health={data.service_health} />
            </div>
            <div className="grid-cell">
              <CriticalAlertsList alerts={data.critical_alerts} />
            </div>
          </div>

          {/* SECTION 9: Pending Approvals & Configuration Requests */}
          <div className="enterprise-layout-grid single-column stagger-5">
            <div className="grid-cell">
              <PendingApprovalsSummary summary={data.approval_summary} />
            </div>
          </div>

          {/* SECTION 10: Recent Administrative Activity Table */}
          <div className="enterprise-layout-grid single-column stagger-6">
            <div className="grid-cell">
              <RecentActivityTable activities={data.recent_activity} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function PlatformOperationsHub() {
  const modules = [
    {
      title: 'Notifications Hub',
      code: 'Module 17',
      icon: Bell,
      to: '/notifications',
      badge: 'Active & Verified',
      badgeClass: 'badge-blue',
      desc: 'Platform announcements, emergency broadcast banners, and college tenant notifications.',
    },
    {
      title: 'Telemetry & Monitoring',
      code: 'Module 18',
      icon: Activity,
      to: '/monitoring',
      badge: 'Operational',
      badgeClass: 'badge-green',
      desc: 'Real-time telemetry, node response latencies, database connections, and memory status.',
    },
    {
      title: 'Reports & Analytics',
      code: 'Module 20',
      icon: BarChart3,
      to: '/reports',
      badge: 'Audited Export',
      badgeClass: 'badge-purple',
      desc: 'Tenant entitlement audits, system security events, and tamper-resistant CSV exports.',
    },
    {
      title: 'Support Console',
      code: 'Module 19',
      icon: HelpCircle,
      to: '/support',
      badge: 'Diagnostics Ready',
      badgeClass: 'badge-amber',
      desc: 'College troubleshooting, tenant diagnostic logs, and escalated support ticket triage.',
    },
  ];

  return (
    <div className="platform-operations-card enterprise-card">
      <div className="operations-card-topbar">
        <div className="operations-card-title-group">
          <span className="operations-title-icon-wrap">
            <Sparkles size={16} className="text-blue-600" />
          </span>
          <h2 className="operations-title-text">Platform Operations & Quick Launch Modules</h2>
        </div>
        <span className="badge-enterprise badge-green">All Modules Active</span>
      </div>

      <div className="operations-grid">
        {modules.map((m) => {
          const IconComponent = m.icon;
          return (
            <Link
              key={m.code}
              to={m.to}
              className="operation-module-item"
            >
              <div className="module-item-header">
                <div className="module-icon-box">
                  <IconComponent size={18} />
                </div>
                <span className={`badge-enterprise ${m.badgeClass}`}>
                  {m.code}
                </span>
              </div>
              <div className="module-item-title">{m.title}</div>
              <p className="module-item-desc">{m.desc}</p>
              <div className="module-item-action">
                <span>Open Module</span>
                <ArrowRight size={13} className="action-arrow" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
