import React from 'react';
import Modal from './Modal';
import { AlertTriangle } from 'lucide-react';

/**
 * Enterprise Confirmation Dialog for destructive or sensitive administrative operations.
 */
export default function ConfirmationDialog({
  isOpen,
  onConfirm,
  onCancel,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed with this operation? This action may be irreversible.',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'danger',
  loading = false,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={loading ? () => {} : onCancel}
      title={title}
      maxWidth="460px"
      footer={
        <>
          <button
            type="button"
            className="btn-enterprise btn-outline-soft btn-sm"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`btn-enterprise btn-sm ${confirmVariant === 'danger' ? 'btn-danger-soft' : 'btn-primary-blue'}`}
            style={confirmVariant === 'danger' ? { backgroundColor: '#dc2626', color: '#ffffff', borderColor: '#dc2626' } : {}}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Processing...' : confirmText}
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            backgroundColor: confirmVariant === 'danger' ? '#fee2e2' : '#eff6ff',
            color: confirmVariant === 'danger' ? '#dc2626' : '#2563eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <AlertTriangle size={20} />
        </div>
        <div>
          <p
            style={{
              fontSize: '0.86rem',
              color: 'var(--text-secondary, #475569)',
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            {message}
          </p>
        </div>
      </div>
    </Modal>
  );
}

