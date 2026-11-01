import React, { useState, useEffect, useCallback } from 'react';
import { AuthContext } from './AuthContext';
import portalAuthService from './portalAuthService';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize from storage on mount
  useEffect(() => {
    try {
      const active = portalAuthService.getActiveSession();
      if (active) {
        setUser(active.user);
        setToken(active.token);
      } else {
        setUser(null);
        setToken(null);
      }
    } catch (err) {
      console.warn('Failed to restore active session:', err);
      setUser(null);
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (email, password, rememberMe = true) => {
    setIsLoading(true);
    try {
      const result = await portalAuthService.login(email, password, rememberMe);
      if (!result.isSuperAdmin && result.token) {
        setUser(result.user);
        setToken(result.token);
      }
      return result;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    portalAuthService.logout();
    setUser(null);
    setToken(null);
  }, []);

  // Listen for session expiration events from API client
  useEffect(() => {
    const handleAuthExpired = () => {
      logout();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('hms:auth_expired', handleAuthExpired);
      return () => window.removeEventListener('hms:auth_expired', handleAuthExpired);
    }
  }, [logout]);

  const isAuthenticated = Boolean(token && user && user.role);

  const value = {
    user,
    token,
    role: user?.role || null,
    scope: user?.scope || null,
    collegeId: user?.collegeId || null,
    isAuthenticated,
    isLoading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
