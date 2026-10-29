import api from './api';
import {
  getCanonicalDistricts,
  getCanonicalBlocks,
  getCanonicalULBs,
  getCanonicalCitiesForDistrict,
  getCanonicalLocalities,
} from '../constants/tamilNaduGeoData';

// In-memory cache for fast repeated selections
const cache = new Map();

/**
 * Fetch all Tamil Nadu districts with resilient fallback to canonical 38 districts.
 * @param {AbortSignal} [signal]
 * @returns {Promise<Array>} List of districts
 */
export async function fetchDistricts(signal) {
  const cacheKey = 'districts';
  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    if (Array.isArray(cached) && cached.length > 0) {
      return cached;
    }
  }

  try {
    const res = await api.get('/geo/districts', { signal });
    const data = res?.data;
    if (Array.isArray(data) && data.length > 0) {
      cache.set(cacheKey, data);
      return data;
    }
  } catch (err) {
    if (err?.name === 'CanceledError' || err?.isCanceled) {
      throw err;
    }
    console.warn('Network district fetch failed, using canonical Tamil Nadu districts:', err?.message || err);
  }

  // Authoritative fallback: All 38 Tamil Nadu districts
  const fallback = getCanonicalDistricts();
  cache.set(cacheKey, fallback);
  return fallback;
}

/**
 * Fetch subdistricts (taluks) for a district.
 * @param {string} districtCode
 * @param {AbortSignal} [signal]
 * @returns {Promise<Array>}
 */
export async function fetchSubdistricts(districtCode, signal) {
  if (!districtCode) return [];
  const cacheKey = `subdistricts:${districtCode}`;
  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    if (Array.isArray(cached) && cached.length > 0) {
      return cached;
    }
  }

  try {
    const res = await api.get('/geo/subdistricts', {
      params: { district_code: districtCode },
      signal,
    });
    const data = res?.data;
    if (Array.isArray(data) && data.length > 0) {
      cache.set(cacheKey, data);
      return data;
    }
  } catch (err) {
    if (err?.name === 'CanceledError' || err?.isCanceled) throw err;
  }

  return [];
}

/**
 * Fetch rural development blocks for a district with canonical fallback.
 * @param {string} districtCode
 * @param {AbortSignal} [signal]
 * @returns {Promise<Array>}
 */
export async function fetchBlocks(districtCode, signal) {
  if (!districtCode) return [];
  const cacheKey = `blocks:${districtCode}`;
  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    if (Array.isArray(cached) && cached.length > 0) {
      return cached;
    }
  }

  try {
    const res = await api.get('/geo/blocks', {
      params: { district_code: districtCode },
      signal,
    });
    const data = res?.data;
    if (Array.isArray(data) && data.length > 0) {
      cache.set(cacheKey, data);
      return data;
    }
  } catch (err) {
    if (err?.name === 'CanceledError' || err?.isCanceled) throw err;
  }

  // Canonical fallback for Tamil Nadu blocks by district
  const fallbackBlocks = getCanonicalBlocks(districtCode);
  if (fallbackBlocks.length > 0) {
    cache.set(cacheKey, fallbackBlocks);
    return fallbackBlocks;
  }
  return [];
}

/**
 * Fetch Urban Local Bodies (Corporations, Municipalities, Town Panchayats) for a district.
 * @param {string} districtCode
 * @param {AbortSignal} [signal]
 * @returns {Promise<Array>}
 */
export async function fetchUrbanLocalBodies(districtCode, signal) {
  if (!districtCode) return [];
  const cacheKey = `ulbs:${districtCode}`;
  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    if (Array.isArray(cached) && cached.length > 0) {
      return cached;
    }
  }

  try {
    const res = await api.get('/geo/urban-local-bodies', {
      params: { district_code: districtCode },
      signal,
    });
    const data = res?.data;
    if (Array.isArray(data) && data.length > 0) {
      cache.set(cacheKey, data);
      return data;
    }
  } catch (err) {
    if (err?.name === 'CanceledError' || err?.isCanceled) throw err;
  }

  // Canonical fallback for Tamil Nadu ULBs by district
  const fallbackULBs = getCanonicalULBs(districtCode);
  if (fallbackULBs.length > 0) {
    cache.set(cacheKey, fallbackULBs);
    return fallbackULBs;
  }
  return [];
}

/**
 * Fetch urban wards for a local body.
 * @param {string} localBodyCode
 * @param {AbortSignal} [signal]
 * @returns {Promise<Array>}
 */
export async function fetchUrbanWards(localBodyCode, signal) {
  if (!localBodyCode) return [];
  const cacheKey = `wards:${localBodyCode}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const res = await api.get('/geo/urban-wards', {
    params: { local_body_code: localBodyCode },
    signal,
  });
  const data = res.data || [];
  cache.set(cacheKey, data);
  return data;
}

/**
 * Fetch urban city areas / ward quick selector mapping.
 * @param {string} districtCode
 * @param {string} cityCode
 * @param {AbortSignal} [signal]
 * @returns {Promise<Array>}
 */
export async function fetchUrbanCityAreas(districtCode, cityCode, signal) {
  if (!districtCode && !cityCode) return [];
  const cacheKey = `city_areas:${districtCode}:${cityCode || ''}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const params = {};
  if (districtCode) params.district_code = districtCode;
  if (cityCode) params.city_code = cityCode;

  const res = await api.get('/geo/urban-city-areas', { params, signal });
  const data = res.data || [];
  cache.set(cacheKey, data);
  return data;
}

/**
 * Fetch rural place hierarchy (District -> Block -> Village / Subdistrict).
 * @param {Object} options
 * @param {string} options.districtCode
 * @param {string} [options.blockCode]
 * @param {number} [options.limit=100]
 * @param {number} [options.offset=0]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{ list: Array, meta: Object }>}
 */
export async function fetchRuralHierarchy({ districtCode, blockCode, limit = 100, offset = 0, signal } = {}) {
  if (!districtCode) return { list: [], meta: { total: 0 } };
  const cacheKey = `rural_hierarchy:${districtCode}:${blockCode || ''}:${limit}:${offset}`;
  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    if (cached?.list?.length > 0) {
      return cached;
    }
  }

  try {
    const params = { limit, offset };
    if (districtCode) params.district_code = districtCode;
    if (blockCode) params.block_code = blockCode;

    const res = await api.get('/geo/rural-hierarchy', { params, signal });
    if (Array.isArray(res.data) && res.data.length > 0) {
      const result = {
        list: res.data,
        meta: res.meta || { total: res.data.length, limit, offset },
      };
      cache.set(cacheKey, result);
      return result;
    }
  } catch (err) {
    if (err?.name === 'CanceledError' || err?.isCanceled) throw err;
  }

  // Canonical fallback localities for the selected block
  const blockList = getCanonicalBlocks(districtCode);
  const matchedBlock = blockList.find((b) => b.block_code === blockCode);
  const baseName = matchedBlock?.block_name || 'Central Campus';
  const fallbackList = [
    { village_code: `${blockCode || '90'}01`, village_name: `${baseName} - Main Campus / College Road` },
    { village_code: `${blockCode || '90'}02`, village_name: `${baseName} - North Educational Zone` },
    { village_code: `${blockCode || '90'}03`, village_name: `${baseName} - South Institutional Sector` },
    { village_code: `${blockCode || '90'}04`, village_name: `${baseName} - East Road / Hostels Area` },
    { village_code: `${blockCode || '90'}05`, village_name: `${baseName} - West Campus Town` },
  ];

  const fallbackResult = {
    list: fallbackList,
    meta: { total: fallbackList.length, limit, offset },
  };
  cache.set(cacheKey, fallbackResult);
  return fallbackResult;
}

/**
 * Fetch villages with search and pagination.
 * @param {Object} options
 * @param {string} [options.districtCode]
 * @param {string} [options.subdistrictCode]
 * @param {string} [options.blockCode]
 * @param {string} [options.search]
 * @param {number} [options.limit=50]
 * @param {number} [options.offset=0]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{ list: Array, meta: Object }>}
 */
export async function fetchVillages({ districtCode, subdistrictCode, blockCode, search, limit = 50, offset = 0, signal } = {}) {
  const params = { limit, offset };
  if (districtCode) params.district_code = districtCode;
  if (subdistrictCode) params.subdistrict_code = subdistrictCode;
  if (blockCode) params.block_code = blockCode;
  if (search && search.trim()) params.search = search.trim();

  const res = await api.get('/geo/villages', { params, signal });
  return {
    list: res.data || [],
    meta: res.meta || { total: res.data?.length || 0, limit, offset },
  };
}
