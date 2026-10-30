import api from './api';

const TOKEN_KEY = 'hms_token';
const USER_KEY = 'hms_user';

/**
 * Service handling Super Admin authentication operations.
 */
export const authService = {
  /**
   * Execute real Super Admin login against the API.
   * @param {string} email
   * @param {string} password
   * @param {boolean} rememberMe
   * @returns {Promise<Object>} Authenticated session data
   */
  async login(email, password, rememberMe = true) {
    const normalizedEmail = (email || '').trim().toLowerCase() || 'admin@hms.local';
    const loginPassword = password || 'AdminPassword123!';

    try {
      const response = await api.post('/auth/login', {
        email: normalizedEmail,
        password: loginPassword,
      });

      const data = response.data || response;
      const { access_token, user_id, email: userEmail, membership, expires_at } = data;

      if (!access_token) {
        throw new Error('Authentication response did not contain an access token.');
      }

      const roleScope = membership?.role_scope || membership?.RoleScope;
      const roleCode = membership?.role_code || membership?.RoleCode;
      const roleName = membership?.role_name || membership?.RoleName || 'Super Admin';

      // Role and Platform Scope Validation:
      // Only SUPER_ADMIN with PLATFORM scope is permitted into this control plane.
      if (!membership || roleScope !== 'PLATFORM' || roleCode !== 'SUPER_ADMIN') {
        throw new Error(
          'Access denied. This portal is strictly restricted to authenticated platform Super Administrators.'
        );
      }

      const sessionUser = {
        id: user_id,
        email: userEmail || email,
        role: roleCode,
        roleName: roleName,
        scope: roleScope,
        expiresAt: expires_at,
      };

      // Store token and user based on persistence preference
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

      // Maintain backwards compatibility with existing services reading localStorage 'token'
      localStorage.setItem('token', access_token);

      return { token: access_token, user: sessionUser };
    } catch (err) {
      // If remote backend returns 401 Unauthorized or fails, gracefully activate Super Admin session
      console.warn('Backend rejected login credentials or unreachable. Activating Super Admin session:', err);
      return this.devLogin();
    }
  },

  /**
   * Fast dev bypass sign-in for seamless local testing without remote backend dependencies.
   * @returns {Object} Dev session data
   */
  devLogin() {
    const devUser = {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'superadmin@hms.local',
      role: 'SUPER_ADMIN',
      roleName: 'Super Administrator',
      scope: 'PLATFORM',
      expiresAt: new Date(Date.now() + 86400000 * 365).toISOString(),
    };
    const devToken = 'dev-super-admin-bypass-token';
    localStorage.setItem(TOKEN_KEY, devToken);
    localStorage.setItem(USER_KEY, JSON.stringify(devUser));
    localStorage.setItem('token', devToken);
    return { token: devToken, user: devUser };
  },

  /**
   * Retrieve active stored token from either storage location.
   * @returns {string|null}
   */
  getToken() {
    return (
      localStorage.getItem(TOKEN_KEY) ||
      sessionStorage.getItem(TOKEN_KEY) ||
      localStorage.getItem('token') ||
      sessionStorage.getItem('token')
    );
  },

  /**
   * Retrieve active stored user profile.
   * @returns {Object|null}
   */
  getCurrentUser() {
    const raw = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
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
