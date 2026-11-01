import React from 'react';
import { Link } from 'react-router-dom';
import { ScrollText, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';

export default function RecentActivityTable({ activities = [] }) {
  const displayActivities = activities && activities.length > 0 ? activities.slice(0, 8) : [];
  const hasActivities = displayActivities.length > 0;

  return (
    <div className="card enterprise-card">
      <div className="card-header">
        <div className="card-title">
          <ScrollText size={18} className="text-blue-600" />
          <span>Recent Administrative Activity</span>
          <span className="badge-enterprise badge-muted">Audit Trail</span>
        </div>
        <Link to="/audit-logs" className="card-header-link">
          <span>View All Audit Logs</span>
          <ArrowRight size={13} />
        </Link>
      </div>

      {!hasActivities ? (
        <div className="empty-state-clean">
          <ShieldCheck size={24} className="text-slate-400" />
          <div className="empty-state-title">No administrative events recorded</div>
          <div className="empty-state-subtitle">No audit trail records match the selected filter criteria.</div>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '180px' }}>Timestamp</th>
                <th>Action</th>
                <th style={{ width: '140px' }}>Module</th>
                <th>Actor</th>
                <th>College Tenant</th>
                <th style={{ width: '100px' }}>Outcome</th>
              </tr>
            </thead>
            <tbody>
              {displayActivities.map((item) => (
                <tr key={item.audit_id}>
                  <td className="text-slate-500 whitespace-nowrap text-xs">
                    {new Date(item.created_at).toLocaleString()}
                  </td>
                  <td>
                    <div className="font-semibold text-slate-800">{item.action}</div>
                    {item.reason && (
                      <div className="text-xs text-slate-500 mt-0.5">
                        {item.reason}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className="badge-enterprise badge-blue">{item.module}</span>
                  </td>
                  <td>
                    <div className="text-slate-800 font-medium">{item.actor_safe_id}</div>
                    <div className="text-xs text-slate-400">
                      {item.actor_role}
                    </div>
                  </td>
                  <td>
                    <span className="text-slate-700">
                      {item.college_name || (item.college_id ? item.college_id.slice(0, 8) : 'Global Platform')}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`badge-enterprise ${
                        item.outcome === 'SUCCESS' ? 'badge-green' : 'badge-rose'
                      }`}
                    >
                      {item.outcome}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
