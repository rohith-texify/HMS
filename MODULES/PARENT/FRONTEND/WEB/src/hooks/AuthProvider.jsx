import React, { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from './AuthContext';
import authService from '../services/authService';

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => authService.getSession());
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const logout = useCallback(() => {
    authService.logout();
    setSession(null);
  }, []);

  const validateSession = useCallback(() => {
    if (!session) return false;

    if (authService.isSessionExpired(session.user) || !session.token) {
      logout();
      return false;
    }

    return true;
  }, [logout, session]);

  const login = async (email, password, rememberMe = true) => {
    setLoading(true);
    try {
      const result = await authService.login(email, password, rememberMe);
      setSession({ user: result.user, token: result.token });
      return result;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleAuthExpired = () => {
      logout();
      navigate('/login', { replace: true });
    };

    window.addEventListener('hms:parent-auth-expired', handleAuthExpired);
    return () => window.removeEventListener('hms:parent-auth-expired', handleAuthExpired);
  }, [logout, navigate]);

  const user = session?.user || null;
  const token = session?.token || null;

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!token && !!user,
    login,
    logout,
    validateSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export default AuthProvider;
