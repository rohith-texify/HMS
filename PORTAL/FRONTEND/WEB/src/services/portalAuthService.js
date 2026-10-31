import api from './api.js';

/**
 * Authoritative mapping between backend role codes and frontend modules.
 * Derived from API/internal/auth/service.go and models/application.go.
 */
export const ROLE_ROUTE_MAP = {
  // College Administration
  COLLEGE_ADMIN: {
    module: 'admin',
    path: '/admin/dashboard',
    tokenKey: 'hms_college_token',
    userKey: 'hms_college_user',
    displayName: 'College Administrator',
    scope: 'COLLEGE',
  },
  HOSTEL_ADMIN: {
    module: 'admin',
    path: '/admin/dashboard',
    tokenKey: 'hms_college_token',
    userKey: 'hms_college_user',
    displayName: 'Hostel Administrator',
    scope: 'COLLEGE',
  },
  ADMIN: {
    module: 'admin',
    path: '/admin/dashboard',
    tokenKey: 'hms_college_token',
    userKey: 'hms_college_user',
    displayName: 'Administrator',
    scope: 'COLLEGE',
  },

  // Parent Portal
  PARENT: {
    module: 'parent',
    path: '/parent/dashboard',
    tokenKey: 'hms_parent_token',
    userKey: 'hms_parent_user',
    displayName: 'Parent / Guardian',
    scope: 'COLLEGE',
  },

  // Student Portal
  STUDENT: {
    module: 'student',
    path: '/student/dashboard',
    tokenKey: 'hms_student_token',
    userKey: 'hms_student_user',
    displayName: 'Student',
    scope: 'COLLEGE',
  },

  // Hostel Incharge Portal
  HOSTEL_INCHARGE: {
    module: 'hostel-incharge',
    path: '/hostel-incharge/dashboard',
    tokenKey: 'hms_incharge_token',
    userKey: 'hms_incharge_user',
    displayName: 'Hostel In-Charge',
    scope: 'COLLEGE',
  },
  INCHARGE: {
    module: 'hostel-incharge',
    path: '/hostel-incharge/dashboard',
    tokenKey: 'hms_incharge_token',
    userKey: 'hms_incharge_user',
    displayName: 'Hostel In-Charge',
    scope: 'COLLEGE',
  },
  WARDEN: {
    module: 'hostel-incharge',
    path: '/hostel-incharge/dashboard',
    tokenKey: 'hms_incharge_token',
    userKey: 'hms_incharge_user',
    displayName: 'Hostel Warden',
    scope: 'COLLEGE',
  },

  // Security Portal
  SECURITY: {
    module: 'security',
    path: '/security/dashboard',
    tokenKey: 'hms_security_token',
    userKey: 'hms_security_user',
    displayName: 'Security Personnel',
    scope: 'COLLEGE',
  },
  SECURITY_GUARD: {
    module: 'security',
    path: '/security/dashboard',
    tokenKey: 'hms_security_token',
    userKey: 'hms_security_user',
    displayName: 'Security Guard',
    scope: 'COLLEGE',
  },
};

export const SUPER_ADMIN_URL = 'https://hms-frontend-9q6b.onrender.com';

export const portalAuthService = {
  /**
   * Authenticate against backend POST /auth/login and map role to designated module.
   * @param {string} email
   * @param {string} password
   * @param {boolean} rememberMe
   * @returns {Promise<{ token: string, user: Object, redirectPath: string, module: string }>}
   */
  async login(email, password, rememberMe = true) {
    const normalizedEmail = (email || '').trim().toLowerCase();
    if (!normalizedEmail || !password) {
      throw new Error('Please enter both your email address and password.');
    }

    const response = await api.post('/auth/login', {
      email: normalizedEmail,
      password,
    });

    const data = response.data || response;
    const { access_token, user_id, email: userEmail, membership, expires_at } = data;

    if (!access_token) {
      throw new Error('Authentication response did not contain an access token.');
    }

    const roleCode = (membership?.role_code || '').toUpperCase();

    // Special handling for Super Admin: Guide to dedicated console
    if (roleCode === 'SUPER_ADMIN') {
      return {
        isSuperAdmin: true,
        redirectUrl: SUPER_ADMIN_URL,
        message: 'Super Administrator accounts are managed through the dedicated Super Admin Console.',
      };
    }

    const mapping = ROLE_ROUTE_MAP[roleCode];
    if (!mapping) {
      throw new Error(
        `Access denied. Role "${roleCode || 'UNKNOWN'}" is not authorized for institutional portal access.`
      );
    }

    const sessionUser = {
      id: user_id,
      email: userEmail || normalizedEmail,
      role: roleCode,
      roleName: membership?.role_name || mapping.displayName,
      scope: membership?.role_scope || mapping.scope,
      collegeId: membership?.college_id || null,
      expiresAt: expires_at,
    };

    // Store tokens in target storage
    const primaryStorage = rememberMe ? localStorage : sessionStorage;
    const secondaryStorage = rememberMe ? sessionStorage : localStorage;

    // 1. Set module-specific keys
    primaryStorage.setItem(mapping.tokenKey, access_token);
    primaryStorage.setItem(mapping.userKey, JSON.stringify(sessionUser));
    secondaryStorage.removeItem(mapping.tokenKey);
    secondaryStorage.removeItem(mapping.userKey);

    // 2. Set generic keys for cross-module compatibility
    primaryStorage.setItem('token', access_token);
    primaryStorage.setItem('hms_active_role', roleCode);
    primaryStorage.setItem('hms_active_module', mapping.module);
    secondaryStorage.removeItem('token');
    secondaryStorage.removeItem('hms_active_role');
    secondaryStorage.removeItem('hms_active_module');

    return {
      token: access_token,
      user: sessionUser,
      redirectPath: mapping.path,
      module: mapping.module,
    };
  },

  /**
   * Check for an existing valid college session across all module keys.
   * @returns {{ module: string, redirectPath: string, user: Object, token: string } | null}
   */
  getActiveSession() {
    for (const [roleCode, config] of Object.entries(ROLE_ROUTE_MAP)) {
      const token =
        localStorage.getItem(config.tokenKey) ||
        sessionStorage.getItem(config.tokenKey);
      const rawUser =
        localStorage.getItem(config.userKey) ||
        sessionStorage.getItem(config.userKey);

      if (token && rawUser) {
        try {
          const user = JSON.parse(rawUser);
          // Verify session not expired
          if (user.expiresAt && new Date(user.expiresAt) < new Date()) {
            continue;
          }
          return {
            module: config.module,
            redirectPath: config.path,
            user,
            token,
          };
        } catch {
          // Invalid JSON, continue checking
        }
      }
    }
    return null;
  },

  /**
   * Perform clean logout for a specific module or all institutional sessions.
   * @param {string} [targetModule] - 'admin' | 'parent' | 'student' | 'hostel-incharge' | 'security'
   */
  logout(targetModule = null) {
    if (targetModule) {
      // Find matching keys
      for (const config of Object.values(ROLE_ROUTE_MAP)) {
        if (config.module === targetModule) {
          localStorage.removeItem(config.tokenKey);
          localStorage.removeItem(config.userKey);
          sessionStorage.removeItem(config.tokenKey);
          sessionStorage.removeItem(config.userKey);
        }
      }
    } else {
      // Clear all module keys
      for (const config of Object.values(ROLE_ROUTE_MAP)) {
        localStorage.removeItem(config.tokenKey);
        localStorage.removeItem(config.userKey);
        sessionStorage.removeItem(config.tokenKey);
        sessionStorage.removeItem(config.userKey);
      }
    }

    localStorage.removeItem('token');
    localStorage.removeItem('hms_active_role');
    localStorage.removeItem('hms_active_module');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('hms_active_role');
    sessionStorage.removeItem('hms_active_module');
  },
};

export default portalAuthService;
