import React from 'react';

export default function UnsupportedMetricsPanel({ unsupportedMetrics }) {
  if (!unsupportedMetrics || unsupportedMetrics.length === 0) return null;

  return (
    <div className="card" style={{ borderStyle: 'dashed' }}>
      <div className="card-header">
        <div className="card-title">
          <span>ℹ️ Platform Scope & Data Transparency</span>
          <span className="badge badge-muted">Design Constraints</span>
        </div>
      </div>

      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
        <p style={{ marginBottom: '8px' }}>
          To preserve tenant boundaries, personal privacy, and database schema integrity:
        </p>
        <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {unsupportedMetrics.map((item, idx) => (
            <li key={idx}>
              <strong>{item.split(':')[0]}:</strong> {item.split(':')[1] || ''}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
