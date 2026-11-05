import React from 'react';
import NotFoundState from '../components/NotFoundState';

export default function NotFoundPage() {
  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <NotFoundState
        title="Page Not Located"
        message="The requested route does not match any registered Hostel In-Charge workspace page."
      />
    </div>
  );
}

