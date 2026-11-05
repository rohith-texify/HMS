import React from 'react';
import { HelpCircle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function NotFoundState({
  title = 'Page Not Found',
  message = 'The resource or route you requested does not exist or has been relocated within the Hostel Incharge portal.',
  onBack,
}) {
  const navigate = useNavigate();

  return (
    <div className="card" style={{ maxWidth: '560px', margin: '40px auto', textAlign: 'center', padding: '40px 32px' }}>
      <div
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          backgroundColor: 'var(--primary-light)',
          color: 'var(--primary-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px auto',
        }}
      >
        <HelpCircle size={32} />
      </div>

      <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
        {title}
      </h2>

      <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '28px' }}>
        {message}
      </p>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => (onBack ? onBack() : navigate('/dashboard'))}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <ArrowLeft size={16} />
          <span>Back to Dashboard</span>
        </button>
      </div>
    </div>
  );
}

