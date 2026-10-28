import api from './api';

const TOKEN_KEY = 'hms_security_token';
const USER_KEY = 'hms_security_user';

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

    // Role check: Security staff in college scope
    // Allowed role codes in system: 'SECURITY' or 'SECURITY_GUARD'
    const role = membership?.role_code;
    const isSecurity = role === 'SECURITY' || role === 'SECURITY_GUARD';

    if (!membership || membership.role_scope !== 'COLLEGE' || !isSecurity) {
      throw new Error(
        'Access denied. This portal is strictly restricted to authenticated Security Personnel.'
      );
    }

    const sessionUser = {
      id: user_id,
      email: userEmail || email,
      role: membership.role_code,
      roleName: membership.role_name || 'Security Personnel',
      scope: membership.role_scope,
      collegeId: membership.college_id,
      expiresAt: expires_at,
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

  getToken() {
    return (
      localStorage.getItem(TOKEN_KEY) ||
      sessionStorage.getItem(TOKEN_KEY) ||
      localStorage.getItem('token')
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

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem('token');
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  },
};

export default authService;
