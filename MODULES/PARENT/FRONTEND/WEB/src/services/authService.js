import api from './api';

const TOKEN_KEY = 'hms_parent_token';
const USER_KEY = 'hms_parent_user';

function clearStoredSession() {
  [localStorage, sessionStorage].forEach((storage) => {
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index);
      if (key === 'token' || (key && key.startsWith('hms_parent_'))) {
        storage.removeItem(key);
      }
    }
  });
}

function isSessionExpired(user) {
  if (!user || typeof user.expiresAt !== 'string') return true;
  const expiresAt = Date.parse(user.expiresAt);
  return !Number.isFinite(expiresAt) || expiresAt <= Date.now();
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

    if (rememberMe) {
      localStorage.setItem(TOKEN_KEY, access_token);
      localStorage.setItem(USER_KEY, JSON.stringify(sessionUser));
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(USER_KEY);
    } else {
      sessionStorage.setItem(TOKEN_KEY, access_token);
      sessionStorage.setItem(USER_KEY, JSON.stringify(sessionUser));
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }

    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    return { token: access_token, user: sessionUser };
  },

  getToken() {
    return (
      localStorage.getItem(TOKEN_KEY) ||
      sessionStorage.getItem(TOKEN_KEY)
    );
  },

  getCurrentUser() {
    const raw = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  getSession() {
    for (const storage of [localStorage, sessionStorage]) {
      const token = storage.getItem(TOKEN_KEY);
      const rawUser = storage.getItem(USER_KEY);
      if (!token && !rawUser) continue;

      try {
        const user = rawUser ? JSON.parse(rawUser) : null;
        if (token && user && !isSessionExpired(user)) {
          localStorage.removeItem('token');
          sessionStorage.removeItem('token');
          return { token, user };
        }
      } catch {
        clearStoredSession();
        return null;
      }

      clearStoredSession();
      return null;
    }

    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    return null;
  },

  isSessionExpired,

  logout() {
    clearStoredSession();
  },
};

export default authService;
