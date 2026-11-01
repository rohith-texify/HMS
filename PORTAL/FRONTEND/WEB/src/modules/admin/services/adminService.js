import api from '../../../shared/api/api';

/**
 * College Admin Module API Service Layer
 * Encapsulates all /college/* backend HTTP contracts.
 */
export const adminService = {
  // Context & Bootstrap
  async getContext() {
    return api.get('/college/context');
  },
  async getBootstrap() {
    return api.get('/college/bootstrap');
  },

  // Hostels & Inventory
  async getHostels() {
    const res = await api.get('/college/hostels');
    return res.data || res;
  },
  async getHostelById(id) {
    const res = await api.get(`/college/hostels/${id}`);
    return res.data || res;
  },
  async createHostel(payload) {
    return api.post('/college/hostels', payload);
  },
  async updateHostel(id, payload) {
    return api.put(`/college/hostels/${id}`, payload);
  },
  async updateHostelStatus(id, status) {
    return api.patch(`/college/hostels/${id}/status`, { status });
  },

  // Blocks
  async getBlocks(hostelId) {
    const res = await api.get(`/college/hostels/${hostelId}/blocks`);
    return res.data || res;
  },
  async createBlock(hostelId, payload) {
    return api.post(`/college/hostels/${hostelId}/blocks`, payload);
  },

  // Floors
  async getFloors(hostelId, blockId) {
    const res = await api.get(`/college/hostels/${hostelId}/blocks/${blockId}/floors`);
    return res.data || res;
  },
  async createFloor(hostelId, blockId, payload) {
    return api.post(`/college/hostels/${hostelId}/blocks/${blockId}/floors`, payload);
  },

  // Rooms
  async getRooms(hostelId, blockId, floorId) {
    const res = await api.get(`/college/hostels/${hostelId}/blocks/${blockId}/floors/${floorId}/rooms`);
    return res.data || res;
  },
  async createRoom(hostelId, blockId, floorId, payload) {
    return api.post(`/college/hostels/${hostelId}/blocks/${blockId}/floors/${floorId}/rooms`, payload);
  },

  // Beds
  async getBeds(hostelId, blockId, floorId, roomId) {
    const res = await api.get(`/college/hostels/${hostelId}/blocks/${blockId}/floors/${floorId}/rooms/${roomId}/beds`);
    return res.data || res;
  },

  // Students Directory
  async getStudents(params = {}) {
    const res = await api.get('/college/students', { params });
    return res.data || res;
  },
  async getStudentById(id) {
    const res = await api.get(`/college/students/${id}`);
    return res.data || res;
  },
  async createStudent(payload) {
    return api.post('/college/students', payload);
  },
  async updateStudent(id, payload) {
    return api.put(`/college/students/${id}`, payload);
  },
  async updateStudentStatus(id, status) {
    return api.patch(`/college/students/${id}/status`, { status });
  },

  // Student Parents & Emergency Contacts
  async getStudentParents(studentId) {
    const res = await api.get(`/college/students/${studentId}/parents`);
    return res.data || res;
  },
  async getEmergencyContacts(studentId) {
    const res = await api.get(`/college/students/${studentId}/emergency-contacts`);
    return res.data || res;
  },

  // Bed Allocations
  async getAllocations() {
    const res = await api.get('/college/bed-allocations');
    return res.data || res;
  },
  async allocateBed(payload) {
    return api.post('/college/bed-allocations', payload);
  },
  async releaseBed(allocationId, payload = {}) {
    return api.patch(`/college/bed-allocations/${allocationId}/release`, payload);
  },
  async transferBed(allocationId, payload = {}) {
    return api.patch(`/college/bed-allocations/${allocationId}/transfer`, payload);
  },

  // College Staff & Incharges
  async getStaff() {
    const res = await api.get('/college/staff');
    return res.data || res;
  },
  async getStaffById(id) {
    const res = await api.get(`/college/staff/${id}`);
    return res.data || res;
  },
  async createStaff(payload) {
    return api.post('/college/staff', payload);
  },
  async updateStaff(id, payload) {
    return api.put(`/college/staff/${id}`, payload);
  },
  async updateStaffStatus(id, status) {
    return api.patch(`/college/staff/${id}/status`, { status });
  },
  async getInchargeAssignments(hostelId) {
    const res = await api.get(`/college/hostels/${hostelId}/incharges`);
    return res.data || res;
  },

  // Security Gates & Assignments
  async getGates() {
    const res = await api.get('/college/gates');
    return res.data || res;
  },
  async getSecurityAssignments() {
    const res = await api.get('/college/security-assignments');
    return res.data || res;
  },

  // Attendance & Summaries
  async getAttendanceSummary(params = {}) {
    const res = await api.get('/college/attendance/reports/summary', { params });
    return res.data || res;
  },
  async getStudentAttendanceList(params = {}) {
    const res = await api.get('/college/attendance/students', { params });
    return res.data || res;
  },

  // Leaves
  async getLeaveRequests(params = {}) {
    const res = await api.get('/college/leaves', { params });
    return res.data || res;
  },
  async getLeaveSummary() {
    const res = await api.get('/college/leaves/reports/summary');
    return res.data || res;
  },

  // Complaints
  async getComplaints(params = {}) {
    const res = await api.get('/college/complaints', { params });
    return res.data || res;
  },

  // Notifications
  async getNotifications() {
    const res = await api.get('/college/notifications');
    return res.data || res;
  },
  async getUnreadNotificationCount() {
    const res = await api.get('/college/notifications/unread-count');
    return res.data || res;
  },
  async markNotificationRead(id) {
    return api.patch(`/college/notifications/${id}/read`);
  },
  async markAllNotificationsRead() {
    return api.patch('/college/notifications/read-all');
  },

  // =========================================================================
  // Reports Operations (Authoritative Aggregations from app schema)
  // =========================================================================
  async getReportsOverview() {
    const res = await api.get('/college/reports/overview');
    return res.data || res;
  },
  async getReportsStudents() {
    const res = await api.get('/college/reports/students');
    return res.data || res;
  },
  async getReportsOccupancy() {
    const res = await api.get('/college/reports/occupancy');
    return res.data || res;
  },
  async getReportsAllocations() {
    const res = await api.get('/college/reports/allocations');
    return res.data || res;
  },
  async getReportsAttendance() {
    const res = await api.get('/college/reports/attendance');
    return res.data || res;
  },
  async getReportsLeave() {
    const res = await api.get('/college/reports/leave');
    return res.data || res;
  },
  async getReportsComplaints() {
    const res = await api.get('/college/reports/complaints');
    return res.data || res;
  },
  async getReportsMaintenance() {
    const res = await api.get('/college/reports/maintenance');
    return res.data || res;
  },
  async getReportsStaff() {
    const res = await api.get('/college/reports/staff');
    return res.data || res;
  },
};

export default adminService;
