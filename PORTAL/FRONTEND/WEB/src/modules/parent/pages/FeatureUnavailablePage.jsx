import React from 'react';
import EmptyState from '../../../shared/components/EmptyState';
import './parent.css';

export default function ParentFeatureUnavailablePage({ title, description }) {
  return (
    <div className="parent-page">
      <header className="parent-page-header">
        <div>
          <p className="eyebrow">Parent &amp; guardian</p>
          <h1>{title}</h1>
        </div>
      </header>
      <EmptyState
        title="This service is not available yet"
        description={description}
      />
    </div>
  );
}
