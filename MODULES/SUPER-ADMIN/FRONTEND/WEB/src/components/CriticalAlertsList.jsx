import React from 'react';
import { Link } from 'react-router-dom';
import { Bell, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function CriticalAlertsList({ alerts }) {
  const hasAlerts = alerts && alerts.length > 0;

  return (
    <div className="card enterprise-card">
      <div className="card-header">
        <div className="card-title">
          <Bell size={18} className="text-rose-600" />
          <span>Critical Alerts</span>
        </div>
        {hasAlerts ? (
          <span className="badge-enterprise badge-rose">{alerts.length} Active</span>
        ) : (
          <span className="badge-enterprise badge-green">Nominal</span>
        )}
      </div>

      {!hasAlerts ? (
        <div className="empty-state-clean" style={{ padding: '24px 16px' }}>
          <CheckCircle2 size={24} className="text-emerald-500" />
          <div className="empty-state-title">No critical alerts detected</div>
          <div className="empty-state-subtitle">All node connections and database pools are operating normally.</div>
        </div>
      ) : (
        <div className="alert-list">
          {alerts.map((alert) => (
            <div
              key={alert.alert_id}
              className={`alert-item ${alert.severity ? alert.severity.toLowerCase() : 'critical'}`}
            >
              <div className="alert-header">
                <span className="font-semibold text-slate-900">{alert.title}</span>
                <span className="text-xs text-slate-400">
                  {alert.timestamp ? new Date(alert.timestamp).toLocaleTimeString() : ''}
                </span>
              </div>
              <div className="alert-desc text-xs text-slate-600">{alert.description}</div>
              {alert.resource_id && (
                <div className="text-xs text-slate-400 mt-1">
                  Target: {alert.resource_id}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="card-footer-action">
        <Link to="/notifications" className="card-footer-link">
          <span>Open Notifications Hub</span>
          <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  );
}
