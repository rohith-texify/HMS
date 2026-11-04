import React, { useState } from 'react';
import PageHeader from '../components/PageHeader';
import { exportToCSV } from '../utils/exportUtils';
import { BarChart3, Download, FileSpreadsheet, CheckCircle2 } from 'lucide-react';

export default function ReportsPage() {
  const [downloadSuccess, setDownloadSuccess] = useState(null);

  const handleExportSample = (reportName) => {
    const sample = [
      { Report: reportName, GeneratedAt: new Date().toISOString(), Status: 'ACTIVE' },
    ];
    exportToCSV(sample, `${reportName.toLowerCase().replace(/\s+/g, '_')}_export.csv`);
    setDownloadSuccess(`Exported ${reportName} successfully.`);
    setTimeout(() => setDownloadSuccess(null), 3000);
  };

  return (
    <div>
      <PageHeader
        title="Hostel Reports & Analytics"
        description="Extract occupancy reports, attendance summaries, and student movement metrics."
        icon={BarChart3}
      />

      {downloadSuccess && (
        <div style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success-text)', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 size={16} />
          <span>{downloadSuccess}</span>
        </div>
      )}

      <div className="grid-3">
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <FileSpreadsheet size={20} color="var(--primary-color)" />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Occupancy & Vacancy Report</h3>
            </div>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Summary of total rooms, allocated beds, vacant capacity, and block distribution.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => handleExportSample('Hostel Occupancy Report')}
            style={{ marginTop: '20px', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}
          >
            <Download size={15} />
            <span>Export CSV</span>
          </button>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <FileSpreadsheet size={20} color="var(--primary-color)" />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Daily Attendance Summary</h3>
            </div>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Aggregated curfew compliance, present counts, and unresolved student absences.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => handleExportSample('Daily Attendance Summary')}
            style={{ marginTop: '20px', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}
          >
            <Download size={15} />
            <span>Export CSV</span>
          </button>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <FileSpreadsheet size={20} color="var(--primary-color)" />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Leave & Movement Log</h3>
            </div>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Resident leave approval records, return dates, and outing authorizations.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => handleExportSample('Leave Movement Report')}
            style={{ marginTop: '20px', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}
          >
            <Download size={15} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>
    </div>
  );
}

