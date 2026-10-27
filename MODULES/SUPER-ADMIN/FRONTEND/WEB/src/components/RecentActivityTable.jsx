import React from 'react';

export default function RecentActivityTable({ activities }) {
  const hasActivities = activities && activities.length > 0;

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <span>🕒 Recent Administrative Activity</span>
          <span className="badge badge-muted">Audit Trail</span>
        </div>
      </div>

      {!hasActivities ? (
        <div className="empty-box">
          <div className="empty-text">No administrative events recorded for the selected filter range.</div>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Module</th>
                <th>Actor</th>
                <th>College</th>
                <th>Outcome</th>
              </tr>
            </thead>
            <tbody>
              {activities.map((item) => (
                <tr key={item.audit_id}>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {new Date(item.created_at).toLocaleString()}
                  </td>
                  <td>
                    <strong>{item.action}</strong>
                    {item.reason && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {item.reason}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className="badge badge-info">{item.module}</span>
                  </td>
                  <td>
                    <div>{item.actor_safe_id}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                      {item.actor_role}
                    </div>
                  </td>
                  <td>{item.college_name || (item.college_id ? item.college_id.slice(0, 8) : 'Global')}</td>
                  <td>
                    <span className="badge badge-success">{item.outcome}</span>
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
