import React from 'react';
import { Link } from 'react-router-dom';
import { Boxes, ArrowRight } from 'lucide-react';

export default function EntitlementSummary({ summary }) {
  if (!summary) return null;

  const isTenantScoped = summary.scope === 'COLLEGE_TENANT';

  return (
    <div className="card enterprise-card">
      <div className="card-header">
        <div className="card-title">
          <Boxes size={18} className="text-blue-600" />
          <span>Entitlements & Catalog Summary</span>
          <span className="badge-enterprise badge-blue">
            {isTenantScoped ? 'Tenant Scope' : 'Global Catalog'}
          </span>
        </div>
        <Link to="/modules" className="card-header-link">
          <span>Manage Modules</span>
          <ArrowRight size={13} />
        </Link>
      </div>

      <div className="metric-stat-group">
        <div className="metric-item">
          <div className="metric-value text-emerald-600">
            {summary.enabled_applications}
          </div>
          <div className="metric-label">Enabled Apps</div>
        </div>

        <div className="metric-item">
          <div className="metric-value text-slate-500">
            {summary.disabled_applications}
          </div>
          <div className="metric-label">Disabled Apps</div>
        </div>

        <div className="metric-item">
          <div className="metric-value text-emerald-600">
            {summary.enabled_modules}
          </div>
          <div className="metric-label">Enabled Modules</div>
        </div>

        <div className="metric-item">
          <div className="metric-value text-slate-500">
            {summary.disabled_modules}
          </div>
          <div className="metric-label">Disabled Modules</div>
        </div>

        <div className="metric-item">
          <div className="metric-value text-blue-600">
            {summary.total_features}
          </div>
          <div className="metric-label">Total Features</div>
        </div>
      </div>
    </div>
  );
}
