import React, { useState, useEffect } from 'react';
import { Filter, RotateCcw, Calendar, Building2, AlertCircle } from 'lucide-react';

export default function FilterBar({ colleges = [], filters = {}, onApplyFilters, onResetFilters }) {
  const [startDate, setStartDate] = useState(filters.start_date || '');
  const [endDate, setEndDate] = useState(filters.end_date || '');
  const [collegeId, setCollegeId] = useState(filters.college_id || '');
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    setStartDate(filters.start_date || '');
    setEndDate(filters.end_date || '');
    setCollegeId(filters.college_id || '');
  }, [filters]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setValidationError('');

    if (startDate && endDate && startDate > endDate) {
      setValidationError('Start date cannot be after end date.');
      return;
    }

    onApplyFilters({
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      college_id: collegeId || undefined,
    });
  };

  const handleReset = () => {
    setStartDate('');
    setEndDate('');
    setCollegeId('');
    setValidationError('');
    onResetFilters();
  };

  return (
    <div className="filter-toolbar-card">
      <form onSubmit={handleSubmit} className="filter-form">
        <div className="filter-controls-row">
          {/* College Tenant Filter */}
          <div className="filter-field-box flex-grow">
            <label className="filter-field-label" htmlFor="filter-college">
              <Building2 size={13} className="text-slate-400" />
              <span>College Tenant</span>
            </label>
            <select
              id="filter-college"
              className="filter-select-input"
              value={collegeId}
              onChange={(e) => setCollegeId(e.target.value)}
            >
              <option value="">All Colleges (Global Scope)</option>
              {colleges.map((c) => (
                <option key={c.college_id} value={c.college_id}>
                  {c.name} ({c.college_code})
                </option>
              ))}
            </select>
          </div>

          {/* Activity Start Date */}
          <div className="filter-field-box">
            <label className="filter-field-label" htmlFor="filter-start-date">
              <Calendar size={13} className="text-slate-400" />
              <span>Activity Start Date</span>
            </label>
            <input
              type="date"
              id="filter-start-date"
              className="filter-date-input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          {/* Activity End Date */}
          <div className="filter-field-box">
            <label className="filter-field-label" htmlFor="filter-end-date">
              <Calendar size={13} className="text-slate-400" />
              <span>Activity End Date</span>
            </label>
            <input
              type="date"
              id="filter-end-date"
              className="filter-date-input"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          {/* Action Buttons */}
          <div className="filter-actions-inline">
            <button
              type="submit"
              className="btn-enterprise btn-primary-blue"
              id="btn-apply-filters"
            >
              <Filter size={13} />
              <span>Apply Filters</span>
            </button>
            <button
              type="button"
              className="btn-enterprise btn-outline-soft"
              onClick={handleReset}
              id="btn-reset-filters"
            >
              <RotateCcw size={13} />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {validationError && (
          <div className="filter-error-msg">
            <AlertCircle size={14} />
            <span>{validationError}</span>
          </div>
        )}
      </form>
    </div>
  );
}
