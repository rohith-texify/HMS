import React, { useState, useEffect } from 'react';
import { studentService } from '../services/studentService';
import {
  PageHeader,
  Card,
  Badge,
  Button,
  LoadingState,
  EmptyState,
  ErrorState,
} from '../components';
import {
  User,
  Building2,
  Mail,
  Phone,
  Calendar,
  Heart,
  MapPin,
  Shield,
  BookOpen,
  GraduationCap,
  Users,
  AlertTriangle,
  FileText,
  Clock,
  Layers,
  CheckCircle2,
  Info,
  Lock,
} from 'lucide-react';

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [profile, setProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await studentService.getProfile();
      setProfile(data);
    } catch (err) {
      setError(err.message || 'Failed to retrieve student profile.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  if (loading) {
    return <LoadingState message="Loading your student profile and residential records..." />;
  }

  if (error || !profile) {
    return (
      <ErrorState
        title="Profile Unavailable"
        message={error || 'Unable to load your student profile.'}
        onRetry={fetchProfile}
      />
    );
  }

  const room = profile.current_room;
  const guardians = profile.guardians || [];
  const emergencyContacts = profile.emergency_contacts || [];
  const documents = profile.documents || [];

  return (
    <div>
      {/* Header Banner */}
      <PageHeader
        title={profile.full_name || profile.first_name || 'Student Profile'}
        subtitle={`Admission No: ${profile.admission_number || 'N/A'} • ${
          profile.department_name ? `${profile.department_name} • ` : ''
        }${profile.student_status || 'ACTIVE'}`}
        icon={User}
        actions={
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Badge variant={profile.student_status === 'ACTIVE' ? 'success' : 'warning'}>
              {profile.student_status || 'ACTIVE'}
            </Badge>
            <Badge variant={room ? 'APPROVED' : 'info'}>
              {profile.hostel_status || (room ? 'ALLOCATED' : 'NOT_ALLOCATED')}
            </Badge>
          </div>
        }
      />

      {/* Profile Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid #e2e8f0',
          marginBottom: '24px',
          overflowX: 'auto',
          paddingBottom: '2px',
        }}
      >
        {[
          { id: 'overview', label: 'Overview & Personal', icon: User },
          { id: 'academic', label: 'Academic Enrollment', icon: GraduationCap },
          { id: 'accommodation', label: 'Hostel Accommodation', icon: Building2 },
          { id: 'guardians', label: 'Guardians & Contacts', icon: Users },
          { id: 'documents', label: 'Permitted Documents', icon: FileText },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                fontSize: '0.88rem',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? '#2563eb' : '#64748b',
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: isActive ? '2px solid #2563eb' : '2px solid transparent',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW & PERSONAL INFORMATION */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '24px',
            }}
          >
            {/* Identity & Basic Details */}
            <Card title="Personal Information" subtitle="Official student identification & demographic details">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.84rem', color: '#64748b' }}>Full Legal Name</span>
                  <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a' }}>{profile.full_name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.84rem', color: '#64748b' }}>Admission Number</span>
                  <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#2563eb' }}>{profile.admission_number}</span>
                </div>
                {profile.registration_number && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                    <span style={{ fontSize: '0.84rem', color: '#64748b' }}>Registration Number</span>
                    <span style={{ fontSize: '0.86rem', fontWeight: 600, color: '#0f172a' }}>{profile.registration_number}</span>
                  </div>
                )}
                {profile.roll_number && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                    <span style={{ fontSize: '0.84rem', color: '#64748b' }}>Roll Number</span>
                    <span style={{ fontSize: '0.86rem', fontWeight: 600, color: '#0f172a' }}>{profile.roll_number}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.84rem', color: '#64748b' }}>Date of Birth</span>
                  <span style={{ fontSize: '0.86rem', color: '#0f172a' }}>
                    {profile.date_of_birth ? new Date(profile.date_of_birth).toLocaleDateString() : 'Not recorded'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.84rem', color: '#64748b' }}>Gender</span>
                  <span style={{ fontSize: '0.86rem', color: '#0f172a' }}>{profile.gender || 'Not specified'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.84rem', color: '#64748b' }}>Blood Group</span>
                  <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#dc2626' }}>{profile.blood_group || 'Not recorded'}</span>
                </div>
              </div>
            </Card>

            {/* Contact & Residential Address */}
            <Card title="Contact & Address" subtitle="Registered student communication channels">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.84rem', color: '#64748b' }}>Institutional Email</span>
                  <span style={{ fontSize: '0.86rem', fontWeight: 600, color: '#0f172a' }}>{profile.email}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.84rem', color: '#64748b' }}>Mobile Number</span>
                  <span style={{ fontSize: '0.86rem', fontWeight: 600, color: '#0f172a' }}>{profile.phone || 'Not recorded'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.84rem', color: '#64748b' }}>Emergency Phone</span>
                  <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#dc2626' }}>
                    {profile.emergency_contact_phone || 'None on file'}
                  </span>
                </div>

                <div style={{ padding: '12px 14px', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '6px' }}>Permanent Address</div>
                  <div style={{ fontSize: '0.86rem', color: '#0f172a', lineHeight: 1.5 }}>
                    {profile.address_line1 ? (
                      <>
                        {profile.address_line1}
                        {profile.address_line2 && <div>{profile.address_line2}</div>}
                        <div>
                          {[profile.city, profile.state, profile.postal_code, profile.country]
                            .filter(Boolean)
                            .join(', ')}
                        </div>
                      </>
                    ) : (
                      <span style={{ color: '#94a3b8' }}>No address record provided.</span>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Account & Policy Notice */}
          <Card title="Account & Governance Status" subtitle="Institutional security & modification permissions">
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '14px',
                padding: '16px',
                backgroundColor: '#f8fafc',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
              }}
            >
              <Lock size={22} color="#64748b" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>
                  Read-Only Institutional Record
                </div>
                <p style={{ margin: 0, fontSize: '0.84rem', color: '#475569', lineHeight: 1.5 }}>
                  Student profile data is governed by the institutional Registrar and Hostel Administration.
                  Direct modification of personal, academic, or room assignment fields is restricted under institutional policy.
                  To request official corrections or updates, please contact your College Administrator or Hostel In-Charge office.
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: ACADEMIC ENROLLMENT */}
      {activeTab === 'academic' && (
        <Card title="Academic Information" subtitle="Enrolled department, program, course, and semester records">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '16px',
            }}
          >
            <div style={{ padding: '14px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: '0.78rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Academic Department
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
                {profile.department_name || 'Not Assigned'}
              </div>
            </div>

            <div style={{ padding: '14px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: '0.78rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Program / Degree
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
                {profile.program_name || 'Undergraduate'}
              </div>
            </div>

            <div style={{ padding: '14px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: '0.78rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Course / Branch
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
                {profile.course_name || 'General Curriculum'}
              </div>
            </div>

            <div style={{ padding: '14px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: '0.78rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Academic Year
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#2563eb', marginTop: '4px' }}>
                {profile.academic_year || 'Current Academic Year'}
              </div>
            </div>

            <div style={{ padding: '14px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: '0.78rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Current Semester
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
                {profile.semester_number ? `Semester ${profile.semester_number}` : 'Not Specified'}
              </div>
            </div>

            <div style={{ padding: '14px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: '0.78rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Academic Batch
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
                {profile.batch_name || 'Enrolled Batch'}
              </div>
            </div>

            <div style={{ padding: '14px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: '0.78rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Admission Date
              </div>
              <div style={{ fontSize: '0.94rem', fontWeight: 600, color: '#0f172a', marginTop: '4px' }}>
                {profile.admission_date ? new Date(profile.admission_date).toLocaleDateString() : 'Not Recorded'}
              </div>
            </div>

            <div style={{ padding: '14px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: '0.78rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Enrollment Standing
              </div>
              <div style={{ marginTop: '6px' }}>
                <Badge variant={profile.student_status === 'ACTIVE' ? 'success' : 'warning'}>
                  {profile.student_status || 'ACTIVE'}
                </Badge>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* TAB 3: HOSTEL ACCOMMODATION */}
      {activeTab === 'accommodation' && (
        <Card
          title="Hostel Accommodation Hierarchy"
          subtitle="Assigned residential structure from hostel building down to specific bed space"
        >
          {room ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Hierarchy Tree Visualization */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '12px',
                  padding: '16px',
                  backgroundColor: '#f0f9ff',
                  borderRadius: '12px',
                  border: '1px solid #bae6fd',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase' }}>
                    1. Hostel Facility
                  </div>
                  <div style={{ fontSize: '0.94rem', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                    {room.hostel_name}
                  </div>
                  <div style={{ fontSize: '0.76rem', color: '#0284c7' }}>
                    Type: {room.hostel_type || 'Residential'}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase' }}>
                    2. Block
                  </div>
                  <div style={{ fontSize: '0.94rem', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                    {room.block_name}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase' }}>
                    3. Floor
                  </div>
                  <div style={{ fontSize: '0.94rem', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                    Floor {room.floor_number}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase' }}>
                    4. Room
                  </div>
                  <div style={{ fontSize: '0.94rem', fontWeight: 800, color: '#2563eb', marginTop: '2px' }}>
                    Room {room.room_number}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase' }}>
                    5. Assigned Bed
                  </div>
                  <div style={{ fontSize: '0.94rem', fontWeight: 800, color: '#059669', marginTop: '2px' }}>
                    Bed {room.bed_label}
                  </div>
                </div>
              </div>

              {/* Allocation Meta Details */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: '14px',
                }}
              >
                <div style={{ padding: '12px 14px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Allocation Type:</span>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                    {room.allocation_type}
                  </div>
                </div>

                <div style={{ padding: '12px 14px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Allotment Status:</span>
                  <div style={{ marginTop: '2px' }}>
                    <Badge variant={room.status === 'ACTIVE' ? 'success' : 'warning'}>
                      {room.status}
                    </Badge>
                  </div>
                </div>

                <div style={{ padding: '12px 14px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Effective Allotment Date:</span>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>
                    {new Date(room.allocated_at).toLocaleDateString()}
                  </div>
                </div>

                {room.remarks && (
                  <div style={{ padding: '12px 14px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Allocation Remarks:</span>
                    <div style={{ fontSize: '0.86rem', color: '#334155', marginTop: '2px' }}>
                      {room.remarks}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <EmptyState
              icon={Building2}
              title="No Hostel Accommodation Currently Assigned"
              description="Your student account does not have an active hostel bed allotment on record. Please visit the Hostel In-Charge office for room allocation."
            />
          )}
        </Card>
      )}

      {/* TAB 4: GUARDIANS & EMERGENCY CONTACTS */}
      {activeTab === 'guardians' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Parent / Guardian Information */}
          <Card
            title="Parent / Guardian Information"
            subtitle="Verified guardians associated with student records under institutional policy"
          >
            {guardians.length > 0 ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                  gap: '16px',
                }}
              >
                {guardians.map((g) => (
                  <div
                    key={g.id}
                    style={{
                      padding: '16px',
                      borderRadius: '10px',
                      border: '1px solid #e2e8f0',
                      backgroundColor: '#ffffff',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.94rem', color: '#0f172a' }}>
                        {g.full_name}
                      </span>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {g.is_primary && <Badge variant="success">Primary</Badge>}
                        <Badge variant="info">{g.relationship || 'Guardian'}</Badge>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.84rem', color: '#475569', marginBottom: '10px' }}>
                      <div>
                        <strong>Phone:</strong> {g.phone}
                        {g.alternate_phone && <span> (Alt: {g.alternate_phone})</span>}
                      </div>
                      {g.email && <div><strong>Email:</strong> {g.email}</div>}
                      {g.occupation && <div><strong>Occupation:</strong> {g.occupation}</div>}
                    </div>

                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {g.can_receive_notifications && (
                        <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '4px', backgroundColor: '#eff6ff', color: '#2563eb', fontWeight: 600 }}>
                          Notifications Enabled
                        </span>
                      )}
                      {g.can_pickup_student && (
                        <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '4px', backgroundColor: '#f0fdf4', color: '#16a34a', fontWeight: 600 }}>
                          Authorized Pickup
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Users}
                title="No Guardian Information Available"
                description="No verified parent or guardian records are registered under this student enrollment."
              />
            )}
          </Card>

          {/* Emergency Contacts */}
          <Card
            title="Authorized Emergency Contacts"
            subtitle="Priority contacts utilized by security and campus medical services during emergencies"
          >
            {emergencyContacts.length > 0 ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '14px',
                }}
              >
                {emergencyContacts.map((ec) => (
                  <div
                    key={ec.id}
                    style={{
                      padding: '14px',
                      borderRadius: '10px',
                      border: '1px solid #fee2e2',
                      backgroundColor: '#fef2f2',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#991b1b' }}>
                        {ec.contact_name}
                      </span>
                      {ec.is_primary && <Badge variant="danger">Priority 1</Badge>}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#7f1d1d', marginBottom: '4px' }}>
                      Relationship: <strong>{ec.relationship || 'Emergency Contact'}</strong>
                    </div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#b91c1c' }}>
                      {ec.phone}
                      {ec.alternate_phone && <span style={{ fontSize: '0.8rem', fontWeight: 500 }}> / {ec.alternate_phone}</span>}
                    </div>
                    {ec.email && (
                      <div style={{ fontSize: '0.78rem', color: '#991b1b', marginTop: '4px' }}>
                        {ec.email}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Phone}
                title="No Emergency Contact Information Available"
                description="No dedicated emergency contact records are listed. Please register an emergency contact with the hostel office."
              />
            )}
          </Card>
        </div>
      )}

      {/* TAB 5: PERMITTED DOCUMENTS */}
      {activeTab === 'documents' && (
        <Card
          title="Permitted Student Documents"
          subtitle="Verification certificates, identification cards, and institutional records"
        >
          {documents.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#f8fafc',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <FileText size={20} color="#2563eb" />
                    <div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#0f172a' }}>
                        {doc.file_name || 'Student Document'}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                        Uploaded: {new Date(doc.uploaded_at).toLocaleDateString()}
                        {doc.file_size && ` • ${(doc.file_size / 1024).toFixed(1)} KB`}
                      </div>
                    </div>
                  </div>
                  <Badge variant="success">{doc.status || 'ACTIVE'}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={FileText}
              title="No Permitted Documents Available"
              description="No documents or institutional certificates are currently linked to your student account."
            />
          )}
        </Card>
      )}
    </div>
  );
}
