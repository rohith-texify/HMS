import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createCollege } from '../services/collegeService';
import {
  fetchDistricts,
  fetchUrbanLocalBodies,
  fetchBlocks,
  fetchRuralHierarchy,
} from '../services/geoService';
import {
  getCanonicalDistricts,
  getCanonicalBlocks,
  getCanonicalULBs,
  getCanonicalCitiesForDistrict,
  getCanonicalLocalities,
} from '../constants/tamilNaduGeoData';
import {
  INDIAN_STATES,
  getCitiesForState,
  getAreasForCity,
} from '../constants/indiaLocations';

export default function CreateCollegePage() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    college_code: '',
    name: '',
    state: 'Tamil Nadu',
    state_code: '33',
    location_type: 'RURAL', // Hierarchy: State -> District -> City -> Area / Locality
    district_code: '',
    district_name: '',
    city_code: '',
    city_name: '',
    ward_code: '',
    ward_name: '',
    block_code: '',
    block_name: '',
    village_code: '',
    village_name: '',
    subdistrict_code: '',
    subdistrict_name: '',
    campus_locality: '',
    pincode: '',
    // Fallback fields for non-TN states
    city: '',
    area: '',
    custom_city: '',
    custom_area: '',
    timezone: 'Asia/Kolkata',
    contact_email: '',
    admin_email: '',
    password: '',
    confirm_password: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [copiedField, setCopiedField] = useState(null);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState(null);
  const [successCollege, setSuccessCollege] = useState(null);

  // Dynamic geo option lists with immediate canonical baseline (prevents empty dropdown flash)
  const [districts, setDistricts] = useState(() => getCanonicalDistricts());
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [districtError, setDistrictError] = useState(null);

  // Tamil Nadu unified Cities (Corporations, Municipalities, Towns, and Blocks) and Localities
  const [tnCities, setTnCities] = useState(() => (formData.district_code ? getCanonicalCitiesForDistrict(formData.district_code) : []));
  const [tnLocalities, setTnLocalities] = useState([]);

  const [urbanLocalBodies, setUrbanLocalBodies] = useState([]);
  const [loadingUlbs, setLoadingUlbs] = useState(false);
  const [ulbError, setUlbError] = useState(null);

  const [blocks, setBlocks] = useState([]);
  const [loadingBlocks, setLoadingBlocks] = useState(false);
  const [blockError, setBlockError] = useState(null);

  const [villages, setVillages] = useState([]);
  const [loadingVillages, setLoadingVillages] = useState(false);
  const [villageError, setVillageError] = useState(null);

  // Active request tracking to prevent stale asynchronous responses
  const activeReqRef = useRef({
    district: 0,
    ulb: 0,
    ward: 0,
    block: 0,
    village: 0,
  });

  // Non-TN fallback lists
  const availableCities = useMemo(() => {
    return getCitiesForState(formData.state);
  }, [formData.state]);

  const availableAreas = useMemo(() => {
    if (formData.city && formData.city !== 'OTHER') {
      return getAreasForCity(formData.state, formData.city);
    }
    return [];
  }, [formData.state, formData.city]);

  // Load districts when state is Tamil Nadu (state_code: '33')
  useEffect(() => {
    if (formData.state_code === '33') {
      let isSubscribed = true;
      setLoadingDistricts(true);
      setDistrictError(null);
      fetchDistricts()
        .then((data) => {
          if (isSubscribed) {
            setDistricts(data);
            setLoadingDistricts(false);
          }
        })
        .catch((err) => {
          if (isSubscribed) {
            setDistrictError(err.message || 'Failed to load districts');
            setLoadingDistricts(false);
          }
        });
      return () => {
        isSubscribed = false;
      };
    } else {
      setDistricts([]);
    }
  }, [formData.state_code]);

  // Synchronize Tamil Nadu cities and local bodies immediately on district change
  useEffect(() => {
    if (formData.state_code === '33' && formData.district_code) {
      const canonicalCities = getCanonicalCitiesForDistrict(formData.district_code);
      setTnCities(canonicalCities);

      const initialBlocks = getCanonicalBlocks(formData.district_code);
      if (initialBlocks.length > 0) setBlocks(initialBlocks);

      const initialUlbs = getCanonicalULBs(formData.district_code);
      if (initialUlbs.length > 0) setUrbanLocalBodies(initialUlbs);
    } else {
      setTnCities([]);
      setTnLocalities([]);
    }
  }, [formData.district_code, formData.state_code]);



  const generateStrongPassword = () => {
    const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lowercase = 'abcdefghijkmnopqrstuvwxyz';
    const numbers = '23456789';
    const symbols = '!@#$%^&*';
    const all = uppercase + lowercase + numbers + symbols;

    let pwd = '';
    pwd += uppercase[Math.floor(Math.random() * uppercase.length)];
    pwd += lowercase[Math.floor(Math.random() * lowercase.length)];
    pwd += numbers[Math.floor(Math.random() * numbers.length)];
    pwd += symbols[Math.floor(Math.random() * symbols.length)];

    for (let i = 4; i < 14; i++) {
      pwd += all[Math.floor(Math.random() * all.length)];
    }
    pwd = pwd.split('').sort(() => 0.5 - Math.random()).join('');

    setFormData((prev) => ({
      ...prev,
      password: pwd,
      confirm_password: pwd,
    }));
    setErrors((prev) => ({
      ...prev,
      password: null,
      confirm_password: null,
    }));
  };

  const validateField = (name, value) => {
    switch (name) {
      case 'college_code':
        if (!value.trim()) return 'College code is required';
        if (value.trim().length > 100) return 'College code cannot exceed 100 characters';
        if (!/^[A-Za-z0-9_-]+$/.test(value.trim())) {
          return 'College code must contain only letters, numbers, hyphens, and underscores (e.g. IITD, NITK)';
        }
        return null;
      case 'name':
        if (!value.trim()) return 'College name is required';
        if (value.trim().length > 200) return 'College name cannot exceed 200 characters';
        return null;
      case 'state':
        if (!value.trim()) return 'State / Union Territory is required';
        return null;
      case 'district_code':
        if (formData.state_code === '33' && !value) return 'District is required';
        return null;
      case 'city_code':
      case 'block_code':
        if (formData.state_code === '33' && !formData.city_code && !formData.block_code) {
          return 'City is required';
        }
        return null;
      case 'village_code':
        return null;
      case 'city':
        if (formData.state_code !== '33') {
          if (!value.trim()) return 'City is required';
          if (value === 'OTHER' && !formData.custom_city.trim()) {
            return 'Please specify the city name';
          }
        }
        return null;
      case 'contact_email':
        if (value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
          return 'Please enter a valid email address';
        }
        return null;
      case 'admin_email':
        if (value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
          return 'Please enter a valid administrator email address';
        }
        return null;
      case 'password':
        if (!value) return 'Administrator password is required for Admin module access';
        if (value.length < 8) return 'Password must be at least 8 characters long';
        if (value.length > 128) return 'Password cannot exceed 128 characters';
        return null;
      case 'confirm_password':
        if (!value) return 'Please confirm the administrator password';
        if (value !== formData.password) return 'Passwords do not match';
        return null;
      case 'pincode':
        if (value && value.length !== 6) return 'PIN Code must be 6 digits';
        return null;
      default:
        return null;
    }
  };

  const handleChange = (e) => {
    let { name, value } = e.target;
    if (name === 'college_code') {
      value = value.toUpperCase();
    }
    if (name === 'pincode') {
      value = value.replace(/\D/g, '').slice(0, 6);
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
    const errorMsg = validateField(name, value);
    setErrors((prev) => ({ ...prev, [name]: errorMsg }));
  };

  // State selection handler
  const handleStateChange = (e) => {
    const selectedState = e.target.value;
    const isTN = selectedState === 'Tamil Nadu';
    const stateCode = isTN ? '33' : '';

    setFormData((prev) => ({
      ...prev,
      state: selectedState,
      state_code: stateCode,
      district_code: '',
      district_name: '',
      city_code: '',
      city_name: '',
      ward_code: '',
      ward_name: '',
      block_code: '',
      block_name: '',
      village_code: '',
      village_name: '',
      subdistrict_code: '',
      subdistrict_name: '',
      campus_locality: '',
      city: '',
      area: '',
      custom_city: '',
      custom_area: '',
    }));

    setErrors((prev) => ({
      ...prev,
      state: selectedState ? null : 'State is required',
      district_code: null,
      city_code: null,
      ward_code: null,
      block_code: null,
      village_code: null,
      city: null,
    }));
  };

  // District selection handler
  const handleDistrictChange = (e) => {
    const code = e.target.value;
    const dObj = districts.find((d) => d.district_code === code);
    const dName = dObj ? dObj.district_name : '';

    // Immediately load unified cities and local bodies for this district
    const canonicalCities = getCanonicalCitiesForDistrict(code);
    setTnCities(canonicalCities);
    setTnLocalities([]);

    setFormData((prev) => ({
      ...prev,
      district_code: code,
      district_name: dName,
      city_code: '',
      city_name: '',
      ward_code: '',
      ward_name: '',
      block_code: '',
      block_name: '',
      village_code: '',
      village_name: '',
      subdistrict_code: '',
      subdistrict_name: '',
    }));

    setErrors((prev) => ({
      ...prev,
      district_code: code ? null : 'District is required',
      city_code: null,
      ward_code: null,
      block_code: null,
      village_code: null,
    }));
  };

  // Unified Tamil Nadu City selection handler (Handles both Urban Local Bodies and Blocks)
  const handleTnCityChange = (e) => {
    const rawVal = e.target.value;
    if (!rawVal) {
      setTnLocalities([]);
      setFormData((prev) => ({
        ...prev,
        city_code: '',
        city_name: '',
        block_code: '',
        block_name: '',
        village_code: '',
        village_name: '',
      }));
      setErrors((prev) => ({ ...prev, city_code: 'City is required' }));
      return;
    }

    const [type, code] = rawVal.split(':');
    const matched = tnCities.find((c) => c.code === code && c.type === type);
    const cName = matched ? matched.name : '';

    // Populate localities for this city immediately
    const localities = getCanonicalLocalities(code, cName);
    setTnLocalities(localities);

    if (type === 'URBAN') {
      setFormData((prev) => ({
        ...prev,
        location_type: 'URBAN',
        city_code: code,
        city_name: cName,
        block_code: '',
        block_name: '',
        village_code: `${code}01`,
        village_name: `${cName} - Main Campus`,
        campus_locality: prev.campus_locality || `${cName} - Main Campus`,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        location_type: 'RURAL',
        block_code: code,
        block_name: cName,
        city_code: '',
        city_name: '',
        village_code: `${code}01`,
        village_name: `${cName} - Campus Area`,
        campus_locality: prev.campus_locality || `${cName} - Campus Area`,
      }));
    }

    setErrors((prev) => ({
      ...prev,
      city_code: null,
      block_code: null,
      village_code: null,
    }));
  };

  // Unified Tamil Nadu Area / Locality selection handler
  const handleTnLocalityChange = (e) => {
    const code = e.target.value;
    const matched = tnLocalities.find((l) => l.code === code);
    const lName = matched ? matched.name : '';

    setFormData((prev) => ({
      ...prev,
      village_code: code,
      village_name: lName,
      campus_locality: lName || prev.campus_locality,
    }));

    setErrors((prev) => ({
      ...prev,
      village_code: null,
    }));
  };

  // Fallback handlers for Non-TN states
  const handleNonTNCityChange = (e) => {
    const selectedCity = e.target.value;
    setFormData((prev) => ({
      ...prev,
      city: selectedCity,
      area: '',
      custom_city: '',
      custom_area: '',
    }));
    setErrors((prev) => ({
      ...prev,
      city: selectedCity ? null : 'City is required',
      area: null,
    }));
  };

  const handleNonTNAreaChange = (e) => {
    const selectedArea = e.target.value;
    setFormData((prev) => ({
      ...prev,
      area: selectedArea,
      custom_area: '',
    }));
  };

  // Form submit handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError(null);

    const isTN = formData.state_code === '33';
    const formErrors = {};

    // Base validation
    ['college_code', 'name', 'contact_email', 'admin_email', 'password', 'confirm_password'].forEach((key) => {
      const err = validateField(key, formData[key]);
      if (err) formErrors[key] = err;
    });

    if (!formData.state.trim()) {
      formErrors.state = 'State / Union Territory is required';
    }

    if (isTN) {
      if (!formData.district_code) {
        formErrors.district_code = 'District is required';
      }
      if (!formData.city_code && !formData.block_code) {
        formErrors.city_code = 'City is required';
      }
    } else {
      if (!formData.city.trim()) {
        formErrors.city = 'City is required';
      } else if (formData.city === 'OTHER' && !formData.custom_city.trim()) {
        formErrors.city = 'Please specify the city name';
      }
    }

    if (formData.password && formData.confirm_password && formData.password !== formData.confirm_password) {
      formErrors.confirm_password = 'Passwords do not match';
    }

    if (submitting) {
      return;
    }

    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      return;
    }

    setSubmitting(true);
    setServerError(null);

    try {
      let resolvedDisplayCity = '';
      if (isTN) {
        resolvedDisplayCity = formData.city_name || formData.block_name || formData.village_name || 'Tamil Nadu';
      } else {
        const resolvedCity = formData.city === 'OTHER' ? formData.custom_city.trim() : formData.city.trim();
        const resolvedArea = formData.area === 'OTHER' ? formData.custom_area.trim() : formData.area.trim();
        resolvedDisplayCity = resolvedArea && resolvedCity ? `${resolvedArea}, ${resolvedCity}` : (resolvedArea || resolvedCity);
      }

      const payload = {
        college_code: formData.college_code.trim().toUpperCase(),
        name: formData.name.trim(),
        timezone: formData.timezone.trim() || 'Asia/Kolkata',
        state: isTN ? 'Tamil Nadu' : formData.state.trim(),
        city: resolvedDisplayCity.slice(0, 100),
      };

      if (isTN) {
        payload.location_type = formData.location_type || 'URBAN';
        payload.state_code = '33';
        payload.district_code = formData.district_code;

        if (formData.city_code) {
          payload.city_code = formData.city_code;
        }
        if (formData.block_code) {
          payload.block_code = formData.block_code;
        }
        if (formData.village_code) {
          payload.village_code = formData.village_code;
        }

        const effectiveLocality = formData.campus_locality.trim() || formData.village_name || '';
        if (effectiveLocality) {
          payload.campus_locality = formData.pincode.trim()
            ? `${effectiveLocality} - ${formData.pincode.trim()}`
            : effectiveLocality;
        } else if (formData.pincode.trim()) {
          payload.campus_locality = formData.pincode.trim();
        }
        if (formData.pincode.trim()) {
          payload.pincode = formData.pincode.trim();
        }
      } else {
        const nonTNLocality = (formData.area === 'OTHER' ? formData.custom_area : formData.area).trim();
        if (nonTNLocality) {
          payload.campus_locality = formData.pincode.trim()
            ? `${nonTNLocality} - ${formData.pincode.trim()}`
            : nonTNLocality;
        } else if (formData.pincode.trim()) {
          payload.campus_locality = formData.pincode.trim();
        }
        if (formData.pincode.trim()) {
          payload.pincode = formData.pincode.trim();
        }
      }

      if (formData.contact_email.trim()) payload.contact_email = formData.contact_email.trim();
      if (formData.admin_email.trim()) payload.admin_email = formData.admin_email.trim();
      if (formData.password.trim()) payload.password = formData.password.trim();

      const created = await createCollege(payload);
      const realCollegeId = created?.college_id || created?.id;
      if (!realCollegeId) {
        throw new Error('College created on server, but no valid persistent college ID was returned in the response.');
      }

      const effectiveAdminEmail =
        formData.admin_email.trim() ||
        formData.contact_email.trim() ||
        `${formData.college_code.trim().toLowerCase()}.admin@hms.local`;

      setSuccessCollege({
        ...created,
        college_id: realCollegeId,
        created_password: formData.password,
        created_admin_email: effectiveAdminEmail,
        location_summary: isTN
          ? formData.location_type === 'URBAN'
            ? `Tamil Nadu → ${formData.district_name} → ${formData.city_name}`
            : `Tamil Nadu → ${formData.district_name} → ${formData.block_name} → ${formData.village_name}${formData.subdistrict_name ? ` (${formData.subdistrict_name} Taluk)` : ''
            }`
          : `${formData.state} → ${resolvedDisplayCity}`,
        campus_locality_display: formData.campus_locality.trim() || 'Not specified',
      });
    } catch (err) {
      if (err.status === 409 || err.code === 'CONFLICT') {
        setServerError('Conflict: College code "' + formData.college_code.trim().toUpperCase() + '" already exists in the platform.');
      } else {
        setServerError(err.message || 'Failed to create college');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const isTamilNadu = formData.state_code === '33' || formData.state === 'Tamil Nadu';

  // Live checklist metrics for right sidebar
  const isCodeValid = Boolean(formData.college_code.trim().length >= 3);
  const isNameValid = Boolean(formData.name.trim().length >= 3);
  const isDistrictValid = Boolean(
    isTamilNadu ? formData.district_code : formData.state
  );
  const isLocationValid = Boolean(
    isTamilNadu
      ? (formData.city_code || formData.block_code)
      : (formData.city && (formData.city !== 'OTHER' || formData.custom_city))
  );
  const isPasswordValid = Boolean(
    formData.password && formData.password.length >= 8 && formData.password === formData.confirm_password
  );

  const checklistItems = [
    { label: 'College Tenant Identifier', valid: isCodeValid, detail: formData.college_code || 'e.g. IITD, NITK' },
    { label: 'Official Institution Name', valid: isNameValid, detail: formData.name || 'e.g. National Institute of Technology' },
    { label: 'State & District Mapping', valid: isDistrictValid, detail: isTamilNadu ? (formData.district_name || 'Select District') : (formData.state || 'Select State') },
    { label: 'City & Locality Hierarchy', valid: isLocationValid, detail: isTamilNadu ? ((formData.city_name || formData.block_name) ? `${formData.city_name || formData.block_name}${formData.village_name ? ` · ${formData.village_name}` : ''}` : 'Select City') : (formData.city || 'Select City') },
    { label: 'Admin Security Credentials', valid: isPasswordValid, detail: formData.password ? (formData.password.length >= 8 ? (formData.password === formData.confirm_password ? 'Password set & confirmed' : 'Passwords do not match') : 'Min 8 chars required') : 'Password required' },
  ];

  const completedChecklistCount = checklistItems.filter((item) => item.valid).length;

  return (
    <div className="page-container" style={{ maxWidth: '1440px', width: '100%', margin: '0 auto' }}>
      <style>{`
        @media (max-width: 860px) {
          .onboard-grid-wrapper {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
      {/* Header */}
      <div className="header-container">
        <div>
          <h1 className="page-title">Onboard New College</h1>
          <p className="page-subtitle">
            Register a new institution tenant and configure initial administrator credentials for the Admin module.
          </p>
        </div>

        <div className="quick-actions">
          <Link to="/colleges" className="btn btn-outline" id="btn-back-to-directory">
            ← College Directory
          </Link>
        </div>
      </div>

      {/* Success Banner & Generated Credentials */}
      {successCollege && (
        <div className="card" style={{ marginBottom: '24px', borderColor: 'var(--success-border)', backgroundColor: 'var(--success-bg)' }}>
          <div style={{ color: 'var(--success-text)', fontWeight: 'bold', fontSize: '1.2rem', marginBottom: '8px' }}>
            🎉 College Tenant & Administrator Account Created!
          </div>
          <p style={{ color: 'var(--success-text)', fontSize: '0.9rem', marginBottom: '16px' }}>
            <strong>{successCollege.name}</strong> ({successCollege.college_code}) has been created with status{' '}
            <span className="badge badge-warning">ONBOARDING</span>.
          </p>

          {/* Location Summary Card */}
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '14px 16px',
              marginBottom: '16px',
            }}
          >
            <div style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '0.9rem', marginBottom: '6px' }}>
              📍 Persisted Geographical Hierarchy & Campus Locality
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <strong>Hierarchy:</strong> {successCollege.location_summary}
            </div>
            {successCollege.campus_locality_display !== 'Not specified' && (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                <strong>Campus Locality:</strong> {successCollege.campus_locality_display}
              </div>
            )}
            {isTamilNadu && (
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '6px', fontFamily: 'monospace' }}>
                State Code: 33 | District Code: {formData.district_code || 'N/A'} |{' '}
                {formData.location_type === 'URBAN'
                  ? `ULB Code: ${formData.city_code}`
                  : `Block Code: ${formData.block_code} | Village Code: ${formData.village_code}`}
              </div>
            )}
          </div>

          {/* Credentials Display Card */}
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '20px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                🔑 College Administrator Module Access Credentials
              </div>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => {
                  const text = `HMS College Administrator Access\nCollege Name: ${successCollege.name}\nCollege ID / Code: ${successCollege.college_code}\nAdmin Email: ${successCollege.created_admin_email}\nPassword: ${successCollege.created_password}\nRole: COLLEGE_ADMIN`;
                  navigator.clipboard.writeText(text);
                  setCopiedField('all');
                  setTimeout(() => setCopiedField(null), 2500);
                }}
              >
                {copiedField === 'all' ? '✓ Copied All Credentials!' : '📋 Copy All Credentials'}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-primary)', borderRadius: '6px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>College ID / Tenant Code</div>
                <div style={{ fontFamily: 'monospace', fontWeight: '700', fontSize: '1rem', marginTop: '4px' }}>
                  {successCollege.college_code}
                </div>
              </div>

              <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-primary)', borderRadius: '6px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Admin Login Email / ID</div>
                <div style={{ fontFamily: 'monospace', fontWeight: '600', fontSize: '0.9rem', marginTop: '4px' }}>
                  {successCollege.created_admin_email}
                </div>
              </div>

              <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-primary)', borderRadius: '6px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Admin Password</div>
                <div style={{ fontFamily: 'monospace', fontWeight: '700', fontSize: '1rem', marginTop: '4px', color: 'var(--primary-color)' }}>
                  {successCollege.created_password}
                </div>
              </div>
            </div>

            <div style={{ marginTop: '12px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              ℹ️ The administrator can log in to the <strong>Admin Module</strong> using either the <strong>College Code ({successCollege.college_code})</strong> or the <strong>Admin Email ({successCollege.created_admin_email})</strong> with the password above.
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            {successCollege?.college_id ? (
              <>
                <button
                  className="btn btn-primary"
                  style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', color: '#fff', border: 'none', fontWeight: '600' }}
                  onClick={() => navigate(`/colleges/${successCollege.college_id}/onboarding`)}
                  id="btn-continue-onboarding"
                >
                  🚀 Continue to Onboarding Wizard →

                </button>
                <button
                  className="btn btn-outline"
                  onClick={() => navigate(`/colleges/${successCollege.college_id}`)}
                  id="btn-view-new-college"
                >
                  View College Profile & Manage
                </button>
              </>
            ) : (
              <div style={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: '500' }}>
                ⚠️ Navigation disabled: Missing verified persistent college ID.
              </div>
            )}
            <button
              className="btn btn-outline"
              onClick={() => {
                setSuccessCollege(null);
                setFormData({
                  college_code: '',
                  name: '',
                  state: 'Tamil Nadu',
                  state_code: '33',
                  location_type: 'RURAL',
                  district_code: '',
                  district_name: '',
                  city_code: '',
                  city_name: '',
                  ward_code: '',
                  ward_name: '',
                  block_code: '',
                  block_name: '',
                  village_code: '',
                  village_name: '',
                  subdistrict_code: '',
                  subdistrict_name: '',
                  campus_locality: '',
                  pincode: '',
                  city: '',
                  area: '',
                  custom_city: '',
                  custom_area: '',
                  timezone: 'Asia/Kolkata',
                  contact_email: '',
                  admin_email: '',
                  password: '',
                  confirm_password: '',
                });
              }}
            >
              Create Another College
            </button>
          </div>
        </div>
      )}

      {/* Main Creation Form and Live Overview Grid */}
      {!successCollege && (
        <div
          className="onboard-grid-wrapper"

          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.25fr) minmax(320px, 0.85fr)',
            gap: '24px',
            alignItems: 'start',
            width: '100%',
          }}
        >
          {/* Left Column: College Registration Form */}
          <div className="card" style={{ width: '100%', margin: 0, padding: '24px' }}>

            <div className="card-header">
              <div className="card-title">
                <span>Institution Identity Details</span>
              </div>
            </div>

            {serverError && (
              <div className="error-box" style={{ marginBottom: '20px', padding: '14px', textAlign: 'left' }}>
                <strong>Error:</strong> {serverError}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="field-college-code">
                  College Code <span className="required">*</span>
                </label>
                <input
                  id="field-college-code"
                  name="college_code"
                  type="text"
                  className="form-control"
                  placeholder="e.g. IITD, NITK, BITS-PIL, MIT-BLR"
                  value={formData.college_code}
                  onChange={handleChange}
                  disabled={submitting}
                  style={{ textTransform: 'uppercase', fontFamily: 'monospace', fontWeight: '600' }}
                />

                {errors.college_code && <div className="form-error">{errors.college_code}</div>}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="field-college-name">
                  College Name <span className="required">*</span>
                </label>
                <input
                  id="field-college-name"
                  name="name"
                  type="text"
                  className="form-control"
                  placeholder="e.g. National Institute of Technology Karnataka"
                  value={formData.name}
                  onChange={handleChange}
                  disabled={submitting}
                />

                {errors.name && <div className="form-error">{errors.name}</div>}
              </div>

              {/* Geographical Hierarchy Section Header with Urban / Rural Switcher for Tamil Nadu */}
              <div
                style={{
                  marginTop: '16px',
                  marginBottom: '10px',
                  paddingBottom: '8px',
                  borderBottom: '1px solid var(--border-color)',
                }}
              >
                <div style={{ fontWeight: '600', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                  📍 Geographical Location & Campus Address
                </div>
              </div>

              {/* Row 1: State & District (or City for non-TN) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="field-college-state">
                    1. State / Union Territory <span className="required">*</span>
                  </label>
                  <select
                    id="field-college-state"
                    name="state"
                    className="form-control"
                    value={formData.state}
                    onChange={handleStateChange}
                    disabled={submitting}
                  >
                    <option value="">Select State / UT</option>
                    {INDIAN_STATES.map((st) => (
                      <option key={st} value={st}>
                        {st} {st === 'Tamil Nadu' ? '(LGD Database Enabled)' : ''}
                      </option>
                    ))}
                  </select>
                  {errors.state && <div className="form-error">{errors.state}</div>}
                </div>

                {/* If Tamil Nadu, display searchable District dropdown */}
                {isTamilNadu ? (
                  <div className="form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <label className="form-label" htmlFor="field-college-district" style={{ marginBottom: 0 }}>
                        2. District <span className="required">*</span>
                      </label>
                      {loadingDistricts && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--primary-color)' }}>⏳ Loading...</span>
                      )}
                    </div>

                    <select
                      id="field-college-district"
                      name="district_code"
                      className="form-control"
                      value={formData.district_code}
                      onChange={handleDistrictChange}
                      disabled={submitting || loadingDistricts}
                    >
                      <option value="">{loadingDistricts ? 'Loading districts...' : 'Select District'}</option>
                      {districts.map((d) => (
                        <option key={d.district_code} value={d.district_code}>
                          {d.district_name}
                        </option>
                      ))}
                    </select>
                    {districtError && <div className="form-error">{districtError}</div>}
                    {errors.district_code && <div className="form-error">{errors.district_code}</div>}
                  </div>
                ) : (
                  /* Non-TN: Standard City selection */
                  <div className="form-group">
                    <label className="form-label" htmlFor="field-college-city">
                      2. City <span className="required">*</span>
                    </label>
                    <select
                      id="field-college-city"
                      name="city"
                      className="form-control"
                      value={formData.city}
                      onChange={handleNonTNCityChange}
                      disabled={submitting || !formData.state}
                    >
                      <option value="">{formData.state ? 'Select City' : '← Select State first'}</option>
                      {availableCities.map((ct) => (
                        <option key={ct} value={ct}>
                          {ct}
                        </option>
                      ))}
                      {formData.state && <option value="OTHER">+ Other / Specify City</option>}
                    </select>
                    {formData.city === 'OTHER' && (
                      <input
                        id="field-college-custom-city"
                        name="custom_city"
                        type="text"
                        className="form-control"
                        style={{ marginTop: '8px' }}
                        placeholder="Enter city name..."
                        value={formData.custom_city}
                        onChange={handleChange}
                        disabled={submitting}
                      />
                    )}
                    {errors.city && <div className="form-error">{errors.city}</div>}
                  </div>
                )}
              </div>

              {/* Row 2: Tamil Nadu Unified City & Area Selection */}
              {isTamilNadu && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  {/* 3. City Selection */}
                  <div className="form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <label className="form-label" htmlFor="field-college-city" style={{ marginBottom: 0 }}>
                        3. City <span className="required">*</span>
                      </label>
                      {formData.district_code && tnCities.length > 0 && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          {tnCities.length} locations
                        </span>
                      )}
                    </div>

                    <select
                      id="field-college-city"
                      name="city_selection"
                      className="form-control"
                      value={
                        formData.location_type === 'URBAN' && formData.city_code
                          ? `URBAN:${formData.city_code}`
                          : formData.location_type === 'RURAL' && formData.block_code
                            ? `RURAL:${formData.block_code}`
                            : ''
                      }
                      onChange={handleTnCityChange}
                      disabled={submitting || !formData.district_code}
                    >
                      <option value="">
                        {!formData.district_code ? '← Select District first' : 'Select City'}
                      </option>
                      {tnCities.map((c) => (
                        <option key={`${c.type}:${c.code}`} value={`${c.type}:${c.code}`}>
                          {c.name} ({c.category})
                        </option>
                      ))}
                    </select>
                    {errors.city_code && <div className="form-error">{errors.city_code}</div>}
                  </div>

                  {/* 4. Area / Locality Selection */}
                  <div className="form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <label className="form-label" htmlFor="field-college-area" style={{ marginBottom: 0 }}>
                        4. Area / Locality <span className="required">*</span>
                      </label>
                    </div>

                    <select
                      id="field-college-area"
                      name="village_code"
                      className="form-control"
                      value={formData.village_code}
                      onChange={handleTnLocalityChange}
                      disabled={submitting || (!formData.city_code && !formData.block_code)}
                    >
                      <option value="">
                        {!formData.city_code && !formData.block_code
                          ? '← Select City first'
                          : 'Select Area / Locality'}
                      </option>
                      {tnLocalities.map((l) => (
                        <option key={l.code} value={l.code}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                    {errors.village_code && <div className="form-error">{errors.village_code}</div>}
                  </div>
                </div>
              )}

              {/* Row 3: Campus Locality / Street Address & PIN Code */}
              {isTamilNadu ? (
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="field-college-campus-locality">
                      5. Campus Locality / Street Address
                    </label>
                    <input
                      id="field-college-campus-locality"
                      name="campus_locality"
                      type="text"
                      className="form-control"
                      value={formData.campus_locality}
                      onChange={handleChange}
                      disabled={submitting}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="field-college-pincode">
                      6. PIN Code
                    </label>
                    <input
                      id="field-college-pincode"
                      name="pincode"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      className="form-control"
                      value={formData.pincode}
                      onChange={handleChange}
                      disabled={submitting}
                    />
                    {errors.pincode && <div className="form-error">{errors.pincode}</div>}
                  </div>
                </div>
              ) : (
                /* Non-TN: Area / Campus Locality & PIN Code */
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="field-college-area">
                      3. Area / Campus Locality
                    </label>
                    <select
                      id="field-college-area"
                      name="area"
                      className="form-control"
                      value={formData.area}
                      onChange={handleNonTNAreaChange}
                      disabled={submitting || !formData.city}
                    >
                      <option value="">{formData.city ? 'Select Area / Campus Locality' : '← Select City first'}</option>
                      {availableAreas.map((ar) => (
                        <option key={ar} value={ar}>
                          {ar}
                        </option>
                      ))}
                      {formData.city && <option value="OTHER">+ Other / Custom Locality</option>}
                    </select>
                    {formData.area === 'OTHER' && (
                      <input
                        id="field-college-custom-area"
                        name="custom_area"
                        type="text"
                        className="form-control"
                        style={{ marginTop: '8px' }}
                        value={formData.custom_area}
                        onChange={handleChange}
                        disabled={submitting}
                      />
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="field-college-pincode">
                      4. PIN Code
                    </label>
                    <input
                      id="field-college-pincode"
                      name="pincode"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      className="form-control"
                      value={formData.pincode}
                      onChange={handleChange}
                      disabled={submitting}
                    />
                    {errors.pincode && <div className="form-error">{errors.pincode}</div>}
                  </div>
                </div>
              )}

              {/* Primary Contact Email */}
              <div className="form-group">
                <label className="form-label" htmlFor="field-college-email">
                  Primary Contact Email
                </label>
                <input
                  id="field-college-email"
                  name="contact_email"
                  type="email"
                  className="form-control"
                  placeholder="e.g. admin@college.edu.in"
                  value={formData.contact_email}
                  onChange={handleChange}
                  disabled={submitting}
                />

                {errors.contact_email && <div className="form-error">{errors.contact_email}</div>}
              </div>

              {/* College Administrator Account & Password Creation */}
              <div
                style={{
                  marginTop: '10px',
                  marginBottom: '20px',
                  padding: '16px',
                  backgroundColor: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                      🔐 College Administrator Credentials
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={generateStrongPassword}
                    disabled={submitting}
                    style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                  >
                    ⚡ Generate Password
                  </button>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="field-admin-email">
                    Administrator Login Email / Username
                  </label>
                  <input
                    id="field-admin-email"
                    name="admin_email"
                    type="email"
                    className="form-control"
                    placeholder={
                      formData.contact_email
                        ? formData.contact_email
                        : formData.college_code
                          ? `${formData.college_code.toLowerCase()}.admin@hms.local`
                          : 'admin@institution.edu.in'
                    }
                    value={formData.admin_email}
                    onChange={handleChange}
                    disabled={submitting}
                  />

                  {errors.admin_email && <div className="form-error">{errors.admin_email}</div>}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="field-password">
                      Admin Password <span className="required">*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        id="field-password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        className="form-control"
                        placeholder="Min. 8 characters"
                        value={formData.password}
                        onChange={handleChange}
                        disabled={submitting}
                        style={{ paddingRight: '42px' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                          position: 'absolute',
                          right: '8px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '0.9rem',
                          color: 'var(--text-secondary)',
                        }}
                        title={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? '🙈' : '👁️'}
                      </button>
                    </div>

                    {errors.password && <div className="form-error">{errors.password}</div>}
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="field-confirm-password">
                      Confirm Password <span className="required">*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        id="field-confirm-password"
                        name="confirm_password"
                        type={showConfirmPassword ? 'text' : 'password'}
                        className="form-control"
                        placeholder="Re-type password"
                        value={formData.confirm_password}
                        onChange={handleChange}
                        disabled={submitting}
                        style={{ paddingRight: '42px' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        style={{
                          position: 'absolute',
                          right: '8px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '0.9rem',
                          color: 'var(--text-secondary)',
                        }}
                        title={showConfirmPassword ? 'Hide password' : 'Show password'}
                      >
                        {showConfirmPassword ? '🙈' : '👁️'}
                      </button>
                    </div>
                    {errors.confirm_password && <div className="form-error">{errors.confirm_password}</div>}
                  </div>
                </div>
              </div>



              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <Link to="/colleges" className="btn btn-outline" disabled={submitting}>
                  Cancel
                </Link>
                <button
                  type="submit"
                  className="btn btn-primary"
                  id="btn-submit-create-college"
                  disabled={submitting}
                >
                  {submitting ? 'Creating College...' : 'Create College Tenant'}
                </button>
              </div>
            </form>
          </div>

          {/* Right Column: Live Tenant Preview & Verification Sidebar (fills right side blank space) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* 1. Live Tenant Identity Card */}
            <div className="card" style={{ padding: '24px', margin: 0, borderTop: '4px solid var(--primary-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>
                  Live Tenant Identity Preview
                </span>
                <span style={{
                  padding: '3px 8px',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  background: 'var(--info-bg)',
                  color: 'var(--info-text)',
                }}>
                  ONBOARDING
                </span>
              </div>

              {/* Tenant Code Badge & Name */}
              <div style={{ marginBottom: '16px', padding: '14px', background: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase' }}>
                  College Identifier
                </div>
                <div style={{
                  fontSize: '1.25rem',
                  fontWeight: '700',
                  fontFamily: 'monospace',
                  color: formData.college_code ? 'var(--text-primary)' : 'var(--text-muted)',
                  marginTop: '2px',
                  letterSpacing: '0.5px',
                }}>
                  {formData.college_code || 'CODE PENDING'}
                </div>
                <div style={{
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  color: formData.name ? 'var(--text-primary)' : 'var(--text-muted)',
                  marginTop: '6px',
                  lineHeight: '1.4',
                }}>
                  {formData.name || 'Institution display name will appear here...'}
                </div>
              </div>

              {/* Geographic Hierarchy Breadcrumb */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', marginBottom: '6px' }}>
                  📍 Geographical Hierarchy
                </div>
                <div style={{
                  padding: '12px',
                  background: 'var(--bg-primary)',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.85rem',
                  color: 'var(--text-primary)',
                  lineHeight: '1.6',
                }}>
                  <div>
                    <strong style={{ color: 'var(--text-secondary)' }}>State:</strong> {formData.state} {isTamilNadu ? '(TN · Code 33)' : ''}
                  </div>
                  {isTamilNadu ? (
                    <>
                      <div style={{ marginTop: '4px' }}>
                        <strong style={{ color: 'var(--text-secondary)' }}>District:</strong>{' '}
                        {formData.district_name || <span style={{ color: 'var(--text-muted)' }}>Select District...</span>}
                      </div>
                      <div style={{ marginTop: '4px' }}>
                        <strong style={{ color: 'var(--text-secondary)' }}>City:</strong>{' '}
                        {(formData.city_name || formData.block_name) || (
                          <span style={{ color: 'var(--text-muted)' }}>Select City...</span>
                        )}
                      </div>
                      <div style={{ marginTop: '4px' }}>
                        <strong style={{ color: 'var(--text-secondary)' }}>Area / Locality:</strong>{' '}
                        {(formData.village_name || formData.campus_locality) || (
                          <span style={{ color: 'var(--text-muted)' }}>Select Area...</span>
                        )}
                      </div>
                      {formData.pincode && (
                        <div style={{ marginTop: '4px' }}>
                          <strong style={{ color: 'var(--text-secondary)' }}>PIN Code:</strong> {formData.pincode}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div style={{ marginTop: '4px' }}>
                        <strong style={{ color: 'var(--text-secondary)' }}>City:</strong>{' '}
                        {formData.city === 'OTHER' ? (formData.custom_city || 'Custom City') : (formData.city || 'Select City...')}
                      </div>
                      <div style={{ marginTop: '4px' }}>
                        <strong style={{ color: 'var(--text-secondary)' }}>Area:</strong>{' '}
                        {formData.area === 'OTHER' ? (formData.custom_area || 'Custom Area') : (formData.area || 'Select Area...')}
                      </div>
                      {formData.pincode && (
                        <div style={{ marginTop: '4px' }}>
                          <strong style={{ color: 'var(--text-secondary)' }}>PIN Code:</strong> {formData.pincode}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Administrator Account Preview */}
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', marginBottom: '6px' }}>
                  👤 Primary Administrator
                </div>
                <div style={{
                  padding: '12px',
                  background: 'var(--bg-primary)',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.85rem',
                  color: 'var(--text-primary)',
                }}>
                  <div>
                    <strong style={{ color: 'var(--text-secondary)' }}>Login:</strong>{' '}
                    <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                      {formData.admin_email || (formData.contact_email ? formData.contact_email : formData.college_code ? `${formData.college_code.toLowerCase()}.admin@hms.local` : 'admin@institution.edu')}
                    </span>
                  </div>
                  <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong style={{ color: 'var(--text-secondary)' }}>Password:</strong>
                    {formData.password ? (
                      formData.password.length >= 8 && formData.password === formData.confirm_password ? (
                        <span style={{ color: 'var(--success-text)', fontSize: '0.8rem', fontWeight: '600' }}>✓ Configured & Confirmed</span>
                      ) : formData.password !== formData.confirm_password ? (
                        <span style={{ color: 'var(--danger-text)', fontSize: '0.8rem', fontWeight: '600' }}>⚠️ Passwords do not match</span>
                      ) : (
                        <span style={{ color: 'var(--warning-text)', fontSize: '0.8rem', fontWeight: '600' }}>⚠️ Min. 8 characters</span>
                      )
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Not set</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Onboarding Readiness Checklist Card */}
            <div className="card" style={{ padding: '24px', margin: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '0.88rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                  📋 Onboarding Readiness Checklist
                </span>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  background: completedChecklistCount === 5 ? 'var(--success-bg)' : 'var(--warning-bg)',
                  color: completedChecklistCount === 5 ? 'var(--success-text)' : 'var(--warning-text)',
                }}>
                  {completedChecklistCount} of 5 Ready
                </span>
              </div>

              {/* Progress Bar */}
              <div style={{ height: '6px', background: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden', marginBottom: '16px' }}>
                <div style={{
                  height: '100%',
                  width: `${(completedChecklistCount / 5) * 100}%`,
                  background: completedChecklistCount === 5 ? '#10b981' : '#3b82f6',
                  transition: 'width 0.3s ease',
                }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {checklistItems.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.85rem' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      background: item.valid ? 'var(--success-bg)' : 'var(--bg-primary)',
                      color: item.valid ? 'var(--success-text)' : 'var(--text-muted)',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      flexShrink: 0,
                      marginTop: '1px',
                    }}>
                      {item.valid ? '✓' : '○'}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: item.valid ? '600' : '500', color: item.valid ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                        {item.label}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.detail}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. LGD Geographical Directory Info Card */}
            <div className="card" style={{ padding: '20px', margin: 0, background: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '1.1rem' }}>🏛️</span>
                <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                  Tamil Nadu LGD Directory
                </span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.45' }}>
                The HMS platform is synchronized with the official Tamil Nadu Local Government Directory across all 38 districts, 388 development blocks, and 649 urban local bodies for authoritative tenant physical structure management.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
