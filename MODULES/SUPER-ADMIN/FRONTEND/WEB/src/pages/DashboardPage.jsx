import React, { useState, useEffect, useRef } from 'react';
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
import { fetchDashboard, fetchColleges, loginSuperAdmin } from '../services/dashboardService';

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [colleges, setColleges] = useState([]);
  const [filters, setFilters] = useState({});
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Use request counter to avoid race conditions with fast filter changes
  const requestCounter = useRef(0);

  const handleConnectSession = async () => {
    try {
      setLoading(true);
      await loginSuperAdmin();
      const collegesList = await fetchColleges();
      setColleges(collegesList);
      await loadDashboardData(filters, false);
    } catch (err) {
      setError('Session connection failed: ' + (err.message || 'Unknown error'));
      setLoading(false);
    }
  };

  // Load colleges list once on mount
  useEffect(() => {
    let isMounted = true;
    fetchColleges().then((collegesList) => {
      if (isMounted) setColleges(collegesList);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const loadDashboardData = async (currentFilters, isManualRefresh = false) => {
    const currentRequestId = ++requestCounter.current;
    if (isManualRefresh) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const responseData = await fetchDashboard(currentFilters);
      // Only commit if this was the latest request
      if (currentRequestId === requestCounter.current) {
        setData(responseData);
        setLoading(false);
        setIsRefreshing(false);
      }
    } catch (err) {
      if (currentRequestId === requestCounter.current) {
        setError(err.message || 'Failed to connect to Super Admin Dashboard service.');
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
        <div className="error-box">
          <div style={{ fontWeight: '600', marginBottom: '8px' }}>
            ⚠️ Error Loading Dashboard
          </div>
          <div>{error}</div>
          <div style={{ marginTop: '16px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button className="btn btn-outline" onClick={() => loadDashboardData(filters, true)}>
              Retry Connection
            </button>
            <button className="btn btn-primary" id="btn-connect-session" onClick={handleConnectSession}>
              Connect Authorized Super Admin Session
            </button>
          </div>
        </div>
      )}

      {data && !loading && (
        <>
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
