import api from './api';

export const studentService = {
  /**
   * Get student profile with academic & residential info.
   */
  async getProfile() {
    const res = await api.get('/college/student/profile');
    return res.data;
  },

  /**
   * Get active room & bed allocation.
   */
  async getCurrentRoom() {
    const res = await api.get('/college/student/room-allocation');
    return res.data;
  },

  /**
   * Get authorized guardians for the student.
   */
  async getGuardians() {
    const res = await api.get('/college/student/guardians');
    return res.data || [];
  },

  /**
   * Get emergency contacts for the student.
   */
  async getEmergencyContacts() {
    const res = await api.get('/college/student/emergency-contacts');
    return res.data || [];
  },

  /**
   * Get permitted student documents.
   */
  async getDocuments() {
    const res = await api.get('/college/student/documents');
    return res.data || [];
  },

  /**
   * Get student gate passes.
   */
  async listGatePasses() {
    const res = await api.get('/college/student/gate-passes');
    return res.data || [];
  },

  /**
   * Request a new digital gate pass.
   */
  async requestGatePass(payload) {
    const res = await api.post('/college/student/gate-passes', payload);
    return res.data;
  },

  /**
   * Get attendance summary metrics & logs.
   */
  async getAttendance() {
    const res = await api.get('/college/student/attendance');
    return res.data;
  },

  /**
   * Get student leave applications.
   */
  async listLeaves() {
    const res = await api.get('/college/student/leaves');
    return res.data || [];
  },

  /**
   * Apply for a new leave request.
   */
  async applyLeave(payload) {
    const res = await api.post('/college/student/leaves', payload);
    return res.data;
  },

  /**
   * List maintenance complaints and grievances.
   */
  async listComplaints() {
    const res = await api.get('/college/student/complaints');
    return res.data || [];
  },

  /**
   * File a new grievance or maintenance ticket.
   */
  async fileComplaint(payload) {
    const res = await api.post('/college/student/complaints', payload);
    return res.data;
  },

  /**
   * Get institutional dining schedule for today.
   */
  async getTodayMessMenu() {
    const res = await api.get('/college/student/mess/today');
    return res.data;
  },

  /**
   * Get unified dashboard metrics and active summaries.
   */
  async getDashboardSummary() {
    const res = await api.get('/college/student/dashboard/summary');
    return res.data;
  },

  /**
   * Get notifications for the authenticated student.
   */
  async getNotifications(unreadOnly = false) {
    const res = await api.get('/college/notifications', {
      params: unreadOnly ? { unread: 'true' } : {},
    });
    return res.data || [];
  },

  /**
   * Get unread notification count.
   */
  async getUnreadNotificationCount() {
    const res = await api.get('/college/notifications/unread-count');
    return res.data?.count ?? 0;
  },

  /**
   * Mark a notification as read.
   */
  async markNotificationAsRead(notificationId) {
    const res = await api.patch(`/college/notifications/${notificationId}/read`);
    return res.data;
  },
};

