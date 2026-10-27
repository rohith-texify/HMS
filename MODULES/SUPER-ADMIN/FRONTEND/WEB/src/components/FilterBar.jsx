import React, { useState, useEffect } from 'react';

export default function FilterBar({ colleges, filters, onApplyFilters, onResetFilters }) {
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
    <div className="filter-card">
      <form onSubmit={handleSubmit}>
        <div className="filter-grid">
          <div className="filter-group">
            <label className="filter-label" htmlFor="filter-college">College Tenant</label>
            <select
              id="filter-college"
              className="form-select"
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

          <div className="filter-group">
            <label className="filter-label" htmlFor="filter-start-date">Activity Start Date</label>
            <input
              type="date"
              id="filter-start-date"
              className="form-input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label className="filter-label" htmlFor="filter-end-date">Activity End Date</label>
            <input
              type="date"
              id="filter-end-date"
              className="form-input"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="submit" className="btn btn-primary" id="btn-apply-filters">
              Apply Filters
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={handleReset}
              id="btn-reset-filters"
            >
              Reset
            </button>
          </div>
        </div>

        {validationError && (
          <div style={{ color: 'var(--danger-text)', fontSize: '0.8rem', marginTop: '8px' }}>
            ⚠️ {validationError}
          </div>
        )}
      </form>
    </div>
  );
}
