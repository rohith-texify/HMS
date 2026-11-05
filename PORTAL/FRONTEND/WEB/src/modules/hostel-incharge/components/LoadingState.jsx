import React from 'react';
import LoadingSpinner from './LoadingSpinner';

/**
 * Enterprise Loading State wrapper for cards, tables, and page containers.
 */
export default function LoadingState({
  message = 'Loading data...',
  size = 'md',
  minHeight = '240px',
  className = '',
  style = {},
}) {
  return (
    <div
      className={`loading-state-container ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight,
        width: '100%',
        backgroundColor: 'transparent',
        ...style,
      }}
    >
      <LoadingSpinner message={message} size={size} />
    </div>
  );
}

