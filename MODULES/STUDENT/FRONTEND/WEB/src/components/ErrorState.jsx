import React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';
import Button from './Button';

export default function ErrorState({
  title = 'Failed to load records',
  message = 'An unexpected error occurred while communicating with the campus API.',
  onRetry,
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px',
        textAlign: 'center',
        backgroundColor: '#fef2f2',
        borderRadius: '12px',
        border: '1px solid #fecaca',
        color: '#991b1b',
      }}
    >
      <AlertCircle size={32} style={{ marginBottom: '12px', color: '#dc2626' }} />
      <h4 style={{ margin: '0 0 6px 0', fontSize: '1rem', fontWeight: 700 }}>
        {title}
      </h4>
      <p style={{ margin: '0 0 16px 0', fontSize: '0.84rem', color: '#b91c1c', maxWidth: '400px' }}>
        {message}
      </p>
      {onRetry && (
        <Button variant="secondary" size="sm" icon={RotateCcw} onClick={onRetry}>
          Try Again
        </Button>
      )}
    </div>
  );
}

