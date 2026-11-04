import React from 'react';
import { AlertTriangle, RefreshCw, LogOut } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('Hostel In-Charge Uncaught Application Error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleSignOut = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/login';
    } catch {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--bg-primary, #f8fafc)',
            padding: '24px',
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: '560px',
              width: '100%',
              padding: '40px 32px',
              textAlign: 'center',
              boxShadow: 'var(--shadow-card-hover, 0 10px 25px -5px rgba(15, 23, 42, 0.08))',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'var(--danger-bg, #fef2f2)',
                color: 'var(--danger-text, #991b1b)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px auto',
              }}
            >
              <AlertTriangle size={32} />
            </div>

            <h1
              style={{
                fontSize: '1.4rem',
                fontWeight: 700,
                color: 'var(--text-primary, #0f172a)',
                marginBottom: '12px',
              }}
            >
              Application Error Encountered
            </h1>

            <p
              style={{
                color: 'var(--text-secondary, #475569)',
                fontSize: '0.95rem',
                lineHeight: 1.6,
                marginBottom: '24px',
              }}
            >
              An unexpected runtime error occurred within the Hostel In-Charge portal. You can try refreshing
              the page or re-authenticating your session.
            </p>

            {this.state.error && (
              <div
                style={{
                  backgroundColor: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  fontSize: '0.82rem',
                  fontFamily: 'monospace',
                  color: '#334155',
                  textAlign: 'left',
                  maxHeight: '120px',
                  overflowY: 'auto',
                  marginBottom: '28px',
                  wordBreak: 'break-word',
                }}
              >
                {this.state.error.toString()}
              </div>
            )}

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <button
                type="button"
                className="btn btn-primary"
                onClick={this.handleReload}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <RefreshCw size={16} />
                <span>Reload Page</span>
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={this.handleSignOut}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <LogOut size={16} />
                <span>Sign Out & Reconnect</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

