import React from 'react';
import { Link } from 'react-router-dom';

export default function Header({ onRefresh, isRefreshing, generatedAt }) {
  return (
    <div className="header-container">
      <div>
        <h1 className="page-title">Super Admin Dashboard</h1>
        <p className="page-subtitle">
          Platform-wide health, college lifecycle status, entitlements, and administrative activity.
          {generatedAt && (
            <span style={{ marginLeft: '10px', color: 'var(--text-muted)' }}>
              Updated: {new Date(generatedAt).toLocaleTimeString()}
            </span>
          )}
        </p>
      </div>

      <div className="quick-actions">
        <button
          className="btn btn-outline"
          onClick={onRefresh}
          disabled={isRefreshing}
          title="Refresh dashboard data"
        >
          {isRefreshing ? 'Refreshing...' : '↻ Refresh'}
        </button>
        <Link to="/colleges/new" className="btn btn-primary" id="btn-create-college">
          + Create College
        </Link>
        <Link to="/approvals" className="btn btn-outline" id="btn-review-approvals">
          Review Approvals
        </Link>
      </div>
    </div>
  );
}
