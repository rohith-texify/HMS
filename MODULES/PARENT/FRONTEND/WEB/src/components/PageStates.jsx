import React from 'react';

function StatePanel({ variant, title, message, action }) {
  return (
    <section className={`state-panel state-${variant}`} role={variant === 'error' || variant === 'unauthorized' ? 'alert' : 'status'}>
      <div className="state-mark" aria-hidden="true">
        {variant === 'loading' ? <span className="loading-spinner" /> : null}
      </div>
      <div className="state-copy">
        <h2>{title}</h2>
        {message && <p>{message}</p>}
        {action && <div className="state-action">{action}</div>}
      </div>
    </section>
  );
}

export function LoadingState({ title = 'Loading', message }) {
  return <StatePanel variant="loading" title={title} message={message} />;
}

export function EmptyState({ title = 'Nothing here yet', message }) {
  return <StatePanel variant="empty" title={title} message={message} />;
}

export function ErrorState({ title = 'Something went wrong', message, action }) {
  return <StatePanel variant="error" title={title} message={message} action={action} />;
}

export function SuccessState({ title = 'Success', message }) {
  return <StatePanel variant="success" title={title} message={message} />;
}

export function UnauthorizedState({ title = 'Access unavailable', message, action }) {
  return <StatePanel variant="unauthorized" title={title} message={message} action={action} />;
}

export function NotFoundState({ title = 'Page not found', message, action }) {
  return <StatePanel variant="not-found" title={title} message={message} action={action} />;
}
