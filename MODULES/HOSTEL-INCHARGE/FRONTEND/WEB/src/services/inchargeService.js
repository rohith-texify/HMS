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

  // 6. Leaves
  async getLeaves(params = {}) {
    const res = await api.get('/college/leaves', { params });
    const data = res.data || res;
    return Array.isArray(data) ? data : data?.leaves || data?.data || [];
  },

  async approveLeave(leaveId, payload = {}) {
    const res = await api.put(`/college/leaves/${leaveId}/approve`, payload);
    return res.data || res;
  },

  async rejectLeave(leaveId, payload = {}) {
    const res = await api.put(`/college/leaves/${leaveId}/reject`, payload);
    return res.data || res;
  },

  // 7. Complaints
  async getComplaints(params = {}) {
    const res = await api.get('/college/complaints', { params });
    const data = res.data || res;
    return Array.isArray(data) ? data : data?.complaints || data?.data || [];
  },

  async updateComplaintStatus(complaintId, payload) {
    const res = await api.put(`/college/complaints/${complaintId}/status`, payload);
    return res.data || res;
  },

  // 8. Maintenance
  async getMaintenance(params = {}) {
    const res = await api.get('/college/maintenance', { params });
    const data = res.data || res;
    return Array.isArray(data) ? data : data?.maintenance || data?.data || [];
  },

  async updateMaintenanceStatus(maintenanceId, payload) {
    const res = await api.put(`/college/maintenance/${maintenanceId}/status`, payload);
    return res.data || res;
  },

  // 9. Mess & Food
  async getMessTimings(hostelId) {
    const res = await api.get(`/college/hostels/${hostelId}/mess/timings`);
    const data = res.data || res;
    return Array.isArray(data) ? data : data?.timings || [];
  },

  async getMessMenus(hostelId) {
    const res = await api.get(`/college/hostels/${hostelId}/mess/menus`);
    const data = res.data || res;
    return Array.isArray(data) ? data : data?.menus || [];
  },

  // 10. Announcements & Notifications
  async getNotifications(params = {}) {
    const res = await api.get('/college/notifications', { params });
    const data = res.data || res;
    return Array.isArray(data) ? data : data?.notifications || data?.data || [];
  },

  async broadcastNotification(payload) {
    const res = await api.post('/college/notifications/broadcast', payload);
    return res.data || res;
  },

  // 11. Reports
  async getReport(reportType, params = {}) {
    const res = await api.get(`/college/reports/${reportType}`, { params });
    return res.data || res;
  },
};

export default inchargeService;
