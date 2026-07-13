// Sidebar navigation structure per role, shared by the app-shell layout
// across every module. Items with href: null render as disabled,
// "Coming soon" entries — they preview where a future module will live in
// the sidebar without linking anywhere until that module exists.

const userNavItems = [
  { key: 'dashboard', label: 'Dashboard', icon: 'fa-solid fa-gauge', href: '/dashboard' },
  {
    key: 'notifications',
    label: 'Notifications',
    icon: 'fa-solid fa-bell',
    href: '/notifications',
  },
  {
    key: 'events',
    label: 'Upcoming Events',
    icon: 'fa-solid fa-calendar-days',
    href: '/events',
  },
  {
    key: 'registrations',
    label: 'My Registrations',
    icon: 'fa-solid fa-clipboard-list',
    href: '/my-registrations',
  },
  { key: 'hours', label: 'My Volunteer Hours', icon: 'fa-solid fa-clock', href: '/my-attendance' },
  {
    key: 'donations',
    label: 'My Donations',
    icon: 'fa-solid fa-hand-holding-heart',
    href: '/my-donations',
  },
  {
    key: 'certificates',
    label: 'My Certificates',
    icon: 'fa-solid fa-award',
    href: '/my-certificates',
  },
];

const adminNavItems = [
  { key: 'dashboard', label: 'Dashboard', icon: 'fa-solid fa-gauge', href: '/admin/dashboard' },
  {
    key: 'events',
    label: 'Manage Events',
    icon: 'fa-solid fa-calendar-days',
    href: '/admin/events',
  },
  {
    key: 'donations',
    label: 'Donations',
    icon: 'fa-solid fa-hand-holding-heart',
    href: '/admin/donations',
  },
  {
    key: 'certificates',
    label: 'Certificates',
    icon: 'fa-solid fa-award',
    href: '/admin/certificates',
  },
  {
    key: 'reports',
    label: 'Reports',
    icon: 'fa-solid fa-chart-line',
    href: '/admin/reports',
  },
];

function getNavItems(role) {
  return role === 'admin' ? adminNavItems : userNavItems;
}

module.exports = { getNavItems };
