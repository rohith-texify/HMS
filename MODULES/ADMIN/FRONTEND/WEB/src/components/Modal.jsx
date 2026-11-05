import React, { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Accessible Enterprise Modal Dialog.
 * Supports ESC key to dismiss, backdrop click dismissal, title, and action footer.
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = '540px',
  className = '',
}) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    // Lock background scroll
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="enterprise-modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.52)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: '16px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-modal="true"
      role="dialog"
    >
      <div
        className={`enterprise-modal-card ${className}`}
        style={{
          width: '100%',
          maxWidth,
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 20px 45px -10px rgba(15, 23, 42, 0.18), 0 10px 20px -5px rgba(0, 0, 0, 0.04)',
          border: '1px solid var(--border-color, #e2e8f0)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
        }}
      >
        {/* Modal Header */}
        <div
          className="modal-header"
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            backgroundColor: '#ffffff',
          }}
        >
          <div>
            <h2
              className="modal-title"
              style={{
                fontSize: '1.15rem',
                fontWeight: 700,
                color: 'var(--text-primary, #0f172a)',
                margin: 0,
                letterSpacing: '-0.01em',
              }}
            >
              {title}
            </h2>
            {subtitle && (
              <p
                style={{
                  fontSize: '0.82rem',
                  color: 'var(--text-secondary, #475569)',
                  margin: '4px 0 0 0',
                }}
              >
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            className="btn-icon-action"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={17} />
          </button>
        </div>

        {/* Modal Body */}
        <div
          className="modal-body"
          style={{
            padding: '22px 24px',
            overflowY: 'auto',
            flex: 1,
            backgroundColor: '#ffffff',
          }}
        >
          {children}
        </div>

        {/* Modal Footer */}
        {footer && (
          <div
            className="modal-footer"
            style={{
              padding: '16px 24px',
              borderTop: '1px solid #f1f5f9',
              backgroundColor: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px',
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

