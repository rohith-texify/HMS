import api from './api';

const TOKEN_KEY = 'hms_incharge_token';
const USER_KEY = 'hms_incharge_user';
const HOSTEL_KEY = 'hms_incharge_assigned_hostel';

export const authService = {
  /**
   * Authenticate Hostel In-Charge credentials
   * Enforces strict role boundary: HOSTEL_INCHARGE or INCHARGE only.
   */
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

    // Role check: Strictly HOSTEL_INCHARGE or verified alias INCHARGE
    const roleCode = (membership?.role_code || '').toUpperCase();
    const isPermittedIncharge =
      roleCode === 'HOSTEL_INCHARGE' ||
      roleCode === 'INCHARGE' ||
      roleCode === 'COLLEGE_ADMIN';

    if (!membership || membership.role_scope !== 'COLLEGE' || !isPermittedIncharge) {
      throw new Error(
        `Access denied. Role '${membership?.role_code || 'UNKNOWN'}' is not authorized for the Hostel In-Charge portal. This interface is strictly restricted to assigned hostel in-charge personnel.`
      );
    }

    const sessionUser = {
      id: user_id,
      email: userEmail || email,
      role: roleCode,
      roleName: membership.role_name || 'Hostel Incharge',
      scope: membership.role_scope,
      collegeId: membership.college_id,
      collegeName: membership.college_name || '',
      collegeCode: membership.college_code || '',
      collegeLogoUrl: membership.college_logo_url || null,
      expiresAt: expires_at,
    };

    const storage = rememberMe ? localStorage : sessionStorage;
    const otherStorage = rememberMe ? sessionStorage : localStorage;

    storage.setItem(TOKEN_KEY, access_token);
    storage.setItem(USER_KEY, JSON.stringify(sessionUser));
    storage.setItem('token', access_token);

    otherStorage.removeItem(TOKEN_KEY);
    otherStorage.removeItem(USER_KEY);
    otherStorage.removeItem(HOSTEL_KEY);

    // Resolve assigned hostel scope immediately
    let assignedHostel = null;
    try {
      const hostelRes = await api.get('/college/incharges/my-hostel');
      assignedHostel = hostelRes.data || hostelRes;
      if (assignedHostel) {
        storage.setItem(HOSTEL_KEY, JSON.stringify(assignedHostel));
      }
    } catch (err) {
      console.warn('Initial assigned hostel resolution deferred:', err.message);
    }

    return { token: access_token, user: sessionUser, assignedHostel };
  },

  getToken() {
    return (
      localStorage.getItem(TOKEN_KEY) ||
      sessionStorage.getItem(TOKEN_KEY) ||
      localStorage.getItem('token') ||
      sessionStorage.getItem('token')
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

  getAssignedHostel() {
    const raw = localStorage.getItem(HOSTEL_KEY) || sessionStorage.getItem(HOSTEL_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  setAssignedHostel(hostelData) {
    if (!hostelData) return;
    const storage = localStorage.getItem(TOKEN_KEY) ? localStorage : sessionStorage;
    storage.setItem(HOSTEL_KEY, JSON.stringify(hostelData));
  },

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(HOSTEL_KEY);
    localStorage.removeItem('token');
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(HOSTEL_KEY);
    sessionStorage.removeItem('token');
  },
};

export default authService;
