import React from 'react';

/**
 * Enterprise Page Header component for Institutional & College Admin portals.
 * Renders category badge, main title, subtitle description, and action buttons.
 */
export default function PageHeader({
  title,
  subtitle,
  category,
  categoryIcon: CategoryIcon,
  actions,
  className = '',
}) {
  return (
    <div className={`enterprise-hero-header ${className}`}>
      <div className="hero-header-titles">
        {category && (
          <div className="hero-category-pill">
            {CategoryIcon && <CategoryIcon size={13} />}
            <span>{category}</span>
          </div>
        )}
        <h1 className="hero-main-title">{title}</h1>
        {subtitle && <p className="hero-subtitle">{subtitle}</p>}
      </div>

      {actions && <div className="hero-header-actions">{actions}</div>}
    </div>
  );
}

