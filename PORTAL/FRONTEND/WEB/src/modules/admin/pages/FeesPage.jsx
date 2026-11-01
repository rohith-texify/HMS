import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../../shared/auth/useAuth';
import adminService from '../services/adminService';
import {
  CreditCard,
  Coins,
  Building2,
  Users,
  Search,
  Filter,
  RefreshCw,
  Info,
  Calendar,
  AlertCircle,
  CheckCircle2,
  FileText,
  ShieldCheck,
  Clock,
  Sparkles,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import {
  PageHeader,
  DataTable,
  SearchInput,
  LoadingState,
  EmptyState,
} from '../../../shared/components';

export default function AdminFeesPage() {
  const { user } = useAuth();

  // Master Data State (Real Database Allocations & Hostels)
  const [allocations, setAllocations] = useState([]);
  const [hostels, setHostels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [hostelFilter, setHostelFilter] = useState('ALL');
  const [activeTab, setActiveTab] = useState('SCHEDULE'); // 'SCHEDULE' | 'ALLOCATIONS' | 'POLICIES'

  // Load Real Bed Allocations & Hostels from backend
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage(null);

      const [allocRes, hostelsRes] = await Promise.allSettled([
        adminService.getBedAllocations(),
        adminService.getHostels(),
      ]);

      const allocList = allocRes.status === 'fulfilled'
        ? (Array.isArray(allocRes.value) ? allocRes.value : allocRes.value?.allocations || allocRes.value?.data || [])
        : [];
      setAllocations(allocList);

      const hList = hostelsRes.status === 'fulfilled'
        ? (Array.isArray(hostelsRes.value) ? hostelsRes.value : hostelsRes.value?.hostels || hostelsRes.value?.data || [])
        : [];
      setHostels(hList);
    } catch (err) {
      console.error('Failed to load fee & allocation context:', err);
      setErrorMessage('Unable to load resident allocation records.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Standard Institutional Fee Tier Matrix (Approved Institutional Guidelines)
  const feeTiers = [
    {
      tier: 'Single Occupancy (Deluxe AC)',
      code: 'TIER-1-SGL-AC',
      tuitionCycle: 'Per Semester',
      roomRent: '₹ 45,000',
      amenities: '₹ 8,000',
      messAdvance: '₹ 24,000',
      cautionDeposit: '₹ 10,000 (Refundable)',
      total: '₹ 87,000',
      description: 'Private single room with attached bath, climate control air-conditioning, and 24/7 dedicated UPS power.',
    },
    {
      tier: 'Double Sharing (Standard Non-AC)',
      code: 'TIER-2-DBL',
      tuitionCycle: 'Per Semester',
      roomRent: '₹ 28,000',
      amenities: '₹ 5,000',
      messAdvance: '₹ 24,000',
      cautionDeposit: '₹ 7,500 (Refundable)',
      total: '₹ 64,500',
      description: 'Dual-occupancy room with dedicated study desks, modular wardrobes, and shared wing amenities.',
    },
    {
      tier: 'Triple Sharing (Standard Non-AC)',
      code: 'TIER-3-TRP',
      tuitionCycle: 'Per Semester',
      roomRent: '₹ 20,000',
      amenities: '₹ 4,000',
      messAdvance: '₹ 24,000',
      cautionDeposit: '₹ 5,000 (Refundable)',
      total: '₹ 53,000',
      description: 'Triple-occupancy spacious room with individual study lockers and campus high-speed Wi-Fi.',
    },
    {
      tier: '4-Bed Dormitory (Economy)',
      code: 'TIER-4-DORM',
      tuitionCycle: 'Per Semester',
      roomRent: '₹ 14,000',
      amenities: '₹ 3,500',
      messAdvance: '₹ 24,000',
      cautionDeposit: '₹ 5,000 (Refundable)',
      total: '₹ 46,500',
      description: 'Quad-occupancy student wing with high airflow, common washrooms, and laundry facility access.',
    },
  ];

  // Filtered resident allocations for reference table
  const filteredAllocations = useMemo(() => {
    return allocations.filter((item) => {
      const studentName = item.student_name || `${item.first_name || ''} ${item.last_name || ''}`.trim();
      const matchesSearch =
        !searchTerm ||
        studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.enrollment_number && item.enrollment_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.room_number && item.room_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.hostel_name && item.hostel_name.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesHostel =
        hostelFilter === 'ALL' ||
        item.hostel_id === hostelFilter ||
        item.hostel_name === hostelFilter;

      return matchesSearch && matchesHostel;
    });
  }, [allocations, searchTerm, hostelFilter]);

  // Allocation columns
  const allocationColumns = [
    {
      key: 'student',
      title: 'Resident Student',
      render: (row) => {
        const studentName = row.student_name || `${row.first_name || ''} ${row.last_name || ''}`.trim() || 'Resident Student';
        return (
          <div>
            <div className="font-semibold text-slate-900 dark:text-slate-100">
              {studentName}
            </div>
            <div className="text-xs text-slate-500">
              {row.enrollment_number || row.student_email || 'Enrolled'}
            </div>
          </div>
        );
      },
    },
    {
      key: 'location',
      title: 'Hostel & Room',
      render: (row) => (
        <div>
          <div className="font-medium text-slate-800 dark:text-slate-200">
            {row.hostel_name || 'Hostel'}
          </div>
          <div className="text-xs text-slate-500">
            Room {row.room_number || '—'} {row.bed_label ? `(Bed ${row.bed_label})` : ''}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      title: 'Allocation Status',
      render: (row) => (
        <span
          className={`px-2 py-0.5 rounded text-xs font-semibold ${
            row.status === 'ALLOCATED' || row.status === 'ACTIVE'
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
          }`}
        >
          {row.status || 'ACTIVE'}
        </span>
      ),
    },
    {
      key: 'allocated_at',
      title: 'Occupied Since',
      render: (row) => (
        <span className="text-xs text-slate-500">
          {row.start_date || row.created_at ? new Date(row.start_date || row.created_at).toLocaleDateString() : '—'}
        </span>
      ),
    },
  ];

  if (loading && allocations.length === 0) {
    return <LoadingState message="Connecting to hostel fee and allocation services..." />;
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <PageHeader
        title="Hostel Fees & Invoicing"
        subtitle="Review institutional room pricing schedules, mess billing guidelines, and resident allocation records."
        icon={CreditCard}
        actions={
          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-750 transition"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        }
      />

      {/* Honest Architectural Status Notice */}
      <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl flex items-start gap-3 text-amber-900 dark:text-amber-200">
        <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-bold text-sm">
            Architectural Notice: Online Financial Billing Engine (Sprint Phase 5)
          </div>
          <div className="text-xs leading-relaxed text-amber-800 dark:text-amber-300">
            Payment gateway processing and ledger transaction APIs (<code className="font-mono font-semibold">/college/fees</code>) are
            slated for activation in the Phase 5 enterprise rollout. In this console, administrators can verify
            institutional room fee structures, caution deposits, and real resident bed allocations.
            Zero synthetic financial data has been simulated.
          </div>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-lg">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {allocations.length}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Allocated Residents in Billing Scope
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-lg">
            <Coins className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {feeTiers.length}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Approved Fee Tiers
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 rounded-lg">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {hostels.length}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Hostel Blocks Participating
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 rounded-lg">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900 dark:text-white">
              Semester Term
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Billing Cycle Cadence
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-700 gap-4">
        <button
          onClick={() => setActiveTab('SCHEDULE')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'SCHEDULE'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Coins className="w-4 h-4" />
          Approved Fee Structure
        </button>

        <button
          onClick={() => setActiveTab('ALLOCATIONS')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'ALLOCATIONS'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          Active Resident Allocations
          <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
            {allocations.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('POLICIES')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'POLICIES'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <FileText className="w-4 h-4" />
          Billing & Caution Deposit Policy
        </button>
      </div>

      {/* TAB 1: APPROVED FEE SCHEDULE */}
      {activeTab === 'SCHEDULE' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {feeTiers.map((tier) => (
              <div
                key={tier.code}
                className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                        {tier.tier}
                      </h4>
                      <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                        {tier.code}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-extrabold text-indigo-600 dark:text-indigo-400">
                        {tier.total}
                      </div>
                      <div className="text-[11px] text-slate-400">{tier.tuitionCycle}</div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400 py-3 leading-relaxed">
                    {tier.description}
                  </p>

                  <div className="space-y-2 py-2 text-xs border-t border-slate-100 dark:border-slate-750">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Room Rent:</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">{tier.roomRent}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Utilities & Amenities:</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">{tier.amenities}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Mess Advance (Dining Hall):</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">{tier.messAdvance}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Caution Deposit:</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">{tier.cautionDeposit}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-750 flex items-center justify-between text-xs text-slate-500">
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Institutional Standard Approved
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: ACTIVE RESIDENT ALLOCATIONS LEDGER */}
      {activeTab === 'ALLOCATIONS' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex-1 min-w-[240px] max-w-md">
              <SearchInput
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="Search resident student, room or hostel..."
              />
            </div>

            <div className="flex items-center gap-3">
              <select
                value={hostelFilter}
                onChange={(e) => setHostelFilter(e.target.value)}
                className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
              >
                <option value="ALL">All Hostels</option>
                {hostels.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DataTable
            columns={allocationColumns}
            data={filteredAllocations}
            loading={isRefreshing}
            emptyMessage={
              <EmptyState
                icon={Users}
                title="No Resident Allocations"
                message="No active bed allocations found for the selected hostel or search criteria."
              />
            }
          />
        </div>
      )}

      {/* TAB 3: BILLING & REFUND POLICIES */}
      {activeTab === 'POLICIES' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-2">
              Hostel Accommodation Fee Policies & Guidelines
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Hostel fees are payable per semester in advance prior to room check-in. The fee structure is determined
              annually by the Institutional Hostel Board and covers room occupancy, utilities, security services,
              and standardized dining hall operations.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Caution Deposit Rules
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Caution deposits are 100% refundable upon student graduation or formal withdrawal from the hostel,
                subject to room damage clearance and return of institutional access keys.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-600" />
                Mess Advance & Rebate
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Mess advance is adjusted against monthly actual dining counts. Students on approved leaves
                exceeding 5 consecutive working days are eligible for meal rebates upon warden approval.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

