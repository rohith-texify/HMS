import React from 'react';

const stateRoles = {
  loading: 'status',
  empty: 'status',
  error: 'alert',
  success: 'status',
  unauthorized: 'alert',
  notFound: 'status',
  blocked: 'alert',
  info: 'status',
};

export default function PortalState({
  variant = 'info',
  title,
  message,
  action,
}) {
  const state = stateRoles[variant] ? variant : 'info';
  const role = stateRoles[state];

  return (
    <section
      className={`portal-state portal-state-${state}`}
      role={role}
      aria-live={role === 'alert' ? 'assertive' : 'polite'}
    >
      <h2 className="portal-state-title">{title}</h2>
      {message && <p className="portal-state-message">{message}</p>}
      {action && <div className="portal-state-action">{action}</div>}
    </section>
  );
}
