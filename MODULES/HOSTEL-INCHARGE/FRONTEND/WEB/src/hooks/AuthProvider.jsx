import React, { useState, useEffect, useCallback } from 'react';
import authService from '../services/authService';
import inchargeService from '../services/inchargeService';
import { AuthContext } from './AuthContext';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => authService.getCurrentUser());
  const [token, setToken] = useState(() => authService.getToken());
  const [assignedHostel, setAssignedHostel] = useState(() => authService.getAssignedHostel());
  const [isLoading, setIsLoading] = useState(true);

  // Refresh assigned hostel scope from backend
  const refreshAssignedHostel = useCallback(async () => {
    try {
      const hostel = await inchargeService.getMyHostel();
      if (hostel) {
        setAssignedHostel(hostel);
        authService.setAssignedHostel(hostel);
      }
    } catch (err) {
      console.warn('Failed to refresh assigned hostel scope:', err.message);
    }
  }, []);

  // Initialize session and listen for session expiration events
  useEffect(() => {
    const activeToken = authService.getToken();
    const currentUser = authService.getCurrentUser();
    const activeHostel = authService.getAssignedHostel();

    if (activeToken && currentUser) {
      const role = String(currentUser.role || '').toUpperCase();
      const isAllowedRole =
        role === 'HOSTEL_INCHARGE' ||
        role === 'INCHARGE' ||
        role === 'COLLEGE_ADMIN';
      const isAllowedScope = currentUser.scope === 'COLLEGE';

      if (isAllowedRole && isAllowedScope) {
        setUser(currentUser);
        setToken(activeToken);
        if (activeHostel) {
          setAssignedHostel(activeHostel);
        } else {
          // Resolve on session restore
          refreshAssignedHostel();
        }
      } else {
        authService.logout();
        setUser(null);
        setToken(null);
        setAssignedHostel(null);
      }
    } else {
      authService.logout();
      setUser(null);
      setToken(null);
      setAssignedHostel(null);
    }

    setIsLoading(false);

    // Session expiration event listener dispatched from api.js on 401
    const handleAuthExpired = () => {
      authService.logout();
      setUser(null);
      setToken(null);
      setAssignedHostel(null);
    };

    window.addEventListener('hms:auth_expired', handleAuthExpired);
    return () => window.removeEventListener('hms:auth_expired', handleAuthExpired);
  }, [refreshAssignedHostel]);

  const login = useCallback(
    async (email, password, rememberMe = true) => {
      setIsLoading(true);
      try {
        const result = await authService.login(email, password, rememberMe);
        setToken(result.token);
        setUser(result.user);
        if (result.assignedHostel) {
          setAssignedHostel(result.assignedHostel);
        } else {
          await refreshAssignedHostel();
        }
        return result;
      } finally {
        setIsLoading(false);
      }
    },
    [refreshAssignedHostel]
  );

  const logout = useCallback(() => {
    authService.logout();
    setUser(null);
    setToken(null);
    setAssignedHostel(null);
  }, []);

  // Strict role and scope authorization condition
  const isAuthenticated = Boolean(
    token &&
      user &&
      (user.role === 'HOSTEL_INCHARGE' || user.role === 'INCHARGE') &&
      user.scope === 'COLLEGE'
  );

  const value = {
    user,
    token,
    assignedHostel,
    isLoading,
    isAuthenticated,
    login,
    logout,
    refreshAssignedHostel,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
