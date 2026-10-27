import React from 'react';

export default function CollegeAdminSummary({ summary }) {
  if (!summary) return null;

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <span>👥 Active College Administrators</span>
          <span className="badge badge-muted">Current Snapshot</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '10px 0' }}>
        <div className="metric-value" style={{ fontSize: '2.5rem', color: 'var(--primary-color)' }}>
          {summary.active_count}
        </div>
        <div>
          <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>
            Active College Admin Accounts
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '2px' }}>
            Verified accounts with active COLLEGE_ADMIN role assignment and unexpired validity.
          </div>
        </div>
      </div>
    </div>
  );
}
