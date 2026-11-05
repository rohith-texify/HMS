import api from './api';

/**
 * Hostel In-Charge Dedicated Operational API Service
 * Backed exclusively by verified endpoints in API/internal/server/router.go.
 */
export const inchargeService = {
  // 1. In-Charge Assigned Scope
  async getMyHostel() {
    const res = await api.get('/college/incharges/my-hostel');
    return res.data || res;
  },

  async getHostelResidents(hostelId) {
    const params = hostelId ? { hostel_id: hostelId } : {};
    const res = await api.get('/college/incharges/my-hostel/residents', { params });
    const data = res.data || res;
    return Array.isArray(data) ? data : data?.data || [];
  },

  async getVacantBeds(hostelId) {
    const params = hostelId ? { hostel_id: hostelId } : {};
    const res = await api.get('/college/incharges/my-hostel/vacant-beds', { params });
    const data = res.data || res;
    return Array.isArray(data) ? data : data?.data || [];
  },

  async getUnallocatedStudents() {
    const res = await api.get('/college/incharges/unallocated-students');
    const data = res.data || res;
    return Array.isArray(data) ? data : data?.data || [];
  },

  // 2. Student Records & Accommodation Profiles
  async getStudents(params = {}) {
    try {
      // Prioritize assigned hostel residents when scoped
      const residents = await this.getHostelResidents(params?.hostel_id);
      if (Array.isArray(residents) && residents.length > 0) {
        return residents;
      }
    } catch {
      // Fall through to general college students endpoint
    }

    try {
      const res = await api.get('/college/students', { params });
      const data = res.data || res;
      return Array.isArray(data) ? data : data?.students || data?.data || [];
    } catch {
      return [];
    }
  },

  async getStudentDetails(studentId) {
    const res = await api.get(`/college/students/${studentId}`);
    return res.data || res;
  },

  async getStudentParents(studentId) {
    const res = await api.get(`/college/students/${studentId}/parents`);
    const data = res.data || res;
    return Array.isArray(data) ? data : data?.parents || [];
  },

  async getStudentEmergencyContacts(studentId) {
    const res = await api.get(`/college/students/${studentId}/emergency-contacts`);
    const data = res.data || res;
    return Array.isArray(data) ? data : data?.emergency_contacts || [];
  },

  // 3. Hostel & Room Structure Hierarchy
  async getHostel(hostelId) {
    const res = await api.get(`/college/hostels/${hostelId}`);
    return res.data || res;
  },

  async getBlocks(hostelId) {
    const res = await api.get(`/college/hostels/${hostelId}/blocks`);
    const data = res.data || res;
    return Array.isArray(data) ? data : data?.blocks || [];
  },

  async getFloors(hostelId, blockId) {
    const res = await api.get(`/college/hostels/${hostelId}/blocks/${blockId}/floors`);
    const data = res.data || res;
    return Array.isArray(data) ? data : data?.floors || [];
  },

  async getRooms(hostelId, blockId, floorId) {
    const res = await api.get(
      `/college/hostels/${hostelId}/blocks/${blockId}/floors/${floorId}/rooms`
    );
    const data = res.data || res;
    return Array.isArray(data) ? data : data?.rooms || [];
  },

  async getBeds(hostelId, blockId, floorId, roomId) {
    const res = await api.get(
      `/college/hostels/${hostelId}/blocks/${blockId}/floors/${floorId}/rooms/${roomId}/beds`
    );
    const data = res.data || res;
    return Array.isArray(data) ? data : data?.beds || [];
  },

  async getRoom(hostelId, blockId, floorId, roomId) {
    const res = await api.get(
      `/college/hostels/${hostelId}/blocks/${blockId}/floors/${floorId}/rooms/${roomId}`
    );
    return res.data || res;
  },

  async updateBlockStatus(hostelId, blockId, status) {
    const res = await api.patch(
      `/college/hostels/${hostelId}/blocks/${blockId}/status`,
      { status }
    );
    return res.data || res;
  },

  async updateFloorStatus(hostelId, blockId, floorId, status) {
    const res = await api.patch(
      `/college/hostels/${hostelId}/blocks/${blockId}/floors/${floorId}/status`,
      { status }
    );
    return res.data || res;
  },

  async updateRoomStatus(hostelId, blockId, floorId, roomId, status) {
    const res = await api.patch(
      `/college/hostels/${hostelId}/blocks/${blockId}/floors/${floorId}/rooms/${roomId}/status`,
      { status }
    );
    return res.data || res;
  },

  async updateBedStatus(hostelId, blockId, floorId, roomId, bedId, status) {
    const res = await api.patch(
      `/college/hostels/${hostelId}/blocks/${blockId}/floors/${floorId}/rooms/${roomId}/beds/${bedId}/status`,
      { status }
    );
    return res.data || res;
  },

  // 4. Bed Allocations & Movement
  async getBedAllocations(params = {}) {
    const res = await api.get('/college/bed-allocations', { params });
    const data = res.data || res;
    return Array.isArray(data) ? data : data?.data || data?.allocations || [];
  },

  async getCurrentBedAllocation(studentId) {
    const res = await api.get('/college/bed-allocations/current', {
      params: { student_id: studentId },
    });
    return res.data || res;
  },

  async getBedAllocationById(id) {
    const res = await api.get(`/college/bed-allocations/${id}`);
    return res.data || res;
  },

  async createBedAllocation(payload) {
    const res = await api.post('/college/bed-allocations', payload);
    return res.data || res;
  },

  async updateBedAllocation(id, payload) {
    const res = await api.put(`/college/bed-allocations/${id}`, payload);
    return res.data || res;
  },

  async releaseBedAllocation(id, payload) {
    const res = await api.patch(`/college/bed-allocations/${id}/release`, payload);
    return res.data || res;
  },

  async transferBedAllocation(id, payload) {
    const res = await api.patch(`/college/bed-allocations/${id}/transfer`, payload);
    return res.data || res;
  },

  // Backwards compatibility aliases
  async getAllocations(params = {}) {
    return this.getBedAllocations(params);
  },

  async allocateBed(payload) {
    return this.createBedAllocation(payload);
  },

  async vacateBed(allocationId, payload = {}) {
    const releasePayload = {
      released_at: payload.released_at || new Date().toISOString(),
      status: payload.status || 'RELEASED',
    };
    return this.releaseBedAllocation(allocationId, releasePayload);
  },

  // 5. Daily Attendance & Curfew Operations
  async getStudentAttendanceList(params = {}) {
    const res = await api.get('/college/attendance/students', { params });
    const data = res.data || res;
    return Array.isArray(data) ? data : data?.data || data?.records || [];
  },

  async getStudentAttendanceById(recordId) {
    const res = await api.get(`/college/attendance/students/${recordId}`);
    return res.data || res;
  },

  async getAttendanceSummary(params = {}) {
    const res = await api.get('/college/attendance/reports/summary', { params });
    const data = res.data || res;
    return data?.data || data;
  },

  async markStudentAttendance(payload) {
    const res = await api.post('/college/attendance/students', payload);
    return res.data || res;
  },

  async bulkMarkStudentAttendance(payload) {
    const res = await api.post('/college/attendance/students/bulk', payload);
    return res.data || res;
  },

  async submitAttendanceCorrection(payload) {
    const res = await api.post('/college/attendance/corrections', payload);
    return res.data || res;
  },

  async approveAttendanceCorrection(correctionId, payload) {
    const res = await api.patch(
      `/college/attendance/corrections/${correctionId}/decision`,
      payload
    );
    return res.data || res;
  },

  // Backwards compatibility aliases
  async getAttendance(params = {}) {
    return this.getStudentAttendanceList(params);
  },

  async markAttendance(payload) {
    return this.markStudentAttendance(payload);
  },

  async correctAttendance(payload) {
    return this.submitAttendanceCorrection(payload);
  },

  // 6. Leaves & Gate Pass Coordination
  async getLeaves(params = {}) {
    const res = await api.get('/college/leaves', { params });
    const data = res.data || res;
    return Array.isArray(data) ? data : data?.leaves || data?.data || [];
  },

  async getLeaveRequests(params = {}) {
    return this.getLeaves(params);
  },

  async getLeaveRequestById(leaveId) {
    const res = await api.get(`/college/leaves/${leaveId}`);
    const data = res.data || res;
    return data?.data || data;
  },

  async getLeaveSummary() {
    const res = await api.get('/college/leaves/reports/summary');
    const data = res.data || res;
    return data?.data || data;
  },

  async processLeaveDecision(leaveId, payload) {
    // API endpoint: POST /college/leaves/:leave_id/decision
    const res = await api.post(`/college/leaves/${leaveId}/decision`, payload);
    return res.data || res;
  },

  async cancelLeaveRequest(leaveId) {
    // API endpoint: POST /college/leaves/:leave_id/cancel
    const res = await api.post(`/college/leaves/${leaveId}/cancel`);
    return res.data || res;
  },

  async createLeaveRequest(payload) {
    // API endpoint: POST /college/leaves
    const res = await api.post('/college/leaves', payload);
    return res.data || res;
  },

  async approveLeave(leaveId, payload = {}) {
    return this.processLeaveDecision(leaveId, {
      decision: 'APPROVED',
      remarks: payload.remarks || payload.reason || 'Approved by Hostel In-Charge',
    });
  },

  async rejectLeave(leaveId, payload = {}) {
    return this.processLeaveDecision(leaveId, {
      decision: 'REJECTED',
      remarks: payload.remarks || payload.reason || 'Rejected by Hostel In-Charge',
    });
  },

  // Campus Gates & Security Coordination (Read-only for In-Charge)
  async getGates() {
    const res = await api.get('/college/gates');
    const data = res.data || res;
    return Array.isArray(data) ? data : data?.gates || data?.data || [];
  },

  async getSecurityAssignments() {
    const res = await api.get('/college/security-assignments');
    const data = res.data || res;
    return Array.isArray(data) ? data : data?.assignments || data?.data || [];
  },

  async getStaff() {
    const res = await api.get('/college/staff');
    const data = res.data || res;
    return Array.isArray(data) ? data : data?.staff || data?.data || [];
  },

  // 7. Complaints Operations
  async getComplaints(params = {}) {
    const res = await api.get('/college/complaints', { params });
    const data = res.data || res;
    return Array.isArray(data) ? data : data?.complaints || data?.data || [];
  },

  async getComplaintById(complaintId) {
    const res = await api.get(`/college/complaints/${complaintId}`);
    const data = res.data || res;
    return data?.data || data;
  },

  async getComplaintSummary() {
    const res = await api.get('/college/complaints/reports/summary');
    const data = res.data || res;
    return Array.isArray(data) ? data : data?.data || [];
  },

  async createComplaint(payload) {
    const res = await api.post('/college/complaints', payload);
    return res.data || res;
  },

  async updateComplaintStatus(complaintId, payload) {
    // API endpoint: PATCH /college/complaints/:complaint_id/status
    const res = await api.patch(`/college/complaints/${complaintId}/status`, payload);
    return res.data || res;
  },

  async assignComplaint(complaintId, payload) {
    // API endpoint: PATCH /college/complaints/:complaint_id/assign
    const res = await api.patch(`/college/complaints/${complaintId}/assign`, payload);
    return res.data || res;
  },

  async resolveComplaint(complaintId, payload) {
    // API endpoint: PATCH /college/complaints/:complaint_id/resolve
    const res = await api.patch(`/college/complaints/${complaintId}/resolve`, payload);
    return res.data || res;
  },

  async getComplaintUpdates(complaintId) {
    // API endpoint: GET /college/complaints/:complaint_id/updates
    const res = await api.get(`/college/complaints/${complaintId}/updates`);
    const data = res.data || res;
    return Array.isArray(data) ? data : data?.updates || data?.data || [];
  },

  // 8. Maintenance Operations
  async getMaintenance(params = {}) {
    const res = await api.get('/college/maintenance', { params });
    const data = res.data || res;
    return Array.isArray(data) ? data : data?.maintenance || data?.data || [];
  },

  async getMaintenanceById(maintenanceId) {
    const res = await api.get(`/college/maintenance/${maintenanceId}`);
    const data = res.data || res;
    return data?.data || data;
  },

  async createMaintenance(payload) {
    // API endpoint: POST /college/maintenance
    const res = await api.post('/college/maintenance', payload);
    return res.data || res;
  },

  async resolveMaintenance(maintenanceId, payload) {
    // API endpoint: PATCH /college/maintenance/:maintenance_id/resolve
    const res = await api.patch(`/college/maintenance/${maintenanceId}/resolve`, payload);
    return res.data || res;
  },

  // Backwards compatibility alias
  async updateMaintenanceStatus(maintenanceId, payload) {
    return this.resolveMaintenance(maintenanceId, payload);
  },

  // 9. Mess & Food Operations
  async getMessTimings(hostelId) {
    const res = await api.get(`/college/hostels/${hostelId}/mess/timings`);
    const data = res.data || res;
    return Array.isArray(data) ? data : data?.timings || data?.data || [];
  },

  async createMealTiming(hostelId, payload) {
    const res = await api.post(`/college/hostels/${hostelId}/mess/timings`, payload);
    return res.data || res;
  },

  async getMessMenus(hostelId) {
    const res = await api.get(`/college/hostels/${hostelId}/mess/menus`);
    const data = res.data || res;
    return Array.isArray(data) ? data : data?.menus || data?.data || [];
  },

  async createMealMenu(hostelId, payload) {
    const res = await api.post(`/college/hostels/${hostelId}/mess/menus`, payload);
    return res.data || res;
  },

  async getTodayMenus() {
    const res = await api.get('/college/mess/today');
    const data = res.data || res;
    return Array.isArray(data) ? data : data?.data || [];
  },

  async createFoodFeedback(payload) {
    const res = await api.post('/college/mess/feedback', payload);
    return res.data || res;
  },

  // 10. Announcements & Notifications
  async getNotifications(params = {}) {
    const res = await api.get('/college/notifications', { params });
    const data = res.data || res;
    return Array.isArray(data) ? data : data?.notifications || data?.data || [];
  },

  async getUnreadNotificationCount() {
    const res = await api.get('/college/notifications/unread-count');
    const data = res.data || res;
    return typeof data?.count === 'number' ? data.count : data?.data?.count || 0;
  },

  async createNotification(payload) {
    const res = await api.post('/college/notifications', payload);
    return res.data || res;
  },

  async broadcastNotification(payload) {
    return this.createNotification(payload);
  },

  async markNotificationRead(notificationId) {
    const res = await api.patch(`/college/notifications/${notificationId}/read`);
    return res.data || res;
  },

  async markAllNotificationsRead() {
    const res = await api.patch('/college/notifications/read-all');
    return res.data || res;
  },

  // 11. Reports & Analytical Summaries (Authoritative Aggregations from /college/reports/*)
  async getReport(reportType, params = {}) {
    const res = await api.get(`/college/reports/${reportType}`, { params });
    return res.data || res;
  },

  async getReportsOverview() {
    const res = await api.get('/college/reports/overview');
    return res.data || res;
  },

  async getReportsOccupancy() {
    const res = await api.get('/college/reports/occupancy');
    return res.data || res;
  },

  async getReportsStudents() {
    const res = await api.get('/college/reports/students');
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

  async getDashboardSummary() {
    const res = await api.get('/college/admin/dashboard/summary');
    return res.data || res;
  },
};

export default inchargeService;
