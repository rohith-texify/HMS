import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import adminService from '../services/adminService';
import {
  Users,
  Search,
  RefreshCw,
  Phone,
  Mail,
  UserCheck,
  Plus,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  Lock,
  Key,
  Briefcase,
  MapPin,
  HeartHandshake,
  GraduationCap,
  Link as LinkIcon,
  Unlink,
  Clock,
  ArrowRight,
  ExternalLink,
  LayoutGrid,
  List,
} from 'lucide-react';
import {
  PageHeader,
  DataTable,
  SearchInput,
  FilterControls,
  Modal,
  FormField,
  ConfirmationDialog,
  LoadingState,
  EmptyState,
  ErrorState,
} from '../../../shared/components';

export default function AdminParentsPage() {
  const navigate = useNavigate();

  // Primary State
  const [parents, setParents] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // View & Display Mode: CARDS (visual grid) or TABLE (tabular list)
  const [displayMode, setDisplayMode] = useState('CARDS');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [relationshipFilter, setRelationshipFilter] = useState('ALL');

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [linkStudentModalOpen, setLinkStudentModalOpen] = useState(false);
  const [unlinkConfirmOpen, setUnlinkConfirmOpen] = useState(false);

  // Selected State
  const [selectedParent, setSelectedParent] = useState(null);
  const [linkedStudents, setLinkedStudents] = useState([]);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [selectedRelationshipToUnlink, setSelectedRelationshipToUnlink] = useState(null);

  // Form State
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    relationship: 'FATHER',
    phone: '',
    alternate_phone: '',
    email: '',
    password: '',
    confirm_password: '',
    occupation: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'India',
  });

  // Link Student Form State
  const [linkStudentData, setLinkStudentData] = useState({
    student_id: '',
    relationship: 'FATHER',
    is_primary: true,
    can_receive_notifications: true,
    can_pickup_student: true,
  });

  // Load Parents & Students Catalog
  const loadData = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const [parentsRes, studentsRes] = await Promise.allSettled([
        adminService.getParents(),
        adminService.getStudents(),
      ]);

      if (parentsRes.status === 'fulfilled') {
        const d = parentsRes.value?.data || parentsRes.value;
        setParents(Array.isArray(d) ? d : d?.parents || []);
      } else {
        setError(parentsRes.reason?.message || 'Failed to retrieve parents directory');
      }

      if (studentsRes.status === 'fulfilled') {
        const d = studentsRes.value?.data || studentsRes.value;
        setStudents(Array.isArray(d) ? d : d?.students || []);
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load linked students for a parent
  const loadLinkedStudentsForParent = useCallback(async (parentId) => {
    if (!parentId) return;
    setLoadingLinks(true);
    try {
      // Find all students whose parents include this parentId
      const matches = [];
      const studentsList = await adminService.getStudents();
      const list = Array.isArray(studentsList) ? studentsList : studentsList?.students || [];

      // Check parents of students in parallel
      await Promise.allSettled(
        list.slice(0, 30).map(async (student) => {
          try {
            const rels = await adminService.getStudentParents(student.id);
            const rList = Array.isArray(rels) ? rels : rels?.data || [];
            const match = rList.find((r) => r.parent_id === parentId);
            if (match) {
              matches.push({
                ...match,
                student,
              });
            }
          } catch {
            // Ignore
          }
        })
      );

      setLinkedStudents(matches);
    } catch (err) {
      console.warn('Failed to resolve linked students:', err);
    } finally {
      setLoadingLinks(false);
    }
  }, []);

  // Open Full Profile View
  const handleOpenProfile = (parent) => {
    setSelectedParent(parent);
    setProfileModalOpen(true);
    loadLinkedStudentsForParent(parent.id);
  };

  // Open Edit Modal
  const handleOpenEdit = (parent) => {
    setSelectedParent(parent);
    setFormError(null);
    setFormData({
      first_name: parent.first_name || '',
      middle_name: parent.middle_name || '',
      last_name: parent.last_name || '',
      relationship: parent.relationship || 'FATHER',
      phone: parent.phone || '',
      alternate_phone: parent.alternate_phone || '',
      email: parent.email || '',
      occupation: parent.occupation || '',
      address_line1: parent.address_line1 || '',
      address_line2: parent.address_line2 || '',
      city: parent.city || '',
      state: parent.state || '',
      postal_code: parent.postal_code || '',
      country: parent.country || 'India',
    });
    setEditModalOpen(true);
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    setFormError(null);
    setShowPassword(false);
    setShowConfirmPassword(false);
    setFormData({
      first_name: '',
      middle_name: '',
      last_name: '',
      relationship: 'FATHER',
      phone: '',
      alternate_phone: '',
      email: '',
      password: '',
      confirm_password: '',
      occupation: '',
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      postal_code: '',
      country: 'India',
    });
    setCreateModalOpen(true);
  };

  // Submit Parent Creation
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.first_name.trim()) {
      setFormError('First Name is required.');
      return;
    }

    if (formData.password?.trim()) {
      if (!formData.email?.trim()) {
        setFormError('Parent ID (Email address) is required to set up Parent Portal access.');
        return;
      }
      if (formData.password.trim().length < 8) {
        setFormError('Parent Portal password must be at least 8 characters.');
        return;
      }
      if (formData.password !== formData.confirm_password) {
        setFormError('Passwords do not match. Please re-enter.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        first_name: formData.first_name.trim(),
        middle_name: formData.middle_name?.trim() || null,
        last_name: formData.last_name?.trim() || null,
        relationship: formData.relationship || null,
        phone: formData.phone?.trim() || null,
        alternate_phone: formData.alternate_phone?.trim() || null,
        email: formData.email?.trim() || null,
        password: formData.password?.trim() || null,
        confirm_password: formData.confirm_password?.trim() || null,
        occupation: formData.occupation?.trim() || null,
        address_line1: formData.address_line1?.trim() || null,
        address_line2: formData.address_line2?.trim() || null,
        city: formData.city?.trim() || null,
        state: formData.state?.trim() || null,
        postal_code: formData.postal_code?.trim() || null,
        country: formData.country?.trim() || null,
      };

      await adminService.createParent(payload);
      setCreateModalOpen(false);
      loadData(true);
    } catch (err) {
      setFormError(err.message || 'Failed to create parent profile');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Parent Update
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!selectedParent) return;
    setFormError(null);

    if (!formData.first_name.trim()) {
      setFormError('First Name is required.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        first_name: formData.first_name.trim(),
        middle_name: formData.middle_name?.trim() || null,
        last_name: formData.last_name?.trim() || null,
        relationship: formData.relationship || null,
        phone: formData.phone?.trim() || null,
        alternate_phone: formData.alternate_phone?.trim() || null,
        email: formData.email?.trim() || null,
        occupation: formData.occupation?.trim() || null,
        address_line1: formData.address_line1?.trim() || null,
        address_line2: formData.address_line2?.trim() || null,
        city: formData.city?.trim() || null,
        state: formData.state?.trim() || null,
        postal_code: formData.postal_code?.trim() || null,
        country: formData.country?.trim() || null,
      };

      await adminService.updateParent(selectedParent.id, payload);
      setEditModalOpen(false);
      loadData(true);
    } catch (err) {
      setFormError(err.message || 'Failed to update parent profile');
    } finally {
      setSubmitting(false);
    }
  };

  // Link Student to this Parent
  const handleLinkStudentSubmit = async (e) => {
    e.preventDefault();
    if (!selectedParent || !linkStudentData.student_id) return;

    setSubmitting(true);
    try {
      const payload = {
        parent_id: selectedParent.id,
        relationship: linkStudentData.relationship || selectedParent.relationship || 'FATHER',
        is_primary: linkStudentData.is_primary,
        can_receive_notifications: linkStudentData.can_receive_notifications,
        can_pickup_student: linkStudentData.can_pickup_student,
      };

      await adminService.linkStudentParent(linkStudentData.student_id, payload);
      setLinkStudentModalOpen(false);
      loadLinkedStudentsForParent(selectedParent.id);
    } catch (err) {
      alert(`Failed to link student: ${err.message || 'Error occurred'}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Unlink Student from this Parent
  const handleConfirmUnlink = async () => {
    if (!selectedRelationshipToUnlink) return;
    setSubmitting(true);
    try {
      await adminService.unlinkStudentParent(
        selectedRelationshipToUnlink.student_id,
        selectedRelationshipToUnlink.id
      );
      setUnlinkConfirmOpen(false);
      if (selectedParent) {
        loadLinkedStudentsForParent(selectedParent.id);
      }
    } catch (err) {
      alert(`Failed to unlink student: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered Parents
  const filteredParents = useMemo(() => {
    return parents.filter((p) => {
      const q = searchTerm.toLowerCase();
      const fullName = `${p.first_name || ''} ${p.last_name || ''}`.toLowerCase();
      const phone = (p.phone || '').toLowerCase();
      const email = (p.email || '').toLowerCase();
      const occupation = (p.occupation || '').toLowerCase();

      const matchesSearch = !q || fullName.includes(q) || phone.includes(q) || email.includes(q) || occupation.includes(q);

      const rel = (p.relationship || 'OTHER').toUpperCase();
      const matchesRel = relationshipFilter === 'ALL' || rel === relationshipFilter;

      return matchesSearch && matchesRel;
    });
  }, [parents, searchTerm, relationshipFilter]);

  // KPI Calculations
  const totalCount = parents.length;
  const fatherCount = parents.filter((p) => (p.relationship || '').toUpperCase() === 'FATHER').length;
  const motherCount = parents.filter((p) => (p.relationship || '').toUpperCase() === 'MOTHER').length;
  const guardianCount = totalCount - (fatherCount + motherCount);

  // Table Columns Definition
  const columns = [
    {
      header: 'Parent / Guardian',
      key: 'name',
      render: (p) => {
        const initials = `${p.first_name?.[0] || 'P'}${p.last_name?.[0] || ''}`.toUpperCase();
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                backgroundColor: '#faf5ff',
                color: '#9333ea',
                fontWeight: 700,
                fontSize: '0.76rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {initials}
            </div>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {p.first_name} {p.last_name || ''}
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                {p.occupation ? `${p.occupation}` : 'Guardian profile'}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      header: 'Relationship',
      key: 'relationship',
      render: (p) => {
        const rel = (p.relationship || 'GUARDIAN').toUpperCase();
        return <span className="badge-enterprise badge-purple">{rel}</span>;
      },
    },
    {
      header: 'Contact Numbers',
      key: 'phone',
      render: (p) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.84rem' }}>
            <Phone size={12} style={{ color: 'var(--text-muted)' }} />
            <span>{p.phone || 'N/A'}</span>
          </div>
          {p.alternate_phone && (
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Alt: {p.alternate_phone}
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Email / Portal Login',
      key: 'email',
      render: (p) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            <Mail size={12} style={{ color: 'var(--text-muted)' }} />
            <span>{p.email || 'N/A'}</span>
          </div>
          {p.user_id && (
            <div style={{ marginTop: '2px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.66rem', fontWeight: 600, color: '#15803d', backgroundColor: '#dcfce7', padding: '1px 6px', borderRadius: '4px' }}>
                <UserCheck size={10} /> Portal Active
              </span>
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Actions',
      key: 'actions',
      align: 'right',
      render: (p) => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
          <button
            type="button"
            className="btn-enterprise-secondary"
            style={{ padding: '5px 10px', fontSize: '0.76rem' }}
            onClick={() => handleOpenProfile(p)}
            title="View Full Profile & Linked Wards"
          >
            <Eye size={13} />
            <span>Profile</span>
          </button>
          <button
            type="button"
            className="btn-enterprise-secondary"
            style={{ padding: '5px 8px' }}
            onClick={() => handleOpenEdit(p)}
            title="Edit Details"
          >
            <Edit2 size={13} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="fade-in-up">
      {/* 1. Modern Enterprise Hero Header */}
      <div className="enterprise-hero-header">
        <div className="hero-header-titles">
          <div className="hero-category-pill">
            <Users size={13} />
            <span>Family & Guardian Liaison</span>
          </div>
          <h1 className="hero-main-title">Parents & Guardians Directory</h1>
          <p className="hero-subtitle">
            Manage verified family contacts, residential student linkages, primary emergency guardians, and gate pickup permissions.
          </p>
        </div>

        <div className="hero-action-buttons">
          <button
            type="button"
            className="btn-enterprise-secondary"
            onClick={() => loadData(true)}
            disabled={isRefreshing}
          >
            <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} />
            <span>{isRefreshing ? 'Syncing...' : 'Sync Directory'}</span>
          </button>
          <button
            type="button"
            className="btn-enterprise-primary"
            onClick={handleOpenCreate}
          >
            <Plus size={15} />
            <span>Register Parent</span>
          </button>
        </div>
      </div>

      {/* 2. Executive KPI Cards */}
      <div className="kpi-cards-grid" style={{ marginBottom: '20px' }}>
        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-title">Total Registered Parents</span>
            <div className="stat-kpi-icon-box" style={{ backgroundColor: '#faf5ff', color: '#9333ea' }}>
              <Users size={18} />
            </div>
          </div>
          <div className="stat-kpi-value">{totalCount}</div>
          <div className="stat-kpi-subtext">Verified contacts on file</div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-title">Fathers</span>
            <div className="stat-kpi-icon-box" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
              <HeartHandshake size={18} />
            </div>
          </div>
          <div className="stat-kpi-value">{fatherCount}</div>
          <div className="stat-kpi-subtext">Registered father profiles</div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-title">Mothers</span>
            <div className="stat-kpi-icon-box" style={{ backgroundColor: '#fdf2f8', color: '#db2777' }}>
              <HeartHandshake size={18} />
            </div>
          </div>
          <div className="stat-kpi-value">{motherCount}</div>
          <div className="stat-kpi-subtext">Registered mother profiles</div>
        </div>

        <div className="stat-kpi-card">
          <div className="stat-kpi-header">
            <span className="stat-kpi-title">Legal Guardians</span>
            <div className="stat-kpi-icon-box" style={{ backgroundColor: '#f0fdf4', color: '#16a34a' }}>
              <UserCheck size={18} />
            </div>
          </div>
          <div className="stat-kpi-value">{guardianCount}</div>
          <div className="stat-kpi-subtext">Local & family guardians</div>
        </div>
      </div>

      {/* 3. Filter Controls Toolbar */}
      <FilterControls
        totalRecords={filteredParents.length}
        onReset={() => {
          setSearchTerm('');
          setRelationshipFilter('ALL');
        }}
      >
        <SearchInput
          placeholder="Search by name, phone, email, occupation..."
          value={searchTerm}
          onChange={setSearchTerm}
          width={320}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Role:</span>
          <select
            className="filter-search-input"
            style={{ width: 'auto', padding: '6px 12px' }}
            value={relationshipFilter}
            onChange={(e) => setRelationshipFilter(e.target.value)}
          >
            <option value="ALL">All Relationships</option>
            <option value="FATHER">Father</option>
            <option value="MOTHER">Mother</option>
            <option value="GUARDIAN">Guardian</option>
            <option value="OTHER">Other</option>
          </select>
        </div>

        {/* View Switcher: Cards vs Table */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="view-mode-toggle">
            <button
              type="button"
              className={`view-mode-btn ${displayMode === 'CARDS' ? 'active' : ''}`}
              onClick={() => setDisplayMode('CARDS')}
              title="Card Grid View"
            >
              <LayoutGrid size={13} />
              <span>Cards</span>
            </button>
            <button
              type="button"
              className={`view-mode-btn ${displayMode === 'TABLE' ? 'active' : ''}`}
              onClick={() => setDisplayMode('TABLE')}
              title="Table View"
            >
              <List size={13} />
              <span>Table</span>
            </button>
          </div>
        </div>
      </FilterControls>

      {/* 4. Enterprise Card Container */}
      <div className="enterprise-card" style={{ marginTop: '16px' }}>
        <div className="card-topbar">
          <div className="card-title-group">
            <div className="card-title-icon-wrap" style={{ backgroundColor: '#faf5ff', color: '#9333ea' }}>
              <Users size={16} />
            </div>
            <div>
              <h2 className="card-title-text">Registered Family & Guardians</h2>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                Showing {filteredParents.length} of {parents.length} registered profiles
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="badge-enterprise badge-purple">
              <span className="live-pulse" />
              {totalCount} Guardians
            </span>
            <span className="badge-enterprise badge-blue">
              {fatherCount} Fathers
            </span>
            <span className="badge-enterprise badge-pink">
              {motherCount} Mothers
            </span>
            {guardianCount > 0 && (
              <span className="badge-enterprise badge-emerald">
                {guardianCount} Guardians
              </span>
            )}
          </div>
        </div>

        {error ? (
          <div style={{ padding: '24px' }}>
            <ErrorState title="Failed to load parents" message={error} onRetry={() => loadData(true)} />
          </div>
        ) : loading ? (
          <div style={{ padding: '40px' }}>
            <LoadingState message="Loading parents & guardians directory..." />
          </div>
        ) : filteredParents.length === 0 ? (
          <div style={{ padding: '40px' }}>
            <EmptyState
              title="No parent profiles found"
              message="No parents or guardians match your search query or filter criteria."
            />
          </div>
        ) : displayMode === 'CARDS' ? (
          <div style={{ padding: '20px' }}>
            <div className="parents-grid-cards">
              {filteredParents.map((p) => {
                const initials = `${p.first_name?.[0] || 'P'}${p.last_name?.[0] || ''}`.toUpperCase();
                const rel = (p.relationship || 'GUARDIAN').toUpperCase();
                const relClass = rel === 'FATHER' ? 'father' : rel === 'MOTHER' ? 'mother' : rel === 'GUARDIAN' ? 'guardian' : 'other';
                const relBadgeColor = rel === 'FATHER' ? 'badge-blue' : rel === 'MOTHER' ? 'badge-pink' : rel === 'GUARDIAN' ? 'badge-emerald' : 'badge-purple';

                return (
                  <div key={p.id} className={`parent-card-v2 ${relClass}`}>
                    {/* Card Top: Avatar, Name, Relationship */}
                    <div className="parent-card-top">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                        <div className={`parent-avatar-box ${relClass}`}>
                          {initials}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <h3 className="parent-name-title" title={`${p.first_name} ${p.last_name || ''}`}>
                            {p.first_name} {p.last_name || ''}
                          </h3>
                          <div className="parent-occupation-sub">
                            <Briefcase size={11} style={{ flexShrink: 0 }} />
                            <span>{p.occupation || 'Occupation Unspecified'}</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                        <span
                          className={`badge-enterprise ${relBadgeColor}`}
                          style={{ fontSize: '0.68rem', textTransform: 'uppercase' }}
                        >
                          {rel}
                        </span>
                        {p.user_id && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              fontSize: '0.65rem',
                              fontWeight: 600,
                              color: '#15803d',
                              backgroundColor: '#dcfce7',
                              padding: '1px 6px',
                              borderRadius: '4px',
                            }}
                          >
                            <UserCheck size={10} /> Portal Active
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Card Body: Contact Stack, City/State */}
                    <div className="parent-card-body">
                      <div className="parent-contacts-stack">
                        <div className="parent-contact-row" title={p.phone || 'No phone registered'}>
                          <Phone size={12} style={{ color: '#10b981', flexShrink: 0 }} />
                          <span>{p.phone || 'No phone registered'}</span>
                          {p.alternate_phone && (
                            <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                              (Alt: {p.alternate_phone})
                            </span>
                          )}
                        </div>
                        <div className="parent-contact-row" title={p.email || 'No email registered'}>
                          <Mail size={12} style={{ color: '#6366f1', flexShrink: 0 }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {p.email || 'No email registered'}
                          </span>
                        </div>
                        {(p.city || p.state) && (
                          <div className="parent-contact-row" title={`${p.city || ''}, ${p.state || ''}`}>
                            <MapPin size={12} style={{ color: '#f59e0b', flexShrink: 0 }} />
                            <span>
                              {p.city || ''}{p.city && p.state ? ', ' : ''}{p.state || ''}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Location or Address snippet if available */}
                      {p.address_line1 && (
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <span style={{ fontWeight: 600 }}>Address:</span> {p.address_line1}
                        </div>
                      )}
                    </div>

                    {/* Card Footer: Action Buttons */}
                    <div className="parent-card-footer">
                      <button
                        type="button"
                        className="btn-enterprise-secondary"
                        style={{ padding: '5px 10px', fontSize: '0.76rem', gap: '5px' }}
                        onClick={() => handleOpenProfile(p)}
                        title="View Full Profile & Linked Student Wards"
                      >
                        <Eye size={13} />
                        <span>Dossier & Wards</span>
                      </button>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          className="btn-enterprise-secondary"
                          style={{ padding: '5px 8px' }}
                          onClick={() => handleOpenEdit(p)}
                          title="Edit Parent Details"
                        >
                          <Edit2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div style={{ padding: '0' }}>
            <DataTable
              columns={columns}
              data={filteredParents}
              rowKey="id"
              loading={loading}
              emptyTitle="No parent profiles found"
              emptyMessage="No parents or guardians match your filter criteria."
              footer={
                <span>
                  Showing <strong>{filteredParents.length}</strong> of <strong>{parents.length}</strong> registered guardians
                </span>
              }
            />
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 5. MODAL: Detailed Parent Profile Drawer                                   */}
      {/* ========================================================================= */}
      {selectedParent && (
        <Modal
          isOpen={profileModalOpen}
          onClose={() => setProfileModalOpen(false)}
          title={`${selectedParent.first_name} ${selectedParent.last_name || ''}`}
          subtitle={`Relationship: ${selectedParent.relationship || 'Guardian'} · ${selectedParent.occupation || 'Occupation Unspecified'}`}
          maxWidth="700px"
          footer={
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
              <button
                type="button"
                className="btn-enterprise-secondary"
                onClick={() => {
                  setProfileModalOpen(false);
                  handleOpenEdit(selectedParent);
                }}
              >
                <Edit2 size={13} />
                <span>Edit Profile</span>
              </button>
              <button
                type="button"
                className="btn-enterprise-secondary"
                onClick={() => setProfileModalOpen(false)}
              >
                Close
              </button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Contact Details */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Primary Telephone</span>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Phone size={13} style={{ color: 'var(--text-muted)' }} />
                  <span>{selectedParent.phone || 'N/A'}</span>
                </div>
              </div>
              <div>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Alternate Telephone</span>
                <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>{selectedParent.alternate_phone || 'N/A'}</div>
              </div>
              <div>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Email / Portal Login</span>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Mail size={13} style={{ color: 'var(--text-muted)' }} />
                  <span>{selectedParent.email || 'N/A'}</span>
                  {selectedParent.user_id && (
                    <span style={{ fontSize: '0.65rem', backgroundColor: '#dcfce7', color: '#15803d', padding: '1px 6px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      <UserCheck size={10} /> Active
                    </span>
                  )}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Occupation</span>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Briefcase size={13} style={{ color: 'var(--text-muted)' }} />
                  <span>{selectedParent.occupation || 'N/A'}</span>
                </div>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Residential Address</span>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MapPin size={13} style={{ color: 'var(--text-muted)' }} />
                  <span>
                    {[selectedParent.address_line1, selectedParent.city, selectedParent.state, selectedParent.postal_code, selectedParent.country]
                      .filter(Boolean)
                      .join(', ') || 'No address registered'}
                  </span>
                </div>
              </div>
            </div>

            {/* Linked Students / Wards */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <GraduationCap size={16} style={{ color: 'var(--primary-color)' }} />
                  <strong style={{ fontSize: '0.92rem' }}>Associated Student Wards ({linkedStudents.length})</strong>
                </div>
                <button
                  type="button"
                  className="btn-enterprise-secondary"
                  style={{ padding: '4px 8px', fontSize: '0.74rem' }}
                  onClick={() => setLinkStudentModalOpen(true)}
                >
                  <Plus size={12} />
                  <span>Link Student</span>
                </button>
              </div>

              {loadingLinks ? (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  Searching associated student records...
                </div>
              ) : linkedStudents.length === 0 ? (
                <div style={{ padding: '14px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px dashed var(--border-color)', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  No student residents currently associated with this parent.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {linkedStudents.map((rel) => {
                    const st = rel.student;
                    return (
                      <div
                        key={rel.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: '#ffffff',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.86rem' }}>
                            {st ? `${st.first_name} ${st.last_name || ''}` : `Student (${rel.student_id.slice(0, 8)})`}
                            <span className="badge-enterprise badge-blue" style={{ marginLeft: '8px', fontSize: '0.68rem' }}>
                              Adm: {st?.admission_number || 'N/A'}
                            </span>
                            {rel.is_primary && (
                              <span className="badge-enterprise badge-green" style={{ marginLeft: '4px', fontSize: '0.68rem' }}>
                                Primary Guardian
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            Role: {rel.relationship} · Notifications: {rel.can_receive_notifications ? 'Yes' : 'No'} · Gate Pickup: {rel.can_pickup_student ? 'Allowed' : 'No'}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn-enterprise-secondary"
                            style={{ padding: '4px 8px', fontSize: '0.74rem' }}
                            title="Navigate to Student Directory"
                            onClick={() => {
                              setProfileModalOpen(false);
                              navigate('/admin/students');
                            }}
                          >
                            <ExternalLink size={12} />
                            <span>Student Directory</span>
                          </button>
                          <button
                            type="button"
                            className="btn-enterprise-secondary"
                            style={{ padding: '4px 8px', color: '#dc2626' }}
                            title="Unlink Student"
                            onClick={() => {
                              setSelectedRelationshipToUnlink(rel);
                              setUnlinkConfirmOpen(true);
                            }}
                          >
                            <Unlink size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Relationship History Unavailable State (Strict Phase 4.E Specification) */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Clock size={16} style={{ color: 'var(--text-muted)' }} />
                <strong style={{ fontSize: '0.92rem' }}>Relationship Change History</strong>
                <span className="badge-enterprise badge-gray" style={{ fontSize: '0.66rem' }}>Unavailable</span>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.45 }}>
                Parent-student relationship audit trails are not currently exposed by backend API handlers.
              </p>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* 6. MODAL: Create Parent Form with Portal Credentials                     */}
      {/* ========================================================================= */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Register Parent or Guardian"
        subtitle="Add parent contact information and credentials to the institutional directory"
        maxWidth="640px"
        footer={
          <>
            <button
              type="button"
              className="btn-enterprise-secondary"
              onClick={() => setCreateModalOpen(false)}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-enterprise-primary"
              onClick={handleCreateSubmit}
              disabled={submitting}
            >
              {submitting ? 'Registering...' : 'Register Parent'}
            </button>
          </>
        }
      >
        <form onSubmit={handleCreateSubmit}>
          {formError && (
            <div style={{ padding: '10px 14px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '8px', fontSize: '0.82rem', marginBottom: '14px' }}>
              {formError}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <FormField label="First Name" required>
              <input
                type="text"
                className="filter-search-input"
                style={{ width: '100%' }}
                placeholder="First name"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                required
              />
            </FormField>

            <FormField label="Last Name">
              <input
                type="text"
                className="filter-search-input"
                style={{ width: '100%' }}
                placeholder="Last name"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
              />
            </FormField>

            <FormField label="Relationship Type">
              <select
                className="filter-search-input"
                style={{ width: '100%' }}
                value={formData.relationship}
                onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
              >
                <option value="FATHER">Father</option>
                <option value="MOTHER">Mother</option>
                <option value="GUARDIAN">Legal Guardian</option>
                <option value="OTHER">Other</option>
              </select>
            </FormField>

            <FormField label="Occupation">
              <input
                type="text"
                className="filter-search-input"
                style={{ width: '100%' }}
                placeholder="e.g. Engineer, Business"
                value={formData.occupation}
                onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
              />
            </FormField>

            <FormField label="Primary Phone">
              <input
                type="tel"
                className="filter-search-input"
                style={{ width: '100%' }}
                placeholder="+91 9876543210"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </FormField>

            <FormField label="Alternate Phone">
              <input
                type="tel"
                className="filter-search-input"
                style={{ width: '100%' }}
                placeholder="Secondary telephone"
                value={formData.alternate_phone}
                onChange={(e) => setFormData({ ...formData, alternate_phone: e.target.value })}
              />
            </FormField>

            <FormField label="City / State">
              <input
                type="text"
                className="filter-search-input"
                style={{ width: '100%' }}
                placeholder="City, State"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              />
            </FormField>

            <FormField label="Street Address">
              <input
                type="text"
                className="filter-search-input"
                style={{ width: '100%' }}
                placeholder="Street address / locality"
                value={formData.address_line1}
                onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
              />
            </FormField>
          </div>

          {/* Parent Portal Access & Credentials (Parent ID & Password) */}
          <div
            style={{
              marginTop: '16px',
              padding: '16px',
              borderRadius: '10px',
              border: '1px solid #e0e7ff',
              backgroundColor: '#f8faff',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  backgroundColor: '#e0e7ff',
                  color: '#4338ca',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Lock size={15} />
              </div>
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Parent Portal Access & Credentials
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  Set up Parent ID (login email) and password to enable direct Parent Portal access.
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
              <FormField label="Parent Login ID / Email Address" required={Boolean(formData.password?.trim())}>
                <div style={{ position: 'relative' }}>
                  <input
                    type="email"
                    className="filter-search-input"
                    style={{ width: '100%', paddingLeft: '34px' }}
                    placeholder="e.g. parent.guardian@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required={Boolean(formData.password?.trim())}
                  />
                  <Mail
                    size={15}
                    style={{
                      position: 'absolute',
                      left: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-muted)',
                      pointerEvents: 'none',
                    }}
                  />
                </div>
              </FormField>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <FormField label="Parent Portal Password" required={Boolean(formData.email?.trim())}>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="filter-search-input"
                      style={{ width: '100%', paddingRight: '36px' }}
                      placeholder="Min 8 characters"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
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
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        padding: '4px',
                      }}
                      tabIndex={-1}
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </FormField>

                <FormField label="Retype Password" required={Boolean(formData.password?.trim())}>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      className="filter-search-input"
                      style={{ width: '100%', paddingRight: '36px' }}
                      placeholder="Confirm password"
                      value={formData.confirm_password}
                      onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
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
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        padding: '4px',
                      }}
                      tabIndex={-1}
                      title={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </FormField>
              </div>
            </div>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* 7. MODAL: Edit Parent Form                                               */}
      {/* ========================================================================= */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit Parent / Guardian"
        subtitle={`Updating details for: ${formData.first_name} ${formData.last_name || ''}`}
        maxWidth="600px"
        footer={
          <>
            <button
              type="button"
              className="btn-enterprise-secondary"
              onClick={() => setEditModalOpen(false)}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-enterprise-primary"
              onClick={handleEditSubmit}
              disabled={submitting}
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </>
        }
      >
        <form onSubmit={handleEditSubmit}>
          {formError && (
            <div style={{ padding: '10px 14px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '8px', fontSize: '0.82rem', marginBottom: '14px' }}>
              {formError}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <FormField label="First Name" required>
              <input
                type="text"
                className="filter-search-input"
                style={{ width: '100%' }}
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                required
              />
            </FormField>

            <FormField label="Last Name">
              <input
                type="text"
                className="filter-search-input"
                style={{ width: '100%' }}
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
              />
            </FormField>

            <FormField label="Occupation">
              <input
                type="text"
                className="filter-search-input"
                style={{ width: '100%' }}
                value={formData.occupation}
                onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
              />
            </FormField>

            <FormField label="Primary Phone">
              <input
                type="tel"
                className="filter-search-input"
                style={{ width: '100%' }}
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </FormField>

            <FormField label="Email Address">
              <input
                type="email"
                className="filter-search-input"
                style={{ width: '100%' }}
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </FormField>

            <FormField label="City">
              <input
                type="text"
                className="filter-search-input"
                style={{ width: '100%' }}
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              />
            </FormField>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* 8. MODAL: Link Student to Parent                                         */}
      {/* ========================================================================= */}
      {selectedParent && (
        <Modal
          isOpen={linkStudentModalOpen}
          onClose={() => setLinkStudentModalOpen(false)}
          title="Link Student Resident to Parent"
          subtitle={`Parent: ${selectedParent.first_name} ${selectedParent.last_name || ''}`}
          maxWidth="500px"
          footer={
            <>
              <button
                type="button"
                className="btn-enterprise-secondary"
                onClick={() => setLinkStudentModalOpen(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-enterprise-primary"
                onClick={handleLinkStudentSubmit}
                disabled={submitting || !linkStudentData.student_id}
              >
                {submitting ? 'Linking...' : 'Establish Link'}
              </button>
            </>
          }
        >
          <form onSubmit={handleLinkStudentSubmit}>
            <FormField label="Select Student Resident" required>
              <select
                className="filter-search-input"
                style={{ width: '100%' }}
                value={linkStudentData.student_id}
                onChange={(e) => setLinkStudentData({ ...linkStudentData, student_id: e.target.value })}
                required
              >
                <option value="">-- Choose Enrolled Student ({students.length}) --</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.first_name} {s.last_name || ''} ({s.admission_number})
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Relationship" required>
              <select
                className="filter-search-input"
                style={{ width: '100%' }}
                value={linkStudentData.relationship}
                onChange={(e) => setLinkStudentData({ ...linkStudentData, relationship: e.target.value })}
                required
              >
                <option value="FATHER">Father</option>
                <option value="MOTHER">Mother</option>
                <option value="GUARDIAN">Legal Guardian</option>
                <option value="OTHER">Other</option>
              </select>
            </FormField>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem' }}>
                <input
                  type="checkbox"
                  checked={linkStudentData.is_primary}
                  onChange={(e) => setLinkStudentData({ ...linkStudentData, is_primary: e.target.checked })}
                />
                <span>Primary Guardian Contact</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem' }}>
                <input
                  type="checkbox"
                  checked={linkStudentData.can_receive_notifications}
                  onChange={(e) => setLinkStudentData({ ...linkStudentData, can_receive_notifications: e.target.checked })}
                />
                <span>Receive Notifications & Leave Alerts</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem' }}>
                <input
                  type="checkbox"
                  checked={linkStudentData.can_pickup_student}
                  onChange={(e) => setLinkStudentData({ ...linkStudentData, can_pickup_student: e.target.checked })}
                />
                <span>Authorized for Campus Gate Pickup</span>
              </label>
            </div>
          </form>
        </Modal>
      )}

      {/* Confirmation Dialog for Unlinking */}
      <ConfirmationDialog
        isOpen={unlinkConfirmOpen}
        onCancel={() => setUnlinkConfirmOpen(false)}
        onConfirm={handleConfirmUnlink}
        title="Unlink Student Ward"
        message="Are you sure you want to sever this parent-student guardian association?"
        confirmText="Unlink Student"
        confirmVariant="danger"
        loading={submitting}
      />
    </div>
  );
}
