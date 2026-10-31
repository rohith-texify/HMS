import api from './api';

const TOKEN_KEY = 'hms_token';
const USER_KEY = 'hms_user';

/**
 * Validates that a token is a non-expired, properly-formed platform Super Admin JWT.
 * Rejects legacy mock tokens and expired sessions.
 */
function isTokenValid(token) {
  if (!token || typeof token !== 'string') return false;
  if (token.startsWith('super-admin-session')) return false;

  const parts = token.split('.');
  if (parts.length !== 3) return false;

  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return false; // token expired
    }
    if (payload.role !== 'SUPER_ADMIN' || payload.scope !== 'PLATFORM') {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Service handling Super Admin authentication operations.
 */
export const authService = {
  /**
   * Execute Super Admin login against the API.
   * @param {string} email
   * @param {string} password
   * @param {boolean} rememberMe
   * @returns {Promise<Object>} Authenticated session data
   */
  async login(email, password, rememberMe = true) {
    const normalizedEmail = (email || '').trim().toLowerCase();
    if (!normalizedEmail || !password) {
      throw new Error('Please enter both email and password.');
    }

    const response = await api.post(
      '/auth/login',
      {
        email: normalizedEmail,
        password,
      },
      { timeout: 15000 }
    );

    const payload = response?.data ?? response;
    const data = payload?.data ?? payload;
    const { access_token, user_id, email: userEmail, membership, expires_at } = data;

    if (!access_token) {
      throw new Error('Authentication response did not contain an access token.');
    }

    const roleScope = (membership?.role_scope || membership?.RoleScope || data.role_scope || '').toUpperCase();
    const roleCode = (membership?.role_code || membership?.RoleCode || data.role_code || data.role || '').toUpperCase();
    const roleName = membership?.role_name || membership?.RoleName || data.role_name || 'Super Administrator';

    if (roleCode !== 'SUPER_ADMIN' || roleScope !== 'PLATFORM') {
      throw new Error(
        'Access denied. This portal is strictly restricted to authenticated platform Super Administrators.'
      );
    }

    const sessionUser = {
      id: user_id || data.id,
      email: userEmail || normalizedEmail,
      role: roleCode,
      roleName: roleName,
      scope: roleScope,
      expiresAt: expires_at || new Date(Date.now() + 86400000 * 365).toISOString(),
    };

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
    localStorage.setItem('token', access_token);

    return { token: access_token, user: sessionUser };
  },

  /**
   * Retrieve active stored token from either storage location.
   * Automatically validates token structure and expiration.
   * @returns {string|null}
   */
  getToken() {
    const rawToken =
      localStorage.getItem(TOKEN_KEY) ||
      sessionStorage.getItem(TOKEN_KEY) ||
      localStorage.getItem('token') ||
      sessionStorage.getItem('token');

    if (!rawToken || !isTokenValid(rawToken)) {
      if (rawToken) {
        this.logout();
      }
      return null;
    }
    return rawToken;
  },

  /**
   * Retrieve active stored user profile.
   * @returns {Object|null}
   */
  getCurrentUser() {
    const validToken = this.getToken();
    if (!validToken) {
      return null;
    }
    const raw = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.role !== 'SUPER_ADMIN' && parsed?.roleCode !== 'SUPER_ADMIN') {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  },

  /**
   * Verify session with backend /auth/me endpoint if available.
   * Returns current user claims if valid.
   */
  async verifySession() {
    const token = this.getToken();
    if (!token) {
      throw new Error('No authentication token found.');
    }

    const res = await api.get('/auth/me');
    const data = res.data || res;
    if (data.role !== 'SUPER_ADMIN' || data.scope !== 'PLATFORM') {
      throw new Error('Invalid platform privileges.');
    }
    return data;
  },

  /**
   * Terminate active session and purge credentials.
   */
  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem('token');
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    sessionStorage.removeItem('token');
  },
};

export default authService;
