import api from '../api/api.js';

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
   * Execute shared login against POST /auth/login
   * @param {string} email
   * @param {string} password
   * @param {boolean} rememberMe
   * @returns {Promise<{ token: string, user: Object, redirectPath: string, isSuperAdmin: boolean }>}
   */
  async login(email, password, rememberMe = true) {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !password) {
      throw new Error('Please provide both email address and password.');
    }

    const res = await api.post('/auth/login', {
      email: cleanEmail,
      password,
    });

    const data = res.data || res;
    const { access_token, user_id, email: userEmail, membership, expires_at } = data;

    if (!access_token) {
      throw new Error('Authentication response did not contain an access token.');
    }

    const roleCode = (membership?.role_code || membership?.RoleCode || '').toUpperCase();
    const roleScope = (membership?.role_scope || membership?.RoleScope || 'COLLEGE').toUpperCase();
    const collegeId = membership?.college_id || membership?.CollegeID || null;

    // Detect Super Admin and signal separate deployment
    if (roleCode === 'SUPER_ADMIN') {
      return {
        token: access_token,
        isSuperAdmin: true,
        redirectPath: SUPER_ADMIN_URL,
        user: {
          id: user_id,
          email: userEmail || cleanEmail,
          role: 'SUPER_ADMIN',
          roleName: 'Super Administrator',
          scope: 'PLATFORM',
        },
      };
    }

    const roleConfig = ROLE_ROUTE_MAP[roleCode];
    if (!roleConfig) {
      throw new Error(
        `Authorized role '${roleCode}' is not permitted to access institutional college portals. Please contact your administrator.`
      );
    }

    const sessionUser = {
      id: user_id,
      email: userEmail || cleanEmail,
      role: roleCode,
      roleName: roleConfig.displayName,
      scope: roleScope,
      collegeId: collegeId,
      expiresAt: expires_at,
      module: roleConfig.module,
    };

    const storage = rememberMe ? localStorage : sessionStorage;
    const alternateStorage = rememberMe ? sessionStorage : localStorage;

    // 1. Store in shared keys
    storage.setItem('token', access_token);
    storage.setItem('hms_user', JSON.stringify(sessionUser));
    alternateStorage.removeItem('token');
    alternateStorage.removeItem('hms_user');

    // 2. Synchronize module-specific keys for backwards compatibility
    storage.setItem(roleConfig.tokenKey, access_token);
    storage.setItem(roleConfig.userKey, JSON.stringify(sessionUser));
    alternateStorage.removeItem(roleConfig.tokenKey);
    alternateStorage.removeItem(roleConfig.userKey);

    return {
      token: access_token,
      user: sessionUser,
      redirectPath: roleConfig.path,
      isSuperAdmin: false,
    };
  },

  /**
   * Determine active session across shared or module-specific storage
   * @returns {{ token: string, user: Object, redirectPath: string } | null}
   */
  getActiveSession() {
    const checkStorage = (storage) => {
      const token = storage.getItem('token');
      const rawUser = storage.getItem('hms_user');
      if (token && rawUser) {
        try {
          const user = JSON.parse(rawUser);
          if (user?.role && ROLE_ROUTE_MAP[user.role]) {
            return {
              token,
              user,
              redirectPath: ROLE_ROUTE_MAP[user.role].path,
            };
          }
        } catch {
          // ignore corrupted user JSON
        }
      }

      // Check each module-specific key
      for (const [roleCode, cfg] of Object.entries(ROLE_ROUTE_MAP)) {
        const modToken = storage.getItem(cfg.tokenKey);
        const modUserRaw = storage.getItem(cfg.userKey);
        if (modToken && modUserRaw) {
          try {
            const user = JSON.parse(modUserRaw);
            return {
              token: modToken,
              user: { ...user, role: user.role || roleCode, module: cfg.module },
              redirectPath: cfg.path,
            };
          } catch {
            // ignore
          }
        }
      }
      return null;
    };

    return checkStorage(localStorage) || checkStorage(sessionStorage);
  },

  /**
   * Clear session across all storages and modules
   */
  logout() {
    const keysToRemove = [
      'token',
      'hms_user',
      'hms_token',
      'hms_college_token',
      'hms_college_user',
      'hms_parent_token',
      'hms_parent_user',
      'hms_student_token',
      'hms_student_user',
      'hms_incharge_token',
      'hms_incharge_user',
      'hms_security_token',
      'hms_security_user',
    ];

    keysToRemove.forEach((k) => {
      localStorage.removeItem(k);
      sessionStorage.removeItem(k);
    });
  },
};

export default portalAuthService;

