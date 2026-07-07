const userModel = require('../models/userModel');
const eventModel = require('../models/eventModel');

// Icons match the sidebar entries in src/config/navigation.js for the same
// concept, so the two stay visually tied together. Cards/stats tied to a
// module that isn't implemented yet stay static placeholders
// (value: '—', status: 'Coming soon') until that module lands — see
// docs/PROJECT_BLUEPRINT.md, Section 7 for the phase order. "Upcoming
// Events" (user) and "Total Events" (admin) below are now live, since Event
// Management is implemented as of Phase 4.
const USER_DASHBOARD_CARDS = [
  {
    key: 'myRegistrations',
    title: 'My Event Registrations',
    description: 'Track the status of events you have applied to volunteer for.',
    icon: 'fa-solid fa-clipboard-list',
  },
  {
    key: 'myVolunteerHours',
    title: 'My Volunteer Hours',
    description: 'See your accumulated, verified volunteering hours.',
    icon: 'fa-solid fa-clock',
  },
  {
    key: 'myDonations',
    title: 'My Donations',
    description: 'View your recorded donation history.',
    icon: 'fa-solid fa-hand-holding-heart',
  },
  {
    key: 'myCertificates',
    title: 'My Certificates',
    description: 'Download certificates for events you completed.',
    icon: 'fa-solid fa-award',
  },
  {
    key: 'notifications',
    title: 'Notifications',
    description: 'Stay updated on your registrations, events, and donations.',
    icon: 'fa-solid fa-bell',
  },
];

async function getUserDashboardCards() {
  const upcomingEventsCount = await eventModel.countUpcomingPublished();

  const liveCard = {
    key: 'upcomingEvents',
    title: 'Upcoming Events',
    description: 'Browse and register for upcoming community events.',
    icon: 'fa-solid fa-calendar-days',
    value: String(upcomingEventsCount),
    status: null,
    href: '/events',
  };

  const placeholderCards = USER_DASHBOARD_CARDS.map((card) => ({
    ...card,
    value: '—',
    status: 'Coming soon',
    href: null,
  }));

  return [liveCard, ...placeholderCards];
}

// Total Users and Total Events are real (Authentication and Event
// Management are both implemented). The rest stay placeholders until their
// respective modules are implemented.
async function getAdminStats() {
  const totalUsers = await userModel.countUsers();
  const totalEvents = await eventModel.countAll();

  return [
    {
      key: 'totalUsers',
      label: 'Total Users',
      value: totalUsers,
      isLive: true,
      icon: 'fa-solid fa-users',
    },
    {
      key: 'totalEvents',
      label: 'Total Events',
      value: totalEvents,
      isLive: true,
      icon: 'fa-solid fa-calendar-days',
    },
    {
      key: 'totalVolunteers',
      label: 'Total Volunteers',
      value: '—',
      isLive: false,
      icon: 'fa-solid fa-people-group',
    },
    {
      key: 'totalDonations',
      label: 'Total Donations',
      value: '—',
      isLive: false,
      icon: 'fa-solid fa-hand-holding-heart',
    },
    {
      key: 'totalCertificates',
      label: 'Total Certificates',
      value: '—',
      isLive: false,
      icon: 'fa-solid fa-award',
    },
  ];
}

// "Create Event" is now a real action (Event Management is implemented).
// The rest remain disabled until their modules exist.
function getAdminQuickActions() {
  return [
    {
      key: 'createEvent',
      label: 'Create Event',
      icon: 'fa-solid fa-plus',
      href: '/admin/events/create',
    },
    {
      key: 'approveRegistrations',
      label: 'Approve Registrations',
      icon: 'fa-solid fa-check',
      href: null,
    },
    {
      key: 'recordDonation',
      label: 'Record Donation',
      icon: 'fa-solid fa-hand-holding-heart',
      href: null,
    },
    {
      key: 'generateCertificate',
      label: 'Generate Certificate',
      icon: 'fa-solid fa-award',
      href: null,
    },
    { key: 'viewReports', label: 'View Reports', icon: 'fa-solid fa-chart-line', href: null },
  ];
}

module.exports = { getUserDashboardCards, getAdminStats, getAdminQuickActions };
