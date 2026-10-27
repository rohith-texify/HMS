import React from 'react';
import { Link } from 'react-router-dom';

export default function PendingApprovalsSummary({ summary }) {
  if (!summary) return null;

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <span>📋 Pending Approvals & Configuration Requests</span>
        </div>
        <Link to="/approvals" className="btn btn-outline btn-sm">
          Review Approval Queue →
        </Link>
      </div>

      <div className="metric-stat-group" style={{ marginBottom: '16px' }}>
        <div className="metric-item">
          <div className="metric-value" style={{ color: 'var(--warning-text)' }}>
            {summary.pending_count}
          </div>
          <div className="metric-label">Total Pending Approvals</div>
        </div>

        <div className="metric-item">
          <div className="metric-value" style={{ color: 'var(--primary-color)' }}>
            {summary.pending_configuration_count}
          </div>
          <div className="metric-label">Pending Config Changes</div>
        </div>
      </div>

      {summary.configuration_source_note && (
        <div className="notice-box" style={{ marginBottom: '16px' }}>
          ℹ️ {summary.configuration_source_note}
        </div>
      )}

      {summary.recent_pending && summary.recent_pending.length > 0 ? (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Operation Type</th>
                <th>College</th>
                <th>Requested By</th>
                <th>Created At</th>
                <th>Expiry</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {summary.recent_pending.map((item) => (
                <tr key={item.request_id}>
                  <td>
                    <strong>{item.operation_type}</strong>
                  </td>
                  <td>{item.college_name || 'Global'}</td>
                  <td>{item.requested_by}</td>
                  <td>{new Date(item.created_at).toLocaleDateString()}</td>
                  <td>
                    {item.expires_at ? (
                      <span className={item.is_overdue ? 'badge badge-danger' : 'badge badge-muted'}>
                        {new Date(item.expires_at).toLocaleDateString()}
                        {item.is_overdue && ' (Overdue)'}
                      </span>
                    ) : (
                      'None'
                    )}
                  </td>
                  <td>
                    <Link to="/approvals" className="btn btn-outline btn-sm">
                      Review
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-box" style={{ padding: '16px' }}>
          <div className="empty-text">No pending approval requests currently require action.</div>
        </div>
      )}
    </div>
  );
}
