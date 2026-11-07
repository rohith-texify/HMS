import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { studentService } from '../services/studentService';
import {
  PageHeader,
  StatCard,
  Card,
  Badge,
  Button,
  LoadingState,
  EmptyState,
  ErrorState,
} from '../components';
import {
  LayoutDashboard,
  Building2,
  CalendarCheck2,
  QrCode,
  AlertCircle,
  Utensils,
  Plane,
  ArrowRight,
  Clock,
  Sparkles,
  Bell,
  CheckCircle2,
  RefreshCw,
  User,
  History,
  ShieldCheck,
  AlertTriangle,
  FileText,
} from 'lucide-react';

export default function DashboardPage() {
  const navigate = useNavigate();

  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardError, setDashboardError] = useState(null);
  const [summary, setSummary] = useState(null);

  // Notification state
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsUnavailable, setNotificationsUnavailable] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  const fetchDashboardData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setDashboardError(null);

    // Parallel fetch using Promise.allSettled for fault isolation
    const [summaryResult, notificationsResult, countResult] = await Promise.allSettled([
      studentService.getDashboardSummary(),
      studentService.getNotifications(true), // unread only
      studentService.getUnreadNotificationCount(),
    ]);

    // Handle Summary result
    if (summaryResult.status === 'fulfilled') {
      setSummary(summaryResult.value);
    } else {
      setDashboardError(
        summaryResult.reason?.response?.data?.message ||
        summaryResult.reason?.message ||
        'Unable to load student dashboard data.'
      );
    }

    // Handle Notifications result safely
    if (notificationsResult.status === 'fulfilled') {
      setNotifications(Array.isArray(notificationsResult.value) ? notificationsResult.value : []);
      setNotificationsUnavailable(false);
    } else {
      setNotificationsUnavailable(true);
      setNotifications([]);
    }

    // Handle Unread Count result safely
    if (countResult.status === 'fulfilled') {
      setUnreadCount(typeof countResult.value === 'number' ? countResult.value : 0);
    } else {
      setUnreadCount(null); // Indicates unavailable
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleMarkAsRead = async (notificationId) => {
    try {
      await studentService.markNotificationAsRead(notificationId);
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      setUnreadCount((prev) => (typeof prev === 'number' && prev > 0 ? prev - 1 : 0));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  if (loading) {
    return <LoadingState message="Loading your student living dashboard..." />;
  }

  if (dashboardError && !summary) {
    return (
      <ErrorState
        title="Dashboard Unavailable"
        message={dashboardError}
        onRetry={() => fetchDashboardData(false)}
      />
    );
  }

  const {
    profile,
    current_room,
    active_gate_pass,
    active_leave,
    attendance_summary,
    attendance_percentage,
    open_complaints_count = 0,
    today_meals,
    recent_activities = [],
  } = summary || {};

  // Compute attendance display states strictly according to Batch 02 rules:
  // "Do not calculate unsupported statistics from incomplete data."
  // "If attendance data is unavailable: display a proper unavailable/empty state... Do not show 0% unless actual API value."
  const hasAttendanceRecords = attendance_summary && attendance_summary.total_sessions > 0;
  const attendanceDisplayValue = hasAttendanceRecords
    ? `${(attendance_summary.attendance_percentage).toFixed(1)}%`
    : 'Unavailable';
  const attendanceSubtext = hasAttendanceRecords
    ? `${attendance_summary.present_count} of ${attendance_summary.total_sessions} sessions present`
    : 'No roll-call sessions recorded';

  return (
    <div>
      {/* Welcome Header */}
      <PageHeader
        title={`Welcome, ${profile?.first_name || profile?.full_name || 'Student'}`}
        subtitle={`${profile?.admission_number || 'Enrolled Resident'} • ${
          current_room
            ? `${current_room.hostel_name} (Room ${current_room.room_number})`
            : 'Accommodation Unallotted'
        }${profile?.department_name ? ` • ${profile.department_name}` : ''}`}
        icon={LayoutDashboard}
        actions={
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <Button
              variant="outline"
              size="sm"
              icon={RefreshCw}
              loading={refreshing}
              onClick={() => fetchDashboardData(true)}
            >
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={QrCode}
              onClick={() => navigate('/gate-pass')}
            >
              Gate Pass
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Plane}
              onClick={() => navigate('/leaves')}
            >
              Apply Leave
            </Button>
          </div>
        }
      />

      {/* KPI Stats Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        {/* Allotted Bed Stat */}
        <StatCard
          label="Allotted Bed"
          value={
            current_room
              ? `Room ${current_room.room_number}`
              : 'Unallotted'
          }
          subtext={
            current_room
              ? `${current_room.hostel_name} • Bed ${current_room.bed_label}`
              : 'Contact Hostel In-Charge'
          }
          icon={Building2}
          color="#2563eb"
        />

        {/* Attendance Stat (Real Data Only) */}
        <StatCard
          label="Attendance Rate"
          value={attendanceDisplayValue}
          subtext={attendanceSubtext}
          icon={CalendarCheck2}
          color={hasAttendanceRecords ? '#059669' : '#64748b'}
        />

        {/* Gate Pass Stat */}
        <StatCard
          label="Active Gate Pass"
          value={active_gate_pass ? active_gate_pass.pass_number : 'None'}
          subtext={
            active_gate_pass
              ? `Valid until ${new Date(active_gate_pass.valid_until).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}`
              : 'Ready to request'
          }
          icon={QrCode}
          color="#d97706"
        />

        {/* Unread Notifications Stat */}
        <StatCard
          label="Notifications"
          value={
            unreadCount !== null
              ? `${unreadCount} unread`
              : 'Unavailable'
          }
          subtext={
            unreadCount !== null
              ? unreadCount > 0
                ? 'Action items pending'
                : 'All caught up'
              : 'Notification service offline'
          }
          icon={Bell}
          color="#7c3aed"
        />

        {/* Open Complaints Stat */}
        <StatCard
          label="Pending Tickets"
          value={open_complaints_count}
          subtext="Open Grievances / Repairs"
          icon={AlertCircle}
          color={open_complaints_count > 0 ? '#dc2626' : '#64748b'}
        />
      </div>

      {/* Middle Grid: Gate Pass & Room Allocation */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '24px',
          marginBottom: '24px',
        }}
      >
        {/* Gate Pass Status Section */}
        <Card
          title="Campus Gate Clearance"
          subtitle="Real-time movement pass & security verification"
          action={
            <Button size="sm" variant="outline" onClick={() => navigate('/gate-pass')}>
              View All Passes
            </Button>
          }
        >
          {active_gate_pass ? (
            <div
              style={{
                padding: '18px',
                backgroundColor: '#f0f9ff',
                borderRadius: '12px',
                border: '1px solid #bae6fd',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '12px',
                }}
              >
                <div>
                  <span
                    style={{
                      fontWeight: 800,
                      fontSize: '1rem',
                      color: '#0369a1',
                      letterSpacing: '0.02em',
                    }}
                  >
                    {active_gate_pass.pass_number}
                  </span>
                  <div style={{ fontSize: '0.76rem', color: '#0284c7', marginTop: '2px' }}>
                    Type: <strong>{active_gate_pass.pass_type}</strong>
                  </div>
                </div>
                <Badge variant={active_gate_pass.status}>{active_gate_pass.status}</Badge>
              </div>

              <p
                style={{
                  margin: '0 0 12px 0',
                  fontSize: '0.86rem',
                  color: '#334155',
                  lineHeight: 1.5,
                }}
              >
                <strong>Reason:</strong> {active_gate_pass.reason}
                {active_gate_pass.destination && (
                  <span> • <strong>Destination:</strong> {active_gate_pass.destination}</span>
                )}
              </p>

              <div
                style={{
                  fontSize: '0.78rem',
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#ffffff',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #e0f2fe',
                }}
              >
                <Clock size={14} color="#0284c7" />
                <span>
                  Valid: {new Date(active_gate_pass.valid_from).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                  })}{' '}
                  {new Date(active_gate_pass.valid_from).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  –{' '}
                  {new Date(active_gate_pass.valid_until).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>

              <div style={{ marginTop: '14px', display: 'flex', gap: '8px' }}>
                <Button
                  size="sm"
                  variant="primary"
                  icon={QrCode}
                  onClick={() => navigate('/gate-pass')}
                >
                  Present QR Code
                </Button>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={QrCode}
              title="No Active Gate Pass"
              description="You do not have any active or approved campus exit passes at this time."
              action={
                <Button size="sm" variant="primary" onClick={() => navigate('/gate-pass')}>
                  Request Gate Pass
                </Button>
              }
            />
          )}
        </Card>

        {/* Room & Residential Allotment Section */}
        <Card
          title="Residential Allotment"
          subtitle="Hostel, block, floor and room inventory assignment"
          action={
            <Button size="sm" variant="outline" onClick={() => navigate('/profile')}>
              Full Profile
            </Button>
          }
        >
          {current_room ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 14px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '8px',
                  border: '1px solid #f1f5f9',
                }}
              >
                <span style={{ fontSize: '0.84rem', color: '#64748b' }}>Hostel Facility</span>
                <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#0f172a' }}>
                  {current_room.hostel_name}{' '}
                  {current_room.hostel_type && (
                    <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>
                      ({current_room.hostel_type})
                    </span>
                  )}
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 14px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '8px',
                  border: '1px solid #f1f5f9',
                }}
              >
                <span style={{ fontSize: '0.84rem', color: '#64748b' }}>Block & Floor</span>
                <span style={{ fontSize: '0.86rem', fontWeight: 600, color: '#0f172a' }}>
                  {current_room.block_name} • Floor {current_room.floor_number}
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 14px',
                  backgroundColor: '#eff6ff',
                  borderRadius: '8px',
                  border: '1px solid #dbeafe',
                }}
              >
                <span style={{ fontSize: '0.84rem', color: '#1e40af', fontWeight: 500 }}>
                  Room & Bed Space
                </span>
                <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#1d4ed8' }}>
                  Room {current_room.room_number} (Bed {current_room.bed_label})
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 14px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '8px',
                  border: '1px solid #f1f5f9',
                }}
              >
                <span style={{ fontSize: '0.84rem', color: '#64748b' }}>Allocation Status</span>
                <Badge variant={current_room.status || 'ACTIVE'}>
                  {current_room.status || 'ACTIVE'}
                </Badge>
              </div>

              {current_room.allocated_at && (
                <div style={{ fontSize: '0.74rem', color: '#94a3b8', textAlign: 'right', marginTop: '4px' }}>
                  Allotted on {new Date(current_room.allocated_at).toLocaleDateString()}
                </div>
              )}
            </div>
          ) : (
            <EmptyState
              icon={Building2}
              title="No Room Allotted"
              description="Your student account has not been assigned a hostel bed space. Please contact the Hostel In-Charge."
            />
          )}
        </Card>
      </div>

      {/* Grid: Notifications & Recent Activity */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '24px',
          marginBottom: '24px',
        }}
      >
        {/* Notifications Panel */}
        <Card
          title="Student Notifications"
          subtitle="Alerts, approvals, and institutional announcements"
          action={
            unreadCount !== null && (
              <Badge variant={unreadCount > 0 ? 'warning' : 'info'}>
                {unreadCount} unread
              </Badge>
            )
          }
        >
          {notificationsUnavailable ? (
            <div
              style={{
                padding: '20px',
                textAlign: 'center',
                backgroundColor: '#f8fafc',
                borderRadius: '8px',
                border: '1px dashed #cbd5e1',
                color: '#64748b',
                fontSize: '0.84rem',
              }}
            >
              <AlertTriangle size={24} color="#94a3b8" style={{ marginBottom: '6px' }} />
              <div>Notification service is currently unavailable.</div>
            </div>
          ) : notifications.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {notifications.map((item) => (
                <div
                  key={item.id}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    backgroundColor: item.read_at ? '#ffffff' : '#f8fafc',
                    border: item.read_at ? '1px solid #e2e8f0' : '1px solid #cbd5e1',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '12px',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '0.86rem',
                        fontWeight: item.read_at ? 600 : 700,
                        color: '#0f172a',
                        marginBottom: '4px',
                      }}
                    >
                      {item.title}
                    </div>
                    <div
                      style={{
                        fontSize: '0.8rem',
                        color: '#475569',
                        lineHeight: 1.4,
                        marginBottom: '6px',
                      }}
                    >
                      {item.message}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                      {new Date(item.created_at).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                  {!item.read_at && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleMarkAsRead(item.id)}
                      style={{ fontSize: '0.72rem', padding: '4px 8px' }}
                    >
                      Mark read
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Bell}
              title="No New Notifications"
              description="You have no unread notifications or institutional notices."
            />
          )}
        </Card>

        {/* Recent Student Activity Stream */}
        <Card
          title="Recent Activity"
          subtitle="Timeline of your passes, leave requests & grievances"
        >
          {recent_activities.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {recent_activities.map((act) => {
                let IconComponent = History;
                if (act.type === 'GATE_PASS') IconComponent = QrCode;
                else if (act.type === 'LEAVE') IconComponent = Plane;
                else if (act.type === 'COMPLAINT') IconComponent = AlertCircle;

                return (
                  <div
                    key={act.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      padding: '12px',
                      borderRadius: '8px',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #f1f5f9',
                    }}
                  >
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        backgroundColor: '#ffffff',
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#475569',
                        flexShrink: 0,
                        marginTop: '2px',
                      }}
                    >
                      <IconComponent size={16} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                          marginBottom: '2px',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '0.84rem',
                            fontWeight: 700,
                            color: '#0f172a',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {act.title}
                        </span>
                        {act.status && <Badge variant={act.status}>{act.status}</Badge>}
                      </div>
                      <div
                        style={{
                          fontSize: '0.78rem',
                          color: '#64748b',
                          lineHeight: 1.4,
                          marginBottom: '4px',
                        }}
                      >
                        {act.description}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                        {new Date(act.timestamp).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={History}
              title="No Recent Activity"
              description="Your submitted passes, leaves, and maintenance requests will appear here."
            />
          )}
        </Card>
      </div>

      {/* Dining Schedule Card */}
      <div style={{ marginBottom: '24px' }}>
        <Card
          title={`Institutional Dining Menu • ${today_meals?.day_of_week || 'Today'}`}
          subtitle={today_meals?.date || 'Daily scheduled meals'}
          action={
            <Button size="sm" variant="outline" onClick={() => navigate('/mess')}>
              Weekly Menu
            </Button>
          }
        >
          {today_meals && today_meals.meals && today_meals.meals.length > 0 ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '14px',
              }}
            >
              {today_meals.meals.map((meal, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '14px',
                    borderRadius: '10px',
                    backgroundColor: meal.is_special ? '#fefce8' : '#f8fafc',
                    border: meal.is_special ? '1px solid #fef08a' : '1px solid #e2e8f0',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '6px',
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a' }}>
                      {meal.meal_type}
                    </span>
                    {meal.is_special && (
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          color: '#b45309',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                        }}
                      >
                        <Sparkles size={11} /> Special
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#64748b', marginBottom: '8px' }}>
                    {meal.timings}
                  </div>
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: '16px',
                      fontSize: '0.8rem',
                      color: '#334155',
                      lineHeight: 1.5,
                    }}
                  >
                    {meal.items?.map((item, itemIdx) => (
                      <li key={itemIdx}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Utensils}
              title="No Dining Schedule Published"
              description="Mess schedule for today has not been published yet."
            />
          )}
        </Card>
      </div>

      {/* Quick Navigation Hub */}
      <Card
        title="Student Quick Actions"
        subtitle="Direct navigation to your residential self-service tools"
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '12px',
          }}
        >
          <button
            onClick={() => navigate('/profile')}
            style={{
              padding: '16px',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              backgroundColor: '#ffffff',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <User size={20} color="#2563eb" />
            <div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a' }}>
                Profile & Room
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>
                Student ID & allotment
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate('/gate-pass')}
            style={{
              padding: '16px',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              backgroundColor: '#ffffff',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <QrCode size={20} color="#059669" />
            <div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a' }}>
                Gate Pass & QR
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>
                Exit passes & security
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate('/attendance')}
            style={{
              padding: '16px',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              backgroundColor: '#ffffff',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <CalendarCheck2 size={20} color="#d97706" />
            <div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a' }}>
                Attendance
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>
                Roll-call session history
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate('/leaves')}
            style={{
              padding: '16px',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              backgroundColor: '#ffffff',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <Plane size={20} color="#7c3aed" />
            <div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a' }}>
                Leave Requests
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>
                Overnight leave applications
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate('/complaints')}
            style={{
              padding: '16px',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              backgroundColor: '#ffffff',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <AlertCircle size={20} color="#dc2626" />
            <div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a' }}>
                Complaints
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>
                Hostel maintenance tickets
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate('/mess')}
            style={{
              padding: '16px',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              backgroundColor: '#ffffff',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <Utensils size={20} color="#0284c7" />
            <div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a' }}>
                Dining Menu
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>
                Institutional meal schedule
              </div>
            </div>
          </button>
        </div>
      </Card>
    </div>
  );
}
