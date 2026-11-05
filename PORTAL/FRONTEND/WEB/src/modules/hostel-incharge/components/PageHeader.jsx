import React from 'react';

/**
 * Enterprise Page Header component for Hostel In-Charge portal.
 * Renders category badge, main title, subtitle description, and action buttons.
 */
export default function PageHeader({
  title,
  subtitle,
  description,
  category,
  categoryIcon: CategoryIcon,
  icon: DirectIcon,
  actions,
  className = '',
}) {
  const subText = subtitle || description;
  const IconComponent = CategoryIcon || DirectIcon;

  return (
    <div className={`enterprise-hero-header ${className}`}>
      <div className="hero-header-titles">
        {(category || IconComponent) && (
          <div className="hero-category-pill">
            {IconComponent && <IconComponent size={13} />}
            <span>{category || 'Operations'}</span>
          </div>
        )}
        <h1 className="hero-main-title">{title}</h1>
        {subText && <p className="hero-subtitle">{subText}</p>}
      </div>

      {actions && (
        <div className="hero-action-buttons hero-header-actions">
          {actions}
        </div>
      )}
    </div>
  );
}
