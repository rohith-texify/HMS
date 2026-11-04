import React from 'react';
import PageHeader from '../components/PageHeader';
import { Package, AlertCircle, Database, Server } from 'lucide-react';

export default function ParcelsPage() {
  return (
    <div>
      <PageHeader
        title="Student Parcel Log"
        description="Delivery tracking, courier reception, and resident pickup verification."
        icon={Package}
      />

      <div className="dependency-gap-banner">
        <div className="dependency-gap-title">
          <AlertCircle size={20} />
          <span>Backend Endpoint Integration Pending</span>
        </div>
        <p className="dependency-gap-desc">
          The database schema (<code>app.parcels</code>) is defined in <code>DATABASE/migrations/005_requests.sql</code>,
          but the corresponding HTTP endpoints are not yet registered under <code>/college/parcels</code> in{' '}
          <code>API/internal/server/router.go</code>.
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
            <span>Schema: app.parcels (Ready)</span>
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
            <span>Go Router: /college/parcels (Pending)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

