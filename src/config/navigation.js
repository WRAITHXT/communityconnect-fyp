// Sidebar navigation structure per role, shared by the app-shell layout
// across every module. Items with href: null render as disabled,
// "Coming soon" entries — they preview where each future module (Reports)
// will live in the sidebar without linking anywhere until that module
// exists.

const userNavItems = [
  { key: 'dashboard', label: 'Dashboard', icon: 'fa-solid fa-gauge', href: '/dashboard' },
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
  { key: 'notifications', label: 'Notifications', icon: 'fa-solid fa-bell', href: null },
];

const adminNavItems = [
  { key: 'dashboard', label: 'Dashboard', icon: 'fa-solid fa-gauge', href: '/admin/dashboard' },
  {
    key: 'events',
    label: 'Manage Events',
    icon: 'fa-solid fa-calendar-days',
    href: '/admin/events',
  },
  // No global cross-event registrations page exists — volunteer
  // registrations are managed per-event, via a "Volunteers" button on each
  // event's own detail page (/admin/events/:id/volunteers). Left as a
  // disabled placeholder here until/unless a global view is built later
  // (e.g. as part of Reports).
  {
    key: 'registrations',
    label: 'Volunteer Registrations',
    icon: 'fa-solid fa-clipboard-list',
    href: null,
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
  { key: 'reports', label: 'Reports', icon: 'fa-solid fa-chart-line', href: null },
  { key: 'users', label: 'Manage Users', icon: 'fa-solid fa-users', href: null },
];

function getNavItems(role) {
  return role === 'admin' ? adminNavItems : userNavItems;
}

module.exports = { getNavItems };
