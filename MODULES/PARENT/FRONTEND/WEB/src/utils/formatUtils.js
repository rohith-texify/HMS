/**
 * Utility functions for formatting values in the Parent frontend.
 */

export function formatTimestamp(value) {
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

export function formatNotificationType(type) {
  if (!type) return 'GENERAL';
  return String(type).replaceAll('_', ' ');
}

