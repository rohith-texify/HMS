/**
 * Formatting utilities for dates, statuses, and identifiers
 */
export function formatDate(dateString, fallback = '—') {
  if (!dateString) return fallback;
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return fallback;
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return fallback;
  }
}

export function formatDateTime(dateString, fallback = '—') {
  if (!dateString) return fallback;
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return fallback;
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return fallback;
  }
}

export function truncateUUID(uuid, length = 8) {
  if (!uuid) return '—';
  const str = String(uuid);
  return str.length > length ? `${str.substring(0, length)}...` : str;
}

export function getStatusBadgeVariant(status) {
  const s = String(status || '').toUpperCase();
  switch (s) {
    case 'ACTIVE':
    case 'ALLOCATED':
    case 'APPROVED':
    case 'RESOLVED':
    case 'COMPLETED':
    case 'PRESENT':
      return 'success';
    case 'PENDING':
    case 'UNDER_REVIEW':
    case 'IN_PROGRESS':
    case 'LEAVE':
      return 'warning';
    case 'REJECTED':
    case 'SUSPENDED':
    case 'CANCELLED':
    case 'FAILED':
    case 'ABSENT':
    case 'EXPIRED':
      return 'danger';
    case 'OCCUPIED':
    case 'PRIMARY':
      return 'info';
    default:
      return 'neutral';
  }
}

export default {
  formatDate,
  formatDateTime,
  truncateUUID,
  getStatusBadgeVariant,
};

