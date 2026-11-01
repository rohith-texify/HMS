import React from 'react';
import { Link } from 'react-router-dom';
import { FileCheck, ArrowRight, Clock, CheckCircle2 } from 'lucide-react';

export default function PendingApprovalsSummary({ summary }) {
  if (!summary) return null;

  const hasPendingItems = summary.recent_pending && summary.recent_pending.length > 0;

  return (
    <div className="card enterprise-card">
      <div className="card-header">
        <div className="card-title">
          <FileCheck size={18} className="text-amber-600" />
          <span>Pending Approvals & Configuration Requests</span>
        </div>
        <Link to="/approvals" className="card-header-link">
          <span>Review Approval Queue</span>
          <ArrowRight size={13} />
        </Link>
      </div>

      <div className="metric-stat-group" style={{ marginBottom: '18px' }}>
        <div className="metric-item">
          <div className="metric-value text-amber-600">
            {summary.pending_count}
          </div>
          <div className="metric-label">Pending Approval Requests</div>
        </div>

        <div className="metric-item">
          <div className="metric-value text-blue-600">
            {summary.pending_configuration_count}
          </div>
          <div className="metric-label">Pending Configuration Changes</div>
        </div>
      </div>

      {hasPendingItems ? (
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
                    <strong className="text-slate-800">{item.operation_type}</strong>
                  </td>
                  <td>{item.college_name || 'Global Platform'}</td>
                  <td>{item.requested_by}</td>
                  <td>{new Date(item.created_at).toLocaleDateString()}</td>
                  <td>
                    {item.expires_at ? (
                      <span className={item.is_overdue ? 'badge-enterprise badge-rose' : 'badge-enterprise badge-muted'}>
                        {new Date(item.expires_at).toLocaleDateString()}
                        {item.is_overdue && ' (Overdue)'}
                      </span>
                    ) : (
                      <span className="text-slate-400">None</span>
                    )}
                  </td>
                  <td>
                    <Link to="/approvals" className="btn-enterprise btn-outline-soft btn-sm">
                      Review
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state-clean">
          <CheckCircle2 size={24} className="text-emerald-500" />
          <div className="empty-state-title">No pending approval requests</div>
          <div className="empty-state-subtitle">All tenant configurations and platform changes are up to date.</div>
        </div>
      )}
    </div>
  );
}
