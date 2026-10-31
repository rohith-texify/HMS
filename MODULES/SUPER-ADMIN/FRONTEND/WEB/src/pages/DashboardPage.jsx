import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  Eye,
  Users,
  MousePointer,
  MoreHorizontal,
  Store,
  Building2,
  Headphones,
  Watch,
  Smartphone,
  ArrowUpRight,
  ArrowDownRight,
  Maximize2,
  Sparkles,
} from 'lucide-react';
import { fetchDashboard, fetchColleges, DEFAULT_DASHBOARD_DATA } from '../services/dashboardService';

// Activity Area Chart Data matching the spline curve in the screenshot
const activityTrendData = [
  { name: '1 Jan', value: 4900 },
  { name: '8 Jan', value: 4600 },
  { name: '10 Jan', value: 9200 },
  { name: '12 Jan', value: 7800 },
  { name: '15 Jan', value: 7200 },
  { name: '18 Jan', value: 13800 },
  { name: '22 Jan', value: 11400 },
  { name: '26 Jan', value: 14900 },
  { name: '29 Jan', value: 13200 },
];

// Weekly Activity Bar Chart Data matching "Most Day Active"
const weeklyBarData = [
  { day: 'Sun', value: 4200, active: false },
  { day: 'Mon', value: 3700, active: false },
  { day: 'Tue', value: 8162, active: true },
  { day: 'Wed', value: 2400, active: false },
  { day: 'Thu', value: 2100, active: false },
  { day: 'Fr', value: 5200, active: false },
  { day: 'Sat', value: 5000, active: false },
];

export default function DashboardPage() {
  const [data, setData] = useState(DEFAULT_DASHBOARD_DATA);
  const [colleges, setColleges] = useState([]);
  const [filters, setFilters] = useState({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const requestCounter = useRef(0);

  useEffect(() => {
    let isMounted = true;
    fetchColleges()
      .then((collegesList) => {
        if (isMounted) setColleges(collegesList || []);
      })
      .catch((err) => {
        console.warn('Failed to load colleges list:', err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const loadDashboardData = async (currentFilters) => {
    const currentRequestId = ++requestCounter.current;
    setIsRefreshing(true);
    try {
      const responseData = await fetchDashboard(currentFilters);
      if (currentRequestId === requestCounter.current && responseData) {
        setData(responseData);
      }
    } catch (err) {
      console.warn('Dashboard data refresh notice:', err.message);
    } finally {
      if (currentRequestId === requestCounter.current) {
        setIsRefreshing(false);
      }
    }
  };

  useEffect(() => {
    loadDashboardData(filters);
  }, [filters]);

  // Exact products from the Shopeers screenshot, enriched with HMS college mapping if present
  const displayProducts = [
    {
      id: '#83009',
      name: colleges[0]?.name || 'Hybrid Active Noise Cance...',
      sold: '2,310 sold',
      revenue: '$124.839',
      rating: '5.0',
      icon: <Headphones size={15} />,
    },
    {
      id: '#83001',
      name: colleges[1]?.name || 'Casio G-Shock Shock Resi...',
      sold: '1,230 sold',
      revenue: '$92.662',
      rating: '4.8',
      icon: <Watch size={15} />,
    },
    {
      id: '#83004',
      name: colleges[2]?.name || 'SAMSUNG Galaxy S25 Ultr...',
      sold: '812 sold',
      revenue: '$74.048',
      rating: '4.7',
      icon: <Smartphone size={15} />,
    },
  ];

  return (
    <div className="shopeers-dashboard-container">
      {/* =========================================================================
          ROW 1: TOP 3 KPI STAT CARDS
         ========================================================================= */}
      <div className="shopeers-kpi-grid">
        {/* Card 1: Page Views */}
        <div className="shopeers-stat-card">
          <div className="shopeers-stat-header">
            <span className="shopeers-stat-label">Page Views</span>
            <div className="shopeers-stat-icon-wrap blue">
              <Eye size={16} />
            </div>
          </div>
          <div className="shopeers-stat-body">
            <div className="shopeers-stat-number-wrap">
              <span className="shopeers-stat-value">16.431</span>
              <span className="shopeers-stat-trend-badge green">
                <ArrowUpRight size={13} />
                <span>15.5%</span>
              </span>
            </div>
            <div className="shopeers-stat-footnote">vs. 14,653 last period</div>
          </div>
        </div>

        {/* Card 2: Visitors */}
        <div className="shopeers-stat-card">
          <div className="shopeers-stat-header">
            <span className="shopeers-stat-label">Visitors</span>
            <div className="shopeers-stat-icon-wrap blue">
              <Users size={16} />
            </div>
          </div>
          <div className="shopeers-stat-body">
            <div className="shopeers-stat-number-wrap">
              <span className="shopeers-stat-value">4.880</span>
              <span className="shopeers-stat-trend-badge green">
                <ArrowUpRight size={13} />
                <span>6.6%</span>
              </span>
            </div>
            <div className="shopeers-stat-footnote">vs. 5,732 last period</div>
          </div>
        </div>

        {/* Card 3: Click */}
        <div className="shopeers-stat-card">
          <div className="shopeers-stat-header">
            <span className="shopeers-stat-label">Click</span>
            <div className="shopeers-stat-icon-wrap light-purple">
              <MousePointer size={16} />
            </div>
          </div>
          <div className="shopeers-stat-body">
            <div className="shopeers-stat-number-wrap">
              <span className="shopeers-stat-value">0.863</span>
              <span className="shopeers-stat-trend-badge red">
                <ArrowDownRight size={13} />
                <span>3.2%</span>
              </span>
            </div>
            <div className="shopeers-stat-footnote">vs. 3,294 last period</div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          ROW 2 & 3: MAIN DUAL-COLUMN LAYOUT
         ========================================================================= */}
      <div className="shopeers-content-grid">
        {/* LEFT COLUMN: Total Profit Chart & Best Selling Products */}
        <div className="shopeers-left-column">
          {/* Main Chart Card ("Total Profit" style) */}
          <div className="shopeers-card shopeers-profit-chart-card">
            <div className="shopeers-chart-header">
              <div className="shopeers-chart-meta">
                <span className="shopeers-card-title">Total Profit</span>
                <div className="shopeers-profit-number-row">
                  <span className="shopeers-profit-huge-stat">$446.7K</span>
                  <span className="shopeers-stat-trend-badge green">
                    <ArrowUpRight size={13} />
                    <span>24.4%</span>
                  </span>
                  <span className="shopeers-profit-sub">vs. last period</span>
                </div>
              </div>
            </div>

            {/* Smooth Spline Area Chart */}
            <div className="shopeers-chart-container">
              <ResponsiveContainer width="100%" height={210}>
                <AreaChart data={activityTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="shopeersBlueArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563EB" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="name"
                    stroke="#94A3B8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#94A3B8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `${val / 1000}K`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: '10px',
                      border: '1px solid #E2E8F0',
                      boxShadow: '0 4px 14px rgba(0,0,0,0.06)',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#2563EB"
                    strokeWidth={2.8}
                    fill="url(#shopeersBlueArea)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Nested Customers Breakdown Box Matching Screenshot */}
            <div className="shopeers-breakdown-card">
              <div className="shopeers-breakdown-header">
                <span className="shopeers-breakdown-title">Customers</span>
                <button type="button" className="shopeers-dots-btn" aria-label="More options">
                  <MoreHorizontal size={15} />
                </button>
              </div>

              <div className="shopeers-breakdown-columns">
                <div className="shopeers-breakdown-col">
                  <div className="shopeers-breakdown-meta">
                    <Store size={15} className="text-blue-600" />
                    <span className="shopeers-col-number">2.884</span>
                  </div>
                  <span className="shopeers-col-label">Retailers</span>
                  <div className="shopeers-col-underline blue" />
                </div>

                <div className="shopeers-breakdown-col">
                  <div className="shopeers-breakdown-meta">
                    <Building2 size={15} className="text-emerald-500" />
                    <span className="shopeers-col-number">1.432</span>
                  </div>
                  <span className="shopeers-col-label">Distributors</span>
                  <div className="shopeers-col-underline green" />
                </div>

                <div className="shopeers-breakdown-col">
                  <div className="shopeers-breakdown-meta">
                    <Users size={15} className="text-orange-500" />
                    <span className="shopeers-col-number">562</span>
                  </div>
                  <span className="shopeers-col-label">Wholesalers</span>
                  <div className="shopeers-col-underline orange" />
                </div>
              </div>
            </div>
          </div>

          {/* Table Card ("Best Selling Products" style) */}
          <div className="shopeers-card shopeers-table-card">
            <div className="shopeers-card-topbar">
              <h2 className="shopeers-card-title">Best Selling Products</h2>
              <button type="button" className="shopeers-dots-btn" aria-label="More options">
                <MoreHorizontal size={18} />
              </button>
            </div>

            <div className="shopeers-table-responsive">
              <table className="shopeers-light-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>NAME</th>
                    <th>SOLD</th>
                    <th>REVENUE</th>
                    <th>RATING</th>
                  </tr>
                </thead>
                <tbody>
                  {displayProducts.map((item, index) => (
                    <tr key={item.id || index}>
                      <td className="shopeers-table-id">{item.id}</td>
                      <td>
                        <div className="shopeers-table-name-wrap">
                          <div className="shopeers-table-avatar">
                            {item.icon}
                          </div>
                          <span className="shopeers-table-name-text">
                            {item.name}
                          </span>
                        </div>
                      </td>
                      <td className="shopeers-table-sold">{item.sold}</td>
                      <td className="shopeers-table-rev">{item.revenue}</td>
                      <td>
                        <div className="shopeers-rating-cell">
                          <span className="shopeers-star">★</span>
                          <span>({item.rating})</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Weekly Bar Chart, Radial Gauge, and AI Assistant */}
        <div className="shopeers-right-column">
          {/* Card 1: Most Day Active (Bar Chart) */}
          <div className="shopeers-card shopeers-bar-chart-card">
            <div className="shopeers-card-topbar">
              <h2 className="shopeers-card-title">Most Day Active</h2>
              <button type="button" className="shopeers-dots-btn" aria-label="Options">
                <MoreHorizontal size={18} />
              </button>
            </div>

            <div className="shopeers-bar-chart-wrap">
              {/* Callout pill directly above Tuesday */}
              <div className="shopeers-bar-callout-badge">
                <span>8.162</span>
              </div>
              <ResponsiveContainer width="100%" height={170}>
                <BarChart data={weeklyBarData} margin={{ top: 24, right: 0, left: 0, bottom: 0 }}>
                  <XAxis
                    dataKey="day"
                    stroke="#94A3B8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={26}>
                    {weeklyBarData.map((entry) => (
                      <Cell
                        key={entry.day}
                        fill={entry.active ? '#2563EB' : '#EEF2F6'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Card 2: Radial Gauge ("Repeat Customer Rate" style) */}
          <div className="shopeers-card shopeers-radial-gauge-card">
            <div className="shopeers-card-topbar">
              <h2 className="shopeers-card-title">Repeat Customer Rate</h2>
              <button type="button" className="shopeers-dots-btn" aria-label="Options">
                <MoreHorizontal size={18} />
              </button>
            </div>

            {/* Semicircular Radial Gauge Meter with Radiating Dashed Rays */}
            <div className="shopeers-gauge-meter-wrapper">
              <svg className="shopeers-gauge-svg" viewBox="0 0 200 115">
                {/* Background Dash Arc */}
                <path
                  d="M 25 105 A 75 75 0 0 1 175 105"
                  fill="none"
                  stroke="#E2E8F0"
                  strokeWidth="14"
                  strokeDasharray="4 4"
                  strokeLinecap="round"
                />
                {/* Active Colored Arc with Gradient */}
                <path
                  d="M 25 105 A 75 75 0 0 1 175 105"
                  fill="none"
                  stroke="url(#shopeersGaugeGradient)"
                  strokeWidth="14"
                  strokeDasharray="4 4"
                  strokeDashoffset="60"
                  strokeLinecap="round"
                />
                <defs>
                  <linearGradient id="shopeersGaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#10B981" />
                    <stop offset="65%" stopColor="#059669" />
                    <stop offset="100%" stopColor="#14B8A6" />
                  </linearGradient>
                </defs>
              </svg>

              <div className="shopeers-gauge-inner-val">
                <span className="shopeers-gauge-big-num">68%</span>
                <span className="shopeers-gauge-subtext">On track for 80% target</span>
              </div>
            </div>

            <button type="button" className="shopeers-gauge-detail-btn">
              Show details
            </button>
          </div>

          {/* Card 3: AI Assistant Widget */}
          <div className="shopeers-card shopeers-ai-assistant-card">
            <div className="shopeers-card-topbar">
              <div className="shopeers-ai-title-wrap">
                <Sparkles size={16} className="text-blue-600" />
                <h2 className="shopeers-card-title">AI Assistant</h2>
              </div>
              <button type="button" className="shopeers-dots-btn" aria-label="Expand AI panel">
                <Maximize2 size={15} />
              </button>
            </div>

            <div className="shopeers-ai-body-content">
              {/* Floating Glowing 3D Orb */}
              <div className="shopeers-ai-orb-stage">
                <div className="shopeers-ai-sphere" />
                <div className="shopeers-ai-sphere-shadow" />
              </div>

              <div className="shopeers-ai-insight-text">
                All services synchronized. 0 critical anomalies detected in the last 24 hours.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
