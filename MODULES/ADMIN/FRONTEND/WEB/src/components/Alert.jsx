import React from 'react';
import { AlertCircle, CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

export default function Alert({ children, type = 'info', onClose, className = '', style = {} }) {
  const getAlertConfig = () => {
    switch (type) {
      case 'danger':
      case 'error':
        return {
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderLeft: '4px solid #ef4444',
          color: '#991b1b',
          icon: <AlertCircle size={16} className="text-rose-600" style={{ flexShrink: 0, marginTop: '2px' }} />,
        };
      case 'warning':
        return {
          background: '#fffbeb',
          border: '1px solid #fde68a',
          borderLeft: '4px solid #f59e0b',
          color: '#92400e',
          icon: <AlertTriangle size={16} className="text-amber-600" style={{ flexShrink: 0, marginTop: '2px' }} />,
        };
      case 'success':
        return {
          background: '#ecfdf5',
          border: '1px solid #a7f3d0',
          borderLeft: '4px solid #10b981',
          color: '#065f46',
          icon: <CheckCircle2 size={16} className="text-emerald-600" style={{ flexShrink: 0, marginTop: '2px' }} />,
        };
      case 'info':
      default:
        return {
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderLeft: '4px solid #2563eb',
          color: '#1e40af',
          icon: <Info size={16} className="text-blue-600" style={{ flexShrink: 0, marginTop: '2px' }} />,
        };
    }
  };

  const config = getAlertConfig();

  return (
    <div
      className={`enterprise-alert ${className}`}
      style={{
        padding: '12px 16px',
        borderRadius: '8px',
        fontSize: '0.85rem',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '10px',
        background: config.background,
        border: config.border,
        borderLeft: config.borderLeft,
        color: config.color,
        lineHeight: 1.45,
        ...style,
      }}
      role="alert"
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: 1 }}>
        {config.icon}
        <div>{children}</div>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'currentColor',
            opacity: 0.7,
            cursor: 'pointer',
            padding: '2px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-label="Dismiss alert"
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
}

