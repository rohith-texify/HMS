import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import inchargeService from '../services/inchargeService';
import { PERMISSIONS } from '../constants/permissions';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import SearchInput from '../components/SearchInput';
import Modal from '../components/Modal';
import FormField from '../components/FormField';
import LoadingState from '../components/LoadingState';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import Badge from '../components/Badge';
import {
  UtensilsCrossed,
  Clock,
  Calendar,
  Coffee,
  CheckCircle2,
  Plus,
  RefreshCw,
  Sparkles,
  Star,
  CalendarDays,
  LayoutGrid,
  List,
  Eye,
  Flame
} from 'lucide-react';

export default function MessPage() {
  const { assignedHostel } = useAuth();
  const { hasPermission } = usePermissions();

  const canManage = hasPermission(PERMISSIONS.HOSTEL_MANAGE);

  // Active Tab: 'TODAY' | 'MENUS' | 'TIMINGS' | 'GRIEVANCES'
  const [activeTab, setActiveTab] = useState('TODAY');
  const [displayMode, setDisplayMode] = useState('CARDS'); // 'CARDS' | 'TABLE'

  // Master Data State
  const [todayMenus, setTodayMenus] = useState([]);
  const [hostelMenus, setHostelMenus] = useState([]);
  const [mealTimings, setMealTimings] = useState([]);
  const [foodComplaints, setFoodComplaints] = useState([]);
  const [residents, setResidents] = useState([]);

  // UI & Loading States
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successBanner, setSuccessBanner] = useState(null);

  // Search & Filter State (Evaluated Client-Side)
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [mealTypeFilter, setMealTypeFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('');

  // Modals Visibility
  const [createMenuModalOpen, setCreateMenuModalOpen] = useState(false);
  const [createTimingModalOpen, setCreateTimingModalOpen] = useState(false);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [menuDetailModalOpen, setMenuDetailModalOpen] = useState(false);
  const [selectedMenu, setSelectedMenu] = useState(null);

  // Create Menu Form State
  const [menuDate, setMenuDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [menuMealType, setMenuMealType] = useState('BREAKFAST');
  const [menuItems, setMenuItems] = useState('');
  const [isSubmittingMenu, setIsSubmittingMenu] = useState(false);
  const [menuFormError, setMenuFormError] = useState(null);

  // Create Timing Form State
  const [timingMealType, setTimingMealType] = useState('BREAKFAST');
  const [timingStartTime, setTimingStartTime] = useState('07:30');
  const [timingEndTime, setTimingEndTime] = useState('09:30');
  const [isSubmittingTiming, setIsSubmittingTiming] = useState(false);
  const [timingFormError, setTimingFormError] = useState(null);

  // Create Feedback Form State
  const [feedbackStudentId, setFeedbackStudentId] = useState('');
  const [feedbackMenuId, setFeedbackMenuId] = useState('');
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [feedbackFormError, setFeedbackFormError] = useState(null);

  // Debounce search input by 300ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Auto-dismiss success notification
  useEffect(() => {
    if (successBanner) {
      const t = setTimeout(() => setSuccessBanner(null), 5000);
      return () => clearTimeout(t);
    }
  }, [successBanner]);

  // Request sequence ref to prevent stale response overwrites
  const reqSeqRef = useRef(0);

  // Master Data Loader
  const loadData = useCallback(async (isManual = false) => {
    const seq = ++reqSeqRef.current;
    if (isManual) setIsRefreshing(true);
    else setLoading(true);
    setErrorMessage(null);

    const hostelId = assignedHostel?.id || assignedHostel?.hostel_id;
    if (!hostelId) {
      setLoading(false);
      setIsRefreshing(false);
      return;
    }

    try {
      const [todayRes, menusRes, timingsRes, complaintsRes, residentsRes] = await Promise.allSettled([
        inchargeService.getTodayMenus(),
        inchargeService.getMessMenus(hostelId),
        inchargeService.getMessTimings(hostelId),
        inchargeService.getComplaints(),
        inchargeService.getHostelResidents(hostelId),
      ]);

      if (seq !== reqSeqRef.current) return;

      // 1. Today Menus
      if (todayRes.status === 'fulfilled') {
        const val = todayRes.value;
        const allToday = Array.isArray(val) ? val : val?.data || [];
        // Filter today's menu to assigned hostel
        const myToday = allToday.filter((m) => m.hostel_id === hostelId);
        setTodayMenus(myToday);
      }

      // 2. Hostel Menus
      if (menusRes.status === 'fulfilled') {
        const val = menusRes.value;
        const list = Array.isArray(val) ? val : val?.menus || val?.data || [];
        setHostelMenus(list);
      }

      // 3. Meal Timings
      if (timingsRes.status === 'fulfilled') {
        const val = timingsRes.value;
        const list = Array.isArray(val) ? val : val?.timings || val?.data || [];
        setMealTimings(list);
      }

      // 4. Food Complaints (from verified institutional complaint API)
      if (complaintsRes.status === 'fulfilled') {
        const val = complaintsRes.value;
        const allComp = Array.isArray(val) ? val : val?.complaints || val?.data || [];
        // Filter to complaints with category FOOD
        const foodComp = allComp.filter(
          (c) => (c.category || '').toUpperCase() === 'FOOD'
        );
        setFoodComplaints(foodComp);
      }

      // 5. Residents
      if (residentsRes.status === 'fulfilled') {
        const val = residentsRes.value;
        const list = Array.isArray(val) ? val : val?.residents || val?.data || [];
        setResidents(list);
      }
    } catch (err) {
      if (seq !== reqSeqRef.current) return;
      console.error('Failed to load mess data:', err);
      setErrorMessage(err.message || 'Unable to retrieve hostel mess data.');
    } finally {
      if (seq === reqSeqRef.current) {
        setLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [assignedHostel]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Format Time helper (HH:mm)
  const formatMealTime = (isoOrTime) => {
    if (!isoOrTime) return '—';
    try {
      const d = new Date(isoOrTime);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      return isoOrTime;
    } catch {
      return isoOrTime;
    }
  };

  // Format Date helper
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  // Meal Type Badge
  const getMealTypeBadge = (mealType) => {
    const t = (mealType || '').toUpperCase();
    const colors = {
      BREAKFAST: { bg: 'rgba(234, 179, 8, 0.15)', text: '#ca8a04', border: '#eab308' },
      LUNCH: { bg: 'rgba(59, 130, 246, 0.15)', text: '#2563eb', border: '#3b82f6' },
      SNACKS: { bg: 'rgba(249, 115, 22, 0.15)', text: '#ea580c', border: '#f97316' },
      DINNER: { bg: 'rgba(168, 85, 247, 0.15)', text: '#9333ea', border: '#a855f7' },
    };
    const c = colors[t] || { bg: 'rgba(100, 116, 139, 0.15)', text: '#475569', border: '#94a3b8' };

    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 8px',
          borderRadius: '4px',
          fontSize: '0.72rem',
          fontWeight: 700,
          background: c.bg,
          color: c.text,
          border: `1px solid ${c.border}`,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        <Coffee size={11} /> {t}
      </span>
    );
  };

  // Status Badge
  const getMenuStatusBadge = (status) => {
    const s = (status || '').toUpperCase();
    switch (s) {
      case 'PUBLISHED':
        return (
          <Badge variant="success" style={{ gap: '4px' }}>
            <CheckCircle2 size={12} /> PUBLISHED
          </Badge>
        );
      case 'DRAFT':
        return (
          <Badge variant="warning" style={{ gap: '4px' }}>
            <Clock size={12} /> DRAFT
          </Badge>
        );
      case 'CANCELLED':
        return (
          <Badge variant="danger" style={{ gap: '4px' }}>
            CANCELLED
          </Badge>
        );
      default:
        return <Badge variant="info">{s || 'ACTIVE'}</Badge>;
    }
  };

  // Filtered Menus List
  const filteredMenus = useMemo(() => {
    return hostelMenus.filter((m) => {
      if (mealTypeFilter !== 'ALL' && (m.meal_type || '').toUpperCase() !== mealTypeFilter) {
        return false;
      }

      if (dateFilter) {
        const mDate = m.menu_date ? m.menu_date.split('T')[0] : '';
        if (mDate !== dateFilter) return false;
      }

      if (debouncedSearch.trim()) {
        const q = debouncedSearch.toLowerCase().trim();
        const items = (m.items || '').toLowerCase();
        const type = (m.meal_type || '').toLowerCase();
        return items.includes(q) || type.includes(q);
      }

      return true;
    });
  }, [hostelMenus, mealTypeFilter, dateFilter, debouncedSearch]);

  // Handle Create Meal Menu
  const handleCreateMenuSubmit = async (e) => {
    e.preventDefault();
    setMenuFormError(null);

    const hostelId = assignedHostel?.id || assignedHostel?.hostel_id;
    if (!hostelId) {
      setMenuFormError('No assigned hostel found for session.');
      return;
    }

    if (!menuDate || !menuMealType || !menuItems.trim()) {
      setMenuFormError('Please complete all required fields.');
      return;
    }

    try {
      setIsSubmittingMenu(true);
      const payload = {
        hostel_id: hostelId,
        menu_date: new Date(menuDate).toISOString(),
        meal_type: menuMealType,
        items: menuItems.trim(),
      };

      await inchargeService.createMealMenu(hostelId, payload);
      setSuccessBanner(`Meal menu for ${menuMealType} published successfully.`);
      setCreateMenuModalOpen(false);
      setMenuItems('');
      loadData(true);
    } catch (err) {
      console.error('Failed to create meal menu:', err);
      setMenuFormError(err.response?.data?.error?.message || err.message || 'Failed to publish menu.');
    } finally {
      setIsSubmittingMenu(false);
    }
  };

  // Handle Create Meal Timing
  const handleCreateTimingSubmit = async (e) => {
    e.preventDefault();
    setTimingFormError(null);

    const hostelId = assignedHostel?.id || assignedHostel?.hostel_id;
    if (!hostelId) {
      setTimingFormError('No assigned hostel found for session.');
      return;
    }

    if (!timingStartTime || !timingEndTime) {
      setTimingFormError('Start time and end time are required.');
      return;
    }

    if (timingStartTime >= timingEndTime) {
      setTimingFormError('Start time must be strictly before end time.');
      return;
    }

    try {
      setIsSubmittingTiming(true);

      // Create base date for timing
      const todayStr = new Date().toISOString().split('T')[0];
      const startDateTime = new Date(`${todayStr}T${timingStartTime}:00Z`).toISOString();
      const endDateTime = new Date(`${todayStr}T${timingEndTime}:00Z`).toISOString();

      const payload = {
        hostel_id: hostelId,
        meal_type: timingMealType,
        start_time: startDateTime,
        end_time: endDateTime,
      };

      await inchargeService.createMealTiming(hostelId, payload);
      setSuccessBanner(`Meal schedule for ${timingMealType} configured successfully.`);
      setCreateTimingModalOpen(false);
      loadData(true);
    } catch (err) {
      console.error('Failed to create meal timing:', err);
      setTimingFormError(err.response?.data?.error?.message || err.message || 'Failed to configure meal timing.');
    } finally {
      setIsSubmittingTiming(false);
    }
  };

  // Handle Create Food Feedback
  const handleCreateFeedbackSubmit = async (e) => {
    e.preventDefault();
    setFeedbackFormError(null);

    if (!feedbackStudentId || !feedbackMenuId) {
      setFeedbackFormError('Please select both a resident student and a target meal menu.');
      return;
    }

    try {
      setIsSubmittingFeedback(true);
      const payload = {
        student_id: feedbackStudentId,
        menu_id: feedbackMenuId,
        rating: parseInt(feedbackRating, 10),
        comment: feedbackComment.trim() || undefined,
      };

      await inchargeService.createFoodFeedback(payload);
      setSuccessBanner('Food feedback record logged successfully.');
      setFeedbackModalOpen(false);
      setFeedbackComment('');
    } catch (err) {
      console.error('Failed to log feedback:', err);
      setFeedbackFormError(err.response?.data?.error?.message || err.message || 'Failed to submit feedback.');
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  // Columns for Menus Table
  const menuColumns = [
    {
      header: 'Menu Date',
      key: 'menu_date',
      width: '140px',
      render: (row) => (
        <div>
          <strong>{formatDate(row.menu_date)}</strong>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
            Logged: {formatDate(row.created_at)}
          </div>
        </div>
      ),
    },
    {
      header: 'Meal Type',
      key: 'meal_type',
      width: '130px',
      render: (row) => getMealTypeBadge(row.meal_type),
    },
    {
      header: 'Menu Items',
      key: 'items',
      render: (row) => (
        <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: 1.4 }}>
          {row.items}
        </div>
      ),
    },
    {
      header: 'Status',
      key: 'status',
      width: '120px',
      render: (row) => getMenuStatusBadge(row.status),
    },
    {
      header: 'Actions',
      key: 'actions',
      width: '100px',
      align: 'right',
      render: (row) => (
        <button
          type="button"
          className="btn btn-outline"
          style={{ padding: '3px 8px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          onClick={() => {
            setSelectedMenu(row);
            setMenuDetailModalOpen(true);
          }}
        >
          <Eye size={12} /> Details
        </button>
      ),
    },
  ];

  return (
    <div className="mess-page">
      {/* Page Header */}
      <PageHeader
        title="Mess & Dining Operations"
        description={`Meal schedules, daily menus, and dietary operations for ${assignedHostel?.name || 'Assigned Hostel'}.`}
        icon={UtensilsCrossed}
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => loadData(true)}
              disabled={isRefreshing || loading}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                setFeedbackFormError(null);
                setFeedbackModalOpen(true);
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Star size={14} color="#f59e0b" />
              <span>Log Feedback</span>
            </button>

            {canManage && (
              <>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    setTimingFormError(null);
                    setCreateTimingModalOpen(true);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Clock size={14} />
                  <span>Set Timings</span>
                </button>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setMenuFormError(null);
                    setCreateMenuModalOpen(true);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Plus size={14} />
                  <span>Publish Menu</span>
                </button>
              </>
            )}
          </div>
        }
      />

      {/* Success Notification Banner */}
      {successBanner && (
        <div
          style={{
            margin: '0 0 16px 0',
            padding: '12px 16px',
            backgroundColor: '#ecfdf5',
            color: '#065f46',
            borderRadius: '6px',
            border: '1px solid #a7f3d0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.88rem',
            fontWeight: 500,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={18} color="#059669" />
            <span>{successBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessBanner(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#065f46' }}
          >
            ×
          </button>
        </div>
      )}

      {/* KPI Stats Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '14px',
          marginBottom: '20px',
        }}
      >
        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '8px',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#3b82f6',
            }}
          >
            <UtensilsCrossed size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
              Today&apos;s Active Meals
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {todayMenus.length}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              From app.v_today_meal_menus
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '8px',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#10b981',
            }}
          >
            <CalendarDays size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
              Published Menus
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {hostelMenus.length}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Hostel meal menu records
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '8px',
              backgroundColor: 'rgba(234, 179, 8, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#eab308',
            }}
          >
            <Clock size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
              Meal Serving Schedules
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {mealTimings.length}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Configured timing slots
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '8px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ef4444',
            }}
          >
            <Flame size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
              Food Grievances
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {foodComplaints.length}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Category: FOOD complaints
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-color)',
          marginBottom: '20px',
          gap: '8px',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('TODAY')}
          style={{
            padding: '10px 18px',
            fontSize: '0.88rem',
            fontWeight: 600,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'TODAY' ? '3px solid var(--primary-color)' : '3px solid transparent',
            color: activeTab === 'TODAY' ? 'var(--primary-color)' : 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Sparkles size={16} />
          <span>Today&apos;s Dining Schedule</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('MENUS')}
          style={{
            padding: '10px 18px',
            fontSize: '0.88rem',
            fontWeight: 600,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'MENUS' ? '3px solid var(--primary-color)' : '3px solid transparent',
            color: activeTab === 'MENUS' ? 'var(--primary-color)' : 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Calendar size={16} />
          <span>Weekly Dietary Menus ({hostelMenus.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('TIMINGS')}
          style={{
            padding: '10px 18px',
            fontSize: '0.88rem',
            fontWeight: 600,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'TIMINGS' ? '3px solid var(--primary-color)' : '3px solid transparent',
            color: activeTab === 'TIMINGS' ? 'var(--primary-color)' : 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Clock size={16} />
          <span>Meal Serving Hours ({mealTimings.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('GRIEVANCES')}
          style={{
            padding: '10px 18px',
            fontSize: '0.88rem',
            fontWeight: 600,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'GRIEVANCES' ? '3px solid var(--primary-color)' : '3px solid transparent',
            color: activeTab === 'GRIEVANCES' ? 'var(--primary-color)' : 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Flame size={16} />
          <span>Food Grievances ({foodComplaints.length})</span>
        </button>
      </div>

      {/* Main Content Area */}
      {loading && <LoadingState title="Loading dining schedules..." rows={4} />}

      {errorMessage && !loading && (
        <ErrorState
          title="Error Loading Dining Information"
          message={errorMessage}
          onRetry={() => loadData(false)}
        />
      )}

      {!loading && !errorMessage && (
        <>
          {/* TAB 1: TODAY'S DINING SCHEDULE */}
          {activeTab === 'TODAY' && (
            <div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '16px',
                }}
              >
                {['BREAKFAST', 'LUNCH', 'SNACKS', 'DINNER'].map((mType) => {
                  const todayItem = todayMenus.find(
                    (m) => (m.meal_type || '').toUpperCase() === mType
                  );
                  const timingSlot = mealTimings.find(
                    (t) => (t.meal_type || '').toUpperCase() === mType
                  );

                  return (
                    <div
                      key={mType}
                      className="card"
                      style={{
                        padding: '18px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '14px',
                        borderTop: `4px solid ${
                          mType === 'BREAKFAST'
                            ? '#eab308'
                            : mType === 'LUNCH'
                            ? '#3b82f6'
                            : mType === 'SNACKS'
                            ? '#f97316'
                            : '#a855f7'
                        }`,
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {mType}
                          </span>
                          {getMealTypeBadge(mType)}
                        </div>

                        {/* Serving Schedule Window */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '0.8rem',
                            color: 'var(--text-secondary)',
                            marginBottom: '12px',
                          }}
                        >
                          <Clock size={14} color="var(--primary-color)" />
                          <span>
                            {timingSlot
                              ? `${formatMealTime(timingSlot.start_time)} – ${formatMealTime(timingSlot.end_time)}`
                              : 'Standard meal hours apply'}
                          </span>
                        </div>

                        {/* Menu Items Content */}
                        <div
                          style={{
                            padding: '12px',
                            backgroundColor: '#f8fafc',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color)',
                            minHeight: '70px',
                            fontSize: '0.85rem',
                            color: 'var(--text-primary)',
                            lineHeight: 1.5,
                          }}
                        >
                          {todayItem ? (
                            todayItem.items
                          ) : (
                            <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                              No specific menu published for today&apos;s {mType.toLowerCase()}.
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          {todayItem ? getMenuStatusBadge(todayItem.status) : <Badge variant="info">PENDING</Badge>}
                        </div>
                        {todayItem && (
                          <button
                            type="button"
                            className="btn btn-outline"
                            style={{ padding: '3px 8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                            onClick={() => {
                              setSelectedMenu(todayItem);
                              setMenuDetailModalOpen(true);
                            }}
                          >
                            <Eye size={12} /> Inspect
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: WEEKLY / HISTORICAL MENUS */}
          {activeTab === 'MENUS' && (
            <div>
              {/* Toolbar */}
              <div
                className="card"
                style={{
                  padding: '14px 18px',
                  marginBottom: '18px',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '12px',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', flex: 1 }}>
                  <div style={{ minWidth: '220px', flex: 1, maxWidth: '340px' }}>
                    <SearchInput
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search menu items..."
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Meal:</span>
                    <select
                      className="form-control"
                      value={mealTypeFilter}
                      onChange={(e) => setMealTypeFilter(e.target.value)}
                      style={{ fontSize: '0.82rem', padding: '6px 10px', width: 'auto' }}
                    >
                      <option value="ALL">All Meals</option>
                      <option value="BREAKFAST">Breakfast</option>
                      <option value="LUNCH">Lunch</option>
                      <option value="SNACKS">Snacks</option>
                      <option value="DINNER">Dinner</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Date:</span>
                    <input
                      type="date"
                      className="form-control"
                      value={dateFilter}
                      onChange={(e) => setDateFilter(e.target.value)}
                      style={{ fontSize: '0.82rem', padding: '6px 10px', width: 'auto' }}
                    />
                    {dateFilter && (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => setDateFilter('')}
                        style={{ padding: '2px 6px', fontSize: '0.75rem' }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '4px', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '2px' }}>
                  <button
                    type="button"
                    className={`btn ${displayMode === 'CARDS' ? 'btn-primary' : 'btn-text'}`}
                    onClick={() => setDisplayMode('CARDS')}
                    style={{ padding: '5px 10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <LayoutGrid size={14} /> Cards
                  </button>
                  <button
                    type="button"
                    className={`btn ${displayMode === 'TABLE' ? 'btn-primary' : 'btn-text'}`}
                    onClick={() => setDisplayMode('TABLE')}
                    style={{ padding: '5px 10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <List size={14} /> Table
                  </button>
                </div>
              </div>

              {filteredMenus.length === 0 ? (
                <div className="card" style={{ padding: '40px 20px' }}>
                  <EmptyState
                    icon={CalendarDays}
                    title="No Menu Records Found"
                    description="No published meal menus match your filter criteria. Try clearing search or date filters."
                  />
                </div>
              ) : displayMode === 'TABLE' ? (
                <div className="card" style={{ overflow: 'hidden' }}>
                  <DataTable
                    columns={menuColumns}
                    data={filteredMenus}
                    rowKey="id"
                    emptyTitle="No menus found"
                  />
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
                    gap: '16px',
                  }}
                >
                  {filteredMenus.map((m) => (
                    <div
                      key={m.id}
                      className="card"
                      style={{
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '12px',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                          <div>
                            <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {formatDate(m.menu_date)}
                            </span>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                              Logged: {formatDate(m.created_at)}
                            </div>
                          </div>
                          {getMealTypeBadge(m.meal_type)}
                        </div>

                        <div
                          style={{
                            padding: '12px',
                            backgroundColor: '#f8fafc',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color)',
                            fontSize: '0.84rem',
                            color: 'var(--text-primary)',
                            lineHeight: 1.5,
                            minHeight: '60px',
                          }}
                        >
                          {m.items}
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>{getMenuStatusBadge(m.status)}</div>
                        <button
                          type="button"
                          className="btn btn-outline"
                          style={{ padding: '3px 8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                          onClick={() => {
                            setSelectedMenu(m);
                            setMenuDetailModalOpen(true);
                          }}
                        >
                          <Eye size={12} /> Dossier
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: MEAL SERVING HOURS / TIMINGS */}
          {activeTab === 'TIMINGS' && (
            <div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                  gap: '16px',
                }}
              >
                {['BREAKFAST', 'LUNCH', 'SNACKS', 'DINNER'].map((mType) => {
                  const t = mealTimings.find((slot) => (slot.meal_type || '').toUpperCase() === mType);

                  return (
                    <div
                      key={mType}
                      className="card"
                      style={{
                        padding: '18px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '12px',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {mType}
                          </span>
                          {getMealTypeBadge(mType)}
                        </div>

                        <div
                          style={{
                            padding: '14px',
                            backgroundColor: '#f8fafc',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Serving Window</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {t ? `${formatMealTime(t.start_time)} – ${formatMealTime(t.end_time)}` : 'Not Configured'}
                            </div>
                          </div>

                          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                            Status: <strong>{t?.status || 'INACTIVE'}</strong>
                          </div>
                        </div>
                      </div>

                      {canManage && (
                        <button
                          type="button"
                          className="btn btn-outline"
                          style={{ width: '100%', fontSize: '0.78rem', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                          onClick={() => {
                            setTimingMealType(mType);
                            setTimingFormError(null);
                            setCreateTimingModalOpen(true);
                          }}
                        >
                          <Clock size={13} /> Configure {mType}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: FOOD GRIEVANCES & COMPLAINTS */}
          {activeTab === 'GRIEVANCES' && (
            <div>
              <div
                style={{
                  margin: '0 0 16px 0',
                  padding: '10px 14px',
                  backgroundColor: 'rgba(59, 130, 246, 0.08)',
                  borderRadius: '6px',
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                  fontSize: '0.82rem',
                  color: 'var(--text-secondary)',
                }}
              >
                <strong>Food Quality Operations:</strong> Displaying all verified resident grievances classified under category <strong>FOOD</strong> via the institutional complaints repository.
              </div>

              {foodComplaints.length === 0 ? (
                <div className="card" style={{ padding: '40px 20px' }}>
                  <EmptyState
                    icon={UtensilsCrossed}
                    title="No Food Grievances Logged"
                    description="No dining or food quality complaints are currently on record for this hostel."
                  />
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                    gap: '16px',
                  }}
                >
                  {foodComplaints.map((c) => (
                    <div
                      key={c.id}
                      className="card"
                      style={{
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '12px',
                        borderLeft: `4px solid ${
                          c.status === 'RESOLVED' || c.status === 'CLOSED'
                            ? '#10b981'
                            : c.status === 'IN_PROGRESS'
                            ? '#3b82f6'
                            : '#f59e0b'
                        }`,
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                          <div>
                            <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.8rem', color: 'var(--primary-color)' }}>
                              #{c.complaint_number || c.id.substring(0, 8)}
                            </span>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                              Logged: {formatDate(c.created_at)}
                            </div>
                          </div>
                          <Badge
                            variant={
                              c.status === 'RESOLVED' || c.status === 'CLOSED'
                                ? 'success'
                                : c.status === 'IN_PROGRESS'
                                ? 'info'
                                : 'warning'
                            }
                          >
                            {c.status}
                          </Badge>
                        </div>

                        <h4 style={{ margin: '0 0 6px 0', fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                          {c.title}
                        </h4>

                        <div
                          style={{
                            fontSize: '0.82rem',
                            color: 'var(--text-secondary)',
                            lineHeight: 1.4,
                            marginBottom: '8px',
                          }}
                        >
                          {c.description}
                        </div>

                        {c.resolution && (
                          <div
                            style={{
                              padding: '8px 10px',
                              backgroundColor: '#ecfdf5',
                              border: '1px solid #a7f3d0',
                              borderRadius: '4px',
                              fontSize: '0.76rem',
                              color: '#065f46',
                            }}
                          >
                            <strong>Resolution:</strong> {c.resolution}
                          </div>
                        )}
                      </div>

                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-secondary)',
                          borderTop: '1px solid var(--border-color)',
                          paddingTop: '8px',
                        }}
                      >
                        Priority: <strong>{c.priority || 'NORMAL'}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: PUBLISH MEAL MENU                                               */}
      {/* ========================================================================= */}
      <Modal
        isOpen={createMenuModalOpen}
        onClose={() => !isSubmittingMenu && setCreateMenuModalOpen(false)}
        title="Publish Hostel Meal Menu"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setCreateMenuModalOpen(false)}
              disabled={isSubmittingMenu}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleCreateMenuSubmit}
              disabled={isSubmittingMenu}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {isSubmittingMenu && <RefreshCw size={14} className="spin" />}
              <span>{isSubmittingMenu ? 'Publishing...' : 'Publish Menu'}</span>
            </button>
          </div>
        }
      >
        <form onSubmit={handleCreateMenuSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {menuFormError && (
            <div
              style={{
                padding: '10px 14px',
                backgroundColor: '#fef2f2',
                color: '#991b1b',
                borderRadius: '6px',
                fontSize: '0.84rem',
              }}
            >
              {menuFormError}
            </div>
          )}

          <FormField label="Menu Date" required>
            <input
              type="date"
              className="form-control"
              value={menuDate}
              onChange={(e) => setMenuDate(e.target.value)}
              required
            />
          </FormField>

          <FormField label="Meal Type" required>
            <select
              className="form-control"
              value={menuMealType}
              onChange={(e) => setMenuMealType(e.target.value)}
              required
            >
              <option value="BREAKFAST">Breakfast</option>
              <option value="LUNCH">Lunch</option>
              <option value="SNACKS">Evening Snacks</option>
              <option value="DINNER">Dinner</option>
            </select>
          </FormField>

          <FormField label="Menu Items Description" required helpText="Specify dietary items, beverages, and accompaniments.">
            <textarea
              className="form-control"
              rows={4}
              value={menuItems}
              onChange={(e) => setMenuItems(e.target.value)}
              placeholder="e.g. Steamed Rice, Dal Makhani, Paneer Butter Masala, Roti, Fresh Salad, Gulab Jamun"
              required
            />
          </FormField>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 2: CONFIGURE MEAL TIMING                                           */}
      {/* ========================================================================= */}
      <Modal
        isOpen={createTimingModalOpen}
        onClose={() => !isSubmittingTiming && setCreateTimingModalOpen(false)}
        title="Configure Meal Serving Window"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setCreateTimingModalOpen(false)}
              disabled={isSubmittingTiming}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleCreateTimingSubmit}
              disabled={isSubmittingTiming}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {isSubmittingTiming && <RefreshCw size={14} className="spin" />}
              <span>{isSubmittingTiming ? 'Saving...' : 'Save Timing'}</span>
            </button>
          </div>
        }
      >
        <form onSubmit={handleCreateTimingSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {timingFormError && (
            <div
              style={{
                padding: '10px 14px',
                backgroundColor: '#fef2f2',
                color: '#991b1b',
                borderRadius: '6px',
                fontSize: '0.84rem',
              }}
            >
              {timingFormError}
            </div>
          )}

          <FormField label="Meal Type" required>
            <select
              className="form-control"
              value={timingMealType}
              onChange={(e) => setTimingMealType(e.target.value)}
              required
            >
              <option value="BREAKFAST">Breakfast</option>
              <option value="LUNCH">Lunch</option>
              <option value="SNACKS">Evening Snacks</option>
              <option value="DINNER">Dinner</option>
            </select>
          </FormField>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <FormField label="Start Time (HH:mm)" required>
              <input
                type="time"
                className="form-control"
                value={timingStartTime}
                onChange={(e) => setTimingStartTime(e.target.value)}
                required
              />
            </FormField>

            <FormField label="End Time (HH:mm)" required>
              <input
                type="time"
                className="form-control"
                value={timingEndTime}
                onChange={(e) => setTimingEndTime(e.target.value)}
                required
              />
            </FormField>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 3: LOG FOOD FEEDBACK                                               */}
      {/* ========================================================================= */}
      <Modal
        isOpen={feedbackModalOpen}
        onClose={() => !isSubmittingFeedback && setFeedbackModalOpen(false)}
        title="Submit Resident Food Feedback"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setFeedbackModalOpen(false)}
              disabled={isSubmittingFeedback}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleCreateFeedbackSubmit}
              disabled={isSubmittingFeedback}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {isSubmittingFeedback && <RefreshCw size={14} className="spin" />}
              <span>{isSubmittingFeedback ? 'Submitting...' : 'Submit Rating'}</span>
            </button>
          </div>
        }
      >
        <form onSubmit={handleCreateFeedbackSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {feedbackFormError && (
            <div
              style={{
                padding: '10px 14px',
                backgroundColor: '#fef2f2',
                color: '#991b1b',
                borderRadius: '6px',
                fontSize: '0.84rem',
              }}
            >
              {feedbackFormError}
            </div>
          )}

          <FormField label="Resident Student" required helpText="Select the resident submitting the food quality rating.">
            <select
              className="form-control"
              value={feedbackStudentId}
              onChange={(e) => setFeedbackStudentId(e.target.value)}
              required
            >
              <option value="">-- Choose Resident Student --</option>
              {residents.map((r) => {
                const sId = r.student_id || r.id;
                const name = r.full_name || `${r.first_name || ''} ${r.last_name || ''}`.trim() || 'Resident';
                return (
                  <option key={sId} value={sId}>
                    {name} ({r.admission_number || r.room_name || 'Resident'})
                  </option>
                );
              })}
            </select>
          </FormField>

          <FormField label="Target Meal Menu" required helpText="Select which published menu is being evaluated.">
            <select
              className="form-control"
              value={feedbackMenuId}
              onChange={(e) => setFeedbackMenuId(e.target.value)}
              required
            >
              <option value="">-- Choose Menu --</option>
              {hostelMenus.map((m) => (
                <option key={m.id} value={m.id}>
                  {formatDate(m.menu_date)} — {m.meal_type} ({m.items ? m.items.substring(0, 30) + '...' : ''})
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Rating (1 - 5 Stars)" required>
            <select
              className="form-control"
              value={feedbackRating}
              onChange={(e) => setFeedbackRating(e.target.value)}
              required
            >
              <option value={5}>★★★★★ (5 - Excellent)</option>
              <option value={4}>★★★★☆ (4 - Good)</option>
              <option value={3}>★★★☆☆ (3 - Average)</option>
              <option value={2}>★★☆☆☆ (2 - Below Standard)</option>
              <option value={1}>★☆☆☆☆ (1 - Poor / Unsatisfactory)</option>
            </select>
          </FormField>

          <FormField label="Feedback Notes / Comments">
            <textarea
              className="form-control"
              rows={3}
              value={feedbackComment}
              onChange={(e) => setFeedbackComment(e.target.value)}
              placeholder="e.g. Sambar salt level was balanced; rotis were served warm and fresh."
            />
          </FormField>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 4: MENU DETAIL DOSSIER                                             */}
      {/* ========================================================================= */}
      <Modal
        isOpen={menuDetailModalOpen}
        onClose={() => setMenuDetailModalOpen(false)}
        title="Dietary Menu Particulars"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-primary" onClick={() => setMenuDetailModalOpen(false)}>
              Close
            </button>
          </div>
        }
      >
        {selectedMenu && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div
              style={{
                padding: '14px',
                backgroundColor: '#f8fafc',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                    {formatDate(selectedMenu.menu_date)} — {selectedMenu.meal_type}
                  </h3>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Menu ID: #{selectedMenu.id || selectedMenu.meal_menu_id}
                  </div>
                </div>
                <div>{getMealTypeBadge(selectedMenu.meal_type)}</div>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '6px' }}>
                Prepared Items
              </div>
              <div
                style={{
                  padding: '14px',
                  backgroundColor: '#ffffff',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.9rem',
                  lineHeight: 1.6,
                }}
              >
                {selectedMenu.items}
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
                fontSize: '0.82rem',
                backgroundColor: '#f8fafc',
                padding: '12px',
                borderRadius: '6px',
              }}
            >
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Status: </span>
                <strong>{selectedMenu.status || 'PUBLISHED'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Created: </span>
                <span>{formatDate(selectedMenu.created_at)}</span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
