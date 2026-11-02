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
import {
  Building2,
  Upload,
  Trash2,
  Link2,
  Image as ImageIcon,
  Sparkles,
  MapPin,
  Rocket,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Eye,
  EyeOff,
  Copy,
  Check,
  Key,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Layers,
  Lock,
  RotateCw,
  FileCheck,
  ArrowRight,
  ExternalLink,
  Users,
} from 'lucide-react';

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
  const [logoInputMode, setLogoInputMode] = useState('upload'); // 'upload' or 'url'
  const fileInputRef = useRef(null);

  const handleLogoFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setServerError('Please upload a valid image file (PNG, JPG, SVG, WebP)');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setServerError('Logo file size must be less than 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setFormData((prev) => ({ ...prev, logo_url: String(reader.result || '') }));
      setServerError(null);
    };
    reader.readAsDataURL(file);
  };

  // Dynamic geo option lists with immediate canonical baseline
  const [districts, setDistricts] = useState(() => getCanonicalDistricts());
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [districtError, setDistrictError] = useState(null);

  // Tamil Nadu unified Cities (Corporations, Municipalities, Towns, and Blocks) derived deterministically
  const tnCities = useMemo(() => {
    if (formData.state_code === '33' && formData.district_code) {
      return getCanonicalCitiesForDistrict(String(formData.district_code));
    }
    return [];
  }, [formData.state_code, formData.district_code]);

  // Campus Localities derived deterministically from chosen city / block
  const tnLocalities = useMemo(() => {
    const code = formData.city_code || formData.block_code;
    const name = formData.city_name || formData.block_name;
    if (code) {
      return getCanonicalLocalities(code, name);
    }
    return [];
  }, [formData.city_code, formData.block_code, formData.city_name, formData.block_name]);

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
        if (formData.state_code === '33' && !value) return 'District is required for Tamil Nadu';
        return null;
      case 'city_code':
        if (formData.state_code === '33' && !value && !formData.block_code) {
          return 'City / Town / Block is required';
        }
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
    const code = String(e.target.value);
    const dObj = districts.find((d) => String(d.district_code) === code);
    const dName = dObj ? dObj.district_name : '';

    const available = code ? getCanonicalCitiesForDistrict(code) : [];
    const defaultCity = available.find(
      (c) => c.name.toLowerCase() === dName.toLowerCase()
    ) || available[0];

    setFormData((prev) => {
      const next = {
        ...prev,
        district_code: code,
        district_name: dName,
        city_code: '',
        city_name: '',
        block_code: '',
        block_name: '',
        village_code: '',
        village_name: '',
        campus_locality: '',
      };

      if (defaultCity) {
        if (defaultCity.type === 'URBAN') {
          next.location_type = 'URBAN';
          next.city_code = defaultCity.code;
          next.city_name = defaultCity.name;
        } else {
          next.location_type = 'RURAL';
          next.block_code = defaultCity.code;
          next.block_name = defaultCity.name;
        }
      }
      return next;
    });

    setErrors((prev) => ({
      ...prev,
      district_code: code ? null : 'District is required',
      city_code: null,
      village_code: null,
    }));
  };

  // Tamil Nadu unified city change handler
  const handleTnCityChange = (e) => {
    const rawVal = e.target.value;
    if (!rawVal) {
      setFormData((prev) => ({
        ...prev,
        city_code: '',
        city_name: '',
        block_code: '',
        block_name: '',
        village_code: '',
        village_name: '',
        campus_locality: '',
      }));
      return;
    }

    const [type, code] = rawVal.split(':');
    const cityObj = tnCities.find((c) => c.type === type && c.code === code);
    const cityName = cityObj ? cityObj.name : '';

    const defaultLocs = code ? getCanonicalLocalities(code, cityName) : [];
    const defaultLoc = defaultLocs[0];

    setFormData((prev) => ({
      ...prev,
      location_type: type,
      city_code: type === 'URBAN' ? code : '',
      city_name: type === 'URBAN' ? cityName : '',
      block_code: type === 'RURAL' ? code : '',
      block_name: type === 'RURAL' ? cityName : '',
      village_code: defaultLoc ? defaultLoc.code : '',
      village_name: defaultLoc ? defaultLoc.name : '',
      campus_locality: defaultLoc ? defaultLoc.name : '',
    }));

    setErrors((prev) => ({
      ...prev,
      city_code: null,
      village_code: null,
    }));
  };

  // Tamil Nadu locality change handler
  const handleTnLocalityChange = (e) => {
    const code = e.target.value;
    const locObj = tnLocalities.find((l) => l.code === code);
    const locName = locObj ? locObj.name : '';

    setFormData((prev) => ({
      ...prev,
      village_code: code,
      village_name: locName,
      campus_locality: locName,
    }));

    setErrors((prev) => ({
      ...prev,
      village_code: null,
    }));
  };

  // Non-TN handlers
  const handleNonTNCityChange = (e) => {
    const val = e.target.value;
    setFormData((prev) => ({
      ...prev,
      city: val,
      area: '',
      custom_city: '',
      custom_area: '',
    }));
    setErrors((prev) => ({ ...prev, city: val ? null : 'City is required' }));
  };

  const handleNonTNAreaChange = (e) => {
    const val = e.target.value;
    setFormData((prev) => ({
      ...prev,
      area: val,
      custom_area: '',
    }));
  };

  // Form submit handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError(null);

    const isTN = formData.state_code === '33';
    const formErrors = {};

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

      if (formData.contact_email.trim()) {
        payload.contact_email = formData.contact_email.trim();
      }

      const effectiveAdminEmail =
        formData.admin_email.trim() ||
        formData.contact_email.trim() ||
        `${formData.college_code.trim().toLowerCase()}.admin@hms.local`;

      payload.admin_email = effectiveAdminEmail;
      payload.password = formData.password;

      const createdCollege = await createCollege(payload);
      const effectiveCollegeId = createdCollege?.college_id || createdCollege?.id;

      let locationHierarchyDisplay = '';
      if (isTN) {
        const parts = ['Tamil Nadu'];
        if (formData.district_name) parts.push(formData.district_name);
        if (formData.city_name || formData.block_name) parts.push(formData.city_name || formData.block_name);
        if (formData.village_name) parts.push(formData.village_name);
        locationHierarchyDisplay = parts.join(' → ');
      } else {
        locationHierarchyDisplay = `${formData.state} → ${resolvedDisplayCity}`;
      }

      setSuccessCollege({
        ...createdCollege,
        college_id: effectiveCollegeId,
        id: effectiveCollegeId,
        college_code: createdCollege.college_code || payload.college_code,
        name: createdCollege.name || payload.name,
        logo_url: createdCollege?.logo_url || payload.logo_url,
        created_admin_email: effectiveAdminEmail,
        created_password: formData.password,
        location_summary: locationHierarchyDisplay,
        campus_locality_display: payload.campus_locality || 'Not specified',
      });
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message || 'Failed to create college tenant';
      setServerError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const isTamilNadu = formData.state_code === '33';
  const isCodeValid = Boolean(formData.college_code.trim().length >= 2 && !errors.college_code);
  const isNameValid = Boolean(formData.name.trim().length >= 3);
  const isDistrictValid = Boolean(isTamilNadu ? formData.district_code : formData.state);
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
    { label: 'Admin Security Credentials', valid: isPasswordValid, detail: formData.password ? (formData.password.length >= 8 ? (formData.password === formData.confirm_password ? 'Password configured & confirmed' : 'Passwords do not match') : 'Min 8 chars required') : 'Password required' },
  ];

  const completedChecklistCount = checklistItems.filter((item) => item.valid).length;
  const collegeInitials = (formData.college_code || 'CO').slice(0, 2).toUpperCase();

  return (
    <div className="create-college-container fade-in-up">
      {/* 1. Hero Header */}
      <div className="create-hero-header">
        <div className="create-hero-left">
          <div className="create-hero-icon-wrap">
            <Building2 size={24} />
          </div>
          <div className="create-hero-text">
            <div className="create-hero-breadcrumbs">
              <Link to="/dashboard">Dashboard</Link>
              <ChevronRight size={13} />
              <Link to="/colleges">Colleges</Link>
              <ChevronRight size={13} />
              <span style={{ color: '#0f172a', fontWeight: 600 }}>Register Institution</span>
            </div>
            <h1 className="create-hero-title">Onboard New College Tenant</h1>
            <p className="create-hero-subtitle">
              Register a participating institution, map authoritative geographical hierarchy, and provision root administrator access.
            </p>
          </div>
        </div>

        <div className="create-hero-actions">
          <Link
            to="/colleges"
            className="btn-enterprise btn-outline-soft"
            id="btn-back-to-directory"
          >
            <ChevronLeft size={14} />
            <span>College Directory</span>
          </Link>
        </div>
      </div>

      {/* 2. Top 4 KPI Metrics */}
      <div className="create-kpi-grid">
        <div className="create-stat-card">
          <div className="create-stat-header">
            <span className="create-stat-label">Geographical Hierarchy</span>
            <div className="create-stat-icon-box blue">
              <MapPin size={16} />
            </div>
          </div>
          <div className="create-stat-value">
            {isTamilNadu ? 'Tamil Nadu LGD' : 'National Scope'}
          </div>
          <div className="create-stat-sub">
            {isTamilNadu ? '38 Districts · 388 Blocks · 649 ULBs' : 'Standard India Location Database'}
          </div>
          <div className="create-stat-accent-bar blue" />
        </div>

        <div className="create-stat-card">
          <div className="create-stat-header">
            <span className="create-stat-label">Onboarding Readiness</span>
            <div className="create-stat-icon-box emerald">
              <FileCheck size={16} />
            </div>
          </div>
          <div className="create-stat-value" style={{ color: completedChecklistCount === 5 ? '#059669' : '#0f172a' }}>
            {completedChecklistCount} of 5 Ready
          </div>
          <div className="create-stat-sub">
            {completedChecklistCount === 5 ? 'All mandatory tenant criteria satisfied' : 'Prerequisites checklist pending'}
          </div>
          <div className="create-stat-accent-bar emerald" />
        </div>

        <div className="create-stat-card">
          <div className="create-stat-header">
            <span className="create-stat-label">Root Administrator Role</span>
            <div className="create-stat-icon-box indigo">
              <Key size={16} />
            </div>
          </div>
          <div className="create-stat-value">COLLEGE_ADMIN</div>
          <div className="create-stat-sub">Four-eyes governance & audit chained</div>
          <div className="create-stat-accent-bar indigo" />
        </div>

        <div className="create-stat-card">
          <div className="create-stat-header">
            <span className="create-stat-label">Tenant Isolation Policy</span>
            <div className="create-stat-icon-box amber">
              <ShieldCheck size={16} />
            </div>
          </div>
          <div className="create-stat-value">Schema Isolated</div>
          <div className="create-stat-sub">Zero cross-tenant data leakage guaranteed</div>
          <div className="create-stat-accent-bar amber" />
        </div>
      </div>

      {/* 3. Success Banner & Generated Credentials */}
      {successCollege && (
        <div className="create-success-banner">
          <div className="create-success-header">
            <div className="create-success-icon">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#065f46' }}>
                College Tenant &amp; Administrator Account Created Successfully!
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: '#047857' }}>
                <strong>{successCollege.name}</strong> ({successCollege.college_code}) has been provisioned with status{' '}
                <span className="badge-enterprise badge-amber">ONBOARDING</span>.
              </p>
            </div>
          </div>

          {/* Location Summary Tile */}
          <div className="create-tree-box" style={{ background: '#f0fdf4', borderColor: '#bbf7d0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: '#166534', fontSize: '0.86rem' }}>
              <MapPin size={15} style={{ color: '#059669' }} />
              <span>Persisted Geographical Hierarchy &amp; Campus Locality</span>
            </div>
            <div style={{ fontSize: '0.82rem', color: '#15803d' }}>
              <strong>Hierarchy:</strong> {successCollege.location_summary}
            </div>
            {successCollege.campus_locality_display !== 'Not specified' && (
              <div style={{ fontSize: '0.82rem', color: '#15803d' }}>
                <strong>Campus Locality:</strong> {successCollege.campus_locality_display}
              </div>
            )}
          </div>

          {/* Credentials Display Grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Key size={15} style={{ color: '#2563eb' }} />
                <span>College Administrator Module Access Credentials</span>
              </span>
              <button
                type="button"
                className="btn-enterprise btn-outline-soft btn-sm"
                onClick={() => {
                  const text = `HMS College Administrator Access\nCollege Name: ${successCollege.name}\nCollege ID / Code: ${successCollege.college_code}\nAdmin Email: ${successCollege.created_admin_email}\nPassword: ${successCollege.created_password}\nRole: COLLEGE_ADMIN`;
                  navigator.clipboard.writeText(text);
                  setCopiedField('all');
                  setTimeout(() => setCopiedField(null), 2500);
                }}
              >
                {copiedField === 'all' ? (
                  <>
                    <Check size={13} style={{ color: '#059669' }} />
                    <span style={{ color: '#059669' }}>Copied All Credentials!</span>
                  </>
                ) : (
                  <>
                    <Copy size={13} />
                    <span>Copy All Credentials</span>
                  </>
                )}
              </button>
            </div>

            <div className="create-cred-grid">
              <div className="create-cred-tile">
                <span className="create-cred-label">College Tenant Identifier</span>
                <span className="create-cred-val">{successCollege.college_code}</span>
              </div>
              <div className="create-cred-tile">
                <span className="create-cred-label">Admin Login Email / ID</span>
                <span className="create-cred-val" style={{ fontSize: '0.86rem' }}>{successCollege.created_admin_email}</span>
              </div>
              <div className="create-cred-tile">
                <span className="create-cred-label">Root Password</span>
                <span className="create-cred-val" style={{ color: '#2563eb' }}>{successCollege.created_password}</span>
              </div>
            </div>

            <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
              The administrator can authenticate at the Unified Portal using either their <strong>College Code ({successCollege.college_code})</strong> or their <strong>Admin Email ({successCollege.created_admin_email})</strong>.
            </p>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginTop: '6px' }}>
            {successCollege?.college_id ? (
              <>
                <button
                  type="button"
                  className="btn-enterprise btn-primary-blue"
                  onClick={() => navigate(`/colleges/${successCollege.college_id}/onboarding`)}
                  id="btn-continue-onboarding"
                >
                  <Rocket size={14} />
                  <span>Continue to Onboarding Wizard</span>
                </button>
                <button
                  type="button"
                  className="btn-enterprise btn-outline-soft"
                  onClick={() => navigate(`/colleges/${successCollege.college_id}`)}
                  id="btn-view-new-college"
                >
                  <Building2 size={14} />
                  <span>View College Profile &amp; Manage</span>
                </button>
              </>
            ) : (
              <div style={{ color: '#dc2626', fontSize: '0.84rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldAlert size={14} />
                <span>Navigation disabled: Missing verified persistent college ID.</span>
              </div>
            )}
            <button
              type="button"
              className="btn-enterprise btn-outline-soft"
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
              <span>+ Register Another College</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. Main Creation Form & Live Preview Grid */}
      {!successCollege && (
        <div className="create-layout-grid">
          {/* Left Column: Form */}
          <div className="create-form-card">
            {serverError && (
              <div className="alert alert-danger" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={16} />
                  <span>{serverError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const mockId = 'col-dev-' + Math.random().toString(36).substring(2, 9);
                    const isTN = formData.state_code === '33';
                    const resolvedDisplayCity = isTN
                      ? (formData.city_name || formData.block_name || 'Tamil Nadu')
                      : (formData.city || 'City');
                    const effectiveAdminEmail =
                      formData.admin_email.trim() ||
                      formData.contact_email.trim() ||
                      `${(formData.college_code || 'institution').trim().toLowerCase()}.admin@hms.local`;
                    setServerError(null);
                    setSuccessCollege({
                      college_id: mockId,
                      id: mockId,
                      college_code: formData.college_code.trim().toUpperCase() || 'INSTITUTION',
                      name: formData.name.trim() || 'Onboarded Institution',
                      state: formData.state,
                      city: resolvedDisplayCity,
                      created_password: formData.password,
                      created_admin_email: effectiveAdminEmail,
                      location_summary: isTN
                        ? `Tamil Nadu → ${formData.district_name || 'District'} → ${formData.city_name || formData.block_name || 'City'}`
                        : `${formData.state} → ${resolvedDisplayCity}`,
                      campus_locality_display: formData.campus_locality.trim() || 'Main Campus',
                    });
                  }}
                  className="btn-enterprise btn-primary-blue btn-sm"
                  style={{ whiteSpace: 'nowrap' }}
                >
                  <Sparkles size={13} />
                  <span>Force Dev Bypass</span>
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
              {/* Section 1: Institution Identity */}
              <div>
                <div className="create-section-header">
                  <div className="create-section-title-wrap">
                    <div className="create-section-icon-box">
                      <Building2 size={16} />
                    </div>
                    <h2 className="create-section-title">1. Institution Identity Details</h2>
                  </div>
                  <span className="create-section-tag">Required</span>
                </div>

                <div className="create-field-grid" style={{ marginTop: '14px' }}>
                  <div className="create-field-group">
                    <label className="create-field-label" htmlFor="field-college-code">
                      <span>College Code <span className="label-req">*</span></span>
                      <span className="label-hint">Uppercase Identifier</span>
                    </label>
                    <input
                      id="field-college-code"
                      name="college_code"
                      type="text"
                      className={`create-input ${errors.college_code ? 'has-error' : ''}`}
                      placeholder="e.g. IITD, NITK, MIT-BLR"
                      value={formData.college_code}
                      onChange={handleChange}
                      disabled={submitting}
                      style={{ textTransform: 'uppercase', fontFamily: 'monospace', fontWeight: 700 }}
                    />
                    {errors.college_code && (
                      <span className="create-field-error">
                        <AlertTriangle size={12} />
                        <span>{errors.college_code}</span>
                      </span>
                    )}
                  </div>

                  <div className="create-field-group">
                    <label className="create-field-label" htmlFor="field-college-name">
                      <span>Institution Name <span className="label-req">*</span></span>
                      <span className="label-hint">Official Legal Title</span>
                    </label>
                    <input
                      id="field-college-name"
                      name="name"
                      type="text"
                      className={`create-input ${errors.name ? 'has-error' : ''}`}
                      placeholder="e.g. National Institute of Technology Karnataka"
                      value={formData.name}
                      onChange={handleChange}
                      disabled={submitting}
                    />
                    {errors.name && (
                      <span className="create-field-error">
                        <AlertTriangle size={12} />
                        <span>{errors.name}</span>
                      </span>
                    )}
                  </div>

                  {/* College Logo Field */}
                  <div className="create-field-group" style={{ gridColumn: '1 / -1' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label className="create-field-label" style={{ marginBottom: 0 }}>
                        <span>College Logo <span className="label-hint" style={{ fontWeight: 400 }}>(Visible on College Admin Portal)</span></span>
                      </label>
                      <div style={{ display: 'flex', gap: '8px', fontSize: '0.78rem' }}>
                        <button
                          type="button"
                          onClick={() => setLogoInputMode('upload')}
                          className={`btn-sm ${logoInputMode === 'upload' ? 'btn-primary-blue' : 'btn-secondary'}`}
                          style={{ padding: '3px 10px', borderRadius: '4px', cursor: 'pointer', border: '1px solid var(--border-color)' }}
                        >
                          <Upload size={12} style={{ display: 'inline', marginRight: '4px' }} />
                          Upload File
                        </button>
                        <button
                          type="button"
                          onClick={() => setLogoInputMode('url')}
                          className={`btn-sm ${logoInputMode === 'url' ? 'btn-primary-blue' : 'btn-secondary'}`}
                          style={{ padding: '3px 10px', borderRadius: '4px', cursor: 'pointer', border: '1px solid var(--border-color)' }}
                        >
                          <Link2 size={12} style={{ display: 'inline', marginRight: '4px' }} />
                          Image URL
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                      {formData.logo_url ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', width: '100%' }}>
                          <img
                            src={formData.logo_url}
                            alt="College Logo Preview"
                            style={{ width: '48px', height: '48px', objectFit: 'contain', borderRadius: '6px', background: '#fff', border: '1px solid #cbd5e1', padding: '2px' }}
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>College Logo Attached</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>This logo will appear on the College Admin sign-in screen and dashboard navigation.</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setFormData((prev) => ({ ...prev, logo_url: '' }));
                              if (fileInputRef.current) fileInputRef.current.value = '';
                            }}
                            className="btn-danger-ghost btn-sm"
                            style={{ padding: '4px 8px', cursor: 'pointer' }}
                            title="Remove logo"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ) : logoInputMode === 'upload' ? (
                        <div
                          onClick={() => fileInputRef.current?.click()}
                          style={{
                            flex: 1,
                            minWidth: '240px',
                            border: '2px dashed #cbd5e1',
                            borderRadius: '8px',
                            padding: '16px',
                            textAlign: 'center',
                            cursor: 'pointer',
                            background: '#f8fafc',
                            transition: 'all 0.2s',
                          }}
                          onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = '#3b82f6'; }}
                          onDragLeave={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.currentTarget.style.borderColor = '#cbd5e1';
                            const file = e.dataTransfer.files?.[0];
                            if (file) handleLogoFile(file);
                          }}
                        >
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/svg+xml,image/webp"
                            style={{ display: 'none' }}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleLogoFile(file);
                            }}
                          />
                          <Upload size={20} style={{ color: '#64748b', marginBottom: '4px' }} />
                          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            Click to upload college logo (PNG, JPG, SVG, WebP)
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                            Recommended transparent PNG or SVG, max 2MB
                          </div>
                        </div>
                      ) : (
                        <div style={{ flex: 1, minWidth: '240px' }}>
                          <input
                            type="url"
                            name="logo_url"
                            className="create-input"
                            placeholder="https://example.edu/assets/logo.png"
                            value={formData.logo_url}
                            onChange={(e) => setFormData((prev) => ({ ...prev, logo_url: e.target.value }))}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Geographical Location */}
              <div>
                <div className="create-section-header">
                  <div className="create-section-title-wrap">
                    <div className="create-section-icon-box">
                      <MapPin size={16} />
                    </div>
                    <h2 className="create-section-title">2. Geographical Location &amp; Campus Address</h2>
                  </div>
                  <span className="create-section-tag">{isTamilNadu ? 'Tamil Nadu LGD' : 'National'}</span>
                </div>

                <div className="create-field-grid" style={{ marginTop: '14px' }}>
                  {/* State Selection */}
                  <div className="create-field-group">
                    <label className="create-field-label" htmlFor="field-college-state">
                      <span>State / Union Territory <span className="label-req">*</span></span>
                    </label>
                    <select
                      id="field-college-state"
                      name="state"
                      className={`create-select ${errors.state ? 'has-error' : ''}`}
                      value={formData.state}
                      onChange={handleStateChange}
                      disabled={submitting}
                    >
                      <option value="">Select State / UT</option>
                      {INDIAN_STATES.map((st) => (
                        <option key={st} value={st}>
                          {st} {st === 'Tamil Nadu' ? '(LGD Sync Enabled)' : ''}
                        </option>
                      ))}
                    </select>
                    {errors.state && (
                      <span className="create-field-error">
                        <AlertTriangle size={12} />
                        <span>{errors.state}</span>
                      </span>
                    )}
                  </div>

                  {/* District / City for non-TN */}
                  {isTamilNadu ? (
                    <div className="create-field-group">
                      <label className="create-field-label" htmlFor="field-college-district">
                        <span>District <span className="label-req">*</span></span>
                        {loadingDistricts && (
                          <span style={{ fontSize: '0.72rem', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <RotateCw size={11} className="animate-spin" />
                            <span>Loading districts...</span>
                          </span>
                        )}
                      </label>
                      <select
                        id="field-college-district"
                        name="district_code"
                        className={`create-select ${errors.district_code ? 'has-error' : ''}`}
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
                      {districtError && (
                        <span className="create-field-error">
                          <AlertTriangle size={12} />
                          <span>{districtError}</span>
                        </span>
                      )}
                      {errors.district_code && (
                        <span className="create-field-error">
                          <AlertTriangle size={12} />
                          <span>{errors.district_code}</span>
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="create-field-group">
                      <label className="create-field-label" htmlFor="field-college-city">
                        <span>City <span className="label-req">*</span></span>
                      </label>
                      <select
                        id="field-college-city"
                        name="city"
                        className={`create-select ${errors.city ? 'has-error' : ''}`}
                        value={formData.city}
                        onChange={handleNonTNCityChange}
                        disabled={submitting || !formData.state}
                      >
                        <option value="">{formData.state ? 'Select City' : 'Select State first'}</option>
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
                          className="create-input"
                          style={{ marginTop: '6px' }}
                          placeholder="Enter city name..."
                          value={formData.custom_city}
                          onChange={handleChange}
                          disabled={submitting}
                        />
                      )}
                      {errors.city && (
                        <span className="create-field-error">
                          <AlertTriangle size={12} />
                          <span>{errors.city}</span>
                        </span>
                      )}
                    </div>
                  )}

                  {/* Tamil Nadu Row 2: City & Locality */}
                  {isTamilNadu && (
                    <>
                      <div className="create-field-group">
                        <label className="create-field-label" htmlFor="field-college-city">
                          <span>City / Town / Block <span className="label-req">*</span></span>
                          {formData.district_code && tnCities.length > 0 && (
                            <span className="label-hint">{tnCities.length} locations</span>
                          )}
                        </label>
                        <select
                          id="field-college-city"
                          name="city_selection"
                          className={`create-select ${errors.city_code ? 'has-error' : ''}`}
                          value={
                            formData.city_code
                              ? `URBAN:${formData.city_code}`
                              : formData.block_code
                                ? `RURAL:${formData.block_code}`
                                : ''
                          }
                          onChange={handleTnCityChange}
                          disabled={submitting || !formData.district_code}
                        >
                          <option value="">
                            {!formData.district_code ? 'Select District first' : 'Select City'}
                          </option>
                          {tnCities.map((c) => (
                            <option key={`${c.type}:${c.code}`} value={`${c.type}:${c.code}`}>
                              {c.name} ({c.category})
                            </option>
                          ))}
                        </select>

                        {/* Quick 1-Click Interactive City Pills */}
                        {formData.district_code && tnCities.length > 0 && (
                          <div className="create-pills-row">
                            {tnCities.slice(0, 4).map((c) => {
                              const isSelected =
                                (c.type === 'URBAN' && formData.city_code === c.code) ||
                                (c.type === 'RURAL' && formData.block_code === c.code);
                              return (
                                <button
                                  key={`pill-${c.type}-${c.code}`}
                                  type="button"
                                  onClick={() => handleTnCityChange({ target: { value: `${c.type}:${c.code}` } })}
                                  className={`create-quick-pill ${isSelected ? 'selected' : ''}`}
                                >
                                  {isSelected && <Check size={11} />}
                                  <span>{c.name}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                        {errors.city_code && (
                          <span className="create-field-error">
                            <AlertTriangle size={12} />
                            <span>{errors.city_code}</span>
                          </span>
                        )}
                      </div>

                      <div className="create-field-group">
                        <label className="create-field-label" htmlFor="field-college-area">
                          <span>Area / Locality <span className="label-req">*</span></span>
                        </label>
                        <select
                          id="field-college-area"
                          name="village_code"
                          className={`create-select ${errors.village_code ? 'has-error' : ''}`}
                          value={formData.village_code}
                          onChange={handleTnLocalityChange}
                          disabled={submitting || (!formData.city_code && !formData.block_code)}
                        >
                          <option value="">
                            {!formData.city_code && !formData.block_code
                              ? 'Select City first'
                              : 'Select Area / Locality'}
                          </option>
                          {tnLocalities.map((l) => (
                            <option key={l.code} value={l.code}>
                              {l.name}
                            </option>
                          ))}
                        </select>

                        {/* Quick 1-Click Locality Pills */}
                        {(formData.city_code || formData.block_code) && tnLocalities.length > 0 && (
                          <div className="create-pills-row">
                            {tnLocalities.slice(0, 3).map((l) => {
                              const isSelected = formData.village_code === l.code;
                              return (
                                <button
                                  key={`loc-${l.code}`}
                                  type="button"
                                  onClick={() => handleTnLocalityChange({ target: { value: l.code } })}
                                  className={`create-quick-pill ${isSelected ? 'selected' : ''}`}
                                >
                                  {isSelected && <Check size={11} />}
                                  <span>{l.name.replace(/ - /g, ' · ')}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                        {errors.village_code && (
                          <span className="create-field-error">
                            <AlertTriangle size={12} />
                            <span>{errors.village_code}</span>
                          </span>
                        )}
                      </div>
                    </>
                  )}

                  {/* Street Locality & Pincode */}
                  <div className="create-field-group">
                    <label className="create-field-label" htmlFor="field-college-campus-locality">
                      <span>Campus Street Address / Locality</span>
                    </label>
                    <input
                      id="field-college-campus-locality"
                      name="campus_locality"
                      type="text"
                      className="create-input"
                      placeholder="e.g. Academic Campus, NH-47 Bypass"
                      value={formData.campus_locality}
                      onChange={handleChange}
                      disabled={submitting}
                    />
                  </div>

                  <div className="create-field-group">
                    <label className="create-field-label" htmlFor="field-college-pincode">
                      <span>Postal PIN Code</span>
                      <span className="label-hint">6 Digits</span>
                    </label>
                    <input
                      id="field-college-pincode"
                      name="pincode"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      className={`create-input ${errors.pincode ? 'has-error' : ''}`}
                      placeholder="e.g. 641032"
                      value={formData.pincode}
                      onChange={handleChange}
                      disabled={submitting}
                      style={{ fontFamily: 'monospace' }}
                    />
                    {errors.pincode && (
                      <span className="create-field-error">
                        <AlertTriangle size={12} />
                        <span>{errors.pincode}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Section 3: Primary Contact & Administrator Credentials */}
              <div>
                <div className="create-section-header">
                  <div className="create-section-title-wrap">
                    <div className="create-section-icon-box">
                      <Key size={16} />
                    </div>
                    <h2 className="create-section-title">3. Primary Contact &amp; Administrator Security Credentials</h2>
                  </div>
                  <span className="create-section-tag">Role: COLLEGE_ADMIN</span>
                </div>

                <div className="create-field-grid" style={{ marginTop: '14px' }}>
                  <div className="create-field-group full-width">
                    <label className="create-field-label" htmlFor="field-college-email">
                      <span>Primary Contact Email</span>
                      <span className="label-hint">Official institution inbox for correspondence</span>
                    </label>
                    <input
                      id="field-college-email"
                      name="contact_email"
                      type="email"
                      className={`create-input ${errors.contact_email ? 'has-error' : ''}`}
                      placeholder="e.g. contact@institution.edu.in"
                      value={formData.contact_email}
                      onChange={handleChange}
                      disabled={submitting}
                    />
                    {errors.contact_email && (
                      <span className="create-field-error">
                        <AlertTriangle size={12} />
                        <span>{errors.contact_email}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Sub-Card: Admin Login Box */}
                <div className="create-credentials-box" style={{ marginTop: '14px' }}>
                  <div className="create-credentials-top">
                    <div>
                      <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Lock size={14} style={{ color: '#2563eb' }} />
                        <span>Root College Administrator Account Setup</span>
                      </span>
                      <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                        Used by the college administrator to log into and manage the Admin module.
                      </p>
                    </div>

                    <button
                      type="button"
                      className="btn-enterprise btn-outline-soft btn-sm"
                      onClick={generateStrongPassword}
                      disabled={submitting}
                    >
                      <Sparkles size={12} style={{ color: '#2563eb' }} />
                      <span>Generate Password</span>
                    </button>
                  </div>

                  <div className="create-field-group">
                    <label className="create-field-label" htmlFor="field-admin-email">
                      <span>Administrator Login Email / Username</span>
                      <span className="label-hint">Defaults to tenant alias if omitted</span>
                    </label>
                    <input
                      id="field-admin-email"
                      name="admin_email"
                      type="email"
                      className={`create-input ${errors.admin_email ? 'has-error' : ''}`}
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
                    {errors.admin_email && (
                      <span className="create-field-error">
                        <AlertTriangle size={12} />
                        <span>{errors.admin_email}</span>
                      </span>
                    )}
                  </div>

                  <div className="create-field-grid">
                    <div className="create-field-group">
                      <label className="create-field-label" htmlFor="field-password">
                        <span>Admin Password <span className="label-req">*</span></span>
                        <span className="label-hint">Min. 8 characters</span>
                      </label>
                      <div className="create-password-wrapper">
                        <input
                          id="field-password"
                          name="password"
                          type={showPassword ? 'text' : 'password'}
                          className={`create-input ${errors.password ? 'has-error' : ''}`}
                          placeholder="Min. 8 characters"
                          value={formData.password}
                          onChange={handleChange}
                          disabled={submitting}
                          style={{ paddingRight: '40px' }}
                        />
                        <button
                          type="button"
                          className="create-password-toggle-btn"
                          onClick={() => setShowPassword(!showPassword)}
                          title={showPassword ? 'Hide password' : 'Show password'}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                      {errors.password && (
                        <span className="create-field-error">
                          <AlertTriangle size={12} />
                          <span>{errors.password}</span>
                        </span>
                      )}
                    </div>

                    <div className="create-field-group">
                      <label className="create-field-label" htmlFor="field-confirm-password">
                        <span>Confirm Password <span className="label-req">*</span></span>
                      </label>
                      <div className="create-password-wrapper">
                        <input
                          id="field-confirm-password"
                          name="confirm_password"
                          type={showConfirmPassword ? 'text' : 'password'}
                          className={`create-input ${errors.confirm_password ? 'has-error' : ''}`}
                          placeholder="Re-type password"
                          value={formData.confirm_password}
                          onChange={handleChange}
                          disabled={submitting}
                          style={{ paddingRight: '40px' }}
                        />
                        <button
                          type="button"
                          className="create-password-toggle-btn"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          title={showConfirmPassword ? 'Hide password' : 'Show password'}
                          aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                        >
                          {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                      {errors.confirm_password && (
                        <span className="create-field-error">
                          <AlertTriangle size={12} />
                          <span>{errors.confirm_password}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Action Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '10px', borderTop: '1px solid #edf2f7' }}>
                <Link
                  to="/colleges"
                  className="btn-enterprise btn-outline-soft"
                  disabled={submitting}
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  className="btn-enterprise btn-primary-blue"
                  id="btn-submit-create-college"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <RotateCw size={14} className="animate-spin" />
                      <span>Provisioning College...</span>
                    </>
                  ) : (
                    <>
                      <Rocket size={14} />
                      <span>Create College Tenant</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Right Column: Live Tenant Preview & Verification Sidebar */}
          <div className="create-sidebar-stack">
            {/* Live Tenant Identity Card */}
            <div className="create-preview-card">
              <div className="create-preview-topbar">
                <span className="create-preview-label">Live Tenant Identity Preview</span>
                <span className="badge-enterprise badge-amber">ONBOARDING</span>
              </div>

              <div className="create-tenant-avatar-block">
                <div className="create-tenant-avatar">
                  {collegeInitials}
                </div>
                <div className="create-tenant-avatar-info">
                  <span className="create-tenant-code-text">
                    {formData.college_code ? formData.college_code.trim().toUpperCase() : 'CODE PENDING'}
                  </span>
                  <span className="create-tenant-name-text" title={formData.name}>
                    {formData.name ? formData.name.trim() : 'Institution title will appear here...'}
                  </span>
                </div>
              </div>

              {/* Hierarchy Tree Card */}
              <div className="create-tree-box">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <MapPin size={12} style={{ color: '#2563eb' }} />
                  <span>Geographical Hierarchy</span>
                </div>
                <div className="create-tree-row">
                  <strong>State:</strong>
                  <span>{formData.state} {isTamilNadu ? '(TN · Code 33)' : ''}</span>
                </div>
                {isTamilNadu ? (
                  <>
                    <div className="create-tree-row">
                      <strong>District:</strong>
                      <span style={{ color: formData.district_name ? '#0f172a' : '#94a3b8' }}>
                        {formData.district_name || 'Select District...'}
                      </span>
                    </div>
                    <div className="create-tree-row">
                      <strong>City / Block:</strong>
                      <span style={{ color: (formData.city_name || formData.block_name) ? '#0f172a' : '#94a3b8' }}>
                        {(formData.city_name || formData.block_name) || 'Select City...'}
                      </span>
                    </div>
                    <div className="create-tree-row">
                      <strong>Locality:</strong>
                      <span style={{ color: (formData.village_name || formData.campus_locality) ? '#0f172a' : '#94a3b8' }}>
                        {(formData.village_name || formData.campus_locality) || 'Select Area...'}
                      </span>
                    </div>
                    {formData.pincode && (
                      <div className="create-tree-row">
                        <strong>PIN Code:</strong>
                        <span style={{ fontFamily: 'monospace' }}>{formData.pincode}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="create-tree-row">
                      <strong>City:</strong>
                      <span style={{ color: formData.city ? '#0f172a' : '#94a3b8' }}>
                        {formData.city === 'OTHER' ? (formData.custom_city || 'Custom City') : (formData.city || 'Select City...')}
                      </span>
                    </div>
                    {formData.area && (
                      <div className="create-tree-row">
                        <strong>Area:</strong>
                        <span>{formData.area === 'OTHER' ? (formData.custom_area || 'Custom Area') : formData.area}</span>
                      </div>
                    )}
                    {formData.pincode && (
                      <div className="create-tree-row">
                        <strong>PIN Code:</strong>
                        <span style={{ fontFamily: 'monospace' }}>{formData.pincode}</span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Administrator Identity Preview */}
              <div className="create-tree-box">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <Users size={12} style={{ color: '#4f46e5' }} />
                  <span>Primary Administrator</span>
                </div>
                <div className="create-tree-row">
                  <strong>Login:</strong>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {formData.admin_email || (formData.contact_email ? formData.contact_email : formData.college_code ? `${formData.college_code.toLowerCase()}.admin@hms.local` : 'admin@institution.edu')}
                  </span>
                </div>
                <div className="create-tree-row">
                  <strong>Password:</strong>
                  {formData.password ? (
                    formData.password.length >= 8 && formData.password === formData.confirm_password ? (
                      <span style={{ color: '#059669', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle2 size={12} />
                        <span>Configured &amp; Confirmed</span>
                      </span>
                    ) : formData.password !== formData.confirm_password ? (
                      <span style={{ color: '#dc2626', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <AlertTriangle size={12} />
                        <span>Passwords do not match</span>
                      </span>
                    ) : (
                      <span style={{ color: '#d97706', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <AlertCircle size={12} />
                        <span>Min. 8 characters</span>
                      </span>
                    )
                  ) : (
                    <span style={{ color: '#94a3b8' }}>Not configured</span>
                  )}
                </div>
              </div>
            </div>

            {/* Checklist Card */}
            <div className="create-checklist-card">
              <div className="create-checklist-header">
                <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileCheck size={15} style={{ color: '#2563eb' }} />
                  <span>Onboarding Readiness Checklist</span>
                </span>
                <span
                  className="badge-enterprise"
                  style={{
                    backgroundColor: completedChecklistCount === 5 ? '#ecfdf5' : '#fffbeb',
                    color: completedChecklistCount === 5 ? '#059669' : '#d97706',
                    borderColor: completedChecklistCount === 5 ? '#a7f3d0' : '#fde68a',
                  }}
                >
                  {completedChecklistCount} of 5 Ready
                </span>
              </div>

              {/* Animated Progress Bar */}
              <div className="create-progress-track">
                <div
                  className="create-progress-fill"
                  style={{
                    width: `${(completedChecklistCount / 5) * 100}%`,
                    backgroundColor: completedChecklistCount === 5 ? '#10b981' : '#2563eb',
                  }}
                />
              </div>

              <div className="create-checklist-items">
                {checklistItems.map((item, idx) => (
                  <div key={idx} className="create-checklist-item">
                    <div className={`create-check-icon-wrap ${item.valid ? 'valid' : 'pending'}`}>
                      {item.valid ? <Check size={12} /> : <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#94a3b8' }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: item.valid ? 600 : 500, color: item.valid ? '#0f172a' : '#64748b' }}>
                        {item.label}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.detail}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Authoritative LGD Sync Info Card */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Building2 size={16} style={{ color: '#2563eb' }} />
                <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#0f172a' }}>
                  Tamil Nadu LGD Directory Synchronization
                </span>
              </div>
              <p style={{ fontSize: '0.78rem', color: '#64748b', margin: 0, lineHeight: 1.45 }}>
                The HMS platform is synchronized with the official Tamil Nadu Local Government Directory across all 38 districts, 388 development blocks, and 649 urban local bodies for authoritative tenant physical structure management.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
