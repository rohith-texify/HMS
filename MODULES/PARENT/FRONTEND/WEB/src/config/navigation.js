const AVAILABLE_NAVIGATION = [
  { label: 'Overview', path: '/dashboard', feature: 'unread-notifications' },
  { label: 'Notifications', path: '/notifications', feature: 'account-notifications' },
  { label: "Today's mess menu", path: '/mess', feature: 'today-mess-menu' },
];

export function getParentNavigation(user) {
  if (user?.role !== 'PARENT' || user?.scope !== 'COLLEGE') return [];
  return AVAILABLE_NAVIGATION;
}
