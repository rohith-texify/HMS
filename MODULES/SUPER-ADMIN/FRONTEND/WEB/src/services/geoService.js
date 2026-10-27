import api from './api';

// In-memory cache for fast repeated selections
const cache = new Map();

/**
 * Fetch all Tamil Nadu districts.
 * @param {AbortSignal} [signal]
 * @returns {Promise<Array>} List of districts
 */
export async function fetchDistricts(signal) {
  const cacheKey = 'districts';
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const res = await api.get('/geo/districts', { signal });
  const data = res.data || [];
  cache.set(cacheKey, data);
  return data;
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
    return cache.get(cacheKey);
  }

  const res = await api.get('/geo/subdistricts', {
    params: { district_code: districtCode },
    signal,
  });
  const data = res.data || [];
  cache.set(cacheKey, data);
  return data;
}

/**
 * Fetch rural development blocks for a district.
 * @param {string} districtCode
 * @param {AbortSignal} [signal]
 * @returns {Promise<Array>}
 */
export async function fetchBlocks(districtCode, signal) {
  if (!districtCode) return [];
  const cacheKey = `blocks:${districtCode}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const res = await api.get('/geo/blocks', {
    params: { district_code: districtCode },
    signal,
  });
  const data = res.data || [];
  cache.set(cacheKey, data);
  return data;
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
    return cache.get(cacheKey);
  }

  const res = await api.get('/geo/urban-local-bodies', {
    params: { district_code: districtCode },
    signal,
  });
  const data = res.data || [];
  cache.set(cacheKey, data);
  return data;
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
    return cache.get(cacheKey);
  }

  const params = { limit, offset };
  if (districtCode) params.district_code = districtCode;
  if (blockCode) params.block_code = blockCode;

  const res = await api.get('/geo/rural-hierarchy', { params, signal });
  const result = {
    list: res.data || [],
    meta: res.meta || { total: res.data?.length || 0, limit, offset },
  };
  cache.set(cacheKey, result);
  return result;
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
