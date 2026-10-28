import React, { useState, useEffect, useCallback } from 'react';
import authService from '../services/authService';
import { AuthContext } from './AuthContext';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => authService.getCurrentUser());
  const [token, setToken] = useState(() => authService.getToken());
  const [isLoading, setIsLoading] = useState(true);

  // Synchronize state on initial mount or storage changes
  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      const activeToken = authService.getToken();
      const currentUser = authService.getCurrentUser();

      if (activeToken && currentUser) {
        setUser(currentUser);
        setToken(activeToken);
      } else {
        authService.logout();
        setUser(null);
        setToken(null);
      }

      if (isMounted) {
        setIsLoading(false);
      }
    };

    initAuth();

    return () => {
      isMounted = false;
    };
  }, []);

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

  const logout = useCallback(() => {
    authService.logout();
    setUser(null);
    setToken(null);
  }, []);

  const isAuthenticated = Boolean(
    token && user && user.role === 'SUPER_ADMIN' && user.scope === 'PLATFORM'
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
