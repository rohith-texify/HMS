import React from 'react';
import PageHeader from '../components/PageHeader';
import { Footprints, AlertCircle, Database, Server } from 'lucide-react';

export default function GatePassesPage() {
  return (
    <div>
      <PageHeader
        title="Outings & Gate Passes"
        description="Monitor authorized student departures and campus gate verifications."
        icon={Footprints}
      />

      <div className="dependency-gap-banner">
        <div className="dependency-gap-title">
          <AlertCircle size={20} />
          <span>Backend Endpoint Integration Pending</span>
        </div>
        <p className="dependency-gap-desc">
          While the database schema (<code>app.gate_passes</code> and <code>app.gate_pass_verifications</code>) is
          defined in <code>DATABASE/migrations/004_movement.sql</code>, the corresponding HTTP routes are not yet
          registered under <code>/college/gate-passes</code> in <code>API/internal/server/router.go</code>.
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
            <span>Schema: app.gate_passes (Ready)</span>
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
            <span>Go Router: /college/gate-passes (Pending)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

