import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../../shared/auth/useAuth';
import adminService from '../services/adminService';
import {
  Utensils,
  Clock,
  Calendar,
  Coffee,
  CheckCircle2,
  AlertTriangle,
  Search,
  Filter,
  Plus,
  RefreshCw,
  Building2,
  Sparkles,
  Star,
  Send,
  MessageSquare,
  ChevronRight,
  Info,
  CalendarDays,
  ShieldCheck,
} from 'lucide-react';
import {
  PageHeader,
  DataTable,
  SearchInput,
  FilterControls,
  Modal,
  FormField,
  LoadingState,
  EmptyState,
  ErrorState,
} from '../../../shared/components';

export default function AdminFoodPage() {
  const { user } = useAuth();

  // Permission checks
  const canManageMess = useMemo(() => {
    if (!user) return true;
    if (['COLLEGE_ADMIN', 'ADMIN', 'HOSTEL_ADMIN'].includes(user?.role)) return true;
    if (Array.isArray(user?.permissions)) {
      return (
        user.permissions.includes('hostel.manage') ||
        user.permissions.includes('*')
      );
    }
    return true;
  }, [user]);

  // Master Data State
  const [hostels, setHostels] = useState([]);
  const [selectedHostelId, setSelectedHostelId] = useState('');
  const [todayMenus, setTodayMenus] = useState([]);
  const [hostelMenus, setHostelMenus] = useState([]);
  const [mealTimings, setMealTimings] = useState([]);
  const [students, setStudents] = useState([]);

  // UI Tabs & Loading States
  const [activeTab, setActiveTab] = useState('TODAY'); // 'TODAY' | 'MENUS' | 'TIMINGS' | 'FEEDBACK'
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successBanner, setSuccessBanner] = useState(null);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [mealTypeFilter, setMealTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals Visibility
  const [createMenuModalOpen, setCreateMenuModalOpen] = useState(false);
  const [createTimingModalOpen, setCreateTimingModalOpen] = useState(false);
  const [createFeedbackModalOpen, setCreateFeedbackModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Menu Form State
  const [menuFormData, setMenuFormData] = useState({
    hostel_id: '',
    menu_date: new Date().toISOString().split('T')[0],
    meal_type: 'BREAKFAST',
    items: '',
  });

  // Timing Form State
  const [timingFormData, setTimingFormData] = useState({
    hostel_id: '',
    meal_type: 'BREAKFAST',
    start_time: '07:30',
    end_time: '09:30',
  });

  // Feedback Form State
  const [feedbackFormData, setFeedbackFormData] = useState({
    student_id: '',
    menu_id: '',
    rating: 5,
    comment: '',
  });

  // Initial Fetch: Hostels, Today Menus, Students
  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage(null);

      const [hostelsRes, todayRes, studentsRes] = await Promise.allSettled([
        adminService.getHostels(),
        adminService.getTodayMenus(),
        adminService.getStudents({ limit: 100 }),
      ]);

      const hostelList = hostelsRes.status === 'fulfilled'
        ? (Array.isArray(hostelsRes.value) ? hostelsRes.value : hostelsRes.value?.hostels || hostelsRes.value?.data || [])
        : [];
      setHostels(hostelList);

      if (hostelList.length > 0 && !selectedHostelId) {
        setSelectedHostelId(hostelList[0].id);
      }

      const todayList = todayRes.status === 'fulfilled'
        ? (Array.isArray(todayRes.value) ? todayRes.value : todayRes.value?.data || [])
        : [];
      setTodayMenus(todayList);

      const studentList = studentsRes.status === 'fulfilled'
        ? (Array.isArray(studentsRes.value) ? studentsRes.value : studentsRes.value?.students || studentsRes.value?.data || [])
        : [];
      setStudents(studentList);
    } catch (err) {
      console.error('Failed to load mess data:', err);
      setErrorMessage(err?.response?.data?.error?.message || err.message || 'Unable to load dining information.');
    } finally {
      setLoading(false);
    }
  }, [selectedHostelId]);

  // Load Hostel-Specific Menus & Timings when selectedHostelId changes
  const loadHostelDetails = useCallback(async (hId) => {
    if (!hId) return;
    try {
      setIsRefreshing(true);
      const [menusRes, timingsRes] = await Promise.allSettled([
        adminService.getHostelMealMenus(hId),
        adminService.getHostelMealTimings(hId),
      ]);

      const mList = menusRes.status === 'fulfilled'
        ? (Array.isArray(menusRes.value) ? menusRes.value : menusRes.value?.data || [])
        : [];
      setHostelMenus(mList);

      const tList = timingsRes.status === 'fulfilled'
        ? (Array.isArray(timingsRes.value) ? timingsRes.value : timingsRes.value?.data || [])
        : [];
      setMealTimings(tList);
    } catch (err) {
      console.error('Error fetching hostel mess details:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    if (selectedHostelId) {
      loadHostelDetails(selectedHostelId);
      setMenuFormData((prev) => ({ ...prev, hostel_id: selectedHostelId }));
      setTimingFormData((prev) => ({ ...prev, hostel_id: selectedHostelId }));
    }
  }, [selectedHostelId, loadHostelDetails]);

  // Handle Create Meal Menu
  const handleCreateMenuSubmit = async (e) => {
    e.preventDefault();
    if (!menuFormData.hostel_id || !menuFormData.menu_date || !menuFormData.meal_type || !menuFormData.items.trim()) {
      setErrorMessage('Please fill in all required menu fields.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);

      // Construct ISO date string (YYYY-MM-DDT00:00:00Z)
      const menuDateISO = new Date(`${menuFormData.menu_date}T00:00:00Z`).toISOString();

      await adminService.createMealMenu(menuFormData.hostel_id, {
        hostel_id: menuFormData.hostel_id,
        menu_date: menuDateISO,
        meal_type: menuFormData.meal_type,
        items: menuFormData.items.trim(),
      });

      setSuccessBanner(`Meal menu for ${menuFormData.meal_type} successfully published!`);
      setCreateMenuModalOpen(false);
      setMenuFormData({
        hostel_id: selectedHostelId,
        menu_date: new Date().toISOString().split('T')[0],
        meal_type: 'BREAKFAST',
        items: '',
      });

      // Reload
      await Promise.all([
        loadHostelDetails(selectedHostelId),
        adminService.getTodayMenus().then((res) => {
          setTodayMenus(Array.isArray(res) ? res : res?.data || []);
        }),
      ]);
    } catch (err) {
      console.error('Failed to create meal menu:', err);
      setErrorMessage(err?.response?.data?.error?.message || err.message || 'Could not save meal menu.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Create Meal Timing
  const handleCreateTimingSubmit = async (e) => {
    e.preventDefault();
    if (!timingFormData.hostel_id || !timingFormData.meal_type || !timingFormData.start_time || !timingFormData.end_time) {
      setErrorMessage('Please fill in all required timing fields.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);

      // Backend expects time.Time where start_time < end_time
      const baseDate = '2026-01-01';
      const startISO = new Date(`${baseDate}T${timingFormData.start_time}:00Z`).toISOString();
      const endISO = new Date(`${baseDate}T${timingFormData.end_time}:00Z`).toISOString();

      if (new Date(startISO) >= new Date(endISO)) {
        setErrorMessage('Serving start time must be before end time.');
        setSubmitting(false);
        return;
      }

      await adminService.createMealTiming(timingFormData.hostel_id, {
        hostel_id: timingFormData.hostel_id,
        meal_type: timingFormData.meal_type,
        start_time: startISO,
        end_time: endISO,
      });

      setSuccessBanner(`Schedule timings for ${timingFormData.meal_type} saved successfully!`);
      setCreateTimingModalOpen(false);
      await loadHostelDetails(selectedHostelId);
    } catch (err) {
      console.error('Failed to configure meal timing:', err);
      setErrorMessage(err?.response?.data?.error?.message || err.message || 'Could not save meal schedule.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Submit Food Feedback
  const handleCreateFeedbackSubmit = async (e) => {
    e.preventDefault();
    if (!feedbackFormData.student_id || !feedbackFormData.menu_id) {
      setErrorMessage('Please select a student and target meal menu.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);

      await adminService.submitFoodFeedback({
        student_id: feedbackFormData.student_id,
        menu_id: feedbackFormData.menu_id,
        rating: parseInt(feedbackFormData.rating, 10),
        comment: feedbackFormData.comment ? feedbackFormData.comment.trim() : null,
      });

      setSuccessBanner('Food feedback and rating recorded successfully!');
      setCreateFeedbackModalOpen(false);
      setFeedbackFormData({
        student_id: '',
        menu_id: '',
        rating: 5,
        comment: '',
      });
    } catch (err) {
      console.error('Failed to submit food feedback:', err);
      setErrorMessage(err?.response?.data?.error?.message || err.message || 'Could not record food feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  // Helper formatting
  const formatMealTime = (isoString) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
    } catch {
      return isoString;
    }
  };

  const formatMenuDate = (isoString) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  const getMealBadgeColor = (type) => {
    switch (type) {
      case 'BREAKFAST':
        return 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300';
      case 'LUNCH':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300';
      case 'SNACKS':
        return 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-300';
      case 'DINNER':
        return 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950 dark:text-purple-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-300';
    }
  };

  // Filtered menus for selected hostel
  const filteredMenus = useMemo(() => {
    return hostelMenus.filter((item) => {
      const matchesSearch =
        !searchTerm ||
        (item.items && item.items.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.meal_type && item.meal_type.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesMeal = mealTypeFilter === 'ALL' || item.meal_type === mealTypeFilter;
      const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;

      return matchesSearch && matchesMeal && matchesStatus;
    });
  }, [hostelMenus, searchTerm, mealTypeFilter, statusFilter]);

  // Selected hostel name lookup
  const currentHostel = hostels.find((h) => h.id === selectedHostelId);

  // Table Columns for Meal Menus
  const menuColumns = [
    {
      key: 'menu_date',
      title: 'Menu Date',
      render: (row) => (
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span className="font-medium text-slate-900 dark:text-slate-100">
            {formatMenuDate(row.menu_date)}
          </span>
        </div>
      ),
    },
    {
      key: 'meal_type',
      title: 'Meal Type',
      render: (row) => (
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getMealBadgeColor(row.meal_type)}`}>
          {row.meal_type}
        </span>
      ),
    },
    {
      key: 'items',
      title: 'Food Items & Specialties',
      render: (row) => (
        <div className="max-w-md">
          <p className="text-sm text-slate-800 dark:text-slate-200 font-medium whitespace-pre-line">
            {row.items}
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      title: 'Status',
      render: (row) => (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
            row.status === 'PUBLISHED'
              ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300'
              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
          }`}
        >
          {row.status || 'PUBLISHED'}
        </span>
      ),
    },
    {
      key: 'actions',
      title: 'Actions',
      render: (row) => (
        <button
          onClick={() => {
            setFeedbackFormData((prev) => ({
              ...prev,
              menu_id: row.id,
            }));
            setCreateFeedbackModalOpen(true);
          }}
          className="text-xs font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 inline-flex items-center gap-1"
        >
          <Star className="w-3.5 h-3.5" />
          Record Feedback
        </button>
      ),
    },
  ];

  // Table Columns for Meal Timings
  const timingColumns = [
    {
      key: 'meal_type',
      title: 'Meal Service',
      render: (row) => (
        <div className="flex items-center gap-2">
          <Utensils className="w-4 h-4 text-slate-400" />
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getMealBadgeColor(row.meal_type)}`}>
            {row.meal_type}
          </span>
        </div>
      ),
    },
    {
      key: 'serving_window',
      title: 'Service Hours',
      render: (row) => (
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
          <Clock className="w-4 h-4 text-indigo-500" />
          <span>
            {formatMealTime(row.start_time)} – {formatMealTime(row.end_time)}
          </span>
        </div>
      ),
    },
    {
      key: 'status',
      title: 'Status',
      render: (row) => (
        <span
          className={`px-2 py-0.5 rounded text-xs font-medium ${
            row.status === 'ACTIVE'
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
          }`}
        >
          {row.status || 'ACTIVE'}
        </span>
      ),
    },
    {
      key: 'updated_at',
      title: 'Last Updated',
      render: (row) => (
        <span className="text-xs text-slate-500">
          {row.updated_at ? new Date(row.updated_at).toLocaleDateString() : '—'}
        </span>
      ),
    },
  ];

  if (loading && hostels.length === 0) {
    return <LoadingState message="Connecting to hostel dining services..." />;
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <PageHeader
        title="Hostel Mess & Dining Management"
        subtitle="Manage daily meal schedules, serving windows, today's menu broadcast, and student dining feedback."
        icon={Utensils}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                loadInitialData();
                if (selectedHostelId) loadHostelDetails(selectedHostelId);
              }}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-750 transition"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>

            {canManageMess && (
              <>
                <button
                  onClick={() => setCreateTimingModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-750 transition"
                >
                  <Clock className="w-4 h-4 text-indigo-500" />
                  Set Timings
                </button>
                <button
                  onClick={() => setCreateMenuModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  Publish Menu
                </button>
              </>
            )}
          </div>
        }
      />

      {/* Success Banner */}
      {successBanner && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-emerald-800 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="text-sm font-medium">{successBanner}</span>
          </div>
          <button
            onClick={() => setSuccessBanner(null)}
            className="text-xs font-semibold uppercase hover:underline ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg flex items-center justify-between text-rose-800 dark:bg-rose-950 dark:border-rose-800 dark:text-rose-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
            <span className="text-sm font-medium">{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-xs font-semibold uppercase hover:underline ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top Level KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-lg">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {hostels.length}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Active Hostels with Mess
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-lg">
            <CalendarDays className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {todayMenus.length}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Today's Broadcast Menus
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 rounded-lg">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {mealTimings.length}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Configured Serving Windows
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 rounded-lg">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {hostelMenus.length}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Published Menus (This Hostel)
            </div>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex border-b border-slate-200 dark:border-slate-700 gap-4">
        <button
          onClick={() => setActiveTab('TODAY')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'TODAY'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Today's Live Menu Broadcast
          {todayMenus.length > 0 && (
            <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
              {todayMenus.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('MENUS')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'MENUS'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Utensils className="w-4 h-4" />
          Daily Meal Menus
        </button>

        <button
          onClick={() => setActiveTab('TIMINGS')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'TIMINGS'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Clock className="w-4 h-4" />
          Meal Timings Schedule
        </button>
      </div>

      {/* Hostel Selector bar (relevant for Menus & Timings tabs) */}
      <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Building2 className="w-5 h-5 text-indigo-600" />
          <div>
            <label className="text-xs font-semibold uppercase text-slate-500 tracking-wider">
              Selected Hostel Mess:
            </label>
            <div className="font-semibold text-slate-900 dark:text-slate-100">
              {currentHostel ? `${currentHostel.name} (${currentHostel.code})` : 'Select a hostel'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedHostelId}
            onChange={(e) => setSelectedHostelId(e.target.value)}
            className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
          >
            {hostels.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name} ({h.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* TAB CONTENT 1: TODAY'S LIVE MENU BROADCAST */}
      {activeTab === 'TODAY' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              Today's Meals Schedule Across Hostels
            </h3>
            <span className="text-xs text-slate-500 font-medium">
              Today: {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>

          {todayMenus.length === 0 ? (
            <EmptyState
              icon={Utensils}
              title="No Menus Published for Today"
              message="No meals have been scheduled for today across institutional hostels yet. Click 'Publish Menu' to post today's breakfast, lunch, snacks, or dinner."
              action={
                canManageMess && (
                  <button
                    onClick={() => {
                      setMenuFormData((prev) => ({
                        ...prev,
                        menu_date: new Date().toISOString().split('T')[0],
                      }));
                      setCreateMenuModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
                  >
                    <Plus className="w-4 h-4" />
                    Publish Today's Menu
                  </button>
                )
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {['BREAKFAST', 'LUNCH', 'SNACKS', 'DINNER'].map((meal) => {
                const mealsOfType = todayMenus.filter((m) => m.meal_type === meal);
                return (
                  <div
                    key={meal}
                    className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col"
                  >
                    <div className={`px-4 py-3 border-b flex items-center justify-between ${getMealBadgeColor(meal)}`}>
                      <span className="font-bold text-sm tracking-wide">{meal}</span>
                      <Utensils className="w-4 h-4 opacity-75" />
                    </div>

                    <div className="p-4 space-y-4 flex-1 flex flex-col justify-between">
                      {mealsOfType.length === 0 ? (
                        <div className="py-6 text-center text-slate-400 text-xs italic">
                          No menu posted for this meal slot yet.
                        </div>
                      ) : (
                        mealsOfType.map((item, idx) => (
                          <div key={idx} className="border-b last:border-b-0 pb-3 last:pb-0">
                            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                              <span>{item.hostel_name || 'All Hostels'}</span>
                              <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                {item.status}
                              </span>
                            </div>
                            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 whitespace-pre-line leading-relaxed">
                              {item.items}
                            </p>
                            {item.meal_menu_id && (
                              <button
                                onClick={() => {
                                  setFeedbackFormData((prev) => ({
                                    ...prev,
                                    menu_id: item.meal_menu_id,
                                  }));
                                  setCreateFeedbackModalOpen(true);
                                }}
                                className="mt-2 text-xs font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 inline-flex items-center gap-1"
                              >
                                <Star className="w-3.5 h-3.5" />
                                Review Meal
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT 2: DAILY MEAL MENUS (TABLE) */}
      {activeTab === 'MENUS' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex-1 min-w-[240px] max-w-md">
              <SearchInput
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="Search food items or meal types..."
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={mealTypeFilter}
                onChange={(e) => setMealTypeFilter(e.target.value)}
                className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
              >
                <option value="ALL">All Meal Types</option>
                <option value="BREAKFAST">Breakfast</option>
                <option value="LUNCH">Lunch</option>
                <option value="SNACKS">Snacks</option>
                <option value="DINNER">Dinner</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
              >
                <option value="ALL">All Statuses</option>
                <option value="PUBLISHED">Published</option>
                <option value="DRAFT">Draft</option>
              </select>
            </div>
          </div>

          <DataTable
            columns={menuColumns}
            data={filteredMenus}
            loading={isRefreshing}
            emptyMessage={
              <EmptyState
                icon={Utensils}
                title="No Menus Configured"
                message={`No meal menus found for ${currentHostel?.name || 'this hostel'}.`}
                action={
                  canManageMess && (
                    <button
                      onClick={() => setCreateMenuModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
                    >
                      <Plus className="w-4 h-4" />
                      Add First Menu
                    </button>
                  )
                }
              />
            }
          />
        </div>
      )}

      {/* TAB CONTENT 3: MEAL TIMINGS SCHEDULE */}
      {activeTab === 'TIMINGS' && (
        <div className="space-y-4">
          <div className="p-4 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900 rounded-xl flex items-start gap-3">
            <Info className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
            <div className="text-sm text-slate-700 dark:text-slate-300">
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                Operating Window Rules:{' '}
              </span>
              Students and resident scholars may access the hostel dining hall during the defined
              operating hours. These timings automatically synchronize across the resident mobile app
              and security entrance gates.
            </div>
          </div>

          <DataTable
            columns={timingColumns}
            data={mealTimings}
            loading={isRefreshing}
            emptyMessage={
              <EmptyState
                icon={Clock}
                title="No Timings Configured"
                message={`No service timings set for ${currentHostel?.name || 'this hostel'}.`}
                action={
                  canManageMess && (
                    <button
                      onClick={() => setCreateTimingModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
                    >
                      <Plus className="w-4 h-4" />
                      Configure Timings
                    </button>
                  )
                }
              />
            }
          />
        </div>
      )}

      {/* MODAL 1: PUBLISH MEAL MENU */}
      <Modal
        isOpen={createMenuModalOpen}
        onClose={() => !submitting && setCreateMenuModalOpen(false)}
        title="Publish Daily Meal Menu"
      >
        <form onSubmit={handleCreateMenuSubmit} className="space-y-4">
          <FormField label="Hostel Mess" required>
            <select
              value={menuFormData.hostel_id}
              onChange={(e) => setMenuFormData({ ...menuFormData, hostel_id: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
              required
            >
              {hostels.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} ({h.code})
                </option>
              ))}
            </select>
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Menu Date" required>
              <input
                type="date"
                value={menuFormData.menu_date}
                onChange={(e) => setMenuFormData({ ...menuFormData, menu_date: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
                required
              />
            </FormField>

            <FormField label="Meal Type" required>
              <select
                value={menuFormData.meal_type}
                onChange={(e) => setMenuFormData({ ...menuFormData, meal_type: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
                required
              >
                <option value="BREAKFAST">Breakfast</option>
                <option value="LUNCH">Lunch</option>
                <option value="SNACKS">Snacks</option>
                <option value="DINNER">Dinner</option>
              </select>
            </FormField>
          </div>

          <FormField
            label="Food Items & Descriptions"
            required
            helper="Enter the dishes, beverages, and sides separated by lines or commas."
          >
            <textarea
              rows={4}
              value={menuFormData.items}
              onChange={(e) => setMenuFormData({ ...menuFormData, items: e.target.value })}
              placeholder="e.g. Idli, Medu Vada, Sambar, Coconut Chutney, Masala Tea"
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              required
            />
          </FormField>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setCreateMenuModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow flex items-center gap-2"
            >
              {submitting && <RefreshCw className="w-4 h-4 animate-spin" />}
              Publish Menu
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: CONFIGURE MEAL TIMING */}
      <Modal
        isOpen={createTimingModalOpen}
        onClose={() => !submitting && setCreateTimingModalOpen(false)}
        title="Configure Meal Operating Hours"
      >
        <form onSubmit={handleCreateTimingSubmit} className="space-y-4">
          <FormField label="Hostel Mess" required>
            <select
              value={timingFormData.hostel_id}
              onChange={(e) => setTimingFormData({ ...timingFormData, hostel_id: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
              required
            >
              {hostels.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} ({h.code})
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Meal Type" required>
            <select
              value={timingFormData.meal_type}
              onChange={(e) => setTimingFormData({ ...timingFormData, meal_type: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
              required
            >
              <option value="BREAKFAST">Breakfast</option>
              <option value="LUNCH">Lunch</option>
              <option value="SNACKS">Snacks</option>
              <option value="DINNER">Dinner</option>
            </select>
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Start Time (HH:MM)" required>
              <input
                type="time"
                value={timingFormData.start_time}
                onChange={(e) => setTimingFormData({ ...timingFormData, start_time: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
                required
              />
            </FormField>

            <FormField label="End Time (HH:MM)" required>
              <input
                type="time"
                value={timingFormData.end_time}
                onChange={(e) => setTimingFormData({ ...timingFormData, end_time: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
                required
              />
            </FormField>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setCreateTimingModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow flex items-center gap-2"
            >
              {submitting && <RefreshCw className="w-4 h-4 animate-spin" />}
              Save Timings
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: RECORD FOOD FEEDBACK */}
      <Modal
        isOpen={createFeedbackModalOpen}
        onClose={() => !submitting && setCreateFeedbackModalOpen(false)}
        title="Record Student Dining Feedback"
      >
        <form onSubmit={handleCreateFeedbackSubmit} className="space-y-4">
          <FormField label="Student" required>
            <select
              value={feedbackFormData.student_id}
              onChange={(e) => setFeedbackFormData({ ...feedbackFormData, student_id: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
              required
            >
              <option value="">Select a student...</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.first_name} {s.last_name} ({s.enrollment_number || s.email})
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Target Meal Menu ID" required>
            <input
              type="text"
              value={feedbackFormData.menu_id}
              onChange={(e) => setFeedbackFormData({ ...feedbackFormData, menu_id: e.target.value })}
              placeholder="UUID of the meal menu"
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 font-mono"
              required
            />
          </FormField>

          <FormField label="Rating (1 to 5 Stars)" required>
            <div className="flex items-center gap-3">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  type="button"
                  key={star}
                  onClick={() => setFeedbackFormData({ ...feedbackFormData, rating: star })}
                  className="p-1.5 focus:outline-none transition transform hover:scale-110"
                >
                  <Star
                    className={`w-7 h-7 ${
                      star <= feedbackFormData.rating
                        ? 'text-amber-400 fill-amber-400'
                        : 'text-slate-300 dark:text-slate-600'
                    }`}
                  />
                </button>
              ))}
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-2">
                {feedbackFormData.rating} / 5 Stars
              </span>
            </div>
          </FormField>

          <FormField label="Student Feedback & Dietary Comments">
            <textarea
              rows={3}
              value={feedbackFormData.comment}
              onChange={(e) => setFeedbackFormData({ ...feedbackFormData, comment: e.target.value })}
              placeholder="e.g. Food was served warm and quality was satisfactory..."
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
            />
          </FormField>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setCreateFeedbackModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow flex items-center gap-2"
            >
              {submitting && <RefreshCw className="w-4 h-4 animate-spin" />}
              Submit Feedback
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
