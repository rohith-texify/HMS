import React from 'react';
import { Link } from 'react-router-dom';

export default function EntitlementSummary({ summary }) {
  if (!summary) return null;

  const isTenantScoped = summary.scope === 'COLLEGE_TENANT';

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <span>📦 Entitlements & Catalog Summary</span>
          <span className="badge badge-info">
            {isTenantScoped ? 'Tenant Assignments' : 'Global Catalog'}
          </span>
          <span className="badge badge-muted">Current Snapshot</span>
        </div>
        <Link to="/modules" className="btn btn-outline btn-sm">
          Manage Modules →
        </Link>
      </div>

      <div className="metric-stat-group">
        <div className="metric-item">
          <div className="metric-value" style={{ color: 'var(--success-text)' }}>
            {summary.enabled_applications}
          </div>
          <div className="metric-label">Enabled Apps</div>
        </div>

        <div className="metric-item">
          <div className="metric-value" style={{ color: 'var(--danger-text)' }}>
            {summary.disabled_applications}
          </div>
          <div className="metric-label">Disabled Apps</div>
        </div>

        <div className="metric-item">
          <div className="metric-value" style={{ color: 'var(--success-text)' }}>
            {summary.enabled_modules}
          </div>
          <div className="metric-label">Enabled Modules</div>
        </div>

        <div className="metric-item">
          <div className="metric-value" style={{ color: 'var(--danger-text)' }}>
            {summary.disabled_modules}
          </div>
          <div className="metric-label">Disabled Modules</div>
        </div>

        <div className="metric-item">
          <div className="metric-value" style={{ color: 'var(--primary-color)' }}>
            {summary.total_features}
          </div>
          <div className="metric-label">Total Features</div>
        </div>
      </div>
    </div>
  );
}
