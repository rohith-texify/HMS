import React from 'react';
import PageHeader from '../components/PageHeader';
import { AlertOctagon, AlertCircle, Database, Server } from 'lucide-react';

export default function SOSPage() {
  return (
    <div>
      <PageHeader
        title="Emergency & Incident Records"
        description="Emergency contact roster and active incident notifications."
        icon={AlertOctagon}
      />

      <div className="dependency-gap-banner">
        <div className="dependency-gap-title">
          <AlertCircle size={20} />
          <span>Real-Time Alert Stream Endpoint Pending</span>
        </div>
        <p className="dependency-gap-desc">
          While the database table (<code>app.sos_alerts</code>) is configured in{' '}
          <code>DATABASE/migrations/006_support.sql</code>, the corresponding real-time broadcast and list routes are
          not yet exposed under <code>/college/sos</code> in <code>API/internal/server/router.go</code>. Resident
          emergency contacts remain accessible through individual resident profiles.
        </p>
        <div style={{ marginTop: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div
            style={{
              padding: '8px 14px',
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              borderRadius: '6px',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: '#78350f',
            }}
          >
            <Database size={14} />
            <span>Schema: app.sos_alerts (Ready)</span>
          </div>
          <div
            style={{
              padding: '8px 14px',
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              borderRadius: '6px',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: '#78350f',
            }}
          >
            <Server size={14} />
            <span>Go Router: /college/sos (Pending)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

