import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast, Toaster } from 'sonner';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import '../styles/login.css';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Please enter your email address and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email.trim(), password);
      const targetPath = from && from !== '/login' ? from : '/dashboard';
      navigate(targetPath, { replace: true });
    } catch (loginError) {
      if (loginError?.status === 401) {
        setError(
          loginError.message?.toLowerCase().includes('invalid')
            ? 'Invalid email or password. Please try again.'
            : loginError.message || 'Invalid email or password. Please try again.'
        );
      } else if (loginError?.code === 'ECONNABORTED' || loginError?.code === 'ETIMEDOUT') {
        setError('The sign-in request timed out. Please try again.');
      } else if (loginError?.status >= 500) {
        setError(
          loginError.message && !loginError.message.startsWith('Request failed with status code')
            ? `Server error: ${loginError.message}`
            : 'The server encountered an error. Please try again later.'
        );
      } else if (!loginError?.status) {
        setError('Unable to reach the server. Check your connection and try again.');
      } else {
        setError(loginError?.message || 'Unable to sign in. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="login-page">
      <Toaster position="top-center" />
      <section className="login-card" aria-labelledby="login-heading">
        <p className="login-eyebrow">Please enter your details</p>
        <h1 className="login-heading" id="login-heading">
          Welcome back
        </h1>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <div className="login-fields">
            <input
              aria-label="Email address"
              autoComplete="username"
              className="login-input"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email address"
              type="email"
              value={email}
            />
            <div className="login-password-field">
              <input
                aria-label="Password"
                autoComplete="current-password"
                className="login-input"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
              />
              <button
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="login-password-toggle"
                onClick={() => setShowPassword((visible) => !visible)}
                type="button"
              >
                {showPassword ? <EyeOff aria-hidden="true" size={20} /> : <Eye aria-hidden="true" size={20} />}
              </button>
            </div>
          </div>

          <div className="login-forgot-row">
            <button
              className="login-text-button login-forgot-link"
              onClick={() => toast('Contact the platform administrator')}
              type="button"
            >
              Forgot password?
            </button>
          </div>

          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}

          <button className="login-submit" disabled={isSubmitting} type="submit">
            {isSubmitting && <span aria-hidden="true" className="login-spinner" />}
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="login-footer">
          Don&apos;t have an account?
          <button
            className="login-text-button login-signup-link"
            onClick={() => toast('Super Admin accounts are created by platform staff')}
            type="button"
          >
            Sign up
          </button>
        </p>
      </section>
    </main>
  );
}
