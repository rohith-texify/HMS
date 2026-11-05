import React from 'react';
import UnauthorizedState from '../components/UnauthorizedState';

export default function UnauthorizedPage() {
  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <UnauthorizedState
        title="Access Prohibited"
        message="You do not possess the required institutional credentials or verified role authorization to access this area."
      />
    </div>
  );
}

