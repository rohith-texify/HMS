import React from 'react';
import PageHeader from '../components/PageHeader';
import { FolderLock, FileText, CheckCircle2 } from 'lucide-react';

export default function DocumentsPage() {
  return (
    <div>
      <PageHeader
        title="Documents & Onboarding Records"
        description="Resident verification archives, hostel allotment slips, and disciplinary notices."
        icon={FolderLock}
      />

      <div className="card">
        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '12px' }}>
          Hostel Documentation Records
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '24px' }}>
          Resident student admission documentation, guardian authorizations, and signed hostel rules are maintained
          in the student profiles archive. Use the Residents Directory to view individual resident submission details.
        </p>

        <div className="grid-3">
          <div className="stat-card">
            <div className="stat-icon">📄</div>
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Allotment Slips
              </div>
              <div className="stat-label">Verified upon room check-in</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">🪪</div>
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Guardian Undertakings
              </div>
              <div className="stat-label">Emergency medical consent</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">📋</div>
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Curfew Undertakings
              </div>
              <div className="stat-label">Hostel rules compliance</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

