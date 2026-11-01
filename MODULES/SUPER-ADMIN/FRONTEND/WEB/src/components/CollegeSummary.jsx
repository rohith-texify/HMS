import React from 'react';
import { Link } from 'react-router-dom';
import { Building2, ArrowRight } from 'lucide-react';

export default function CollegeSummary({ summary }) {
  if (!summary) return null;

  return (
    <div className="card enterprise-card">
      <div className="card-header">
        <div className="card-title">
          <Building2 size={18} className="text-blue-600" />
          <span>College Lifecycle Summary</span>
          <span className="badge-enterprise badge-blue" title="Current state snapshot">
            Current Snapshot
          </span>
        </div>
        <Link to="/colleges" className="card-header-link">
          <span>View All Colleges</span>
          <ArrowRight size={13} />
        </Link>
      </div>

      <div className="metric-stat-group">
        <div className="metric-item">
          <div className="metric-value">{summary.total_colleges}</div>
          <div className="metric-label">Total Colleges</div>
        </div>

        <div className="metric-item">
          <div className="metric-value text-emerald-600">
            {summary.active_colleges}
          </div>
          <div className="metric-label">Active</div>
        </div>

        <div className="metric-item">
          <div className="metric-value text-slate-500">
            {summary.inactive_colleges}
          </div>
          <div className="metric-label">Inactive</div>
        </div>

        <div className="metric-item">
          <div className="metric-value text-rose-600">
            {summary.suspended_colleges}
          </div>
          <div className="metric-label">Suspended</div>
        </div>

        <div className="metric-item">
          <div className="metric-value text-amber-600">
            {summary.onboarding_colleges}
          </div>
          <div className="metric-label">Onboarding</div>
        </div>
      </div>
    </div>
  );
}
