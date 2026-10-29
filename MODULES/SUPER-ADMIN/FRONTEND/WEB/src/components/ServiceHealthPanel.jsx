import React from 'react';
import { Link } from 'react-router-dom';

export default function ServiceHealthPanel({ health }) {
  if (!health) return null;

  const getStatusBadge = (status) => {
    switch (status) {
      case 'HEALTHY':
        return <span className="badge badge-success">HEALTHY</span>;
      case 'DEGRADED':
        return <span className="badge badge-warning">DEGRADED</span>;
      case 'UNAVAILABLE':
        return <span className="badge badge-danger">UNAVAILABLE</span>;
      default:
        return <span className="badge badge-muted">UNKNOWN</span>;
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <span>⚡ Service Health</span>
        </div>
        <div>{getStatusBadge(health.overall_status)}</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {health.checks?.map((check) => (
          <div
            key={check.service_name}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 12px',
              backgroundColor: 'var(--bg-primary)',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
            }}
          >
            <div>
              <div style={{ fontWeight: '600', fontSize: '0.85rem' }}>
                {check.service_name.replace(/_/g, ' ').toUpperCase()}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {check.message}
              </div>
            </div>
            <div>{getStatusBadge(check.status)}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end' }}>
        <Link to="/monitoring" style={{ fontSize: '0.82rem', color: '#38bdf8', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
          Open Telemetry & Monitoring <span>→</span>
        </Link>
      </div>
    </div>
  );
}
