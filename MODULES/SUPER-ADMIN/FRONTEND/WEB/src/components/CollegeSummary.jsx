import React from 'react';
import { Link } from 'react-router-dom';
export default function CollegeSummary({ summary }) {
  if (!summary) return null;

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <span>🏫 College Lifecycle Summary</span>
          <span className="badge badge-info" title="Current state snapshot, not affected by historical date filters">
            Current Snapshot
          </span>
        </div>
        <Link to="/colleges" className="btn btn-outline btn-sm">
          View All Colleges →
        </Link>
      </div>

      <div className="metric-stat-group">
        <div className="metric-item">
          <div className="metric-value">{summary.total_colleges}</div>
          <div className="metric-label">Total Colleges</div>
        </div>

        <div className="metric-item">
          <div className="metric-value" style={{ color: 'var(--success-text)' }}>
            {summary.active_colleges}
          </div>
          <div className="metric-label">Active</div>
        </div>

        <div className="metric-item">
          <div className="metric-value" style={{ color: 'var(--text-secondary)' }}>
            {summary.inactive_colleges}
          </div>
          <div className="metric-label" title="Mapped to schema status DEACTIVATED">
            Inactive (Deactivated)
          </div>
        </div>

        <div className="metric-item">
          <div className="metric-value" style={{ color: 'var(--danger-text)' }}>
            {summary.suspended_colleges}
          </div>
          <div className="metric-label">Suspended</div>
        </div>

        <div className="metric-item">
          <div className="metric-value" style={{ color: 'var(--warning-text)' }}>
            {summary.onboarding_colleges}
          </div>
          <div className="metric-label">Onboarding</div>
        </div>
      </div>
    </div>
  );
}
