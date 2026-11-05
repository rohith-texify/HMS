import React, { useState, useEffect, useCallback } from 'react';
import { AuthContext } from './AuthContext';
import portalAuthService from './portalAuthService';
import api from '../api/api';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [assignedHostel, setAssignedHostel] = useState(() => {
    try {
      const stored =
        localStorage.getItem('hms_incharge_assigned_hostel') ||
        sessionStorage.getItem('hms_incharge_assigned_hostel');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState(true);

  // Refresh assigned hostel scope for Hostel Incharge
  const refreshAssignedHostel = useCallback(async () => {
    try {
      const res = await api.get('/college/incharges/my-hostel');
      const hostel = res.data || res;
      if (hostel) {
        setAssignedHostel(hostel);
        localStorage.setItem('hms_incharge_assigned_hostel', JSON.stringify(hostel));
      }
    } catch (err) {
      console.warn('Failed to refresh assigned hostel scope:', err?.message || err);
    }
  }, []);

  // Initialize from storage on mount
  useEffect(() => {
    try {
      const active = portalAuthService.getActiveSession();
      if (active) {
        setUser(active.user);
        setToken(active.token);

        // Fetch assigned hostel if role is incharge
        const role = String(active.user?.role || '').toUpperCase();
        if (['HOSTEL_INCHARGE', 'INCHARGE', 'WARDEN'].includes(role)) {
          refreshAssignedHostel();
        }
      } else {
        setUser(null);
        setToken(null);
        setAssignedHostel(null);
      }
    } catch (err) {
      console.warn('Failed to restore active session:', err);
      setUser(null);
      setToken(null);
      setAssignedHostel(null);
    } finally {
      setIsLoading(false);
    }
  }, [refreshAssignedHostel]);

  const login = useCallback(async (email, password, rememberMe = true) => {
    setIsLoading(true);
    try {
      const result = await portalAuthService.login(email, password, rememberMe);
      if (!result.isSuperAdmin && result.token) {
        setUser(result.user);
        setToken(result.token);

        const role = String(result.user?.role || '').toUpperCase();
        if (['HOSTEL_INCHARGE', 'INCHARGE', 'WARDEN'].includes(role)) {
          await refreshAssignedHostel();
        }
      }
      return result;
    } finally {
      setIsLoading(false);
    }
  }, [refreshAssignedHostel]);

  const logout = useCallback(() => {
    portalAuthService.logout();
    localStorage.removeItem('hms_incharge_assigned_hostel');
    sessionStorage.removeItem('hms_incharge_assigned_hostel');
    setUser(null);
    setToken(null);
    setAssignedHostel(null);
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
    assignedHostel,
    refreshAssignedHostel,
    isAuthenticated,
    isLoading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
