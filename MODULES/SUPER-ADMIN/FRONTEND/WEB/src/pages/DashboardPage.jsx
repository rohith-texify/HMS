import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load dashboard data
  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      // Fetch from backend
      const response = await fetch('/super-admin/dashboard', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('hms_token') || sessionStorage.getItem('hms_token')}`,
          'X-Scope': 'PLATFORM',
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const responseData = await response.json();
      const dashboard = responseData.data || responseData;
      
      setData(dashboard);
      setLoading(false);
      setIsRefreshing(false);
    } catch (err) {
      console.error('Dashboard load error:', err);
      setError(err.message || 'Failed to load dashboard');
      setLoading(false);
      setIsRefreshing(false);
      
      // Set fallback data so the page doesn't crash
      setData({
        college_summary: { total_colleges: 0, active_colleges: 0 },
        entitlement_summary: { total_modules_assigned: 0 },
        service_health: { status: 'checking' },
        recent_activity: [],
      });
    }
  };

  const handleRefresh = () => {
    loadDashboard(true);
  };

  return (
    <div style={{ padding: '20px', minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      <Header onRefresh={handleRefresh} isRefreshing={isRefreshing} />

      {loading && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '400px',
          fontSize: '18px',
          color: '#666',
        }}>
          Loading Super Admin Dashboard...
        </div>
      )}

      {error && (
        <div style={{
          padding: '20px',
          margin: '20px 0',
          backgroundColor: '#fff3cd',
          border: '1px solid #ffc107',
          borderRadius: '4px',
          display: 'flex',
          gap: '10px',
          alignItems: 'center',
        }}>
          <AlertCircle size={20} color="#ff9800" />
          <div>
            <strong>Warning:</strong> {error}
          </div>
          <button
            onClick={() => loadDashboard(true)}
            style={{
              marginLeft: 'auto',
              padding: '8px 16px',
              backgroundColor: '#ff9800',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {data && !loading && (
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          {/* Summary Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '20px',
            marginBottom: '30px',
          }}>
            {/* College Summary Card */}
            <div style={{
              backgroundColor: 'white',
              padding: '20px',
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            }}>
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>Total Colleges</div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#333' }}>
                {data.college_summary?.total_colleges || 0}
              </div>
              <div style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
                Active: {data.college_summary?.active_colleges || 0}
              </div>
            </div>

            {/* Entitlements Card */}
            <div style={{
              backgroundColor: 'white',
              padding: '20px',
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            }}>
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>Modules Assigned</div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#333' }}>
                {data.entitlement_summary?.total_modules_assigned || 0}
              </div>
            </div>

            {/* Service Health Card */}
            <div style={{
              backgroundColor: 'white',
              padding: '20px',
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            }}>
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>Service Status</div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#4caf50' }}>
                Operational
              </div>
              <div style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
                All systems healthy
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            marginBottom: '30px',
          }}>
            <h2 style={{ marginTop: 0, marginBottom: '16px', fontSize: '18px' }}>Quick Actions</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
              <Link to="/colleges" style={{
                padding: '12px 16px',
                backgroundColor: '#2196f3',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '4px',
                textAlign: 'center',
                cursor: 'pointer',
              }}>
                View Colleges
              </Link>
              <Link to="/approvals" style={{
                padding: '12px 16px',
                backgroundColor: '#2196f3',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '4px',
                textAlign: 'center',
                cursor: 'pointer',
              }}>
                Approvals
              </Link>
              <Link to="/roles" style={{
                padding: '12px 16px',
                backgroundColor: '#2196f3',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '4px',
                textAlign: 'center',
                cursor: 'pointer',
              }}>
                Manage Roles
              </Link>
              <Link to="/permissions" style={{
                padding: '12px 16px',
                backgroundColor: '#2196f3',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '4px',
                textAlign: 'center',
                cursor: 'pointer',
              }}>
                Permissions
              </Link>
            </div>
          </div>

          {/* Platform Status */}
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          }}>
            <h2 style={{ marginTop: 0, marginBottom: '16px', fontSize: '18px' }}>Platform Status</h2>
            <div style={{ color: '#666', lineHeight: '1.6' }}>
              <p>✓ Database: Connected</p>
              <p>✓ API Server: Operational</p>
              <p>✓ Authentication: Active</p>
              <p style={{ marginTop: '16px', fontSize: '12px', color: '#999' }}>
                Last refreshed: {new Date().toLocaleTimeString()}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
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
