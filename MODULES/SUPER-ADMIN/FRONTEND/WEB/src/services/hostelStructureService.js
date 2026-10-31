import api from './api';

const BASE_PATH = (collegeId) => `/super-admin/colleges/${collegeId}/hostel-structure`;

/**
 * Fetch aggregate structure overview and verified occupancy metrics.
 */
export async function fetchStructureOverview(collegeId, signal) {
  try {
    const res = await api.get(`${BASE_PATH(collegeId)}/overview`, { signal, timeout: 5000 });
    return res.data;
  } catch (err) {
    return { hostels_count: 0, blocks_count: 0, floors_count: 0, rooms_count: 0, total_beds: 0, occupied_beds: 0 };
  }
}

/**
 * Fetch full hostel structure hierarchy (Hostels -> Blocks -> Floors -> Rooms -> Beds).
 */
export async function fetchStructureTree(collegeId, hostelId = null, signal) {
  const url = hostelId
    ? `${BASE_PATH(collegeId)}/tree?hostel_id=${hostelId}`
    : `${BASE_PATH(collegeId)}/tree`;
  try {
    const res = await api.get(url, { signal, timeout: 5000 });
    return res.data;
  } catch (err) {
    return { hostels: [] };
  }
}

// --- Hostel CRUD ---

export async function createHostel(collegeId, data) {
  const res = await api.post(`${BASE_PATH(collegeId)}/hostels`, data);
  return res.data;
}

export async function updateHostel(collegeId, hostelId, data) {
  const res = await api.put(`${BASE_PATH(collegeId)}/hostels/${hostelId}`, data);
  return res.data;
}

export async function deleteHostel(collegeId, hostelId) {
  const res = await api.delete(`${BASE_PATH(collegeId)}/hostels/${hostelId}`);
  return res.data;
}

// --- Block CRUD ---

export async function createBlock(collegeId, data) {
  const res = await api.post(`${BASE_PATH(collegeId)}/blocks`, data);
  return res.data;
}

export async function updateBlock(collegeId, blockId, data) {
  const res = await api.put(`${BASE_PATH(collegeId)}/blocks/${blockId}`, data);
  return res.data;
}

export async function deleteBlock(collegeId, blockId) {
  const res = await api.delete(`${BASE_PATH(collegeId)}/blocks/${blockId}`);
  return res.data;
}

// --- Floor CRUD ---

export async function createFloor(collegeId, data) {
  const res = await api.post(`${BASE_PATH(collegeId)}/floors`, data);
  return res.data;
}

export async function updateFloor(collegeId, floorId, data) {
  const res = await api.put(`${BASE_PATH(collegeId)}/floors/${floorId}`, data);
  return res.data;
}

export async function deleteFloor(collegeId, floorId) {
  const res = await api.delete(`${BASE_PATH(collegeId)}/floors/${floorId}`);
  return res.data;
}

// --- Room CRUD ---

export async function createRoom(collegeId, data) {
  const res = await api.post(`${BASE_PATH(collegeId)}/rooms`, data);
  return res.data;
}

export async function updateRoom(collegeId, roomId, data) {
  const res = await api.put(`${BASE_PATH(collegeId)}/rooms/${roomId}`, data);
  return res.data;
}

export async function deleteRoom(collegeId, roomId) {
  const res = await api.delete(`${BASE_PATH(collegeId)}/rooms/${roomId}`);
  return res.data;
}

// --- Bed CRUD ---

export async function createBed(collegeId, data) {
  const res = await api.post(`${BASE_PATH(collegeId)}/beds`, data);
  return res.data;
}

export async function updateBed(collegeId, bedId, data) {
  const res = await api.put(`${BASE_PATH(collegeId)}/beds/${bedId}`, data);
  return res.data;
}

export async function deleteBed(collegeId, bedId) {
  const res = await api.delete(`${BASE_PATH(collegeId)}/beds/${bedId}`);
  return res.data;
}

// --- Bulk Generation ---

export async function previewBulkGeneration(collegeId, data) {
  const res = await api.post(`${BASE_PATH(collegeId)}/bulk/preview`, data);
  return res.data;
}

export async function generateBulkStructure(collegeId, data) {
  const res = await api.post(`${BASE_PATH(collegeId)}/bulk/generate`, data);
  return res.data;
}

// --- CSV Import ---

export function getCSVTemplateURL(collegeId) {
  return `${BASE_PATH(collegeId)}/csv/template`;
}

export async function downloadCSVTemplate(collegeId) {
  const res = await api.get(`${BASE_PATH(collegeId)}/csv/template`, {
    responseType: 'blob',
  });
  return res;
}

export async function previewCSV(collegeId, file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post(`${BASE_PATH(collegeId)}/csv/preview`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function importCSV(collegeId, file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post(`${BASE_PATH(collegeId)}/csv/import`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

// --- Structure Cloning ---

export async function previewClone(collegeId, data) {
  const res = await api.post(`${BASE_PATH(collegeId)}/clone/preview`, data);
  return res.data;
}

export async function applyClone(collegeId, data) {
  const res = await api.post(`${BASE_PATH(collegeId)}/clone/apply`, data);
  return res.data;
}

// --- Policy & Locking ---

export async function fetchStructurePolicy(collegeId, signal) {
  const res = await api.get(`${BASE_PATH(collegeId)}/policy`, { signal });
  return res.data;
}

export async function updateStructurePolicy(collegeId, data) {
  const res = await api.put(`${BASE_PATH(collegeId)}/policy`, data);
  return res.data;
}

export async function toggleStructureLock(collegeId, data) {
  const res = await api.post(`${BASE_PATH(collegeId)}/lock`, data);
  return res.data;
}

export async function fetchStructureAudits(collegeId, limit = 30, signal) {
  const res = await api.get(`${BASE_PATH(collegeId)}/audit?limit=${limit}`, { signal });
  return res.data;
}
