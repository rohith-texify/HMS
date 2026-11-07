import React from 'react';
import { Inbox } from 'lucide-react';

export default function EmptyState({
  title = 'No records found',
  description = 'There are no active records in this section.',
  action,
  icon: Icon = Inbox,
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '50px 20px',
        textAlign: 'center',
        backgroundColor: '#fafbfc',
        borderRadius: '12px',
        border: '1px dashed #cbd5e1',
      }}
    >
      <div
        style={{
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          backgroundColor: '#f1f5f9',
          color: '#94a3b8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '14px',
        }}
      >
        <Icon size={26} />
      </div>
      <h4 style={{ margin: '0 0 6px 0', fontSize: '1rem', fontWeight: 700, color: '#334155' }}>
        {title}
      </h4>
      <p style={{ margin: '0 0 16px 0', fontSize: '0.84rem', color: '#64748b', maxWidth: '360px' }}>
        {description}
      </p>
      {action && <div>{action}</div>}
    </div>
  );
}

