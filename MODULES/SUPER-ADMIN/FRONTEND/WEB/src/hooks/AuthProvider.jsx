import React, { useState, useEffect, useCallback } from 'react';
import authService from '../services/authService';
import { AuthContext } from './AuthContext';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => authService.getCurrentUser());
  const [token, setToken] = useState(() => authService.getToken());
  const [isLoading, setIsLoading] = useState(false);

  const logout = useCallback(() => {
    authService.logout();
    setUser(null);
    setToken(null);
  }, []);

  // Initialize auth on mount and sync state
  useEffect(() => {
    const activeToken = authService.getToken();
    const currentUser = authService.getCurrentUser();

    if (activeToken && currentUser) {
      setToken(activeToken);
      setUser(currentUser);
    } else {
      logout();
    }

    // Listen for unauthorized events emitted by API client
    const handleUnauthorized = () => {
      logout();
    };

    window.addEventListener('hms:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('hms:unauthorized', handleUnauthorized);
    };
  }, [logout]);

  const login = useCallback(async (email, password, rememberMe = true) => {
    setIsLoading(true);
    try {
      const result = await authService.login(email, password, rememberMe);
      setToken(result.token);
      setUser(result.user);
      return result;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Check if user is authenticated AND is SUPER_ADMIN with valid token
  const isAuthenticated = Boolean(
    token && user && (user.role === 'SUPER_ADMIN' || user.roleCode === 'SUPER_ADMIN')
  );

  const value = {
    user,
    token,
    isLoading,
    isAuthenticated,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
