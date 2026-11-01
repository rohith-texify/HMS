import React from 'react';
import { Link } from 'react-router-dom';
import { Activity, ArrowRight, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

export default function ServiceHealthPanel({ health }) {
  if (!health) return null;

  const getStatusBadge = (status) => {
    switch (status) {
      case 'HEALTHY':
        return (
          <span className="badge-enterprise badge-green">
            <span className="status-dot green" />
            <span>HEALTHY</span>
          </span>
        );
      case 'DEGRADED':
        return (
          <span className="badge-enterprise badge-amber">
            <span className="status-dot amber" />
            <span>DEGRADED</span>
          </span>
        );
      case 'UNAVAILABLE':
        return (
          <span className="badge-enterprise badge-rose">
            <span className="status-dot rose" />
            <span>UNAVAILABLE</span>
          </span>
        );
      default:
        return (
          <span className="badge-enterprise badge-muted">
            <span>{status || 'UNKNOWN'}</span>
          </span>
        );
    }
  };

  return (
    <div className="card enterprise-card">
      <div className="card-header">
        <div className="card-title">
          <Activity size={18} className="text-emerald-600" />
          <span>Service Health</span>
        </div>
        <div>{getStatusBadge(health.overall_status)}</div>
      </div>

      <div className="service-checks-stack">
        {health.checks?.map((check) => (
          <div key={check.service_name} className="service-check-row">
            <div className="service-check-info">
              <span className="service-name-text">
                {check.service_name.replace(/_/g, ' ').toUpperCase()}
              </span>
              <span className="service-desc-text">
                {check.message}
              </span>
            </div>
            <div>{getStatusBadge(check.status)}</div>
          </div>
        ))}
      </div>

      <div className="card-footer-action">
        <Link to="/monitoring" className="card-footer-link">
          <span>Open Telemetry & Monitoring</span>
          <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  );
}
