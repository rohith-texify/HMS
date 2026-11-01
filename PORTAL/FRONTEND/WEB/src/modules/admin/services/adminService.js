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
  async getBlockById(hostelId, blockId) {
    const res = await api.get(`/college/hostels/${hostelId}/blocks/${blockId}`);
    return res.data || res;
  },
  async createBlock(hostelId, payload) {
    return api.post(`/college/hostels/${hostelId}/blocks`, payload);
  },
  async updateBlock(hostelId, blockId, payload) {
    return api.put(`/college/hostels/${hostelId}/blocks/${blockId}`, payload);
  },
  async updateBlockStatus(hostelId, blockId, status) {
    return api.patch(`/college/hostels/${hostelId}/blocks/${blockId}/status`, { status });
  },

  // Floors
  async getFloors(hostelId, blockId) {
    const res = await api.get(`/college/hostels/${hostelId}/blocks/${blockId}/floors`);
    return res.data || res;
  },
  async getFloorById(hostelId, blockId, floorId) {
    const res = await api.get(`/college/hostels/${hostelId}/blocks/${blockId}/floors/${floorId}`);
    return res.data || res;
  },
  async createFloor(hostelId, blockId, payload) {
    return api.post(`/college/hostels/${hostelId}/blocks/${blockId}/floors`, payload);
  },
  async updateFloor(hostelId, blockId, floorId, payload) {
    return api.put(`/college/hostels/${hostelId}/blocks/${blockId}/floors/${floorId}`, payload);
  },
  async updateFloorStatus(hostelId, blockId, floorId, status) {
    return api.patch(`/college/hostels/${hostelId}/blocks/${blockId}/floors/${floorId}/status`, { status });
  },

  // Rooms
  async getRooms(hostelId, blockId, floorId) {
    const res = await api.get(`/college/hostels/${hostelId}/blocks/${blockId}/floors/${floorId}/rooms`);
    return res.data || res;
  },
  async getRoomById(hostelId, blockId, floorId, roomId) {
    const res = await api.get(`/college/hostels/${hostelId}/blocks/${blockId}/floors/${floorId}/rooms/${roomId}`);
    return res.data || res;
  },
  async createRoom(hostelId, blockId, floorId, payload) {
    return api.post(`/college/hostels/${hostelId}/blocks/${blockId}/floors/${floorId}/rooms`, payload);
  },
  async updateRoom(hostelId, blockId, floorId, roomId, payload) {
    return api.put(`/college/hostels/${hostelId}/blocks/${blockId}/floors/${floorId}/rooms/${roomId}`, payload);
  },
  async updateRoomStatus(hostelId, blockId, floorId, roomId, status) {
    return api.patch(`/college/hostels/${hostelId}/blocks/${blockId}/floors/${floorId}/rooms/${roomId}/status`, { status });
  },

  // Beds
  async getBeds(hostelId, blockId, floorId, roomId) {
    const res = await api.get(`/college/hostels/${hostelId}/blocks/${blockId}/floors/${floorId}/rooms/${roomId}/beds`);
    return res.data || res;
  },
  async getBedById(hostelId, blockId, floorId, roomId, bedId) {
    const res = await api.get(`/college/hostels/${hostelId}/blocks/${blockId}/floors/${floorId}/rooms/${roomId}/beds/${bedId}`);
    return res.data || res;
  },
  async createBed(hostelId, blockId, floorId, roomId, payload) {
    return api.post(`/college/hostels/${hostelId}/blocks/${blockId}/floors/${floorId}/rooms/${roomId}/beds`, payload);
  },
  async updateBed(hostelId, blockId, floorId, roomId, bedId, payload) {
    return api.put(`/college/hostels/${hostelId}/blocks/${blockId}/floors/${floorId}/rooms/${roomId}/beds/${bedId}`, payload);
  },
  async updateBedStatus(hostelId, blockId, floorId, roomId, bedId, status) {
    return api.patch(`/college/hostels/${hostelId}/blocks/${blockId}/floors/${floorId}/rooms/${roomId}/beds/${bedId}/status`, { status });
  },

  // Bed Allocations & Occupancy
  async getBedAllocations(params = {}) {
    const res = await api.get('/college/bed-allocations', { params });
    return res.data || res;
  },
  async getCurrentBedAllocations() {
    const res = await api.get('/college/bed-allocations/current');
    return res.data || res;
  },
  async getBedAllocationById(id) {
    const res = await api.get(`/college/bed-allocations/${id}`);
    return res.data || res;
  },
  async createBedAllocation(payload) {
    return api.post('/college/bed-allocations', payload);
  },
  async updateBedAllocation(id, payload) {
    return api.put(`/college/bed-allocations/${id}`, payload);
  },
  async releaseBedAllocation(id, payload) {
    return api.patch(`/college/bed-allocations/${id}/release`, payload);
  },
  async transferBedAllocation(id, payload) {
    return api.patch(`/college/bed-allocations/${id}/transfer`, payload);
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

  // Parents Directory & Management
  async getParents(params = {}) {
    const res = await api.get('/college/parents', { params });
    return res.data || res;
  },
  async getParentById(id) {
    const res = await api.get(`/college/parents/${id}`);
    return res.data || res;
  },
  async createParent(payload) {
    return api.post('/college/parents', payload);
  },
  async updateParent(id, payload) {
    return api.put(`/college/parents/${id}`, payload);
  },

  // Student Parents (Relationships & Linking)
  async getStudentParents(studentId) {
    const res = await api.get(`/college/students/${studentId}/parents`);
    return res.data || res;
  },
  async linkStudentParent(studentId, payload) {
    return api.post(`/college/students/${studentId}/parents`, payload);
  },
  async getStudentParent(studentId, relationshipId) {
    const res = await api.get(`/college/students/${studentId}/parents/${relationshipId}`);
    return res.data || res;
  },
  async updateStudentParent(studentId, relationshipId, payload) {
    return api.put(`/college/students/${studentId}/parents/${relationshipId}`, payload);
  },
  async unlinkStudentParent(studentId, relationshipId) {
    return api.delete(`/college/students/${studentId}/parents/${relationshipId}`);
  },

  // Student Emergency Contacts
  async getEmergencyContacts(studentId) {
    const res = await api.get(`/college/students/${studentId}/emergency-contacts`);
    return res.data || res;
  },
  async createEmergencyContact(studentId, payload) {
    return api.post(`/college/students/${studentId}/emergency-contacts`, payload);
  },
  async updateEmergencyContact(studentId, contactId, payload) {
    return api.put(`/college/students/${studentId}/emergency-contacts/${contactId}`, payload);
  },
  async deleteEmergencyContact(studentId, contactId) {
    return api.delete(`/college/students/${studentId}/emergency-contacts/${contactId}`);
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

  // Hostel Incharges
  async getInchargeAssignments(hostelId) {
    const res = await api.get(`/college/hostels/${hostelId}/incharges`);
    return res.data || res;
  },
  async getInchargeAssignmentById(hostelId, assignmentId) {
    const res = await api.get(`/college/hostels/${hostelId}/incharges/${assignmentId}`);
    return res.data || res;
  },
  async createInchargeAssignment(hostelId, payload) {
    return api.post(`/college/hostels/${hostelId}/incharges`, payload);
  },
  async updateInchargeAssignment(hostelId, assignmentId, payload) {
    return api.put(`/college/hostels/${hostelId}/incharges/${assignmentId}`, payload);
  },
  async deleteInchargeAssignment(hostelId, assignmentId) {
    return api.delete(`/college/hostels/${hostelId}/incharges/${assignmentId}`);
  },

  // Security Gates & Assignments
  async getGates() {
    const res = await api.get('/college/gates');
    return res.data || res;
  },
  async getGateById(gateId) {
    const res = await api.get(`/college/gates/${gateId}`);
    return res.data || res;
  },
  async createGate(payload) {
    return api.post('/college/gates', payload);
  },
  async updateGate(gateId, payload) {
    return api.put(`/college/gates/${gateId}`, payload);
  },
  async updateGateStatus(gateId, status) {
    return api.patch(`/college/gates/${gateId}/status`, { status });
  },
  async getSecurityAssignments() {
    const res = await api.get('/college/security-assignments');
    return res.data || res;
  },
  async getSecurityAssignmentById(assignmentId) {
    const res = await api.get(`/college/security-assignments/${assignmentId}`);
    return res.data || res;
  },
  async createSecurityAssignment(payload) {
    return api.post('/college/security-assignments', payload);
  },
  async updateSecurityAssignment(assignmentId, payload) {
    return api.put(`/college/security-assignments/${assignmentId}`, payload);
  },
  async deleteSecurityAssignment(assignmentId) {
    return api.delete(`/college/security-assignments/${assignmentId}`);
  },

  // Account & Password Management (Audit & Recovery)
  async resetStaffPassword(staffId, payload) {
    return api.post(`/college/staff/${staffId}/reset-password`, payload);
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
  async getStudentAttendanceById(recordId) {
    const res = await api.get(`/college/attendance/students/${recordId}`);
    return res.data || res;
  },
  async markStudentAttendance(payload) {
    return api.post('/college/attendance/students', payload);
  },
  async bulkMarkStudentAttendance(payload) {
    return api.post('/college/attendance/students/bulk', payload);
  },
  async submitAttendanceCorrection(payload) {
    return api.post('/college/attendance/corrections', payload);
  },
  async approveAttendanceCorrection(correctionId, payload) {
    return api.patch(`/college/attendance/corrections/${correctionId}/decision`, payload);
  },

  // Leaves
  async getLeaveRequests(params = {}) {
    const res = await api.get('/college/leaves', { params });
    return res.data || res;
  },
  async getLeaveRequestById(leaveId) {
    const res = await api.get(`/college/leaves/${leaveId}`);
    return res.data || res;
  },
  async getLeaveSummary() {
    const res = await api.get('/college/leaves/reports/summary');
    return res.data || res;
  },
  async createLeaveRequest(payload) {
    return api.post('/college/leaves', payload);
  },
  async processLeaveDecision(leaveId, payload) {
    return api.post(`/college/leaves/${leaveId}/decision`, payload);
  },
  async cancelLeaveRequest(leaveId) {
    return api.post(`/college/leaves/${leaveId}/cancel`);
  },

  // Complaints Operations
  async getComplaints(params = {}) {
    const res = await api.get('/college/complaints', { params });
    return res.data || res;
  },
  async getComplaintById(complaintId) {
    const res = await api.get(`/college/complaints/${complaintId}`);
    return res.data || res;
  },
  async getComplaintSummary() {
    const res = await api.get('/college/complaints/reports/summary');
    return res.data || res;
  },
  async createComplaint(payload) {
    return api.post('/college/complaints', payload);
  },
  async updateComplaintStatus(complaintId, payload) {
    return api.patch(`/college/complaints/${complaintId}/status`, payload);
  },
  async assignComplaint(complaintId, payload) {
    return api.patch(`/college/complaints/${complaintId}/assign`, payload);
  },
  async resolveComplaint(complaintId, payload) {
    return api.patch(`/college/complaints/${complaintId}/resolve`, payload);
  },
  async getComplaintUpdates(complaintId) {
    const res = await api.get(`/college/complaints/${complaintId}/updates`);
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
