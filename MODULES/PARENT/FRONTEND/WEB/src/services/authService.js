import api from './api';

const TOKEN_KEY = 'hms_parent_token';
const USER_KEY = 'hms_parent_user';
const SHARED_TOKEN_KEY = 'token';
const SHARED_USER_KEY = 'hms_user';

export const UNIFIED_PORTAL_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PORTAL_URL) ||
  (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5173'
    : '');

function clearStoredSession() {
  [localStorage, sessionStorage].forEach((storage) => {
    storage.removeItem(TOKEN_KEY);
    storage.removeItem(USER_KEY);
    storage.removeItem(SHARED_TOKEN_KEY);
    storage.removeItem(SHARED_USER_KEY);
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index);
      if (key && key.startsWith('hms_parent_')) {
        storage.removeItem(key);
      }
    }
  });
}

function isSessionExpired(user) {
  if (!user || typeof user.expiresAt !== 'string') return false;
  const expiresAt = Date.parse(user.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt <= Date.now();
}

export const authService = {
  async login(email, password, rememberMe = true) {
    const response = await api.post('/auth/login', {
      email: email.trim().toLowerCase(),
      password,
    });

    const data = response.data || response;
    const { access_token, user_id, email: userEmail, membership, expires_at } = data;

    if (!access_token) {
      throw new Error('Authentication response did not contain an access token.');
    }

    if (
      !membership ||
      membership.role_scope !== 'COLLEGE' ||
      membership.role_code !== 'PARENT'
    ) {
      throw new Error(
        'Access denied. This portal is strictly restricted to authenticated Parents and Guardians.'
      );
    }

    const sessionUser = {
      id: user_id,
      email: userEmail || email,
      role: membership.role_code,
      roleName: membership.role_name || 'Parent',
      scope: membership.role_scope,
      collegeId: membership.college_id,
      expiresAt: expires_at,
    };

    if (isSessionExpired(sessionUser)) {
      throw new Error('Authentication response did not contain a valid session expiry.');
    }

    const primaryStorage = rememberMe ? localStorage : sessionStorage;
    const secondaryStorage = rememberMe ? sessionStorage : localStorage;

    primaryStorage.setItem(TOKEN_KEY, access_token);
    primaryStorage.setItem(USER_KEY, JSON.stringify(sessionUser));
    primaryStorage.setItem(SHARED_TOKEN_KEY, access_token);
    primaryStorage.setItem(SHARED_USER_KEY, JSON.stringify(sessionUser));

    secondaryStorage.removeItem(TOKEN_KEY);
    secondaryStorage.removeItem(USER_KEY);
    secondaryStorage.removeItem(SHARED_TOKEN_KEY);
    secondaryStorage.removeItem(SHARED_USER_KEY);

    return { token: access_token, user: sessionUser };
  },

  getToken() {
    return (
      localStorage.getItem(TOKEN_KEY) ||
      sessionStorage.getItem(TOKEN_KEY) ||
      localStorage.getItem(SHARED_TOKEN_KEY) ||
      sessionStorage.getItem(SHARED_TOKEN_KEY)
    );
  },

  getCurrentUser() {
    for (const storage of [localStorage, sessionStorage]) {
      const raw = storage.getItem(USER_KEY) || storage.getItem(SHARED_USER_KEY);
      if (raw) {
        try {
          const user = JSON.parse(raw);
          if (user?.role === 'PARENT' && !isSessionExpired(user)) {
            return user;
          }
        } catch {
          // continue
        }
      }
    }
    return null;
  },

  getSession() {
    for (const storage of [localStorage, sessionStorage]) {
      const token = storage.getItem(TOKEN_KEY) || storage.getItem(SHARED_TOKEN_KEY);
      const rawUser = storage.getItem(USER_KEY) || storage.getItem(SHARED_USER_KEY);
      if (!token && !rawUser) continue;

      try {
        const user = rawUser ? JSON.parse(rawUser) : null;
        if (token && user && user.role === 'PARENT' && !isSessionExpired(user)) {
          return { token, user };
        }
      } catch {
        clearStoredSession();
        return null;
      }

      clearStoredSession();
      return null;
    }
    return null;
  },

  isSessionExpired,

  logout() {
    clearStoredSession();
    if (typeof window !== 'undefined') {
      window.location.replace(`${UNIFIED_PORTAL_URL}/login`);
    }
  },

  redirectToUnifiedPortal() {
    if (typeof window !== 'undefined') {
      window.location.replace(`${UNIFIED_PORTAL_URL}/login`);
    }
  },
};

export default authService;
