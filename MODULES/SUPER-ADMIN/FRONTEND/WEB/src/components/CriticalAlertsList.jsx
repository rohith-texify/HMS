import React from 'react';
import { Link } from 'react-router-dom';

export default function CriticalAlertsList({ alerts }) {
  const hasAlerts = alerts && alerts.length > 0;

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <span>🔔 Critical Alerts</span>
          {hasAlerts && (
            <span className="badge badge-danger">{alerts.length} Active</span>
          )}
        </div>
      </div>

      {!hasAlerts ? (
        <div className="empty-box" style={{ padding: '24px' }}>
          <div className="empty-text">✓ No active critical alerts. All platform checks nominal.</div>
        </div>
      ) : (
        <div className="alert-list">
          {alerts.map((alert) => (
            <div
              key={alert.alert_id}
              className={`alert-item ${alert.severity.toLowerCase()}`}
            >
              <div className="alert-header">
                <span>{alert.title}</span>
                <span className="badge badge-muted" style={{ fontSize: '0.7rem' }}>
                  {alert.timestamp ? new Date(alert.timestamp).toLocaleTimeString() : ''}
                </span>
              </div>
              <div className="alert-desc">{alert.description}</div>
              {alert.resource_id && (
                <div style={{ fontSize: '0.7rem', opacity: 0.8, marginTop: '2px' }}>
                  Target: {alert.resource_id}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end' }}>
        <Link to="/notifications" style={{ fontSize: '0.82rem', color: '#38bdf8', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
          Open Notification Hub <span>→</span>
        </Link>
      </div>
    </div>
  );
}
